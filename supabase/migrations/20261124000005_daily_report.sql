-- Morning report as one JSON document. Security invoker: RLS applies, so only staff get full data.
-- Used by the admin page ("Today" card) and the gym-ops agent (writes reports/YYYY-MM-DD.md).
create function public.daily_report()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'date', current_date,
    'summary', (select to_jsonb(s) from public.daily_summary s),
    -- Renewal reminders: membership ends exactly 2 days from today.
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.name)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.expiry_date = current_date + 2 and m.status <> 'frozen'), '[]'::jsonb),
    -- Lapsed in the last 30 days: worth a follow-up message. Older ones are treated as former members.
    'expired_recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'plan', p.name, 'expiry_date', m.expiry_date) order by m.expiry_date desc)
      from public.members m left join public.plans p on p.id = m.plan_id
      where m.status = 'expired' and m.expiry_date >= current_date - 30), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'phone', m.phone, 'amount', pay.amount,
        'days_waiting', current_date - pay.created_at::date) order by pay.created_at)
      from public.payments pay join public.members m on m.id = pay.member_id
      where pay.status = 'pending'), '[]'::jsonb)
  )
$$;

revoke execute on function public.daily_report() from public, anon;
grant execute on function public.daily_report() to authenticated;
