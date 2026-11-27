-- Aula pode ter video, PDF ou os dois
alter table public.course_videos
  add column if not exists pdf_path text,
  add column if not exists pdf_name text;

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/pdf')
where id = 'course-videos'
  and allowed_mime_types is not null
  and not ('application/pdf' = any(allowed_mime_types));

-- Leitura do arquivo: editor de curso ou aula liberada (video ou PDF)
drop policy if exists "course_videos_auth_select" on storage.objects;
create policy "course_videos_auth_select" on storage.objects for select to authenticated
  using (bucket_id = 'course-videos' and (
    public.can_edit_any_course()
    or exists (
      select 1 from public.course_videos v
      where (v.storage_path = name or v.pdf_path = name) and public.course_video_unlocked(v.id)
    )
  ));
