-- Bucket: banners
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
);

-- Bucket: assets (genérico pra CMS)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml', 'application/pdf']
);

-- RLS: public read, authenticated write
create policy "banners_public_read" on storage.objects for select using (bucket_id = 'banners');
create policy "banners_auth_insert" on storage.objects for insert to authenticated with check (bucket_id = 'banners');
create policy "banners_auth_update" on storage.objects for update to authenticated using (bucket_id = 'banners');
create policy "banners_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'banners');

create policy "assets_public_read" on storage.objects for select using (bucket_id = 'assets');
create policy "assets_auth_insert" on storage.objects for insert to authenticated with check (bucket_id = 'assets');
create policy "assets_auth_update" on storage.objects for update to authenticated using (bucket_id = 'assets');
create policy "assets_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'assets');
