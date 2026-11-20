-- Vértice Avalia 360: smoke PostgreSQL real na branch ISOLADA.
-- Insere dados puramente sintéticos e sempre ROLLBACK.
-- Não comprova login real via HTTP/JWT assinado nem Storage HTTP.
BEGIN;
INSERT INTO auth.users(id)
 VALUES ('00000000-0000-4000-8000-000000000001'::uuid);
INSERT INTO public.vertice_institutions(id,name)
 VALUES ('00000000-0000-4000-8000-000000000011'::uuid,'IES HOMOLOGACAO SINTETICA');
INSERT INTO public.vertice_courses(id,institution_id,name)
 VALUES
 ('00000000-0000-4000-8000-000000000021'::uuid,'00000000-0000-4000-8000-000000000011'::uuid,'Direito Teste'),
 ('00000000-0000-4000-8000-000000000022'::uuid,'00000000-0000-4000-8000-000000000011'::uuid,'Curso Sem Vínculo');
INSERT INTO public.vertice_learning_staff_scope(institution_id,course_id,subject_code,user_id,active)
 VALUES (
 '00000000-0000-4000-8000-000000000011'::uuid,
 '00000000-0000-4000-8000-000000000021'::uuid,
 'civil','00000000-0000-4000-8000-000000000001'::uuid,true
 );
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
DO $avalia_smoke$
DECLARE
 draft jsonb; result jsonb; questions jsonb;
BEGIN
 questions:=jsonb_build_array(jsonb_build_object(
  'id','questao-sintetica',
  'disciplineId','civil',
  'statement','Considere um caso sintético de responsabilidade civil.',
  'topicIds',jsonb_build_array('tema-sintetico'),
  'competencyIds',jsonb_build_array('competencia-sintetica'),
  'points',2,
  'pendingImageCount',0,
  'images',jsonb_build_array()
 ));
 SELECT public.vertice_avalia_draft(
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000021'::uuid,
  'civil','create',jsonb_build_object('questions',questions)) INTO draft;
 IF (draft->>'revision')::int<>1 THEN
   RAISE EXCEPTION 'Revisão criada incorretamente';
 END IF;
 SELECT public.vertice_avalia_draft(
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000021'::uuid,
  'civil','get',jsonb_build_object('id',draft->>'id')) INTO result;
 IF (result->'snapshot'->'questions'->0->>'id') IS DISTINCT FROM 'questao-sintetica' THEN
   RAISE EXCEPTION 'Recuperação do snapshot falhou';
 END IF;
 SELECT public.vertice_avalia_draft(
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000021'::uuid,
  'civil','update',
   jsonb_build_object('id',draft->>'id','expectedRevision',1,'questions',questions)) INTO result;
 IF (result->>'revision')::int<>2 THEN
   RAISE EXCEPTION 'Revisão não incrementada';
 END IF;
 BEGIN
  PERFORM public.vertice_avalia_draft(
   '00000000-0000-4000-8000-000000000011'::uuid,
   '00000000-0000-4000-8000-000000000021'::uuid,
   'civil','update',
   jsonb_build_object('id',draft->>'id','expectedRevision',1,'questions',questions));
  RAISE EXCEPTION 'Deveria rejeitar revisão desatualizada';
 EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
 END;
 BEGIN
  PERFORM public.vertice_avalia_draft(
   '00000000-0000-4000-8000-000000000011'::uuid,
   '00000000-0000-4000-8000-000000000022'::uuid,
   'civil','create',jsonb_build_object('questions',questions));
  RAISE EXCEPTION 'Deveria rejeitar outro curso';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',true);
 BEGIN
  PERFORM public.vertice_avalia_draft(
   '00000000-0000-4000-8000-000000000011'::uuid,
   '00000000-0000-4000-8000-000000000021'::uuid,
   'civil','create',jsonb_build_object('questions',questions));
  RAISE EXCEPTION 'Deveria rejeitar sessão AAL1';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END $avalia_smoke$;
RESET ROLE;
ROLLBACK;
