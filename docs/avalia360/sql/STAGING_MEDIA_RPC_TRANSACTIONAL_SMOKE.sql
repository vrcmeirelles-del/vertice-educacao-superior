-- Avalia 360°: teste de contrato RPC de imagem no PostgreSQL real da branch.
-- Simula confirmação do hash pelo service_role; NÃO faz upload no Storage.
-- Dados estritamente sintéticos e removidos por ROLLBACK.
BEGIN;
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000001'::uuid);
INSERT INTO public.vertice_institutions(id,name)
 VALUES ('00000000-0000-4000-8000-000000000011'::uuid,'IES HOMOLOGACAO DE MIDIA');
INSERT INTO public.vertice_courses(id,institution_id,name)
 VALUES ('00000000-0000-4000-8000-000000000021'::uuid,
  '00000000-0000-4000-8000-000000000011'::uuid,'Direito Sintetico');
INSERT INTO public.vertice_learning_staff_scope(institution_id,course_id,subject_code,user_id,active)
 VALUES ('00000000-0000-4000-8000-000000000011'::uuid,
   '00000000-0000-4000-8000-000000000021'::uuid,'civil',
   '00000000-0000-4000-8000-000000000001'::uuid,true);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}';
DO $media_prepare$
DECLARE t jsonb;
BEGIN
 SELECT public.vertice_avalia_media(
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000021'::uuid,
  'civil','00000000-0000-4000-8000-000000000051'::uuid,
  'prepare',jsonb_build_object('sha256',repeat('a',64),'mime','image/png','sizeBytes',1024))
 INTO t;
 IF t->>'imageId' IS NULL
   OR t->>'path' NOT LIKE '00000000-0000-4000-8000-000000000011/00000000-0000-4000-8000-000000000021/%'
 THEN RAISE EXCEPTION 'Ticket inválido'; END IF;
 PERFORM set_config('test.avalia_media_id',t->>'imageId',true);
 PERFORM set_config('test.avalia_media_path',t->>'path',true);
END $media_prepare$;
SET LOCAL ROLE service_role;
SELECT public.vertice_avalia_media_finalize(
 current_setting('test.avalia_media_id')::uuid,repeat('a',64),1024,'image/png'
);
SET LOCAL ROLE authenticated;
DO $media_draft$
DECLARE receipt jsonb; loaded jsonb; q jsonb; img jsonb;
BEGIN
 img:=jsonb_build_object(
  'imageId',current_setting('test.avalia_media_id'),
  'path',current_setting('test.avalia_media_path'),
  'sha256',repeat('a',64),'mime','image/png','sizeBytes',1024,
  'altText','Gráfico sintético de Direito Civil',
  'placement','enunciado','rightsStatus','autoral','order',0);
 q:=jsonb_build_object(
  'id','00000000-0000-4000-8000-000000000051',
  'disciplineId','civil','statement','Enunciado sintético com figura anexa.',
  'topicIds',jsonb_build_array('tema1'),
  'competencyIds',jsonb_build_array('competencia1'),
  'points',1,'pendingImageCount',1,
  'images',jsonb_build_array(img));
 SELECT public.vertice_avalia_draft(
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000021'::uuid,
  'civil','create',jsonb_build_object('questions',jsonb_build_array(q))) INTO receipt;
 SELECT public.vertice_avalia_draft(
  '00000000-0000-4000-8000-000000000011'::uuid,
  '00000000-0000-4000-8000-000000000021'::uuid,
  'civil','get',jsonb_build_object('id',receipt->>'id')) INTO loaded;
 IF loaded->'snapshot'->'questions'->0->'images'->0->>'imageId'
    IS DISTINCT FROM current_setting('test.avalia_media_id') THEN
    RAISE EXCEPTION 'Imagem não preservada na reabertura';
 END IF;
END $media_draft$;
RESET ROLE;
SELECT 'PASS' AS media_rpc_simulated_smoke;
ROLLBACK;
