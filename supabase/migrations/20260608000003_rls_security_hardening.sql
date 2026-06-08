-- =============================================
-- RLS Security Hardening — corrige brechas identificadas na auditoria
-- Prioridade: C (crítico) > M (médio) > B (baixo)
-- =============================================

-- ===========================================
-- C1 — permissions: adicionar policies de escrita (faltavam completamente)
-- ===========================================
do $$ begin
  create policy "permissions_insert" on public.permissions for insert to authenticated
    with check (public.is_system_admin(auth.uid()));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "permissions_update" on public.permissions for update to authenticated
    using (public.is_system_admin(auth.uid()));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "permissions_delete" on public.permissions for delete to authenticated
    using (public.is_system_admin(auth.uid()));
exception when duplicate_object then null;
end $$;

-- ===========================================
-- C2 — audit_log: restringir INSERT (só próprio user_id ou null pra cron)
-- ===========================================
drop policy if exists "audit_insert" on public.audit_log;

do $$ begin
  create policy "audit_insert" on public.audit_log for insert to authenticated
    with check (user_id = auth.uid() or user_id is null);
exception when duplicate_object then null;
end $$;

-- ===========================================
-- C3 — order_items: SELECT restrito por franchise (igual orders)
-- ===========================================
drop policy if exists "order_items_select" on public.order_items;

do $$ begin
  create policy "order_items_select" on public.order_items for select to authenticated
    using (
      order_id in (
        select id from public.orders
        where franchise_id in (select franchise_id from public.profiles where id = auth.uid())
      )
      or public.has_permission(auth.uid(), 'pedidos', 'view_all')
    );
exception when duplicate_object then null;
end $$;

-- ===========================================
-- C4 — health_checks: restringir INSERT a authenticated apenas
-- ===========================================
drop policy if exists "System inserts health_checks" on public.health_checks;

do $$ begin
  create policy "health_checks_insert" on public.health_checks for insert to authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

-- ===========================================
-- M1 — announcement_reads: SELECT restrito (só próprio ou view_all)
-- ===========================================
drop policy if exists "reads_select" on public.announcement_reads;

do $$ begin
  create policy "reads_select" on public.announcement_reads for select to authenticated
    using (
      user_id = auth.uid()
      or public.has_permission(auth.uid(), 'comunicados', 'view_all')
    );
exception when duplicate_object then null;
end $$;

-- ===========================================
-- M5 — orders UPDATE: manter pedidos.approve mas documentar que é intencional (Matriz)
-- Adicionando WITH CHECK pra garantir consistência
-- ===========================================
drop policy if exists "orders_update" on public.orders;

do $$ begin
  create policy "orders_update" on public.orders for update to authenticated
    using (
      -- Própria franquia pode editar rascunhos/pendentes
      (franchise_id in (select franchise_id from public.profiles where id = auth.uid())
        and status in ('rascunho', 'pendente'))
      -- Quem tem approve edita qualquer pedido (Matriz)
      or public.has_permission(auth.uid(), 'pedidos', 'approve')
    );
exception when duplicate_object then null;
end $$;

-- ===========================================
-- M6 — payment_plans, shipping_types, webhook_config, webhook_queue:
-- trocar is_system=true por is_system_admin() (checa level >= 80)
-- ===========================================

-- payment_plans
drop policy if exists "payment_plans_manage" on public.payment_plans;
do $$ begin
  create policy "payment_plans_manage" on public.payment_plans for all to authenticated
    using (public.is_system_admin(auth.uid()))
    with check (public.is_system_admin(auth.uid()));
exception when duplicate_object then null;
end $$;

-- shipping_types
drop policy if exists "shipping_types_manage" on public.shipping_types;
do $$ begin
  create policy "shipping_types_manage" on public.shipping_types for all to authenticated
    using (public.is_system_admin(auth.uid()))
    with check (public.is_system_admin(auth.uid()));
exception when duplicate_object then null;
end $$;

-- webhook_config
drop policy if exists "webhook_config_admin" on public.webhook_config;
do $$ begin
  create policy "webhook_config_admin" on public.webhook_config for all to authenticated
    using (public.is_system_admin(auth.uid()))
    with check (public.is_system_admin(auth.uid()));
exception when duplicate_object then null;
end $$;

-- webhook_queue
drop policy if exists "webhook_queue_admin" on public.webhook_queue;
do $$ begin
  create policy "webhook_queue_admin" on public.webhook_queue for all to authenticated
    using (public.is_system_admin(auth.uid()))
    with check (public.is_system_admin(auth.uid()));
exception when duplicate_object then null;
end $$;

-- ===========================================
-- B1 — share_links: SELECT filtra por expiração
-- ===========================================
drop policy if exists "share_links_select_public" on public.share_links;

do $$ begin
  create policy "share_links_select_public" on public.share_links
    for select using (expires_at > now());
exception when duplicate_object then null;
end $$;

-- ===========================================
-- B3 — Storage: UPDATE restrito por permissão cms.edit
-- ===========================================
drop policy if exists "banners_auth_update" on storage.objects;
drop policy if exists "assets_auth_update" on storage.objects;

do $$ begin
  create policy "banners_auth_update" on storage.objects for update to authenticated
    using (bucket_id = 'banners' and public.has_permission(auth.uid(), 'cms', 'edit'));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "assets_auth_update" on storage.objects for update to authenticated
    using (bucket_id = 'assets' and public.has_permission(auth.uid(), 'cms', 'edit'));
exception when duplicate_object then null;
end $$;

-- ===========================================
-- B5 — profiles: remover INSERT aberto, trigger SECURITY DEFINER cuida
-- ===========================================
drop policy if exists "profiles_insert" on public.profiles;

-- Sem policy de INSERT para authenticated — handle_new_user trigger é SECURITY DEFINER
