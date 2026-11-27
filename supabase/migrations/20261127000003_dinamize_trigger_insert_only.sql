-- Envio para a Dinamize so no INSERT: o receiver trata todo POST como lead novo,
-- entao disparar no UPDATE (mudanca de status na intranet) duplicava oportunidade no CRM.
-- Ja aplicado direto em prod em 2026-11-27; esta migration so versiona.
drop trigger if exists trg_enqueue_lead_webhook on public.reseller_leads;

create trigger trg_enqueue_lead_webhook
  after insert on public.reseller_leads
  for each row execute function public.enqueue_lead_webhook();
