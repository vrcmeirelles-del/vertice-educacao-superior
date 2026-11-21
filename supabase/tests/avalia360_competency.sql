-- Testes da evidência por competência (bloco 1). A (autor), B (validate), C (sem vínculo).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
reset role;
-- Construção Curricular do curso com a competência C1 (id estável)
create temp table cur as select gen_random_uuid() build, gen_random_uuid() comp;
insert into vertice_app.curriculum_builds(id,institution_id,course_id,status) select build,:I::uuid,:C::uuid,'published' from cur;
insert into vertice_app.curriculum_competencies(id,build_id,code,title) select comp,build,'C1','Interpretar contratos' from cur;
create temp table disc as select 'Civil '||substr(md5(random()::text),1,6) d;
-- Caderno 1: C1 (curricular) e C2 (declarada, id local x1); C2 é pré-requisito de C1
create temp table d1 as select jsonb_build_object('meta',jsonb_build_object('title','AV1','semester','2027/1','purpose','somativa',
  'declaredPedagogy',jsonb_build_object('competencies',jsonb_build_array(
     jsonb_build_object('id',(select comp from cur)::text,'code','C1','title','Interpretar contratos','period',3),
     jsonb_build_object('id','x1','code','C2','title','Nexo causal','period',2)),
   'relations',jsonb_build_array(jsonb_build_object('sourceCompetencyId','x1','targetCompetencyId',(select comp from cur)::text,'kind','prerequisito')))),
 'questions',jsonb_build_array(
  jsonb_build_object('id','q1','disciplineId',(select d from disc),'kind','objetiva','statement','Questão sobre contratos 1','points',1,'competencyIds',jsonb_build_array((select comp from cur)::text),
    'options','[{"id":"A","text":"a"},{"id":"B","text":"b"}]'::jsonb,'correctOptionId','A','answerJustification','ok','images','[]'::jsonb),
  jsonb_build_object('id','q2','disciplineId',(select d from disc),'kind','objetiva','statement','Questão sobre nexo causal','points',1,'competencyIds','["x1"]'::jsonb,
    'options','[{"id":"A","text":"a"},{"id":"B","text":"b"}]'::jsonb,'correctOptionId','A','answerJustification','ok','images','[]'::jsonb),
  jsonb_build_object('id','q3','disciplineId',(select d from disc),'kind','objetiva','statement','Questão integradora do caso','points',2,'competencyIds',jsonb_build_array((select comp from cur)::text,'x1'),
    'options','[{"id":"A","text":"a"},{"id":"B","text":"b"}]'::jsonb,'correctOptionId','A','answerJustification','ok','images','[]'::jsonb))) p;
-- Caderno 2: a mesma C2 com outro id local e grafia diferente => mesma identidade
create temp table d2 as select jsonb_build_object('meta',jsonb_build_object('title','AV2','semester','2027/1','purpose','formativa',
  'declaredPedagogy',jsonb_build_object('competencies',jsonb_build_array(jsonb_build_object('id','y9','code','c2 ','title','Nexo  causal','period',2)),'relations','[]'::jsonb)),
 'questions',jsonb_build_array(jsonb_build_object('id','p1','disciplineId',(select d from disc),'kind','objetiva','statement','Nova questão de nexo causal','points',1,
  'competencyIds','["y9"]'::jsonb,'options','[{"id":"A","text":"a"},{"id":"B","text":"b"}]'::jsonb,'correctOptionId','A','answerJustification','ok','images','[]'::jsonb))) p;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
-- Somativa sem competência é bloqueada no envio
create temp table bad as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,(select d from disc),'create',
 jsonb_set((select p from d1),'{questions,0,competencyIds}','[]'))->>'id')::uuid id;
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)',:I,:C,'submit',jsonb_build_object('id',(select id from bad),'expectedRevision',1)::text),'23514');
create temp table dr as
 select 1 k,(public.vertice_avalia_draft(:I::uuid,:C::uuid,(select d from disc),'create',(select p from d1))->>'id')::uuid id
 union all select 2,(public.vertice_avalia_draft(:I::uuid,:C::uuid,(select d from disc),'create',(select p from d2))->>'id')::uuid;
select count(public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',id,'expectedRevision',1)))=2 as enviados from dr \gset
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select count(public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',id,'expectedRevision',1,'justification','Validado para o diagnóstico.')))=2 as validados from dr \gset
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table ap as
 select 1 k,(public.vertice_avalia_application(:I::uuid,:C::uuid,'create',jsonb_build_object('draftId',(select id from dr where k=1),'expectedRevision',1,'variantCount',1,
   'variantMap','{"A":[{"q":"q1","o":["A","B"]},{"q":"q2","o":["A","B"]},{"q":"q3","o":["A","B"]}]}'::jsonb,'classLabel','3º','appliedOn',current_date-30))->>'id')::uuid id
 union all
 select 2,(public.vertice_avalia_application(:I::uuid,:C::uuid,'create',jsonb_build_object('draftId',(select id from dr where k=2),'expectedRevision',1,'variantCount',1,
   'variantMap','{"A":[{"q":"p1","o":["A","B"]}]}'::jsonb,'classLabel','3º','appliedOn',current_date))->>'id')::uuid;
create temp table stu as select (select id from public.vertice_student_registry where full_name='Ana') ana,(select id from public.vertice_student_registry where full_name='Bruna') bruna;
select public.vertice_avalia_application(:I::uuid,:C::uuid,'save_sheets',jsonb_build_object('id',(select id from ap where k=1),'sheets',jsonb_build_array(
  jsonb_build_object('studentId',(select ana from stu),'variant','A','objective','{"1":"A","2":"B","3":"A"}'::jsonb),
  jsonb_build_object('studentId',(select bruna from stu),'variant','A','objective','{"1":"B","2":"B","3":"B"}'::jsonb),
  jsonb_build_object('label','X-01','variant','A','objective','{"1":"A"}'::jsonb)))) is not null as l1 \gset
select public.vertice_avalia_application(:I::uuid,:C::uuid,'save_sheets',jsonb_build_object('id',(select id from ap where k=2),'sheets',jsonb_build_array(
  jsonb_build_object('studentId',(select ana from stu),'variant','A','objective','{"1":"A"}'::jsonb)))) is not null as l2 \gset

-- Escopo da aplicação (aberta): inclui folha identificada só por código
create temp table e1 as select public.vertice_avalia_competency_evidence(:I::uuid,:C::uuid,jsonb_build_object('applicationId',(select id from ap where k=1))) j;
select (select count(distinct r->>'label') from e1, jsonb_array_elements(j->'rows') r)=3
   and (select (r->>'score')::numeric=3 and (r->>'max')::numeric=3 and (r->>'items')::int=2 from e1, jsonb_array_elements(j->'rows') r
        where r->>'label'='Ana' and r->>'competency'='cmp:c1|interpretar contratos')
   and (select (r->>'score')::numeric=2 and (r->>'max')::numeric=3 from e1, jsonb_array_elements(j->'rows') r
        where r->>'label'='Ana' and r->>'competency'='cmp:c2|nexo causal') as aplicacao \gset
\if :aplicacao \else \echo FALHA aplicacao \quit \endif
select (select count(*) from e1, jsonb_array_elements(j->'relations') r
  where r->>'source'='cmp:c2|nexo causal' and r->>'target'='cmp:c1|interpretar contratos' and r->>'kind'='prerequisito')=1 as relacao \gset
\if :relacao \else \echo FALHA relacao \quit \endif
-- Escopo da disciplina: só aplicações encerradas
select jsonb_array_length(public.vertice_avalia_competency_evidence(:I::uuid,:C::uuid,jsonb_build_object('discipline',(select d from disc)))->'rows')=0 as so_encerradas \gset
\if :so_encerradas \else \echo FALHA so_encerradas \quit \endif
select count(public.vertice_avalia_application(:I::uuid,:C::uuid,'close',jsonb_build_object('id',id)))=2 as fechou from ap \gset
create temp table e2 as select public.vertice_avalia_competency_evidence(:I::uuid,:C::uuid,jsonb_build_object('discipline',lower((select d from disc)))) j;
select jsonb_array_length(j->'competencies')=2 and jsonb_array_length(j->'applications')=2
   and not exists(select 1 from jsonb_array_elements(j->'rows') r where r->>'label'='X-01')
   and (select count(*) from jsonb_array_elements(j->'rows') r where r->>'label'='Ana' and r->>'competency'='cmp:c2|nexo causal')=2 as disciplina from e2 \gset
\if :disciplina \else \echo FALHA disciplina \quit \endif
-- Escopo do aluno: só as linhas dele
select (select bool_and(r->>'studentId'=(select ana from stu)::text) and count(*) filter (where (r->>'applicationId')::uuid in (select id from ap))=3 from jsonb_array_elements(
  public.vertice_avalia_competency_evidence(:I::uuid,:C::uuid,jsonb_build_object('studentId',(select ana from stu)))->'rows') r) as aluno \gset
\if :aluno \else \echo FALHA aluno \quit \endif
-- Escopo ambíguo e terceiro sem vínculo
select pg_temp.expect_error(format('select public.vertice_avalia_competency_evidence(%L,%L,%L)',:I,:C,jsonb_build_object('discipline','x','studentId',(select ana from stu))::text),'22023');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_competency_evidence(%L,%L,%L)',:I,:C,jsonb_build_object('discipline','x')::text),'42501');
\echo AVALIA360_COMPETENCY_TESTS_OK
