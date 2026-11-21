-- Testes do bloco 2: descritores de competência no banco e exposição por turma.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
create temp table disc as select 'Empresarial '||substr(md5(random()::text),1,6) d;
create temp table bk as select gen_random_uuid() b1, gen_random_uuid() b2;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
-- Banco guarda só descritores citados pela questão, com código e título
create temp table s1 as select public.vertice_avalia_bank(:I::uuid,:C::uuid,(select d from disc),'save',jsonb_build_object('record',jsonb_build_object(
 'bankId',(select b1 from bk),'indexLabels','[]'::jsonb,
 'competencies','[{"id":"k1","code":" C1 ","title":"Títulos de crédito","period":4},{"id":"k9","code":"C9","title":"Não citada","period":1},{"id":"k1b","code":"","title":"Sem código"}]'::jsonb,
 'question',jsonb_build_object('kind','objetiva','statement','Sobre o aval, assinale a correta.','competencyIds','["k1","k1b"]'::jsonb,'images','[]'::jsonb)))) j;
select (j->'competencies')='[{"id":"k1","code":"C1","title":"Títulos de crédito","period":4}]'::jsonb as descritores from s1 \gset
\if :descritores \else \echo FALHA descritores \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_bank(%L,%L,%L,%L,%L)',:I,:C,(select d from disc),'save',jsonb_build_object('record',jsonb_build_object(
 'bankId',gen_random_uuid(),'competencies','{"x":1}'::jsonb,'question',jsonb_build_object('kind','objetiva','statement','Enunciado válido aqui','images','[]'::jsonb)))::text),'22023');
select (select r->'competencies'->0->>'code' from jsonb_array_elements(public.vertice_avalia_bank(:I::uuid,:C::uuid,(select d from disc),'list','{}')) r
  where r->>'bankId'=(select b1 from bk)::text)='C1' as lista \gset
\if :lista \else \echo FALHA lista \quit \endif
-- Exposição: aplica caderno com b1 na turma "3º A"
\set P '''{"meta":{"title":"AV Empresarial","semester":"2027/1","purpose":"formativa"},"questions":[{"id":"z1","kind":"objetiva","statement":"Sobre o aval, assinale a correta.","points":1,"competencyIds":["k1"],"options":[{"id":"A","text":"a"},{"id":"B","text":"b"}],"correctOptionId":"A","answerJustification":"ok","images":[]}]}'''
create temp table dr as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,(select d from disc),'create',
 jsonb_set(jsonb_set(:P::jsonb,'{questions,0,disciplineId}',to_jsonb((select d from disc))),'{questions,0,sourceBankId}',to_jsonb((select b1 from bk)::text)))->>'id')::uuid id;
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from dr),'expectedRevision',1)) is not null as s \gset
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from dr),'expectedRevision',1,'justification','Validado para teste de exposição.')) is not null as v \gset
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.vertice_avalia_application(:I::uuid,:C::uuid,'create',jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,'variantCount',1,
 'variantMap','{"A":[{"q":"z1","o":["A","B"]}]}'::jsonb,'classLabel','3º  A','appliedOn',current_date-10)) is not null as ap \gset
select (public.vertice_avalia_bank_exposure(:I::uuid,:C::uuid,(select d from disc),'3º a')->(select b1 from bk)::text->>'lastAppliedOn')=(current_date-10)::text
   and public.vertice_avalia_bank_exposure(:I::uuid,:C::uuid,(select d from disc),'5º B')='{}'::jsonb
   and (public.vertice_avalia_bank_exposure(:I::uuid,:C::uuid,(select d from disc),'')->(select b1 from bk)::text->>'applications')::int=1 as exposicao \gset
\if :exposicao \else \echo FALHA exposicao \quit \endif
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_bank_exposure(%L,%L,%L,%L)',:I,:C,'x',''),'42501');
\echo AVALIA360_ASSEMBLY_TESTS_OK
