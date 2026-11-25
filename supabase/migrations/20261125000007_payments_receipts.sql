-- bKash/Nagad payments submitted by members, staff verification, receipt numbers.

alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('cash', 'bkash', 'nagad', 'card', 'bank', 'other'));
alter table public.payments
  add column trx_id text unique check (trx_id ~ '^[A-Z0-9]{6,20}$'),
  add column receipt_no text unique;

create sequence public.receipt_seq;

-- Same as before, plus a receipt number the moment a payment becomes paid.
create or replace function public.payments_fill_period()
returns trigger language plpgsql set search_path = public as $$
declare
  cur_expiry date;
  plan_months int;
begin
  if new.status <> 'paid' then
    return new;
  end if;

  new.paid_on := coalesce(new.paid_on, current_date);
  new.receipt_no := coalesce(new.receipt_no,
    'R-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0'));

  if new.period_end is null then
    select m.expiry_date, p.months into cur_expiry, plan_months
    from public.members m left join public.plans p on p.id = m.plan_id
    where m.id = new.member_id;

    if plan_months is null then
      raise exception 'member % has no plan; cannot compute payment period', new.member_id;
    end if;

    -- Early renewal continues from current expiry; late renewal starts today.
    new.period_start := coalesce(new.period_start,
      case when cur_expiry >= current_date then cur_expiry + 1 else current_date end);
    new.period_end := (new.period_start + make_interval(months => plan_months) - interval '1 day')::date;
  end if;

  return new;
end $$;

-- Requests from the app run as role authenticated. Non-staff (members) may only submit a pending
-- bKash/Nagad payment for their plan price; everything money- or date-related is set by the server.
create function public.payments_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.trx_id := nullif(upper(btrim(new.trx_id)), '');

  if current_user in ('authenticated', 'anon') and not public.is_staff() then
    if new.status = 'paid' then
      raise exception 'only staff can mark a payment paid' using errcode = '42501';
    end if;
    if new.method is distinct from 'bkash' and new.method is distinct from 'nagad' then
      raise exception 'members pay by bKash or Nagad' using errcode = '22023';
    end if;
    if new.trx_id is null then
      raise exception 'transaction ID required' using errcode = '22023';
    end if;
    select p.price into new.amount
    from public.members m join public.plans p on p.id = m.plan_id where m.id = new.member_id;
    if new.amount is null then
      raise exception 'no plan on this membership; ask the front desk' using errcode = '22023';
    end if;
    new.status := 'pending';
    new.period_start := null; new.period_end := null; new.paid_on := null;
    new.receipt_no := null; new.recorded_by := null;
  end if;
  return new;
end $$;

-- Named to sort before payments_fill_period, so the guard runs first.
create trigger payments_a_guard
before insert on public.payments
for each row execute function public.payments_guard();

create policy payments_self_submit on public.payments for insert to authenticated
  with check (member_id = public.my_member_id() and status = 'pending');

grant usage on sequence public.receipt_seq to authenticated;
