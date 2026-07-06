-- Mudar cleanup de diario (3am) para a cada hora
-- Garante que conteudo expirado seja removido do DB rapidamente
do $$ begin
  perform cron.unschedule('cleanup-expired-content');
exception when others then null;
end $$;

select cron.schedule('cleanup-expired-content', '0 * * * *', $$select public.cleanup_expired_content()$$);
