-- Enrich new planning jobs after existing snapshot triggers. The planning RPC
-- returns the exact inserted context, so the Edge's input_hash covers these sources.
-- No changes to historical snapshots, diagnosis severity, AC or extension.
BEGIN;
CREATE FUNCTION vertice_private.sapiens_teaching_pdi_context() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  v_term text := coalesce(NEW.context->>'requested_semester', NEW.semester);
  v_start date;
  v_end date;
  v_activities jsonb;
  v_goals jsonb;
  v_eligible bigint;
BEGIN
  IF NEW.scope IS DISTINCT FROM 'superior'
     OR (SELECT auth.uid()) IS NULL
     OR NEW.created_by IS DISTINCT FROM (SELECT auth.uid())
     OR NOT coalesce(vertice_planning.can_interpret(NEW.institution_id, NEW.course_id), false)
  THEN RETURN NEW; END IF;
  IF v_term IS NULL OR v_term !~ '^[0-9]{4}/[12]$'
     OR left(v_term, 4) = '0000'
  THEN RETURN NEW; END IF;
  v_start := make_date(left(v_term, 4)::integer, CASE right(v_term, 1) WHEN '1' THEN 1 ELSE 7 END, 1);
  v_end := (v_start + interval '6 months')::date;

  WITH in_scope AS MATERIALIZED (
    SELECT a.id, a.course_id, a.title, a.category, a.activity_date, a.goal_id,
           a.ods_goal, a.exam_module, a.updated_at, a.evidence_doc_id AS linked_doc_id, c.name AS course_name
      FROM public.vertice_teaching_activities a
      JOIN public.vertice_courses c ON c.id = a.course_id AND c.institution_id = a.institution_id
     WHERE a.institution_id = NEW.institution_id
       AND (NEW.course_id IS NULL OR a.course_id = NEW.course_id)
       AND a.status = 'validada'
       AND vertice_private.teaching_access(a.institution_id, a.course_id, 'read')
       AND a.activity_date >= v_start AND a.activity_date < v_end
       AND a.activity_date <= coalesce(nullif(NEW.context->>'reference_date','')::date, current_date)
     ORDER BY a.activity_date DESC, a.id
  ), selected AS (
    SELECT * FROM in_scope ORDER BY activity_date DESC, id LIMIT 20
  ), sources AS (
    SELECT a.*,
           g.id AS pdi_goal_id, left(g.title, 180) AS goal_title,
           left(g.indicator, 180) AS indicator, g.due_date, g.status AS goal_status,
           left(g.pdi_expected_result, 240) AS expected_result,
           p.id AS program_id, left(p.title, 180) AS program_title,
           d.id AS evidence_doc_id, d.status AS evidence_status
      FROM selected a
      LEFT JOIN public.vertice_documents d
        ON d.id = a.linked_doc_id AND d.institution_id = NEW.institution_id AND d.course_id = a.course_id
       AND d.status IN ('active','approved') AND d.superseded_by IS NULL
      LEFT JOIN public.vertice_goals g
        ON g.id = a.goal_id AND g.institution_id = NEW.institution_id AND g.course_id IS NULL
       AND g.status IS DISTINCT FROM 'cancelada'
      LEFT JOIN public.vertice_pdi_programs p
        ON p.id = g.pdi_program_id AND p.institution_id = g.institution_id
       AND vertice_private.pdi_access(g.institution_id, false)
  )
  SELECT
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'course_id', s.course_id, 'course_name', left(s.course_name, 140),
        'title', left(s.title, 180), 'category', s.category, 'activity_date', s.activity_date,
        'status', 'validada', 'ods_goal', s.ods_goal, 'exam_module', s.exam_module, 'updated_at', s.updated_at,
        'pdi_goal_id', CASE WHEN s.program_id IS NOT NULL THEN s.pdi_goal_id END,
        'evidence', CASE WHEN s.evidence_doc_id IS NOT NULL
          THEN jsonb_build_object('id', s.evidence_doc_id, 'status', s.evidence_status) END
      ) ORDER BY s.activity_date DESC, s.id) FROM sources s), '[]'::jsonb),
      coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM (
        SELECT DISTINCT s.pdi_goal_id AS id, s.goal_title AS title, s.indicator, s.due_date,
          s.goal_status AS status, s.expected_result, s.program_id, s.program_title
        FROM sources s WHERE s.program_id IS NOT NULL
      ) g), '[]'::jsonb),
      (SELECT count(*) FROM in_scope)
  INTO v_activities, v_goals, v_eligible;

  NEW.context := NEW.context || jsonb_build_object('teaching_pdi', jsonb_build_object(
    'semester', v_term, 'eligible_count', v_eligible, 'activities', v_activities,
    'goals', v_goals,
    'notice', 'Inclui até 20 atividades de ensino validadas do recorte conforme cadastro atual, vinculadas ou não a metas PDI. Vínculo e documento não são medições nem comprovam alcance de meta. Não inferir concessão de horas ou curricularização. Estado documental é metadado; o conteúdo do arquivo não foi analisado. Módulo de exame é classificação declarada, não sincronização nem desempenho.'
  ));
  RETURN NEW;
END $fn$;

REVOKE ALL ON FUNCTION vertice_private.sapiens_teaching_pdi_context() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER zzzz_sapiens_teaching_pdi_context
BEFORE INSERT ON public.vertice_sapiens_planning_analyses
FOR EACH ROW EXECUTE FUNCTION vertice_private.sapiens_teaching_pdi_context();

-- Stored opinions can carry teaching metadata in the catalog or generated
-- text. Keep earlier opinions readable, but do not return teaching-enriched
-- course opinions after the reader loses the underlying course/PDI access.
DO $migration$
DECLARE
  definition text;
  marker constant text := $marker$AND (v_management OR a.result->>'schema_version'='2' OR a.status IN ('generating','failed'))$marker$;
  guard constant text := $guard$
    AND (CASE WHEN jsonb_typeof(a.context#>'{teaching_pdi,activities}') = 'array'
      THEN jsonb_array_length(a.context#>'{teaching_pdi,activities}') ELSE 0 END = 0
      OR (CASE WHEN a.course_id IS NULL THEN vertice_private.pdi_access(a.institution_id,true)
               ELSE vertice_private.teaching_access(a.institution_id,a.course_id,'read') END
           AND vertice_private.pdi_access(a.institution_id,false)))
  $guard$;
BEGIN
  definition := pg_get_functiondef('vertice_planning.sapiens(uuid,text,jsonb)'::regprocedure);
  IF position(marker IN definition) = 0
    OR position(guard IN definition) > 0
  THEN
    RAISE EXCEPTION 'O contrato de histórico do Sapiens mudou; revise a integração de Atividades de Ensino';
  END IF;
  EXECUTE replace(definition,marker,guard||marker);
END $migration$;

COMMIT;
