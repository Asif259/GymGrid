-- Multi-tenant SaaS migration: gyms, gym_staff, non-destructive backfill, tenant-scoped RLS, RPCs, and outbox.

-- ---------- 1. new tenant tables ----------

create table if not exists public.gyms (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references auth.users on delete restrict,
  name               text not null default 'Our Gym',
  slug               text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  logo_url           text,
  phone              text,
  address            text,
  currency           text not null default '৳',
  timezone           text not null default 'Asia/Dhaka',
  bkash_number       text check (bkash_number ~ '^[0-9]{11,13}$'),
  nagad_number       text check (nagad_number ~ '^[0-9]{11,13}$'),
  app_url            text check (app_url ~ '^https?://'),
  sheet_id           text check (sheet_id ~ '^[A-Za-z0-9_-]{20,}$'),
  owner_digest_email text check (owner_digest_email = lower(btrim(owner_digest_email))),
  checkin_token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  signup_token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  saas_status        text not null default 'active' check (saas_status in ('trial', 'active', 'suspended')),
  created_at         timestamptz not null default now()
);

create table if not exists public.gym_staff (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null check (role in ('owner', 'trainer', 'staff')),
  display_name text,
  created_at   timestamptz not null default now(),
  unique (gym_id, user_id)
);

create index if not exists gym_staff_user_id_idx on public.gym_staff (user_id);
create index if not exists gym_staff_gym_id_idx on public.gym_staff (gym_id);

-- ---------- 2. backfill default gym and staff ----------

insert into public.gyms (
  id, owner_id, name, slug, currency,
  bkash_number, nagad_number, app_url, sheet_id, owner_digest_email,
  checkin_token, signup_token, saas_status
)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  (select user_id from public.staff where role = 'owner' order by user_id limit 1),
  coalesce(nullif(btrim(gs.name), ''), 'Our Gym'),
  'default-gym',
  coalesce(nullif(btrim(gs.currency), ''), '৳'),
  gs.bkash_number,
  gs.nagad_number,
  gs.app_url,
  gs.sheet_id,
  gs.owner_digest_email,
  gs.checkin_token,
  gs.signup_token,
  'active'
from public.gym_settings gs
on conflict (id) do nothing;

insert into public.gyms (id, name, slug, saas_status)
values ('00000000-0000-0000-0000-000000000001'::uuid, 'Our Gym', 'default-gym', 'active')
on conflict (id) do nothing;

insert into public.gym_staff (gym_id, user_id, role, display_name)
select '00000000-0000-0000-0000-000000000001'::uuid, user_id, role, display_name
from public.staff
on conflict (gym_id, user_id) do nothing;

-- ---------- 3. add gym_id safely (nullable -> backfill -> NOT NULL) ----------

alter table public.plans             add column if not exists gym_id uuid references public.gyms on delete cascade;
alter table public.members           add column if not exists gym_id uuid references public.gyms on delete cascade;
alter table public.plan_templates    add column if not exists gym_id uuid references public.gyms on delete cascade;
alter table public.automation_events add column if not exists gym_id uuid references public.gyms on delete cascade;
alter table public.reminder_log      add column if not exists gym_id uuid references public.gyms on delete cascade;

update public.plans             set gym_id = '00000000-0000-0000-0000-000000000001'::uuid where gym_id is null;
update public.members           set gym_id = '00000000-0000-0000-0000-000000000001'::uuid where gym_id is null;
update public.plan_templates    set gym_id = '00000000-0000-0000-0000-000000000001'::uuid where gym_id is null;
update public.automation_events set gym_id = '00000000-0000-0000-0000-000000000001'::uuid where gym_id is null;
update public.reminder_log      set gym_id = '00000000-0000-0000-0000-000000000001'::uuid where gym_id is null;

alter table public.plans             alter column gym_id set not null;
alter table public.members           alter column gym_id set not null;
alter table public.plan_templates    alter column gym_id set not null;
alter table public.automation_events alter column gym_id set not null;
alter table public.reminder_log      alter column gym_id set not null;

-- Replace global uniqueness with per-gym uniqueness; allow trainers from gym_staff.
alter table public.plans drop constraint if exists plans_name_key;
alter table public.plans add constraint plans_gym_id_name_key unique (gym_id, name);

alter table public.members drop constraint if exists members_phone_key;
alter table public.members drop constraint if exists members_email_key;
alter table public.members drop constraint if exists members_auth_user_id_key;
alter table public.members drop constraint if exists members_trainer_id_fkey;
alter table public.members add constraint members_gym_id_phone_key unique (gym_id, phone);
alter table public.members add constraint members_gym_id_email_key unique (gym_id, email);
alter table public.members add constraint members_gym_id_auth_user_id_key unique (gym_id, auth_user_id);
alter table public.members add constraint members_trainer_id_fkey
  foreign key (trainer_id) references auth.users (id) on delete set null;

alter table public.plan_templates drop constraint if exists plan_templates_kind_name_key;
alter table public.plan_templates add constraint plan_templates_gym_id_kind_name_key unique (gym_id, kind, name);

create index if not exists members_gym_id_idx on public.members (gym_id);
create index if not exists plans_gym_id_idx on public.plans (gym_id);
create index if not exists plan_templates_gym_id_idx on public.plan_templates (gym_id);
create index if not exists automation_events_gym_status_idx on public.automation_events (gym_id, status);
create index if not exists reminder_log_gym_day_idx on public.reminder_log (gym_id, day);

-- ---------- 4. multi-tenant helper functions ----------

create or replace function public.get_my_gym_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select gym_id from public.gym_staff where user_id = auth.uid()
$$;

create or replace function public.my_gym_id()
returns uuid language sql stable security definer set search_path = public as $$
  select gs.gym_id
  from public.gym_staff gs
  where gs.user_id = auth.uid()
  order by (gs.gym_id::text = nullif(current_setting('app.current_gym_id', true), '')) desc nulls last,
           gs.created_at asc
  limit 1
$$;

create or replace function public.is_gym_staff(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_staff
    where gym_id = p_gym_id and user_id = auth.uid()
  )
$$;

create or replace function public.is_gym_owner(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_staff
    where gym_id = p_gym_id and user_id = auth.uid() and role = 'owner'
  ) or exists (
    select 1 from public.gyms
    where id = p_gym_id and owner_id = auth.uid()
  )
$$;

create or replace function public.my_member_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.members where auth_user_id = auth.uid()
$$;

create or replace function public.my_member_gym_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select gym_id from public.members where auth_user_id = auth.uid()
$$;

-- Update legacy helpers so they read from gym_staff while preserving signatures.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gym_staff where user_id = auth.uid())
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gym_staff where user_id = auth.uid() and role = 'owner')
$$;

create or replace function public.my_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where auth_user_id = auth.uid() order by created_at desc limit 1
$$;

create or replace function public.gym_today_for(p_gym_id uuid)
returns date language sql stable set search_path = public, pg_catalog as $$
  select (now() at time zone coalesce((select timezone from public.gyms where id = p_gym_id), 'Asia/Dhaka'))::date
$$;

-- ---------- 5. row level security ----------

alter table public.gyms enable row level security;
alter table public.gym_staff enable row level security;

-- gyms
create policy gyms_staff_read on public.gyms for select to authenticated
  using (id in (select public.get_my_gym_ids()));
create policy gyms_member_read on public.gyms for select to authenticated
  using (id in (select public.my_member_gym_ids()));
create policy gyms_owner_update on public.gyms for update to authenticated
  using (public.is_gym_owner(id)) with check (public.is_gym_owner(id));

-- gym_staff (staff see their gym's team; members can read trainer display_name of their gym)
create policy gym_staff_read on public.gym_staff for select to authenticated
  using (
    gym_id in (select public.get_my_gym_ids())
    or gym_id in (select public.my_member_gym_ids())
  );
create policy gym_staff_owner_write on public.gym_staff for all to authenticated
  using (public.is_gym_owner(gym_id)) with check (public.is_gym_owner(gym_id));

-- plans
drop policy if exists plans_read on public.plans;
drop policy if exists plans_owner_write on public.plans;
create policy plans_read on public.plans for select to authenticated
  using (
    gym_id in (select public.get_my_gym_ids())
    or gym_id in (select public.my_member_gym_ids())
  );
create policy plans_owner_write on public.plans for all to authenticated
  using (public.is_gym_owner(gym_id)) with check (public.is_gym_owner(gym_id));

-- members
drop policy if exists members_staff on public.members;
drop policy if exists members_self_read on public.members;
create policy members_staff on public.members for all to authenticated
  using (gym_id in (select public.get_my_gym_ids()))
  with check (gym_id in (select public.get_my_gym_ids()));
create policy members_self_read on public.members for select to authenticated
  using (auth_user_id = auth.uid());

-- payments (isolated via member -> gym_id)
drop policy if exists payments_staff on public.payments;
drop policy if exists payments_self_read on public.payments;
drop policy if exists payments_self_submit on public.payments;
create policy payments_staff on public.payments for all to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ))
  with check (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ));
create policy payments_self_read on public.payments for select to authenticated
  using (member_id in (select public.my_member_ids()));
create policy payments_self_submit on public.payments for insert to authenticated
  with check (member_id in (select public.my_member_ids()) and status = 'pending');

-- workout_plans (isolated via member -> gym_id)
drop policy if exists workout_staff on public.workout_plans;
drop policy if exists workout_self_read on public.workout_plans;
create policy workout_staff on public.workout_plans for all to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ))
  with check (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ));
create policy workout_self_read on public.workout_plans for select to authenticated
  using (member_id in (select public.my_member_ids()) and verified);

-- diet_plans (isolated via member -> gym_id)
drop policy if exists diet_staff on public.diet_plans;
drop policy if exists diet_self_read on public.diet_plans;
create policy diet_staff on public.diet_plans for all to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ))
  with check (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ));
create policy diet_self_read on public.diet_plans for select to authenticated
  using (member_id in (select public.my_member_ids()) and verified);

-- attendance (isolated via member -> gym_id)
drop policy if exists attendance_staff on public.attendance;
drop policy if exists attendance_self_read on public.attendance;
create policy attendance_staff on public.attendance for all to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ))
  with check (exists (
    select 1 from public.members m
    where m.id = member_id and m.gym_id in (select public.get_my_gym_ids())
  ));
create policy attendance_self_read on public.attendance for select to authenticated
  using (member_id in (select public.my_member_ids()));

-- plan_templates
drop policy if exists plan_templates_staff on public.plan_templates;
create policy plan_templates_staff on public.plan_templates for all to authenticated
  using (gym_id in (select public.get_my_gym_ids()))
  with check (gym_id in (select public.get_my_gym_ids()));

-- automation_events & reminder_log
drop policy if exists automation_events_staff_read on public.automation_events;
create policy automation_events_staff_read on public.automation_events for select to authenticated
  using (gym_id in (select public.get_my_gym_ids()));

drop policy if exists reminder_log_staff_read on public.reminder_log;
create policy reminder_log_staff_read on public.reminder_log for select to authenticated
  using (gym_id in (select public.get_my_gym_ids()));

-- Tighten legacy tables so multi-tenant users cannot read default gym data via them
drop policy if exists gym_settings_read on public.gym_settings;
drop policy if exists gym_settings_owner_update on public.gym_settings;
create policy gym_settings_read on public.gym_settings for select to authenticated
  using (
    public.is_gym_staff('00000000-0000-0000-0000-000000000001'::uuid)
    or '00000000-0000-0000-0000-000000000001'::uuid in (select public.my_member_gym_ids())
  );
create policy gym_settings_owner_update on public.gym_settings for update to authenticated
  using (public.is_gym_owner('00000000-0000-0000-0000-000000000001'::uuid))
  with check (public.is_gym_owner('00000000-0000-0000-0000-000000000001'::uuid));

-- ---------- 6. updated triggers & guards ----------

create or replace function public.payments_guard()
returns trigger language plpgsql set search_path = public as $$
declare v_is_member_gym_staff boolean;
begin
  new.trx_id := nullif(upper(btrim(new.trx_id)), '');

  select exists (
    select 1 from public.members m
    join public.gym_staff gs on gs.gym_id = m.gym_id
    where m.id = new.member_id and gs.user_id = auth.uid()
  ) into v_is_member_gym_staff;

  if current_user in ('authenticated', 'anon') and not coalesce(v_is_member_gym_staff, false) then
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

create or replace function public.members_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.automation_events (gym_id, kind, member_id)
  values (new.gym_id, case tg_op when 'INSERT' then 'member.created' else 'member.updated' end, new.id);
  return null;
end $$;

create or replace function public.payments_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_gym_id uuid;
begin
  if new.status <> 'paid' then return null; end if;
  select gym_id into v_gym_id from public.members where id = new.member_id;
  if v_gym_id is null then return null; end if;
  insert into public.automation_events (gym_id, kind, member_id, payment_id)
  values (v_gym_id, 'payment.paid', new.member_id, new.id);
  return null;
end $$;

-- ---------- 7. onboarding, public lookup, check-in, self-signup, reporting RPCs ----------

create or replace function public.is_gym_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(btrim(coalesce(p_slug, ''))) ~ '^[a-z0-9-]{3,60}$'
    and not exists (
      select 1 from public.gyms where slug = lower(btrim(coalesce(p_slug, '')))
    )
$$;

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
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'enter a gym name (2-80 chars)' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9-]{3,60}$' then
    raise exception 'slug must be 3-60 lowercase letters, numbers, or hyphens' using errcode = '22023';
  end if;
  if exists (select 1 from public.gyms where slug = v_slug) then
    raise exception 'slug already taken' using errcode = '23505';
  end if;

  select lower(btrim(u.email)) into v_email from auth.users u where u.id = auth.uid();

  insert into public.gyms (
    owner_id, name, slug, currency, timezone, phone, address, logo_url,
    owner_digest_email, saas_status
  )
  values (
    auth.uid(),
    v_name,
    v_slug,
    coalesce(nullif(btrim(p_currency), ''), '৳'),
    coalesce(nullif(btrim(p_timezone), ''), 'Asia/Dhaka'),
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

create or replace function public.get_public_gym_by_slug(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when g.id is null then null else jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'slug', g.slug,
    'logo_url', g.logo_url,
    'currency', g.currency,
    'phone', g.phone,
    'address', g.address,
    'plans', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'gym_id', p.gym_id, 'name', p.name, 'months', p.months, 'price', p.price)
        order by p.months
      )
      from public.plans p where p.gym_id = g.id
    ), '[]'::jsonb)
  ) end
  from public.gyms g
  where g.slug = lower(btrim(coalesce(p_slug, '')))
    and g.saas_status in ('trial', 'active')
$$;

create or replace function public.get_public_gym_by_id(p_gym_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when g.id is null then null else jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'slug', g.slug,
    'logo_url', g.logo_url,
    'currency', g.currency,
    'phone', g.phone,
    'address', g.address
  ) end
  from public.gyms g
  where g.id = p_gym_id
    and g.saas_status in ('trial', 'active')
$$;

drop function if exists public.checkin_qr_token();
create or replace function public.checkin_qr_token(p_gym_id uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_gid uuid := coalesce(p_gym_id, public.my_gym_id());
begin
  if v_gid is null or not public.is_gym_staff(v_gid) then
    raise exception 'staff only' using errcode = '42501';
  end if;
  return (select checkin_token from public.gyms where id = v_gid);
end $$;

drop function if exists public.rotate_checkin_token();
create or replace function public.rotate_checkin_token(p_gym_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_gid uuid := coalesce(p_gym_id, public.my_gym_id());
  t text := replace(gen_random_uuid()::text, '-', '');
begin
  if v_gid is null or not public.is_gym_owner(v_gid) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.gyms set checkin_token = t where id = v_gid;
  return t;
end $$;

drop function if exists public.signup_link_token();
create or replace function public.signup_link_token(p_gym_id uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_gid uuid := coalesce(p_gym_id, public.my_gym_id());
begin
  if v_gid is null or not public.is_gym_staff(v_gid) then
    raise exception 'staff only' using errcode = '42501';
  end if;
  return (select signup_token from public.gyms where id = v_gid);
end $$;

drop function if exists public.rotate_signup_token();
create or replace function public.rotate_signup_token(p_gym_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_gid uuid := coalesce(p_gym_id, public.my_gym_id());
  t text := replace(gen_random_uuid()::text, '-', '');
begin
  if v_gid is null or not public.is_gym_owner(v_gid) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.gyms set signup_token = t where id = v_gid;
  return t;
end $$;

drop function if exists public.automation_settings();
create or replace function public.automation_settings(p_gym_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_gid uuid := coalesce(p_gym_id, public.my_gym_id());
begin
  if v_gid is null or not public.is_gym_owner(v_gid) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object('sheet_id', sheet_id, 'owner_digest_email', owner_digest_email)
    from public.gyms where id = v_gid
  );
end $$;

drop function if exists public.check_in(text);
create or replace function public.check_in(token text, p_gym_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  g record;
  m record;
  added int;
  v_today date;
  v_paid_up boolean;
begin
  if token is null then
    raise exception 'invalid check-in code; scan the QR at the front desk' using errcode = '22023';
  end if;
  select g_row.id, g_row.name into g from public.gyms g_row
  where g_row.checkin_token = check_in.token
    and (p_gym_id is null or g_row.id = p_gym_id);
  if not found then
    raise exception 'invalid check-in code; scan the QR at the front desk' using errcode = '22023';
  end if;
  select id, name, status, expiry_date into m
  from public.members
  where auth_user_id = auth.uid() and gym_id = g.id;
  if not found then
    raise exception 'this account is not linked to a membership at %', g.name using errcode = '42501';
  end if;
  v_today := public.gym_today_for(g.id);
  insert into public.attendance (member_id, method) values (m.id, 'qr') on conflict (member_id, day) do nothing;
  get diagnostics added = row_count;
  v_paid_up := coalesce(m.expiry_date >= v_today, false) and m.status <> 'frozen';
  return jsonb_build_object(
    'gym_id', g.id,
    'gym_name', g.name,
    'name', m.name,
    'status', m.status,
    'expiry_date', m.expiry_date,
    'already', added = 0,
    'paid_up', v_paid_up,
    'message', case
      when not v_paid_up then 'Checked in — membership expired or unpaid'
      when added = 0 then 'Already checked in today'
      else 'Checked in to ' || g.name || '!'
    end
  );
end $$;

drop function if exists public.self_register(text, text, text, int, text, int, text, int, numeric, text, text);
create or replace function public.self_register(
  token text, name text, phone text, plan_id int,
  goal text default null, age int default null, sex text default null, height_cm int default null,
  weight_kg numeric default null, injuries text default null, diet_pref text default null,
  p_gym_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g record;
  em text;
  ph text := regexp_replace(coalesce(self_register.phone, ''), '[^0-9]', '', 'g');
  nm text := btrim(coalesce(self_register.name, ''));
  mid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if token is null then raise exception 'invalid signup link' using errcode = '42501'; end if;
  select g_row.id, g_row.name into g from public.gyms g_row
  where g_row.signup_token = self_register.token
    and (p_gym_id is null or g_row.id = p_gym_id);
  if not found then
    raise exception 'invalid signup link' using errcode = '42501';
  end if;
  select lower(btrim(u.email)) into em from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if em is null then raise exception 'confirm your email first' using errcode = '42501'; end if;
  if exists (select 1 from public.members m where m.gym_id = g.id and m.auth_user_id = auth.uid()) then
    raise exception 'already registered' using errcode = '23505';
  end if;
  if char_length(nm) not between 2 and 80 then raise exception 'enter your name' using errcode = '22023'; end if;
  if ph !~ '^[1-9][0-9]{7,14}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  if not exists (select 1 from public.plans p where p.id = self_register.plan_id and p.gym_id = g.id) then
    raise exception 'invalid plan' using errcode = '22023';
  end if;
  if char_length(coalesce(goal, '')) > 60 or char_length(coalesce(injuries, '')) > 300 or char_length(coalesce(diet_pref, '')) > 300 then
    raise exception 'details too long' using errcode = '22023';
  end if;
  if exists (select 1 from public.members m where m.gym_id = g.id and (m.phone = ph or m.email = em)) then
    raise exception 'could not register with those details; ask the front desk' using errcode = '23505';
  end if;
  insert into public.members (gym_id, auth_user_id, email, name, phone, plan_id, status,
    goal, age, sex, height_cm, weight_kg, injuries, diet_pref)
  values (g.id, auth.uid(), em, nm, ph, self_register.plan_id, 'due',
    self_register.goal, self_register.age, self_register.sex, self_register.height_cm,
    self_register.weight_kg, self_register.injuries, self_register.diet_pref)
  returning id into mid;
  return mid;
end $$;

drop function if exists public.claim_member();
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
  if mid is not null then
    return mid;
  end if;
  select lower(btrim(u.email)) into em from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if em is null then
    return null;
  end if;
  update public.members set auth_user_id = auth.uid()
  where id = (
    select id from public.members
    where email = em and auth_user_id is null
      and (p_gym_id is null or gym_id = p_gym_id)
    order by created_at desc limit 1
  )
  returning id into mid;
  return mid;
end $$;

create or replace function public.assign_plan(template_id uuid, member_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare k text; p jsonb; v_gid uuid; n int;
begin
  select t.kind, t.plan, t.gym_id into k, p, v_gid
  from public.plan_templates t where t.id = assign_plan.template_id;
  if k is null then raise exception 'template not found' using errcode = 'P0002'; end if;
  if not public.is_gym_staff(v_gid) then
    raise exception 'staff only' using errcode = '42501';
  end if;
  if k = 'workout' then
    insert into public.workout_plans (member_id, plan, verified)
    select distinct m.id, p, true
    from public.members m
    where m.id = any(member_ids) and m.gym_id = v_gid;
  else
    insert into public.diet_plans (member_id, plan, verified)
    select distinct m.id, p, true
    from public.members m
    where m.id = any(member_ids) and m.gym_id = v_gid;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

drop function if exists public.my_streak();
create or replace function public.my_streak(p_member_id uuid default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with target as (
    select coalesce(p_member_id, public.my_member_id()) as mid
  ),
  d as (
    select distinct a.day
    from public.attendance a, target t
    where a.member_id = t.mid
  ),
  runs as (
    select count(*)::int n, max(day) last
    from (select day, day - (row_number() over (order by day))::int grp from d) g
    group by grp
  )
  select jsonb_build_object(
    'current', coalesce((select n from runs where last >= public.gym_today() - 1), 0),
    'best', coalesce((select max(n) from runs), 0),
    'visits_month', (select count(*) from d where day >= date_trunc('month', public.gym_today())::date)
  )
$$;

drop function if exists public.daily_report();
create or replace function public.daily_report(p_gym_id uuid default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with ctx as (
    select coalesce(p_gym_id, public.my_gym_id()) as gid
  )
  select jsonb_build_object(
    'date', public.gym_today(),
    'summary', jsonb_build_object(
      'active', (select count(*) from public.members m, ctx where (ctx.gid is null or m.gym_id = ctx.gid) and m.status = 'active'),
      'due', (select count(*) from public.members m, ctx where (ctx.gid is null or m.gym_id = ctx.gid) and m.status = 'due'),
      'expired', (select count(*) from public.members m, ctx where (ctx.gid is null or m.gym_id = ctx.gid) and m.status = 'expired'),
      'frozen', (select count(*) from public.members m, ctx where (ctx.gid is null or m.gym_id = ctx.gid) and m.status = 'frozen'),
      'pending_payments', (select count(*) from public.payments pay join public.members m on m.id = pay.member_id, ctx
                           where (ctx.gid is null or m.gym_id = ctx.gid) and pay.status = 'pending'),
      'pending_amount', (select coalesce(sum(pay.amount), 0) from public.payments pay join public.members m on m.id = pay.member_id, ctx
                         where (ctx.gid is null or m.gym_id = ctx.gid) and pay.status = 'pending'),
      'attendance_today', (select count(*) from public.attendance a join public.members m on m.id = a.member_id, ctx
                           where (ctx.gid is null or m.gym_id = ctx.gid) and a.day = public.gym_today()),
      'revenue_today', (select coalesce(sum(pay.amount), 0) from public.payments pay join public.members m on m.id = pay.member_id, ctx
                        where (ctx.gid is null or m.gym_id = ctx.gid) and pay.status = 'paid' and pay.paid_on = public.gym_today()),
      'revenue_month', (select coalesce(sum(pay.amount), 0) from public.payments pay join public.members m on m.id = pay.member_id, ctx
                        where (ctx.gid is null or m.gym_id = ctx.gid) and pay.status = 'paid' and pay.paid_on >= date_trunc('month', public.gym_today())::date),
      'revenue_total', (select coalesce(sum(pay.amount), 0) from public.payments pay join public.members m on m.id = pay.member_id, ctx
                        where (ctx.gid is null or m.gym_id = ctx.gid) and pay.status = 'paid'),
      'attendance_yesterday', (select count(*) from public.attendance a join public.members m on m.id = a.member_id, ctx
                               where (ctx.gid is null or m.gym_id = ctx.gid) and a.day = public.gym_today() - 1)
    ),
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.name)
      from public.members m left join public.plans p on p.id = m.plan_id, ctx
      where (ctx.gid is null or m.gym_id = ctx.gid) and m.expiry_date = public.gym_today() + 2 and m.status <> 'frozen'), '[]'::jsonb),
    'expired_recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.expiry_date desc)
      from public.members m left join public.plans p on p.id = m.plan_id, ctx
      where (ctx.gid is null or m.gym_id = ctx.gid) and m.status = 'expired' and m.expiry_date >= public.gym_today() - 30), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'amount', pay.amount, 'method', pay.method, 'trx_id', pay.trx_id,
        'days_waiting', public.gym_today() - pay.created_at::date) order by pay.created_at)
      from public.payments pay join public.members m on m.id = pay.member_id, ctx
      where (ctx.gid is null or m.gym_id = ctx.gid) and pay.status = 'pending'), '[]'::jsonb),
    'unpaid_checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'status', a.status_at_checkin, 'expiry_date', m.expiry_date,
        'checked_in_at', a.checked_in_at) order by a.checked_in_at)
      from public.attendance a join public.members m on m.id = a.member_id, ctx
      where (ctx.gid is null or m.gym_id = ctx.gid) and a.day = public.gym_today() and not a.paid_up), '[]'::jsonb)
  )
$$;

create or replace function public.owner_digest_for_gym(p_gym_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.gym_today_for(p_gym_id);
begin
  if auth.uid() is not null and not public.is_gym_owner(p_gym_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'date', v_today,
    'active', (select count(*) from public.members where gym_id = p_gym_id and status = 'active'),
    'expired', (select count(*) from public.members where gym_id = p_gym_id and status = 'expired'),
    'attendance_yesterday', (select count(*) from public.attendance a join public.members m on m.id = a.member_id
                             where m.gym_id = p_gym_id and a.day = v_today - 1),
    'pending_count', (select count(*) from public.payments pay join public.members m on m.id = pay.member_id
                      where m.gym_id = p_gym_id and pay.status = 'pending'),
    'pending_amount', (select coalesce(sum(pay.amount), 0) from public.payments pay join public.members m on m.id = pay.member_id
                       where m.gym_id = p_gym_id and pay.status = 'pending'),
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.name)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.gym_id = p_gym_id and m.expiry_date = v_today + 2 and m.status <> 'frozen'), '[]'::jsonb)
  );
end $$;

create or replace function public.owner_digest()
returns jsonb language sql stable security invoker set search_path = public as $$
  select case
    when public.my_gym_id() is not null then public.owner_digest_for_gym(public.my_gym_id())
    else jsonb_build_object(
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
        where m.expiry_date = public.gym_today() + 2 and m.status <> 'frozen'), '[]'::jsonb)
    )
  end
$$;

-- ---------- 8. grants ----------

revoke all on public.gyms from public, anon, authenticated;
grant select (
  id, owner_id, name, slug, logo_url, phone, address, currency, timezone,
  bkash_number, nagad_number, app_url, saas_status, created_at
) on public.gyms to authenticated;
grant update (
  name, slug, logo_url, phone, address, currency, timezone,
  bkash_number, nagad_number, app_url, sheet_id, owner_digest_email
) on public.gyms to authenticated;

revoke all on public.gym_staff from public, anon;
grant select, insert, update, delete on public.gym_staff to authenticated;

revoke execute on function
  public.get_my_gym_ids(),
  public.my_gym_id(),
  public.is_gym_staff(uuid),
  public.is_gym_owner(uuid),
  public.my_member_ids(),
  public.my_member_gym_ids(),
  public.is_staff(),
  public.is_owner(),
  public.my_member_id(),
  public.is_gym_slug_available(text),
  public.create_gym(text, text, text, text, text, text, text),
  public.checkin_qr_token(uuid),
  public.rotate_checkin_token(uuid),
  public.signup_link_token(uuid),
  public.rotate_signup_token(uuid),
  public.automation_settings(uuid),
  public.check_in(text, uuid),
  public.self_register(text, text, text, int, text, int, text, int, numeric, text, text, uuid),
  public.claim_member(uuid),
  public.assign_plan(uuid, uuid[]),
  public.my_streak(uuid),
  public.daily_report(uuid),
  public.owner_digest(),
  public.owner_digest_for_gym(uuid)
from public, anon;

grant execute on function
  public.get_my_gym_ids(),
  public.my_gym_id(),
  public.is_gym_staff(uuid),
  public.is_gym_owner(uuid),
  public.my_member_ids(),
  public.my_member_gym_ids(),
  public.is_staff(),
  public.is_owner(),
  public.my_member_id(),
  public.is_gym_slug_available(text),
  public.create_gym(text, text, text, text, text, text, text),
  public.checkin_qr_token(uuid),
  public.rotate_checkin_token(uuid),
  public.signup_link_token(uuid),
  public.rotate_signup_token(uuid),
  public.automation_settings(uuid),
  public.check_in(text, uuid),
  public.self_register(text, text, text, int, text, int, text, int, numeric, text, text, uuid),
  public.claim_member(uuid),
  public.assign_plan(uuid, uuid[]),
  public.my_streak(uuid),
  public.daily_report(uuid),
  public.owner_digest(),
  public.owner_digest_for_gym(uuid),
  public.gym_today_for(uuid)
to authenticated;

revoke execute on function public.get_public_gym_by_slug(text), public.get_public_gym_by_id(uuid) from public;
grant execute on function public.get_public_gym_by_slug(text), public.get_public_gym_by_id(uuid) to anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.gyms, public.gym_staff to service_role;
    grant execute on function public.owner_digest_for_gym(uuid), public.gym_today_for(uuid) to service_role;
  end if;
end $$;
