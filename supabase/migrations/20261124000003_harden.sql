-- Fixes Supabase security advisor warnings after core migration.

-- Pin search_path on all non-definer functions (lint 0011).
alter function public.member_status(date, text) set search_path = public;
alter function public.members_set_status() set search_path = public;
alter function public.refresh_member_status() set search_path = public;
alter function public.payments_fill_period() set search_path = public;
alter function public.payments_sync_expiry() set search_path = public;

-- Role helpers: RLS policies need them for signed-in users; logged-out users never do (lint 0028).
-- Signed-in access stays on purpose: each only reveals the caller's own role or member id.
revoke execute on function public.is_staff(), public.is_owner(), public.my_member_id() from public, anon;
grant execute on function public.is_staff(), public.is_owner(), public.my_member_id() to authenticated;

-- Only the nightly cron job (postgres role) refreshes statuses.
revoke execute on function public.refresh_member_status() from public, anon, authenticated;
