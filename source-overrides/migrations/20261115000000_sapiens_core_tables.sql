-- ================================================================
-- VÉRTICE SAPIENS 360 — Tabelas fundacionais
-- Migração: 20261115000000_sapiens_core_tables.sql
-- ================================================================

-- 1. Diagnósticos por competência
CREATE TABLE IF NOT EXISTS vertice_sapiens_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  module text NOT NULL CHECK(module IN
    ('oab','cfc','enade','enamed','residencia','enem','delegado','pf','estadual','federal','defensoria','mp')),
  competency text,
  semester text NOT NULL CHECK(semester ~ '^20[0-9]{2}/[12]$'),

  -- Métricas da baseline
  sample_size integer NOT NULL CHECK(sample_size >= 1),
  avg_p_know numeric(6,4) CHECK(avg_p_know BETWEEN 0 AND 1),
  avg_elo_rating numeric(8,2),
  accuracy_rate numeric(6,4) CHECK(accuracy_rate BETWEEN 0 AND 1),
  attempt_count integer NOT NULL DEFAULT 0,

  -- Diagnóstico gerado pelo LLM
  severity text NOT NULL CHECK(severity IN ('critical','warning','watch','adequate','strong')),
  summary text NOT NULL CHECK(length(summary) BETWEEN 10 AND 2000),
  detailed_analysis jsonb NOT NULL DEFAULT '{}',
  recommended_actions jsonb NOT NULL DEFAULT '[]',

  -- Contraditório
  contradictory_checked boolean NOT NULL DEFAULT FALSE,
  contradictory_notes text,

  -- Rastreabilidade
  llm_model text NOT NULL,
  llm_prompt_hash text,
  sync_run_id uuid,
  data_snapshot_at timestamptz NOT NULL,

  -- Ciclo
  sapiens_cycle integer NOT NULL DEFAULT 1,
  previous_diagnosis_id uuid REFERENCES vertice_sapiens_diagnoses(id),

  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','superseded','archived')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  published_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sapiens_diagnoses_institution
  ON vertice_sapiens_diagnoses(institution_id, course_id, semester, module);
CREATE INDEX IF NOT EXISTS idx_sapiens_diagnoses_severity
  ON vertice_sapiens_diagnoses(institution_id, severity, status);
ALTER TABLE vertice_sapiens_diagnoses ENABLE ROW LEVEL SECURITY;

-- 2. Intervenções pedagógicas
CREATE TABLE IF NOT EXISTS vertice_sapiens_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES vertice_sapiens_diagnoses(id),
  course_id uuid NOT NULL,
  module text NOT NULL,
  competency text,

  -- Proposta
  intervention_type text NOT NULL CHECK(intervention_type IN
    ('diagnostic_activity','remedial_practice','content_review','custom')),
  title text NOT NULL CHECK(length(title) BETWEEN 5 AND 200),
  description text NOT NULL CHECK(length(description) BETWEEN 10 AND 2000),
  suggested_kc_ids integer[] NOT NULL DEFAULT '{}',
  target_p_know numeric(6,4) CHECK(target_p_know IS NULL OR target_p_know BETWEEN 0 AND 1),
  deadline timestamptz,

  -- Proposta gerada por LLM
  llm_model text NOT NULL,
  llm_rationale text,

  -- Aprovação
  status text NOT NULL DEFAULT 'proposed'
    CHECK(status IN ('proposed','approved','rejected','modified','sent','completed','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_notes text,
  modified_title text,
  modified_description text,

  -- Envio ao F&O
  sent_to_fo_at timestamptz,
  fo_accepted boolean,
  fo_registered_students integer,

  -- Baseline (snapshot no momento do diagnóstico)
  baseline_avg_p_know numeric(6,4),
  baseline_avg_elo numeric(8,2),
  baseline_sample_size integer,
  baseline_measured_at timestamptz,

  sapiens_cycle integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sapiens_interventions_status
  ON vertice_sapiens_interventions(institution_id, status, created_at DESC);
ALTER TABLE vertice_sapiens_interventions ENABLE ROW LEVEL SECURITY;

-- 3. Resultados e efetividade
CREATE TABLE IF NOT EXISTS vertice_sapiens_effectiveness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  intervention_id uuid NOT NULL REFERENCES vertice_sapiens_interventions(id),

  -- Métricas pós-intervenção
  measured_at timestamptz NOT NULL DEFAULT NOW(),
  current_avg_p_know numeric(6,4),
  current_avg_elo numeric(8,2),
  current_sample_size integer NOT NULL,
  attempts_since_baseline integer NOT NULL DEFAULT 0,

  -- Delta
  p_know_change numeric(6,4),
  elo_change numeric(8,2),
  sample_overlap integer NOT NULL DEFAULT 0,

  -- Avaliação
  effectiveness text CHECK(effectiveness IN
    ('significant_improvement','moderate_improvement','no_change','regression','insufficient_data')),
  analysis_summary text,
  llm_model text,

  -- Detalhe agregado (sem tokens individuais)
  detail_snapshot jsonb,

  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sapiens_effectiveness_intervention
  ON vertice_sapiens_effectiveness(intervention_id, measured_at DESC);
ALTER TABLE vertice_sapiens_effectiveness ENABLE ROW LEVEL SECURITY;

-- 4. Briefings executivos
CREATE TABLE IF NOT EXISTS vertice_sapiens_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  briefing_type text NOT NULL CHECK(briefing_type IN ('morning','midday','evening','weekly_audit')),
  scheduled_for timestamptz NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT NOW(),

  -- Conteúdo
  summary text NOT NULL CHECK(length(summary) BETWEEN 10 AND 5000),
  sections jsonb NOT NULL DEFAULT '[]',

  -- Métricas do momento
  active_risks integer NOT NULL DEFAULT 0,
  off_track_goals integer NOT NULL DEFAULT 0,
  pending_actions integer NOT NULL DEFAULT 0,
  pending_approvals integer NOT NULL DEFAULT 0,
  interventions_in_progress integer NOT NULL DEFAULT 0,

  -- Rastreabilidade
  llm_model text NOT NULL,
  data_sources jsonb NOT NULL DEFAULT '[]',

  -- Entrega
  delivered_to jsonb DEFAULT '[]',
  read_by jsonb DEFAULT '[]',

  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sapiens_briefings_schedule
  ON vertice_sapiens_briefings(institution_id, scheduled_for DESC);
ALTER TABLE vertice_sapiens_briefings ENABLE ROW LEVEL SECURITY;

-- 5. Pareceres de auditoria
CREATE TABLE IF NOT EXISTS vertice_sapiens_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid,

  -- Identificação do achado
  perspective text NOT NULL CHECK(perspective IN
    ('regulatory','pedagogical','cpa','academic','financial','documental','legal','technology','strategic')),
  finding_ref text NOT NULL CHECK(length(finding_ref) BETWEEN 3 AND 50),

  -- Estrutura do achado
  source_description text NOT NULL,
  evidence_ref text,
  normative_criterion text,
  analysis text NOT NULL CHECK(length(analysis) BETWEEN 10 AND 5000),
  contradictory_analysis text,
  risk_level text NOT NULL CHECK(risk_level IN ('critical','high','medium','low','informational')),
  recommendation text NOT NULL CHECK(length(recommendation) BETWEEN 10 AND 2000),

  -- Responsável e prazo
  assigned_to uuid,
  due_date date,
  resolution_status text NOT NULL DEFAULT 'open'
    CHECK(resolution_status IN ('open','in_progress','resolved','accepted_risk','superseded')),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid,

  -- Rastreabilidade
  llm_model text,
  certainty_level text NOT NULL DEFAULT 'plausible'
    CHECK(certainty_level IN ('confirmed','plausible','uncertain')),

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sapiens_findings_risk
  ON vertice_sapiens_audit_findings(institution_id, risk_level, resolution_status);
ALTER TABLE vertice_sapiens_audit_findings ENABLE ROW LEVEL SECURITY;

-- 6. Metas (Vértice Excellence)
CREATE TABLE IF NOT EXISTS vertice_sapiens_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid,

  title text NOT NULL CHECK(length(title) BETWEEN 5 AND 300),
  description text,
  category text NOT NULL CHECK(category IN
    ('academic','regulatory','cpa','financial','infrastructure','pedagogical','strategic')),
  indicator_name text NOT NULL,
  baseline_value numeric(12,4),
  target_value numeric(12,4) NOT NULL,
  current_value numeric(12,4),
  unit text NOT NULL DEFAULT '%',

  starts_at date NOT NULL,
  due_at date NOT NULL CHECK(due_at >= starts_at),

  trajectory text NOT NULL DEFAULT 'on_track'
    CHECK(trajectory IN ('on_track','attention','off_track','critical','achieved','cancelled')),
  status text NOT NULL DEFAULT 'active'
    CHECK(status IN ('draft','active','paused','achieved','cancelled')),

  owner_id uuid,
  approved_by uuid,
  approved_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE vertice_sapiens_goals ENABLE ROW LEVEL SECURITY;

-- 7. Planos de ação 5W2H
CREATE TABLE IF NOT EXISTS vertice_sapiens_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES vertice_sapiens_goals(id) ON DELETE CASCADE,

  what text NOT NULL CHECK(length(what) BETWEEN 5 AND 500),
  why text,
  who uuid,
  planned_date date,
  where_location text,
  how text,
  how_much numeric(12,2),

  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','in_progress','completed','blocked','cancelled')),
  completed_at timestamptz,
  evidence_ref text,
  result_notes text,

  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE vertice_sapiens_action_plans ENABLE ROW LEVEL SECURITY;

-- 8. Trilha de auditoria do Sapiens
CREATE TABLE IF NOT EXISTS vertice_sapiens_audit_trail (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id uuid NOT NULL,
  entity_type text NOT NULL CHECK(entity_type IN
    ('diagnosis','intervention','briefing','finding','goal','action_plan','effectiveness')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN
    ('created','updated','approved','rejected','sent','completed','cancelled','archived')),
  actor_id uuid,
  actor_type text NOT NULL DEFAULT 'system' CHECK(actor_type IN ('user','system','llm')),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sapiens_trail_entity
  ON vertice_sapiens_audit_trail(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sapiens_trail_institution
  ON vertice_sapiens_audit_trail(institution_id, created_at DESC);
ALTER TABLE vertice_sapiens_audit_trail ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- RLS Policies — Leitura por role institucional + MFA AAL2
-- ================================================================

CREATE OR REPLACE FUNCTION vertice_sapiens_can_read(inst uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vertice_admins WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.vertice_memberships
    WHERE user_id = auth.uid()
      AND institution_id = inst
      AND role IN ('gestor','reitor','diretor_geral','diretor_pedagogico','procurador','cpa')
  )
$$;

DO $$ DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'vertice_sapiens_diagnoses','vertice_sapiens_interventions',
    'vertice_sapiens_effectiveness','vertice_sapiens_briefings',
    'vertice_sapiens_audit_findings','vertice_sapiens_goals',
    'vertice_sapiens_action_plans','vertice_sapiens_audit_trail'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY sapiens_read ON %I FOR SELECT TO authenticated
       USING (vertice_sapiens_can_read(institution_id))', tbl);
    EXECUTE format('GRANT SELECT ON %I TO authenticated', tbl);
  END LOOP;
END $$;
