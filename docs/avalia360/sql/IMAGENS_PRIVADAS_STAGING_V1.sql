-- Avalia 360: proposta de persistência da mídia privada, somente para staging.
-- Exige 'RASCUNHOS_RPC_STAGING_V1.sql' previamente homologado.
-- NÃO aplicar automaticamente em produção.
BEGIN;
CREATE TABLE vertice_avalia.question_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  course_id uuid NOT NULL,
  discipline_code text NOT NULL CHECK (length(btrim(discipline_code)) BETWEEN 1 AND 120),
  question_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  storage_path text NOT NULL UNIQUE,
  expected_sha256 text NOT NULL CHECK (expected_sha256 ~ '^[a-f0-9]{64}$'),
  actual_sha256 text CHECK (actual_sha256 IS NULL OR actual_sha256 ~ '^[a-f0-9]{64}$'),
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','confirmed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  FOREIGN KEY (course_id,institution_id)
    REFERENCES public.vertice_courses(id,institution_id),
  CHECK ((state='confirmed') = (actual_sha256 IS NOT NULL AND confirmed_at IS NOT NULL))
);
CREATE INDEX avalia_question_media_scope ON vertice_avalia.question_media
 (institution_id,course_id,created_by,question_id,state);
ALTER TABLE vertice_avalia.question_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_avalia.question_media FROM PUBLIC,anon,authenticated;

-- Apenas esta RPC autenticada pode registrar e inspecionar o ticket.
CREATE OR REPLACE FUNCTION public.vertice_avalia_media(
 p_institution uuid,p_course uuid,p_discipline text,p_question uuid,
 p_action text,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE
 actor uuid := auth.uid(); r text; v_authorized boolean;
 rec vertice_avalia.question_media%ROWTYPE;
 media_id uuid; file_extension text; storage_path text;
 declared_hash text := lower(coalesce(p_payload->>'sha256',''));
 declared_mime text := p_payload->>'mime';
 declared_size bigint;
BEGIN
 IF actor IS NULL OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN
   RAISE EXCEPTION 'MFA obrigatório' USING ERRCODE='42501';
 END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
   OR octet_length(p_payload::text)>4000 THEN
   RAISE EXCEPTION 'Payload inválido' USING ERRCODE='22023';
 END IF;
 IF p_institution IS NULL OR p_course IS NULL OR p_question IS NULL
   OR p_discipline IS NULL OR length(btrim(p_discipline)) NOT BETWEEN 1 AND 120
   OR NOT EXISTS(SELECT 1 FROM public.vertice_courses c
     WHERE c.id=p_course AND c.institution_id=p_institution) THEN
   RAISE EXCEPTION 'Escopo inválido' USING ERRCODE='22023';
 END IF;
 r:=vertice_private.member_role(p_institution);
 v_authorized:=r IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
   OR EXISTS(SELECT 1 FROM public.vertice_learning_staff_scope sc
     WHERE sc.user_id=actor AND sc.institution_id=p_institution
       AND sc.course_id=p_course AND sc.subject_code=p_discipline AND sc.active);
 IF NOT coalesce(v_authorized,false) THEN
   RAISE EXCEPTION 'Acesso negado ao curso/disciplina' USING ERRCODE='42501';
 END IF;
 IF p_action='prepare' THEN
   IF declared_hash !~ '^[a-f0-9]{64}$' OR
     declared_mime NOT IN ('image/png','image/jpeg','image/webp')
     OR jsonb_typeof(p_payload->'sizeBytes') IS DISTINCT FROM 'number'
     OR coalesce(p_payload->>'sizeBytes','') !~ '^[0-9]+$' THEN
     RAISE EXCEPTION 'Metadados inválidos' USING ERRCODE='22023';
   END IF;
   declared_size:=(p_payload->>'sizeBytes')::bigint;
   IF declared_size NOT BETWEEN 1 AND 10485760 THEN
     RAISE EXCEPTION 'Tamanho inválido' USING ERRCODE='22023';
   END IF;
   IF (SELECT count(*) FROM vertice_avalia.question_media m
        WHERE m.institution_id=p_institution AND m.course_id=p_course
          AND m.created_by=actor AND m.question_id=p_question
          AND m.state IN ('pending','confirmed'))>=12 THEN
     RAISE EXCEPTION 'Limite de imagens da questão atingido' USING ERRCODE='22023';
   END IF;
   file_extension:=CASE declared_mime WHEN 'image/png' THEN 'png'
     WHEN 'image/jpeg' THEN 'jpg' ELSE 'webp' END;
   media_id:=gen_random_uuid();
   storage_path:=p_institution::text||'/'||p_course::text||'/'||
       actor::text||'/'||p_question::text||'/'||media_id::text||'.'||file_extension;
   INSERT INTO vertice_avalia.question_media
     (id,institution_id,course_id,discipline_code,question_id,created_by,
      storage_path,expected_sha256,mime,size_bytes)
   VALUES (media_id,p_institution,p_course,p_discipline,p_question,actor,
      storage_path,declared_hash,declared_mime,declared_size);
   RETURN jsonb_build_object('imageId',media_id,'path',storage_path);
 ELSIF p_action='inspect' THEN
   IF coalesce(p_payload->>'imageId','') !~
     '^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$' THEN
     RAISE EXCEPTION 'Identificador inválido' USING ERRCODE='22023';
   END IF;
   SELECT * INTO rec FROM vertice_avalia.question_media m
   WHERE m.id=(p_payload->>'imageId')::uuid
     AND m.institution_id=p_institution AND m.course_id=p_course
     AND m.discipline_code=p_discipline AND m.question_id=p_question
     AND m.created_by=actor;
   IF NOT FOUND OR rec.storage_path IS DISTINCT FROM p_payload->>'path'
     THEN RAISE EXCEPTION 'Imagem fora do escopo' USING ERRCODE='42501';
   END IF;
   RETURN jsonb_build_object('imageId',rec.id,'path',rec.storage_path,
     'state',rec.state,'sha256',rec.expected_sha256,'mime',rec.mime,
     'sizeBytes',rec.size_bytes);
 ELSE
   RAISE EXCEPTION 'Operação inválida' USING ERRCODE='22023';
 END IF;
END $$;

-- Operação privativa do serviço após baixar e hashear o objeto real.
CREATE OR REPLACE FUNCTION public.vertice_avalia_media_finalize(
 p_image uuid,p_actual_sha text,p_actual_size integer,p_actual_mime text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE r vertice_avalia.question_media%ROWTYPE;
BEGIN
 SELECT * INTO r FROM vertice_avalia.question_media
   WHERE id=p_image FOR UPDATE;
 IF NOT FOUND OR r.state<>'pending'
    OR r.expected_sha256 IS DISTINCT FROM lower(p_actual_sha)
    OR r.size_bytes IS DISTINCT FROM p_actual_size
    OR r.mime IS DISTINCT FROM p_actual_mime THEN
   RAISE EXCEPTION 'Verificação de integridade falhou' USING ERRCODE='22023';
 END IF;
 UPDATE vertice_avalia.question_media
   SET state='confirmed',actual_sha256=lower(p_actual_sha),confirmed_at=now()
   WHERE id=p_image;
 RETURN jsonb_build_object('imageId',r.id,'path',r.storage_path,
   'sha256',lower(p_actual_sha),'mime',r.mime,'sizeBytes',r.size_bytes);
END $$;

REVOKE ALL ON FUNCTION public.vertice_avalia_media(uuid,uuid,text,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_avalia_media(uuid,uuid,text,uuid,text,jsonb)
  TO authenticated;
REVOKE ALL ON FUNCTION public.vertice_avalia_media_finalize(uuid,text,integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_avalia_media_finalize(uuid,text,integer,text)
  TO service_role;
COMMIT;

-- A criação do bucket 'avalia360-private' deve ocorrer exclusivamente no
-- ambiente de homologação por migração revisada e bucket NÃO público.
-- REQUER teste de permissões reais de Storage antes do deploy da Edge Function.
