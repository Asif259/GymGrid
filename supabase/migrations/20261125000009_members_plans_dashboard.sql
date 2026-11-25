-- Member app login link, trainer assignment, plan templates, owner dashboard numbers.

alter table public.members
  add column email text unique check (email = lower(btrim(email))),
  add column trainer_id uuid references public.staff (user_id) on delete set null;

alter table public.staff add column display_name text;

-- Trainer names are shown to members; staff rows hold no private data.
drop policy staff_read_self on public.staff;
create policy staff_read on public.staff for select to authenticated using (true);

-- First sign-in to the members app: link this login to the member row with the same email.
-- Only an unlinked row can be claimed, so a second account with that email gets nothing.
create function public.claim_member()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  em text := lower(btrim(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'));
  mid uuid := public.my_member_id();
begin
  if mid is not null or em is null or auth.uid() is null then
    return mid;
  end if;
  update public.members set auth_user_id = auth.uid()
  where email = em and auth_user_id is null
  returning id into mid;
  return mid;
end $$;

revoke execute on function public.claim_member() from public, anon;
grant execute on function public.claim_member() to authenticated;

-- Reusable plans staff assign to members (copied into workout_plans / diet_plans).
create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('workout', 'diet')),
  name text not null,
  plan jsonb not null,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  unique (kind, name)
);
alter table public.plan_templates enable row level security;
create policy plan_templates_staff on public.plan_templates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
grant select, insert, update, delete on public.plan_templates to authenticated;

-- Members see a plan only after a human (staff) or plan-safety check marked it verified.
drop policy workout_self_read on public.workout_plans;
create policy workout_self_read on public.workout_plans for select to authenticated
  using (member_id = public.my_member_id() and verified);
drop policy diet_self_read on public.diet_plans;
create policy diet_self_read on public.diet_plans for select to authenticated
  using (member_id = public.my_member_id() and verified);

-- Dashboard: adds attendance, revenue, and who checked in without a paid-up membership.
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
    -- Came in today while due/expired: the "trains without paying" list.
    'unpaid_checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'status', a.status_at_checkin, 'expiry_date', m.expiry_date,
        'checked_in_at', a.checked_in_at) order by a.checked_in_at)
      from public.attendance a join public.members m on m.id = a.member_id
      where a.day = current_date and a.status_at_checkin in ('due', 'expired')), '[]'::jsonb)
  )
$$;
