-- ============================================================
-- Estágio Obrigatório 360 — Interno e Externo
-- Migração aditiva — reutiliza student_registry, documents,
--   SDG, horas, auditoria, secretariat_protocols
-- ============================================================

-- 1. ORGANIZAÇÕES CONCEDENTES
CREATE TABLE IF NOT EXISTS vertice_internship_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  name text NOT NULL,
  trade_name text,
  identifier text,                   -- CNPJ ou outra identificação
  identifier_type text DEFAULT 'cnpj',
  address text,
  city text,
  state text,
  contact_name text,
  contact_email text,
  contact_phone text,
  sector text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','suspended','inactive')),
  block_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_orgs_read" ON vertice_internship_organizations FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_orgs_write" ON vertice_internship_organizations FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 2. CAMPOS DE ESTÁGIO
CREATE TABLE IF NOT EXISTS vertice_internship_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  organization_id uuid NOT NULL REFERENCES vertice_internship_organizations(id),
  name text NOT NULL,                -- nome do campo/setor
  location_type text NOT NULL CHECK (location_type IN ('internal','external')),
  address text,
  capacity integer,
  area_of_practice text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','under_review','approved','blocked','suspended')),
  approved_by text,
  approved_at timestamptz,
  last_visit_at timestamptz,
  visit_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_fields_read" ON vertice_internship_fields FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_fields_write" ON vertice_internship_fields FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 3. REGRAS DE ESTÁGIO POR CURSO/COMPONENTE
CREATE TABLE IF NOT EXISTS vertice_internship_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid NOT NULL REFERENCES vertice_courses(id),
  component_name text NOT NULL,       -- 'Estágio I', 'Estágio II', etc.
  component_code text,
  curriculum_version text NOT NULL,
  total_required_minutes integer NOT NULL CHECK (total_required_minutes > 0),
  max_daily_minutes integer,          -- jornada diária máxima
  max_weekly_minutes integer,
  accepted_locations text[] DEFAULT ARRAY['internal','external'],
  prerequisites text,
  assessment_instruments text[],
  report_frequency text DEFAULT 'monthly',
  effective_from date,
  effective_until date,
  source_document_id uuid REFERENCES vertice_documents(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, course_id, component_name, curriculum_version)
);
ALTER TABLE vertice_internship_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_rules_read" ON vertice_internship_rules FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_rules_write" ON vertice_internship_rules FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 4. VÍNCULOS DE ESTÁGIO (placements)
CREATE TABLE IF NOT EXISTS vertice_internship_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  student_id uuid NOT NULL REFERENCES vertice_student_registry(id),
  course_id uuid NOT NULL REFERENCES vertice_courses(id),
  rule_id uuid NOT NULL REFERENCES vertice_internship_rules(id),
  field_id uuid NOT NULL REFERENCES vertice_internship_fields(id),
  organization_id uuid NOT NULL REFERENCES vertice_internship_organizations(id),
  nature text NOT NULL DEFAULT 'mandatory' CHECK (nature IN ('mandatory','non_mandatory')),
  location_type text NOT NULL CHECK (location_type IN ('internal','external')),
  starts_at date NOT NULL,
  ends_at date,
  -- Responsáveis
  advisor_name text,                  -- orientador docente IES
  advisor_email text,
  supervisor_name text,               -- supervisor na concedente
  supervisor_email text,
  -- Estado
  lifecycle text NOT NULL DEFAULT 'requested' CHECK (lifecycle IN (
    'requested','preparing','under_review','adjustments','authorized',
    'active','suspended','field_change','operationally_ended',
    'academic_review','academic_approved','academic_rejected',
    'sent_to_secretariat','posting_confirmed','cancelled')),
  version integer NOT NULL DEFAULT 1,
  suspension_reason text,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_placements_read" ON vertice_internship_placements FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_placements_write" ON vertice_internship_placements FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_intern_placements_student ON vertice_internship_placements(institution_id, student_id);

-- 5. PLANO DE ATIVIDADES (versionado)
CREATE TABLE IF NOT EXISTS vertice_internship_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  objectives text,
  activities text,
  competencies text[],
  schedule text,
  approved_by text,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','revision_requested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(placement_id, version_number)
);
ALTER TABLE vertice_internship_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_plans_read" ON vertice_internship_plans FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_plans_write" ON vertice_internship_plans FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 6. CHECKLIST DOCUMENTAL
CREATE TABLE IF NOT EXISTS vertice_internship_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id) ON DELETE CASCADE,
  requirement_type text NOT NULL,     -- 'term_of_commitment','partnership_agreement','insurance','other'
  label text NOT NULL,
  status text NOT NULL DEFAULT 'not_presented' CHECK (status IN (
    'not_presented','received','under_review','validated','rejected','expired','waived')),
  document_id uuid REFERENCES vertice_documents(id),
  valid_from date,
  valid_until date,
  waiver_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_reqs_read" ON vertice_internship_requirements FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_reqs_write" ON vertice_internship_requirements FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 7. FREQUÊNCIA / DIÁRIO
CREATE TABLE IF NOT EXISTS vertice_internship_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0,
  time_zone text NOT NULL DEFAULT 'America/Sao_Paulo',
  net_minutes integer NOT NULL,       -- calculado: (ended - started - break)
  activity_description text,
  student_submitted_at timestamptz,
  -- Confirmações
  field_confirmed_by text,
  field_confirmed_at timestamptz,
  academic_decision text CHECK (academic_decision IN ('validated','rejected','pending')),
  academic_decided_by text,
  academic_decided_at timestamptz,
  rejection_reason text,
  -- Livro razão
  ledger_entry_id uuid,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_attendance_read" ON vertice_internship_attendance FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_attendance_write" ON vertice_internship_attendance FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_intern_attendance_placement ON vertice_internship_attendance(placement_id, activity_date);

-- 8. CONVITES PARA SUPERVISOR EXTERNO
CREATE TABLE IF NOT EXISTS vertice_internship_supervisor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id),
  supervisor_email text NOT NULL,
  supervisor_name text NOT NULL,
  token_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'supervisor_access',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_supervisor_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_sup_invites_read" ON vertice_internship_supervisor_invites FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_sup_invites_write" ON vertice_internship_supervisor_invites FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 9. RELATÓRIOS PERIÓDICOS
CREATE TABLE IF NOT EXISTS vertice_internship_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'periodic' CHECK (report_type IN ('periodic','final','incident')),
  period_start date,
  period_end date,
  content text,
  activities_summary text,
  competencies_observed text[],
  difficulties text,
  supervisor_feedback text,
  advisor_feedback text,
  document_id uuid REFERENCES vertice_documents(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed','approved','revision_requested')),
  due_date date,
  submitted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_reports_read" ON vertice_internship_reports FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_reports_write" ON vertice_internship_reports FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 10. AVALIAÇÕES
CREATE TABLE IF NOT EXISTS vertice_internship_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id) ON DELETE CASCADE,
  assessment_type text NOT NULL CHECK (assessment_type IN ('field_supervisor','academic_advisor','self_assessment','final_academic')),
  assessor_name text NOT NULL,
  assessor_role text,
  grade numeric(4,2),
  rubric_version text,
  competencies_evaluated jsonb,       -- [{competency, grade, observation}]
  overall_opinion text,
  document_id uuid REFERENCES vertice_documents(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_assessments_read" ON vertice_internship_assessments FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_assessments_write" ON vertice_internship_assessments FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 11. HORAS DE ESTÁGIO NO LIVRO RAZÃO
CREATE TABLE IF NOT EXISTS vertice_internship_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id),
  student_id uuid NOT NULL REFERENCES vertice_student_registry(id),
  attendance_id uuid REFERENCES vertice_internship_attendance(id),
  entry_type text NOT NULL CHECK (entry_type IN ('credit','reversal')),
  signed_minutes integer NOT NULL,
  reverses_entry_id uuid REFERENCES vertice_internship_ledger_entries(id),
  validator_name text NOT NULL,
  reason text,
  idempotency_key text NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, idempotency_key)
);
ALTER TABLE vertice_internship_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_ledger_read" ON vertice_internship_ledger_entries FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_ledger_insert" ON vertice_internship_ledger_entries FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));

-- 12. TRANSIÇÕES DE CICLO
CREATE TABLE IF NOT EXISTS vertice_internship_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  placement_id uuid NOT NULL REFERENCES vertice_internship_placements(id) ON DELETE CASCADE,
  from_lifecycle text NOT NULL,
  to_lifecycle text NOT NULL,
  reason text,
  actor_name text NOT NULL,
  expected_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_transitions_read" ON vertice_internship_transitions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_transitions_write" ON vertice_internship_transitions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 13. AUDITORIA
CREATE TABLE IF NOT EXISTS vertice_internship_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  actor_name text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_internship_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intern_audit_read" ON vertice_internship_audit FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "intern_audit_insert" ON vertice_internship_audit FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));

-- BI View: resumo por curso
CREATE OR REPLACE VIEW v_internship_course_summary AS
SELECT
  p.institution_id,
  p.course_id,
  c.name AS course_name,
  COUNT(DISTINCT p.id) AS placements_total,
  COUNT(DISTINCT p.id) FILTER (WHERE p.lifecycle = 'active') AS placements_active,
  COUNT(DISTINCT p.id) FILTER (WHERE p.location_type = 'internal') AS internal_count,
  COUNT(DISTINCT p.id) FILTER (WHERE p.location_type = 'external') AS external_count,
  COUNT(DISTINCT p.student_id) AS students_distinct,
  COUNT(DISTINCT p.id) FILTER (WHERE p.lifecycle = 'academic_approved') AS completed,
  COUNT(DISTINCT p.id) FILTER (WHERE p.lifecycle IN ('sent_to_secretariat','posting_confirmed')) AS sent_to_secretariat,
  COALESCE(SUM(le.signed_minutes), 0) AS hours_validated_minutes,
  COUNT(DISTINCT f.organization_id) AS organizations_count
FROM vertice_internship_placements p
JOIN vertice_courses c ON c.id = p.course_id
LEFT JOIN vertice_internship_ledger_entries le ON le.placement_id = p.id AND le.entry_type = 'credit'
LEFT JOIN vertice_internship_fields f ON f.id = p.field_id
WHERE p.lifecycle NOT IN ('cancelled')
GROUP BY p.institution_id, p.course_id, c.name;
