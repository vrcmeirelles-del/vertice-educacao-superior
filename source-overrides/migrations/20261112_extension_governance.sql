-- ============================================================
-- Extensão 360° — Governança Institucional de Extensão
-- Política, plano, calendário, orçamento e metas vinculadas
-- a documentos institucionais
-- ============================================================

-- 1. Política institucional de extensão
CREATE TABLE IF NOT EXISTS vertice_extension_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  title text NOT NULL,                     -- ex: "Política de Extensão 2026-2030"
  resolution_number text,                  -- nº da resolução do conselho
  approved_by_body text,                   -- "CONSUP", "CONSEPE", etc.
  approved_at date,
  effective_from date NOT NULL,
  effective_until date,

  -- Parâmetros regulatórios
  min_extension_pct numeric(5,2) NOT NULL DEFAULT 10.00,  -- percentual mínimo (DCN)
  regulatory_basis text NOT NULL DEFAULT 'Resolução CNE/CES nº 7/2018',
  regulatory_basis_verified boolean DEFAULT false,  -- se a norma foi verificada
  regulatory_basis_verified_at timestamptz,

  -- Documento de referência
  document_id uuid,                        -- link para vertice_documents

  status text NOT NULL DEFAULT 'vigente'
    CHECK (status IN ('rascunho', 'em_aprovacao', 'vigente', 'revogada', 'substituida')),

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(institution_id, resolution_number)
);

-- 2. Plano de extensão (vinculado à política)
CREATE TABLE IF NOT EXISTS vertice_extension_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES vertice_extension_policies(id) ON DELETE SET NULL,

  title text NOT NULL,                     -- ex: "Plano de Extensão 2026/01"
  period_start date NOT NULL,
  period_end date NOT NULL,

  -- Metas do plano (vinculadas a vertice_goals existente)
  goal_ids uuid[],                         -- referências a vertice_goals

  -- Orçamento
  budget_total numeric(14,2) DEFAULT 0,
  budget_personnel numeric(14,2) DEFAULT 0,
  budget_materials numeric(14,2) DEFAULT 0,
  budget_scholarships numeric(14,2) DEFAULT 0,
  budget_other numeric(14,2) DEFAULT 0,

  -- Indicadores-alvo
  target_projects_count int,               -- meta de projetos
  target_students_count int,               -- meta de estudantes envolvidos
  target_community_reach int,              -- meta de público externo
  target_hours_per_student int,            -- meta de horas por estudante

  -- ODS prioritários para este plano
  priority_sdg_goals int[],                -- ex: '{4, 10, 16}'

  -- Documento de referência
  document_id uuid,

  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'em_aprovacao', 'aprovado', 'em_execucao', 'concluido', 'cancelado')),

  approved_by text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Calendário de extensão
CREATE TABLE IF NOT EXISTS vertice_extension_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES vertice_extension_plans(id) ON DELETE SET NULL,

  title text NOT NULL,                     -- ex: "Abertura de editais — Extensão 2026/02"
  event_type text NOT NULL DEFAULT 'marco'
    CHECK (event_type IN (
      'marco',              -- marcos regulatórios
      'edital',             -- abertura/fechamento de editais
      'selecao',            -- seleção de projetos/bolsistas
      'relatorio',          -- entrega de relatórios
      'avaliacao',          -- avaliação periódica
      'capacitacao',        -- formação de orientadores
      'evento_institucional', -- seminários, mostras, fóruns
      'prestacao_contas'    -- prestação de contas ao conselho
    )),

  scheduled_date date NOT NULL,
  end_date date,                           -- para eventos com duração
  responsible text,
  description text,

  -- Status do evento
  completed boolean DEFAULT false,
  completed_at timestamptz,
  evidence_doc_id uuid,

  created_at timestamptz DEFAULT now()
);

-- 4. View: painel de governança
CREATE OR REPLACE VIEW v_extension_governance AS
SELECT
  pol.institution_id,
  pol.id AS policy_id,
  pol.title AS policy_title,
  pol.status AS policy_status,
  pol.min_extension_pct,
  pol.regulatory_basis,
  pol.regulatory_basis_verified,
  pln.id AS plan_id,
  pln.title AS plan_title,
  pln.status AS plan_status,
  pln.period_start,
  pln.period_end,
  pln.budget_total,
  pln.target_projects_count,
  pln.target_students_count,
  -- Execução (do resumo existente)
  es.total_projects AS executed_projects,
  es.total_students AS executed_students,
  es.total_student_hours AS executed_student_hours,
  -- Próximos eventos
  (SELECT count(*) FROM vertice_extension_calendar c
    WHERE c.institution_id = pol.institution_id
    AND c.completed = false
    AND c.scheduled_date >= current_date
  ) AS upcoming_events
FROM vertice_extension_policies pol
LEFT JOIN vertice_extension_plans pln
  ON pln.institution_id = pol.institution_id
  AND pln.policy_id = pol.id
  AND pln.status IN ('aprovado', 'em_execucao')
LEFT JOIN v_extension_summary es
  ON es.institution_id = pol.institution_id
WHERE pol.status = 'vigente';

-- 5. RLS
ALTER TABLE vertice_extension_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_policies_read" ON vertice_extension_policies
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_policies_write" ON vertice_extension_policies
  FOR ALL USING (vertice_private.can_read_institution(institution_id));

CREATE POLICY "ext_plans_read" ON vertice_extension_plans
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_plans_write" ON vertice_extension_plans
  FOR ALL USING (vertice_private.can_read_institution(institution_id));

CREATE POLICY "ext_calendar_read" ON vertice_extension_calendar
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_calendar_write" ON vertice_extension_calendar
  FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_ext_policies_inst ON vertice_extension_policies(institution_id);
CREATE INDEX IF NOT EXISTS idx_ext_plans_inst ON vertice_extension_plans(institution_id);
CREATE INDEX IF NOT EXISTS idx_ext_plans_policy ON vertice_extension_plans(policy_id);
CREATE INDEX IF NOT EXISTS idx_ext_calendar_inst ON vertice_extension_calendar(institution_id);
CREATE INDEX IF NOT EXISTS idx_ext_calendar_date ON vertice_extension_calendar(institution_id, scheduled_date);
