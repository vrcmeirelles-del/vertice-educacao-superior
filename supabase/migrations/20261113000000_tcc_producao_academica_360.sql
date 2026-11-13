-- ============================================================
-- TCC e Produção Acadêmica 360
-- Migração aditiva — não altera tabelas existentes
-- Reutiliza: vertice_documents, vertice_extension_hour_entries,
--   vertice_sdg_goals/targets, governance_*, vertice_audit
-- ============================================================

-- 1. TIPOS DE TRABALHO (configurável por instituição)
CREATE TABLE IF NOT EXISTS vertice_tcc_work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  code text NOT NULL,            -- 'monografia','artigo','relatorio_tecnico','projeto_aplicado','produto'
  label text NOT NULL,
  description text,
  requires_defense boolean NOT NULL DEFAULT true,
  requires_qualification boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, code)
);
ALTER TABLE vertice_tcc_work_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_work_types_read" ON vertice_tcc_work_types FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_work_types_write" ON vertice_tcc_work_types FOR ALL USING (vertice_private.is_master(institution_id));

-- 2. TRABALHOS ACADÊMICOS
CREATE TABLE IF NOT EXISTS vertice_tcc_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid NOT NULL REFERENCES vertice_courses(id),
  offering_id uuid,              -- oferta/disciplina, quando aplicável
  academic_term text NOT NULL,   -- '2026.1', '2026.2'
  work_type_id uuid NOT NULL REFERENCES vertice_tcc_work_types(id),
  title text NOT NULL,
  abstract text,
  keywords text[],
  problem_statement text,
  justification text,
  general_objective text,
  specific_objectives text[],
  methodology text,
  research_line text,
  modality text,                 -- presencial, EaD, híbrido
  stage text NOT NULL DEFAULT 'draft'
    CHECK (stage IN ('draft','submitted','under_review','changes_requested',
      'project_approved','in_execution','final_submitted','defense_scheduled',
      'assessed','post_defense_changes','final_validated','deposited',
      'suspended','cancelled','archived')),
  version integer NOT NULL DEFAULT 1,
  governing_reference_set_id uuid,  -- FK to vertice_tcc_reference_sets
  current_project_version_id uuid,
  approved_final_version_id uuid,
  stage_deadline date,
  suspended_reason text,
  cancelled_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_works_read" ON vertice_tcc_works FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_works_write" ON vertice_tcc_works FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_tcc_works_inst_course ON vertice_tcc_works(institution_id, course_id);
CREATE INDEX idx_tcc_works_stage ON vertice_tcc_works(institution_id, stage);

-- 3. PARTICIPANTES (vínculo + papel)
CREATE TABLE IF NOT EXISTS vertice_tcc_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  person_email text,
  enrollment_id text,            -- matrícula (texto para flexibilidade)
  course_id uuid REFERENCES vertice_courses(id),
  role text NOT NULL CHECK (role IN ('author','discipline_teacher','advisor','coadvisor','examiner','reviewer')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  replaced_by_id uuid REFERENCES vertice_tcc_participants(id),
  replacement_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_participants_read" ON vertice_tcc_participants FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_participants_write" ON vertice_tcc_participants FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_tcc_participants_work ON vertice_tcc_participants(work_id);

-- 4. VERSÕES DE PROJETO/TRABALHO
CREATE TABLE IF NOT EXISTS vertice_tcc_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_type text NOT NULL CHECK (version_type IN ('project','draft','revision','final','post_defense')),
  submitted_by text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  -- Fonte documental (pode ser PDF, link ou ambos)
  source_mode text NOT NULL DEFAULT 'pdf' CHECK (source_mode IN ('pdf','external_link','both')),
  document_id uuid REFERENCES vertice_documents(id),   -- PDF via gestão documental existente
  external_url text,
  canonical_medium text CHECK (canonical_medium IN ('pdf','external_link')),
  content_hash text,
  -- Metadados
  doi text,
  publication_date date,
  publisher text,
  license text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','institutional','embargoed','public_authorized')),
  embargo_until date,
  access_state text DEFAULT 'not_checked' CHECK (access_state IN ('not_checked','available','unavailable','restricted')),
  notes text,
  UNIQUE(work_id, version_number)
);
ALTER TABLE vertice_tcc_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_versions_read" ON vertice_tcc_versions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_versions_write" ON vertice_tcc_versions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 5. TRANSIÇÕES DE ESTADO (auditoria de etapas)
CREATE TABLE IF NOT EXISTS vertice_tcc_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  reason text,
  actor_name text NOT NULL,
  actor_role text,
  expected_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_transitions_read" ON vertice_tcc_transitions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_transitions_write" ON vertice_tcc_transitions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 6. ETAPAS/TAREFAS
CREATE TABLE IF NOT EXISTS vertice_tcc_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  stage text,                    -- etapa do trabalho a que pertence
  title text NOT NULL,
  description text,
  responsible text NOT NULL,
  deadline date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','overdue','cancelled')),
  evidence text,
  depends_on uuid REFERENCES vertice_tcc_tasks(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_tasks_read" ON vertice_tcc_tasks FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_tasks_write" ON vertice_tcc_tasks FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 7. ORIENTAÇÕES E REUNIÕES
CREATE TABLE IF NOT EXISTS vertice_tcc_supervisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  supervision_type text NOT NULL DEFAULT 'meeting' CHECK (supervision_type IN ('meeting','feedback','review','other')),
  modality text DEFAULT 'presencial' CHECK (modality IN ('presencial','online','hibrida','assincrona')),
  scheduled_at timestamptz,
  held_at timestamptz,
  duration_minutes integer,
  participants text[],            -- nomes dos participantes
  agenda text,
  decisions text,
  pending_items text,
  next_steps text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','held','validated','cancelled','no_show')),
  evidence_doc_id uuid REFERENCES vertice_documents(id),
  recorded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_supervisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_supervisions_read" ON vertice_tcc_supervisions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_supervisions_write" ON vertice_tcc_supervisions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 8. BANCA E AVALIAÇÃO
CREATE TABLE IF NOT EXISTS vertice_tcc_defenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  defense_type text NOT NULL DEFAULT 'final' CHECK (defense_type IN ('qualification','final')),
  scheduled_at timestamptz,
  location text,
  modality text DEFAULT 'presencial',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','held','cancelled','postponed')),
  result text CHECK (result IN ('approved','approved_with_changes','reproved','not_evaluated')),
  final_grade numeric(4,2),
  minutes_doc_id uuid REFERENCES vertice_documents(id),  -- ata
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_defenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_defenses_read" ON vertice_tcc_defenses FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_defenses_write" ON vertice_tcc_defenses FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Membros da banca
CREATE TABLE IF NOT EXISTS vertice_tcc_defense_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  defense_id uuid NOT NULL REFERENCES vertice_tcc_defenses(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  member_email text,
  member_institution text,
  role text NOT NULL DEFAULT 'examiner' CHECK (role IN ('president','examiner','advisor','coadvisor','alternate')),
  is_external boolean NOT NULL DEFAULT false,
  grade numeric(4,2),
  opinion text,
  opinion_doc_id uuid REFERENCES vertice_documents(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_defense_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_defense_members_read" ON vertice_tcc_defense_members FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_defense_members_write" ON vertice_tcc_defense_members FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 9. REFERENCIAIS PPC VERSIONADOS
CREATE TABLE IF NOT EXISTS vertice_tcc_reference_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid NOT NULL REFERENCES vertice_courses(id),
  reference_type text NOT NULL CHECK (reference_type IN ('ppc','pdi','course_mission','institution_mission','maintainer_mission')),
  title text NOT NULL,
  version_label text NOT NULL,    -- '2024.1', 'v3'
  effective_from date,
  effective_until date,
  document_id uuid REFERENCES vertice_documents(id),  -- PPC/PDI como documento
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, course_id, reference_type, version_label)
);
ALTER TABLE vertice_tcc_reference_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_ref_sets_read" ON vertice_tcc_reference_sets FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_ref_sets_write" ON vertice_tcc_reference_sets FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- Elementos extraídos do referencial
CREATE TABLE IF NOT EXISTS vertice_tcc_reference_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  reference_set_id uuid NOT NULL REFERENCES vertice_tcc_reference_sets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('course_objective','graduate_competency','course_mission',
    'institution_mission','maintainer_mission','sdg_goal','sdg_target','learning_outcome')),
  code text,                     -- código do objetivo/competência
  text text NOT NULL,
  source_page integer,
  source_locator text,
  applicability text NOT NULL DEFAULT 'pending_review' CHECK (applicability IN ('pending_review','applicable','not_applicable')),
  applicability_decided_by text,
  applicability_decided_at timestamptz,
  sdg_goal_id smallint REFERENCES vertice_sdg_goals(id),
  sdg_target_id integer REFERENCES vertice_sdg_targets(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_reference_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_ref_elements_read" ON vertice_tcc_reference_elements FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_ref_elements_write" ON vertice_tcc_reference_elements FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 10. EXECUÇÕES DE ANÁLISE IA
CREATE TABLE IF NOT EXISTS vertice_tcc_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  work_version_id uuid NOT NULL REFERENCES vertice_tcc_versions(id),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  idempotency_key text NOT NULL,
  provider text,
  model text,
  analyzer_version text,
  prompt_version text,
  input_hashes text[],
  reference_version_ids uuid[],
  extraction_quality text CHECK (extraction_quality IN ('complete','partial','insufficient')),
  pages_processed integer,
  limitations text[],
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(institution_id, idempotency_key)
);
ALTER TABLE vertice_tcc_analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_analysis_runs_read" ON vertice_tcc_analysis_runs FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_analysis_runs_write" ON vertice_tcc_analysis_runs FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 11. SUGESTÕES DE ALINHAMENTO (IA → revisão humana)
CREATE TABLE IF NOT EXISTS vertice_tcc_alignment_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  work_version_id uuid NOT NULL REFERENCES vertice_tcc_versions(id),
  analysis_run_id uuid NOT NULL REFERENCES vertice_tcc_analysis_runs(id),
  reference_element_id uuid NOT NULL REFERENCES vertice_tcc_reference_elements(id),
  reference_set_id uuid NOT NULL REFERENCES vertice_tcc_reference_sets(id),
  evidence_scope text NOT NULL CHECK (evidence_scope IN ('project_intent','final_product')),
  strength text NOT NULL CHECK (strength IN ('thematic_relation','partial_evidence','consistent_evidence','not_located')),
  work_excerpt text,
  work_page integer,
  reference_excerpt text,
  reference_page integer,
  rationale text NOT NULL,
  limitations text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_alignment_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_align_suggestions_read" ON vertice_tcc_alignment_suggestions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_align_suggestions_write" ON vertice_tcc_alignment_suggestions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 12. DECISÕES HUMANAS (append-only)
CREATE TABLE IF NOT EXISTS vertice_tcc_alignment_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  suggestion_id uuid NOT NULL REFERENCES vertice_tcc_alignment_suggestions(id),
  decision text NOT NULL CHECK (decision IN ('validated','rejected','needs_changes')),
  reviewer_name text NOT NULL,
  reviewer_role text,
  reason text,
  supersedes_decision_id uuid REFERENCES vertice_tcc_alignment_decisions(id),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_alignment_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_align_decisions_read" ON vertice_tcc_alignment_decisions FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_align_decisions_write" ON vertice_tcc_alignment_decisions FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 13. DECLARAÇÕES DE HORAS TCC
-- Reutiliza o modelo de vertice_extension_hour_entries mas com scope TCC
CREATE TABLE IF NOT EXISTS vertice_tcc_hour_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES vertice_tcc_participants(id),
  person_name text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN (
    'orientation','coorientation','meeting','research','data_analysis',
    'writing','revision','defense','other')),
  declared_minutes integer NOT NULL CHECK (declared_minutes > 0),
  activity_date date NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  description text,
  evidence_doc_id uuid REFERENCES vertice_documents(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','validated','rejected')),
  validated_by text,
  validated_at timestamptz,
  rejection_reason text,
  -- Relação com extensão (para evitar dupla contagem)
  extension_origin_id uuid REFERENCES vertice_extension_hour_entries(id),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, idempotency_key)
);
ALTER TABLE vertice_tcc_hour_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_hours_read" ON vertice_tcc_hour_declarations FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_hours_write" ON vertice_tcc_hour_declarations FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 14. LIVRO RAZÃO TCC (lançamentos imutáveis)
CREATE TABLE IF NOT EXISTS vertice_tcc_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  declaration_id uuid NOT NULL REFERENCES vertice_tcc_hour_declarations(id),
  person_name text NOT NULL,
  participant_id uuid NOT NULL REFERENCES vertice_tcc_participants(id),
  entry_type text NOT NULL CHECK (entry_type IN ('credit','reversal')),
  signed_minutes integer NOT NULL,  -- positivo=crédito, negativo=estorno
  reverses_entry_id uuid REFERENCES vertice_tcc_ledger_entries(id),
  validator_name text NOT NULL,
  reason text,
  idempotency_key text NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, idempotency_key)
);
ALTER TABLE vertice_tcc_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_ledger_read" ON vertice_tcc_ledger_entries FOR SELECT USING (vertice_private.can_read_institution(institution_id));
-- Ledger é append-only, sem UPDATE/DELETE
CREATE POLICY "tcc_ledger_insert" ON vertice_tcc_ledger_entries FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));

-- 15. VÍNCULOS ODS DO TRABALHO (manual ou via referencial)
CREATE TABLE IF NOT EXISTS vertice_tcc_sdg_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  work_id uuid NOT NULL REFERENCES vertice_tcc_works(id) ON DELETE CASCADE,
  sdg_goal_id smallint NOT NULL REFERENCES vertice_sdg_goals(id),
  sdg_target_id integer REFERENCES vertice_sdg_targets(id),
  link_type text NOT NULL DEFAULT 'manual' CHECK (link_type IN ('manual','from_analysis','validated')),
  justification text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_sdg_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_sdg_links_read" ON vertice_tcc_sdg_links FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_sdg_links_write" ON vertice_tcc_sdg_links FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 16. CONFIGURAÇÕES POR INSTITUIÇÃO/CURSO
CREATE TABLE IF NOT EXISTS vertice_tcc_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid REFERENCES vertice_courses(id),  -- null = config institucional
  max_file_size_mb integer DEFAULT 50,
  max_authors_per_work integer DEFAULT 5,
  max_coadvisors integer DEFAULT 2,
  defense_required boolean DEFAULT true,
  qualification_required boolean DEFAULT false,
  auto_deposit_on_validation boolean DEFAULT false,
  hour_approval_flow text DEFAULT 'advisor_then_coordinator',
  ai_analysis_enabled boolean DEFAULT true,
  ai_max_monthly_runs integer DEFAULT 100,
  retention_days integer DEFAULT 365,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, course_id)
);
ALTER TABLE vertice_tcc_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_config_read" ON vertice_tcc_config FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_config_write" ON vertice_tcc_config FOR ALL USING (vertice_private.is_master(institution_id));

-- 17. AUDITORIA TCC (eventos de domínio)
CREATE TABLE IF NOT EXISTS vertice_tcc_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,   -- 'work','participant','version','defense','analysis','hours','alignment'
  aggregate_id uuid NOT NULL,
  aggregate_version integer,
  actor_name text NOT NULL,
  actor_role text,
  payload jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vertice_tcc_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcc_audit_read" ON vertice_tcc_audit FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "tcc_audit_insert" ON vertice_tcc_audit FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));
CREATE INDEX idx_tcc_audit_aggregate ON vertice_tcc_audit(institution_id, aggregate_type, aggregate_id);
CREATE INDEX idx_tcc_audit_type ON vertice_tcc_audit(institution_id, event_type);

-- ============================================================
-- VIEWS DE BI
-- ============================================================

-- BI operacional: visão consolidada por curso
CREATE OR REPLACE VIEW v_tcc_course_summary AS
SELECT
  w.institution_id,
  w.course_id,
  c.name AS course_name,
  COUNT(DISTINCT w.id) AS works_total,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage NOT IN ('cancelled','archived','suspended')) AS works_active,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'author' AND p.valid_until IS NULL) AS authors_distinct,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage = 'draft') AS works_draft,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage IN ('submitted','under_review')) AS works_in_review,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage = 'project_approved') AS works_approved,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage = 'in_execution') AS works_in_execution,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage IN ('final_submitted','defense_scheduled')) AS works_final_phase,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage IN ('assessed','post_defense_changes','final_validated')) AS works_assessed,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage = 'deposited') AS works_deposited,
  COUNT(DISTINCT w.id) FILTER (WHERE w.stage_deadline < CURRENT_DATE AND w.stage NOT IN ('deposited','cancelled','archived','suspended')) AS works_overdue,
  COUNT(DISTINCT p2.id) FILTER (WHERE p2.role = 'advisor' AND p2.valid_until IS NULL) AS advisors_active,
  -- Horas
  COALESCE(SUM(DISTINCT h.declared_minutes) FILTER (WHERE h.status = 'validated'), 0) AS hours_validated_minutes,
  -- Evidências
  COUNT(DISTINCT al.id) FILTER (WHERE ad.decision = 'validated') AS alignments_validated,
  COUNT(DISTINCT al.id) AS alignments_total
FROM vertice_tcc_works w
JOIN vertice_courses c ON c.id = w.course_id
LEFT JOIN vertice_tcc_participants p ON p.work_id = w.id AND p.role = 'author' AND p.valid_until IS NULL
LEFT JOIN vertice_tcc_participants p2 ON p2.work_id = w.id AND p2.role = 'advisor' AND p2.valid_until IS NULL
LEFT JOIN vertice_tcc_hour_declarations h ON h.work_id = w.id
LEFT JOIN vertice_tcc_alignment_suggestions al ON al.work_id = w.id
LEFT JOIN vertice_tcc_alignment_decisions ad ON ad.suggestion_id = al.id AND ad.supersedes_decision_id IS NULL
GROUP BY w.institution_id, w.course_id, c.name;

-- BI carteira do orientador
CREATE OR REPLACE VIEW v_tcc_advisor_portfolio AS
SELECT
  p.institution_id,
  p.person_name AS advisor_name,
  p.person_email AS advisor_email,
  COUNT(DISTINCT p.work_id) AS works_count,
  COUNT(DISTINCT pa.id) AS students_count,
  COUNT(DISTINCT p.work_id) FILTER (WHERE w.stage_deadline < CURRENT_DATE AND w.stage NOT IN ('deposited','cancelled','archived','suspended')) AS works_overdue,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'held' AND s.held_at > now() - interval '30 days') AS recent_supervisions,
  COALESCE(SUM(h.declared_minutes) FILTER (WHERE h.status = 'validated'), 0) AS hours_validated
FROM vertice_tcc_participants p
JOIN vertice_tcc_works w ON w.id = p.work_id
LEFT JOIN vertice_tcc_participants pa ON pa.work_id = p.work_id AND pa.role = 'author' AND pa.valid_until IS NULL
LEFT JOIN vertice_tcc_supervisions s ON s.work_id = p.work_id
LEFT JOIN vertice_tcc_hour_declarations h ON h.work_id = p.work_id AND h.participant_id = p.id
WHERE p.role = 'advisor' AND p.valid_until IS NULL
  AND w.stage NOT IN ('cancelled','archived')
GROUP BY p.institution_id, p.person_name, p.person_email;

-- ============================================================
-- DADOS INICIAIS: tipos de trabalho padrão para todas as IES
-- ============================================================
INSERT INTO vertice_tcc_work_types (institution_id, code, label, description, requires_defense, requires_qualification)
SELECT i.id, t.code, t.label, t.description, t.requires_defense, t.requires_qualification
FROM vertice_institutions i
CROSS JOIN (VALUES
  ('monografia', 'Monografia', 'Trabalho individual de pesquisa com defesa perante banca', true, false),
  ('artigo', 'Artigo Científico', 'Produção acadêmica em formato de artigo para publicação', true, false),
  ('relatorio_tecnico', 'Relatório Técnico', 'Relatório de projeto aplicado ou estágio', false, false),
  ('projeto_aplicado', 'Projeto Aplicado', 'Produto ou solução técnica com memorial descritivo', true, false),
  ('produto', 'Produto Educacional/Tecnológico', 'Artefato, software, material didático ou protótipo', true, true)
) AS t(code, label, description, requires_defense, requires_qualification)
ON CONFLICT (institution_id, code) DO NOTHING;
