-- Testes do bloco 3: evidência de erros e planos de recuperação.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
create temp table disc as select 'Tributário '||substr(md5(random()::text),1,6) d;
create temp table bk as select gen_random_uuid() b1;
create temp table stu as select (select id from public.vertice_student_registry where full_name='Ana') ana,(select id from public.vertice_student_registry where full_name='Bruna') bruna;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.vertice_avalia_bank(:I::uuid,:C::uuid,(select d from disc),'save',jsonb_build_object('record',jsonb_build_object('bankId',(select b1 from bk),
 'competencies','[{"id":"k2","code":"C2","title":"Prescrição","period":2}]'::jsonb,
 'question',jsonb_build_object('kind','objetiva','statement','Sobre prescrição tributária, assinale.','competencyIds','["k2"]'::jsonb,'images','[]'::jsonb)))) is not null as banco \gset
create temp table dr as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,(select d from disc),'create',jsonb_build_object(
 'meta',jsonb_build_object('title','AV Trib','semester','2027/1','purpose','formativa','declaredPedagogy',jsonb_build_object(
   'competencies','[{"id":"k2","code":"C2","title":"Prescrição","period":2}]'::jsonb,'relations','[]'::jsonb)),
 'questions',jsonb_build_array(jsonb_build_object('id','t1','disciplineId',(select d from disc),'kind','objetiva','statement','Sobre prescrição tributária, assinale.',
   'points',1,'competencyIds','["k2"]'::jsonb,'sourceBankId',(select b1 from bk)::text,
   'options','[{"id":"A","text":"Cinco anos"},{"id":"B","text":"Dez anos"},{"id":"C","text":"Três anos"}]'::jsonb,'correctOptionId','A',
   'answerJustification','Art. 174 CTN.','distractorNotes','{"B":"Confunde prescrição com decadência","C":""}'::jsonb,'images','[]'::jsonb))))->>'id')::uuid id;
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from dr),'expectedRevision',1)) is not null as s \gset
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from dr),'expectedRevision',1,'justification','Validado para recuperação.')) is not null as v \gset
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table ap as select (public.vertice_avalia_application(:I::uuid,:C::uuid,'create',jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,'variantCount',1,
 'variantMap','{"A":[{"q":"t1","o":["A","B","C"]}]}'::jsonb,'classLabel','4º','appliedOn',current_date))->>'id')::uuid id;
select public.vertice_avalia_application(:I::uuid,:C::uuid,'save_sheets',jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(
 jsonb_build_object('studentId',(select ana from stu),'variant','A','objective','{"1":"B"}'::jsonb),
 jsonb_build_object('studentId',(select bruna from stu),'variant','A','objective','{"1":"C"}'::jsonb),
 jsonb_build_object('label','X-1','variant','A','objective','{"1":"A"}'::jsonb)))) is not null as l \gset
create temp table e as select public.vertice_avalia_error_evidence(:I::uuid,:C::uuid,jsonb_build_object('applicationId',(select id from ap))) j;
select jsonb_array_length(j->'errors')=2 and jsonb_array_length(j->'students')=3
   and (select x->>'note' from jsonb_array_elements(j->'errors') x where x->>'label'='Ana')='Confunde prescrição com decadência'
   and (select x->'note' from jsonb_array_elements(j->'errors') x where x->>'label'='Bruna')='null'::jsonb
   and (select x->'competencies' from jsonb_array_elements(j->'errors') x where x->>'label'='Ana')='["cmp:c2|prescrição"]'::jsonb
   and (select (x->>'n')::int from jsonb_array_elements(j->'objectiveAnswers') x)=3
   and (select x->'bankIds' from jsonb_array_elements(j->'answeredBank') x where x->>'label'='Ana')=jsonb_build_array((select b1 from bk)::text) as erros from e \gset
\if :erros \else \echo FALHA erros \quit \endif
-- Escopo da disciplina: só encerradas e só alunos do cadastro
select jsonb_array_length(public.vertice_avalia_error_evidence(:I::uuid,:C::uuid,jsonb_build_object('discipline',(select d from disc)))->'errors')=0 as so_encerradas \gset
\if :so_encerradas \else \echo FALHA so_encerradas \quit \endif
select public.vertice_avalia_application(:I::uuid,:C::uuid,'close',jsonb_build_object('id',(select id from ap))) is not null as f \gset
select not exists(select 1 from jsonb_array_elements(public.vertice_avalia_error_evidence(:I::uuid,:C::uuid,jsonb_build_object('discipline',(select d from disc)))->'students') x
  where x->>'label'='X-1') as so_cadastro \gset
\if :so_cadastro \else \echo FALHA so_cadastro \quit \endif
-- Planos de recuperação
select pg_temp.expect_error(format('select public.vertice_avalia_recovery(%L,%L,%L,%L)',:I,:C,'create',jsonb_build_object('discipline',(select d from disc),'plans',jsonb_build_array(
 jsonb_build_object('studentId',(select ana from stu),'startOn',current_date,'competencies','["cmp:c2|prescrição"]'::jsonb,'items',jsonb_build_array(jsonb_build_object('bankId',gen_random_uuid(),'competency','cmp:c2|prescrição')))))::text),'22023');
select pg_temp.expect_error(format('select public.vertice_avalia_recovery(%L,%L,%L,%L)',:I,:C,'create',jsonb_build_object('discipline',(select d from disc),'plans',jsonb_build_array(
 jsonb_build_object('studentId',gen_random_uuid(),'startOn',current_date,'competencies','["x"]'::jsonb,'items',jsonb_build_array(jsonb_build_object('bankId',(select b1 from bk),'competency','x')))))::text),'22023');
select (public.vertice_avalia_recovery(:I::uuid,:C::uuid,'create',jsonb_build_object('discipline',(select d from disc),'plans',jsonb_build_array(
 jsonb_build_object('studentId',(select ana from stu),'startOn',current_date,'rulesVersion','2026.11-1','competencies','["cmp:c2|prescrição"]'::jsonb,
  'items',jsonb_build_array(jsonb_build_object('bankId',(select b1 from bk),'competency','cmp:c2|prescrição'))))))->>'created')='1' as criou \gset
\if :criou \else \echo FALHA criou \quit \endif
create temp table pl as select x->>'id' id, x from jsonb_array_elements(public.vertice_avalia_recovery(:I::uuid,:C::uuid,'list',jsonb_build_object('discipline',(select d from disc)))) x;
select count(*)=1 and bool_and(x->'items'->0->>'statement' like 'Sobre prescrição%') as lista from pl \gset
\if :lista \else \echo FALHA lista \quit \endif
select (public.vertice_avalia_recovery(:I::uuid,:C::uuid,'record',jsonb_build_object('id',(select id from pl),'entry',jsonb_build_object('bankId',(select b1 from bk),'on',current_date,'correct',true)))->>'entries')='1' as registrou \gset
\if :registrou \else \echo FALHA registrou \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_recovery(%L,%L,%L,%L)',:I,:C,'record',jsonb_build_object('id',(select id from pl),'entry',jsonb_build_object('bankId',(select b1 from bk),'on',current_date-400,'correct',true))::text),'22023');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_recovery(%L,%L,%L,%L)',:I,:C,'list','{}'),'42501');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_recovery(:I::uuid,:C::uuid,'close',jsonb_build_object('id',(select id from pl)))->>'status'='closed' as fechou \gset
\if :fechou \else \echo FALHA fechou \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_recovery(%L,%L,%L,%L)',:I,:C,'record',jsonb_build_object('id',(select id from pl),'entry',jsonb_build_object('bankId',(select b1 from bk),'on',current_date,'correct',false))::text),'23514');
\echo AVALIA360_RECOVERY_TESTS_OK
