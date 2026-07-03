-- Add tags column to cms_items for asset categorization and search
alter table public.cms_items add column tags text[] not null default '{}';

-- GIN index for fast array containment queries (@> and &&)
create index idx_cms_items_tags on public.cms_items using gin (tags);
