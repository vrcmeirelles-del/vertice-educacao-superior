-- Testes da análise de itens. Valores esperados calculados de forma independente (Python, TCT).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
\set P '''{"meta":{"title":"AV2 Constitucional","semester":"2027/1","purpose":"somativa"},"questions":[{"id":"k1","sourceBankId":"bbbbbbbb-0000-0000-0000-000000000001","disciplineId":"Constitucional","kind":"objetiva","statement":"Controle concentrado: assinale","points":1,"estimatedDifficulty":2,"options":[{"id":"A","text":"ADI"},{"id":"B","text":"HC"},{"id":"C","text":"MS"}],"correctOptionId":"A","answerJustification":"Art. 102 CF.","images":[]},{"id":"k2","disciplineId":"Constitucional","kind":"objetiva","statement":"Sobre cláusulas pétreas, assinale","points":1,"options":[{"id":"A","text":"Podem ser abolidas"},{"id":"B","text":"Não podem ser abolidas"}],"correctOptionId":"B","answerJustification":"Art. 60, §4º.","images":[]},{"id":"k3","disciplineId":"Constitucional","kind":"discursiva","statement":"Explique o princípio da simetria.","points":2,"rubric":"Conceito e aplicação.","expectedAnswer":"Reprodução obrigatória do modelo federal.","images":[]}]}'''
\set MAP '''{"A":[{"q":"k1","o":["A","B","C"]},{"q":"k2","o":["A","B"]},{"q":"k3","o":[]}]}'''
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table bk as select gen_random_uuid()::text id;
create temp table dr as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Constitucional','create',jsonb_set(:P::jsonb,'{questions,0,sourceBankId}',to_jsonb((select id from bk))))->>'id')::uuid id;
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from dr),'expectedRevision',1)) is not null as s \gset
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from dr),'expectedRevision',1,'justification','Validado para aplicação na AV2.')) is not null as v \gset
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table ap as select (public.vertice_avalia_application(:I::uuid,:C::uuid,'create',jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,
 'variantCount',1,'variantMap',:MAP::jsonb,'classLabel','5º','appliedOn',current_date))->>'id')::uuid id;
select public.vertice_avalia_application(:I::uuid,:C::uuid,'save_sheets',jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(
 jsonb_build_object('label','S1','variant','A','objective','{"1":"A","2":"B"}'::jsonb,'discursive','{"k3":2}'::jsonb),
 jsonb_build_object('label','S2','variant','A','objective','{"1":"A","2":"B"}'::jsonb,'discursive','{"k3":1}'::jsonb),
 jsonb_build_object('label','S3','variant','A','objective','{"1":"A","2":"A"}'::jsonb,'discursive','{"k3":1.5}'::jsonb),
 jsonb_build_object('label','S4','variant','A','objective','{"1":"B","2":"B"}'::jsonb,'discursive','{"k3":1}'::jsonb),
 jsonb_build_object('label','S5','variant','A','objective','{"1":"C","2":"A"}'::jsonb,'discursive','{"k3":0.5}'::jsonb),
 jsonb_build_object('label','S6','variant','A','objective','{"1":"B","2":"-"}'::jsonb,'discursive','{"k3":0}'::jsonb),
 jsonb_build_object('label','S7 pendente','variant','A','objective','{"1":"A","2":"B"}'::jsonb)))) is not null as l \gset
create temp table r as select public.vertice_avalia_item_analysis(:I::uuid,:C::uuid,(select id from ap)) j;
-- Folhas: 7 lançadas, 6 completas (S7 tem discursiva pendente), grupos de 27% = 2
select (j->>'sheets')::int=7 and (j->>'complete')::int=6 and (j->>'groupSize')::int=2 and (j->>'meanScore')::numeric=2
 and (j->>'alpha')::numeric=0.7826 as geral from r \gset
\if :geral \else \echo FALHA geral \quit \endif
create temp table it as select e from r, jsonb_array_elements(j->'items') e;
select (select (e->>'p')::numeric=0.5 and (e->>'discrimination')::numeric=1 and (e->>'pointBiserial')::numeric=0.6667 from it where e->>'questionId'='k1')
   and (select (e->>'p')::numeric=0.5 and (e->>'discrimination')::numeric=1 and (e->>'pointBiserial')::numeric=0.4629 and (e->>'blanks')::int=1 from it where e->>'questionId'='k2')
   and (select (e->>'p')::numeric=0.5 and (e->>'discrimination')::numeric=0.625 and (e->>'pointBiserial')::numeric=0.7906 from it where e->>'questionId'='k3') as itens \gset
\if :itens \else \echo FALHA itens \quit \endif
-- Análise das alternativas de k1: A=3 (correta, 2 no grupo superior), B=2, C=1 (0 no superior, 1 no inferior)
select (select jsonb_agg(o order by o->>'optionId') from it, jsonb_array_elements(e->'options') o where e->>'questionId'='k1')
  = '[{"n":3,"nLower":0,"nUpper":2,"correct":true,"optionId":"A"},{"n":2,"nLower":1,"nUpper":0,"correct":false,"optionId":"B"},{"n":1,"nLower":1,"nUpper":0,"correct":false,"optionId":"C"}]'::jsonb as distratores \gset
\if :distratores \else \echo FALHA distratores \quit \endif
-- Calibração do banco: só depois de encerrar
select not (public.vertice_avalia_bank_calibration(:I::uuid,:C::uuid,'Constitucional') ? (select id from bk)) as sem_calibracao_aberta \gset
\if :sem_calibracao_aberta \else \echo FALHA sem_calibracao_aberta \quit \endif
select public.vertice_avalia_application(:I::uuid,:C::uuid,'close',jsonb_build_object('id',(select id from ap))) is not null as fechou \gset
select (c->>'n')::int=6 and (c->>'p')::numeric=0.5 and (c->>'discrimination')::numeric=1 and (c->>'applications')::int=1 as calibra
 from (select public.vertice_avalia_bank_calibration(:I::uuid,:C::uuid,'constitucional')->(select id from bk) c) x \gset
\if :calibra \else \echo FALHA calibra \quit \endif
-- Terceiro sem vínculo
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_item_analysis(%L,%L,%L)',:I,:C,(select id from ap)),'42501');
\echo AVALIA360_ITEM_ANALYSIS_TESTS_OK
