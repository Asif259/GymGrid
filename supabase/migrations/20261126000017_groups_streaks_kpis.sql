-- Group plans, member streaks, and owner KPIs.

-- Copy one template to many members, already verified (staff chose it).
create function public.assign_plan(template_id uuid, member_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare k text; p jsonb; n int;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  select t.kind, t.plan into k, p from public.plan_templates t where t.id = assign_plan.template_id;
  if k is null then raise exception 'template not found' using errcode = 'P0002'; end if;
  if k = 'workout' then
    insert into public.workout_plans (member_id, plan, verified) select distinct unnest(member_ids), p, true;
  else
    insert into public.diet_plans (member_id, plan, verified) select distinct unnest(member_ids), p, true;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- Streak = consecutive attendance days. Current counts only if the run ends today or yesterday.
create function public.my_streak()
returns jsonb language sql stable security invoker set search_path = public as $$
  with d as (select distinct day from public.attendance where member_id = public.my_member_id()),
  runs as (
    select count(*)::int n, max(day) last
    from (select day, day - (row_number() over (order by day))::int grp from d) g
    group by grp)
  select jsonb_build_object(
    'current', coalesce((select n from runs where last >= current_date - 1), 0),
    'best', coalesce((select max(n) from runs), 0),
    'visits_month', (select count(*) from d where day >= date_trunc('month', current_date)::date))
$$;

create or replace function public.daily_report()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'date', current_date,
    'summary', (select to_jsonb(s) from public.daily_summary s) || jsonb_build_object(
      'attendance_today', (select count(*) from public.attendance where day = current_date),
      'revenue_today', (select coalesce(sum(amount), 0) from public.payments
                        where status = 'paid' and paid_on = current_date),
      'revenue_month', (select coalesce(sum(amount), 0) from public.payments
                        where status = 'paid' and paid_on >= date_trunc('month', current_date)::date),
      'revenue_total', (select coalesce(sum(amount), 0) from public.payments where status = 'paid'),
      'attendance_yesterday', (select count(*) from public.attendance where day = current_date - 1)),
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

-- Owner's morning email numbers. Security invoker: RLS applies, so only staff see real data.
create function public.owner_digest()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'date', current_date,
    'active', (select count(*) from public.members where status = 'active'),
    'expired', (select count(*) from public.members where status = 'expired'),
    'attendance_yesterday', (select count(*) from public.attendance where day = current_date - 1),
    'pending_count', (select count(*) from public.payments where status = 'pending'),
    'pending_amount', (select coalesce(sum(amount), 0) from public.payments where status = 'pending'),
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.name)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.expiry_date = current_date + 2 and m.status <> 'frozen'), '[]'::jsonb))
$$;

revoke execute on function public.assign_plan(uuid, uuid[]), public.my_streak(), public.owner_digest() from public, anon;
grant execute on function public.assign_plan(uuid, uuid[]), public.my_streak(), public.owner_digest() to authenticated;
