CREATE TABLE public.lead_notification_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_notification_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_notif_emails_select" ON public.lead_notification_emails
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lead_notif_emails_insert" ON public.lead_notification_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'leads', 'edit'));

CREATE POLICY "lead_notif_emails_delete" ON public.lead_notification_emails
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'leads', 'edit'));

GRANT SELECT, INSERT, DELETE ON public.lead_notification_emails TO authenticated;

-- Trigger: notify on new lead insert via pg_net
CREATE OR REPLACE FUNCTION public.on_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.site_url', true) || '/api/leads/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object(
      'nome', NEW.nome,
      'email', NEW.email,
      'telefone', NEW.telefone,
      'cidade', NEW.cidade,
      'estado', NEW.estado,
      'origem', NEW.origem
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the insert if notification fails
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_lead_notify
  AFTER INSERT ON public.reseller_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_lead();
