-- Core gym schema: plans, members, payments, AI plans, staff roles, RLS.

-- ---------- tables ----------

create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('owner', 'trainer'))
);

create table public.plans (
  id serial primary key,
  name text not null unique,
  months int not null check (months > 0),
  price numeric(10, 2) not null check (price >= 0)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users on delete set null,
  name text not null,
  phone text not null unique check (phone ~ '^[1-9][0-9]{7,14}$'), -- E.164 digits, no '+'
  plan_id int references public.plans,
  join_date date not null default current_date,
  expiry_date date,
  status text not null default 'due' check (status in ('active', 'due', 'expired', 'frozen')),
  goal text,
  age int check (age between 10 and 100),
  sex text check (sex in ('male', 'female')),
  height_cm int check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 25 and 300),
  injuries text,
  diet_pref text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  method text check (method in ('cash', 'bkash', 'card', 'bank', 'other')),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  period_start date,
  period_end date,
  paid_on date,
  recorded_by uuid references auth.users,
  created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start),
  check (status = 'pending' or (paid_on is not null and period_end is not null))
);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  plan jsonb not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  plan jsonb not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.members (expiry_date);
create index on public.payments (member_id, status);

-- ---------- status rule ----------
-- null expiry (never paid) -> due; past -> expired; within 2 days -> due; else active. frozen is manual.

create function public.member_status(expiry date, current_status text)
returns text language sql stable as $$
  select case
    when current_status = 'frozen' then 'frozen'
    when expiry is null then 'due'
    when expiry < current_date then 'expired'
    when expiry <= current_date + 2 then 'due'
    else 'active'
  end
$$;

create function public.members_set_status()
returns trigger language plpgsql as $$
begin
  new.status := public.member_status(new.expiry_date, new.status);
  return new;
end $$;

create trigger members_set_status
before insert or update of expiry_date, status on public.members
for each row execute function public.members_set_status();

-- Nightly job calls this so statuses follow the calendar.
create function public.refresh_member_status()
returns int language sql as $$
  with changed as (
    update public.members m
    set status = public.member_status(m.expiry_date, m.status)
    where m.status <> public.member_status(m.expiry_date, m.status)
    returning 1
  )
  select count(*)::int from changed
$$;

-- ---------- payment -> expiry ----------
-- Marking a payment paid fills its period from the member's plan and extends expiry.

create function public.payments_fill_period()
returns trigger language plpgsql as $$
declare
  cur_expiry date;
  plan_months int;
begin
  if new.status <> 'paid' then
    return new;
  end if;

  new.paid_on := coalesce(new.paid_on, current_date);

  if new.period_end is null then
    select m.expiry_date, p.months into cur_expiry, plan_months
    from public.members m left join public.plans p on p.id = m.plan_id
    where m.id = new.member_id;

    if plan_months is null then
      raise exception 'member % has no plan; cannot compute payment period', new.member_id;
    end if;

    -- Early renewal continues from current expiry; late renewal starts today.
    new.period_start := coalesce(new.period_start,
      case when cur_expiry >= current_date then cur_expiry + 1 else current_date end);
    new.period_end := (new.period_start + make_interval(months => plan_months) - interval '1 day')::date;
  end if;

  return new;
end $$;

create trigger payments_fill_period
before insert or update of status on public.payments
for each row execute function public.payments_fill_period();

create function public.payments_sync_expiry()
returns trigger language plpgsql as $$
declare
  mid uuid := coalesce(new.member_id, old.member_id);
begin
  update public.members
  set expiry_date = (
    select max(period_end) from public.payments
    where member_id = mid and status = 'paid'
  )
  where id = mid;
  return null;
end $$;

create trigger payments_sync_expiry
after insert or update or delete on public.payments
for each row execute function public.payments_sync_expiry();

-- ---------- roles ----------

create function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

create function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'owner')
$$;

create function public.my_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where auth_user_id = auth.uid()
$$;

-- ---------- row level security ----------
-- Staff: full access. Member: read own rows only. Anonymous: nothing.

alter table public.staff enable row level security;
alter table public.plans enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.workout_plans enable row level security;
alter table public.diet_plans enable row level security;

create policy staff_read_self on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy staff_owner_write on public.staff for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy plans_read on public.plans for select to authenticated using (true);
create policy plans_owner_write on public.plans for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy members_staff on public.members for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy members_self_read on public.members for select to authenticated
  using (auth_user_id = auth.uid());

create policy payments_staff on public.payments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy payments_self_read on public.payments for select to authenticated
  using (member_id = public.my_member_id());

create policy workout_staff on public.workout_plans for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy workout_self_read on public.workout_plans for select to authenticated
  using (member_id = public.my_member_id());

create policy diet_staff on public.diet_plans for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy diet_self_read on public.diet_plans for select to authenticated
  using (member_id = public.my_member_id());

-- ---------- daily report view (used by gym-ops) ----------

create view public.daily_summary with (security_invoker = true) as
select
  count(*) filter (where status = 'active')  as active,
  count(*) filter (where status = 'due')     as due,
  count(*) filter (where status = 'expired') as expired,
  count(*) filter (where status = 'frozen')  as frozen,
  (select count(*) from public.payments where status = 'pending') as pending_payments,
  (select coalesce(sum(amount), 0) from public.payments where status = 'pending') as pending_amount
from public.members;
