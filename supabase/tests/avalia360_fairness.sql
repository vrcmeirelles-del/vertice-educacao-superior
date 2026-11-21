-- Testes do bloco 4: rubrica estruturada no servidor, matriz anonimizada e dupla correção cega.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
create temp table disc as select 'Penal III '||substr(md5(random()::text),1,6) d;
create temp table pl as select jsonb_build_object('meta',jsonb_build_object('title','AV Penal','semester','2027/1','purpose','somativa'),
 'questions',jsonb_build_array(
  jsonb_build_object('id','o1','disciplineId',(select d from disc),'kind','objetiva','statement','Sobre o erro de tipo, assinale.','points',1,'competencyIds','["c"]'::jsonb,
   'options','[{"id":"A","text":"a"},{"id":"B","text":"b"}]'::jsonb,'correctOptionId','A','answerJustification','ok','images','[]'::jsonb),
  jsonb_build_object('id','d1','disciplineId',(select d from disc),'kind','discursiva','statement','Explique a teoria limitada da culpabilidade.','points',2,'competencyIds','["c"]'::jsonb,
   'rubric','','rubricCriteria','[{"id":"k1","label":"Conceito","points":1},{"id":"k2","label":"Exemplo","points":0.5}]'::jsonb,'expectedAnswer','Padrão.','images','[]'::jsonb))) p;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table dr as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,(select d from disc),'create',(select p from pl))->>'id')::uuid id;
-- Soma dos critérios (1,5) diferente da pontuação (2) bloqueia o envio
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)',:I,:C,'submit',jsonb_build_object('id',(select id from dr),'expectedRevision',1)::text),'23514');
select (public.vertice_avalia_draft(:I::uuid,:C::uuid,(select d from disc),'update',
 jsonb_set((select p from pl),'{questions,1,rubricCriteria,1,points}','1') || jsonb_build_object('id',(select id from dr),'expectedRevision',1))->>'revision')='2' as corrigiu \gset
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from dr),'expectedRevision',2))->>'status'='submitted' as enviou \gset
\if :enviou \else \echo FALHA enviou \quit \endif
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from dr),'expectedRevision',2,'justification','Rubrica estruturada adequada.')) is not null as v \gset
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table ap as select (public.vertice_avalia_application(:I::uuid,:C::uuid,'create',jsonb_build_object('draftId',(select id from dr),'expectedRevision',2,'variantCount',2,
 'variantMap','{"A":[{"q":"o1","o":["A","B"]},{"q":"d1","o":[]}],"B":[{"q":"d1","o":[]},{"q":"o1","o":["B","A"]}]}'::jsonb,'classLabel','6º','appliedOn',current_date))->>'id')::uuid id;
select public.vertice_avalia_application(:I::uuid,:C::uuid,'save_sheets',jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(
 jsonb_build_object('studentId',(select id from public.vertice_student_registry where full_name='Ana'),'variant','A','objective','{"1":"A"}'::jsonb,'discursive','{"d1":1.5}'::jsonb),
 jsonb_build_object('label','P-02','variant','B','objective','{"2":"B"}'::jsonb,'discursive','{"d1":1}'::jsonb),
 jsonb_build_object('label','P-03','variant','B','objective','{"2":"A"}'::jsonb)))) is not null as l \gset
-- Matriz anonimizada: sem nome, rótulo ou identificador de aluno
create temp table mx as select public.vertice_avalia_response_matrix(:I::uuid,:C::uuid,(select id from ap)) j;
select jsonb_array_length(j->'sheets')=3 and j::text not like '%Ana%' and j::text not like '%P-02%' and j::text not like '%studentId%'
   and (select count(*) from jsonb_array_elements(j->'sheets') s where s->>'variant'='B')=2 as anonima from mx \gset
\if :anonima \else \echo FALHA anonima \quit \endif
-- Amostra: só folhas com discursiva corrigida, sem a nota do 1º corretor
create temp table sm as select public.vertice_avalia_double_scoring(:I::uuid,:C::uuid,'sample',jsonb_build_object('applicationId',(select id from ap),'share',1,'min',1)) j;
select (j->>'population')::int=2 and (j->>'size')::int=2 and j::text not like '%"total"%' and j::text not like '%1.5%'
   and jsonb_array_length(j->'questions')=1 and jsonb_array_length(j->'questions'->0->'rubricCriteria')=2 as amostra from sm \gset
\if :amostra \else \echo FALHA amostra \quit \endif
-- Quem lançou a 1ª correção não faz a 2ª
select pg_temp.expect_error(format('select public.vertice_avalia_double_scoring(%L,%L,%L,%L)',:I,:C,'save',jsonb_build_object('applicationId',(select id from ap),
 'scores',jsonb_build_array(jsonb_build_object('sheetId',(select j->'sheets'->0->>'sheetId' from sm),'questionId','d1','score',1)))::text),'42501');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error(format('select public.vertice_avalia_double_scoring(%L,%L,%L,%L)',:I,:C,'save',jsonb_build_object('applicationId',(select id from ap),
 'scores',jsonb_build_array(jsonb_build_object('sheetId',(select j->'sheets'->0->>'sheetId' from sm),'questionId','d1','score',1.5,'criteria','{"k1":1,"k2":1}'::jsonb)))::text),'22023');
select pg_temp.expect_error(format('select public.vertice_avalia_double_scoring(%L,%L,%L,%L)',:I,:C,'save',jsonb_build_object('applicationId',(select id from ap),
 'scores',jsonb_build_array(jsonb_build_object('sheetId',(select j->'sheets'->0->>'sheetId' from sm),'questionId','d1','score',3)))::text),'22023');
select (public.vertice_avalia_double_scoring(:I::uuid,:C::uuid,'save',jsonb_build_object('applicationId',(select id from ap),'scores',
 (select jsonb_agg(jsonb_build_object('sheetId',s->>'sheetId','questionId','d1','score',1.5,'criteria','{"k1":1,"k2":0.5}'::jsonb)) from sm, jsonb_array_elements(j->'sheets') s)))->>'saved')='2' as salvou \gset
\if :salvou \else \echo FALHA salvou \quit \endif
-- Concordância: pares (1º, 2º) da discursiva
select (select jsonb_array_length(q->'pairs') from jsonb_array_elements(public.vertice_avalia_double_scoring(:I::uuid,:C::uuid,'agreement',
  jsonb_build_object('applicationId',(select id from ap)))->'questions') q)=2 as pares \gset
\if :pares \else \echo FALHA pares \quit \endif
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_response_matrix(%L,%L,%L)',:I,:C,(select id from ap)),'42501');
\echo AVALIA360_FAIRNESS_TESTS_OK
