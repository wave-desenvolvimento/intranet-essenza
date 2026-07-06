-- Fix cleanup: skip storage deletion (Supabase protects direct deletes on storage.objects)
-- Just remove DB records, storage files become orphaned but items are properly cleaned

create or replace function public.cleanup_expired_content()
returns void as $$
declare
  v_deleted_items int := 0;
  v_deleted_announcements int := 0;
  v_deleted_links int := 0;
begin
  -- 1. CMS Items expirados
  delete from public.cms_items
  where expires_at is not null and expires_at < now();
  get diagnostics v_deleted_items = row_count;

  -- 2. Announcements expirados
  delete from public.announcements
  where expires_at is not null and expires_at < now();
  get diagnostics v_deleted_announcements = row_count;

  -- 3. Share links expirados
  delete from public.share_links where expires_at < now();
  get diagnostics v_deleted_links = row_count;

  -- Log se algo foi deletado
  if v_deleted_items > 0 or v_deleted_announcements > 0 or v_deleted_links > 0 then
    insert into public.audit_log (user_id, user_name, action, entity_type, description)
    values (
      null,
      'Sistema (cron)',
      'delete',
      'cleanup',
      format('Limpeza automatica: %s itens CMS, %s comunicados, %s links removidos',
        v_deleted_items, v_deleted_announcements, v_deleted_links)
    );
  end if;
end;
$$ language plpgsql security definer;
