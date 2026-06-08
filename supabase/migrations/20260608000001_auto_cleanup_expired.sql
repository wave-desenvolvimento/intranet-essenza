-- =============================================
-- Auto-cleanup de conteudo expirado
-- Remove cms_items, announcements e share_links expirados
-- Limpa arquivos do Storage automaticamente
-- Roda via pg_cron a cada hora
-- =============================================

create or replace function public.cleanup_expired_content()
returns void as $$
declare
  v_item record;
  v_data jsonb;
  v_key text;
  v_val text;
  v_bucket text;
  v_path text;
  v_deleted_items int := 0;
  v_deleted_announcements int := 0;
  v_deleted_links int := 0;
  v_deleted_files int := 0;
begin
  -- ==========================================
  -- 1. CMS Items expirados
  -- ==========================================
  for v_item in
    select id, data from public.cms_items
    where expires_at is not null and expires_at < now()
  loop
    v_data := v_item.data::jsonb;

    -- Extrair URLs de storage do JSONB e deletar arquivos
    for v_key, v_val in
      select key, value::text from jsonb_each_text(v_data)
      where value::text like '%/storage/v1/object/public/%'
    loop
      -- Extrair bucket e path da URL
      v_bucket := (regexp_match(v_val, '/storage/v1/object/public/([^/]+)/(.+)$'))[1];
      v_path := (regexp_match(v_val, '/storage/v1/object/public/([^/]+)/(.+)$'))[2];
      if v_bucket is not null and v_path is not null then
        delete from storage.objects where bucket_id = v_bucket and name = v_path;
        v_deleted_files := v_deleted_files + 1;
      end if;
    end loop;

    -- Verificar arrays no JSONB (image_array, file_array)
    for v_key in select key from jsonb_each(v_data) where jsonb_typeof(v_data->key) = 'array'
    loop
      declare
        v_elem jsonb;
        v_url text;
      begin
        for v_elem in select jsonb_array_elements(v_data->v_key)
        loop
          v_url := v_elem->>'url';
          if v_url is not null and v_url like '%/storage/v1/object/public/%' then
            v_bucket := (regexp_match(v_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[1];
            v_path := (regexp_match(v_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[2];
            if v_bucket is not null and v_path is not null then
              delete from storage.objects where bucket_id = v_bucket and name = v_path;
              v_deleted_files := v_deleted_files + 1;
            end if;
          end if;
        end loop;
      exception when others then null; -- skip non-array values
      end;
    end loop;

    -- Verificar image_variants (object com URLs)
    for v_key in select key from jsonb_each(v_data) where jsonb_typeof(v_data->key) = 'object'
    loop
      declare
        v_variant_key text;
        v_variant_url text;
      begin
        for v_variant_key, v_variant_url in select key, value::text from jsonb_each_text(v_data->v_key)
        loop
          if v_variant_url like '%/storage/v1/object/public/%' then
            v_bucket := (regexp_match(v_variant_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[1];
            v_path := (regexp_match(v_variant_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[2];
            if v_bucket is not null and v_path is not null then
              delete from storage.objects where bucket_id = v_bucket and name = v_path;
              v_deleted_files := v_deleted_files + 1;
            end if;
          end if;
        end loop;
      exception when others then null;
      end;
    end loop;

    -- Deletar o item
    delete from public.cms_items where id = v_item.id;
    v_deleted_items := v_deleted_items + 1;
  end loop;

  -- ==========================================
  -- 2. Announcements expirados (com banner)
  -- ==========================================
  for v_item in
    select id, banner_url from public.announcements
    where expires_at is not null and expires_at < now()
  loop
    -- Deletar banner do storage se existir
    if v_item.banner_url is not null and v_item.banner_url like '%/storage/v1/object/public/%' then
      v_bucket := (regexp_match(v_item.banner_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[1];
      v_path := (regexp_match(v_item.banner_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[2];
      if v_bucket is not null and v_path is not null then
        delete from storage.objects where bucket_id = v_bucket and name = v_path;
        v_deleted_files := v_deleted_files + 1;
      end if;
    end if;

    delete from public.announcements where id = v_item.id;
    v_deleted_announcements := v_deleted_announcements + 1;
  end loop;

  -- ==========================================
  -- 3. Share links expirados
  -- ==========================================
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
      format('Limpeza automática: %s itens CMS, %s comunicados, %s links, %s arquivos removidos',
        v_deleted_items, v_deleted_announcements, v_deleted_links, v_deleted_files)
    );
  end if;
end;
$$ language plpgsql security definer;

-- Agendar pg_cron: rodar 1x por dia as 3h da manha
do $$ begin
  perform cron.unschedule('cleanup-expired-content');
exception when others then null;
end $$;

select cron.schedule('cleanup-expired-content', '0 3 * * *', $$select public.cleanup_expired_content()$$);
