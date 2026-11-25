-- Hosted only (pg_net, pg_cron, Vault): increase net.http_post timeout from 5s default to 60s for SMTP calls.
create or replace function public.call_automation(route text)
returns void language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'automation_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'automation_secret';
  if u is null or s is null then return; end if; -- not configured yet
  perform net.http_post(
    url := u || '/' || route,
    headers := jsonb_build_object('content-type', 'application/json', 'x-automation-secret', s),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
end $$;

select cron.unschedule(jobname)
from cron.job
where jobname in ('automation-retry', 'automation-reminders', 'automation-digest', 'automation-reminders-retry');

select cron.schedule('automation-retry', '*/5 * * * *', $$select public.call_automation('dispatch')$$);
select cron.schedule('automation-reminders', '0 3 * * *', $$select public.call_automation('reminders')$$);
select cron.schedule('automation-digest', '0 2 * * *', $$select public.call_automation('digest')$$);
select cron.schedule('automation-reminders-retry', '0 6,9 * * *', $$select public.call_automation('reminders')$$);
