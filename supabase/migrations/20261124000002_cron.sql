-- Nightly status refresh at 00:05 (database time zone; Supabase default is UTC).
create extension if not exists pg_cron;

select cron.schedule('refresh-member-status', '5 0 * * *', $$select public.refresh_member_status()$$);
