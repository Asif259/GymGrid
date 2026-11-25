-- Gym runs on Dhaka time: current_date in every function and default means the gym's date.
-- Takes effect for new connections; set for this session too.
alter database postgres set timezone to 'Asia/Dhaka';
set timezone to 'Asia/Dhaka';

-- One row of gym-wide settings. Members may read the public columns; only the owner edits.
create table public.gym_settings (
  id boolean primary key default true check (id),
  name text not null default 'Our Gym',
  currency text not null default '৳',
  bkash_number text check (bkash_number ~ '^[0-9]{11,13}$'),
  nagad_number text check (nagad_number ~ '^[0-9]{11,13}$'),
  app_url text check (app_url ~ '^https?://'),
  checkin_token text not null default replace(gen_random_uuid()::text, '-', '')
);
insert into public.gym_settings default values;

alter table public.gym_settings enable row level security;
create policy gym_settings_read on public.gym_settings for select to authenticated using (true);
create policy gym_settings_owner_update on public.gym_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Column grants keep checkin_token away from members (and from the REST API entirely).
revoke all on public.gym_settings from anon, authenticated;
grant select (id, name, currency, bkash_number, nagad_number, app_url) on public.gym_settings to authenticated;
grant update (name, currency, bkash_number, nagad_number, app_url) on public.gym_settings to authenticated;

-- Desk QR: staff read the token, owner rotates it (old printed QR stops working).
create function public.checkin_qr_token()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  return (select checkin_token from public.gym_settings);
end $$;

create function public.rotate_checkin_token()
returns text language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  update public.gym_settings set checkin_token = t;
  return t;
end $$;

revoke execute on function public.checkin_qr_token(), public.rotate_checkin_token() from public, anon;
grant execute on function public.checkin_qr_token(), public.rotate_checkin_token() to authenticated;
