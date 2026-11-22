-- Testes da emissão registrada de cadernos e da leitura do QR (20261122290000).
-- A (autor, record), B (coordenação, validate), C (sem vínculo). Requer as migrações do Avalia 360°.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal','aal2')::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
create or replace function pg_temp.pp(a text, p jsonb) returns jsonb language sql as
$$ select public.vertice_avalia_papers('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',a,p) $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
\set P '''{"meta":{"title":"AV QR","semester":"2027/1","purpose":"somativa"},"questions":[{"id":"q1","competencyIds":["c-q1"],"disciplineId":"Penal QR","kind":"objetiva","statement":"Sobre o dolo eventual, assinale","points":2,"options":[{"id":"A","text":"x1"},{"id":"B","text":"x2"},{"id":"C","text":"x3"}],"correctOptionId":"B","answerJustification":"Teoria do consentimento.","images":[]},{"id":"q2","competencyIds":["c-q2"],"disciplineId":"Penal QR","kind":"discursiva","statement":"Explique a teoria finalista da ação.","points":3,"rubric":"Conceito e exemplo.","expectedAnswer":"Welzel; ação dirigida a fim.","images":[]}]}'''
\set MAP '''{"A":[{"q":"q1","o":["A","B","C"]},{"q":"q2","o":[]}],"B":[{"q":"q2","o":[]},{"q":"q1","o":["C","B","A"]}]}'''
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table dr as select (public.vertice_avalia_draft(:I::uuid,:C::uuid,'Penal QR','create',:P::jsonb)->>'id')::uuid id;
select public.vertice_avalia_review(:I::uuid,:C::uuid,'submit',jsonb_build_object('id',(select id from dr),'expectedRevision',1)) is not null as s \gset
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.vertice_avalia_review(:I::uuid,:C::uuid,'validate',jsonb_build_object('id',(select id from dr),'expectedRevision',1,'justification','Adequado ao período e à competência.')) is not null as v \gset
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temp table ap as select (public.vertice_avalia_application(:I::uuid,:C::uuid,'create',
 jsonb_build_object('draftId',(select id from dr),'expectedRevision',1,'variantCount',2,'variantMap',:MAP::jsonb,'classLabel','3º A','appliedOn',current_date))->>'id')::uuid id;
create temp table st as select id from public.vertice_student_registry where full_name='Ana';

-- Etapa 1: emissão. Versão inexistente, aluno fora do curso e lote vazio são recusados.
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','issue',jsonb_build_object('applicationId',(select id from ap),'papers',jsonb_build_array(jsonb_build_object('label','X','variant','F')))),'22023');
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','issue',jsonb_build_object('applicationId',(select id from ap),'papers',jsonb_build_array(jsonb_build_object('studentId',gen_random_uuid(),'variant','A')))),'22023');
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','issue',jsonb_build_object('applicationId',(select id from ap),'papers','[]'::jsonb)),'22023');
create temp table iss as select pg_temp.pp('issue',jsonb_build_object('applicationId',(select id from ap),'papers',jsonb_build_array(
 jsonb_build_object('studentId',(select id from st),'variant','B'),jsonb_build_object('label','Código 07','variant','A')))) j;
select jsonb_array_length(j)=2 and (j->0->>'token') ~ '^[0-9a-f]{64}$' and (j->0->>'qr')=('VA360:2:'||upper(j->0->>'token'))
   and (j->0->>'shortCode') ~ '^[A-HJ-NP-Z2-9]{8}$' and j->0->>'label'='Ana' and j->0->>'variant'='B' as emitiu from iss \gset
\if :emitiu \else \echo FALHA emitiu \quit \endif
-- O banco guarda só o hash do token
select not exists(select 1 from public.vertice_avalia_issued_papers p, iss where p.token_hash=iss.j->0->>'token')
   and exists(select 1 from public.vertice_avalia_issued_papers p, iss where p.token_hash=encode(sha256(convert_to(iss.j->0->>'token','UTF8')),'hex')) as so_hash \gset
\if :so_hash \else \echo FALHA so_hash \quit \endif

-- Etapa 2: leitura do QR (texto completo, só o token em maiúsculas) e do código curto.
select (pg_temp.pp('scan',jsonb_build_object('code',(select j->0->>'qr' from iss)))->>'label')='Ana'
   and (pg_temp.pp('scan',jsonb_build_object('code',upper((select j->0->>'token' from iss))))->>'variant')='B'
   and (pg_temp.pp('scan',jsonb_build_object('code',(select j->1->>'shortCode' from iss),'applicationId',(select id from ap)))->>'label')='Código 07' as leu \gset
\if :leu \else \echo FALHA leu \quit \endif
select pg_temp.expect_error($$select pg_temp.pp('scan','{"code":"VA360-DEMO:1:A:abc"}')$$,'22023');
select pg_temp.expect_error($$select pg_temp.pp('scan','{"code":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}')$$,'P0002');
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','scan',jsonb_build_object('code',(select j->1->>'shortCode' from iss))),'22023');

-- Salvar pelo caderno: versão e aluno vêm do servidor. Versão B: pos1=q2, pos2=q1 com C,B,A; marca "B" -> B (correta).
create temp table sv as select pg_temp.pp('save',jsonb_build_object('paperId',(select j->0->>'paperId' from iss),'variant','A','studentId',gen_random_uuid(),
 'objective','{"2":"B"}'::jsonb,'discursive','{"q2":1.5}'::jsonb)) j;
select (j->'sheet'->>'total')::numeric=3.5 and j->>'variant'='B' and j->>'label'='Ana' and j->>'sheetId' is not null as salvou from sv \gset
\if :salvou \else \echo FALHA salvou \quit \endif
select (select variant from public.vertice_avalia_sheets where id=(select (j->>'sheetId')::uuid from sv))='B'
   and (select student_id from public.vertice_avalia_sheets where id=(select (j->>'sheetId')::uuid from sv))=(select id from st) as folha_certa \gset
\if :folha_certa \else \echo FALHA folha_certa \quit \endif
-- Aparece na aplicação como folha normal (mesma correção)
select (select count(*) from jsonb_array_elements(public.vertice_avalia_application(:I::uuid,:C::uuid,'get',jsonb_build_object('id',(select id from ap)))->'sheets'))=1 as na_aplicacao \gset
\if :na_aplicacao \else \echo FALHA na_aplicacao \quit \endif

-- Reimpressão anula o caderno anterior do mesmo aluno e herda a folha já lançada
create temp table re as select pg_temp.pp('issue',jsonb_build_object('applicationId',(select id from ap),'papers',jsonb_build_array(jsonb_build_object('studentId',(select id from st),'variant','B')))) j;
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','scan',jsonb_build_object('code',(select j->0->>'qr' from iss))),'23514');
select (select j->0->>'sheetId' from re)=(select j->>'sheetId' from sv) and jsonb_array_length(pg_temp.pp('list',jsonb_build_object('applicationId',(select id from ap))))=2 as reimpressao \gset
\if :reimpressao \else \echo FALHA reimpressao \quit \endif
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','save',jsonb_build_object('paperId',(select j->0->>'paperId' from iss),'objective','{}'::jsonb)),'23514');

-- Sem vínculo: recusado; coordenação lê
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','scan',jsonb_build_object('code',(select j->0->>'qr' from re))),'42501');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select (pg_temp.pp('scan',jsonb_build_object('code',(select j->0->>'qr' from re)))->>'label')='Ana' as coord_le \gset
\if :coord_le \else \echo FALHA coord_le \quit \endif

-- Aplicação encerrada: leitura sim, emissão e lançamento não
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.vertice_avalia_application(:I::uuid,:C::uuid,'close',jsonb_build_object('id',(select id from ap))) is not null as fechou \gset
select (pg_temp.pp('scan',jsonb_build_object('code',(select j->0->>'qr' from re)))->>'applicationStatus')='closed' as le_fechada \gset
\if :le_fechada \else \echo FALHA le_fechada \quit \endif
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','save',jsonb_build_object('paperId',(select j->0->>'paperId' from re),'objective','{}'::jsonb)),'23514');
select pg_temp.expect_error(format('select pg_temp.pp(%L,%L)','issue',jsonb_build_object('applicationId',(select id from ap),'papers',jsonb_build_array(jsonb_build_object('label','Y','variant','A')))),'23514');

-- Sem acesso direto à tabela
set role authenticated;
select pg_temp.expect_error('select * from public.vertice_avalia_issued_papers','42501');
reset role;
\echo AVALIA360_PAPERS_TESTS_OK
