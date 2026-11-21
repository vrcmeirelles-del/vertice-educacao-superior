-- Testes de aplicação e lançamento. A (autor), B (coordenação/validate), C (sem vínculo).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
-- Caderno: q1 objetiva (correta B, 2 pts), q2 discursiva (3 pts), q3 objetiva (correta A, 1 pt)
\set P '''{"meta":{"title":"AV1 Penal","semester":"2027/1","purpose":"somativa"},"questions":[{"id":"q1","competencyIds":["c-q1"],"disciplineId":"Penal","kind":"objetiva","statement":"Sobre o dolo eventual, assinale","points":2,"options":[{"id":"A","text":"x1"},{"id":"B","text":"x2"},{"id":"C","text":"x3"}],"correctOptionId":"B","answerJustification":"Teoria do consentimento.","images":[]},{"id":"q2","competencyIds":["c-q2"],"disciplineId":"Penal","kind":"discursiva","statement":"Explique a teoria finalista da ação.","points":3,"rubric":"Conceito e exemplo.","expectedAnswer":"Welzel; ação dirigida a fim.","images":[]},{"id":"q3","competencyIds":["c-q3"],"disciplineId":"Penal","kind":"objetiva","statement":"Sobre a legítima defesa, assinale","points":1,"options":[{"id":"A","text":"y1"},{"id":"B","text":"y2"}],"correctOptionId":"A","answerJustification":"Art. 25 CP.","images":[]}]}'''
-- Versão A = ordem original; versão B = q3,q2,q1 com alternativas invertidas
\set MAP '''{"A":[{"q":"q1","o":["A","B","C"]},{"q":"q2","o":[]},{"q":"q3","o":["A","B"]}],"B":[{"q":"q3","o":["B","A"]},{"q":"q2","o":[]},{"q":"q1","o":["C","B","A"]}]}'''

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table dr as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Penal','create',:P::jsonb)->>'id')::uuid id;
-- Rascunho não pode ser aplicado
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'create',
 jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,'variantCount',2,'variantMap',:MAP::jsonb,'classLabel','3º A','appliedOn',current_date)::text),'23514');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from dr),'expectedRevision',1)) is not null as s \gset
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from dr),'expectedRevision',1,'justification','Adequado ao período e à competência.')) is not null as v \gset
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
-- Mapa adulterado (alternativa inexistente / questão faltando) é recusado
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'create',
 jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,'variantCount',1,'variantMap','{"A":[{"q":"q1","o":["A","B","Z"]},{"q":"q2","o":[]},{"q":"q3","o":["A","B"]}]}'::jsonb,'classLabel','3º A','appliedOn',current_date)::text),'22023');
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'create',
 jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,'variantCount',1,'variantMap','{"A":[{"q":"q1","o":["A","B","C"]},{"q":"q2","o":[]}]}'::jsonb,'classLabel','3º A','appliedOn',current_date)::text),'22023');
create temp table ap as select (public.vertice_avalia_application(:I::uuid,:C::uuid,'create',
 jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,'variantCount',2,'variantMap',:MAP::jsonb,'classLabel','3º A','appliedOn',current_date))->>'id')::uuid id;
-- Folhas: Ana versão A (B, nota 2.5, A) = 2+2.5+1 = 5.5 ; código "X-07" versão B (marca A em q3? B-> q3 opção A correta; q1 marca "C" -> opção A errada)
create temp table st as select id from public.vertice_student_registry where full_name='Ana';
select (public.vertice_avalia_application(:I::uuid,:C::uuid,'save_sheets',jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(
  jsonb_build_object('studentId',(select id from st),'variant','A','objective','{"1":"B","3":"A"}'::jsonb,'discursive','{"q2":2.5}'::jsonb),
  jsonb_build_object('label','X-07','variant','B','objective','{"1":"B","3":"C"}'::jsonb,'discursive','{}'::jsonb)
)))->>'saved')='2' as salvou \gset
\if :salvou \else \echo FALHA salvou \quit \endif
create temp table g as select public.vertice_avalia_application(:I::uuid,:C::uuid,'get',jsonb_build_object('id',(select id from ap))) j;
select (select (s->>'total')::numeric from jsonb_array_elements(j->'sheets') s where s->>'label'='Ana')=5.5 as nota_ana from g \gset
\if :nota_ana \else \echo FALHA nota_ana \quit \endif
-- X-07: versão B pos1 = q3, marca B -> opção A (correta, 1 pt); pos3 = q1, marca C -> opção A (errada); q2 pendente
select (select (s->>'total')::numeric from jsonb_array_elements(j->'sheets') s where s->>'label'='X-07')=1
   and (select i->>'outcome' from jsonb_array_elements(j->'sheets') s, jsonb_array_elements(s->'items') i where s->>'label'='X-07' and i->>'q'='q2')='pending'
   and (select i->>'outcome' from jsonb_array_elements(j->'sheets') s, jsonb_array_elements(s->'items') i where s->>'label'='X-07' and i->>'q'='q1')='wrong' as nota_x07 from g \gset
\if :nota_x07 \else \echo FALHA nota_x07 \quit \endif
-- Relançar a mesma pessoa substitui, não duplica; branco e múltipla marcação
select public.vertice_avalia_application(:I::uuid,:C::uuid,'save_sheets',jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(
  jsonb_build_object('label','x-07','variant','B','objective','{"1":"-","3":"*"}'::jsonb,'discursive','{"q2":3}'::jsonb)))) is not null as r \gset
select (select count(*) from public.vertice_avalia_sheets where application_id=(select id from ap))=2
   and (select count(*) from public.vertice_avalia_item_scores i join public.vertice_avalia_sheets s on s.id=i.sheet_id
        where s.student_label='X-07' and s.application_id=(select id from ap) and i.outcome in ('blank','multiple'))=2 as relanca \gset
\if :relanca \else \echo FALHA relanca \quit \endif
-- Nota de discursiva acima do máximo, letra inexistente, versão inexistente
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'save_sheets',
 jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(jsonb_build_object('label','Z','variant','A','discursive','{"q2":4}'::jsonb)))::text),'22023');
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'save_sheets',
 jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(jsonb_build_object('label','Z','variant','A','objective','{"3":"D"}'::jsonb)))::text),'22023');
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'save_sheets',
 jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(jsonb_build_object('label','Z','variant','F')))::text),'22023');
-- Aluno de outro curso
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'save_sheets',
 jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(jsonb_build_object('studentId',gen_random_uuid(),'variant','A')))::text),'22023');
-- Terceiro não lê
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'get',jsonb_build_object('id',(select id from ap))::text),'42501');
-- Coordenação lê; após encerrar, lançamento bloqueado
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select jsonb_array_length(public.vertice_avalia_application(:I::uuid,:C::uuid,'list','{}'))>=1 as coord_lista \gset
\if :coord_lista \else \echo FALHA coord_lista \quit \endif
select public.vertice_avalia_application(:I::uuid,:C::uuid,'close',jsonb_build_object('id',(select id from ap)))->>'status'='closed' as fechou \gset
\if :fechou \else \echo FALHA fechou \quit \endif
select pg_temp.expect_error(format('select public.vertice_avalia_application(%L,%L,%L,%L)',:I,:C,'save_sheets',
 jsonb_build_object('id',(select id from ap),'sheets',jsonb_build_array(jsonb_build_object('label','Y','variant','A')))::text),'23514');
\echo AVALIA360_APPLICATION_TESTS_OK
