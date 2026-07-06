-- RPC para busca de CMS items por texto (data + tags)
-- PostgREST não suporta casting ::text em filtros ilike para jsonb/text[]
CREATE OR REPLACE FUNCTION search_cms_items(
  search_term text,
  filter_collection_ids uuid[] DEFAULT NULL,
  filter_status text DEFAULT NULL,
  result_limit int DEFAULT 20
)
RETURNS TABLE (id uuid, data jsonb, collection_id uuid, status text)
LANGUAGE sql STABLE
AS $$
  SELECT ci.id, ci.data, ci.collection_id, ci.status
  FROM cms_items ci
  WHERE (
    ci.data::text ILIKE '%' || search_term || '%'
    OR ci.tags::text ILIKE '%' || search_term || '%'
  )
  AND (filter_collection_ids IS NULL OR ci.collection_id = ANY(filter_collection_ids))
  AND (filter_status IS NULL OR ci.status = filter_status)
  ORDER BY ci.created_at DESC
  LIMIT result_limit;
$$;
