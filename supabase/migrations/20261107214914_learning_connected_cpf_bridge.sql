-- Vértice | Aprendizagem Conectada. Estrutura multi-IES e multicurso.
-- CPF não é armazenado. Só identificadores HMAC específicos da instituição.
-- Dados individuais permanecem em schema privado, fora da Data API.
CREATE SCHEMA IF NOT EXISTS vertice_private;

CREATE UNIQUE INDEX IF NOT EXISTS vertice_courses_institution_id_pair
  ON public.vertice_courses(id,institution_id);

CREATE TABLE IF NOT EXISTS vertice_private.learning_students (
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  student_token char(64) NOT NULL CHECK(student_token ~ '^[a-f0-9]{64}$'),
  course_id uuid NOT NULL,
  enrollment_ref text NOT NULL CHECK(length(enrollment_ref) BETWEEN 1 AND 120),
  source_label text NOT NULL CHECK(length(source_label) BETWEEN 3 AND 200),
  source_checked_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  verified_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(institution_id,student_token,course_id),
  FOREIGN KEY(course_id,institution_id) REFERENCES public.vertice_courses(id,institution_id)
    ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS learning_students_course ON vertice_private.learning_students(institution_id,course_id,active);

CREATE TABLE IF NOT EXISTS vertice_private.learning_events (
  institution_id uuid NOT NULL,
  source_event_id text NOT NULL CHECK(length(source_event_id) BETWEEN 5 AND 200),
  student_token char(64) NOT NULL,
  course_id uuid NOT NULL,
  module text NOT NULL CHECK(module IN ('oab','cfc','enade','delegado','pf','estadual','federal','defensoria','mp')),
  source_item_id text NOT NULL CHECK(length(source_item_id) BETWEEN 1 AND 200),
  source_subject text,
  source_competency text,
  source_occurred_at timestamptz NOT NULL,
  graded boolean NOT NULL DEFAULT FALSE,
  correct boolean,
  confidence smallint CHECK(confidence IS NULL OR confidence IN (1,3,5)),
  imported_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(institution_id,source_event_id),
  FOREIGN KEY(institution_id,student_token,course_id)
    REFERENCES vertice_private.learning_students(institution_id,student_token,course_id),
  CHECK((graded AND correct IS NOT NULL) OR (NOT graded AND correct IS NULL)),
  CHECK(length(COALESCE(source_subject,'')) <= 250),
  CHECK(length(COALESCE(source_competency,'')) <= 500)
);
CREATE INDEX IF NOT EXISTS learning_events_course_time
  ON vertice_private.learning_events(institution_id,course_id,source_occurred_at DESC);
CREATE INDEX IF NOT EXISTS learning_events_student_time
  ON vertice_private.learning_events(institution_id,student_token,source_occurred_at DESC);

CREATE TABLE IF NOT EXISTS vertice_private.learning_curricular_grades (
  institution_id uuid NOT NULL,
  student_token char(64) NOT NULL,
  course_id uuid NOT NULL,
  semester text NOT NULL CHECK(semester ~ '^20[0-9]{2}/[12]$'),
  subject_code text NOT NULL CHECK(length(subject_code) BETWEEN 1 AND 120),
  assessment_code text NOT NULL CHECK(length(assessment_code) BETWEEN 1 AND 120),
  subject_name text NOT NULL CHECK(length(subject_name) BETWEEN 3 AND 250),
  score numeric(8,3) NOT NULL CHECK(score >= 0),
  score_max numeric(8,3) NOT NULL CHECK(score_max > 0 AND score <= score_max),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 3 AND 500),
  assessed_at date,
  imported_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(institution_id,student_token,course_id,semester,subject_code,assessment_code),
  FOREIGN KEY(institution_id,student_token,course_id)
    REFERENCES vertice_private.learning_students(institution_id,student_token,course_id)
);
CREATE INDEX IF NOT EXISTS learning_curricular_by_subject
  ON vertice_private.learning_curricular_grades(institution_id,course_id,semester,subject_code);

CREATE TABLE IF NOT EXISTS vertice_private.learning_subject_maps (
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  subject_code text NOT NULL,
  external_module text NOT NULL CHECK(external_module IN
    ('oab','cfc','enade','delegado','pf','estadual','federal','defensoria','mp')),
  mapped_competency text NOT NULL CHECK(length(mapped_competency) BETWEEN 3 AND 500),
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK(validation_status IN ('pending','validated','rejected')),
  evidence_ref text,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  PRIMARY KEY(institution_id,course_id,subject_code,external_module,mapped_competency),
  FOREIGN KEY(course_id,institution_id) REFERENCES public.vertice_courses(id,institution_id),
  CHECK((validation_status='validated' AND validated_by IS NOT NULL AND validated_at IS NOT NULL)
    OR (validation_status<>'validated' AND validated_by IS NULL AND validated_at IS NULL))
);

CREATE TABLE IF NOT EXISTS vertice_private.learning_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  batch_ref text NOT NULL UNIQUE,
  source_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  finished_at timestamptz,
  state text NOT NULL CHECK(state IN ('running','completed','failed')),
  received integer NOT NULL DEFAULT 0 CHECK(received>=0),
  inserted integer NOT NULL DEFAULT 0 CHECK(inserted>=0),
  ignored integer NOT NULL DEFAULT 0 CHECK(ignored>=0),
  failure_reason text,
  cursor_after timestamptz,
  cursor_event_id text
);

-- Profesores/coordenação só recebem escopo explícito de disciplina.
CREATE TABLE IF NOT EXISTS public.vertice_learning_staff_scope (
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  subject_code text NOT NULL CHECK(length(subject_code) BETWEEN 1 AND 120),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT NOW(),
  active boolean NOT NULL DEFAULT TRUE,
  PRIMARY KEY(institution_id,course_id,subject_code,user_id),
  FOREIGN KEY(course_id,institution_id) REFERENCES public.vertice_courses(id,institution_id)
);
ALTER TABLE public.vertice_learning_staff_scope ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_staff_read ON public.vertice_learning_staff_scope FOR SELECT TO authenticated
  USING (
    ((select auth.uid()) = user_id
      AND (select auth.jwt()->>'aal')='aal2')
    OR (vertice_private.can_read_institution(institution_id)
      AND vertice_private.has_role(institution_id,ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']))
  );
CREATE POLICY learning_staff_manage_insert ON public.vertice_learning_staff_scope FOR INSERT TO authenticated
  WITH CHECK(vertice_private.can_read_institution(institution_id)
    AND vertice_private.has_role(institution_id,ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']));
CREATE POLICY learning_staff_manage_update ON public.vertice_learning_staff_scope FOR UPDATE TO authenticated
  USING(vertice_private.can_read_institution(institution_id)
    AND vertice_private.has_role(institution_id,ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']))
  WITH CHECK(vertice_private.can_read_institution(institution_id)
    AND vertice_private.has_role(institution_id,ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']));
CREATE POLICY learning_staff_manage_delete ON public.vertice_learning_staff_scope FOR DELETE TO authenticated
  USING(vertice_private.can_read_institution(institution_id)
    AND vertice_private.has_role(institution_id,ARRAY['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.vertice_learning_staff_scope TO authenticated;

-- Indicadores agregados, sem CPF, token ou matrícula; somente coortes com n >= 5.
CREATE TABLE IF NOT EXISTS public.vertice_learning_course_metrics (
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  semester text NOT NULL CHECK(semester ~ '^20[0-9]{2}/[12]$'),
  subject_code text NOT NULL,
  module text NOT NULL CHECK(module IN
    ('oab','cfc','enade','delegado','pf','estadual','federal','defensoria','mp')),
  competency text NOT NULL DEFAULT '',
  participants integer NOT NULL CHECK(participants>=5),
  attempts integer NOT NULL CHECK(attempts>=0),
  graded integer NOT NULL CHECK(graded>=0 AND graded<=attempts),
  correct integer NOT NULL CHECK(correct>=0 AND correct<=graded),
  activity_rate numeric(6,4) CHECK(activity_rate IS NULL OR activity_rate BETWEEN 0 AND 1),
  paired_students integer NOT NULL DEFAULT 0 CHECK(paired_students>=0),
  curricular_average numeric(6,4) CHECK(curricular_average IS NULL OR curricular_average BETWEEN 0 AND 1),
  external_accuracy numeric(6,4) CHECK(external_accuracy IS NULL OR external_accuracy BETWEEN 0 AND 1),
  comparison_gap numeric(6,4) CHECK(comparison_gap IS NULL OR comparison_gap BETWEEN -1 AND 1),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(institution_id,course_id,semester,subject_code,module,competency),
  FOREIGN KEY(course_id,institution_id) REFERENCES public.vertice_courses(id,institution_id),
  CHECK((paired_students>=5 AND curricular_average IS NOT NULL AND external_accuracy IS NOT NULL
    AND comparison_gap IS NOT NULL) OR
    (paired_students<5 AND curricular_average IS NULL AND external_accuracy IS NULL
    AND comparison_gap IS NULL))
);
ALTER TABLE public.vertice_learning_course_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_metrics_read ON public.vertice_learning_course_metrics
  FOR SELECT TO authenticated USING (
    (vertice_private.can_read_institution(institution_id)
      AND vertice_private.has_role(institution_id,ARRAY[
       'gestor','reitor','diretor_geral','diretor_pedagogico','procurador','cpa']))
    OR ((select auth.jwt()->>'aal')='aal2'
      AND EXISTS(
        SELECT 1 FROM public.vertice_learning_staff_scope sc
        WHERE sc.user_id=(select auth.uid()) AND sc.institution_id=vertice_learning_course_metrics.institution_id
          AND sc.course_id=vertice_learning_course_metrics.course_id
          AND sc.subject_code=vertice_learning_course_metrics.subject_code AND sc.active=TRUE
      ))
  );
GRANT SELECT ON public.vertice_learning_course_metrics TO authenticated;

-- Tables in private schema remain unreachable through public PostgREST API.
ALTER TABLE vertice_private.learning_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_private.learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_private.learning_curricular_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_private.learning_subject_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_private.learning_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_private.learning_students,
  vertice_private.learning_events,
  vertice_private.learning_curricular_grades,
  vertice_private.learning_subject_maps,
  vertice_private.learning_sync_runs FROM anon,authenticated;
