// Fictional sample data for design-preview.html. Not real members.
export const REPORT = {
  date: '2026-11-25',
  summary: { active: 62, due: 5, expired: 9, frozen: 2, pending_payments: 3, pending_amount: 7000, attendance_today: 23, revenue_today: 4500, revenue_month: 67500, revenue_total: 245000 },
  unpaid_checkins: [
    { name: 'Rafiq Hasan', phone: '8801700000001', expiry_date: '2026-11-19', time: '09:42' },
    { name: 'Nusrat Jahan', phone: '8801700000002', expiry_date: null, time: '10:05' },
  ],
  expiring: [
    { name: 'Imran Kabir', phone: '8801700000003', plan: 'Monthly', expiry_date: '2026-11-27' },
    { name: 'Farhana Akter', phone: '8801700000004', plan: 'Quarterly', expiry_date: '2026-11-27' },
  ],
  expired_recent: [
    { name: 'Rafiq Hasan', phone: '8801700000001', plan: 'Monthly', expiry_date: '2026-11-19' },
    { name: 'Mahin Chowdhury', phone: '8801700000005', plan: 'Monthly', expiry_date: '2026-11-08' },
  ],
};

const p = (id, amount, method, trx_id, status = 'pending') => ({ id, amount, method, trx_id, status, receipt_no: status === 'paid' ? `R-2026-0000${id}` : null, paid_on: '2026-11-25', period_end: '2026-12-24', created_at: `2026-11-25T0${id}:00:00Z` });
const monthly = { name: 'Monthly', months: 1, price: 1500 };

export const MEMBERS = [
  { id: 'm1', name: 'Rafiq Hasan', phone: '8801700000001', plans: monthly, status: 'expired', expiry_date: '2026-11-19', payments: [] },
  { id: 'm2', name: 'Nusrat Jahan', phone: '8801700000002', plans: monthly, status: 'due', expiry_date: null, payments: [p(1, 1500, 'cash', null)] },
  { id: 'm3', name: 'Tanvir Ahmed', phone: '8801700000006', plans: monthly, status: 'due', expiry_date: '2026-11-26', payments: [p(2, 1500, 'bkash', '9JK4L2M8NP')] },
  { id: 'm4', name: 'Sadia Islam', phone: '8801700000007', plans: { name: 'Quarterly', months: 3, price: 4000 }, status: 'due', expiry_date: '2026-11-26', payments: [p(3, 4000, 'nagad', '7HG2K9W1QZ')] },
  { id: 'm5', name: 'Imran Kabir', phone: '8801700000003', plans: monthly, status: 'active', expiry_date: '2026-12-25', payments: [p(4, 1500, 'cash', null, 'paid')] },
  { id: 'm6', name: 'Farhana Akter', phone: '8801700000004', plans: { name: 'Yearly', months: 12, price: 14000 }, status: 'active', expiry_date: '2027-11-24', payments: [p(5, 14000, 'bkash', 'B3M7X2K9QD', 'paid')] },
];

export const PULSE_7D = [
  { day: '2026-11-19', label: 'Thu', count: 18, isToday: false },
  { day: '2026-11-20', label: 'Fri', count: 14, isToday: false },
  { day: '2026-11-21', label: 'Sat', count: 27, isToday: false },
  { day: '2026-11-22', label: 'Sun', count: 22, isToday: false },
  { day: '2026-11-23', label: 'Mon', count: 25, isToday: false },
  { day: '2026-11-24', label: 'Tue', count: 19, isToday: false },
  { day: '2026-11-25', label: 'Wed', count: 23, isToday: true },
];
