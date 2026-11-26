-- AI workout & diet plans: member intake columns, plan source tracking, and owner-configured AI providers (Vault-backed).
-- No key column on ai_providers; keys live in Supabase Vault and are decrypted only by service_role.

alter table public.members
  add column goal_weight_kg numeric(5, 1) check (goal_weight_kg between 25 and 300),
  add column level text check (level in ('beginner', 'intermediate', 'advanced')),
  add column days_per_week int check (days_per_week between 2 and 6),
  add column equipment text check (equipment in ('full_gym', 'dumbbells', 'bodyweight')),
  add column activity text check (activity in ('sedentary', 'light', 'moderate', 'active')),
  add column allergies text check (char_length(allergies) <= 300);

alter table public.workout_plans
  add column source text not null default 'staff' check (source in ('staff', 'ai'));

alter table public.diet_plans
  add column source text not null default 'staff' check (source in ('staff', 'ai'));

create index workout_plans_member_source_created_idx
  on public.workout_plans (member_id, source, created_at desc);

create index diet_plans_member_source_created_idx
  on public.diet_plans (member_id, source, created_at desc);

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms on delete cascade,
  kind text not null check (kind in ('gemini', 'openai_compat')),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  base_url text check (base_url is null or (base_url ~ '^https://' and char_length(base_url) <= 300)),
  model text not null check (char_length(btrim(model)) between 1 and 120),
  secret_id uuid not null,
  enabled boolean not null default true,
  priority int not null default 0,
  cooldown_until timestamptz,
  last_error text,
  key_hint text not null check (char_length(key_hint) <= 8),
  created_at timestamptz not null default now()
);

create index ai_providers_gym_priority_idx
  on public.ai_providers (gym_id, priority asc, created_at asc);

alter table public.ai_providers enable row level security;

-- Owners of that gym can select metadata only; no client insert/update/delete.
create policy ai_providers_owner_read on public.ai_providers for select to authenticated
  using (public.is_gym_owner(gym_id));

revoke all on public.ai_providers from public, anon, authenticated;
grant select on public.ai_providers to authenticated;

-- ---------- owner RPCs (Vault-backed) ----------

create function public.save_ai_provider(
  p_gym_id uuid,
  p_kind text,
  p_label text,
  p_base_url text,
  p_model text,
  p_api_key text default null,
  p_enabled boolean default true,
  p_priority int default null,
  p_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_label text := btrim(coalesce(p_label, ''));
  v_model text := btrim(coalesce(p_model, ''));
  v_url text := nullif(btrim(coalesce(p_base_url, '')), '');
  v_key text := nullif(btrim(coalesce(p_api_key, '')), '');
  v_secret_id uuid;
  v_old_secret_id uuid;
  v_priority int;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_gym_owner(p_gym_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  if p_kind not in ('gemini', 'openai_compat') then
    raise exception 'invalid provider kind' using errcode = '22023';
  end if;
  if char_length(v_label) not between 1 and 80 then
    raise exception 'label is required (max 80 chars)' using errcode = '22023';
  end if;
  if char_length(v_model) not between 1 and 120 then
    raise exception 'model is required (max 120 chars)' using errcode = '22023';
  end if;
  if p_kind = 'openai_compat' and v_url is null then
    raise exception 'base_url is required for OpenAI-compatible providers' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~ '^https://' or char_length(v_url) > 300) then
    raise exception 'base_url must be https and at most 300 chars' using errcode = '22023';
  end if;

  if p_id is null then
    if v_key is null or char_length(v_key) < 8 then
      raise exception 'API key is required' using errcode = '22023';
    end if;
    select vault.create_secret(
      v_key,
      'ai_provider_' || gen_random_uuid()::text,
      'AI provider key for gym ' || p_gym_id::text
    ) into v_secret_id;

    v_priority := coalesce(
      p_priority,
      (select coalesce(max(priority) + 1, 0) from public.ai_providers where gym_id = p_gym_id)
    );

    insert into public.ai_providers (
      gym_id, kind, label, base_url, model, secret_id, enabled, priority, key_hint
    )
    values (
      p_gym_id, p_kind, v_label, v_url, v_model, v_secret_id, coalesce(p_enabled, true), v_priority, right(v_key, 4)
    )
    returning id into v_id;
    return v_id;
  end if;

  select secret_id into v_old_secret_id
  from public.ai_providers
  where id = p_id and gym_id = p_gym_id;
  if not found then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;

  if v_key is not null then
    if char_length(v_key) < 8 then
      raise exception 'API key is too short' using errcode = '22023';
    end if;
    select vault.create_secret(
      v_key,
      'ai_provider_' || gen_random_uuid()::text,
      'AI provider key for gym ' || p_gym_id::text
    ) into v_secret_id;

    update public.ai_providers
    set kind = p_kind,
        label = v_label,
        base_url = v_url,
        model = v_model,
        secret_id = v_secret_id,
        key_hint = right(v_key, 4),
        enabled = coalesce(p_enabled, enabled),
        priority = coalesce(p_priority, priority),
        cooldown_until = null,
        last_error = null
    where id = p_id and gym_id = p_gym_id;

    delete from vault.secrets where id = v_old_secret_id;
  else
    update public.ai_providers
    set kind = p_kind,
        label = v_label,
        base_url = v_url,
        model = v_model,
        enabled = coalesce(p_enabled, enabled),
        priority = coalesce(p_priority, priority),
        cooldown_until = null,
        last_error = null
    where id = p_id and gym_id = p_gym_id;
  end if;

  return p_id;
end $$;

create function public.set_ai_provider(
  p_id uuid,
  p_enabled boolean default null,
  p_priority int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.ai_providers where id = p_id;
  if v_gym_id is null then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_gym_owner(v_gym_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.ai_providers
  set enabled = coalesce(p_enabled, enabled),
      priority = coalesce(p_priority, priority)
  where id = p_id;
end $$;

create function public.delete_ai_provider(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_gym_id uuid;
  v_secret_id uuid;
begin
  select gym_id, secret_id into v_gym_id, v_secret_id
  from public.ai_providers where id = p_id;
  if v_gym_id is null then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_gym_owner(v_gym_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  delete from public.ai_providers where id = p_id;
  delete from vault.secrets where id = v_secret_id;
end $$;

-- Service-role-only key decryption for edge functions.
create function public.get_ai_provider_key(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_secret_id uuid;
  v_key text;
begin
  select secret_id into v_secret_id from public.ai_providers where id = p_id;
  if v_secret_id is null then return null; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where id = v_secret_id;
  return v_key;
end $$;

revoke execute on function
  public.save_ai_provider(uuid, text, text, text, text, text, boolean, int, uuid),
  public.set_ai_provider(uuid, boolean, int),
  public.delete_ai_provider(uuid),
  public.get_ai_provider_key(uuid)
from public, anon, authenticated;

grant execute on function
  public.save_ai_provider(uuid, text, text, text, text, text, boolean, int, uuid),
  public.set_ai_provider(uuid, boolean, int),
  public.delete_ai_provider(uuid)
to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant update (
      goal, age, sex, height_cm, weight_kg, goal_weight_kg,
      level, days_per_week, equipment, activity,
      injuries, diet_pref, allergies
    ) on public.members to service_role;
    grant select, insert on public.workout_plans, public.diet_plans to service_role;
    grant select on public.ai_providers to service_role;
    grant update (cooldown_until, last_error) on public.ai_providers to service_role;
    grant execute on function public.get_ai_provider_key(uuid) to service_role;
  end if;
end $$;
