-- Demo data only: fictional members, 555 phone numbers. Dates are relative to today
-- so each status (active, due, expired, never paid) always appears.

insert into public.plans (name, months, price) values
  ('Monthly', 1, 1500),
  ('Quarterly', 3, 4000),
  ('Yearly', 12, 14000);

insert into public.members (id, name, phone, plan_id, join_date, goal, age, sex, height_cm, weight_kg, injuries, diet_pref) values
  ('00000000-0000-0000-0000-00000000000a', 'Demo Alpha',   '15550000001', 1, current_date - 40, 'fat loss', 29, 'male',   175, 88,  null,        'halal'),
  ('00000000-0000-0000-0000-00000000000b', 'Demo Bravo',   '15550000002', 1, current_date - 90, 'muscle',   24, 'female', 162, 55,  null,        'vegetarian'),
  ('00000000-0000-0000-0000-00000000000c', 'Demo Charlie', '15550000003', 1, current_date - 70, 'fitness',  41, 'male',   170, 76,  'left knee', null),
  ('00000000-0000-0000-0000-00000000000d', 'Demo Delta',   '15550000004', 2, current_date - 1,  'muscle',   33, 'male',   180, 72,  null,        'no peanuts'),
  ('00000000-0000-0000-0000-00000000000e', 'Demo Echo',    '15550000005', 1, current_date,      'fat loss', 37, 'female', 158, 70,  'lower back', null);

-- Alpha: paid, period computed by trigger from today -> active.
insert into public.payments (member_id, amount, method, status) values
  ('00000000-0000-0000-0000-00000000000a', 1500, 'cash', 'paid');

-- Bravo: ends in 2 days -> due (gets a WhatsApp renewal link).
insert into public.payments (member_id, amount, method, status, paid_on, period_start, period_end) values
  ('00000000-0000-0000-0000-00000000000b', 1500, 'bkash', 'paid', current_date - 28, current_date - 28, current_date + 2);

-- Charlie: ended 5 days ago -> expired, plus an unpaid renewal.
insert into public.payments (member_id, amount, method, status, paid_on, period_start, period_end) values
  ('00000000-0000-0000-0000-00000000000c', 1500, 'cash', 'paid', current_date - 35, current_date - 35, current_date - 5);
insert into public.payments (member_id, amount, method, status) values
  ('00000000-0000-0000-0000-00000000000c', 1500, 'cash', 'pending');

-- Delta: quarterly, paid via trigger -> active for 3 months.
insert into public.payments (member_id, amount, method, status) values
  ('00000000-0000-0000-0000-00000000000d', 4000, 'card', 'paid');

-- Echo: joined today, not paid yet -> due, one pending payment.
insert into public.payments (member_id, amount, method, status) values
  ('00000000-0000-0000-0000-00000000000e', 1500, 'cash', 'pending');
