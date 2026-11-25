-- QR attendance: member scans the desk QR (members app calls check_in), or staff checks them in.

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  day date not null default current_date,
  checked_in_at timestamptz not null default now(),
  status_at_checkin text not null default 'due',
  method text not null default 'qr' check (method in ('qr', 'staff')),
  recorded_by uuid references auth.users,
  unique (member_id, day)
);
create index on public.attendance (day);

-- Snapshot the membership status, so "came in while unpaid" survives a later payment.
create function public.attendance_set_status()
returns trigger language plpgsql set search_path = public as $$
begin
  select status into new.status_at_checkin from public.members where id = new.member_id;
  return new;
end $$;

create trigger attendance_set_status
before insert on public.attendance
for each row execute function public.attendance_set_status();

alter table public.attendance enable row level security;
create policy attendance_staff on public.attendance for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy attendance_self_read on public.attendance for select to authenticated
  using (member_id = public.my_member_id());

grant select, insert, update, delete on public.attendance to authenticated;

-- Member check-in. The token is only printed on the desk QR, so checking in means being at the gym.
-- Expired members are still recorded (that is the point: the owner sees who comes without paying).
create function public.check_in(token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m record;
  added int;
begin
  if token is null or token <> (select checkin_token from public.gym_settings) then
    raise exception 'invalid check-in code; scan the QR at the front desk' using errcode = '22023';
  end if;
  select id, name, status, expiry_date into m from public.members where auth_user_id = auth.uid();
  if not found then
    raise exception 'this account is not linked to a membership' using errcode = '42501';
  end if;
  insert into public.attendance (member_id, method) values (m.id, 'qr') on conflict (member_id, day) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('name', m.name, 'status', m.status, 'expiry_date', m.expiry_date, 'already', added = 0);
end $$;

revoke execute on function public.check_in(text) from public, anon;
grant execute on function public.check_in(text) to authenticated;
