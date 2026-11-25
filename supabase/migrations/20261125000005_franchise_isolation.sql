-- Isolamento entre franquias: tabelas que qualquer autenticado lia ou alterava

-- Franquias (CNPJ, contato, endereco): matriz ve todas, franqueado a propria
drop policy if exists "franchises_select" on public.franchises;
create policy "franchises_select" on public.franchises for select to authenticated
  using ((select public.is_network_staff(auth.uid())) or id = (select public.my_franchise_id()));

-- Leads de revenda
drop policy if exists "reseller_leads_authenticated_select" on public.reseller_leads;
drop policy if exists "reseller_leads_authenticated_update" on public.reseller_leads;
drop policy if exists "reseller_leads_authenticated_delete" on public.reseller_leads;
create policy "reseller_leads_authenticated_select" on public.reseller_leads for select to authenticated
  using (public.has_permission(auth.uid(), 'leads', 'view'));
create policy "reseller_leads_authenticated_update" on public.reseller_leads for update to authenticated
  using (public.has_permission(auth.uid(), 'leads', 'edit')) with check (public.has_permission(auth.uid(), 'leads', 'edit'));
create policy "reseller_leads_authenticated_delete" on public.reseller_leads for delete to authenticated
  using (public.has_permission(auth.uid(), 'leads', 'delete'));

drop policy if exists "lead_notif_emails_select" on public.lead_notification_emails;
create policy "lead_notif_emails_select" on public.lead_notification_emails for select to authenticated
  using (public.has_permission(auth.uid(), 'leads', 'edit'));

-- Suporte: matriz ve tudo; franqueado ve e abre os proprios chamados (pelo e-mail do login)
drop policy if exists "support_tickets_select" on public.support_tickets;
create policy "support_tickets_select" on public.support_tickets for select to authenticated
  using (public.has_permission(auth.uid(), 'suporte', 'edit') or lower(email) = lower(auth.jwt() ->> 'email'));
drop policy if exists "support_tickets_own_insert" on public.support_tickets;
create policy "support_tickets_own_insert" on public.support_tickets for insert to authenticated
  with check (public.has_permission(auth.uid(), 'suporte', 'create') and lower(email) = lower(auth.jwt() ->> 'email') and status = 'novo' and notas is null);
grant insert on public.support_tickets to authenticated;

drop policy if exists "support_notif_emails_select" on public.support_notification_emails;
create policy "support_notif_emails_select" on public.support_notification_emails for select to authenticated
  using (public.has_permission(auth.uid(), 'suporte', 'edit'));

-- Pastas do CMS: mesma permissao que as server actions ja exigem
drop policy if exists "cms_folders_insert" on public.cms_folders;
drop policy if exists "cms_folders_update" on public.cms_folders;
drop policy if exists "cms_folders_delete" on public.cms_folders;
create policy "cms_folders_insert" on public.cms_folders for insert to authenticated
  with check (public.has_permission(auth.uid(), 'cms', 'create'));
create policy "cms_folders_update" on public.cms_folders for update to authenticated
  using (public.has_permission(auth.uid(), 'cms', 'edit'));
create policy "cms_folders_delete" on public.cms_folders for delete to authenticated
  using (public.has_permission(auth.uid(), 'cms', 'delete'));

-- A caixa de chamado do franqueado depende desta permissao
insert into public.permissions (module, action, description) values ('suporte', 'create', 'suporte.create') on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.slug in ('owner', 'admin_franquia', 'usuario_franquia') and p.module = 'suporte' and p.action = 'create'
on conflict do nothing;
