-- Claim only with an email the auth server confirmed, read from auth.users (not from the request token).
-- Stops someone from signing up with a member's email (unconfirmed) and taking over that membership.
create or replace function public.claim_member()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  em text;
  mid uuid := public.my_member_id();
begin
  if mid is not null or auth.uid() is null then
    return mid;
  end if;
  select lower(btrim(u.email)) into em from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if em is null then
    return null;
  end if;
  update public.members set auth_user_id = auth.uid()
  where email = em and auth_user_id is null
  returning id into mid;
  return mid;
end $$;
