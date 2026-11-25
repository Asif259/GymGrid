-- Self sign-up: the gym shares a link with a secret token; a signed-in user with a confirmed email creates their member row.
alter table public.gym_settings add column signup_token text not null default replace(gen_random_uuid()::text, '-', '');
-- No column grant: the token stays out of members' reach, like checkin_token.

create function public.signup_link_token()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return (select signup_token from public.gym_settings);
end $$;

create function public.rotate_signup_token()
returns text language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  update public.gym_settings set signup_token = t;
  return t;
end $$;

create function public.self_register(
  token text, name text, phone text, plan_id int,
  goal text default null, age int default null, sex text default null, height_cm int default null,
  weight_kg numeric default null, injuries text default null, diet_pref text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  em text;
  ph text := regexp_replace(coalesce(self_register.phone, ''), '[^0-9]', '', 'g');
  mid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if token is null or token is distinct from (select signup_token from public.gym_settings) then
    raise exception 'invalid signup link' using errcode = '42501';
  end if;
  -- Email from auth.users, confirmed by the auth server (not from the request token).
  select lower(btrim(u.email)) into em from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if em is null then raise exception 'confirm your email first' using errcode = '42501'; end if;
  if public.my_member_id() is not null then raise exception 'already registered' using errcode = '23505'; end if;
  if ph !~ '^[1-9][0-9]{7,14}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  if exists (select 1 from public.members m where m.phone = ph) then
    raise exception 'phone already registered' using errcode = '23505';
  end if;
  if exists (select 1 from public.members m where m.email = em) then
    raise exception 'email already on a member; sign in to claim it' using errcode = '23505';
  end if;
  insert into public.members (auth_user_id, email, name, phone, plan_id, status,
    goal, age, sex, height_cm, weight_kg, injuries, diet_pref)
  values (auth.uid(), em, btrim(self_register.name), ph, self_register.plan_id, 'due',
    self_register.goal, self_register.age, self_register.sex, self_register.height_cm,
    self_register.weight_kg, self_register.injuries, self_register.diet_pref)
  returning id into mid;
  return mid;
end $$;

revoke execute on function public.signup_link_token(), public.rotate_signup_token(),
  public.self_register(text, text, text, int, text, int, text, int, numeric, text, text) from public, anon;
grant execute on function public.signup_link_token(), public.rotate_signup_token(),
  public.self_register(text, text, text, int, text, int, text, int, numeric, text, text) to authenticated;
