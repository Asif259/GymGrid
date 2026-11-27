-- Follow-up hardening from the run-2 audit.

-- Members see only their own trainer's gym_staff row (not every staff user id in the gym).
drop policy if exists gym_staff_read on public.gym_staff;
create policy gym_staff_read on public.gym_staff for select to authenticated
  using (
    gym_id in (select public.get_my_gym_ids())
    or exists (
      select 1 from public.members m
      where m.auth_user_id = auth.uid()
        and m.gym_id = gym_staff.gym_id
        and m.trainer_id = gym_staff.user_id
    )
  );

-- gym-logos: public URLs keep working without a SELECT policy; stop anonymous listing of gym ids.
do $$ begin
  execute $p$drop policy if exists gym_logos_public_read on storage.objects$p$;
  execute $p$create policy gym_logos_owner_read on storage.objects for select to authenticated
    using (
      bucket_id = 'gym-logos'
      and (storage.foldername(name))[1] in (select g.id::text from public.gyms g where public.is_gym_owner(g.id))
    )$p$;
  update storage.buckets
    set file_size_limit = 5242880,
        allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg']
    where id = 'gym-logos';
  update storage.buckets
    set file_size_limit = 2097152, allowed_mime_types = array['application/pdf']
    where id = 'receipts';
end $$;
