-- Testes do Avalia 360°. Requer usuários/escopo de teste: A (record), B (validate), C (sem vínculo).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text, aal text default 'aal2') returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal',aal)::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
\set Q '''{"meta":{"title":"Prova 1","semester":"2027/1","purpose":"formativa"},"questions":[{"id":"q1","disciplineId":"Direito Civil","kind":"objetiva","statement":"Considere o caso concreto apresentado","images":[]}]}'''

-- 1. Sem MFA não grava
select pg_temp.as_user('11111111-1111-1111-1111-111111111111','aal1');
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I, :C, 'Direito Civil','create', :Q), '42501');
-- 2. Docente cria; versão 1
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table r as select public.vertice_avalia_draft(:I::uuid,:C::uuid,'Direito Civil','create',:Q::jsonb) j;
select (j->>'revision')='1' as criou_v1 from r \gset
\if :criou_v1 \else \echo FALHA criou_v1 \quit \endif
-- 3. Atualiza com revisão correta -> 2; revisão antiga -> conflito
select public.vertice_avalia_draft(:I::uuid,:C::uuid,'direito  civil','update',:Q::jsonb || jsonb_build_object('id',(select j->>'id' from r),'expectedRevision',1))->>'revision' = '2' as v2 \gset
\if :v2 \else \echo FALHA v2 \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I, :C, 'Direito Civil','update', (:Q::jsonb || jsonb_build_object('id',(select j->>'id' from r),'expectedRevision',1))::text), '40001');
select count(*)=2 as historico from public.vertice_avalia_draft_revisions where draft_id::text=(select j->>'id' from r) \gset
\if :historico \else \echo FALHA historico \quit \endif
-- 4. Leitura: autor e coordenação leem; terceiro não
select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Direito Civil','get',jsonb_build_object('id',(select j->>'id' from r)))->'snapshot'->'questions'->0->>'id')='q1' as autor_le \gset
\if :autor_le \else \echo FALHA autor_le \quit \endif
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select jsonb_array_length(public.vertice_avalia_draft(:I::uuid,:C::uuid,'Direito Civil','list','{}'))>=1 as coord_lista \gset
\if :coord_lista \else \echo FALHA coord_lista \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I, :C, 'Direito Civil','update', (:Q::jsonb || jsonb_build_object('id',(select j->>'id' from r),'expectedRevision',2))::text), 'P0002');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I, :C, 'Direito Civil','get', jsonb_build_object('id',(select j->>'id' from r))::text), '42501');
-- 5. Imagem pendente não entra no caderno; confirmada entra
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table m as select public.vertice_avalia_media_prepare(:I::uuid,:C::uuid,'Direito Civil','q1',repeat('a',64),'image/png',100) j;
select (select j->>'path' from m) like 'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001/%.png' as caminho \gset
\if :caminho \else \echo FALHA caminho \quit \endif
create temp table qi as select jsonb_set(:Q::jsonb,'{questions,0,images}',jsonb_build_array(jsonb_build_object('imageId',(select j->>'imageId' from m),'path',(select j->>'path' from m),'sha256',repeat('a',64)))) p;
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I, :C, 'Direito Civil','create', (select p from qi)::text), '22023');
reset role; update public.vertice_avalia_media set status='confirmed',confirmed_at=now();
select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Direito Civil','create',(select p from qi))->>'revision')='1' as com_imagem \gset
\if :com_imagem \else \echo FALHA com_imagem \quit \endif
-- 6. Questão de outra disciplina é recusada
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I, :C, 'Penal','create', :Q), '22023');
-- 7. Banco: salva, lista, recusa duplicado e imagem
create temp table b as select public.vertice_avalia_bank(:I::uuid,:C::uuid,'Direito Civil','save',jsonb_build_object('record',jsonb_build_object('bankId',gen_random_uuid(),'indexLabels','["contratos"]'::jsonb,'question',(:Q::jsonb)->'questions'->0))) j;
select jsonb_array_length(public.vertice_avalia_bank(:I::uuid,:C::uuid,'direito civil','list','{}'))>=1 as banco \gset
\if :banco \else \echo FALHA banco \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_bank(%L,%L,%L,%L,%L)', :I, :C, 'Direito Civil','save', jsonb_build_object('record',jsonb_build_object('bankId',(select j->>'bankId' from b),'question',(:Q::jsonb)->'questions'->0))::text), '23505');
-- 8. Turma: apenas ativos e verificados do período, em ordem alfabética
select public.vertice_avalia_class_roster(:I::uuid,:C::uuid,'Direito Civil','3º período')->'students'->0->>'name'='Ana'
  and jsonb_array_length(public.vertice_avalia_class_roster(:I::uuid,:C::uuid,'Direito Civil','3')->'students')=2 as turma \gset
\if :turma \else \echo FALHA turma \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_class_roster(%L,%L,%L,%L)', :I, :C, 'Direito Civil','Turma A'), '22023');
-- 9. Nenhuma leitura direta das tabelas
set role authenticated;
select pg_temp.expect_error('select * from public.vertice_avalia_drafts', '42501');
reset role;
\echo AVALIA360_SQL_TESTS_OK
