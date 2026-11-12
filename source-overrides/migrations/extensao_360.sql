-- ============================================================
-- Extensão 360° — Repositório de Projetos de Extensão
-- Módulo regulatório: DCNs exigem mínimo 10% da carga horária
-- ============================================================

-- 1. Eixos temáticos de extensão
CREATE TABLE IF NOT EXISTS vertice_extension_axes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  ods_alignment text[], -- ODS vinculados (ex: '{ODS4,ODS10,ODS16}')
  created_at timestamptz DEFAULT now(),
  UNIQUE(institution_id, name)
);

-- 2. Projetos/programas de extensão
CREATE TABLE IF NOT EXISTS vertice_extension_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  axis_id uuid REFERENCES vertice_extension_axes(id) ON DELETE SET NULL,
  title text NOT NULL,
  code text, -- código interno (EXT-2026-001)
  project_type text NOT NULL DEFAULT 'projeto'
    CHECK (project_type IN ('projeto','programa','curso_extensao','evento','prestacao_servico')),
  description text,
  justification text,
  target_community text, -- comunidade atendida
  target_audience_count int DEFAULT 0, -- estimativa de público
  coordinator_name text,
  coordinator_email text,
  status text NOT NULL DEFAULT 'planejamento'
    CHECK (status IN ('planejamento','em_aprovacao','aprovado','em_execucao','concluido','cancelado','suspenso')),
  approved_by text,
  approved_at timestamptz,
  start_date date,
  end_date date,
  total_hours int DEFAULT 0, -- carga horária total do projeto
  semester text, -- ex: '2026/01'
  course_ids uuid[], -- cursos vinculados
  partner_institutions text[], -- parceiros externos
  ods_goals text[], -- ODS específicos
  keywords text[],
  budget_estimated numeric(12,2) DEFAULT 0,
  budget_executed numeric(12,2) DEFAULT 0,
  evidence_doc_ids uuid[], -- links para vertice_documents
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Participantes do projeto
CREATE TABLE IF NOT EXISTS vertice_extension_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  participant_type text NOT NULL DEFAULT 'discente'
    CHECK (participant_type IN ('docente','discente','tecnico','comunidade','externo')),
  name text NOT NULL,
  registration_number text, -- matrícula (discente) ou SIAPE (docente)
  course_id uuid, -- curso do aluno
  hours_assigned int DEFAULT 0, -- horas atribuídas neste projeto
  hours_completed int DEFAULT 0, -- horas efetivamente cumpridas
  role_in_project text, -- coordenador, bolsista, voluntário, monitor
  is_scholarship boolean DEFAULT false, -- bolsista?
  scholarship_value numeric(10,2),
  started_at date,
  ended_at date,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','desligado','trancado')),
  created_at timestamptz DEFAULT now()
);

-- 4. Relatórios / entregas por projeto
CREATE TABLE IF NOT EXISTS vertice_extension_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  deliverable_type text NOT NULL DEFAULT 'relatorio'
    CHECK (deliverable_type IN ('relatorio_parcial','relatorio_final','artigo','publicacao','evento_realizado','produto','certificado','outro')),
  description text,
  delivered_at date,
  document_id uuid, -- link para vertice_documents
  url text, -- link externo (DOI, repositório)
  created_at timestamptz DEFAULT now()
);

-- 5. View: cobertura extensionista por curso
CREATE OR REPLACE VIEW v_extension_coverage AS
SELECT
  p.institution_id,
  unnest(p.course_ids) AS course_id,
  p.semester,
  count(DISTINCT p.id) AS total_projects,
  count(DISTINCT par.id) FILTER (WHERE par.participant_type = 'discente') AS total_students,
  coalesce(sum(par.hours_completed) FILTER (WHERE par.participant_type = 'discente'), 0) AS total_student_hours,
  count(DISTINCT par.id) FILTER (WHERE par.participant_type = 'docente') AS total_faculty,
  count(DISTINCT del.id) AS total_deliverables
FROM vertice_extension_projects p
LEFT JOIN vertice_extension_participants par ON par.project_id = p.id
LEFT JOIN vertice_extension_deliverables del ON del.project_id = p.id
WHERE p.status NOT IN ('cancelado','suspenso')
GROUP BY p.institution_id, unnest(p.course_ids), p.semester;

-- 6. View: resumo institucional
CREATE OR REPLACE VIEW v_extension_summary AS
SELECT
  p.institution_id,
  count(DISTINCT p.id) AS total_projects,
  count(DISTINCT p.id) FILTER (WHERE p.status = 'em_execucao') AS active_projects,
  count(DISTINCT p.id) FILTER (WHERE p.status = 'concluido') AS completed_projects,
  count(DISTINCT par.id) FILTER (WHERE par.participant_type = 'discente') AS total_students,
  count(DISTINCT par.id) FILTER (WHERE par.participant_type = 'docente') AS total_faculty,
  count(DISTINCT par.id) FILTER (WHERE par.participant_type = 'comunidade') AS community_participants,
  coalesce(sum(p.total_hours), 0) AS total_project_hours,
  coalesce(sum(par.hours_completed) FILTER (WHERE par.participant_type = 'discente'), 0) AS total_student_hours,
  count(DISTINCT del.id) AS total_deliverables,
  count(DISTINCT unnest) AS courses_with_extension,
  array_agg(DISTINCT p.semester ORDER BY p.semester DESC) FILTER (WHERE p.semester IS NOT NULL) AS semesters
FROM vertice_extension_projects p
LEFT JOIN vertice_extension_participants par ON par.project_id = p.id
LEFT JOIN vertice_extension_deliverables del ON del.project_id = p.id
LEFT JOIN LATERAL unnest(p.course_ids) ON true
WHERE p.status NOT IN ('cancelado','suspenso')
GROUP BY p.institution_id;

-- 7. RLS
ALTER TABLE vertice_extension_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_axes_read" ON vertice_extension_axes FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_axes_write" ON vertice_extension_axes FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_projects_read" ON vertice_extension_projects FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_projects_write" ON vertice_extension_projects FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_participants_read" ON vertice_extension_participants FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_participants_write" ON vertice_extension_participants FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_deliverables_read" ON vertice_extension_deliverables FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_deliverables_write" ON vertice_extension_deliverables FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- 8. Catálogo de módulos — Superior + Escolas
INSERT INTO vertice_module_catalog (code, name, tier, package, tabs, depends_on, display_order, active, description)
VALUES
  ('ACAD_EXTENSAO', 'Extensão 360°', 'regulacao', 'completo', ARRAY['extensao'], ARRAY['CORE_CADASTRO'], 46, true, 'Repositório de projetos de extensão — participantes, entregas, cobertura por curso e dossiê regulatório.'),
  ('ESC_EXTENSAO', 'Extensão Escolar', 'escolas', 'completo', ARRAY['extensao'], ARRAY['CORE_CADASTRO'], 47, true, 'Extensão escolar — projetos, participantes e cobertura.')
ON CONFLICT (code) DO NOTHING;

-- 9. Índices
CREATE INDEX IF NOT EXISTS idx_ext_projects_inst ON vertice_extension_projects(institution_id);
CREATE INDEX IF NOT EXISTS idx_ext_projects_status ON vertice_extension_projects(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_ext_participants_project ON vertice_extension_participants(project_id);
CREATE INDEX IF NOT EXISTS idx_ext_participants_type ON vertice_extension_participants(institution_id, participant_type);
CREATE INDEX IF NOT EXISTS idx_ext_deliverables_project ON vertice_extension_deliverables(project_id);
