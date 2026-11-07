CREATE OR REPLACE FUNCTION public.vertice_bridge_map_subject(
  p_institution uuid,p_course uuid,p_subject text,p_module text,
  p_competency text,p_evidence text,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF p_subject IS NULL OR length(btrim(p_subject))<1 OR length(p_subject)>120
    OR p_module NOT IN ('oab','cfc','enade','delegado','pf','estadual','federal','defensoria','mp')
    OR p_competency IS NULL OR length(btrim(p_competency))<3 OR length(p_competency)>500
    OR p_evidence IS NULL OR length(btrim(p_evidence))<3 OR length(p_evidence)>1000
  THEN RAISE EXCEPTION 'Invalid verified mapping'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_courses
  WHERE id=p_course AND institution_id=p_institution) THEN RAISE EXCEPTION 'Course/institution mismatch'; END IF;
 INSERT INTO vertice_private.learning_subject_maps(institution_id,course_id,subject_code,
  external_module,mapped_competency,validation_status,evidence_ref,validated_by,validated_at)
 VALUES(p_institution,p_course,btrim(p_subject),p_module,btrim(p_competency),'validated',
   btrim(p_evidence),p_actor,NOW())
 ON CONFLICT(institution_id,course_id,subject_code,external_module,mapped_competency)
 DO UPDATE SET validation_status='validated',evidence_ref=excluded.evidence_ref,
   validated_by=excluded.validated_by,validated_at=NOW();
 RETURN jsonb_build_object('mapped',TRUE,'status','validated');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.vertice_bridge_reconcile_semesters(p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE n integer:=0;
BEGIN
 UPDATE vertice_private.learning_events e SET academic_semester=w.academic_semester
 FROM vertice_private.learning_semester_windows w
 WHERE e.institution_id=p_institution
   AND w.institution_id=e.institution_id AND w.course_id=e.course_id
   AND e.source_occurred_at::date BETWEEN w.starts_on AND w.ends_on
   AND e.academic_semester IS DISTINCT FROM w.academic_semester;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN jsonb_build_object('reconciled',n);
END;
$fn$;

REVOKE ALL ON FUNCTION public.vertice_bridge_map_subject(uuid,uuid,text,text,text,text,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vertice_bridge_reconcile_semesters(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_bridge_map_subject(uuid,uuid,text,text,text,text,uuid),
 public.vertice_bridge_reconcile_semesters(uuid) TO service_role;
