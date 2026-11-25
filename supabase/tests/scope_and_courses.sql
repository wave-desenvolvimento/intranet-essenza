-- Self-check de escopo de usuarios, RLS de cursos e sequencia. Roda em transacao e desfaz tudo.
-- Uso: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/scope_and_courses.sql (somente banco local)
begin;
create temp table ids as select gen_random_uuid() owner_u, gen_random_uuid() matriz, gen_random_uuid() cassia, gen_random_uuid() maria, gen_random_uuid() other,
  gen_random_uuid() fa, gen_random_uuid() fb, gen_random_uuid() m1, gen_random_uuid() m2, gen_random_uuid() v1, gen_random_uuid() v2, gen_random_uuid() v3, gen_random_uuid() mu, gen_random_uuid() u1, gen_random_uuid() u2;
grant select on ids to authenticated;
insert into auth.users(id, email) select unnest(array[owner_u, matriz, cassia, maria, other]), gen_random_uuid() || '@t.test' from ids;
insert into franchises(id, name, slug) select fa, 'Palmas', 't-palmas' from ids union all select fb, 'Outra', 't-outra' from ids;
update profiles set franchise_id = fa from ids where profiles.id in (matriz, cassia, maria);
update profiles set franchise_id = fb from ids where profiles.id = other;
insert into roles(name, slug, is_system, level) values ('T Matriz', 't_matriz', true, 10);
insert into role_permissions select r.id, p.id from roles r, permissions p where r.slug = 't_matriz' and (p.module = 'usuarios' or p.module = 'treinamento') on conflict do nothing;
insert into user_roles(user_id, role_id) select matriz, r.id from ids, roles r where r.slug = 't_matriz';
insert into user_roles(user_id, role_id) select owner_u, r.id from ids, roles r where r.slug = 'owner';
insert into user_roles(user_id, role_id) select cassia, r.id from ids, roles r where r.slug = 'admin_franquia';
insert into user_roles(user_id, role_id) select unnest(array[maria, other]), r.id from ids, roles r where r.slug = 'usuario_franquia';
insert into cms_pages(title, slug, view_type) values ('U', 'universo-da-marca', 'custom') on conflict (slug) do update set sequential = false;
insert into cms_pages(title, slug, view_type, sequential) values ('T', 'treinamento', 'course', true) on conflict (slug) do update set sequential = true;
delete from course_modules where page_slug in ('treinamento', 'universo-da-marca');
insert into course_modules(id, title, slug, page_slug, status, sort_order) select m1, 'A', 't-a', 'treinamento', 'published', 0 from ids union all select m2, 'B', 't-b', 'treinamento', 'published', 1 from ids union all select mu, 'U', 't-u', 'universo-da-marca', 'published', 0 from ids;
insert into course_videos(id, module_id, title, status, sort_order, source_type, storage_path)
  select v1, m1, '1', 'published', 0, 'upload', 't1.mp4' from ids union all select v2, m1, '2', 'published', 1, 'upload', 't2.mp4' from ids union all
  select v3, m2, '3', 'published', 0, 'upload', 't3.mp4' from ids union all select u1, mu, 'u1', 'published', 0, 'upload', 't4.mp4' from ids union all select u2, mu, 'u2', 'published', 1, 'upload', 't5.mp4' from ids;
insert into storage.objects(bucket_id, name) select 'course-videos', 't' || n || '.mp4' from generate_series(1, 5) n;

insert into reseller_leads(nome, email, telefone) values ('Lead', 'lead@t.test', '1');
insert into support_tickets(nome, email, tipo, descricao) values ('o', 'ninguem@t.test', 'outro', 'x');

create function pg_temp.login(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', u::text, true), set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$ begin if c is not true then raise exception 'FALHOU: %', msg; end if; end $$;
set local role authenticated;

do $$
declare i ids; n int;
begin
  select * into i from ids;
  -- Franqueada: so a propria loja, nunca a matriz
  perform pg_temp.login(i.cassia);
  perform pg_temp.ok(can_manage_user(i.maria, 'edit'), 'cassia edita maria');
  perform pg_temp.ok(not can_manage_user(i.other, 'edit'), 'cassia nao edita outra loja');
  perform pg_temp.ok(not can_manage_user(i.matriz, 'edit'), 'cassia nao edita matriz da mesma loja');
  update profiles set full_name = 'x' where id = i.other; get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'rls profiles outra loja');
  begin update profiles set franchise_id = i.fb where id = i.cassia; raise exception 'FALHOU: trocou de loja'; exception when others then perform pg_temp.ok(sqlerrm like 'Sem permissao%', sqlerrm); end;
  update profiles set full_name = 'Cassia' where id = i.cassia; get diagnostics n = row_count;
  perform pg_temp.ok(n = 1, 'edita o proprio nome');
  begin insert into user_roles(user_id, role_id) select i.maria, id from roles where slug = 'owner'; raise exception 'FALHOU: atribuiu owner'; exception when insufficient_privilege then null; end;
  begin insert into course_modules(title, slug, page_slug) values ('x', 'x-t', 'treinamento'); raise exception 'FALHOU: franqueado criou modulo'; exception when insufficient_privilege then null; end;
  delete from course_videos where id = i.v1; get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'franqueado nao apaga video');

  -- Sequencia (atravessa modulos) e storage
  perform pg_temp.login(i.maria);
  perform pg_temp.ok(course_video_unlocked(i.v1) and not course_video_unlocked(i.v2) and not course_video_unlocked(i.v3), 'so a 1a liberada');
  perform pg_temp.ok(course_video_unlocked(i.u2), 'universo livre');
  perform pg_temp.ok((select count(*) from storage.objects where name = 't2.mp4') = 0, 'arquivo bloqueado');
  begin perform save_lesson_progress(i.v2, 100::smallint); raise exception 'FALHOU: pulou aula'; exception when others then perform pg_temp.ok(sqlerrm = 'Aula bloqueada', sqlerrm); end;
  perform save_lesson_progress(i.v1, 50::smallint);
  perform pg_temp.ok(not course_video_unlocked(i.v2), '50% nao libera');
  perform save_lesson_progress(i.v1, 100::smallint);
  perform save_lesson_progress(i.v1, 10::smallint);
  perform pg_temp.ok((select watched_pct from lesson_progress where video_id = i.v1) = 100, 'progresso nunca reduz');
  perform pg_temp.ok(course_video_unlocked(i.v2) and not course_video_unlocked(i.v3), 'libera a 2a');
  perform pg_temp.ok((select count(*) from storage.objects where name = 't2.mp4') = 1, 'arquivo liberado');
  perform save_lesson_progress(i.v2, 95::smallint);
  perform pg_temp.ok(course_video_unlocked(i.v3), 'libera o proximo modulo');
  begin insert into lesson_progress(user_id, video_id, module_id, watched_pct) values (i.maria, i.v3, i.m2, 100); raise exception 'FALHOU: insert direto'; exception when insufficient_privilege then null; end;

  -- Painel
  perform pg_temp.login(i.cassia);
  perform pg_temp.ok((select count(*) from lesson_progress where user_id = i.maria) = 2, 'cassia ve maria');
  perform pg_temp.login(i.other);
  perform pg_temp.ok((select count(*) from lesson_progress where user_id = i.maria) = 0, 'outra loja nao ve maria');

  -- Perfis e resumo: so a propria loja
  perform pg_temp.login(i.cassia);
  perform pg_temp.ok((select count(*) from profiles where id = i.other) = 0, 'cassia nao le perfil de outra loja');
  perform pg_temp.ok((select count(*) from profiles where id = i.maria) = 1, 'cassia le perfil da loja');
  perform pg_temp.ok(training_overview()->'people' @> jsonb_build_array(jsonb_build_object('id', i.maria, 'progress', jsonb_build_object('treinamento', jsonb_build_object('done', 2)))), 'resumo conta 2 concluidas');
  perform pg_temp.ok(not training_overview()->'people' @> jsonb_build_array(jsonb_build_object('id', i.other)), 'resumo sem outra loja');
  perform pg_temp.ok(not training_overview()->'people' @> jsonb_build_array(jsonb_build_object('id', i.matriz)), 'resumo sem matriz');
  begin perform set_course_settings('treinamento', false, true); raise exception 'FALHOU: franqueado alterou configuracao'; exception when others then perform pg_temp.ok(sqlerrm like 'Sem permissao%', sqlerrm); end;
  perform pg_temp.ok((select count(*) from franchises) = 1, 'cassia le so a propria franquia');
  perform pg_temp.ok((select count(*) from reseller_leads) = 0, 'cassia nao le leads');
  delete from reseller_leads; get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'cassia nao apaga leads');
  perform pg_temp.ok((select count(*) from support_tickets) = 0, 'cassia nao le chamados de outros');
  begin insert into support_tickets(nome, email, tipo, descricao) values ('x', 'outro@t.test', 'outro', 'x'); raise exception 'FALHOU: chamado em nome de outro'; exception when insufficient_privilege then null; end;
  perform pg_temp.login(i.maria);
  perform pg_temp.ok(training_overview()->'people' = '[]'::jsonb, 'funcionario nao ve resumo');

  -- Matriz (nivel baixo, escopo Sistema) alcanca a rede
  perform pg_temp.login(i.matriz);
  perform pg_temp.ok(can_manage_user(i.other, 'edit') and can_manage_user(i.cassia, 'edit'), 'matriz edita rede');
  update course_modules set title = 'A2' where id = i.m1; get diagnostics n = row_count;
  perform pg_temp.ok(n = 1, 'matriz edita modulo');
  perform pg_temp.login(i.owner_u);
  perform pg_temp.ok(training_overview()->'people' @> jsonb_build_array(jsonb_build_object('id', i.other)), 'owner ve a rede no resumo');
  perform set_course_settings('universo-da-marca', true, false);
  perform pg_temp.login(i.other);
  perform pg_temp.ok(course_video_unlocked(i.u1) and not course_video_unlocked(i.u2), 'owner ligou sequencia no universo');
  perform pg_temp.login(i.owner_u);
  perform set_course_settings('universo-da-marca', false, false);
  perform pg_temp.login(i.other);
  perform pg_temp.ok(course_video_unlocked(i.u2), 'owner voltou para livre');

  -- Certificado: so com tudo concluido, so se o treinamento gera, e so quem pode ver
  perform save_lesson_progress(i.u1, 100::smallint);
  perform save_lesson_progress(i.u2, 100::smallint);
  perform pg_temp.ok((select count(*) from course_certificates where user_id = i.other) = 0, 'sem certificado com opcao desligada');
  perform pg_temp.login(i.owner_u);
  perform set_course_settings('universo-da-marca', false, true);
  perform pg_temp.login(i.other);
  perform pg_temp.ok((select count(*) from course_certificates) = 1, 'ligar a opcao emite para quem ja concluiu');
  perform pg_temp.login(i.maria);
  perform save_lesson_progress(i.u1, 100::smallint);
  perform pg_temp.ok((select count(*) from course_certificates) = 0, 'parcial nao emite, nem ve o de outros');
  perform save_lesson_progress(i.u2, 100::smallint);
  perform pg_temp.ok((select count(*) from course_certificates) = 1, 'emite ao concluir');
  begin insert into course_certificates(user_id, page_slug, user_name, training_title) values (i.maria, 'x', 'x', 'x'); raise exception 'FALHOU: forjou certificado'; exception when insufficient_privilege then null; end;
  begin perform issue_course_certificates('universo-da-marca'); raise exception 'FALHOU: chamou emissao'; exception when insufficient_privilege then null; end;
  perform pg_temp.login(i.cassia);
  perform pg_temp.ok((select count(*) from course_certificates) = 1, 'franqueada ve so o da loja');
  perform pg_temp.login(i.owner_u);
  perform pg_temp.ok(can_manage_user(i.cassia, 'delete'), 'owner');
  perform pg_temp.ok((select count(*) from reseller_leads) >= 1 and (select count(*) from support_tickets) >= 1 and (select count(*) from franchises) >= 2, 'owner le leads, chamados e franquias');
  perform pg_temp.ok((select count(*) from get_user_permissions(i.cassia) p where p.module in ('pedidos', 'franquias', 'relatorios', 'historico')) = 0, 'admin franquia sem modulos admin');
  perform pg_temp.ok((select count(*) from get_user_permissions(i.maria) p where p.module in ('pedidos', 'franquias', 'relatorios', 'historico', 'produtos', 'usuarios')) = 0, 'usuario franquia sem modulos admin');
  perform pg_temp.ok((select count(*) from get_user_permissions(i.maria) p where p.module in ('comunicados', 'suporte', 'pesquisas') and p.action = 'view') = 3, 'modulos visiveis');

  -- Permissao vem da tela Permissoes, nao do nome do perfil
  perform pg_temp.login(i.owner_u);
  delete from role_permissions rp using roles r, permissions p where r.id = rp.role_id and p.id = rp.permission_id and r.slug = 'admin_franquia' and p.module = 'treinamentos';
  insert into role_permissions select r.id, p.id from roles r, permissions p where r.slug = 'usuario_franquia' and p.module = 'treinamentos' on conflict do nothing;
  perform pg_temp.login(i.cassia);
  perform pg_temp.ok(training_overview()->'people' = '[]'::jsonb, 'sem a permissao perde o acompanhamento');
  perform pg_temp.login(i.maria);
  perform pg_temp.ok(jsonb_array_length(training_overview()->'people') > 0, 'com a permissao qualquer perfil acompanha');
  perform set_course_settings('treinamento', true, false);

  -- Inativo perde tudo na hora, inclusive Owner
  perform pg_temp.login(i.matriz);
  update profiles set status = 'inactive' where id in (i.maria, i.owner_u);
  perform pg_temp.login(i.maria);
  perform pg_temp.ok((select count(*) from get_user_permissions(i.maria)) = 0 and not course_video_unlocked(i.u1), 'inativo sem permissao e sem aula');
  perform pg_temp.ok((select count(*) from franchises) = 0, 'inativo nao le a franquia');
  perform pg_temp.login(i.owner_u);
  perform pg_temp.ok(not has_permission(i.owner_u, 'cms', 'edit'), 'owner inativo sem permissao');
  perform pg_temp.login(i.cassia);
  begin insert into orders(franchise_id, created_by) values (i.fa, i.cassia); raise exception 'FALHOU: pedido sem permissao'; exception when insufficient_privilege then null; end;
  perform pg_temp.ok((select count(*) from share_links) = 0, 'nao lista links');
end $$;
rollback;
\echo OK
