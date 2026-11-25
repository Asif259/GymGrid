// Automation worker (multi-tenant): outbox dispatch (receipt PDF, email, Sheets), renewal reminders, owner digest per gym.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts } from 'npm:pdf-lib@1.17.1';
import nodemailer from 'npm:nodemailer@6.9.16';
import { receiptLines } from '../_shared/receipt.js';
import { selectReminders, reminderEmail } from '../_shared/reminders.js';
import { digestText, digestHtml } from '../_shared/digest.js';
import { memberRow, paymentRow, MEMBER_HEADERS, PAYMENT_HEADERS } from '../_shared/sheets.js';

const env = (k: string) => Deno.env.get(k) ?? '';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const MEMBER_SELECT = 'id, gym_id, name, phone, email, status, expiry_date, plans(name)';
const MAX_ATTEMPTS = 5;

const todayForZone = (tz = 'Asia/Dhaka') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Dhaka' }).format(new Date());

// Error text can echo an address or a message body: keep the cause, drop the addresses.
const safeMsg = (e: unknown) => String((e as Error)?.message ?? e).replace(/[^\s@<>"']+@[^\s@<>"']+/g, '[email]').slice(0, 300);

let mailer: ReturnType<typeof nodemailer.createTransport> | null = null;
function sendMail(msg: Record<string, unknown>) {
  const port = Number(env('SMTP_PORT') || 465);
  mailer ??= nodemailer.createTransport({
    host: env('SMTP_HOST'), port, secure: port === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  });
  return mailer.sendMail({ from: env('MAIL_FROM'), ...msg });
}

interface GymConfig {
  id: string;
  name: string;
  gym_name: string;
  slug: string;
  currency: string;
  timezone: string;
  app_url: string | null;
  sheet_id: string | null;
  owner_digest_email: string | null;
  saas_status: string;
}

async function loadActiveGyms(): Promise<GymConfig[]> {
  const { data, error } = await db
    .from('gyms')
    .select('id, name, slug, currency, timezone, app_url, sheet_id, owner_digest_email, saas_status')
    .in('saas_status', ['trial', 'active']);
  if (error) throw error;
  return (data ?? []).map((g) => ({ ...g, gym_name: g.name }));
}

// ---------- Google Sheets ----------
const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b as ArrayBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let gToken: { value: string; exp: number } | null = null;
async function googleToken() {
  if (gToken && gToken.exp > Date.now() + 60_000) return gToken.value;
  const sa = JSON.parse(env('GOOGLE_SERVICE_ACCOUNT_JSON'));
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  const j = await res.json();
  gToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return gToken.value;
}

async function sheets(sheetId: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${path}`, {
    ...init, headers: { authorization: `Bearer ${await googleToken()}`, 'content-type': 'application/json' },
  });
  if (!res.ok) throw new Error(`sheets ${res.status}`);
  return res.json();
}

async function upsertRow(sheetId: string, tab: 'Members' | 'Payments', row: string[]) {
  const ids: string[][] = (await sheets(sheetId, encodeURIComponent(`${tab}!A:A`))).values ?? [];
  const body = (values: string[][]) => ({ method: 'PUT', body: JSON.stringify({ values }) });
  if (!ids.length) {
    await sheets(sheetId, `${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`,
      body([tab === 'Members' ? MEMBER_HEADERS : PAYMENT_HEADERS]));
  }
  const i = ids.findIndex((r, n) => n > 0 && r[0] === row[0]);
  if (i > 0) {
    await sheets(sheetId, `${encodeURIComponent(`${tab}!A${i + 1}`)}?valueInputOption=RAW`, body([row]));
  } else {
    await sheets(sheetId, `${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: [row] }) });
  }
}

// ---------- dispatch ----------
const pdfSafe = (s: string) => s.replace(/৳/g, 'Tk ').replace(/[—–]/g, '-').replace(/[^\x20-\x7E]/g, '?');

async function receiptPdf(lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  lines.forEach((l, i) => page.drawText(pdfSafe(l), { x: 50, y: 780 - i * 28, size: i ? 12 : 16, font: i ? font : bold }));
  return doc.save();
}

type Ev = { id: number; gym_id: string; kind: string; member_id: string | null; payment_id: string | null; attempts: number };

async function handle(ev: Ev, gym: GymConfig) {
  if (!ev.member_id) return;
  const { data: m, error } = await db
    .from('members')
    .select(MEMBER_SELECT)
    .eq('id', ev.member_id)
    .eq('gym_id', gym.id)
    .maybeSingle();
  if (error) throw error;
  if (!m) return;
  if (ev.kind === 'member.created' || ev.kind === 'member.updated') {
    if (gym.sheet_id) await upsertRow(gym.sheet_id, 'Members', memberRow(m));
    else console.log(`event ${ev.id} (gym ${gym.slug}): sheets skipped, no sheet_id`);
    return;
  }
  if (ev.kind !== 'payment.paid') return;
  const { data: p, error: pe } = await db.from('payments').select('*').eq('id', ev.payment_id).single();
  if (pe) throw pe;
  if (p.status !== 'paid') return;
  const lines = receiptLines(p, m, gym);
  const pdf = await receiptPdf(lines);
  const path = `${m.id}/${p.id}.pdf`;
  const up = await db.storage.from('receipts').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (up.error) throw up.error;
  const { error: ue } = await db.from('payments').update({ receipt_path: path }).eq('id', p.id);
  if (ue) throw ue;
  if (m.email) {
    const { data: claimed, error: ce } = await db.from('payments')
      .update({ receipt_emailed_at: new Date().toISOString() }).eq('id', p.id).is('receipt_emailed_at', null).select('id');
    if (ce) throw ce;
    if (claimed?.length) {
      try {
        await sendMail({
          to: m.email, subject: lines[0], text: lines.join('\n'),
          attachments: [{ filename: `receipt-${p.receipt_no ?? p.id}.pdf`, content: pdf, contentType: 'application/pdf' }],
        });
      } catch (e) {
        await db.from('payments').update({ receipt_emailed_at: null }).eq('id', p.id);
        throw e;
      }
    }
  }
  if (gym.sheet_id) {
    await upsertRow(gym.sheet_id, 'Payments', paymentRow(p, m));
    await upsertRow(gym.sheet_id, 'Members', memberRow(m));
  } else console.log(`event ${ev.id} (gym ${gym.slug}): sheets skipped, no sheet_id`);
}

async function dispatch() {
  const gyms = await loadActiveGyms();
  const gymsById = new Map(gyms.map((g) => [g.id, g]));
  const { data: events, error } = await db.rpc('claim_automation_events', { max_n: 25 });
  if (error) throw error;
  let done = 0, failed = 0, skipped = 0;

  for (const ev of (events ?? []) as Ev[]) {
    const gym = gymsById.get(ev.gym_id);
    if (!gym) {
      await db.from('automation_events')
        .update({ status: 'done', processed_at: new Date().toISOString(), last_error: 'gym inactive or missing' })
        .eq('id', ev.id);
      skipped++;
      continue;
    }

    try {
      await handle(ev, gym);
      const { error: de } = await db.from('automation_events')
        .update({ status: 'done', processed_at: new Date().toISOString(), last_error: null }).eq('id', ev.id);
      if (de) throw de;
      done++;
    } catch (e) {
      const attempts = ev.attempts + 1;
      const msg = safeMsg(e);
      const { error: fe } = await db.from('automation_events')
        .update({ attempts, last_error: msg, claimed_at: null, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' }).eq('id', ev.id);
      console.error(`event ${ev.id} (gym ${gym.slug}, ${ev.kind}) failed: ${msg}${fe ? ' (and status write failed)' : ''}`);
      failed++;
    }
  }
  return { done, failed, skipped };
}

// ---------- reminders ----------
async function reminders() {
  const gyms = await loadActiveGyms();
  let sent = 0, failed = 0;

  for (const gym of gyms) {
    const today = todayForZone(gym.timezone);
    const { data: members, error } = await db
      .from('members')
      .select(MEMBER_SELECT)
      .eq('gym_id', gym.id)
      .not('email', 'is', null);
    if (error) throw error;

    const { data: log } = await db
      .from('reminder_log')
      .select('member_id')
      .eq('gym_id', gym.id)
      .eq('day', today);

    for (const m of selectReminders(members ?? [], today, (log ?? []).map((r) => r.member_id))) {
      const { data: claimed, error: ce } = await db.from('reminder_log')
        .upsert({ gym_id: gym.id, member_id: m.id, day: today }, { onConflict: 'member_id,day', ignoreDuplicates: true })
        .select('member_id');
      if (ce || !claimed?.length) continue;

      try {
        await sendMail(reminderEmail(m, gym));
        sent++;
      } catch (e) {
        await db.from('reminder_log').delete().eq('member_id', m.id).eq('day', today);
        console.error(`reminder ${m.id} (gym ${gym.slug}) failed: ${safeMsg(e)}`);
        failed++;
      }
    }
  }
  return { sent, failed };
}

// ---------- digest ----------
async function digest() {
  const gyms = await loadActiveGyms();
  let sent = 0;

  for (const gym of gyms) {
    const { data: d, error } = await db.rpc('owner_digest_for_gym', { p_gym_id: gym.id });
    if (error) throw error;

    const { data: owners, error: oe } = await db
      .from('gym_staff')
      .select('user_id')
      .eq('gym_id', gym.id)
      .eq('role', 'owner');
    if (oe) throw oe;

    const to = new Set<string>();
    if (gym.owner_digest_email) to.add(gym.owner_digest_email);
    for (const o of owners ?? []) {
      const { data } = await db.auth.admin.getUserById(o.user_id);
      if (data?.user?.email) to.add(data.user.email.toLowerCase());
    }

    for (const addr of to) {
      await sendMail({
        to: addr,
        subject: `${gym.gym_name} daily digest ${d.date}`,
        text: digestText(d, gym),
        html: digestHtml(d, gym),
      });
      sent++;
    }
  }
  return { gyms: gyms.length, sent };
}

// ---------- router ----------
const routes: Record<string, () => Promise<unknown>> = { dispatch, reminders, digest };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = env('AUTOMATION_SECRET');
  if (!secret || req.headers.get('x-automation-secret') !== secret) return new Response('forbidden', { status: 403 });
  const route = routes[new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''];
  if (!route) return new Response('not found', { status: 404 });
  try {
    return Response.json(await route());
  } catch (e) {
    console.error(`automation error: ${safeMsg(e)}`);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
});
