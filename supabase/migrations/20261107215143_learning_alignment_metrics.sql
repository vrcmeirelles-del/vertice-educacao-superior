-- Produz somente indicadores agregados por competências explicitamente validadas.
-- Não infere notas oficiais, períodos letivos ou relações disciplina-competência.
CREATE OR REPLACE FUNCTION public.vertice_bridge_refresh_metrics(p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE inserted_count integer:=0;
BEGIN
  DELETE FROM public.vertice_learning_course_metrics WHERE institution_id=p_institution;
  WITH mapped AS (
    SELECT e.institution_id,e.course_id,e.academic_semester AS semester,m.subject_code,
      e.module,m.mapped_competency AS competency,e.student_token,e.graded,e.correct
    FROM vertice_private.learning_events e
    JOIN vertice_private.learning_subject_maps m
      ON m.institution_id=e.institution_id AND m.course_id=e.course_id
      AND m.external_module=e.module AND m.validation_status='validated'
      AND (m.mapped_competency='*'
        OR lower(trim(coalesce(e.source_competency,'')))=lower(trim(m.mapped_competency)))
    WHERE e.institution_id=p_institution AND e.academic_semester IS NOT NULL
  ), by_student AS (
    SELECT institution_id,course_id,semester,subject_code,module,competency,student_token,
      count(*)::integer AS attempts,
      count(*) FILTER(WHERE graded)::integer AS graded_count,
      count(*) FILTER(WHERE graded AND correct)::integer AS correct_count
    FROM mapped GROUP BY institution_id,course_id,semester,subject_code,module,competency,student_token
  ), grade_by_student AS (
    SELECT institution_id,course_id,semester,subject_code,student_token,
      avg(score/score_max) AS internal_grade
    FROM vertice_private.learning_curricular_grades
    WHERE institution_id=p_institution
    GROUP BY institution_id,course_id,semester,subject_code,student_token
  ), paired AS (
    SELECT s.*, g.internal_grade,
      CASE WHEN s.graded_count>=5 THEN s.correct_count::numeric/s.graded_count ELSE NULL END AS external_grade
    FROM by_student s
    LEFT JOIN grade_by_student g
      ON g.institution_id=s.institution_id AND g.course_id=s.course_id
      AND g.semester=s.semester AND g.subject_code=s.subject_code AND g.student_token=s.student_token
  ), metrics AS (
    SELECT institution_id,course_id,semester,subject_code,module,competency,
      count(*)::integer AS participants,sum(attempts)::integer AS attempts,
      sum(graded_count)::integer AS graded,sum(correct_count)::integer AS correct,
      count(*) FILTER(WHERE internal_grade IS NOT NULL AND external_grade IS NOT NULL)::integer AS paired_students,
      avg(internal_grade) FILTER(WHERE internal_grade IS NOT NULL AND external_grade IS NOT NULL) AS curricular_average,
      avg(external_grade) FILTER(WHERE internal_grade IS NOT NULL AND external_grade IS NOT NULL) AS external_accuracy
    FROM paired GROUP BY institution_id,course_id,semester,subject_code,module,competency
    HAVING count(*)>=5
  )
  INSERT INTO public.vertice_learning_course_metrics(
    institution_id,course_id,semester,subject_code,module,competency,
    participants,attempts,graded,correct,activity_rate,paired_students,
    curricular_average,external_accuracy,comparison_gap,updated_at
  )
  SELECT institution_id,course_id,semester,subject_code,module,competency,
    participants,attempts,graded,correct,NULL::numeric,paired_students,
    CASE WHEN paired_students>=5 THEN round(curricular_average,4) ELSE NULL END,
    CASE WHEN paired_students>=5 THEN round(external_accuracy,4) ELSE NULL END,
    CASE WHEN paired_students>=5 THEN round(curricular_average-external_accuracy,4) ELSE NULL END,
    now()
  FROM metrics;
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  RETURN jsonb_build_object('published_groups',inserted_count,'minimum_cohort',5,
    'minimum_graded_per_paired_student',5,
    'note','Average curricular grade and external accuracy remain null until five linked students have enough assessments.');
END;
$fn$;
REVOKE ALL ON FUNCTION public.vertice_bridge_refresh_metrics(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_bridge_refresh_metrics(uuid) TO service_role;
