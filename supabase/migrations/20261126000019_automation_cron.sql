-- Hosted only (pg_net, pg_cron, Vault): calls the automation function. verify-db skips this file ("cron").
-- Vault entries: automation_url (function base URL, no trailing slash), automation_secret.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create function public.call_automation(route text)
returns void language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'automation_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'automation_secret';
  if u is null or s is null then return; end if; -- not configured yet
  perform net.http_post(
    url := u || '/' || route,
    headers := jsonb_build_object('content-type', 'application/json', 'x-automation-secret', s),
    body := '{}'::jsonb);
end $$;
revoke execute on function public.call_automation(text) from public, anon, authenticated;

create function public.automation_events_kick()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.call_automation('dispatch');
  return null;
end $$;
revoke execute on function public.automation_events_kick() from public, anon, authenticated;

-- One call per statement, not per row.
create trigger automation_events_dispatch after insert on public.automation_events
for each statement execute function public.automation_events_kick();

select cron.schedule('automation-retry', '*/5 * * * *', $$select public.call_automation('dispatch')$$);
select cron.schedule('automation-reminders', '0 3 * * *', $$select public.call_automation('reminders')$$);
select cron.schedule('automation-digest', '0 2 * * *', $$select public.call_automation('digest')$$);
-- Failed reminders delete their log row; two more passes the same day retry only those (12:00 and 15:00 Dhaka).
select cron.schedule('automation-reminders-retry', '0 6,9 * * *', $$select public.call_automation('reminders')$$);
