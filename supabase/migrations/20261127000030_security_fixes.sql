-- Security audit fixes (run-2): tenant-writable fields, gym_staff ordering, legacy staff table,
-- claim_member scoping, create_gym abuse limits, phone oracle message, AI generation slots.

-- ---------- 1. gyms: validate tenant-writable fields ----------
-- Repair rows that would break the shared cron loops, then enforce on every write.
update public.gyms g set timezone = 'Asia/Dhaka'
where not exists (select 1 from pg_timezone_names z where z.name = g.timezone);
update public.gyms set owner_digest_email = null
where owner_digest_email is not null
  and owner_digest_email !~ '^[^@\s,;<>"()\[\]\\]+@[^@\s,;<>"()\[\]\\]+\.[^@\s,;<>"()\[\]\\]+$';

create or replace function public.gyms_validate() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from pg_timezone_names z where z.name = new.timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  if new.owner_digest_email is not null
     and new.owner_digest_email !~ '^[^@\s,;<>"()\[\]\\]+@[^@\s,;<>"()\[\]\\]+\.[^@\s,;<>"()\[\]\\]+$' then
    raise exception 'invalid digest email' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.gyms_validate() from public, anon, authenticated;

drop trigger if exists gyms_validate_trg on public.gyms;
create trigger gyms_validate_trg before insert or update of timezone, owner_digest_email
  on public.gyms for each row execute function public.gyms_validate();

-- One sheet per gym: stops a gym pointing the shared service account at another tenant's sheet.
do $$ begin
  create unique index if not exists gyms_sheet_id_key on public.gyms (sheet_id) where sheet_id is not null;
exception when unique_violation then
  raise notice 'gyms_sheet_id_key skipped: duplicate sheet_id values exist; dedupe then re-run';
end $$;

-- ---------- 2. members.email must be a single address (new and changed rows) ----------
alter table public.members drop constraint if exists members_email_single_addr;
alter table public.members add constraint members_email_single_addr
  check (email is null or email ~ '^[^@\s,;<>"()\[\]\\]+@[^@\s,;<>"()\[\]\\]+\.[^@\s,;<>"()\[\]\\]+$') not valid;

-- ---------- 3. gym_staff.created_at is server-controlled ----------
create or replace function public.gym_staff_lock_created_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if tg_op = 'INSERT' then new.created_at := now();
    else new.created_at := old.created_at; new.user_id := old.user_id; new.gym_id := old.gym_id;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.gym_staff_lock_created_at() from public, anon, authenticated;
drop trigger if exists gym_staff_lock_created_at_trg on public.gym_staff;
create trigger gym_staff_lock_created_at_trg before insert or update
  on public.gym_staff for each row execute function public.gym_staff_lock_created_at();

-- ---------- 4. legacy single-tenant public.staff ----------
drop policy if exists staff_read on public.staff;
drop policy if exists staff_owner_write on public.staff;
revoke insert, update, delete on public.staff from authenticated;
drop policy if exists staff_read_self on public.staff;
create policy staff_read_self on public.staff for select to authenticated using (user_id = auth.uid());

-- ---------- 5. claim_member: unclaimed rows only claimable for a named gym ----------
create or replace function public.claim_member(p_gym_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  em text;
  mid uuid;
begin
  if auth.uid() is null then return null; end if;
  select id into mid from public.members
  where auth_user_id = auth.uid() and (p_gym_id is null or gym_id = p_gym_id)
  order by created_at desc limit 1;
  if mid is not null then return mid; end if;
  if p_gym_id is null then return null; end if;
  select lower(btrim(u.email)) into em from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if em is null then return null; end if;
  update public.members set auth_user_id = auth.uid()
  where id = (
    select id from public.members
    where email = em and auth_user_id is null and gym_id = p_gym_id
    order by created_at desc limit 1
  )
  returning id into mid;
  return mid;
end $$;

-- ---------- 6. create_gym: confirmed email, per-user cap, reserved slugs ----------
create or replace function public.create_gym(
  p_name text,
  p_slug text,
  p_currency text default '৳',
  p_timezone text default 'Asia/Dhaka',
  p_phone text default null,
  p_address text default null,
  p_logo_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_email text;
  v_tz text := coalesce(nullif(btrim(p_timezone), ''), 'Asia/Dhaka');
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'enter a gym name (2-80 chars)' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9-]{3,60}$' then
    raise exception 'slug must be 3-60 lowercase letters, numbers, or hyphens' using errcode = '22023';
  end if;
  if v_slug in ('admin','api','app','auth','login','member','join','desk','checkin','receipt','welcome','onboarding','preview','settings','dashboard','support','www')
     or v_slug like 'default%' then
    raise exception 'slug is reserved' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names z where z.name = v_tz) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  select lower(btrim(u.email)) into v_email from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'confirm your email first' using errcode = '42501';
  end if;
  if (select count(*) from public.gyms where owner_id = auth.uid()) >= 3 then
    raise exception 'gym limit reached' using errcode = '53400';
  end if;
  if exists (select 1 from public.gyms where slug = v_slug) then
    raise exception 'slug already taken' using errcode = '23505';
  end if;

  insert into public.gyms (
    owner_id, name, slug, currency, timezone, phone, address, logo_url,
    owner_digest_email, saas_status
  )
  values (
    auth.uid(), v_name, v_slug,
    coalesce(nullif(btrim(p_currency), ''), '৳'),
    v_tz,
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_address), ''),
    nullif(btrim(p_logo_url), ''),
    v_email,
    'trial'
  )
  returning id into gid;

  insert into public.gym_staff (gym_id, user_id, role, display_name)
  values (gid, auth.uid(), 'owner', 'Owner');

  insert into public.plans (gym_id, name, months, price) values
    (gid, 'Monthly', 1, 1500),
    (gid, 'Quarterly', 3, 4000),
    (gid, 'Yearly', 12, 14000);

  return gid;
end $$;

-- ---------- 7. update_my_profile: generic phone-conflict message ----------
do $$
declare
  def text;
  n int;
begin
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public' and p.proname = 'update_my_profile';
  if n <> 1 then raise exception 'expected exactly one update_my_profile, found %', n; end if;
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public' and p.proname = 'update_my_profile';
  if position('that phone number is already registered with another member' in def) = 0 then
    raise exception 'update_my_profile text not found; review manually';
  end if;
  def := replace(def, 'that phone number is already registered with another member', 'could not update phone; ask the front desk');
  execute def;
end $$;

-- ---------- 8. AI generation slots (atomic, counts failed attempts) ----------
create table if not exists public.ai_plan_attempts (
  id bigserial primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('workout', 'diet')),
  created_at timestamptz not null default now()
);
create index if not exists ai_plan_attempts_member_idx on public.ai_plan_attempts (member_id, kind, created_at desc);
alter table public.ai_plan_attempts enable row level security;
revoke all on public.ai_plan_attempts from public, anon, authenticated;

create or replace function public.reserve_ai_slot(p_member_id uuid, p_kind text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  since timestamptz := now() - interval '24 hours';
  recent boolean;
  attempts int;
begin
  if p_kind not in ('workout', 'diet') then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text || ':' || p_kind, 0));
  if p_kind = 'workout' then
    select exists (select 1 from public.workout_plans where member_id = p_member_id and source = 'ai' and created_at >= since) into recent;
  else
    select exists (select 1 from public.diet_plans where member_id = p_member_id and source = 'ai' and created_at >= since) into recent;
  end if;
  if recent then return false; end if;
  select count(*) into attempts from public.ai_plan_attempts
  where member_id = p_member_id and kind = p_kind and created_at >= since;
  if attempts >= 3 then return false; end if;
  insert into public.ai_plan_attempts (member_id, kind) values (p_member_id, p_kind);
  return true;
end $$;
revoke execute on function public.reserve_ai_slot(uuid, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.reserve_ai_slot(uuid, text) to service_role;
    grant select, insert, delete on public.ai_plan_attempts to service_role;
    grant usage on sequence public.ai_plan_attempts_id_seq to service_role;
  end if;
end $$;
