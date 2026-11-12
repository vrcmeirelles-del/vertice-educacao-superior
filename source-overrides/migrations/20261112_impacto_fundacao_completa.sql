-- ============================================================
-- VÉRTICE IMPACTO — Fundação completa do módulo
-- Migração consolidada: 7 blocos estruturantes
--
-- Pré-requisitos: tabelas vertice_institutions, vertice_courses,
-- vertice_extension_projects, vertice_extension_students,
-- vertice_extension_hour_entries, vertice_sdg_goals/targets,
-- vertice_extension_policies/plans/calendar já existentes.
--
-- Esta migração é ADITIVA — não altera nem remove nada existente.
-- ============================================================

-- ========================================
-- BLOCO 1: LIVRO-RAZÃO COM 8 ESTADOS
-- Amplia hour_entries com estados completos
-- ========================================

-- Adicionar estados ao livro-razão existente
ALTER TABLE vertice_extension_hour_entries
  ADD COLUMN IF NOT EXISTS hour_state text NOT NULL DEFAULT 'executada'
    CHECK (hour_state IN (
      'prevista',           -- horas planejadas no projeto
      'programada',         -- horas agendadas em atividade específica
      'executada',          -- atividade realizada
      'declarada',          -- estudante/orientador declarou
      'aguardando_validacao', -- enviada para validação
      'validada',           -- validada pelo coordenador
      'integralizada',      -- reconciliada com sistema acadêmico
      'indeferida'          -- rejeitada com justificativa
    )),
  ADD COLUMN IF NOT EXISTS activity_id uuid,         -- referência à atividade
  ADD COLUMN IF NOT EXISTS component_id uuid,        -- componente curricular
  ADD COLUMN IF NOT EXISTS rejection_reason text,     -- motivo do indeferimento
  ADD COLUMN IF NOT EXISTS integrated_at timestamptz, -- quando foi integralizada
  ADD COLUMN IF NOT EXISTS integrated_by uuid;        -- quem reconciliou

-- Índice por estado para queries de curricularização
CREATE INDEX IF NOT EXISTS idx_hour_entries_state
  ON vertice_extension_hour_entries(institution_id, hour_state);

-- View: curricularização por curso
CREATE OR REPLACE VIEW v_extension_curricularization AS
SELECT
  s.institution_id,
  s.course_id,
  count(DISTINCT s.id) AS total_students,
  count(DISTINCT s.id) FILTER (
    WHERE coalesce(h.validated_hours, 0) >= coalesce(target.min_hours, 0)
  ) AS students_regular,
  count(DISTINCT s.id) FILTER (
    WHERE coalesce(h.validated_hours, 0) < coalesce(target.min_hours, 0)
  ) AS students_pending,
  coalesce(sum(h.planned_hours), 0) AS total_planned_hours,
  coalesce(sum(h.executed_hours), 0) AS total_executed_hours,
  coalesce(sum(h.validated_hours), 0) AS total_validated_hours,
  coalesce(sum(h.integrated_hours), 0) AS total_integrated_hours,
  coalesce(sum(h.pending_hours), 0) AS total_pending_hours
FROM vertice_extension_students s
LEFT JOIN LATERAL (
  SELECT
    floor(sum(e.minutes) FILTER (WHERE e.hour_state = 'prevista')::numeric / 60) AS planned_hours,
    floor(sum(e.minutes) FILTER (WHERE e.hour_state = 'executada')::numeric / 60) AS executed_hours,
    floor(sum(e.minutes) FILTER (WHERE e.hour_state = 'validada')::numeric / 60) AS validated_hours,
    floor(sum(e.minutes) FILTER (WHERE e.hour_state = 'integralizada')::numeric / 60) AS integrated_hours,
    floor(sum(e.minutes) FILTER (WHERE e.hour_state IN ('executada','declarada','aguardando_validacao'))::numeric / 60) AS pending_hours
  FROM vertice_extension_hour_entries e
  WHERE e.student_id = s.id
) h ON true
LEFT JOIN LATERAL (
  SELECT (pol.min_extension_pct / 100.0 * 3200)::int AS min_hours -- 3200h padrão, parametrizável
  FROM vertice_extension_policies pol
  WHERE pol.institution_id = s.institution_id AND pol.status = 'vigente'
  LIMIT 1
) target ON true
GROUP BY s.institution_id, s.course_id;

-- ========================================
-- BLOCO 2: SCHEMA DE PROJETOS AMPLIADO
-- Campos completos conforme prompt Impacto
-- ========================================

ALTER TABLE vertice_extension_projects
  ADD COLUMN IF NOT EXISTS social_problem text,           -- problema social identificado
  ADD COLUMN IF NOT EXISTS general_objective text,        -- objetivo geral
  ADD COLUMN IF NOT EXISTS specific_objectives text[],    -- objetivos específicos
  ADD COLUMN IF NOT EXISTS beneficiary_profile text,      -- perfil do público beneficiário
  ADD COLUMN IF NOT EXISTS external_community text,       -- comunidade externa envolvida
  ADD COLUMN IF NOT EXISTS related_component_id uuid,     -- componente curricular relacionado
  ADD COLUMN IF NOT EXISTS methodology text,              -- metodologia
  ADD COLUMN IF NOT EXISTS required_resources text,       -- recursos necessários
  ADD COLUMN IF NOT EXISTS expected_results text[],       -- resultados esperados
  ADD COLUMN IF NOT EXISTS required_evidence text[],      -- evidências necessárias
  ADD COLUMN IF NOT EXISTS schedule jsonb,                -- cronograma estruturado
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'rascunho'
    CHECK (review_status IN (
      'rascunho', 'submetido', 'em_analise', 'pendente_ajustes',
      'aprovado', 'em_execucao', 'aguardando_evidencias',
      'em_avaliacao', 'concluido', 'reprovado', 'arquivado'
    ));

-- Histórico de alterações de projetos
CREATE TABLE IF NOT EXISTS vertice_extension_project_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

ALTER TABLE vertice_extension_project_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_history_read" ON vertice_extension_project_history
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "project_history_insert" ON vertice_extension_project_history
  FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));

CREATE INDEX IF NOT EXISTS idx_project_history_project
  ON vertice_extension_project_history(project_id, changed_at DESC);

-- ========================================
-- BLOCO 3: GESTÃO PEDAGÓGICA
-- Atividades, competências, avaliações
-- ========================================

-- Atividades do projeto
CREATE TABLE IF NOT EXISTS vertice_extension_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  activity_type text NOT NULL DEFAULT 'pratica'
    CHECK (activity_type IN ('pratica','teorica','campo','oficina','evento','orientacao','avaliacao','reflexao')),
  scheduled_date date,
  duration_minutes int,
  location text,
  responsible_id uuid,             -- professor/orientador
  max_participants int,
  status text DEFAULT 'planejada'
    CHECK (status IN ('planejada','confirmada','em_andamento','concluida','cancelada')),
  learning_goals text[],           -- metas de aprendizagem
  competencies text[],             -- competências desenvolvidas
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Participação em atividades (presença + avaliação)
CREATE TABLE IF NOT EXISTS vertice_extension_activity_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES vertice_extension_activities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES vertice_extension_students(id) ON DELETE CASCADE,
  present boolean DEFAULT false,
  hours_credited int DEFAULT 0,     -- minutos creditados por esta participação
  performance_notes text,           -- observações do orientador
  self_reflection text,             -- reflexão do estudante
  grade numeric(5,2),               -- nota, se aplicável
  feedback text,                    -- devolutiva do orientador
  evaluated_by uuid,
  evaluated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, student_id)
);

-- Competências do curso (catálogo)
CREATE TABLE IF NOT EXISTS vertice_extension_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid REFERENCES vertice_courses(id),
  code text,                        -- ex: "C01", "EXT-COMP-01"
  name text NOT NULL,
  description text,
  category text DEFAULT 'extensao'
    CHECK (category IN ('extensao','transversal','especifica','profissional','cidada')),
  source_document text,             -- PPC, DCN, etc.
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Avaliação de competências por estudante
CREATE TABLE IF NOT EXISTS vertice_extension_competency_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES vertice_extension_students(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES vertice_extension_competencies(id),
  level text NOT NULL DEFAULT 'em_desenvolvimento'
    CHECK (level IN ('nao_demonstrada','em_desenvolvimento','demonstrada','consolidada')),
  evidence_description text,
  evaluated_by uuid NOT NULL,
  evaluated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, project_id, competency_id)
);

-- RLS
ALTER TABLE vertice_extension_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_activity_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_competency_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_activities_read" ON vertice_extension_activities FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_activities_write" ON vertice_extension_activities FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_participation_read" ON vertice_extension_activity_participation FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_participation_write" ON vertice_extension_activity_participation FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_competencies_read" ON vertice_extension_competencies FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_competencies_write" ON vertice_extension_competencies FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_comp_eval_read" ON vertice_extension_competency_evaluations FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ext_comp_eval_write" ON vertice_extension_competency_evaluations FOR ALL USING (vertice_private.can_read_institution(institution_id));

CREATE INDEX IF NOT EXISTS idx_ext_activities_project ON vertice_extension_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_ext_participation_activity ON vertice_extension_activity_participation(activity_id);
CREATE INDEX IF NOT EXISTS idx_ext_participation_student ON vertice_extension_activity_participation(student_id);
CREATE INDEX IF NOT EXISTS idx_ext_competencies_course ON vertice_extension_competencies(institution_id, course_id);

-- ========================================
-- BLOCO 4: REPOSITÓRIO DE EVIDÊNCIAS
-- Completo com versionamento e validação
-- ========================================

CREATE TABLE IF NOT EXISTS vertice_extension_evidence_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  -- Identificação
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'outro'
    CHECK (document_type IN (
      'relatorio_execucao','relatorio_parcial','relatorio_final',
      'lista_presenca','registro_fotografico','artigo','publicacao',
      'certificado','termo_parceria','avaliacao_comunidade',
      'plano_ensino','ata','formulario','questionario','outro'
    )),

  -- Vinculações
  project_id uuid REFERENCES vertice_extension_projects(id),
  activity_id uuid REFERENCES vertice_extension_activities(id),
  student_id uuid REFERENCES vertice_extension_students(id),

  -- Arquivo
  storage_path text NOT NULL,        -- caminho no Supabase Storage
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes int NOT NULL,
  file_hash text NOT NULL,           -- SHA-256

  -- Versionamento
  version int NOT NULL DEFAULT 1,
  previous_version_id uuid,          -- aponta para versão anterior
  is_current boolean DEFAULT true,

  -- Validação
  validation_status text NOT NULL DEFAULT 'pendente'
    CHECK (validation_status IN ('pendente','em_analise','aprovada','rejeitada','revisao_solicitada')),
  validated_by uuid,
  validated_at timestamptz,
  rejection_reason text,

  -- Metadados
  period text,                       -- ex: "2026/01"
  tags text[],
  notes text,

  -- Auditoria
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz DEFAULT now(),

  -- Não permitir hash duplicado no mesmo projeto (impede reupload)
  UNIQUE(institution_id, project_id, file_hash)
);

-- Histórico de versões (preservar quando substitui)
CREATE TABLE IF NOT EXISTS vertice_extension_evidence_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES vertice_extension_evidence_registry(id) ON DELETE CASCADE,
  version int NOT NULL,
  storage_path text NOT NULL,
  file_hash text NOT NULL,
  file_size_bytes int NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL,
  replaced_at timestamptz DEFAULT now(),
  replaced_by uuid
);

ALTER TABLE vertice_extension_evidence_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_evidence_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_read" ON vertice_extension_evidence_registry FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "evidence_write" ON vertice_extension_evidence_registry FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "evidence_versions_read" ON vertice_extension_evidence_versions FOR SELECT USING (true);
CREATE POLICY "evidence_versions_insert" ON vertice_extension_evidence_versions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_evidence_project ON vertice_extension_evidence_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_student ON vertice_extension_evidence_registry(student_id);
CREATE INDEX IF NOT EXISTS idx_evidence_inst ON vertice_extension_evidence_registry(institution_id);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON vertice_extension_evidence_registry(institution_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_evidence_hash ON vertice_extension_evidence_registry(institution_id, file_hash);

-- ========================================
-- BLOCO 5: PLANO DE AÇÃO 5W2H
-- Ligado ao vertice_actions existente
-- ========================================

-- Tabela de achados (findings) — o que a IA ou a revisão identificou
CREATE TABLE IF NOT EXISTS vertice_extension_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  -- Origem do achado
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual','ai_documental','ai_estrutural','ai_projeto','revisao','auditoria')),
  source_analysis_id uuid,          -- referência à análise de IA que gerou

  -- Achado
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medio'
    CHECK (severity IN ('critico','alto','medio','baixo','informativo')),
  category text DEFAULT 'geral'
    CHECK (category IN ('curricularizacao','documentacao','regulatorio','pedagogico','ods','evidencia','geral')),

  -- Contexto
  project_id uuid REFERENCES vertice_extension_projects(id),
  course_id uuid REFERENCES vertice_courses(id),
  document_source text,             -- documento onde foi encontrado
  document_location text,           -- página, seção, célula

  -- Impacto e confiança
  potential_impact text,
  confidence_level text DEFAULT 'media'
    CHECK (confidence_level IN ('alta','media','baixa')),

  -- Resolução
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_analise','acao_criada','resolvido','ignorado','falso_positivo')),
  action_id uuid,                   -- link para vertice_actions (5W2H)
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,

  -- Auditoria
  found_by uuid NOT NULL,
  found_at timestamptz DEFAULT now()
);

-- Estender vertice_actions com campos 5W2H específicos do Impacto
-- (vertice_actions já existe — apenas adicionamos colunas)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'vertice_actions') THEN
    ALTER TABLE vertice_actions
      ADD COLUMN IF NOT EXISTS finding_id uuid,
      ADD COLUMN IF NOT EXISTS what_description text,
      ADD COLUMN IF NOT EXISTS why_justification text,
      ADD COLUMN IF NOT EXISTS where_location text,
      ADD COLUMN IF NOT EXISTS when_deadline date,
      ADD COLUMN IF NOT EXISTS who_responsible text,
      ADD COLUMN IF NOT EXISTS how_method text,
      ADD COLUMN IF NOT EXISTS how_much_cost numeric(14,2),
      ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media'
        CHECK (priority IN ('urgente','alta','media','baixa')),
      ADD COLUMN IF NOT EXISTS progress_pct int DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
      ADD COLUMN IF NOT EXISTS evidence_doc_id uuid,
      ADD COLUMN IF NOT EXISTS validated_by_superior uuid,
      ADD COLUMN IF NOT EXISTS validated_at timestamptz;
  END IF;
END $$;

ALTER TABLE vertice_extension_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "findings_read" ON vertice_extension_findings FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "findings_write" ON vertice_extension_findings FOR ALL USING (vertice_private.can_read_institution(institution_id));

CREATE INDEX IF NOT EXISTS idx_findings_inst ON vertice_extension_findings(institution_id);
CREATE INDEX IF NOT EXISTS idx_findings_project ON vertice_extension_findings(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON vertice_extension_findings(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON vertice_extension_findings(institution_id, severity);

-- ========================================
-- BLOCO 6: TABELAS DE IA
-- Análises, achados com fonte, referências
-- ========================================

-- Análises de IA (cada execução)
CREATE TABLE IF NOT EXISTS vertice_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  analysis_type text NOT NULL
    CHECK (analysis_type IN (
      'documental',          -- leitura e classificação de documentos
      'estrutural',          -- cruzamento PPC/matriz/ementas
      'projeto',             -- avaliação de qualidade de projeto
      'evidencia',           -- verificação de evidências
      'curricularizacao',    -- análise de carga horária
      'cruzamento',          -- comparação entre documentos
      'conformidade'         -- checklist regulatório
    )),

  -- Escopo
  project_id uuid REFERENCES vertice_extension_projects(id),
  course_id uuid REFERENCES vertice_courses(id),
  document_ids uuid[],              -- documentos analisados

  -- Configuração
  model_used text NOT NULL,         -- ex: "claude-3-5-sonnet-20241022"
  model_version text,
  parameters jsonb DEFAULT '{}',
  prompt_version text,              -- versão do prompt usado

  -- Resultado
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','processando','concluida','falha','cancelada')),
  summary text,                     -- resumo executivo
  findings_count int DEFAULT 0,

  -- Rastreabilidade
  requested_by uuid NOT NULL,
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  processing_time_ms int,
  tokens_used int,
  cost_estimate numeric(10,4),

  -- Validação humana
  validated_by uuid,
  validated_at timestamptz,
  validation_notes text
);

-- Achados de IA com fonte rastreável
CREATE TABLE IF NOT EXISTS vertice_ai_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES vertice_ai_analyses(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  -- Achado
  finding_type text NOT NULL DEFAULT 'informacao'
    CHECK (finding_type IN (
      'informacao_comprovada',
      'informacao_parcial',
      'inferencia_ia',
      'informacao_nao_localizada',
      'pendente_validacao',
      'inconsistencia',
      'lacuna',
      'recomendacao'
    )),

  title text NOT NULL,
  description text NOT NULL,
  confidence numeric(3,2) CHECK (confidence BETWEEN 0 AND 1), -- 0.0 a 1.0

  -- Classificação documental
  conformity_status text
    CHECK (conformity_status IN (
      'conforme','parcialmente_conforme','nao_conforme',
      'nao_identificado','nao_aplicavel','aguardando_validacao'
    )),
  justification text,              -- justificativa da classificação

  -- Impacto
  severity text DEFAULT 'informativo'
    CHECK (severity IN ('critico','alto','medio','baixo','informativo')),
  recommendation text,

  created_at timestamptz DEFAULT now()
);

-- Referências de fonte (onde a IA encontrou a informação)
CREATE TABLE IF NOT EXISTS vertice_ai_source_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES vertice_ai_findings(id) ON DELETE CASCADE,

  -- Documento fonte
  document_name text NOT NULL,
  document_version text,
  document_id uuid,                 -- se existir no repositório

  -- Localização precisa
  page_number int,
  section_title text,
  table_reference text,             -- "Tabela 3, linha 5"
  cell_reference text,              -- "Planilha X, célula B12"
  text_excerpt text,                -- trecho que fundamenta (max 500 chars)

  created_at timestamptz DEFAULT now()
);

ALTER TABLE vertice_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_ai_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_ai_source_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_analyses_read" ON vertice_ai_analyses FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ai_analyses_write" ON vertice_ai_analyses FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ai_findings_read" ON vertice_ai_findings FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ai_findings_write" ON vertice_ai_findings FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "ai_refs_read" ON vertice_ai_source_references FOR SELECT USING (true);
CREATE POLICY "ai_refs_insert" ON vertice_ai_source_references FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_inst ON vertice_ai_analyses(institution_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_type ON vertice_ai_analyses(institution_id, analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_findings_analysis ON vertice_ai_findings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_refs_finding ON vertice_ai_source_references(finding_id);

-- ========================================
-- BLOCO 7: PERFIS DE ACESSO DO IMPACTO
-- 12 papéis conforme o prompt
-- ========================================

CREATE TABLE IF NOT EXISTS vertice_impacto_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,             -- auth.uid()

  role text NOT NULL
    CHECK (role IN (
      'master',               -- Vértice Master: acesso global
      'reitor',               -- visão institucional consolidada
      'direcao',              -- acompanhamento executivo
      'pro_reitoria',         -- gestão acadêmica e extensão
      'diretor_pedagogico',   -- gestão das estruturas curriculares
      'coordenador_curso',    -- gestão da extensão do curso
      'coordenador_extensao', -- gestão dos projetos e atividades
      'nde',                  -- acompanhamento pedagógico e curricular
      'professor_orientador', -- orientação e avaliação dos projetos
      'estudante',            -- acompanhamento das atividades e horas
      'parceiro_externo',     -- participação e avaliação autorizadas
      'auditor'               -- acesso controlado a evidências e relatórios
    )),

  -- Escopo (curso ou projeto específico, quando aplicável)
  course_id uuid REFERENCES vertice_courses(id),
  project_id uuid REFERENCES vertice_extension_projects(id),

  -- Metadados
  granted_by uuid NOT NULL,
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz,            -- null = permanente
  active boolean DEFAULT true,
  notes text,

  UNIQUE(institution_id, user_id, role, course_id)
);

ALTER TABLE vertice_impacto_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impacto_roles_read" ON vertice_impacto_roles FOR SELECT
  USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "impacto_roles_write" ON vertice_impacto_roles FOR ALL
  USING (vertice_private.can_read_institution(institution_id));

CREATE INDEX IF NOT EXISTS idx_impacto_roles_user ON vertice_impacto_roles(user_id, institution_id);
CREATE INDEX IF NOT EXISTS idx_impacto_roles_inst ON vertice_impacto_roles(institution_id, role);

-- Função para verificar papel no Impacto
CREATE OR REPLACE FUNCTION vertice_private.has_impacto_role(
  p_institution_id uuid,
  p_role text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vertice_impacto_roles
    WHERE institution_id = p_institution_id
    AND user_id = auth.uid()
    AND role = p_role
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ========================================
-- BLOCO 8: PARCEIROS EXTERNOS
-- ========================================

CREATE TABLE IF NOT EXISTS vertice_extension_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  partner_type text NOT NULL DEFAULT 'organizacao'
    CHECK (partner_type IN ('organizacao','empresa','governo','ong','comunidade','pessoa_fisica')),
  cnpj_cpf text,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  territory text,                   -- bairro/região/município atendido
  agreement_type text,              -- convênio, termo, carta
  agreement_doc_id uuid,            -- referência ao repositório
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Vinculação parceiro-projeto
CREATE TABLE IF NOT EXISTS vertice_extension_project_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES vertice_extension_partners(id) ON DELETE CASCADE,
  role_in_project text,             -- papel do parceiro
  contribution text,                -- o que contribui
  UNIQUE(project_id, partner_id)
);

ALTER TABLE vertice_extension_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_project_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_read" ON vertice_extension_partners FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "partners_write" ON vertice_extension_partners FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "project_partners_read" ON vertice_extension_project_partners FOR SELECT USING (true);
CREATE POLICY "project_partners_write" ON vertice_extension_project_partners FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_partners_inst ON vertice_extension_partners(institution_id);

-- ========================================
-- BLOCO 9: INTEGRAÇÕES (CONEXÕES EXTERNAS)
-- DreamShaper, sistema acadêmico, etc.
-- ========================================

CREATE TABLE IF NOT EXISTS vertice_extension_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  system_name text NOT NULL,         -- 'dreamshaper', 'totvs', 'sophia', etc.
  integration_type text NOT NULL DEFAULT 'csv_import'
    CHECK (integration_type IN ('api','lti','sso','csv_import','xlsx_import','webhook','manual')),

  -- Configuração (sem credenciais — essas vão em secrets)
  base_url text,
  capabilities jsonb DEFAULT '{}',   -- o que foi confirmado como disponível
  unconfirmed_capabilities text[],   -- o que não foi validado

  -- Estado
  status text NOT NULL DEFAULT 'configurada'
    CHECK (status IN ('configurada','testada','operacional','suspensa','desativada')),
  last_sync_at timestamptz,
  last_sync_status text,
  sync_count int DEFAULT 0,
  error_count int DEFAULT 0,

  -- Auditoria
  configured_by uuid NOT NULL,
  configured_at timestamptz DEFAULT now(),
  notes text,

  UNIQUE(institution_id, system_name)
);

-- Runs de sincronização
CREATE TABLE IF NOT EXISTS vertice_extension_integration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES vertice_extension_integrations(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  run_type text NOT NULL DEFAULT 'import'
    CHECK (run_type IN ('import','export','sync','reconciliation')),

  status text NOT NULL DEFAULT 'iniciada'
    CHECK (status IN ('iniciada','processando','concluida','falha','cancelada')),

  records_processed int DEFAULT 0,
  records_created int DEFAULT 0,
  records_updated int DEFAULT 0,
  records_skipped int DEFAULT 0,
  records_error int DEFAULT 0,

  error_details jsonb DEFAULT '[]',
  reconciliation_notes text,

  started_by uuid NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms int
);

ALTER TABLE vertice_extension_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_extension_integration_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_read" ON vertice_extension_integrations FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "integrations_write" ON vertice_extension_integrations FOR ALL USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "integration_runs_read" ON vertice_extension_integration_runs FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "integration_runs_write" ON vertice_extension_integration_runs FOR ALL USING (vertice_private.can_read_institution(institution_id));

-- ============================================================
-- FIM DA MIGRAÇÃO — VERIFICAÇÃO
-- ============================================================
-- Executar após aplicação:
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
-- AND (tablename LIKE 'vertice_extension%' OR tablename LIKE 'vertice_ai%' OR tablename LIKE 'vertice_impacto%')
-- ORDER BY tablename;
-- Esperado: ~30 tabelas
