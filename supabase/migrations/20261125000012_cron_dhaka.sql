-- pg_cron runs in UTC. 18:01 UTC = 00:01 Asia/Dhaka, so statuses flip right after the gym's midnight.
select cron.schedule('refresh-member-status', '1 18 * * *', $$select public.refresh_member_status()$$);
