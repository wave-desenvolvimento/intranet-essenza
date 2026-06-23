-- CMS Folders: Google Drive-like organization within pages
-- Each folder can have its own collection (schema) or inherit from parent

-- === Table ===
CREATE TABLE public.cms_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'folder',
  page_id UUID NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.cms_folders(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.cms_collections(id) ON DELETE SET NULL,
  view_type TEXT CHECK (view_type IN ('table', 'gallery', 'files')),
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cms_folders_page ON public.cms_folders(page_id);
CREATE INDEX idx_cms_folders_parent ON public.cms_folders(parent_id);

CREATE TRIGGER cms_folders_updated_at
  BEFORE UPDATE ON public.cms_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === RLS ===
ALTER TABLE public.cms_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cms_folders_select" ON public.cms_folders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cms_folders_insert" ON public.cms_folders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cms_folders_update" ON public.cms_folders
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cms_folders_delete" ON public.cms_folders
  FOR DELETE TO authenticated USING (true);

-- === Add folder_id to cms_items ===
ALTER TABLE public.cms_items
  ADD COLUMN folder_id UUID REFERENCES public.cms_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_cms_items_folder ON public.cms_items(folder_id);

-- === Helper: resolve effective collection_id walking up the tree ===
CREATE OR REPLACE FUNCTION public.resolve_folder_collection(p_folder_id UUID)
RETURNS UUID
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_collection_id UUID;
  v_parent_id UUID;
  v_current_id UUID := p_folder_id;
  v_depth INT := 0;
BEGIN
  LOOP
    SELECT f.collection_id, f.parent_id
      INTO v_collection_id, v_parent_id
      FROM public.cms_folders f
     WHERE f.id = v_current_id;

    IF NOT FOUND THEN RETURN NULL; END IF;
    IF v_collection_id IS NOT NULL THEN RETURN v_collection_id; END IF;
    IF v_parent_id IS NULL THEN RETURN NULL; END IF;

    v_current_id := v_parent_id;
    v_depth := v_depth + 1;
    IF v_depth > 20 THEN RETURN NULL; END IF; -- safety
  END LOOP;
END;
$$;
