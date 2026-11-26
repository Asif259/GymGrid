-- Add structured goal_type, run_ok, and session_minutes columns to members.
-- Keep free-text goal column for custom notes; update update_my_profile RPC and service_role grants.

alter table public.members
  add column goal_type text check (goal_type in ('muscle_gain', 'strength', 'fat_loss', 'maintain_lean', 'general_fitness')),
  add column run_ok boolean,
  add column session_minutes int check (session_minutes in (45, 60));

drop function if exists public.update_my_profile(
  uuid, text, text, text, int, text, int, numeric, numeric, text, int, text, text, text, text, text
);

create or replace function public.update_my_profile(
  p_member_id uuid default null,
  p_name text default null,
  p_phone text default null,
  p_goal text default null,
  p_age int default null,
  p_sex text default null,
  p_height_cm int default null,
  p_weight_kg numeric default null,
  p_goal_weight_kg numeric default null,
  p_level text default null,
  p_days_per_week int default null,
  p_equipment text default null,
  p_activity text default null,
  p_injuries text default null,
  p_diet_pref text default null,
  p_allergies text default null,
  p_goal_type text default null,
  p_run_ok boolean default null,
  p_session_minutes int default null
)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_name text;
  v_phone text;
  v_goal text := nullif(btrim(coalesce(p_goal, '')), '');
  v_goal_type text := nullif(lower(btrim(coalesce(p_goal_type, ''))), '');
  v_sex text := nullif(lower(btrim(coalesce(p_sex, ''))), '');
  v_level text := nullif(lower(btrim(coalesce(p_level, ''))), '');
  v_equipment text := nullif(lower(btrim(coalesce(p_equipment, ''))), '');
  v_activity text := nullif(lower(btrim(coalesce(p_activity, ''))), '');
  v_injuries text := nullif(btrim(coalesce(p_injuries, '')), '');
  v_diet_pref text := nullif(btrim(coalesce(p_diet_pref, '')), '');
  v_allergies text := nullif(btrim(coalesce(p_allergies, '')), '');
  v_updated_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select id, gym_id, name, phone into m
  from public.members
  where auth_user_id = auth.uid()
    and (p_member_id is null or id = p_member_id)
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'member profile not found' using errcode = 'P0002';
  end if;

  v_name := coalesce(nullif(btrim(coalesce(p_name, '')), ''), m.name);
  if char_length(v_name) not between 2 and 80 then
    raise exception 'enter your name (2-80 characters)' using errcode = '22023';
  end if;

  v_phone := coalesce(
    nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), ''),
    m.phone
  );
  if v_phone !~ '^[1-9][0-9]{7,14}$' then
    raise exception 'invalid phone number with country code' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.members other
    where other.gym_id = m.gym_id and other.phone = v_phone and other.id <> m.id
  ) then
    raise exception 'that phone number is already registered with another member' using errcode = '23505';
  end if;

  if char_length(coalesce(v_goal, '')) > 60
     or char_length(coalesce(v_injuries, '')) > 300
     or char_length(coalesce(v_diet_pref, '')) > 300
     or char_length(coalesce(v_allergies, '')) > 300 then
    raise exception 'details too long' using errcode = '22023';
  end if;

  update public.members
  set name = v_name,
      phone = v_phone,
      goal = v_goal,
      goal_type = v_goal_type,
      run_ok = p_run_ok,
      session_minutes = p_session_minutes,
      age = p_age,
      sex = v_sex,
      height_cm = p_height_cm,
      weight_kg = p_weight_kg,
      goal_weight_kg = p_goal_weight_kg,
      level = v_level,
      days_per_week = p_days_per_week,
      equipment = v_equipment,
      activity = v_activity,
      injuries = v_injuries,
      diet_pref = v_diet_pref,
      allergies = v_allergies,
      details_updated_at = now()
  where id = m.id
  returning details_updated_at into v_updated_at;

  return v_updated_at;
end $$;

revoke execute on function public.update_my_profile(
  uuid, text, text, text, int, text, int, numeric, numeric, text, int, text, text, text, text, text, text, boolean, int
) from public, anon;

grant execute on function public.update_my_profile(
  uuid, text, text, text, int, text, int, numeric, numeric, text, int, text, text, text, text, text, text, boolean, int
) to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant update (goal_type, run_ok, session_minutes) on public.members to service_role;
  end if;
end $$;
