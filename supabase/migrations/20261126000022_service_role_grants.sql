-- Grant service_role only what the automation Edge Function (supabase/functions/automation/index.ts) uses.
-- Nothing is granted to anon or authenticated.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant select on
      public.gym_settings,
      public.staff,
      public.members,
      public.plans,
      public.attendance,
      public.plan_templates
      to service_role;
    grant select, update on
      public.payments,
      public.automation_events
      to service_role;
    -- reminders() selects, inserts via upsert(ignoreDuplicates), and deletes on send failure for retry.
    grant select, insert, delete on
      public.reminder_log
      to service_role;
    grant execute on function public.owner_digest() to service_role;
  end if;
end $$;
