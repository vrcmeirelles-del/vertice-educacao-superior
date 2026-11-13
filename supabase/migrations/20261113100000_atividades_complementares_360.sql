-- ============================================================
-- Atividades Complementares 360 + Acesso Estudante (magic link)
-- Migração aditiva — reutiliza documentos, horas, SDG, auditoria
-- ============================================================

-- ═══════════════════════════════════════
-- NÚCLEO: ACESSO ESTUDANTE SEM SENHA
-- ═══════════════════════════════════════

-- Base de estudantes importada/sincronizada
CREATE TABLE IF NOT EXISTS vertice_student_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid NOT NULL REFERENCES vertice_courses(id),
  enrollment_code text NOT NULL,       -- matrícula
  cpf_hash text NOT NULL,              -- SHA-256 do CPF
  full_name text NOT NULL,
  email text NOT NULL,                 -- e-mail institucional validado
  curriculum_version text,             -- versão da matriz
  academic_status text DEFAULT 'active' CHECK (academic_status IN ('active','locked','graduated','cancelled','transferred')),
  verified boolean NOT NULL DEFAULT false,  -- conferência institucional
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, enrollment_code)
);
ALTER TABLE vertice_student_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_reg_read" ON vertice_student_registry FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "student_reg_write" ON vertice_student_registry FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_student_reg_cpf ON vertice_student_registry(institution_id, cpf_hash);

-- Tokens de acesso (magic link)
CREATE TABLE IF NOT EXISTS vertice_student_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  student_id uuid NOT NULL REFERENCES vertice_student_registry(id),
  token_hash text NOT NULL,            -- hash do token (nunca armazenar token plain)
  purpose text NOT NULL DEFAULT 'session' CHECK (purpose IN ('session','email_change','recovery')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,             -- null = não usado
  consumed_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token_hash)
);
ALTER TABLE vertice_student_access_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_tokens_service" ON vertice_student_access_tokens FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_student_tokens_hash ON vertice_student_access_tokens(token_hash) WHERE consumed_at IS NULL;

-- Sessões de estudante
CREATE TABLE IF NOT EXISTS vertice_student_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  student_id uuid NOT NULL REFERENCES vertice_student_registry(id),
  token_id uuid NOT NULL REFERENCES vertice_student_access_tokens(id),
  session_key_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_student_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_sessions_service" ON vertice_student_sessions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Importações de base estudantil
CREATE TABLE IF NOT EXISTS vertice_student_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  errors jsonb,
  imported_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_student_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_imports_read" ON vertice_student_imports FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "student_imports_write" ON vertice_student_imports FOR ALL USING (vertice_private.is_master(institution_id));

-- ═══════════════════════════════════════
-- ATIVIDADES COMPLEMENTARES
-- ═══════════════════════════════════════

-- Regulamentos versionados por curso/matriz
CREATE TABLE IF NOT EXISTS vertice_ac_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid NOT NULL REFERENCES vertice_courses(id),
  curriculum_version text NOT NULL,
  rule_version text NOT NULL,           -- 'v1', '2024.1'
  source_document_id uuid REFERENCES vertice_documents(id),
  total_required_minutes integer NOT NULL CHECK (total_required_minutes > 0),
  effective_from date NOT NULL,
  effective_until date,
  approved_by text,
  approved_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  rounding_policy text DEFAULT 'floor' CHECK (rounding_policy IN ('floor','ceil','nearest')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, course_id, curriculum_version, rule_version)
);
ALTER TABLE vertice_ac_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_rules_read" ON vertice_ac_rules FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_rules_write" ON vertice_ac_rules FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Categorias e limites
CREATE TABLE IF NOT EXISTS vertice_ac_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  rule_id uuid NOT NULL REFERENCES vertice_ac_rules(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  parent_id uuid REFERENCES vertice_ac_categories(id),
  max_per_item_minutes integer,
  max_category_minutes integer,
  max_per_period_minutes integer,
  conversion_numerator integer NOT NULL DEFAULT 1,
  conversion_denominator integer NOT NULL DEFAULT 1,
  accepted_documents text[],
  requires_pertinence boolean NOT NULL DEFAULT false,
  accepted_period_rule text,           -- 'during_enrollment','any','custom'
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(rule_id, code)
);
ALTER TABLE vertice_ac_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_categories_read" ON vertice_ac_categories FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_categories_write" ON vertice_ac_categories FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Submissões do estudante
CREATE TABLE IF NOT EXISTS vertice_ac_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  student_id uuid NOT NULL REFERENCES vertice_student_registry(id),
  rule_id uuid NOT NULL REFERENCES vertice_ac_rules(id),
  category_id uuid REFERENCES vertice_ac_categories(id),
  title text NOT NULL,
  issuer text,
  event_name text,
  participant_name text,
  start_date date,
  end_date date,
  documentary_minutes integer,         -- carga declarada no documento
  modality text,
  description text,
  document_id uuid REFERENCES vertice_documents(id),
  external_url text,
  content_hash text,
  -- Estado
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','extracting','suggestion_ready','under_review',
    'adjustments_requested','approved','partially_approved','denied',
    'credited','report_sent','posting_confirmed')),
  batch_id uuid,                       -- lote de envio
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_ac_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_submissions_read" ON vertice_ac_submissions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_submissions_write" ON vertice_ac_submissions FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_ac_submissions_student ON vertice_ac_submissions(institution_id, student_id);

-- Extração IA do certificado
CREATE TABLE IF NOT EXISTS vertice_ac_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  submission_id uuid NOT NULL REFERENCES vertice_ac_submissions(id) ON DELETE CASCADE,
  document_version_id uuid,
  participant_name text,
  issuer text,
  event_title text,
  starts_at text,
  ends_at text,
  documentary_minutes integer,
  evidence_segment_ids text[],
  extraction_quality text CHECK (extraction_quality IN ('complete','partial','insufficient')),
  suggested_category_id uuid REFERENCES vertice_ac_categories(id),
  suggested_justification text,
  warnings text[],
  provider text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_ac_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_extractions_read" ON vertice_ac_extractions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_extractions_write" ON vertice_ac_extractions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Cálculo determinístico
CREATE TABLE IF NOT EXISTS vertice_ac_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  submission_id uuid NOT NULL REFERENCES vertice_ac_submissions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES vertice_ac_categories(id),
  documentary_minutes integer NOT NULL,
  converted_minutes integer NOT NULL,
  max_per_item_applied boolean NOT NULL DEFAULT false,
  category_remaining_minutes integer NOT NULL,
  total_remaining_minutes integer NOT NULL,
  awarded_minutes integer NOT NULL,
  capped boolean NOT NULL DEFAULT false,
  applied_limits text[],
  rule_version text NOT NULL,
  calculation_memo jsonb,              -- memória de cálculo completa
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_ac_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_calculations_read" ON vertice_ac_calculations FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_calculations_write" ON vertice_ac_calculations FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Decisões (append-only)
CREATE TABLE IF NOT EXISTS vertice_ac_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  submission_id uuid NOT NULL REFERENCES vertice_ac_submissions(id),
  decision text NOT NULL CHECK (decision IN ('approved','partially_approved','denied','adjustments_requested')),
  awarded_minutes integer,
  reviewer_name text NOT NULL,
  reviewer_role text,
  reason text,
  supersedes_decision_id uuid REFERENCES vertice_ac_decisions(id),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_ac_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_decisions_read" ON vertice_ac_decisions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_decisions_write" ON vertice_ac_decisions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Créditos no Livro Razão (AC)
CREATE TABLE IF NOT EXISTS vertice_ac_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  student_id uuid NOT NULL REFERENCES vertice_student_registry(id),
  submission_id uuid NOT NULL REFERENCES vertice_ac_submissions(id),
  decision_id uuid NOT NULL REFERENCES vertice_ac_decisions(id),
  category_id uuid NOT NULL REFERENCES vertice_ac_categories(id),
  entry_type text NOT NULL CHECK (entry_type IN ('credit','reversal')),
  signed_minutes integer NOT NULL,
  reverses_entry_id uuid REFERENCES vertice_ac_ledger_entries(id),
  validator_name text NOT NULL,
  reason text,
  idempotency_key text NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, idempotency_key)
);
ALTER TABLE vertice_ac_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_ledger_read" ON vertice_ac_ledger_entries FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_ledger_insert" ON vertice_ac_ledger_entries FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));

-- Protocolos de secretaria (compartilhado AC + Estágio)
CREATE TABLE IF NOT EXISTS vertice_secretariat_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  module text NOT NULL CHECK (module IN ('complementary_activities','mandatory_internship','tcc')),
  student_id uuid NOT NULL REFERENCES vertice_student_registry(id),
  report_hash text NOT NULL,
  report_version integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'generated' CHECK (state IN (
    'generated','awaiting_signature','signed','sent','received','posted','returned','superseded')),
  destination_email text,
  signed_by text,
  signed_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  confirmed_posted_by text,
  confirmed_posted_at timestamptz,
  supersedes_protocol_id uuid REFERENCES vertice_secretariat_protocols(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_secretariat_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "secretariat_read" ON vertice_secretariat_protocols FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "secretariat_write" ON vertice_secretariat_protocols FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Duplicidade / conferência
CREATE TABLE IF NOT EXISTS vertice_ac_duplicate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  submission_id uuid NOT NULL REFERENCES vertice_ac_submissions(id),
  matched_submission_id uuid NOT NULL REFERENCES vertice_ac_submissions(id),
  match_type text NOT NULL CHECK (match_type IN ('hash_match','event_match','date_overlap','possible_duplicate')),
  resolution text CHECK (resolution IN ('duplicate_confirmed','additional_evidence','distinct_activity','pending')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_ac_duplicate_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_duplicates_read" ON vertice_ac_duplicate_checks FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_duplicates_write" ON vertice_ac_duplicate_checks FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Auditoria AC
CREATE TABLE IF NOT EXISTS vertice_ac_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  actor_name text NOT NULL,
  actor_role text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_ac_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_audit_read" ON vertice_ac_audit FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ac_audit_insert" ON vertice_ac_audit FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));

-- BI View: saldo por estudante
CREATE OR REPLACE VIEW v_ac_student_balance AS
SELECT
  s.institution_id,
  s.student_id,
  sr.full_name,
  sr.enrollment_code,
  sr.course_id,
  r.id AS rule_id,
  r.total_required_minutes,
  COALESCE(SUM(le.signed_minutes), 0) AS credited_minutes,
  r.total_required_minutes - COALESCE(SUM(le.signed_minutes), 0) AS remaining_minutes,
  COUNT(DISTINCT s.id) AS submissions_total,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('submitted','extracting','suggestion_ready','under_review')) AS submissions_pending
FROM vertice_ac_submissions s
JOIN vertice_student_registry sr ON sr.id = s.student_id
JOIN vertice_ac_rules r ON r.id = s.rule_id
LEFT JOIN vertice_ac_ledger_entries le ON le.submission_id = s.id AND le.entry_type = 'credit'
GROUP BY s.institution_id, s.student_id, sr.full_name, sr.enrollment_code, sr.course_id, r.id, r.total_required_minutes;

-- BI View: resumo por curso
CREATE OR REPLACE VIEW v_ac_course_summary AS
SELECT
  r.institution_id,
  r.course_id,
  c.name AS course_name,
  COUNT(DISTINCT sr.id) AS students_with_rule,
  COUNT(DISTINCT s.student_id) FILTER (WHERE s.id IS NOT NULL) AS students_with_submissions,
  COUNT(DISTINCT s.id) AS submissions_total,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('submitted','extracting','suggestion_ready','under_review')) AS submissions_pending,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('approved','partially_approved','credited')) AS submissions_approved,
  COALESCE(SUM(le.signed_minutes), 0) AS total_credited_minutes
FROM vertice_ac_rules r
JOIN vertice_courses c ON c.id = r.course_id
LEFT JOIN vertice_student_registry sr ON sr.institution_id = r.institution_id AND sr.course_id = r.course_id
LEFT JOIN vertice_ac_submissions s ON s.rule_id = r.id AND s.student_id = sr.id
LEFT JOIN vertice_ac_ledger_entries le ON le.submission_id = s.id AND le.entry_type = 'credit'
WHERE r.is_active = true
GROUP BY r.institution_id, r.course_id, c.name;
