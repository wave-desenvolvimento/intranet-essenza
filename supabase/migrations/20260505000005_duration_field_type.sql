-- Adicionar tipo 'duration' ao campo field_type
alter table public.cms_fields drop constraint cms_fields_field_type_check;
alter table public.cms_fields add constraint cms_fields_field_type_check check (field_type in (
  'text', 'textarea', 'rich_text', 'number',
  'boolean', 'date', 'datetime',
  'select', 'multi_select',
  'image', 'image_variants', 'file', 'url', 'color', 'email',
  'icon_select', 'collection_ref', 'collection_multi_ref',
  'duration'
));
