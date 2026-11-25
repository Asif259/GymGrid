-- Signed-in users reach tables only through RLS policies; logged-out users get nothing.
-- New Supabase projects do not grant these by default.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.staff, public.plans, public.members, public.payments, public.workout_plans, public.diet_plans
  to authenticated;
grant select on public.daily_summary to authenticated;
grant usage on sequence public.plans_id_seq to authenticated;

revoke all on
  public.staff, public.plans, public.members, public.payments, public.workout_plans, public.diet_plans,
  public.daily_summary
  from anon;
