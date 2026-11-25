-- Receipt PDFs live in a private bucket at receipts/<member_id>/<payment_id>.pdf.
alter table public.payments add column receipt_path text;

-- Storage exists on Supabase only; skip it where the schema is missing (local PGlite tests).
do $$
begin
  if to_regnamespace('storage') is null then return; end if;
  insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
  execute $p$create policy receipts_staff_read on storage.objects for select to authenticated
    using (bucket_id = 'receipts' and public.is_staff())$p$;
  execute $p$create policy receipts_member_read on storage.objects for select to authenticated
    using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.my_member_id()::text)$p$;
end $$;
