-- AVALIA 360° | RPC de rascunhos — CANDIDATO PARA STAGING, NÃO APLICAR EM PRODUÇÃO
-- Base: public.vertice_courses, public.vertice_memberships e public.vertice_learning_staff_scope.
-- Não pressupor correspondência com vertice_app.courses; currículo não é derivado automaticamente.
BEGIN;
CREATE SCHEMA IF NOT EXISTS vertice_avalia;
REVOKE ALL ON SCHEMA vertice_avalia FROM PUBLIC,anon,authenticated;

CREATE TABLE vertice_avalia.assessment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  course_id uuid NOT NULL,
  discipline_code text NOT NULL CHECK(length(btrim(discipline_code)) BETWEEN 1 AND 120),
  author_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','validated','archived')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
  curriculum_build_id uuid REFERENCES vertice_app.curriculum_builds(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(course_id) REFERENCES public.vertice_courses(id) ON DELETE RESTRICT
);
-- Realidade confirmada da Vértice: public.vertice_courses tem PRIMARY KEY (id),
-- e índices únicos de (id,institution_id). O trigger reforça o escopo.
CREATE OR REPLACE FUNCTION vertice_avalia.guard_course_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard_scope$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.vertice_courses c
   WHERE c.id=NEW.course_id AND c.institution_id=NEW.institution_id
 ) THEN
   RAISE EXCEPTION 'Curso pertence a outra instituição' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $guard_scope$;
REVOKE ALL ON FUNCTION vertice_avalia.guard_course_scope() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER avalia_draft_course_scope
 BEFORE INSERT OR UPDATE OF institution_id,course_id
 ON vertice_avalia.assessment_drafts
 FOR EACH ROW EXECUTE FUNCTION vertice_avalia.guard_course_scope();

CREATE INDEX avalia_draft_author_idx ON vertice_avalia.assessment_drafts
 (institution_id,course_id,author_id,updated_at DESC);
CREATE TABLE vertice_avalia.assessment_draft_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES vertice_avalia.assessment_drafts(id) ON DELETE RESTRICT,
  institution_id uuid NOT NULL, course_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK(action IN ('create','update')),
  revision integer NOT NULL CHECK(revision>=1),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  curriculum_build_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(draft_id,revision)
);
CREATE TRIGGER avalia_draft_events_course_scope
 BEFORE INSERT OR UPDATE OF institution_id,course_id
 ON vertice_avalia.assessment_draft_events
 FOR EACH ROW EXECUTE FUNCTION vertice_avalia.guard_course_scope();
ALTER TABLE vertice_avalia.assessment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_avalia.assessment_draft_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_avalia.assessment_drafts,vertice_avalia.assessment_draft_events FROM PUBLIC,anon,authenticated;
-- Os eventos preservam snapshots de todas as revisões; revogar UPDATE/DELETE de usuários.
-- Dados privados acessíveis apenas pela RPC autorizada, não pela Data API diretamente.

CREATE OR REPLACE FUNCTION public.vertice_avalia_draft(
 p_institution uuid,p_course uuid,p_discipline text,p_action text,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE
 v_user uuid := (SELECT auth.uid());
 v_role text;
 v_authorized boolean := false;
 v_snapshot jsonb;
 v_questions jsonb;
 v_id uuid;
 v_previous vertice_avalia.assessment_drafts%ROWTYPE;
 v_revision integer;
 v_build uuid;
 v_item jsonb;
 v_media jsonb;
 v_image jsonb;
 v_image_count integer;
BEGIN
 IF v_user IS NULL OR (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN
   RAISE EXCEPTION 'MFA e autenticação obrigatórios' USING ERRCODE='42501';
 END IF;
 IF p_institution IS NULL OR p_course IS NULL OR p_discipline IS NULL
    OR length(btrim(p_discipline)) NOT BETWEEN 1 AND 120 OR
    NOT EXISTS (SELECT 1 FROM public.vertice_courses c
      WHERE c.id=p_course AND c.institution_id=p_institution) THEN
   RAISE EXCEPTION 'Instituição, curso ou disciplina inválidos' USING ERRCODE='22023';
 END IF;
 v_role := vertice_private.member_role(p_institution);
 -- Docentes/coordenadores com lotação comprovada para disciplina e curso;
 -- acesso pleno institucional apenas para gerir próprios rascunhos.
 v_authorized := v_role IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
  OR EXISTS (SELECT 1 FROM public.vertice_learning_staff_scope s
       WHERE s.user_id=v_user AND s.institution_id=p_institution
       AND s.course_id=p_course AND s.subject_code=p_discipline AND s.active);
 IF NOT coalesce(v_authorized,false) THEN
   RAISE EXCEPTION 'Vínculo de disciplina ou curso não autorizado' USING ERRCODE='42501';
 END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
     OR octet_length(p_payload::text)>150000 THEN
   RAISE EXCEPTION 'Payload de avaliação inválido' USING ERRCODE='22023';
 END IF;
 IF p_action='get' THEN
   SELECT * INTO v_previous FROM vertice_avalia.assessment_drafts
    WHERE id=(p_payload->>'id')::uuid AND institution_id=p_institution
      AND course_id=p_course AND discipline_code=p_discipline AND author_id=v_user;
   IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho não encontrado' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('id',v_previous.id,'revision',v_previous.revision,
     'status',v_previous.status,'snapshot',v_previous.snapshot);
 ELSIF p_action='list' THEN
   RETURN jsonb_build_object('drafts',coalesce(
     (SELECT jsonb_agg(jsonb_build_object('id',d.id,'revision',d.revision,'status',d.status,'updatedAt',d.updated_at)
       ORDER BY d.updated_at DESC) FROM
       (SELECT * FROM vertice_avalia.assessment_drafts
         WHERE institution_id=p_institution AND course_id=p_course
           AND discipline_code=p_discipline AND author_id=v_user
         ORDER BY updated_at DESC LIMIT 50) d),'[]'::jsonb));
 END IF;
 IF p_action NOT IN ('create','update') THEN
   RAISE EXCEPTION 'Ação não permitida' USING ERRCODE='22023';
 END IF;
 v_questions:=p_payload->'questions';
 IF jsonb_typeof(v_questions) IS DISTINCT FROM 'array'
   OR jsonb_array_length(v_questions) NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'A prova precisa de 1 a 100 questões' USING ERRCODE='22023';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_questions)
 LOOP
   IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
      OR length(btrim(coalesce(v_item->>'id','')))<1
      OR length(btrim(coalesce(v_item->>'statement','')))<10
      OR v_item->>'disciplineId' IS DISTINCT FROM p_discipline
      OR jsonb_typeof(v_item->'topicIds') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_item->'competencyIds') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_item->'pendingImageCount') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_item->'images') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_item->'points') IS DISTINCT FROM 'number'
      OR (v_item->>'points')::numeric <= 0 THEN
      RAISE EXCEPTION 'Questão inválida ou com mídia sem upload autorizado'
       USING ERRCODE='22023';
   END IF;
   v_media:=v_item->'images';
   v_image_count:=jsonb_array_length(v_media);
   IF v_image_count>12 OR (v_item->>'pendingImageCount')::integer<>v_image_count THEN
     RAISE EXCEPTION 'Quantidade de imagens inválida' USING ERRCODE='22023';
   END IF;
   IF v_image_count>0 THEN
     IF coalesce(v_item->>'id','') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
       RAISE EXCEPTION 'Questão com imagens exige identificador UUID' USING ERRCODE='22023';
     END IF;
     IF (SELECT count(DISTINCT media->>'imageId') FROM jsonb_array_elements(v_media) AS media)
       <>v_image_count THEN
       RAISE EXCEPTION 'Imagens duplicadas no rascunho' USING ERRCODE='22023';
     END IF;
   END IF;
   FOR v_image IN SELECT value FROM jsonb_array_elements(v_media)
   LOOP
     IF jsonb_typeof(v_image) IS DISTINCT FROM 'object' OR
       coalesce(v_image->>'imageId','') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR length(btrim(coalesce(v_image->>'altText',''))) < 3
       OR coalesce(v_image->>'rightsStatus','') NOT IN ('autoral','licenciado','uso_autorizado')
       OR coalesce(v_image->>'placement','') NOT IN ('enunciado','alternativa','apoio')
       OR jsonb_typeof(v_image->'order') IS DISTINCT FROM 'number'
       OR (v_image->>'order')::integer NOT BETWEEN 0 AND 11
       OR NOT EXISTS(
         SELECT 1 FROM vertice_avalia.question_media m
         WHERE m.id=(v_image->>'imageId')::uuid
           AND m.institution_id=p_institution AND m.course_id=p_course
           AND m.discipline_code=p_discipline AND m.created_by=v_user
           AND m.question_id=(v_item->>'id')::uuid
           AND m.state='confirmed' AND m.storage_path=v_image->>'path'
           AND m.actual_sha256=v_image->>'sha256'
           AND m.mime=v_image->>'mime'
           AND m.size_bytes=(v_image->>'sizeBytes')::integer
       ) THEN
       RAISE EXCEPTION 'Imagem não confirmada ou fora do escopo da questão' USING ERRCODE='42501';
     END IF;
     IF v_image->>'placement'='alternativa' AND NOT EXISTS(
       SELECT 1 FROM jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) opt
       WHERE opt->>'id'=v_image->>'alternativeId'
     ) THEN
       RAISE EXCEPTION 'Alternativa vinculada à imagem não existe' USING ERRCODE='22023';
     END IF;
   END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(v_questions)) <>
    (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(v_questions)) THEN
   RAISE EXCEPTION 'Questão duplicada' USING ERRCODE='22023';
 END IF;
 -- Não permitir que o cliente crie vínculo falso com o currículo.
 v_build:=nullif(p_payload->>'buildId','')::uuid;
 IF v_build IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM vertice_app.curriculum_builds b
      WHERE b.id=v_build AND b.institution_id=p_institution AND
        b.course_id=p_course AND b.status='published') THEN
   RAISE EXCEPTION 'Currículo não vinculado ou não publicado'
    USING ERRCODE='22023';
 END IF;
 v_snapshot:=jsonb_build_object('questions',v_questions,'curriculumStatus',
    CASE WHEN v_build IS NULL THEN 'unmapped' ELSE 'linked' END);
 IF p_action='create' THEN
   IF p_payload ? 'id' OR p_payload ? 'expectedRevision' THEN
     RAISE EXCEPTION 'Identificador/versão indevido na criação' USING ERRCODE='22023';
   END IF;
   INSERT INTO vertice_avalia.assessment_drafts
     (institution_id,course_id,discipline_code,author_id,curriculum_build_id,snapshot)
   VALUES (p_institution,p_course,p_discipline,v_user,v_build,v_snapshot)
   RETURNING id,revision INTO v_id,v_revision;
 ELSE
   IF p_payload->>'id' IS NULL OR p_payload->>'expectedRevision' IS NULL THEN
     RAISE EXCEPTION 'ID e revisão obrigatórios' USING ERRCODE='22023';
   END IF;
   SELECT * INTO v_previous FROM vertice_avalia.assessment_drafts
      WHERE id=(p_payload->>'id')::uuid AND institution_id=p_institution
      AND course_id=p_course AND discipline_code=p_discipline
      AND author_id=v_user FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho não localizado' USING ERRCODE='22023'; END IF;
   IF v_previous.status <> 'draft' THEN
      RAISE EXCEPTION 'Apenas rascunhos podem ser editados' USING ERRCODE='22023';
   END IF;
   IF v_previous.revision <> (p_payload->>'expectedRevision')::integer THEN
      RAISE EXCEPTION 'Conflito de versão; recarregue o rascunho' USING ERRCODE='40001';
   END IF;
   UPDATE vertice_avalia.assessment_drafts
    SET snapshot=v_snapshot,curriculum_build_id=v_build,
        revision=revision+1,updated_at=now()
    WHERE id=v_previous.id RETURNING id,revision INTO v_id,v_revision;
 END IF;
 INSERT INTO vertice_avalia.assessment_draft_events(draft_id,institution_id,course_id,actor_id,action,revision,snapshot,curriculum_build_id)
 VALUES (v_id,p_institution,p_course,v_user,p_action,v_revision,v_snapshot,v_build);
 RETURN jsonb_build_object('id',v_id,'revision',v_revision,'status','draft');
END;
$$;
REVOKE ALL ON FUNCTION public.vertice_avalia_draft(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_avalia_draft(uuid,uuid,text,text,jsonb) TO authenticated;
COMMIT;

-- Não aplicada. Antes de execução: testes Postgres de RLS, autorização por
-- disciplina, tentativas de IDOR, revisão concorrente, grants e rollback.
-- Questões com imagens não são gravadas até o gateway seguro de upload existir.
