-- Customizable per-gym unique member IDs (e.g. MM-102, MS-221, FIT-001-26).
-- Owner configures prefix (start), next number, zero-pad digits, and suffix (end) on gyms.
-- Generated atomically on member insert via BEFORE INSERT trigger.

alter table public.gyms
  add column member_code_prefix text not null default 'MM-'
    check (member_code_prefix ~ '^[A-Za-z0-9_-]{0,16}$'),
  add column member_code_suffix text not null default ''
    check (member_code_suffix ~ '^[A-Za-z0-9_-]{0,16}$'),
  add column member_code_next int not null default 1
    check (member_code_next between 1 and 9999999),
  add column member_code_digits int not null default 3
    check (member_code_digits between 0 and 6);

alter table public.members
  add column member_code text;

-- Backfill existing members per gym in creation order (MM-001, MM-002, ...)
with numbered as (
  select
    id,
    gym_id,
    row_number() over (partition by gym_id order by created_at asc, id asc) as rn
  from public.members
)
update public.members m
set member_code = 'MM-' || lpad(n.rn::text, 3, '0')
from numbered n
where m.id = n.id
  and (m.member_code is null or btrim(m.member_code) = '');

-- Advance each gym's member_code_next past backfilled members
update public.gyms g
set member_code_next = greatest(
  g.member_code_next,
  coalesce((select count(*)::int + 1 from public.members m where m.gym_id = g.id), 1)
);

alter table public.members
  alter column member_code set not null,
  add constraint members_member_code_format check (member_code ~ '^[A-Za-z0-9_-]{1,40}$'),
  add constraint members_gym_id_member_code_key unique (gym_id, member_code);

create index members_gym_code_idx on public.members (gym_id, member_code);

create or replace function public.members_assign_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prefix text;
  v_suffix text;
  v_next int;
  v_digits int;
  v_num text;
  v_candidate text;
begin
  if new.member_code is not null and btrim(new.member_code) <> '' then
    new.member_code := btrim(new.member_code);
    return new;
  end if;

  select member_code_prefix, member_code_suffix, member_code_next, member_code_digits
    into v_prefix, v_suffix, v_next, v_digits
  from public.gyms
  where id = new.gym_id
  for update;

  v_prefix := coalesce(v_prefix, 'MM-');
  v_suffix := coalesce(v_suffix, '');
  v_next := greatest(coalesce(v_next, 1), 1);
  v_digits := coalesce(v_digits, 3);

  loop
    v_num := case when v_digits > 0 then lpad(v_next::text, v_digits, '0') else v_next::text end;
    v_candidate := v_prefix || v_num || v_suffix;
    exit when not exists (
      select 1 from public.members m
      where m.gym_id = new.gym_id and m.member_code = v_candidate
    );
    v_next := v_next + 1;
  end loop;

  update public.gyms
  set member_code_next = v_next + 1
  where id = new.gym_id;

  new.member_code := v_candidate;
  return new;
end $$;

revoke execute on function public.members_assign_code() from public, anon, authenticated;

create trigger members_assign_code
before insert on public.members
for each row execute function public.members_assign_code();

grant select (
  member_code_prefix, member_code_suffix, member_code_next, member_code_digits
) on public.gyms to authenticated;

grant update (
  member_code_prefix, member_code_suffix, member_code_next, member_code_digits
) on public.gyms to authenticated;
