-- Outbox: each member/payment change worth automating (email, receipt PDF, Sheet sync) becomes one row.
-- The automation function (migration 19, hosted only) picks rows up and records status, attempts and the last error.
create table public.automation_events (
  id bigserial primary key,
  kind text not null,
  member_id uuid references public.members on delete cascade,
  payment_id uuid references public.payments on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index on public.automation_events (status, created_at);

alter table public.automation_events enable row level security;
create policy automation_events_staff_read on public.automation_events for select to authenticated
  using (public.is_staff());
revoke all on public.automation_events from anon, authenticated;
grant select on public.automation_events to authenticated;

-- Security definer: a member's own payment insert must still be able to queue its event.
create function public.members_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.automation_events (kind, member_id)
  values (case tg_op when 'INSERT' then 'member.created' else 'member.updated' end, new.id);
  return null;
end $$;

create trigger members_outbox_insert after insert on public.members
for each row execute function public.members_outbox();
create trigger members_outbox_update after update of email, plan_id, status, expiry_date on public.members
for each row when (row(old.email, old.plan_id, old.status, old.expiry_date) is distinct from
                   row(new.email, new.plan_id, new.status, new.expiry_date))
execute function public.members_outbox();

create function public.payments_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.automation_events (kind, member_id, payment_id)
  values (case when new.status = 'paid' then 'payment.paid' else 'payment.created' end, new.member_id, new.id);
  return null;
end $$;

create trigger payments_outbox_insert after insert on public.payments
for each row execute function public.payments_outbox();
create trigger payments_outbox_paid after update of status on public.payments
for each row when (old.status <> 'paid' and new.status = 'paid')
execute function public.payments_outbox();

revoke execute on function public.members_outbox(), public.payments_outbox() from public, anon, authenticated;

-- One renewal reminder per member per day.
create table public.reminder_log (
  member_id uuid not null references public.members on delete cascade,
  day date not null default current_date,
  sent_at timestamptz not null default now(),
  unique (member_id, day)
);
alter table public.reminder_log enable row level security;
create policy reminder_log_staff_read on public.reminder_log for select to authenticated using (public.is_staff());
revoke all on public.reminder_log from anon, authenticated;
grant select on public.reminder_log to authenticated;

-- Automation settings. Owner edits them (policy gym_settings_owner_update); members must not read the digest email,
-- so no select grant: staff read them through automation_settings().
alter table public.gym_settings
  add column sheet_id text check (sheet_id ~ '^[A-Za-z0-9_-]{20,}$'),
  add column owner_digest_email text check (owner_digest_email = lower(btrim(owner_digest_email)));
grant update (sheet_id, owner_digest_email) on public.gym_settings to authenticated;

create function public.automation_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return (select jsonb_build_object('sheet_id', sheet_id, 'owner_digest_email', owner_digest_email) from public.gym_settings);
end $$;
revoke execute on function public.automation_settings() from public, anon;
grant execute on function public.automation_settings() to authenticated;
