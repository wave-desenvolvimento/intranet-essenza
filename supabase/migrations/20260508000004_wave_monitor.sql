-- =============================================
-- WaveMonitor: Status page interno
-- =============================================

-- Extension para HTTP requests do PostgreSQL
create extension if not exists pg_net with schema extensions;

-- Config settings para alertas (atualizar com valores reais)
-- Usar: ALTER DATABASE postgres SET app.site_url = 'https://intranet-essenza.vercel.app';
-- Usar: ALTER DATABASE postgres SET app.service_role_key = 'sua_key';


-- Monitors: endpoints a serem monitorados
create table public.monitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_name text not null default 'Geral',
  description text,
  url text not null,
  method text not null default 'GET',
  headers jsonb default '{}',
  expected_status int not null default 200,
  interval_minutes int not null default 5,
  is_active boolean not null default true,
  current_status text not null default 'unknown', -- 'up', 'down', 'unknown'
  last_checked_at timestamptz,
  last_status_change_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Health checks: histórico de cada ping
create table public.health_checks (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  status_code int,
  latency_ms int,
  is_up boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_health_checks_monitor_created on public.health_checks(monitor_id, created_at desc);
create index idx_health_checks_created on public.health_checks(created_at desc);
create index idx_monitors_active on public.monitors(is_active) where is_active = true;

-- RLS
alter table public.monitors enable row level security;
alter table public.health_checks enable row level security;

-- Monitors: admins podem tudo, qualquer um lê (status page é pública)
create policy "Anyone can read monitors" on public.monitors for select using (true);
create policy "Admins manage monitors" on public.monitors for all using (public.is_system_admin(auth.uid()));

-- Health checks: qualquer um lê, sistema insere
create policy "Anyone can read health_checks" on public.health_checks for select using (true);
create policy "System inserts health_checks" on public.health_checks for insert with check (true);

-- Status reports: relatórios de problemas enviados pela status page
create table public.status_reports (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  message text not null,
  service text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.status_reports enable row level security;
create policy "Admins read status_reports" on public.status_reports for select using (public.is_system_admin(auth.uid()));
create policy "Anyone can insert status_reports" on public.status_reports for insert with check (true);

-- =============================================
-- Função que executa os health checks via pg_net
-- =============================================
create or replace function public.run_health_checks()
returns void
language plpgsql
security definer
as $$
declare
  mon record;
  req_id bigint;
begin
  for mon in
    select id, url, method, headers, expected_status
    from public.monitors
    where is_active = true
  loop
    -- Dispara HTTP request assíncrono via pg_net
    if mon.method = 'GET' then
      select net.http_get(
        url := mon.url,
        headers := mon.headers
      ) into req_id;
    else
      select net.http_post(
        url := mon.url,
        headers := mon.headers,
        body := '{}'::jsonb
      ) into req_id;
    end if;
  end loop;
end;
$$;

-- =============================================
-- Função que processa respostas do pg_net e salva resultados
-- =============================================
create or replace function public.process_health_checks()
returns void
language plpgsql
security definer
as $$
declare
  mon record;
  resp record;
  req_id bigint;
  check_is_up boolean;
  old_status text;
begin
  for mon in
    select id, url, method, headers, expected_status, current_status
    from public.monitors
    where is_active = true
  loop
    -- Faz request síncrono via pg_net e processa
    begin
      if mon.method = 'GET' then
        select net.http_get(
          url := mon.url,
          headers := mon.headers
        ) into req_id;
      end if;

      -- Busca resposta (pg_net armazena em net._http_response)
      -- Aguarda até 10 segundos pela resposta
      perform pg_sleep(0.5);

      select status_code, (timed_out = false) as success
      into resp
      from net._http_response
      where id = req_id;

      if resp is null then
        -- Ainda sem resposta, marca como timeout
        check_is_up := false;

        insert into public.health_checks (monitor_id, status_code, latency_ms, is_up, error_message)
        values (mon.id, null, null, false, 'Timeout');
      else
        check_is_up := resp.success and resp.status_code = mon.expected_status;

        insert into public.health_checks (monitor_id, status_code, latency_ms, is_up)
        values (mon.id, resp.status_code, null, check_is_up);
      end if;

      -- Atualiza status do monitor
      old_status := mon.current_status;
      declare new_status text := case when check_is_up then 'up' else 'down' end;
      begin
        update public.monitors
        set
          current_status = new_status,
          last_checked_at = now(),
          last_status_change_at = case
            when old_status != new_status then now()
            else last_status_change_at
          end
        where id = mon.id;

        -- Dispara alerta se status mudou
        if old_status is distinct from new_status and old_status != 'unknown' then
          perform net.http_post(
            url := current_setting('app.site_url', true) || '/api/cron/health-alert',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
            ),
            body := jsonb_build_object('monitor_name', mon.name, 'new_status', new_status)
          );
        end if;
      end;

      -- Limpa resposta do pg_net
      delete from net._http_response where id = req_id;

    exception when others then
      insert into public.health_checks (monitor_id, status_code, latency_ms, is_up, error_message)
      values (mon.id, null, null, false, sqlerrm);

      update public.monitors
      set current_status = 'down', last_checked_at = now(),
          last_status_change_at = case when current_status != 'down' then now() else last_status_change_at end
      where id = mon.id;
    end;
  end loop;

  -- Cleanup: remove checks com mais de 90 dias
  delete from public.health_checks where created_at < now() - interval '90 days';
end;
$$;

-- =============================================
-- Agendar no pg_cron: a cada 5 minutos
-- =============================================
select cron.schedule(
  'wave-monitor-checks',
  '*/5 * * * *',
  $$select public.process_health_checks()$$
);
