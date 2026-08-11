-- Bucket privado para videos de curso (limite 500MB, apenas video/*)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-videos',
  'course-videos',
  false,
  524288000, -- 500MB
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
);

-- RLS: apenas usuarios autenticados podem ler e gravar
create policy "course_videos_auth_select" on storage.objects
  for select to authenticated using (bucket_id = 'course-videos');

create policy "course_videos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'course-videos');

create policy "course_videos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'course-videos');

create policy "course_videos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'course-videos');
