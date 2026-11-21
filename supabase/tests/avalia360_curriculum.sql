-- Testes da leitura da Construção Curricular pelo Avalia 360°.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
reset role;
delete from vertice_app.curriculum_discipline_links; delete from vertice_app.curriculum_competencies; delete from vertice_app.curriculum_builds;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.vertice_avalia_curriculum_import(:I::uuid,:C::uuid)->'build'='null'::jsonb as sem_matriz \gset
\if :sem_matriz \else \echo FALHA sem_matriz \quit \endif
reset role;
insert into vertice_app.curriculum_builds(id,institution_id,course_id,status,version) values
 ('d0000000-0000-0000-0000-000000000001',:I::uuid,:C::uuid,'published',1),
 ('d0000000-0000-0000-0000-000000000002',:I::uuid,:C::uuid,'published',2),
 ('d0000000-0000-0000-0000-000000000003',:I::uuid,:C::uuid,'draft',3);
insert into vertice_app.curriculum_competencies(id,build_id,code,title,sort_order,origin_period,period_status) values
 ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','C1','Interpretar contratos',1,3,'validated'),
 ('e0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002','C2','Nexo causal',2,null,null),
 ('e0000000-0000-0000-0000-000000000009','d0000000-0000-0000-0000-000000000003','C9','Rascunho',1,1,'proposed');
insert into vertice_app.curriculum_discipline_links(competency_id,discipline_name) values
 ('e0000000-0000-0000-0000-000000000001','Direito Civil'),('e0000000-0000-0000-0000-000000000002','Direito  Civil');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table r as select public.vertice_avalia_curriculum_import(:I::uuid,:C::uuid) j;
-- Usa a última matriz PUBLICADA (versão 2), não o rascunho (versão 3)
select (j->'build'->>'version')::int=2 and jsonb_array_length(j->'competencies')=2 and jsonb_array_length(j->'links')=2
   and (j->'competencies'->0->>'origin_period')::int=3 and j->'competencies'->1->'origin_period'='null'::jsonb as importa from r \gset
\if :importa \else \echo FALHA importa \quit \endif
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_curriculum_import(%L,%L)',:I,:C),'42501');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select vertice_private.avalia_competency_key(:C::uuid,'{"id":"qualquer","code":" C1 ","title":"Interpretar  Contratos"}')='cmp:c1|interpretar contratos' as chave \gset
\if :chave \else \echo FALHA chave \quit \endif
\echo AVALIA360_CURRICULUM_TESTS_OK
