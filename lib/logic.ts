import type {
  AttendanceStreak,
  DailyReport,
  DietPlanData,
  FormattedPlanSection,
  Member,
  Payment,
  PulsePoint,
  WorkoutPlanData,
} from '@/types/gym';

export function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '').replace(/^00/, '');
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
}

export function fmtDate(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
    .replace(/ /g, '\u00A0');
}

export function standing(m: Pick<Member, 'status' | 'expiry_date'>): string {
  if (m.status === 'frozen') return 'Frozen';
  if (m.status === 'expired') return 'Renewal due';
  if (m.status === 'due') return m.expiry_date ? 'Ends soon' : 'Never paid';
  return 'Paid up';
}

export function money(n: number | string | null | undefined, currency = '৳'): string {
  return `${currency}${Number(n ?? 0).toLocaleString('en-US')}`;
}

export function renewalLink(
  member: { name: string; phone: string; expiry_date?: string | null; plans?: { name?: string | null } | null },
  gymName: string,
  todayIso = new Date().toISOString().slice(0, 10),
  appUrl: string | null = null,
): string {
  const e = member.expiry_date;
  const when = !e ? 'is not active yet' : e < todayIso ? `ended on ${e}` : `ends on ${e}`;
  const plan = member.plans?.name ?? 'gym';
  const renew = appUrl ? `Renew here: ${appUrl.replace(/\/$/, '')}/member#pay` : 'Reply to renew.';
  const text = `Hi ${member.name}, your ${plan} membership ${when}. ${renew} - ${gymName}`;
  return `https://wa.me/${member.phone}?text=${encodeURIComponent(text)}`;
}

export function receiptText(
  p: Pick<Payment, 'receipt_no' | 'amount' | 'method' | 'trx_id' | 'paid_on' | 'period_start' | 'period_end'>,
  m: { name: string; phone: string; plans?: { name?: string | null } | null },
  gymName: string,
  currency = '৳',
): string {
  return [
    `${gymName} payment receipt ${p.receipt_no}`,
    `Member: ${m.name} (+${m.phone})`,
    `Plan: ${m.plans?.name ?? '—'}`,
    `Amount: ${money(p.amount, currency)} by ${p.method ?? 'cash'}${p.trx_id ? ` (TrxID ${p.trx_id})` : ''}`,
    `Paid on: ${p.paid_on}`,
    `Valid: ${p.period_start} to ${p.period_end}`,
  ].join('\n');
}

export function receiptLink(
  p: Pick<Payment, 'receipt_no' | 'amount' | 'method' | 'trx_id' | 'paid_on' | 'period_start' | 'period_end'>,
  m: { name: string; phone: string; plans?: { name?: string | null } | null },
  gymName: string,
  currency = '৳',
): string {
  return `https://wa.me/${m.phone}?text=${encodeURIComponent(receiptText(p, m, gymName, currency))}`;
}

export function parseWorkout(text: string): WorkoutPlanData {
  const days = [];
  for (const line of String(text).split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [head, rest] = line.includes(':')
      ? [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)]
      : ['', line];
    const [day, focus = ''] = head.split(/\s+-\s+/).map((s) => s.trim());
    const exercises = rest
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = s.match(/^(.*?)\s+(\d+)\s*[x×]\s*(\d+\s*s?)$/i);
        return m ? { name: m[1].trim(), sets: Number(m[2]), reps: m[3].replace(/\s/g, '') } : { name: s };
      });
    if (!exercises.length) throw new Error(`No exercises in line: "${line}"`);
    days.push({ day: day || `Day ${days.length + 1}`, focus, exercises });
  }
  if (!days.length) throw new Error('Write at least one day.');
  return { days };
}

export function parseDiet(text: string): DietPlanData {
  const meals = [];
  for (const line of String(text).split('\n').map((l) => l.trim()).filter(Boolean)) {
    const i = line.indexOf(':');
    if (i < 1) throw new Error(`Start each line with a meal name and ':' — "${line}"`);
    const items = line
      .slice(i + 1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((food) => ({ food }));
    if (!items.length) throw new Error(`No foods in line: "${line}"`);
    meals.push({ name: line.slice(0, i).trim(), items });
  }
  if (!meals.length) throw new Error('Write at least one meal.');
  return { meals };
}

export function workoutLines(plan: WorkoutPlanData | null | undefined): FormattedPlanSection[] {
  return (plan?.days ?? []).map((d) => ({
    title: d.focus ? `${d.day} - ${d.focus}` : d.day,
    items: d.exercises.map((x) => (x.sets ? `${x.name} ${x.sets}x${x.reps}` : x.name)),
  }));
}

export function dietLines(plan: DietPlanData | null | undefined): FormattedPlanSection[] {
  return (plan?.meals ?? []).map((m) => ({
    title: m.name,
    items: m.items.map((i) => (i.qty ? `${i.food} ${i.qty}` : i.food) + (i.kcal ? ` (${i.kcal} kcal)` : '')),
  }));
}

export function daysLeft(expiry: string | null | undefined, todayIso = new Date().toISOString().slice(0, 10)): number | null {
  return expiry ? Math.round((Date.parse(expiry) - Date.parse(todayIso)) / 86400000) : null;
}

export function reportMarkdown(r: DailyReport, gymName: string, appUrl: string | null = null): string {
  const link = (m: { name: string; phone: string; plan?: string | null; expiry_date?: string | null }) =>
    renewalLink({ ...m, plans: { name: m.plan } }, gymName, r.date, appUrl);
  const s = r.summary;
  const list = <T>(rows: T[] | undefined, fmt: (row: T) => string) => (rows?.length ? rows.map(fmt).join('\n') : '_None._');
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

export function pendingPayment(payments: Payment[] = []): Payment | null {
  return (
    payments
      .filter((p) => p.status === 'pending')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  );
}

export function lastPaid(payments: Payment[] = []): Payment | null {
  return (
    payments
      .filter((p) => p.status === 'paid')
      .sort((a, b) => (b.paid_on ?? '').localeCompare(a.paid_on ?? '') || b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

export function attendancePulse(rows: Array<{ day?: string | null }> = [], todayIso: string): PulsePoint[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r?.day) counts.set(r.day, (counts.get(r.day) ?? 0) + 1);
  }
  const base = new Date(`${todayIso}T00:00:00Z`);
  const out: PulsePoint[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = new Date(base.getTime() + offset * 86400000);
    const day = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    out.push({ day, label, count: counts.get(day) ?? 0, isToday: day === todayIso });
  }
  return out;
}

const STATUS_RANK: Record<string, number> = { expired: 0, due: 1, active: 2, frozen: 3 };

export function memberAmount(m: Pick<Member, 'status' | 'expiry_date' | 'plans' | 'payments'>): {
  amount: number | null;
  isOwed: boolean;
  label: string;
  pending: Payment | null;
} {
  const pending = pendingPayment(m.payments);
  const amount = pending ? Number(pending.amount) : m.plans?.price != null ? Number(m.plans.price) : null;
  const isOwed = Boolean(pending || m.status === 'expired' || (m.status === 'due' && !m.expiry_date));
  const label = pending ? 'Owes' : standing(m);
  return { amount, isOwed, label, pending };
}

export function memberExpiryLabel(m: Pick<Member, 'status' | 'expiry_date'>): string {
  if (!m.expiry_date) return 'Never paid';
  return m.status === 'expired' ? `Ended ${fmtDate(m.expiry_date)}` : `Until ${fmtDate(m.expiry_date)}`;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortMembers(rows: Member[] = [], key: 'name' | 'status' | 'expiry' | 'amount' = 'name', dir: 'asc' | 'desc' = 'asc'): Member[] {
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
      cmp = collator.compare(a.name ?? '', b.name ?? '');
    }
    return cmp !== 0 ? cmp * factor : collator.compare(a.name ?? '', b.name ?? '');
  });
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function matchesFilter(m: Member, filter: string, todayIso: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'expiring') return m.status !== 'frozen' && m.expiry_date === addDays(todayIso, 2);
  if (filter === 'pending') return (m.payments ?? []).some((p) => p.status === 'pending');
  return m.status === filter;
}

export function streakText(s: AttendanceStreak | null | undefined): string {
  if (!s) return '';
  return `${s.current} day streak · best ${s.best} · ${s.visits_month} visits this month`;
}

export function deskState(m: Pick<Member, 'status' | 'expiry_date'>, todayIso: string): { ok: boolean; text: string } {
  const ok = Boolean(m.expiry_date && m.expiry_date >= todayIso && m.status !== 'frozen');
  return { ok, text: ok ? `Valid until ${m.expiry_date}` : 'NOT PAID / EXPIRED' };
}

export function dhakaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

export function hhmmDhaka(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' });
}
