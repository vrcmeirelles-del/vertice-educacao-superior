-- ============================================================
-- Extensão 360° — Relatórios e Painéis
-- Tabelas para geração de relatórios PDF/XLSX e dashboards
-- com fontes, metodologia e validação
-- ============================================================

-- 1. Relatórios gerados
CREATE TABLE IF NOT EXISTS vertice_extension_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  title text NOT NULL,
  report_type text NOT NULL
    CHECK (report_type IN (
      'semestral',           -- relatório semestral de extensão
      'anual',               -- relatório anual consolidado
      'projeto',             -- relatório de projeto específico
      'regulatorio',         -- dossiê para avaliação MEC/INEP
      'ods',                 -- relatório de impacto ODS
      'prestacao_contas',    -- prestação de contas ao conselho
      'custom'               -- relatório personalizado
    )),

  -- Período coberto
  period_start date NOT NULL,
  period_end date NOT NULL,

  -- Filtros aplicados
  course_ids uuid[],                    -- cursos incluídos (null = todos)
  project_ids uuid[],                   -- projetos incluídos (null = todos)
  sdg_goal_ids int[],                   -- ODS filtrados

  -- Conteúdo e metadados
  format text NOT NULL DEFAULT 'pdf'
    CHECK (format IN ('pdf', 'xlsx', 'json')),
  storage_path text,                    -- caminho no storage
  file_size_bytes int,

  -- Metodologia e fontes (obrigatório pelo plano Impacto)
  methodology text NOT NULL DEFAULT 'Dados extraídos do sistema Vértice Extensão 360°',
  data_sources text[] NOT NULL DEFAULT ARRAY['vertice_extension_projects', 'vertice_extension_participants'],
  limitations text,                     -- limitações conhecidas do relatório

  -- Indicadores calculados (snapshot no momento da geração)
  summary jsonb NOT NULL DEFAULT '{}',
  -- Exemplo: {"total_projects": 12, "total_students": 145, "total_hours": 2340,
  --           "coverage_pct": 8.5, "ods_distribution": {"4": 5, "10": 3, "16": 4}}

  -- Validação
  generated_by uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  validated_by uuid,
  validated_at timestamptz,
  validation_notes text,

  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'gerado', 'validado', 'publicado', 'revogado'))
);

-- 2. Importações DreamShaper (histórico)
CREATE TABLE IF NOT EXISTS vertice_extension_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  source_system text NOT NULL DEFAULT 'dreamshaper',
  file_name text NOT NULL,
  file_hash text NOT NULL,             -- SHA-256 do arquivo importado

  -- Resultado
  total_rows int NOT NULL DEFAULT 0,
  created_count int NOT NULL DEFAULT 0,
  updated_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  error_details jsonb DEFAULT '[]',

  -- Reconciliação
  reconciled boolean DEFAULT false,
  reconciliation_notes text,

  -- Auditoria
  imported_by uuid NOT NULL,
  imported_at timestamptz DEFAULT now(),
  approved_by uuid,                    -- quem aprovou a prévia
  approved_at timestamptz,

  -- Idempotência: hash do arquivo impede reimportação acidental
  UNIQUE(institution_id, file_hash)
);

-- 3. View: painel de extensão (dashboard)
CREATE OR REPLACE VIEW v_extension_dashboard AS
SELECT
  i.id AS institution_id,

  -- Projetos
  coalesce(es.total_projects, 0) AS total_projects,
  coalesce(es.active_projects, 0) AS active_projects,
  coalesce(es.completed_projects, 0) AS completed_projects,

  -- Pessoas
  coalesce(es.total_students, 0) AS total_students,
  coalesce(es.total_faculty, 0) AS total_faculty,
  coalesce(es.community_participants, 0) AS community_reach,

  -- Horas
  coalesce(es.total_project_hours, 0) AS planned_hours,
  coalesce(es.total_student_hours, 0) AS completed_student_hours,

  -- Cobertura
  coalesce(es.courses_with_extension, 0) AS courses_with_extension,
  (SELECT count(*) FROM vertice_courses c WHERE c.institution_id = i.id) AS total_courses,

  -- ODS
  (SELECT count(DISTINCT sl.target_id)
    FROM vertice_extension_sdg_links sl
    WHERE sl.institution_id = i.id
  ) AS sdg_targets_linked,

  -- Governança
  (SELECT pol.min_extension_pct
    FROM vertice_extension_policies pol
    WHERE pol.institution_id = i.id AND pol.status = 'vigente'
    LIMIT 1
  ) AS policy_min_pct,

  -- Entregáveis
  coalesce(es.total_deliverables, 0) AS total_deliverables,

  -- Últimas importações
  (SELECT count(*)
    FROM vertice_extension_imports imp
    WHERE imp.institution_id = i.id AND imp.imported_at > current_date - interval '90 days'
  ) AS recent_imports,

  -- Relatórios
  (SELECT count(*)
    FROM vertice_extension_reports r
    WHERE r.institution_id = i.id AND r.status IN ('validado', 'publicado')
  ) AS published_reports

FROM vertice_institutions i
LEFT JOIN v_extension_summary es ON es.institution_id = i.id;

-- 4. View: cobertura por curso com % de extensão
CREATE OR REPLACE VIEW v_extension_course_coverage AS
SELECT
  c.institution_id,
  c.id AS course_id,
  c.name AS course_name,
  coalesce(ec.total_projects, 0) AS projects,
  coalesce(ec.total_students, 0) AS students,
  coalesce(ec.total_student_hours, 0) AS student_hours,
  -- [Inferência] O cálculo de % depende da carga horária total do curso,
  -- que pode não estar na tabela vertice_courses. Usando total_hours
  -- como proxy quando disponível.
  CASE
    WHEN coalesce(ec.total_student_hours, 0) > 0 AND ec.total_students > 0
    THEN round(ec.total_student_hours::numeric / ec.total_students, 1)
    ELSE 0
  END AS avg_hours_per_student,
  coalesce(ec.total_deliverables, 0) AS deliverables
FROM vertice_courses c
LEFT JOIN v_extension_coverage ec
  ON ec.course_id = c.id AND ec.institution_id = c.institution_id;

-- 5. RLS
ALTER TABLE vertice_extension_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_reports_read" ON vertice_extension_reports
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_reports_write" ON vertice_extension_reports
  FOR ALL USING (vertice_private.can_read_institution(institution_id));

CREATE POLICY "ext_imports_read" ON vertice_extension_imports
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_imports_write" ON vertice_extension_imports
  FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_ext_reports_inst ON vertice_extension_reports(institution_id);
CREATE INDEX IF NOT EXISTS idx_ext_reports_type ON vertice_extension_reports(institution_id, report_type);
CREATE INDEX IF NOT EXISTS idx_ext_reports_status ON vertice_extension_reports(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_ext_imports_inst ON vertice_extension_imports(institution_id);
CREATE INDEX IF NOT EXISTS idx_ext_imports_hash ON vertice_extension_imports(institution_id, file_hash);
