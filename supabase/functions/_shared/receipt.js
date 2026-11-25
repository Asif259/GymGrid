const money = (n, c) => `${c}${Number(n ?? 0).toLocaleString('en-US')}`;

export function receiptLines(p, m, settings = {}) {
  const cur = settings.currency ?? '৳';
  return [
    `${settings.gym_name ?? 'Gym'} payment receipt ${p.receipt_no}`,
    `Member: ${m.name} (+${m.phone})`,
    `Plan: ${m.plans?.name ?? '—'}`,
    `Amount: ${money(p.amount, cur)} by ${p.method ?? 'cash'}${p.trx_id ? ` (TrxID ${p.trx_id})` : ''}`,
    `Paid on: ${p.paid_on}`,
    `Valid: ${p.period_start} to ${p.period_end}`,
  ];
}
