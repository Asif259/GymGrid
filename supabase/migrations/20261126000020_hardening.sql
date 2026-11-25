-- Hardening after review: atomic event claim, Dhaka dates, quieter outbox, forced member columns, owner-only settings,
-- and a less chatty self sign-up.

-- The gym's calendar day. current_date follows the connection's time zone, which pooled API connections may not share.
create function public.gym_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

-- Events are claimed atomically so the trigger kick and the retry cron can never both process one row.
alter table public.automation_events drop constraint if exists automation_events_status_check;
alter table public.automation_events add constraint automation_events_status_check
  check (status in ('pending', 'processing', 'done', 'failed'));
alter table public.automation_events add column claimed_at timestamptz;

create function public.claim_automation_events(max_n int default 25)
returns setof public.automation_events language plpgsql security definer set search_path = public as $$
begin
  -- A claim that stayed 'processing' past 10 minutes crashed or timed out: that counts as an attempt, and 5 attempts end it.
  update public.automation_events
  set status = 'failed', last_error = 'timed out too many times', claimed_at = null
  where status = 'processing' and claimed_at < now() - interval '10 minutes' and attempts + 1 >= 5;

  return query
  update public.automation_events e
  set status = 'processing', claimed_at = now(),
      attempts = e.attempts + case when e.status = 'processing' then 1 else 0 end
  where e.id in (
    select id from public.automation_events
    where status = 'pending' or (status = 'processing' and claimed_at < now() - interval '10 minutes')
    order by created_at
    limit greatest(1, least(coalesce(max_n, 25), 100))
    for update skip locked)
  returning e.*;
end $$;
revoke execute on function public.claim_automation_events(int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_automation_events(int) to service_role;
  end if;
end $$;

-- A receipt email is sent once per payment, even if staff flip paid -> pending -> paid or a run is retried.
alter table public.payments add column receipt_emailed_at timestamptz;

-- Only a payment that becomes paid is worth an event; members' pending submissions queued useless rows and kicks.
create or replace function public.payments_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'paid' then return null; end if;
  insert into public.automation_events (kind, member_id, payment_id) values ('payment.paid', new.member_id, new.id);
  return null;
end $$;

-- Members still cannot set server-side columns on their own submission (adds receipt_path, receipt_emailed_at, created_at).
create or replace function public.payments_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.trx_id := nullif(upper(btrim(new.trx_id)), '');

  if current_user in ('authenticated', 'anon') and not public.is_staff() then
    if new.status = 'paid' then
      raise exception 'only staff can mark a payment paid' using errcode = '42501';
    end if;
    if new.method is distinct from 'bkash' and new.method is distinct from 'nagad' then
      raise exception 'members pay by bKash or Nagad' using errcode = '22023';
    end if;
    if new.trx_id is null then
      raise exception 'transaction ID required' using errcode = '22023';
    end if;
    select p.price into new.amount
    from public.members m join public.plans p on p.id = m.plan_id where m.id = new.member_id;
    if new.amount is null then
      raise exception 'no plan on this membership; ask the front desk' using errcode = '22023';
    end if;
    new.status := 'pending';
    new.period_start := null; new.period_end := null; new.paid_on := null;
    new.receipt_no := null; new.recorded_by := null;
    new.receipt_path := null; new.receipt_emailed_at := null; new.created_at := now();
  end if;
  return new;
end $$;

-- The owner's own settings (digest email, sheet) are not for trainers.
create or replace function public.automation_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  return (select jsonb_build_object('sheet_id', sheet_id, 'owner_digest_email', owner_digest_email) from public.gym_settings);
end $$;

-- Self sign-up: one generic message for conflicts (no phone/email lookup oracle), real name and length limits.
create or replace function public.self_register(
  token text, name text, phone text, plan_id int,
  goal text default null, age int default null, sex text default null, height_cm int default null,
  weight_kg numeric default null, injuries text default null, diet_pref text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  em text;
  ph text := regexp_replace(coalesce(self_register.phone, ''), '[^0-9]', '', 'g');
  nm text := btrim(coalesce(self_register.name, ''));
  mid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if token is null or token is distinct from (select signup_token from public.gym_settings) then
    raise exception 'invalid signup link' using errcode = '42501';
  end if;
  select lower(btrim(u.email)) into em from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if em is null then raise exception 'confirm your email first' using errcode = '42501'; end if;
  if public.my_member_id() is not null then raise exception 'already registered' using errcode = '23505'; end if;
  if char_length(nm) not between 2 and 80 then raise exception 'enter your name' using errcode = '22023'; end if;
  if ph !~ '^[1-9][0-9]{7,14}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  if char_length(coalesce(goal, '')) > 60 or char_length(coalesce(injuries, '')) > 300 or char_length(coalesce(diet_pref, '')) > 300 then
    raise exception 'details too long' using errcode = '22023';
  end if;
  if exists (select 1 from public.members m where m.phone = ph or m.email = em) then
    raise exception 'could not register with those details; ask the front desk' using errcode = '23505';
  end if;
  insert into public.members (auth_user_id, email, name, phone, plan_id, status,
    goal, age, sex, height_cm, weight_kg, injuries, diet_pref)
  values (auth.uid(), em, nm, ph, self_register.plan_id, 'due',
    self_register.goal, self_register.age, self_register.sex, self_register.height_cm,
    self_register.weight_kg, self_register.injuries, self_register.diet_pref)
  returning id into mid;
  return mid;
end $$;

-- Reports and streaks follow the gym's day, not the connection's.
create or replace function public.my_streak()
returns jsonb language sql stable security invoker set search_path = public as $$
  with d as (select distinct day from public.attendance where member_id = public.my_member_id()),
  runs as (
    select count(*)::int n, max(day) last
    from (select day, day - (row_number() over (order by day))::int grp from d) g
    group by grp)
  select jsonb_build_object(
    'current', coalesce((select n from runs where last >= public.gym_today() - 1), 0),
    'best', coalesce((select max(n) from runs), 0),
    'visits_month', (select count(*) from d where day >= date_trunc('month', public.gym_today())::date))
$$;

create or replace function public.daily_report()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'date', public.gym_today(),
    'summary', (select to_jsonb(s) from public.daily_summary s) || jsonb_build_object(
      'attendance_today', (select count(*) from public.attendance where day = public.gym_today()),
      'revenue_today', (select coalesce(sum(amount), 0) from public.payments
                        where status = 'paid' and paid_on = public.gym_today()),
      'revenue_month', (select coalesce(sum(amount), 0) from public.payments
                        where status = 'paid' and paid_on >= date_trunc('month', public.gym_today())::date),
      'revenue_total', (select coalesce(sum(amount), 0) from public.payments where status = 'paid'),
      'attendance_yesterday', (select count(*) from public.attendance where day = public.gym_today() - 1)),
    -- Renewal reminders: membership ends exactly 2 days from today.
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.name)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.expiry_date = public.gym_today() + 2 and m.status <> 'frozen'), '[]'::jsonb),
    -- Lapsed in the last 30 days: worth a follow-up message. Older ones are treated as former members.
    'expired_recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.expiry_date desc)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.status = 'expired' and m.expiry_date >= public.gym_today() - 30), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'amount', pay.amount, 'method', pay.method, 'trx_id', pay.trx_id,
        'days_waiting', public.gym_today() - pay.created_at::date) order by pay.created_at)
      from public.payments pay join public.members m on m.id = pay.member_id
      where pay.status = 'pending'), '[]'::jsonb),
    -- Came in today without a membership covering today: the "trains without paying" list.
    'unpaid_checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'status', a.status_at_checkin, 'expiry_date', m.expiry_date,
        'checked_in_at', a.checked_in_at) order by a.checked_in_at)
      from public.attendance a join public.members m on m.id = a.member_id
      where a.day = public.gym_today() and not a.paid_up), '[]'::jsonb)
  )
$$;

create or replace function public.owner_digest()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'date', public.gym_today(),
    'active', (select count(*) from public.members where status = 'active'),
    'expired', (select count(*) from public.members where status = 'expired'),
    'attendance_yesterday', (select count(*) from public.attendance where day = public.gym_today() - 1),
    'pending_count', (select count(*) from public.payments where status = 'pending'),
    'pending_amount', (select coalesce(sum(amount), 0) from public.payments where status = 'pending'),
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.name)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.expiry_date = public.gym_today() + 2 and m.status <> 'frozen'), '[]'::jsonb))
$$;

-- Stored dates must not depend on the connection's time zone either: a check-in or payment at 01:00 Dhaka is today's.
alter table public.attendance alter column day set default public.gym_today();
alter table public.members alter column join_date set default public.gym_today();

create or replace function public.member_status(expiry date, current_status text)
returns text language sql stable set search_path = public as $$
  select case
    when current_status = 'frozen' then 'frozen'
    when expiry is null then 'due'
    when expiry < public.gym_today() then 'expired'
    when expiry <= public.gym_today() + 2 then 'due'
    else 'active'
  end
$$;

create or replace function public.payments_fill_period()
returns trigger language plpgsql set search_path = public as $$
declare
  cur_expiry date;
  plan_months int;
begin
  if new.status <> 'paid' then
    return new;
  end if;

  new.paid_on := coalesce(new.paid_on, public.gym_today());
  new.receipt_no := coalesce(new.receipt_no,
    'R-' || to_char(public.gym_today(), 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0'));

  if new.period_end is null then
    select m.expiry_date, p.months into cur_expiry, plan_months
    from public.members m left join public.plans p on p.id = m.plan_id
    where m.id = new.member_id;

    if plan_months is null then
      raise exception 'member % has no plan; cannot compute payment period', new.member_id;
    end if;

    -- Early renewal continues from current expiry; late renewal starts today.
    new.period_start := coalesce(new.period_start,
      case when cur_expiry >= public.gym_today() then cur_expiry + 1 else public.gym_today() end);
    new.period_end := (new.period_start + make_interval(months => plan_months) - interval '1 day')::date;
  end if;

  return new;
end $$;
