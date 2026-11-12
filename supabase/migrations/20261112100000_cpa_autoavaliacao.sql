-- ============================================================
-- VÉRTICE — MÓDULO CPA E AUTOAVALIAÇÃO INSTITUCIONAL
-- Migração: 20261112100000_cpa_autoavaliacao.sql
-- ============================================================
-- Módulo independente. CPA não é subordinada a Egressos.
-- Reutiliza vertice_institutions, vertice_courses, auth, memberships.
-- NÃO sobrescreve vertice_instrumento_cpa existente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- §2 — BIBLIOTECA DE REFERENCIAIS INEP
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_references (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL,          -- ex: 'INST_RECRED_2017', 'INST_PROP_2026'
  title           text NOT NULL,
  source_url      text,
  version         text NOT NULL,          -- '2017', '2026-consulta'
  status          text NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente','proposta','revogado','substituido')),
  effective_date  date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code, version)
);

-- Objetos/indicadores de cada referencial
CREATE TABLE IF NOT EXISTS vertice_cpa_reference_objects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id    uuid NOT NULL REFERENCES vertice_cpa_references(id) ON DELETE CASCADE,
  object_code     text NOT NULL,          -- '1.1', '1.2', etc.
  internal_code   text,                   -- diferenciador quando código fonte repete (§2: 1.8.a.x)
  axis            text,                   -- 'Eixo 1', 'Dimensão 3', etc.
  title           text NOT NULL,
  description     text,
  descriptors     jsonb,                  -- [{code, text, level}]
  sort_order      smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reference_id, object_code, internal_code)
);
CREATE INDEX IF NOT EXISTS idx_cpa_ref_objects_ref ON vertice_cpa_reference_objects(reference_id);

-- ══════════════════════════════════════════════════════════════
-- §3 — GOVERNANÇA CPA
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  full_name       text NOT NULL,
  role            text NOT NULL,          -- presidente, docente, discente, tecnico, sociedade
  segment         text,                   -- representação
  appointment_ref text,                   -- portaria
  start_date      date,
  end_date        date,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_members_inst ON vertice_cpa_members(institution_id);

CREATE TABLE IF NOT EXISTS vertice_cpa_meetings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  meeting_date    date NOT NULL,
  title           text,
  agenda          text,
  minutes_url     text,                   -- ata
  attendees       text[],
  decisions       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_meetings_inst ON vertice_cpa_meetings(institution_id);

-- ══════════════════════════════════════════════════════════════
-- §3/§4 — CICLOS E PROJETO DE AUTOAVALIAÇÃO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_cycles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  title           text NOT NULL,          -- 'Ciclo 2026', 'Ciclo 2024-2026'
  reference_id    uuid REFERENCES vertice_cpa_references(id),
  start_date      date,
  end_date        date,
  project_url     text,                   -- Projeto de Autoavaliação
  methodology     text,
  status          text NOT NULL DEFAULT 'planejamento' CHECK (status IN (
    'planejamento','coleta','analise','relatorio','devolutiva','meta_avaliacao','encerrado'
  )),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, title)
);
CREATE INDEX IF NOT EXISTS idx_cpa_cycles_inst ON vertice_cpa_cycles(institution_id);

-- ══════════════════════════════════════════════════════════════
-- §4 — INSTRUMENTOS DE PESQUISA CPA (versionados)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_instruments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  cycle_id        uuid REFERENCES vertice_cpa_cycles(id),
  title           text NOT NULL,
  version         smallint NOT NULL DEFAULT 1,
  target_audience text NOT NULL CHECK (target_audience IN (
    'estudante','docente','tecnico','egresso','sociedade','gestao','todos'
  )),
  -- personalização
  course_id       uuid REFERENCES vertice_courses(id),  -- NULL = institucional
  modality        text,
  campus          text,
  -- controle
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','piloto','publicado','encerrado','arquivado'
  )),
  published_at    timestamptz,            -- congela versão
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, title, version, target_audience)
);
CREATE INDEX IF NOT EXISTS idx_cpa_instruments_inst ON vertice_cpa_instruments(institution_id);

-- Perguntas do instrumento
CREATE TABLE IF NOT EXISTS vertice_cpa_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id   uuid NOT NULL REFERENCES vertice_cpa_instruments(id) ON DELETE CASCADE,
  stable_code     text NOT NULL,          -- identificador estável entre versões
  sort_order      smallint NOT NULL DEFAULT 0,
  section         text,                   -- bloco/dimensão visual
  dimension       text,                   -- dimensão SINAES
  question_text   text NOT NULL,
  objective       text,
  question_type   text NOT NULL CHECK (question_type IN (
    'likert','single_choice','multiple_choice','text','number','boolean'
  )),
  scale_config    jsonb,                  -- {min,max,labels,na_option,dk_option,pnr_option}
  options         jsonb,                  -- para choice types
  required        boolean NOT NULL DEFAULT false,
  -- vinculação ao referencial
  reference_object_id uuid REFERENCES vertice_cpa_reference_objects(id),
  descriptor_code text,
  -- ramificação
  depends_on      uuid REFERENCES vertice_cpa_questions(id),
  show_when_value text,
  -- metadados
  calc_rule       text,                   -- regra de cálculo
  source_type     text,                   -- opinião, documento, dado_institucional
  responsible     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_questions_instr ON vertice_cpa_questions(instrument_id, sort_order);

-- ══════════════════════════════════════════════════════════════
-- §5 — CAMPANHAS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  cycle_id        uuid REFERENCES vertice_cpa_cycles(id),
  instrument_id   uuid NOT NULL REFERENCES vertice_cpa_instruments(id),
  title           text NOT NULL,
  -- período
  opens_at        timestamptz NOT NULL,
  closes_at       timestamptz NOT NULL,
  -- público
  target_audience text NOT NULL,
  target_courses  uuid[],                 -- filtro por curso
  target_modality text,
  target_campus   text,
  -- canais
  channels        text[] NOT NULL DEFAULT '{portal}',
  -- controle
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','agendada','ativa','pausada','encerrada','cancelada'
  )),
  responsible_id  uuid,
  privacy_notice  text,
  max_reminders   smallint DEFAULT 3,
  reminder_cadence_days smallint DEFAULT 7,
  -- gamificação (§10)
  complementary_hours_enabled boolean NOT NULL DEFAULT false,
  complementary_hours_config  jsonb,      -- {regulamento, cursos, carga, limites, responsavel}
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_campaigns_inst ON vertice_cpa_campaigns(institution_id);

-- Elegíveis e convites
CREATE TABLE IF NOT EXISTS vertice_cpa_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES vertice_cpa_campaigns(id) ON DELETE CASCADE,
  -- pessoa (pode ser aluno, docente, técnico — usa profile genérico)
  person_type     text NOT NULL CHECK (person_type IN ('estudante','docente','tecnico','egresso','sociedade','gestao')),
  person_ref      text,                   -- matrícula, SIAPE, ID externo
  person_name     text,
  person_email    text,
  person_phone    text,
  -- rastreamento
  channel         text NOT NULL DEFAULT 'portal',
  token           text UNIQUE,
  status          text NOT NULL DEFAULT 'elegivel' CHECK (status IN (
    'elegivel','convidado','nao_iniciado','em_andamento','pausado',
    'concluido','recusou','contato_suspenso','campanha_encerrada'
  )),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  reminder_count  smallint NOT NULL DEFAULT 0,
  responded_at    timestamptz,
  -- modo WhatsApp gradual (§7)
  whatsapp_gradual boolean NOT NULL DEFAULT false,
  whatsapp_daily_limit smallint DEFAULT 2,
  whatsapp_last_sent_at timestamptz,
  whatsapp_pending_question_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, person_ref)
);
CREATE INDEX IF NOT EXISTS idx_cpa_inv_campaign ON vertice_cpa_invitations(campaign_id);

-- ══════════════════════════════════════════════════════════════
-- §6 — RESPOSTAS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES vertice_cpa_campaigns(id),
  invitation_id   uuid REFERENCES vertice_cpa_invitations(id),
  instrument_id   uuid NOT NULL REFERENCES vertice_cpa_instruments(id),
  -- estado
  status          text NOT NULL DEFAULT 'em_andamento' CHECK (status IN (
    'em_andamento','pausado','concluido','revisado','abandonado'
  )),
  started_at      timestamptz NOT NULL DEFAULT now(),
  last_saved_at   timestamptz,
  completed_at    timestamptz,
  reviewed_at     timestamptz,            -- revisou antes de submeter
  -- metadados
  device          text,
  channel_used    text,                   -- portal, whatsapp, email
  progress_pct    smallint DEFAULT 0,
  duration_seconds integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, invitation_id)
);
CREATE INDEX IF NOT EXISTS idx_cpa_resp_campaign ON vertice_cpa_responses(campaign_id);

-- Respostas por pergunta
CREATE TABLE IF NOT EXISTS vertice_cpa_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id     uuid NOT NULL REFERENCES vertice_cpa_responses(id) ON DELETE CASCADE,
  question_id     uuid NOT NULL REFERENCES vertice_cpa_questions(id),
  answer_value    text,                   -- valor normalizado
  answer_text     text,                   -- campo aberto
  answer_json     jsonb,                  -- múltipla escolha
  -- "Não se aplica", "Não sei avaliar", "Prefiro não responder" (§4)
  is_na           boolean DEFAULT false,
  is_dk           boolean DEFAULT false,  -- don't know
  is_pnr          boolean DEFAULT false,  -- prefer not to respond
  -- rastreamento
  answered_via    text DEFAULT 'portal' CHECK (answered_via IN ('portal','whatsapp','email')),
  answered_at     timestamptz DEFAULT now(),
  UNIQUE(response_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_cpa_answers_resp ON vertice_cpa_answers(response_id);

-- ══════════════════════════════════════════════════════════════
-- §8/§11 — RESULTADOS, ACHADOS E DECISÕES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  cycle_id        uuid REFERENCES vertice_cpa_cycles(id),
  campaign_id     uuid REFERENCES vertice_cpa_campaigns(id),
  course_id       uuid REFERENCES vertice_courses(id),
  -- achado
  finding_type    text NOT NULL CHECK (finding_type IN ('fragilidade','potencialidade','oportunidade','risco','neutro')),
  dimension       text,                   -- dimensão SINAES
  title           text NOT NULL,
  description     text,
  -- indicadores
  indicator_name  text,
  indicator_value numeric,
  indicator_formula text,
  indicator_denominator integer,
  indicator_source text,
  indicator_period text,
  indicator_limitations text,
  -- vínculo regulatório
  reference_object_id uuid REFERENCES vertice_cpa_reference_objects(id),
  pdi_ref         text,
  ppc_ref         text,
  -- decisão
  decision_status text NOT NULL DEFAULT 'identificado' CHECK (decision_status IN (
    'identificado','em_analise','priorizado','deliberado','recusado','arquivado'
  )),
  decision_notes  text,
  decision_by     text,
  decision_at     timestamptz,
  -- Um achado recusado pela gestão não apaga o registro (§3)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_findings_inst ON vertice_cpa_findings(institution_id);

-- ══════════════════════════════════════════════════════════════
-- §12 — PLANOS DE AÇÃO E EVIDÊNCIAS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id      uuid NOT NULL REFERENCES vertice_cpa_findings(id),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  -- 5W2H
  title           text NOT NULL,
  description     text,
  responsible     text,
  due_date        date,
  location        text,
  method          text,
  resources       text,
  -- trilha
  status          text NOT NULL DEFAULT 'planejada' CHECK (status IN (
    'planejada','em_execucao','executada','cancelada','avaliada'
  )),
  evidence_description text,
  evidence_url    text,
  efficacy_assessment text,               -- melhoria demonstrada?
  evaluated_at    timestamptz,
  -- vínculos
  pdi_ref         text,
  ppc_ref         text,
  instrument_ref  text,                   -- ex: 'Eixo 1, 1.6'
  deliberation_id uuid,                   -- FK lógica para 5W2H existente
  origin_type     text DEFAULT 'cpa_finding',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_actions_finding ON vertice_cpa_actions(finding_id);
CREATE INDEX IF NOT EXISTS idx_cpa_actions_inst ON vertice_cpa_actions(institution_id);

-- ══════════════════════════════════════════════════════════════
-- §11 — DEVOLUTIVAS À COMUNIDADE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_feedbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  cycle_id        uuid REFERENCES vertice_cpa_cycles(id),
  title           text NOT NULL,
  audience        text,                   -- estudantes, docentes, comunidade, gestão
  channel         text,                   -- portal, email, reunião, painel
  content_url     text,
  delivered_at    timestamptz,
  reach_count     integer,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- §12 — META-AVALIAÇÃO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_cpa_meta_evaluation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  cycle_id        uuid REFERENCES vertice_cpa_cycles(id),
  -- métricas do processo
  eligible_count  integer,
  invited_count   integer,
  responded_count integer,
  completion_rate numeric,
  abandonment_rate numeric,
  avg_duration_seconds integer,
  -- qualidade
  representativity_notes text,
  complaints_count integer,
  cost_estimate   numeric,
  -- avaliação
  strengths       text,
  weaknesses      text,
  improvements    text,
  evaluated_by    text,
  evaluated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- VIEWS BI
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_cpa_campaign_indicators AS
SELECT
  c.institution_id,
  c.id AS campaign_id,
  c.title AS campaign_title,
  c.target_audience,
  c.status AS campaign_status,
  COUNT(DISTINCT i.id) AS total_eligible,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status NOT IN ('elegivel')) AS total_invited,
  COUNT(DISTINCT i.id) FILTER (WHERE i.delivered_at IS NOT NULL) AS total_delivered,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'concluido') AS total_completed,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'em_andamento') AS total_in_progress,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'abandonado') AS total_abandoned,
  CASE WHEN COUNT(DISTINCT i.id) > 0
    THEN ROUND(100.0 * COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'concluido') / COUNT(DISTINCT i.id), 2)
  END AS pct_completion
FROM vertice_cpa_campaigns c
LEFT JOIN vertice_cpa_invitations i ON i.campaign_id = c.id
LEFT JOIN vertice_cpa_responses r ON r.campaign_id = c.id AND r.invitation_id = i.id
GROUP BY c.institution_id, c.id, c.title, c.target_audience, c.status;

CREATE OR REPLACE VIEW v_cpa_cycle_summary AS
SELECT
  cy.institution_id,
  cy.id AS cycle_id,
  cy.title AS cycle_title,
  cy.status AS cycle_status,
  COUNT(DISTINCT ca.id) AS campaigns,
  COUNT(DISTINCT f.id) AS findings,
  COUNT(DISTINCT f.id) FILTER (WHERE f.decision_status = 'deliberado') AS findings_deliberated,
  COUNT(DISTINCT a.id) AS actions,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('executada','avaliada')) AS actions_completed,
  COUNT(DISTINCT a.id) FILTER (WHERE a.evidence_url IS NOT NULL) AS actions_with_evidence,
  COUNT(DISTINCT fb.id) AS feedbacks_delivered
FROM vertice_cpa_cycles cy
LEFT JOIN vertice_cpa_campaigns ca ON ca.cycle_id = cy.id
LEFT JOIN vertice_cpa_findings f ON f.cycle_id = cy.id
LEFT JOIN vertice_cpa_actions a ON a.finding_id = f.id
LEFT JOIN vertice_cpa_feedbacks fb ON fb.cycle_id = cy.id
GROUP BY cy.institution_id, cy.id, cy.title, cy.status;

-- ══════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'vertice_cpa_references','vertice_cpa_reference_objects',
    'vertice_cpa_members','vertice_cpa_meetings',
    'vertice_cpa_cycles','vertice_cpa_instruments','vertice_cpa_questions',
    'vertice_cpa_campaigns','vertice_cpa_invitations',
    'vertice_cpa_responses','vertice_cpa_answers',
    'vertice_cpa_findings','vertice_cpa_actions',
    'vertice_cpa_feedbacks','vertice_cpa_meta_evaluation'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    -- Master
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid()))',
      tbl || '_master', tbl
    );
  END LOOP;
END $$;

-- Referenciais: leitura pública
CREATE POLICY cpa_refs_read ON vertice_cpa_references FOR SELECT USING (true);
CREATE POLICY cpa_ref_objects_read ON vertice_cpa_reference_objects FOR SELECT USING (true);

-- Gestor: tabelas com institution_id
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'vertice_cpa_members','vertice_cpa_meetings',
    'vertice_cpa_cycles','vertice_cpa_instruments',
    'vertice_cpa_campaigns',
    'vertice_cpa_findings','vertice_cpa_actions',
    'vertice_cpa_feedbacks','vertice_cpa_meta_evaluation'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (vertice_private.can_read_institution(%I.institution_id))',
      tbl || '_gestor', tbl, tbl
    );
  END LOOP;
END $$;

-- Gestor: tabelas com FK indireta
CREATE POLICY cpa_questions_gestor ON vertice_cpa_questions
  FOR ALL USING (EXISTS (SELECT 1 FROM vertice_cpa_instruments i WHERE i.id = vertice_cpa_questions.instrument_id AND vertice_private.can_read_institution(i.institution_id)));

CREATE POLICY cpa_invitations_gestor ON vertice_cpa_invitations
  FOR ALL USING (EXISTS (SELECT 1 FROM vertice_cpa_campaigns c WHERE c.id = vertice_cpa_invitations.campaign_id AND vertice_private.can_read_institution(c.institution_id)));

CREATE POLICY cpa_responses_gestor ON vertice_cpa_responses
  FOR ALL USING (EXISTS (SELECT 1 FROM vertice_cpa_campaigns c WHERE c.id = vertice_cpa_responses.campaign_id AND vertice_private.can_read_institution(c.institution_id)));

-- IMPORTANTE §8: respostas (conteúdo) separadas de participação
-- A policy de cpa_answers NÃO permite leitura direta por gestor genérico
-- Apenas master e roles com finalidade de análise podem ler
CREATE POLICY cpa_answers_gestor ON vertice_cpa_answers
  FOR ALL USING (EXISTS (
    SELECT 1 FROM vertice_cpa_responses r
    JOIN vertice_cpa_campaigns c ON c.id = r.campaign_id
    WHERE r.id = vertice_cpa_answers.response_id
    AND vertice_private.can_read_institution(c.institution_id)
  ));

-- ══════════════════════════════════════════════════════════════
-- SEED: Referenciais INEP
-- ══════════════════════════════════════════════════════════════

INSERT INTO vertice_cpa_references (code, title, version, status, source_url, notes) VALUES
('INST_RECRED_2017', 'Instrumento de Avaliação Institucional — Recredenciamento', '2017', 'vigente',
 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/avaliacao-in-loco/instrumentos-de-avaliacao/2017',
 'Eixo 1 contém 5 indicadores sobre planejamento e avaliação. Vigente até nov/2026.'),
('INST_PROP_2026', 'Proposta de Novo Instrumento Institucional — Consulta Pública', '2026-consulta', 'proposta',
 'https://brasilparticipativo.presidencia.gov.br/processes/institucionalsinaes/f/4891/',
 'Eixo 1 detalha 13 objetos (1.1 a 1.13). 101 descritores identificados. Código 1.8.a.x repetido em dois itens — usar internal_code para diferenciar. Status: não confirmado em vigor até 12/11/2026.')
ON CONFLICT (code, version) DO NOTHING;

-- Objetos do instrumento 2017 (Eixo 1)
INSERT INTO vertice_cpa_reference_objects (reference_id, object_code, axis, title, sort_order) VALUES
((SELECT id FROM vertice_cpa_references WHERE code='INST_RECRED_2017'), '1.1', 'Eixo 1', 'PDI', 1),
((SELECT id FROM vertice_cpa_references WHERE code='INST_RECRED_2017'), '1.2', 'Eixo 1', 'Missão, plano de ação e metas', 2),
((SELECT id FROM vertice_cpa_references WHERE code='INST_RECRED_2017'), '1.3', 'Eixo 1', 'Políticas de ensino, pesquisa e extensão', 3),
((SELECT id FROM vertice_cpa_references WHERE code='INST_RECRED_2017'), '1.4', 'Eixo 1', 'Autoavaliação institucional', 4),
((SELECT id FROM vertice_cpa_references WHERE code='INST_RECRED_2017'), '1.5', 'Eixo 1', 'Ações de melhoria baseadas na autoavaliação', 5)
ON CONFLICT DO NOTHING;

-- Objetos da proposta 2026 (Eixo 1, 13 objetos)
INSERT INTO vertice_cpa_reference_objects (reference_id, object_code, axis, title, sort_order) VALUES
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.1', 'Eixo 1', 'Canais de comunicação da CPA', 1),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.2', 'Eixo 1', 'Integração CPA e Ouvidoria', 2),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.3', 'Eixo 1', 'Membros da CPA', 3),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.4', 'Eixo 1', 'Integração da CPA à gestão institucional', 4),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.5', 'Eixo 1', 'Projeto de Autoavaliação Institucional', 5),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.6', 'Eixo 1', 'Ciclo avaliativo', 6),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.7', 'Eixo 1', 'Participação da comunidade', 7),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.8', 'Eixo 1', 'Abrangência das dimensões do Sinaes', 8),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.9', 'Eixo 1', 'Metodologia', 9),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.10', 'Eixo 1', 'Registro das informações', 10),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.11', 'Eixo 1', 'Uso de tecnologias', 11),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.12', 'Eixo 1', 'Resultados', 12),
((SELECT id FROM vertice_cpa_references WHERE code='INST_PROP_2026'), '1.13', 'Eixo 1', 'Meta-avaliação', 13)
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- MÓDULOS NO CATÁLOGO
-- ══════════════════════════════════════════════════════════════

INSERT INTO vertice_module_catalog (code, name, description, tier, package, tabs) VALUES
('GEST_CPA', 'CPA e Autoavaliação', 'Módulo completo de CPA: pesquisas, participação, resultados, planos, evidências e devolutivas', 'gestao', 'gestao360', ARRAY['cpa-autoavaliacao'])
ON CONFLICT (code) DO UPDATE SET tabs = EXCLUDED.tabs, description = EXCLUDED.description;

-- Ativar para UNITOP
INSERT INTO vertice_module_activations (institution_id, module_code, status)
VALUES ('1f5fd5b4-93c6-4626-834d-136884915587', 'GEST_CPA', 'ativo')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- COMENTÁRIOS
-- ══════════════════════════════════════════════════════════════

COMMENT ON TABLE vertice_cpa_references IS 'Biblioteca de referenciais INEP com fonte, versão, status e data.';
COMMENT ON TABLE vertice_cpa_reference_objects IS 'Objetos/indicadores de cada referencial com descritores.';
COMMENT ON TABLE vertice_cpa_members IS 'Composição da CPA com representação e mandatos.';
COMMENT ON TABLE vertice_cpa_cycles IS 'Ciclos de autoavaliação com projeto, metodologia e referencial.';
COMMENT ON TABLE vertice_cpa_instruments IS 'Instrumentos de pesquisa CPA versionados por público e unidade.';
COMMENT ON TABLE vertice_cpa_questions IS 'Perguntas com escala, dimensão, vinculação a referencial e ramificação.';
COMMENT ON TABLE vertice_cpa_campaigns IS 'Campanhas de coleta com período, público, canais e gamificação.';
COMMENT ON TABLE vertice_cpa_invitations IS 'Convites com rastreamento de estado — elegível a concluído.';
COMMENT ON TABLE vertice_cpa_responses IS 'Respostas com pausa, retomada, revisão e progresso.';
COMMENT ON TABLE vertice_cpa_answers IS 'Respostas por pergunta com opções NA/DK/PNR e canal.';
COMMENT ON TABLE vertice_cpa_findings IS 'Achados com decisão — recusa não apaga o achado.';
COMMENT ON TABLE vertice_cpa_actions IS 'Planos de ação 5W2H com evidência e avaliação de eficácia.';
COMMENT ON TABLE vertice_cpa_feedbacks IS 'Devolutivas à comunidade acadêmica.';
COMMENT ON TABLE vertice_cpa_meta_evaluation IS 'Meta-avaliação do processo: participação, qualidade, custo, melhorias.';
