-- Tipo de visualização da collection
alter table public.cms_collections
  add column view_type text not null default 'table'
  check (view_type in ('table', 'gallery', 'files', 'course'));
