export const MEMBER_HEADERS = ['id', 'name', 'phone', 'email', 'plan', 'status', 'expiry_date'];
export const PAYMENT_HEADERS = ['receipt_no', 'paid_on', 'member', 'phone', 'plan', 'amount', 'method', 'trx_id', 'period_start', 'period_end'];

// Sheets cell: null/undefined -> '', no formula injection from leading = + - @.
export const a2cell = (v) => {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
};

export const memberRow = (m) =>
  [m.id, m.name, m.phone, m.email, m.plans?.name, m.status, m.expiry_date].map(a2cell);

export const paymentRow = (p, m) =>
  [p.receipt_no, p.paid_on, m.name, m.phone, m.plans?.name, p.amount, p.method ?? 'cash', p.trx_id, p.period_start, p.period_end].map(a2cell);
