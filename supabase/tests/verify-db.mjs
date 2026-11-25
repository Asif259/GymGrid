// Applies migration + seed to in-process Postgres with a minimal Supabase auth shim, then runs data-verifier checks.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const root = process.argv[2];
const db = new PGlite();
const results = [];
const check = (name, ok, evidence) => results.push({ name, ok: !!ok, evidence });
const q = async (sql, params) => (await db.query(sql, params)).rows;
const fails = async (sql) => { try { await db.exec(sql); return null; } catch (e) { return e.message; } };

await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now());
  -- Same lookup order as Supabase's auth.uid(): legacy claim.sub, then the claims JSON.
  create function auth.uid() returns uuid language sql stable as $$ select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
  grant usage on schema auth to authenticated, anon;
`);
// Every migration except pg_cron (not available in PGlite), in filename order.
for (const f of readdirSync(`${root}/supabase/migrations`).filter(f => f.endsWith('.sql') && !f.includes('cron')).sort())
  await db.exec(readFileSync(`${root}/supabase/migrations/${f}`, 'utf8'));
await db.exec(readFileSync(`${root}/supabase/seed.sql`, 'utf8'));

const st = Object.fromEntries((await q(`select name, status from members`)).map(r => [r.name, r.status]));
check('seed statuses', st['Demo Alpha'] === 'active' && st['Demo Bravo'] === 'due' && st['Demo Charlie'] === 'expired'
  && st['Demo Delta'] === 'active' && st['Demo Echo'] === 'due', JSON.stringify(st));

const [d] = await q(`select expiry_date = (current_date + interval '3 months' - interval '1 day')::date ok from members where name='Demo Delta'`);
check('quarterly expiry = today + 3 months - 1 day', d.ok, d);

const ruleSql = `select count(*)::int n from members where status <> member_status(expiry_date, status)`;
check('status rule: 0 violations', (await q(ruleSql))[0].n === 0, ruleSql);

const [p] = await q(`select count(*)::int n from payments where status='paid' and (paid_on is null or period_end is null)`);
check('paid rows have paid_on and period_end', p.n === 0, p);
const [e] = await q(`select count(*)::int n from members m where expiry_date is distinct from
  (select max(period_end) from payments where member_id=m.id and status='paid')`);
check('expiry = latest paid period_end', e.n === 0, e);

check('bad phone rejected', await fails(`insert into members(name, phone) values ('x', '+880 17')`), 'phone "+880 17"');
check('duplicate phone rejected', await fails(`insert into members(name, phone) values ('x', '15550000001')`), 'dup 15550000001');

// Mark paid: Charlie's pending renewal (late) starts today.
await db.exec(`update payments set status='paid' where status='pending' and member_id='00000000-0000-0000-0000-00000000000c'`);
const [c] = await q(`select status, expiry_date = (current_date + interval '1 month' - interval '1 day')::date ok from members where name='Demo Charlie'`);
check('mark paid (late) -> active, expiry from today', c.status === 'active' && c.ok, c);

// Early renewal: Alpha pays again, continues from current expiry.
const [a0] = await q(`select expiry_date from members where name='Demo Alpha'`);
await db.exec(`insert into payments(member_id, amount, status) values ('00000000-0000-0000-0000-00000000000a', 1500, 'paid')`);
const [a1] = await q(`select period_start from payments where member_id='00000000-0000-0000-0000-00000000000a' order by created_at desc, period_start desc limit 1`);
check('early renewal continues from old expiry', +a1.period_start === +a0.expiry_date + 86400000, { old_expiry: a0.expiry_date, new_start: a1.period_start });

check('paid without plan raises', await fails(`insert into members(id, name, phone) values ('00000000-0000-0000-0000-0000000000ff','NoPlan','15550000099');
  insert into payments(member_id, amount, status) values ('00000000-0000-0000-0000-0000000000ff', 1, 'paid')`), 'member without plan');
await db.exec(`delete from members where name='NoPlan'`);

// Nightly refresh fixes stale statuses.
await db.exec(`alter table members disable trigger members_set_status; update members set status='active';
  alter table members enable trigger members_set_status;`);
const [r] = await q(`select refresh_member_status() n`);
check('refresh_member_status fixes stale rows', r.n > 0 && (await q(ruleSql))[0].n === 0, { fixed: r.n });

// Report view matches raw counts.
const [v] = await q(`select * from daily_summary`);
const [raw] = await q(`select count(*) filter (where status='active')::int a, count(*) filter (where status='due')::int d,
  count(*) filter (where status='expired')::int x, (select count(*)::int from payments where status='pending') p from members`);
check('daily_summary = raw counts', +v.active === raw.a && +v.due === raw.d && +v.expired === raw.x && +v.pending_payments === raw.p, { v, raw });

// daily_report() must agree with raw SQL.
const [{ r: rep }] = await q(`select daily_report() r`);
const [rc] = await q(`select
  (select count(*)::int from members where expiry_date = current_date + 2 and status <> 'frozen') expiring,
  (select count(*)::int from members where status = 'expired' and expiry_date >= current_date - 30) expired_recent,
  (select count(*)::int from payments where status = 'pending') pending`);
check('daily_report lists = raw counts',
  rep.expiring.length === rc.expiring && rep.expired_recent.length === rc.expired_recent && rep.pending.length === rc.pending
  && rep.summary.active === raw.a && rep.summary.due === raw.d && rep.summary.expired === raw.x,
  { report: { e: rep.expiring.length, x: rep.expired_recent.length, p: rep.pending.length, s: rep.summary }, rc, raw });
check('daily_report lists Bravo as expiring', rep.expiring.some((m) => m.name === 'Demo Bravo'), rep.expiring);

// RLS
const MEMBER = '11111111-1111-1111-1111-111111111111', STAFF = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users values ('${MEMBER}'), ('${STAFF}');
  update members set auth_user_id='${MEMBER}' where name='Demo Alpha';
  insert into staff values ('${STAFF}', 'trainer');`);
const as = async (uid, fn, email = null) => {
  const claims = JSON.stringify({ sub: uid, role: 'authenticated', email });
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`); }
};
await as(MEMBER, async () => {
  const [m] = await q(`select count(*)::int n, min(name) name from members`);
  check('RLS: member sees only own member row', m.n === 1 && m.name === 'Demo Alpha', m);
  const [pp] = await q(`select count(*)::int n from payments where member_id <> '00000000-0000-0000-0000-00000000000a'`);
  check('RLS: member sees no other payments', pp.n === 0, pp);
  check('RLS: member cannot insert payment without TrxID', await fails(`insert into payments(member_id, amount) values ('00000000-0000-0000-0000-00000000000a', 1)`), 'insert');
  const [u] = await q(`with x as (update members set status='frozen' returning 1) select count(*)::int n from x`);
  check('RLS: member cannot update own row', u.n === 0, u);
  check('RLS: member cannot add plans', await fails(`insert into plans(name, months, price) values ('Free', 1, 0)`), 'insert plan');
  const [{ r: mr }] = await q(`select daily_report() r`);
  check('RLS: member report shows no other members', mr.expiring.length === 0 && mr.pending.every((p) => p.name === 'Demo Alpha'), mr);
});
await as(STAFF, async () => {
  const [m] = await q(`select count(*)::int n from members`);
  check('RLS: trainer sees all members', m.n === 5, m);
  check('RLS: trainer cannot edit plans (owner only)', await fails(`insert into plans(name, months, price) values ('Free', 1, 0)`), 'insert plan');
});
// ---------- Phase A: settings, member payments, receipts, attendance, claim, plans, dashboard ----------
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', E = '00000000-0000-0000-0000-00000000000e';
const OWNER = '33333333-3333-3333-3333-333333333333', CLAIMER = '44444444-4444-4444-4444-444444444444', CLAIMER2 = '55555555-5555-5555-5555-555555555555';
const setup = await fails(`insert into auth.users values ('${OWNER}', 'owner@example.test'), ('${CLAIMER}', 'echo@example.test'), ('${CLAIMER2}', 'echo2@example.test');
  insert into staff (user_id, role) values ('${OWNER}', 'owner');
  update gym_settings set checkin_token = 'testtoken', bkash_number = '8801700000000';
  update members set email = 'echo@example.test' where id = '${E}';
  insert into workout_plans (member_id, plan, verified) values ('${A}', '{"days":[]}', true), ('${A}', '{"days":["draft"]}', false);`);
check('phase A schema exists (settings, email, plans)', !setup, setup);

await as(MEMBER, async () => {
  check('member cannot insert a paid payment',
    await fails(`insert into payments (member_id, amount, method, status, trx_id) values ('${A}', 1500, 'bkash', 'paid', 'PAIDSELF01')`), 'paid insert');
  check('member cannot pay for another member',
    await fails(`insert into payments (member_id, amount, method, trx_id) values ('${B}', 1500, 'bkash', 'OTHER00001')`), 'other member');
  const ins = await fails(`insert into payments (member_id, amount, method, trx_id, period_start, period_end, paid_on, receipt_no)
    values ('${A}', 1, 'bkash', ' abc123xyz ', '2030-01-01', '2030-12-31', current_date, 'R-FAKE')`);
  check('member can submit a bKash TrxID', !ins, ins);
  const [mp] = await q(`select amount::int, period_start, period_end, paid_on, receipt_no, status, trx_id from payments where trx_id = 'ABC123XYZ'`);
  check('member payment forced: plan price, no period/receipt, TrxID uppercased',
    mp && mp.amount === 1500 && !mp.period_start && !mp.period_end && !mp.paid_on && !mp.receipt_no && mp.status === 'pending', mp);
  check('reused TrxID rejected', await fails(`insert into payments (member_id, amount, method, trx_id) values ('${A}', 1500, 'nagad', 'abc123xyz')`), 'dup trx');
  check('member cash payment rejected (bkash/nagad only)', await fails(`insert into payments (member_id, amount, method, trx_id) values ('${A}', 1500, 'cash', 'CASH000001')`), 'cash');

  check('check_in with wrong token fails', await fails(`select check_in('nope')`), 'wrong token');
  const [c1] = await q(`select check_in('testtoken') r`).catch((e) => [{ r: { error: e.message } }]);
  const [c2] = await q(`select check_in('testtoken') r`).catch((e) => [{ r: { error: e.message } }]);
  check('check_in: first ok, second says already', c1.r.already === false && c2.r.already === true && c1.r.name === 'Demo Alpha', { c1: c1.r, c2: c2.r });
  const [att] = await q(`select count(*)::int n, count(*) filter (where member_id <> '${A}')::int others from attendance`).catch(() => [{}]);
  check('member sees only own attendance, one row today', att.n === 1 && att.others === 0, att);
  check('member cannot insert attendance directly', await fails(`insert into attendance (member_id, method) values ('${A}', 'qr')`), 'direct insert');

  const [wp] = await q(`select count(*)::int n from workout_plans`);
  check('member sees only verified plans', wp.n === 1, wp);
  check('member cannot read check-in token', await fails(`select checkin_token from gym_settings`), 'token column');
  const [gs] = await q(`select name, bkash_number from gym_settings`).catch(() => [null]);
  check('member can read gym name and bKash number', gs && gs.bkash_number === '8801700000000', gs);
  const [gu] = await q(`with x as (update gym_settings set bkash_number = '1' returning 1) select count(*)::int n from x`).catch(() => [{ n: 0 }]);
  check('member cannot change settings', gu.n === 0, gu);
});

await as(STAFF, async () => {
  const [a0] = await q(`select expiry_date from members where id = '${A}'`);
  const upd = await fails(`update payments set status = 'paid', recorded_by = '${STAFF}' where trx_id = 'ABC123XYZ'`);
  const [pp] = await q(`select receipt_no, period_start from payments where trx_id = 'ABC123XYZ'`);
  const [a1] = await q(`select expiry_date from members where id = '${A}'`);
  check('staff verifies TrxID: receipt number + expiry extends',
    !upd && /^R-\d{4}-\d{6}$/.test(pp.receipt_no ?? '') && +a1.expiry_date > +a0.expiry_date, { upd, pp, a0, a1 });
  const sc = await fails(`insert into attendance (member_id, method, recorded_by) values ('${E}', 'staff', '${STAFF}')`);
  check('staff can check in a member manually', !sc, sc);
  await fails(`insert into attendance (member_id, method) values ('${B}', 'staff')`);
  const [{ r }] = await q(`select daily_report() r`);
  check('report flags unpaid check-in (Echo, never paid)', (r.unpaid_checkins ?? []).some((u) => u.name === 'Demo Echo'), r.unpaid_checkins);
  check('report does not flag paid-up member ending soon (Bravo)', !(r.unpaid_checkins ?? []).some((u) => u.name === 'Demo Bravo'), r.unpaid_checkins);
  check('trainer cannot rotate check-in token', await fails(`select rotate_checkin_token()`), 'rotate');
  const [t] = await q(`select checkin_qr_token() t`).catch(() => [{}]);
  check('staff can read check-in token for desk QR', t.t === 'testtoken', t);
  const tpl = await fails(`insert into plan_templates (kind, name, plan) values ('workout', 'Beginner 3-day', '{"days":[]}')`);
  check('staff can create plan templates', !tpl, tpl);
});

await as(OWNER, async () => {
  const [{ r }] = await q(`select daily_report() r`);
  const [raw2] = await q(`select
    (select count(*)::int from attendance where day = current_date) att,
    (select coalesce(sum(amount), 0)::int from payments where status = 'paid' and paid_on = current_date) rev_today,
    (select coalesce(sum(amount), 0)::int from payments where status = 'paid' and paid_on >= date_trunc('month', current_date)) rev_month`);
  check('dashboard: attendance/revenue = raw SQL',
    r.summary.attendance_today === raw2.att && Number(r.summary.revenue_today) === raw2.rev_today && Number(r.summary.revenue_month) === raw2.rev_month,
    { summary: r.summary, raw2 });
  const [t] = await q(`select rotate_checkin_token() t`).catch((e) => [{ t: e.message }]);
  check('owner rotates check-in token', t.t && t.t !== 'testtoken' && t.t.length >= 16, t);
  const [u] = await q(`with x as (update gym_settings set nagad_number = '8801800000000' returning 1) select count(*)::int n from x`).catch(() => [{ n: 0 }]);
  check('owner can change settings', u.n === 1, u);
});

await as(CLAIMER, async () => {
  const [c] = await q(`select claim_member() id`).catch((e) => [{ id: e.message }]);
  const [m] = await q(`select count(*)::int n, min(name) name from members`);
  check('claim_member links by signed-in email', c.id === E && m.n === 1 && m.name === 'Demo Echo', { c, m });
}, 'Echo@Example.test');
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('66666666-6666-6666-6666-666666666666', 'bravo@example.test', null);
  update members set email = 'bravo@example.test' where id = '${B}';`);
await as('66666666-6666-6666-6666-666666666666', async () => {
  const [c] = await q(`select claim_member() id`).catch((e) => [{ id: e.message }]);
  check('claim_member: unconfirmed email cannot claim', c.id === null, c);
}, 'bravo@example.test');
await as(CLAIMER2, async () => {
  const [c] = await q(`select claim_member() id`).catch((e) => [{ id: e.message }]);
  check('claim_member: no match -> null, no link', c.id === null, c);
}, 'echo@example.test');
const [linked] = await q(`select auth_user_id from members where id = '${E}'`);
check('claimed member stays linked to first account', linked.auth_user_id === CLAIMER, linked);

await db.exec(`set role anon`);
check('RLS: anon has no access (no grants)', await fails(`select * from members`), 'select as anon');
await db.exec(`reset role`);

let pass = true;
for (const r of results) { pass &&= r.ok; console.log(`${r.ok ? 'PASS' : 'FAIL'} - ${r.name}${r.ok ? '' : ' :: ' + JSON.stringify(r.evidence)}`); }
console.log(`VERDICT: ${pass ? 'PASS' : 'FAIL'} (${results.filter(r => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
