-- Store site_url and auth secret in Vault for use by pg_cron/pg_net triggers
-- Insert secrets via Supabase Dashboard SQL Editor:
--
--   SELECT vault.create_secret('https://intranet-essenza.vercel.app', 'internal_site_url');
--   SELECT vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'internal_api_key');

-- Helper: read a vault secret by name
CREATE OR REPLACE FUNCTION public.get_vault_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
$$;

-- Recreate on_new_lead to use vault
CREATE OR REPLACE FUNCTION public.on_new_lead()
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
    url := v_url || '/api/leads/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
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
  RETURN NEW;
END;
$$;

-- Update email-reminders cron to use vault
SELECT cron.unschedule('email-reminders');
SELECT cron.schedule(
  'email-reminders',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := public.get_vault_secret('internal_site_url') || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_vault_secret('internal_api_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
