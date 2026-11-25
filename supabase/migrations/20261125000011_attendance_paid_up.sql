-- "Due" also covers paid members ending within 2 days, so status alone can't say "unpaid".
-- Snapshot whether the membership covered the check-in day.
alter table public.attendance add column paid_up boolean not null default false;

create or replace function public.attendance_set_status()
returns trigger language plpgsql set search_path = public as $$
begin
  select status, coalesce(expiry_date >= new.day, false) and status <> 'frozen'
    into new.status_at_checkin, new.paid_up
  from public.members where id = new.member_id;
  return new;
end $$;

update public.attendance a set paid_up = coalesce(m.expiry_date >= a.day, false) and m.status <> 'frozen'
from public.members m where m.id = a.member_id;

create or replace function public.daily_report()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'date', current_date,
    'summary', (select to_jsonb(s) from public.daily_summary s) || jsonb_build_object(
      'attendance_today', (select count(*) from public.attendance where day = current_date),
      'revenue_today', (select coalesce(sum(amount), 0) from public.payments
                        where status = 'paid' and paid_on = current_date),
      'revenue_month', (select coalesce(sum(amount), 0) from public.payments
                        where status = 'paid' and paid_on >= date_trunc('month', current_date)::date)),
    -- Renewal reminders: membership ends exactly 2 days from today.
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.name)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.expiry_date = current_date + 2 and m.status <> 'frozen'), '[]'::jsonb),
    -- Lapsed in the last 30 days: worth a follow-up message. Older ones are treated as former members.
    'expired_recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.expiry_date desc)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.status = 'expired' and m.expiry_date >= current_date - 30), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'amount', pay.amount, 'method', pay.method, 'trx_id', pay.trx_id,
        'days_waiting', current_date - pay.created_at::date) order by pay.created_at)
      from public.payments pay join public.members m on m.id = pay.member_id
      where pay.status = 'pending'), '[]'::jsonb),
    -- Came in today without a membership covering today: the "trains without paying" list.
    'unpaid_checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'status', a.status_at_checkin, 'expiry_date', m.expiry_date,
        'checked_in_at', a.checked_in_at) order by a.checked_in_at)
      from public.attendance a join public.members m on m.id = a.member_id
      where a.day = current_date and not a.paid_up), '[]'::jsonb)
  )
$$;
