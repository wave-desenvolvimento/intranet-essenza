-- Add cover image to folders
ALTER TABLE public.cms_folders
  ADD COLUMN cover_url TEXT;
