-- Support tickets (public form + internal management)
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  tipo text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('acesso', 'senha', 'outro')),
  descricao text NOT NULL,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_andamento', 'resolvido')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created ON public.support_tickets(created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER set_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (public form)
CREATE POLICY "support_tickets_anon_insert" ON public.support_tickets
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated can read/update/delete
CREATE POLICY "support_tickets_select" ON public.support_tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "support_tickets_update" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'suporte', 'edit'));

CREATE POLICY "support_tickets_delete" ON public.support_tickets
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'suporte', 'delete'));

GRANT INSERT ON public.support_tickets TO anon;
GRANT SELECT, UPDATE, DELETE ON public.support_tickets TO authenticated;

-- Notification emails (same pattern as leads)
CREATE TABLE public.support_notification_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_notification_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_notif_emails_select" ON public.support_notification_emails
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "support_notif_emails_insert" ON public.support_notification_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'suporte', 'edit'));

CREATE POLICY "support_notif_emails_delete" ON public.support_notification_emails
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'suporte', 'edit'));

GRANT SELECT, INSERT, DELETE ON public.support_notification_emails TO authenticated;

-- Trigger: notify on new ticket via pg_net
CREATE OR REPLACE FUNCTION public.on_new_support_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := public.get_vault_secret('internal_site_url');
  v_key := public.get_vault_secret('internal_api_key');

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/api/support/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'nome', NEW.nome,
      'email', NEW.email,
      'tipo', NEW.tipo,
      'descricao', NEW.descricao
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_support_ticket_notify
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_support_ticket();

-- Register sidebar entry (system page)
INSERT INTO public.cms_pages (title, slug, icon, page_type, href, module, required_action, sort_order, is_group, parent_id)
VALUES ('Suporte', 'suporte', 'headset', 'system', '/suporte', 'suporte', 'view', 55, false,
  (SELECT id FROM public.cms_pages WHERE slug = 'comercial' LIMIT 1));

-- If 'comercial' group doesn't exist, set parent_id to null
UPDATE public.cms_pages SET parent_id = NULL WHERE slug = 'suporte' AND parent_id IS NULL;

-- Permissions
INSERT INTO public.permissions (module, action, description) VALUES
  ('suporte', 'view', 'Ver tickets de suporte'),
  ('suporte', 'edit', 'Editar tickets de suporte'),
  ('suporte', 'delete', 'Remover tickets de suporte')
ON CONFLICT (module, action) DO NOTHING;

-- Owner gets all support permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'owner' AND p.module = 'suporte'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
)
ON CONFLICT DO NOTHING;
