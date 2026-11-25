// Pure helpers, no DOM or network, so they can be tested in Node.

// Returns E.164 digits without '+', or null if invalid. Matches the DB check '^[1-9][0-9]{7,14}$'.
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').replace(/^00/, '');
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
}

// '2026-11-27' -> '27 Nov' (year only when it is not this year). Non-breaking space keeps it on one line.
export function fmtDate(iso, now = new Date()) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).replace(/ /g, '\u00A0');
}

// What the money status of a member is, in words, when they have nothing pending.
export function standing(m) {
  if (m.status === 'frozen') return 'Frozen';
  if (m.status === 'expired') return 'Renewal due';
  if (m.status === 'due') return m.expiry_date ? 'Ends soon' : 'Never paid';
  return 'Paid up';
}

export function money(n, currency = '৳') {
  return `${currency}${Number(n ?? 0).toLocaleString('en-US')}`;
}

// today: 'YYYY-MM-DD'; ISO date strings compare correctly as text.
// appUrl: when set, the message carries a link to the members app pay screen.
export function renewalLink(member, gymName, today = new Date().toISOString().slice(0, 10), appUrl = null) {
  const e = member.expiry_date;
  const when = !e ? 'is not active yet' : e < today ? `ended on ${e}` : `ends on ${e}`;
  const plan = member.plans?.name ?? 'gym';
  const renew = appUrl ? `Renew here: ${appUrl.replace(/\/$/, '')}/member.html#pay` : 'Reply to renew.';
  const text = `Hi ${member.name}, your ${plan} membership ${when}. ${renew} - ${gymName}`;
  return `https://wa.me/${member.phone}?text=${encodeURIComponent(text)}`;
}

export function receiptText(p, m, gymName, currency = '৳') {
  return [
    `${gymName} payment receipt ${p.receipt_no}`,
    `Member: ${m.name} (+${m.phone})`,
    `Plan: ${m.plans?.name ?? '—'}`,
    `Amount: ${money(p.amount, currency)} by ${p.method ?? 'cash'}${p.trx_id ? ` (TrxID ${p.trx_id})` : ''}`,
    `Paid on: ${p.paid_on}`,
    `Valid: ${p.period_start} to ${p.period_end}`,
  ].join('\n');
}

export function receiptLink(p, m, gymName, currency) {
  return `https://wa.me/${m.phone}?text=${encodeURIComponent(receiptText(p, m, gymName, currency))}`;
}

// Staff type plans as plain lines; stored as JSON in the plan-coach schema.
// Workout line: "Mon - Legs: Squat 3x10, Leg press 3x12, Plank 3x45s"  (focus optional)
export function parseWorkout(text) {
  const days = [];
  for (const line of String(text).split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [head, rest] = line.includes(':') ? [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)] : ['', line];
    const [day, focus = ''] = head.split(/\s+-\s+/).map((s) => s.trim());
    const exercises = rest.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const m = s.match(/^(.*?)\s+(\d+)\s*[x×]\s*(\d+\s*s?)$/i);
      return m ? { name: m[1].trim(), sets: Number(m[2]), reps: m[3].replace(/\s/g, '') } : { name: s };
    });
    if (!exercises.length) throw new Error(`No exercises in line: "${line}"`);
    days.push({ day: day || `Day ${days.length + 1}`, focus, exercises });
  }
  if (!days.length) throw new Error('Write at least one day.');
  return { days };
}

// Diet line: "Breakfast: Oats 60g, 2 eggs, Banana"
export function parseDiet(text) {
  const meals = [];
  for (const line of String(text).split('\n').map((l) => l.trim()).filter(Boolean)) {
    const i = line.indexOf(':');
    if (i < 1) throw new Error(`Start each line with a meal name and ':' — "${line}"`);
    const items = line.slice(i + 1).split(',').map((s) => s.trim()).filter(Boolean).map((food) => ({ food }));
    if (!items.length) throw new Error(`No foods in line: "${line}"`);
    meals.push({ name: line.slice(0, i).trim(), items });
  }
  if (!meals.length) throw new Error('Write at least one meal.');
  return { meals };
}

export function workoutLines(plan) {
  return (plan?.days ?? []).map((d) => ({
    title: d.focus ? `${d.day} - ${d.focus}` : d.day,
    items: d.exercises.map((x) => (x.sets ? `${x.name} ${x.sets}x${x.reps}` : x.name)),
  }));
}

export function dietLines(plan) {
  return (plan?.meals ?? []).map((m) => ({
    title: m.name,
    items: m.items.map((i) => (i.qty ? `${i.food} ${i.qty}` : i.food) + (i.kcal ? ` (${i.kcal} kcal)` : '')),
  }));
}

export function daysLeft(expiry, today = new Date().toISOString().slice(0, 10)) {
  return expiry ? Math.round((Date.parse(expiry) - Date.parse(today)) / 86400000) : null;
}

// daily_report() JSON -> markdown for reports/YYYY-MM-DD.md. Report rows carry plan as a plain name.
export function reportMarkdown(r, gymName, appUrl = null) {
  const link = (m) => renewalLink({ ...m, plans: { name: m.plan } }, gymName, r.date, appUrl);
  const s = r.summary;
  const list = (rows, fmt) => (rows?.length ? rows.map(fmt).join('\n') : '_None._');
  return [
    `# ${gymName} daily report: ${r.date}`,
    '',
    `| Active | Due (≤2 days) | Expired | Attendance today | Revenue today | Revenue this month | Pending payments |`,
    `|---|---|---|---|---|---|---|`,
    `| ${s.active} | ${s.due} | ${s.expired} | ${s.attendance_today ?? 0} | ${money(s.revenue_today)} | ${money(s.revenue_month)} | ${s.pending_payments} (${money(s.pending_amount)}) |`,
    '',
    `## Checked in today without paying (${r.unpaid_checkins?.length ?? 0})`,
    list(r.unpaid_checkins, (m) => `- ${m.name} (+${m.phone}), ${m.expiry_date ? `ended ${m.expiry_date}` : 'never paid'}: [WhatsApp](${link(m)})`),
    '',
    `## Expiring in 2 days: send renewal reminder (${r.expiring.length})`,
    list(r.expiring, (m) => `- ${m.name} (+${m.phone}), ${m.plan ?? 'no plan'}, ends ${m.expiry_date}: [WhatsApp](${link(m)})`),
    '',
    `## Expired in last 30 days (${r.expired_recent.length})`,
    list(r.expired_recent, (m) => `- ${m.name} (+${m.phone}), ended ${m.expiry_date}: [WhatsApp](${link(m)})`),
    '',
    `## Pending payments (${r.pending.length})`,
    list(r.pending, (p) => `- ${p.name} (+${p.phone}): ${money(p.amount)}${p.trx_id ? ` ${p.method} TrxID ${p.trx_id}` : ''}, waiting ${p.days_waiting} day(s)`),
    '',
  ].join('\n');
}

// Oldest pending payment first, so dues are cleared in order.
export function pendingPayment(payments = []) {
  return payments.filter((p) => p.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;
}

// Newest paid payment (for the receipt link).
export function lastPaid(payments = []) {
  return payments.filter((p) => p.status === 'paid').sort((a, b) => (b.paid_on ?? '').localeCompare(a.paid_on ?? '') || b.created_at.localeCompare(a.created_at))[0] ?? null;
}

// Last 7 calendar days ending on todayIso ('YYYY-MM-DD') with check-in counts.
export function attendancePulse(rows = [], todayIso) {
  const counts = new Map();
  for (const r of rows) {
    if (r?.day) counts.set(r.day, (counts.get(r.day) ?? 0) + 1);
  }
  const base = new Date(`${todayIso}T00:00:00Z`);
  const out = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = new Date(base.getTime() + offset * 86400000);
    const day = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    out.push({ day, label, count: counts.get(day) ?? 0, isToday: day === todayIso });
  }
  return out;
}

const STATUS_RANK = { expired: 0, due: 1, active: 2, frozen: 3 };

export function memberAmount(m) {
  const pending = pendingPayment(m.payments);
  const amount = pending ? Number(pending.amount) : (m.plans?.price != null ? Number(m.plans.price) : null);
  const isOwed = Boolean(pending || m.status === 'expired' || (m.status === 'due' && !m.expiry_date));
  const label = pending ? 'Owes' : standing(m);
  return { amount, isOwed, label, pending };
}

export function memberExpiryLabel(m) {
  if (!m.expiry_date) return 'Never paid';
  return m.status === 'expired' ? `Ended ${fmtDate(m.expiry_date)}` : `Until ${fmtDate(m.expiry_date)}`;
}

export function sortMembers(rows = [], key = 'name', dir = 'asc') {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === 'amount') {
      const av = memberAmount(a).amount ?? -1;
      const bv = memberAmount(b).amount ?? -1;
      cmp = av - bv;
    } else if (key === 'status') {
      cmp = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    } else if (key === 'expiry') {
      const ae = a.expiry_date ?? '';
      const be = b.expiry_date ?? '';
      cmp = ae.localeCompare(be);
    } else {
      cmp = (a.name ?? '').localeCompare(b.name ?? '');
    }
    return cmp !== 0 ? cmp * factor : (a.name ?? '').localeCompare(b.name ?? '');
  });
}
