-- Novo tipo de campo: referência a outra collection
alter table public.cms_fields drop constraint cms_fields_field_type_check;
alter table public.cms_fields add constraint cms_fields_field_type_check check (field_type in (
  'text', 'textarea', 'rich_text', 'number',
  'boolean', 'date', 'datetime',
  'select', 'multi_select',
  'image', 'file', 'url', 'color', 'email',
  'icon_select', 'collection_ref'
));
