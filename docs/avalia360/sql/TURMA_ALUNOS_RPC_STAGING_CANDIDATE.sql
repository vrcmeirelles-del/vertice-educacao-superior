-- Avalia 360°: candidato STAGING, não aplicado em produção.
-- Escopo real verificado em vertice_roster_imports/entries.
-- Não expõe CPF/hash, telefone, email ou student_token.
BEGIN;
CREATE OR REPLACE FUNCTION public.vertice_avalia_class_roster(
 p_institution uuid, p_course uuid, p_discipline text, p_class text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE actor uuid:=auth.uid(); role_name text; valid_teacher boolean; output jsonb;
BEGIN
 IF actor IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2'
 THEN RAISE EXCEPTION 'MFA obrigatório' USING ERRCODE='42501'; END IF;
 IF p_institution IS NULL OR p_course IS NULL
  OR p_class IS NULL OR length(btrim(p_class)) NOT BETWEEN 1 AND 40
  OR p_discipline IS NULL OR length(btrim(p_discipline)) NOT BETWEEN 1 AND 120
 THEN RAISE EXCEPTION 'Escopo inválido' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.vertice_courses c
                WHERE c.id=p_course AND c.institution_id=p_institution)
 THEN RAISE EXCEPTION 'Curso fora da instituição' USING ERRCODE='42501'; END IF;
 role_name:=vertice_private.member_role(p_institution);
 valid_teacher:=role_name IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
   OR EXISTS (SELECT 1 FROM public.vertice_learning_staff_scope sc
        WHERE sc.institution_id=p_institution AND sc.course_id=p_course
          AND sc.subject_code=p_discipline AND sc.user_id=actor AND sc.active);
 IF NOT coalesce(valid_teacher,false)
 THEN RAISE EXCEPTION 'Docente sem vínculo autorizado' USING ERRCODE='42501'; END IF;
 WITH last_completed AS (
  SELECT ri.id FROM public.vertice_roster_imports ri
  WHERE ri.institution_id=p_institution AND ri.course_id=p_course AND ri.status='done'
  ORDER BY ri.completed_at DESC NULLS LAST,ri.created_at DESC
  LIMIT 1
 ), students AS (
   SELECT e.id, e.student_name, e.turma, e.periodo, e.status,
          e.student_token
   FROM public.vertice_roster_entries e
   JOIN last_completed imp ON imp.id=e.import_id
   WHERE e.institution_id=p_institution
     AND lower(btrim(e.turma))=lower(btrim(p_class))
     AND e.status='matched'
 ), eligible AS (
   SELECT id,student_name,turma,periodo,status FROM students
   WHERE student_token IS NOT NULL AND length(btrim(student_token))>0
 )
 SELECT jsonb_build_object(
  'source','vertice_roster_entries',
  'classLabel',p_class,
  'students',coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',student_name,'classLabel',turma,'period',periodo,'status',status
  ) ORDER BY student_name) FILTER (WHERE id IS NOT NULL),'[]'::jsonb),
  'registrationVerified',false,
  'requiresTeacherReview',true
 ) INTO output FROM eligible;
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.vertice_avalia_class_roster(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_avalia_class_roster(uuid,uuid,text,text) TO authenticated;
COMMIT;
