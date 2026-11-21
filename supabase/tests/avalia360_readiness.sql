-- Testes do bloco 5: escopo do curso, matriz do exame, série de notas e sinais de risco.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
\set AREAS '''[{"key":"fg","label":"Formação Geral","weight":25,"competencies":["cmp:fg1|leitura crítica"]},{"key":"ce","label":"Componente Específico","weight":75,"competencies":["cmp:c1|contratos","cmp:c2|nexo causal"]}]'''
-- Escopo do curso: só encerradas; ambiguidade recusada
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.vertice_avalia_competency_evidence(:I::uuid,:C::uuid,'{"course":true}')->>'scope'='course' as escopo \gset
\if :escopo \else \echo FALHA escopo \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_competency_evidence(%L,%L,%L)',:I,:C,'{"course":true,"discipline":"x"}'),'22023');
-- Matriz: só o colegiado cadastra; quem cadastrou não valida; áreas validadas
select pg_temp.expect_error(format('select public.vertice_avalia_exam_matrix(%L,%L,%L,%L)',:I,:C,'save',jsonb_build_object('exam','enade','label','ENADE Direito','edition','2027','sourceRef','Portaria INEP de 2027','areas',:AREAS::jsonb)::text),'42501');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error(format('select public.vertice_avalia_exam_matrix(%L,%L,%L,%L)',:I,:C,'save',jsonb_build_object('exam','enade','label','ENADE Direito','edition','2027','sourceRef','Portaria INEP',
 'areas','[{"key":"fg","label":"FG","weight":0,"competencies":[]}]'::jsonb)::text),'22023');
select pg_temp.expect_error(format('select public.vertice_avalia_exam_matrix(%L,%L,%L,%L)',:I,:C,'save',jsonb_build_object('exam','enade','label','ENADE Direito','edition','2027','sourceRef','Portaria INEP',
 'areas','[{"key":"fg","label":"FG","weight":1,"competencies":["sem-prefixo"]}]'::jsonb)::text),'22023');
create temp table mx as select (public.vertice_avalia_exam_matrix(:I::uuid,:C::uuid,'save',jsonb_build_object('exam','enade','label','ENADE Direito','edition','2027','sourceRef','Portaria INEP de 2027 (conferir)','areas',:AREAS::jsonb))->>'id')::uuid id;
select pg_temp.expect_error(format('select public.vertice_avalia_exam_matrix(%L,%L,%L,%L)',:I,:C,'validate',jsonb_build_object('id',(select id from mx))::text),'42501');
-- Outro membro do colegiado valida (A não é validador no stub: usa-se um terceiro com acesso validate)
reset role; insert into public.acl values('44444444-4444-4444-4444-444444444444',:I::uuid,:C::uuid,'validate');
insert into auth.users values('44444444-4444-4444-4444-444444444444') on conflict do nothing;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.vertice_avalia_exam_matrix(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from mx)))->>'status'='validated' as validou \gset
\if :validou \else \echo FALHA validou \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_exam_matrix(%L,%L,%L,%L)',:I,:C,'save',jsonb_build_object('id',(select id from mx),'exam','enade','label','x y z','edition','2027','sourceRef','Portaria INEP','areas',:AREAS::jsonb)::text),'23514');
select (select count(*) from jsonb_array_elements(public.vertice_avalia_exam_matrix(:I::uuid,:C::uuid,'list','{}')) x where x->>'id'=(select id from mx)::text and x->>'status'='validated')=1 as lista \gset
\if :lista \else \echo FALHA lista \quit \endif
-- Série de notas: estrutura
select jsonb_typeof(public.vertice_avalia_score_series(:I::uuid,:C::uuid))='array' as serie \gset
\if :serie \else \echo FALHA serie \quit \endif
-- Sinais: só o colegiado publica; publicação substitui; aparece na view de risco existente
create temp table stu as select (select id from public.vertice_student_registry where full_name='Ana') ana,(select id from public.vertice_student_registry where full_name='Bruna') bruna;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error(format('select public.vertice_avalia_risk_publish(%L,%L,%L)',:I,:C,jsonb_build_object('signals','[]'::jsonb)::text),'42501');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error(format('select public.vertice_avalia_risk_publish(%L,%L,%L)',:I,:C,jsonb_build_object('signals',jsonb_build_array(jsonb_build_object('studentId',gen_random_uuid(),'level','alto','reasons','["x"]'::jsonb)))::text),'22023');
select (public.vertice_avalia_risk_publish(:I::uuid,:C::uuid,jsonb_build_object('rulesVersion','2026.11-1','signals',jsonb_build_array(
 jsonb_build_object('studentId',(select ana from stu),'level','alto','reasons','["Queda de 18 pontos percentuais por trimestre"]'::jsonb),
 jsonb_build_object('studentId',(select bruna from stu),'level','atencao','reasons','["1 competência não demonstrada"]'::jsonb))))->>'published')='2' as publicou \gset
\if :publicou \else \echo FALHA publicou \quit \endif
select (public.vertice_avalia_risk_publish(:I::uuid,:C::uuid,jsonb_build_object('signals',jsonb_build_array(
 jsonb_build_object('studentId',(select ana from stu),'level','atencao','reasons','["Última nota abaixo de 50%"]'::jsonb))))->>'published')='1' as republicou \gset
select ana::text ana_id, bruna::text bruna_id from stu \gset
set role authenticated;
select (select academic_risk_level from public.v_student_evasion_risk where student_id=:'ana_id'::uuid)='atencao'
   and (select academic_risk_level from public.v_student_evasion_risk where student_id=:'bruna_id'::uuid) is null
   -- fórmula original preservada: sem estágio => 'medium'
   and (select risk_level from public.v_student_evasion_risk where student_id=:'ana_id'::uuid)='medium' as view_risco \gset
reset role;
\if :view_risco \else \echo FALHA view_risco \quit \endif
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
set role authenticated;
select count(*)=0 as invisivel from public.vertice_avalia_risk_signals \gset
reset role;
\if :invisivel \else \echo FALHA invisivel \quit \endif
\echo AVALIA360_READINESS_TESTS_OK
