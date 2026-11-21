-- Testes do fluxo de validação pelo colegiado. A (autor, record), B (validate), C (sem vínculo).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
\set OK '''{"meta":{"title":"Prova validada","semester":"2027/1","purpose":"somativa"},"questions":[{"id":"r1","competencyIds":["c-r1"],"disciplineId":"Processo Civil","kind":"objetiva","statement":"Assinale a alternativa correta sobre o caso","points":1,"options":[{"id":"A","text":"Primeira"},{"id":"B","text":"Segunda"}],"correctOptionId":"A","answerJustification":"Art. 1º.","images":[]}]}'''

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
-- Caderno com bloqueio (sem justificativa do gabarito) não é enviado
create temp table bad as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Processo Civil','create',
  jsonb_set(:OK::jsonb,'{questions,0,answerJustification}','""'))->>'id')::uuid id;
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'submit',
  jsonb_build_object('id',(select id from bad),'expectedRevision',1)::text), '23514');
-- Caderno correto: versão errada é recusada; versão certa é enviada
create temp table ok as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Processo Civil','create',:OK::jsonb)->>'id')::uuid id;
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'submit',
  jsonb_build_object('id',(select id from ok),'expectedRevision',9)::text), '40001');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from ok),'expectedRevision',1,'checklist','{"warnings":1}'::jsonb))->>'status'='submitted' as enviado \gset
\if :enviado \else \echo FALHA enviado \quit \endif
-- Enviado não pode ser editado pelo autor
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I,:C,'Processo Civil','update',
  (:OK::jsonb || jsonb_build_object('id',(select id from ok),'expectedRevision',1))::text), '23514');
-- Autor não acessa a fila nem valida
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'queue','{}'), '42501');
-- Terceiro sem vínculo não vê nada
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'history',jsonb_build_object('id',(select id from ok))::text), '42501');
-- Coordenação: fila, devolução exige motivo e justificativa
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select exists(select 1 from jsonb_array_elements(public.vertice_avalia_review(:I::uuid,:C::uuid,'queue','{}')) e where e->>'id'=(select id::text from ok)) as na_fila \gset
\if :na_fila \else \echo FALHA na_fila \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'return',
  jsonb_build_object('id',(select id from ok),'expectedRevision',1,'justification','Revisar o enunciado da questão 1.')::text), '22023');
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'return',
  jsonb_build_object('id',(select id from ok),'expectedRevision',1,'reasons','["enunciado"]'::jsonb,'justification','curta')::text), '22023');
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'return',
  jsonb_build_object('id',(select id from ok),'expectedRevision',1,'reasons','["inventado"]'::jsonb,'justification','Motivo fora da lista padronizada.')::text), '23514');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'return',jsonb_build_object('id',(select id from ok),'expectedRevision',1,
  'reasons','["enunciado","alternativas"]'::jsonb,'justification','O enunciado não é autossuficiente; alternativas pouco plausíveis.'))->>'status'='draft' as devolvido \gset
\if :devolvido \else \echo FALHA devolvido \quit \endif
-- Autor corrige (versão 2), reenvia; coordenação valida
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.vertice_avalia_draft(:I::uuid,:C::uuid,'Processo Civil','update',:OK::jsonb || jsonb_build_object('id',(select id from ok),'expectedRevision',1))->>'revision'='2' as v2 \gset
\if :v2 \else \echo FALHA v2 \quit \endif
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from ok),'expectedRevision',2))->>'status'='submitted' as reenviado \gset
\if :reenviado \else \echo FALHA reenviado \quit \endif
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from ok),'expectedRevision',2,
  'justification','Itens adequados à competência e ao nível do período.'))->>'status'='validated' as validado \gset
\if :validado \else \echo FALHA validado \quit \endif
-- Validado é imutável; histórico tem 4 eventos; indicadores refletem a devolução
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error(format('select public.vertice_avalia_draft(%L,%L,%L,%L,%L)', :I,:C,'Processo Civil','update',
  (:OK::jsonb || jsonb_build_object('id',(select id from ok),'expectedRevision',2))::text), '23514');
select jsonb_array_length(public.vertice_avalia_review(:I::uuid,:C::uuid,'history',jsonb_build_object('id',(select id from ok))))=4 as historico \gset
\if :historico \else \echo FALHA historico \quit \endif
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
create temp table ind as select public.vertice_avalia_review(:I::uuid,:C::uuid,'indicators','{}') j;
select (j->>'validated')::int>=1 and (j->>'returns')::int>=1 and (j->'returnReasons'->>'enunciado')::int>=1 as indicadores from ind \gset
\if :indicadores \else \echo FALHA indicadores \quit \endif
-- Segregação: validador que é autor do próprio caderno não valida
create temp table own as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Processo Civil','create',:OK::jsonb)->>'id')::uuid id;
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from own),'expectedRevision',1)) is not null as ok_own \gset
select pg_temp.expect_error(format('select public.vertice_avalia_review(%L,%L,%L,%L)', :I,:C,'validate',
  jsonb_build_object('id',(select id from own),'expectedRevision',1,'justification','Autovalidação não permitida.')::text), '42501');
\echo AVALIA360_REVIEW_TESTS_OK
