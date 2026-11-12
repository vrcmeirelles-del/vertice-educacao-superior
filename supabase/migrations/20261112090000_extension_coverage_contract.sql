-- Local proposal only. Requires the deployed v2 students table (not legacy participants).
-- No backfill, deletion, guessed course, or replacement of legacy views.
BEGIN;
-- NOT VALID preserves legacy inconsistencies, but enforces new writes and prevents
-- later parent tenant changes from silently breaking valid links.
CREATE UNIQUE INDEX IF NOT EXISTS extension_project_tenant_key ON public.vertice_extension_projects(id,institution_id);
CREATE UNIQUE INDEX IF NOT EXISTS extension_course_tenant_key ON public.vertice_courses(id,institution_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='extension_student_project_tenant_fk' AND conrelid='public.vertice_extension_students'::regclass) THEN
    ALTER TABLE public.vertice_extension_students ADD CONSTRAINT extension_student_project_tenant_fk
      FOREIGN KEY(project_id,institution_id) REFERENCES public.vertice_extension_projects(id,institution_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='extension_student_course_tenant_fk' AND conrelid='public.vertice_extension_students'::regclass) THEN
    ALTER TABLE public.vertice_extension_students ADD CONSTRAINT extension_student_course_tenant_fk
      FOREIGN KEY(course_id,institution_id) REFERENCES public.vertice_courses(id,institution_id) NOT VALID;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.vertice_extension_validate_student()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Serialize with edits to course_ids while admitting a new student link.
  PERFORM 1 FROM public.vertice_extension_projects p
    WHERE p.id = NEW.project_id AND p.institution_id = NEW.institution_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto e vínculo devem pertencer à mesma instituição' USING ERRCODE='23514';
  END IF;
  IF NEW.course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vertice_courses c JOIN public.vertice_extension_projects p
      ON p.id=NEW.project_id AND p.institution_id=c.institution_id
    WHERE c.id=NEW.course_id AND c.institution_id=NEW.institution_id AND c.id=ANY(p.course_ids)
  ) THEN RAISE EXCEPTION 'Curso deve pertencer à instituição e estar vinculado ao projeto' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS extension_student_contract ON public.vertice_extension_students;
CREATE TRIGGER extension_student_contract BEFORE INSERT OR UPDATE ON public.vertice_extension_students
FOR EACH ROW EXECUTE FUNCTION public.vertice_extension_validate_student();

CREATE OR REPLACE FUNCTION public.vertice_extension_validate_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.course_ids) cid WHERE NOT EXISTS (
    SELECT 1 FROM public.vertice_courses c WHERE c.id=cid AND c.institution_id=NEW.institution_id
  )) THEN RAISE EXCEPTION 'Cursos do projeto devem pertencer à instituição' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.institution_id IS DISTINCT FROM OLD.institution_id OR NEW.course_ids IS DISTINCT FROM OLD.course_ids) AND EXISTS (
    SELECT 1 FROM public.vertice_extension_students s WHERE s.project_id=NEW.id AND
      (s.institution_id<>NEW.institution_id OR (s.course_id IS NOT NULL AND NOT coalesce(s.course_id=ANY(NEW.course_ids),false)))
  ) THEN RAISE EXCEPTION 'Corrija os vínculos discentes antes de alterar instituição ou cursos do projeto' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS extension_project_contract ON public.vertice_extension_projects;
CREATE TRIGGER extension_project_contract BEFORE INSERT OR UPDATE OF institution_id,course_ids ON public.vertice_extension_projects
FOR EACH ROW EXECUTE FUNCTION public.vertice_extension_validate_project();

-- Security invoker preserves the underlying RLS. No project names from a different tenant.
CREATE OR REPLACE VIEW public.v_extension_student_quality WITH (security_invoker=true) AS
SELECT s.id, s.institution_id, s.project_id, s.course_id, s.status, s.hours_completed,
  p.semester, p.status AS project_status,
  CASE WHEN p.id IS NULL THEN 'projeto_inconsistente'
    WHEN s.course_id IS NULL THEN 'sem_curso'
    WHEN c.id IS NULL THEN 'curso_inconsistente'
    WHEN NOT coalesce(s.course_id=ANY(p.course_ids),false) THEN 'curso_fora_projeto'
    ELSE 'valido' END AS quality
FROM public.vertice_extension_students s
LEFT JOIN public.vertice_extension_projects p ON p.id=s.project_id AND p.institution_id=s.institution_id
LEFT JOIN public.vertice_courses c ON c.id=s.course_id AND c.institution_id=s.institution_id;

-- Exactly one row per institution/course/semester. Student rows are project links,
-- not unique people. Active links count; completed hours include every link status.
CREATE OR REPLACE VIEW public.v_extension_coverage_v2 WITH (security_invoker=true) AS
WITH project_courses AS (
  SELECT DISTINCT p.institution_id,p.id,p.semester,c.id AS course_id
  FROM public.vertice_extension_projects p
  CROSS JOIN LATERAL unnest(p.course_ids) cid
  JOIN public.vertice_courses c ON c.id=cid AND c.institution_id=p.institution_id
  WHERE p.status NOT IN ('cancelado','suspenso')
), project_totals AS (
  SELECT institution_id,course_id,semester,count(*) AS total_projects
  FROM project_courses GROUP BY institution_id,course_id,semester
), student_totals AS (
  SELECT institution_id,course_id,semester,
    count(*) FILTER (WHERE status='ativo') AS total_students,
    coalesce(sum(hours_completed),0) AS total_student_hours
  FROM public.v_extension_student_quality
  WHERE quality='valido' AND project_status NOT IN ('cancelado','suspenso')
  GROUP BY institution_id,course_id,semester
)
SELECT p.institution_id,p.course_id,p.semester,p.total_projects,
  coalesce(s.total_students,0) AS total_students,coalesce(s.total_student_hours,0) AS total_student_hours
FROM project_totals p LEFT JOIN student_totals s ON s.institution_id=p.institution_id AND s.course_id=p.course_id
 AND s.semester IS NOT DISTINCT FROM p.semester;
GRANT SELECT ON public.v_extension_coverage_v2,public.v_extension_student_quality TO authenticated;
COMMIT;
