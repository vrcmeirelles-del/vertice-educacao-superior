-- Testes da gravação da Construção Curricular (vertice_curriculum_build).
-- Requer supabase/tests/fixtures/avalia360_stubs.sql e as migrações do Avalia 360°.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text, aal text default 'aal2') returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal',aal)::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
reset role;
-- Curso do portal que ainda NÃO existe em vertice_app.courses (deve ser espelhado)
create temp table nc as select gen_random_uuid() id;
insert into public.vertice_courses(id,institution_id,name) select id,:I::uuid,'Direito' from nc;
delete from public.role_stub where user_id::text like '77777777-%';
insert into public.role_stub values('77777777-0000-0000-0000-000000000001',:I::uuid,'gestor'),('77777777-0000-0000-0000-000000000002',:I::uuid,'equipe'),
 ('77777777-0000-0000-0000-000000000003',:I::uuid,'coordenador');
\set M '''{"graduate_profile":"Egresso apto a atuar com ética.","dcn_reference":"Resolução CNE/CES nº 5/2018","dcn_document_url":"https://example.org/dcn.pdf","competencies":[{"code":"C1","title":"Interpretar normas","origin_period":2,"period_status":"validated","disciplines":[{"discipline_name":"Direito Civil I","category":"profissional"},{"discipline_name":"Metodologia","category":"instrumental"}]},{"code":"C2","title":"Argumentar","disciplines":[]}]}'''
-- Sem MFA, sem papel, ou papel só de leitura: recusado
select pg_temp.as_user('77777777-0000-0000-0000-000000000001','aal1');
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,(select id from nc),'get','{}'),'42501');
select pg_temp.as_user('77777777-0000-0000-0000-000000000002');
select public.vertice_curriculum_build(:I::uuid,(select id from nc),'get','{}')->'build'='null'::jsonb as leitura_vazia \gset
\if :leitura_vazia \else \echo FALHA leitura_vazia \quit \endif
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,(select id from nc),'save',:M),'42501');
-- Coordenação sem vínculo validado: recusada
select pg_temp.as_user('77777777-0000-0000-0000-000000000003');
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,(select id from nc),'get','{}'),'42501');
-- Gestão grava: espelha o curso, cria a versão 1 em rascunho com competências e disciplinas
select pg_temp.as_user('77777777-0000-0000-0000-000000000001');
create temp table s1 as select public.vertice_curriculum_build(:I::uuid,(select id from nc),'save',:M::jsonb) j;
select (j->'build'->>'version')::int=1 and j->'build'->>'status'='draft' and jsonb_array_length(j->'competencies')=2
   and jsonb_array_length(j->'competencies'->0->'disciplines')=2 and (j->'competencies'->0->>'origin_period')::int=2
   and exists(select 1 from vertice_app.courses c where c.id=(select id from nc)) as salvou from s1 \gset
\if :salvou \else \echo FALHA salvou \quit \endif
-- Novo salvamento do rascunho preserva o id da competência existente e remove a excluída
create temp table ids as select j->'build'->>'id' bid, j->'competencies'->0->>'id' c1 from s1;
create temp table s2 as select public.vertice_curriculum_build(:I::uuid,(select id from nc),'save',jsonb_build_object('buildId',(select bid from ids),
 'graduate_profile','Perfil revisado','dcn_reference','Res. 5/2018','competencies',jsonb_build_array(jsonb_build_object('id',(select c1 from ids),'code','C1','title','Interpretar e aplicar normas','disciplines','[]'::jsonb)))) j;
select (j->'build'->>'version')::int=1 and jsonb_array_length(j->'competencies')=1 and j->'competencies'->0->>'id'=(select c1 from ids) as preserva from s2 \gset
\if :preserva \else \echo FALHA preserva \quit \endif
-- Validações: código repetido, período homologado sem período, link sem https
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,(select id from nc),'save','{"competencies":[{"code":"C1","title":"a"},{"code":"c1","title":"b"}]}'),'22023');
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,(select id from nc),'save','{"competencies":[{"code":"C1","title":"a","period_status":"validated"}]}'),'22023');
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,(select id from nc),'save','{"dcn_document_url":"javascript:x","competencies":[{"code":"C1","title":"a"}]}'),'22023');
-- Publicação; editar depois abre a versão 2 em rascunho, preservando a publicada
select public.vertice_curriculum_build(:I::uuid,(select id from nc),'publish',jsonb_build_object('buildId',(select bid from ids)))->'build'->>'status'='published' as publicou \gset
\if :publicou \else \echo FALHA publicou \quit \endif
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,(select id from nc),'publish','{}'),'23514');
create temp table s3 as select public.vertice_curriculum_build(:I::uuid,(select id from nc),'save',:M::jsonb) j;
select (j->'build'->>'version')::int=2 and j->'build'->>'status'='draft' and (j->>'publishedVersion')::int=1 as nova_versao from s3 \gset
\if :nova_versao \else \echo FALHA nova_versao \quit \endif
-- O Avalia 360° importa a versão publicada (1), não o rascunho (2)
reset role; insert into public.acl values('77777777-0000-0000-0000-000000000001',:I::uuid,(select id from nc),'validate');
select pg_temp.as_user('77777777-0000-0000-0000-000000000001');
select (public.vertice_avalia_curriculum_import(:I::uuid,(select id from nc))->'build'->>'version')::int=1 as importa_publicada \gset
\if :importa_publicada \else \echo FALHA importa_publicada \quit \endif
-- Publicar a versão 2 arquiva a 1
-- (duas instruções: a leitura na mesma instrução enxergaria o retrato anterior à publicação)
select public.vertice_curriculum_build(:I::uuid,(select id from nc),'publish','{}')->>'publishedVersion'='2' as pub2 \gset
select :'pub2'::boolean and (select status from vertice_app.curriculum_builds where course_id=(select id from nc) and version=1)='archived' as arquivou \gset
\if :arquivou \else \echo FALHA arquivou \quit \endif
-- Coordenação com vínculo validado grava
reset role; insert into public.vertice_learning_staff_scope(institution_id,course_id,user_id,active) select :I::uuid,id,'77777777-0000-0000-0000-000000000003',true from nc;
select pg_temp.as_user('77777777-0000-0000-0000-000000000003');
select (public.vertice_curriculum_build(:I::uuid,(select id from nc),'save',:M::jsonb)->'build'->>'version')::int=3 as coordenacao \gset
\if :coordenacao \else \echo FALHA coordenacao \quit \endif
-- Curso de outra IES: recusado
select pg_temp.expect_error(format('select public.vertice_curriculum_build(%L,%L,%L,%L)',:I,gen_random_uuid(),'get','{}'),'42501');
\echo CURRICULUM_BUILDER_TESTS_OK
