-- Storage isolation for receipts (per gym) and public gym-logos bucket (owner write/delete only).
-- Guarded with to_regnamespace('storage') so local PGlite tests without Storage schema still succeed.

do $$
begin
  if to_regnamespace('storage') is null then return; end if;

  insert into storage.buckets (id, name, public)
  values ('gym-logos', 'gym-logos', true)
  on conflict (id) do nothing;

  execute $p$drop policy if exists receipts_staff_read on storage.objects$p$;
  execute $p$drop policy if exists receipts_member_read on storage.objects$p$;

  execute $p$create policy receipts_staff_read on storage.objects for select to authenticated
    using (
      bucket_id = 'receipts'
      and exists (
        select 1 from public.members m
        where (storage.foldername(name))[1] = m.id::text
          and m.gym_id in (select public.get_my_gym_ids())
      )
    )$p$;

  execute $p$create policy receipts_member_read on storage.objects for select to authenticated
    using (
      bucket_id = 'receipts'
      and (storage.foldername(name))[1] in (select id::text from public.my_member_ids() as id)
    )$p$;

  execute $p$drop policy if exists gym_logos_public_read on storage.objects$p$;
  execute $p$drop policy if exists gym_logos_owner_insert on storage.objects$p$;
  execute $p$drop policy if exists gym_logos_owner_update on storage.objects$p$;
  execute $p$drop policy if exists gym_logos_owner_delete on storage.objects$p$;

  execute $p$create policy gym_logos_public_read on storage.objects for select
    using (bucket_id = 'gym-logos')$p$;

  execute $p$create policy gym_logos_owner_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'gym-logos'
      and (storage.foldername(name))[1] in (
        select g.id::text from public.gyms g
        where public.is_gym_owner(g.id)
      )
    )$p$;

  execute $p$create policy gym_logos_owner_update on storage.objects for update to authenticated
    using (
      bucket_id = 'gym-logos'
      and (storage.foldername(name))[1] in (
        select g.id::text from public.gyms g
        where public.is_gym_owner(g.id)
      )
    )$p$;

  execute $p$create policy gym_logos_owner_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'gym-logos'
      and (storage.foldername(name))[1] in (
        select g.id::text from public.gyms g
        where public.is_gym_owner(g.id)
      )
    )$p$;
end $$;
