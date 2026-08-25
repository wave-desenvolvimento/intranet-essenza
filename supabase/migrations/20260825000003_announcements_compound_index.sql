-- Index composto para ORDER BY priority DESC, created_at DESC (usado no /inicio)
create index if not exists idx_announcements_priority_created
  on public.announcements(priority desc, created_at desc);
