-- Paid rows from before receipts existed get numbers too, in payment order.
update public.payments p
set receipt_no = 'R-' || to_char(p.paid_on, 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0')
from (select id from public.payments where status = 'paid' and receipt_no is null order by paid_on, created_at) o
where p.id = o.id;
