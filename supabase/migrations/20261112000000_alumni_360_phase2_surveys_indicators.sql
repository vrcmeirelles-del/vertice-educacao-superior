-- ============================================================
-- VÉRTICE EGRESSOS 360° — FASES 2-6: PESQUISAS, INDICADORES,
-- SERVIÇOS, GOVERNANÇA CPA E DADOS SINTÉTICOS
-- Migração: 20261112000000_alumni_360_phase2_surveys_indicators.sql
-- ============================================================
-- Depende de: 20261111000000_alumni_360_phase1.sql
-- Não sobrescreve tabelas alumni_* da Fase 1.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- §4.2 — PESQUISA VERSIONADA E ACOMPANHAMENTO
-- ══════════════════════════════════════════════════════════════

-- Instrumento de pesquisa (versionado por IES/curso)
CREATE TABLE IF NOT EXISTS vertice_alumni_surveys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id       uuid REFERENCES vertice_courses(id), -- NULL = institucional
  title           text NOT NULL,
  version         smallint NOT NULL DEFAULT 1,
  description     text,
  -- temporalidade
  wave_type       text NOT NULL DEFAULT 'conclusao' CHECK (wave_type IN (
    'conclusao','6m','12m','24m','36m','60m','custom'
  )),
  custom_months   smallint,  -- quando wave_type = custom
  -- período de coleta
  opens_at        timestamptz,
  closes_at       timestamptz,
  -- controle
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','teste','ativa','encerrada','arquivada'
  )),
  target_audience text DEFAULT 'egressos' CHECK (target_audience IN ('egressos','concluintes','todos')),
  responsible_id  uuid,  -- quem criou/administra
  -- metadados
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, course_id, title, version)
);

-- Perguntas da pesquisa
CREATE TABLE IF NOT EXISTS vertice_alumni_survey_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       uuid NOT NULL REFERENCES vertice_alumni_surveys(id) ON DELETE CASCADE,
  sort_order      smallint NOT NULL DEFAULT 0,
  section         text,             -- agrupamento visual
  question_text   text NOT NULL,
  question_type   text NOT NULL CHECK (question_type IN (
    'single_choice','multiple_choice','text','number','scale',
    'date','salary_range','boolean','file'
  )),
  options         jsonb,            -- [{"value":"sim","label":"Sim"},...]
  required        boolean NOT NULL DEFAULT false,
  -- ramificação condicional
  depends_on      uuid REFERENCES vertice_alumni_survey_questions(id),
  show_when_value text,             -- valor da resposta-pai que habilita esta
  -- mapeamento para indicador
  indicator_key   text,             -- ex: 'employment_status', 'field_match', 'further_ed'
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON vertice_alumni_survey_questions(survey_id, sort_order);

-- Convites enviados
CREATE TABLE IF NOT EXISTS vertice_alumni_survey_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       uuid NOT NULL REFERENCES vertice_alumni_surveys(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES vertice_alumni_profiles(id),
  education_id    uuid REFERENCES vertice_alumni_education(id),
  channel         text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','whatsapp','sms','portal')),
  -- rastreamento de entrega
  sent_at         timestamptz,
  delivered_at    timestamptz,
  delivery_status text DEFAULT 'pendente' CHECK (delivery_status IN (
    'pendente','enviado','entregue','falhou','bounce','cancelado'
  )),
  -- controle
  reminder_count  smallint NOT NULL DEFAULT 0,
  max_reminders   smallint NOT NULL DEFAULT 3,
  token           text UNIQUE,      -- token de acesso único
  responded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, profile_id)   -- um convite por pesquisa/pessoa
);
CREATE INDEX IF NOT EXISTS idx_survey_inv_survey ON vertice_alumni_survey_invitations(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_inv_profile ON vertice_alumni_survey_invitations(profile_id);

-- Respostas da pesquisa
CREATE TABLE IF NOT EXISTS vertice_alumni_survey_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       uuid NOT NULL REFERENCES vertice_alumni_surveys(id),
  profile_id      uuid NOT NULL REFERENCES vertice_alumni_profiles(id),
  education_id    uuid REFERENCES vertice_alumni_education(id),
  invitation_id   uuid REFERENCES vertice_alumni_survey_invitations(id),
  -- status da resposta
  status          text NOT NULL DEFAULT 'em_andamento' CHECK (status IN (
    'em_andamento','concluida','corrigida','abandonada'
  )),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  corrected_at    timestamptz,
  -- metadados
  device          text,             -- mobile, desktop
  ip_hash         text,             -- hash do IP para dedup
  duration_seconds integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, profile_id)   -- uma resposta por pesquisa/pessoa
);
CREATE INDEX IF NOT EXISTS idx_survey_resp_survey ON vertice_alumni_survey_responses(survey_id);

-- Respostas individuais por pergunta
CREATE TABLE IF NOT EXISTS vertice_alumni_survey_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id     uuid NOT NULL REFERENCES vertice_alumni_survey_responses(id) ON DELETE CASCADE,
  question_id     uuid NOT NULL REFERENCES vertice_alumni_survey_questions(id),
  answer_value    text,             -- valor normalizado
  answer_text     text,             -- texto livre quando aplicável
  answer_json     jsonb,            -- múltipla escolha, arquivo, etc.
  -- rastreabilidade de correção
  previous_value  text,             -- valor anterior quando corrigida
  corrected_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (response_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON vertice_alumni_survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question ON vertice_alumni_survey_answers(question_id);

-- ══════════════════════════════════════════════════════════════
-- §4.3 — TRAJETÓRIA PROFISSIONAL (expandir employment existente)
-- ══════════════════════════════════════════════════════════════

-- Adicionar campos faltantes na tabela existente
DO $$
BEGIN
  -- Tipo de vínculo mais granular
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_employment' AND column_name='employment_type') THEN
    ALTER TABLE vertice_alumni_employment ADD COLUMN employment_type text CHECK (
      employment_type IN ('principal','secundaria','eventual','anterior')
    ) DEFAULT 'principal';
  END IF;
  -- Relação com área: granularidade
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_employment' AND column_name='field_relation') THEN
    ALTER TABLE vertice_alumni_employment ADD COLUMN field_relation text CHECK (
      field_relation IN ('area_formacao','area_correlata','outra_area','nao_informado')
    );
  END IF;
  -- Motivo quando atua fora da área
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_employment' AND column_name='out_of_field_reason') THEN
    ALTER TABLE vertice_alumni_employment ADD COLUMN out_of_field_reason text;
  END IF;
  -- Já trabalhava antes da conclusão?
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_employment' AND column_name='worked_before_graduation') THEN
    ALTER TABLE vertice_alumni_employment ADD COLUMN worked_before_graduation boolean;
  END IF;
  -- Primeiro trabalho após conclusão?
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_employment' AND column_name='is_first_after_graduation') THEN
    ALTER TABLE vertice_alumni_employment ADD COLUMN is_first_after_graduation boolean;
  END IF;
  -- Data de referência da informação
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_employment' AND column_name='reference_date') THEN
    ALTER TABLE vertice_alumni_employment ADD COLUMN reference_date date;
  END IF;
  -- Procura trabalho (quando desempregado)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_employment' AND column_name='seeking_work') THEN
    ALTER TABLE vertice_alumni_employment ADD COLUMN seeking_work boolean;
  END IF;
END
$$;

-- ══════════════════════════════════════════════════════════════
-- §4.4 — TRAJETÓRIA ACADÊMICA (expandir further_ed)
-- ══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Situação mais granular
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='vertice_alumni_further_ed' AND column_name='detailed_status') THEN
    ALTER TABLE vertice_alumni_further_ed ADD COLUMN detailed_status text CHECK (
      detailed_status IN ('interesse','inscrito','matriculado','em_andamento','concluido','interrompido','trancado')
    );
  END IF;
END
$$;

-- ══════════════════════════════════════════════════════════════
-- §4.5 — SERVIÇOS E RELACIONAMENTO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vertice_alumni_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  service_type    text NOT NULL CHECK (service_type IN (
    'oportunidade_emprego','evento','educacao_continuada',
    'orientacao_carreira','mentoria','bolsa','outro'
  )),
  title           text NOT NULL,
  description     text,
  -- período
  starts_at       timestamptz,
  ends_at         timestamptz,
  -- controle
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','publicada','encerrada','cancelada'
  )),
  max_participants integer,
  external_url    text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Interações dos egressos com serviços
CREATE TABLE IF NOT EXISTS vertice_alumni_service_interactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      uuid NOT NULL REFERENCES vertice_alumni_services(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES vertice_alumni_profiles(id),
  interaction_type text NOT NULL CHECK (interaction_type IN (
    'visualizou','clicou','inscreveu','participou','concluiu',
    'candidatou','contratado','desistiu','avaliou'
  )),
  -- §4.5: diferencie clique, inscrição, participação, candidatura e contratação
  metadata        jsonb,
  rating          smallint CHECK (rating BETWEEN 1 AND 5),
  feedback        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, profile_id, interaction_type)
);
CREATE INDEX IF NOT EXISTS idx_service_interactions_service ON vertice_alumni_service_interactions(service_id);
CREATE INDEX IF NOT EXISTS idx_service_interactions_profile ON vertice_alumni_service_interactions(profile_id);

-- ══════════════════════════════════════════════════════════════
-- §4.7 — CPA, INSTRUMENTOS E AÇÕES
-- ══════════════════════════════════════════════════════════════

-- Achados da pesquisa de egressos
CREATE TABLE IF NOT EXISTS vertice_alumni_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  survey_id       uuid REFERENCES vertice_alumni_surveys(id),
  course_id       uuid REFERENCES vertice_courses(id),
  -- achado
  finding_type    text NOT NULL CHECK (finding_type IN (
    'positivo','atencao','critico','oportunidade','neutro'
  )),
  title           text NOT NULL,
  description     text,
  indicator_key   text,           -- qual indicador motivou
  indicator_value numeric,
  indicator_target numeric,
  -- vínculo regulatório
  pdi_ref         text,           -- referência no PDI
  ppc_ref         text,           -- referência no PPC
  cpa_ref         text,           -- referência CPA
  instrument_ref  text,           -- ref no instrumento INEP (ex: 3.7)
  instrument_version text,        -- '2017' ou '2026'
  -- ciclo de ação
  status          text NOT NULL DEFAULT 'identificado' CHECK (status IN (
    'identificado','validado','em_deliberacao','deliberado','arquivado'
  )),
  validated_by    uuid,
  validated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alumni_findings_inst ON vertice_alumni_findings(institution_id);
CREATE INDEX IF NOT EXISTS idx_alumni_findings_survey ON vertice_alumni_findings(survey_id);

-- Ações de melhoria vinculadas a achados
CREATE TABLE IF NOT EXISTS vertice_alumni_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id      uuid NOT NULL REFERENCES vertice_alumni_findings(id),
  institution_id  uuid NOT NULL REFERENCES vertice_institutions(id),
  -- 5W2H
  title           text NOT NULL,      -- O quê
  description     text,               -- Por quê
  responsible     text,               -- Quem
  due_date        date,               -- Quando
  location        text,               -- Onde
  method          text,               -- Como
  cost_estimate   text,               -- Quanto
  -- ciclo
  status          text NOT NULL DEFAULT 'planejada' CHECK (status IN (
    'planejada','em_execucao','executada','cancelada','avaliada'
  )),
  evidence_description text,
  evidence_url    text,
  result_observed text,
  evaluated_at    timestamptz,
  -- rastreabilidade
  origin_type     text DEFAULT 'egresso_finding',
  deliberation_id uuid,   -- FK lógica para vertice_goals se integrado ao 5W2H
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alumni_actions_finding ON vertice_alumni_actions(finding_id);
CREATE INDEX IF NOT EXISTS idx_alumni_actions_inst ON vertice_alumni_actions(institution_id);

-- ══════════════════════════════════════════════════════════════
-- §6 — INDICADORES: DEFINIÇÕES E VIEWS CALCULADAS
-- ══════════════════════════════════════════════════════════════

-- Catálogo de indicadores com fórmula explícita
CREATE TABLE IF NOT EXISTS vertice_alumni_indicator_catalog (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,  -- ex: IND_COBERTURA_CADASTRAL
  name            text NOT NULL,
  description     text NOT NULL,
  formula         text NOT NULL,     -- descrição da fórmula
  numerator_desc  text NOT NULL,
  denominator_desc text NOT NULL,
  eligibility     text,              -- quem entra no cálculo
  exclusions      text,              -- quem é excluído
  source          text,              -- fonte dos dados
  limitations     text,              -- limitações conhecidas
  version         smallint NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Inserir catálogo conforme §6
INSERT INTO vertice_alumni_indicator_catalog (code, name, description, formula, numerator_desc, denominator_desc, eligibility, exclusions, source, limitations) VALUES
('IND_COB_CADASTRAL', 'Cobertura Cadastral', 'Egressos com contato válido sobre população elegível', 'contatos_validos / elegiveis', 'Perfis com email ou telefone não nulo', 'Total de egressos elegíveis (formados/diplomados)', 'Formados, diplomados, integralizado, concluinte', NULL, 'vertice_alumni_profiles + education', 'Contato válido não garante alcançabilidade'),
('IND_PART_ELEGIVEIS', 'Participação sobre Elegíveis', 'Respondentes únicos sobre total de elegíveis', 'respondentes_unicos / elegiveis', 'Respostas com status concluída', 'Total de egressos elegíveis', 'Egressos que completaram pesquisa', 'Respostas abandonadas', 'vertice_alumni_survey_responses', 'Pesquisa voluntária — não probabilística'),
('IND_PART_CONVIDADOS', 'Participação sobre Convidados', 'Respondentes sobre convidados', 'respondentes_unicos / convidados', 'Respostas concluídas', 'Convites enviados', NULL, NULL, 'survey_invitations + responses', NULL),
('IND_PART_ENTREGAS', 'Participação sobre Entregas', 'Respondentes sobre convites confirmados como entregues', 'respondentes_unicos / entregas_confirmadas', 'Respostas concluídas', 'Convites com delivery_status = entregue', NULL, 'Convites que falharam ou deram bounce', 'survey_invitations', 'Nem todos os canais confirmam entrega'),
('IND_PERFIS_ATUALIZADOS', 'Perfis Atualizados', 'Perfis com contato atualizado no período', 'atualizados_periodo / elegiveis', 'Perfis com contact_updated_at no período', 'Total elegíveis', NULL, NULL, 'vertice_alumni_profiles', NULL),
('IND_ATIV_REMUNERADA', 'Em Atividade Remunerada', 'Pessoas em atividade remunerada sobre respostas válidas à pergunta', 'em_atividade / respostas_validas_trabalho', 'Respondentes com employment_status diferente de desempregado e nao_informado', 'Respondentes que responderam à pergunta sobre trabalho', NULL, 'Quem não respondeu à pergunta', 'survey_answers + employment', 'Autodeclarado'),
('IND_DESEMPREGADO_BUSCANDO', 'Sem Atividade e Buscando', 'Pessoas sem atividade remunerada e procurando trabalho', 'desempregados_buscando / desempregados_total', 'Desempregados com seeking_work = true', 'Total de desempregados que responderam', NULL, NULL, 'vertice_alumni_employment', 'Denominador explícito: só quem declarou desemprego'),
('IND_ADERENCIA', 'Aderência à Área', 'Ocupados na área ou correlata sobre ocupados que responderam', 'area_ou_correlata / ocupados_responderam', 'field_relation IN (area_formacao, area_correlata)', 'Respondentes ocupados que responderam à pergunta sobre aderência', NULL, 'Quem não respondeu sobre aderência', 'vertice_alumni_employment', 'Autodeclarado; área correlata é subjetiva'),
('IND_ESTUDOS_POST', 'Formação Continuada', 'Pessoas em estudos posteriores sobre respostas válidas', 'em_estudos / respostas_validas_estudos', 'Com registro em further_ed status em_andamento ou concluido', 'Respondentes que responderam à pergunta sobre estudos', NULL, NULL, 'vertice_alumni_further_ed', NULL),
('IND_TRAB_OU_ESTUDO', 'Trabalho ou Estudo', 'Pessoas que trabalham OU estudam, sem duplicar quem faz ambos', '(trabalha_ou_estuda) / respostas_validas_ambos', 'UNION de quem trabalha com quem estuda, contando pessoa uma vez', 'Respondentes com respostas válidas para ambas as perguntas', NULL, 'Quem respondeu só uma das duas perguntas', 'employment + further_ed', 'Pessoa em ambos conta uma vez'),
('IND_TEMPO_1JOB', 'Tempo até 1º Emprego', 'Meses entre conclusão e primeiro trabalho', 'mediana(months_to_first_job)', 'months_to_first_job dos que informaram', 'Egressos com primeiro emprego após conclusão', NULL, 'Quem ainda não ingressou (apresentar separadamente)', 'vertice_alumni_employment', 'Não calcular mediana exata de faixas'),
('IND_DIST_RENDA', 'Distribuição de Renda', 'Distribuição por faixa de renda quando informada', 'contagem por faixa / total_informaram', 'Contagem por salary_range', 'Total que informou renda', NULL, 'Quem não informou', 'vertice_alumni_employment', 'Faixas — não inventar mediana exata'),
('IND_PART_SERVICOS', 'Participação em Serviços', 'Participação efetiva em serviços e formação', 'participaram / inscritos', 'interaction_type IN (participou, concluiu)', 'interaction_type = inscreveu', NULL, NULL, 'vertice_alumni_service_interactions', NULL),
('IND_ACOES_EVIDENCIA', 'Ações com Evidência', 'Ações de melhoria concluídas com evidências sobre aprovadas', 'com_evidencia / aprovadas', 'status IN (executada, avaliada) AND evidence_url IS NOT NULL', 'status != planejada AND status != cancelada', NULL, NULL, 'vertice_alumni_actions', NULL)
ON CONFLICT (code) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- VIEW: Indicadores calculados por pesquisa/IES
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_alumni_survey_indicators AS
WITH eligible AS (
  SELECT
    ae.institution_id,
    s.id AS survey_id,
    COUNT(DISTINCT ae.profile_id) AS total_eligible
  FROM vertice_alumni_education ae
  JOIN vertice_alumni_surveys s ON s.institution_id = ae.institution_id
  WHERE ae.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado','concluinte')
  GROUP BY ae.institution_id, s.id
),
invited AS (
  SELECT
    survey_id,
    COUNT(*) AS total_invited,
    COUNT(*) FILTER (WHERE delivery_status = 'entregue') AS total_delivered
  FROM vertice_alumni_survey_invitations
  GROUP BY survey_id
),
responded AS (
  SELECT
    survey_id,
    COUNT(DISTINCT profile_id) AS total_respondents
  FROM vertice_alumni_survey_responses
  WHERE status IN ('concluida','corrigida')
  GROUP BY survey_id
)
SELECT
  e.institution_id,
  e.survey_id,
  s.title AS survey_title,
  s.wave_type,
  e.total_eligible,
  COALESCE(i.total_invited, 0) AS total_invited,
  COALESCE(i.total_delivered, 0) AS total_delivered,
  COALESCE(r.total_respondents, 0) AS total_respondents,
  -- Indicadores de participação (§6)
  CASE WHEN e.total_eligible > 0 THEN ROUND(100.0 * COALESCE(r.total_respondents,0) / e.total_eligible, 2) END AS pct_eligible,
  CASE WHEN COALESCE(i.total_invited,0) > 0 THEN ROUND(100.0 * COALESCE(r.total_respondents,0) / i.total_invited, 2) END AS pct_invited,
  CASE WHEN COALESCE(i.total_delivered,0) > 0 THEN ROUND(100.0 * COALESCE(r.total_respondents,0) / i.total_delivered, 2) END AS pct_delivered
FROM eligible e
JOIN vertice_alumni_surveys s ON s.id = e.survey_id
LEFT JOIN invited i ON i.survey_id = e.survey_id
LEFT JOIN responded r ON r.survey_id = e.survey_id;

-- ══════════════════════════════════════════════════════════════
-- VIEW: Indicadores de trajetória (emprego, aderência, estudos)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_alumni_trajectory_indicators AS
WITH base AS (
  SELECT
    ae.institution_id,
    ae.course_id,
    ae.profile_id,
    -- Emprego: última informação (employment_type = principal ou mais recente)
    (SELECT emp.employment_status FROM vertice_alumni_employment emp
     WHERE emp.profile_id = ae.profile_id
       AND (emp.employment_type = 'principal' OR emp.employment_type IS NULL)
     ORDER BY emp.reported_at DESC NULLS LAST LIMIT 1
    ) AS emp_status,
    (SELECT emp.field_relation FROM vertice_alumni_employment emp
     WHERE emp.profile_id = ae.profile_id
       AND emp.employment_status NOT IN ('desempregado','nao_informado')
       AND (emp.employment_type = 'principal' OR emp.employment_type IS NULL)
     ORDER BY emp.reported_at DESC NULLS LAST LIMIT 1
    ) AS emp_field_relation,
    (SELECT emp.seeking_work FROM vertice_alumni_employment emp
     WHERE emp.profile_id = ae.profile_id
       AND emp.employment_status = 'desempregado'
     ORDER BY emp.reported_at DESC NULLS LAST LIMIT 1
    ) AS emp_seeking,
    -- Estudo posterior
    (SELECT EXISTS(
      SELECT 1 FROM vertice_alumni_further_ed fe
      WHERE fe.profile_id = ae.profile_id
        AND fe.status IN ('em_andamento','concluido')
    )) AS has_further_ed
  FROM vertice_alumni_education ae
  WHERE ae.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado','concluinte')
)
SELECT
  institution_id,
  course_id,
  -- denominadores explícitos
  COUNT(DISTINCT profile_id) AS total_egressos,
  COUNT(DISTINCT profile_id) FILTER (WHERE emp_status IS NOT NULL) AS respostas_trabalho,
  COUNT(DISTINCT profile_id) FILTER (WHERE emp_status IS NOT NULL AND emp_status NOT IN ('desempregado','nao_informado')) AS em_atividade,
  COUNT(DISTINCT profile_id) FILTER (WHERE emp_status = 'desempregado') AS desempregados,
  COUNT(DISTINCT profile_id) FILTER (WHERE emp_status = 'desempregado' AND emp_seeking = true) AS desempregados_buscando,
  COUNT(DISTINCT profile_id) FILTER (WHERE emp_field_relation IS NOT NULL) AS responderam_aderencia,
  COUNT(DISTINCT profile_id) FILTER (WHERE emp_field_relation IN ('area_formacao','area_correlata')) AS area_ou_correlata,
  COUNT(DISTINCT profile_id) FILTER (WHERE has_further_ed) AS respostas_estudos_validas,
  -- Trabalho OU estudo (sem duplicar)
  COUNT(DISTINCT profile_id) FILTER (
    WHERE emp_status IS NOT NULL AND has_further_ed IS NOT NULL  -- tem as duas informações
  ) AS respostas_ambas,
  COUNT(DISTINCT profile_id) FILTER (
    WHERE (emp_status IS NOT NULL AND emp_status NOT IN ('desempregado','nao_informado'))
       OR has_further_ed
  ) AS trabalha_ou_estuda
FROM base
GROUP BY institution_id, course_id;

-- ══════════════════════════════════════════════════════════════
-- RLS — Novas tabelas
-- ══════════════════════════════════════════════════════════════

ALTER TABLE vertice_alumni_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_survey_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_service_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_indicator_catalog ENABLE ROW LEVEL SECURITY;

-- Master: todas as novas tabelas
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'vertice_alumni_surveys','vertice_alumni_survey_questions',
    'vertice_alumni_survey_invitations','vertice_alumni_survey_responses',
    'vertice_alumni_survey_answers',
    'vertice_alumni_services','vertice_alumni_service_interactions',
    'vertice_alumni_findings','vertice_alumni_actions',
    'vertice_alumni_indicator_catalog'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
        EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
      )',
      tbl || '_master_policy', tbl
    );
  END LOOP;
END
$$;

-- Gestor: tabelas com institution_id
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'vertice_alumni_surveys','vertice_alumni_services',
    'vertice_alumni_findings','vertice_alumni_actions'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
        vertice_private.can_read_institution(%I.institution_id)
      )',
      tbl || '_gestor_policy', tbl, tbl
    );
  END LOOP;
END
$$;

-- Gestor: tabelas com FK indireta (via survey → institution_id)
CREATE POLICY survey_questions_gestor ON vertice_alumni_survey_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_alumni_surveys s
      WHERE s.id = vertice_alumni_survey_questions.survey_id
      AND vertice_private.can_read_institution(s.institution_id))
  );

CREATE POLICY survey_invitations_gestor ON vertice_alumni_survey_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_alumni_surveys s
      WHERE s.id = vertice_alumni_survey_invitations.survey_id
      AND vertice_private.can_read_institution(s.institution_id))
  );

CREATE POLICY survey_responses_gestor ON vertice_alumni_survey_responses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_alumni_surveys s
      WHERE s.id = vertice_alumni_survey_responses.survey_id
      AND vertice_private.can_read_institution(s.institution_id))
  );

CREATE POLICY survey_answers_gestor ON vertice_alumni_survey_answers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_alumni_survey_responses r
      JOIN vertice_alumni_surveys s ON s.id = r.survey_id
      WHERE r.id = vertice_alumni_survey_answers.response_id
      AND vertice_private.can_read_institution(s.institution_id))
  );

CREATE POLICY service_interactions_gestor ON vertice_alumni_service_interactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_alumni_services sv
      WHERE sv.id = vertice_alumni_service_interactions.service_id
      AND vertice_private.can_read_institution(sv.institution_id))
  );

-- Catálogo de indicadores: leitura pública (é referência, não dado)
CREATE POLICY indicator_catalog_read ON vertice_alumni_indicator_catalog
  FOR SELECT USING (true);

-- ══════════════════════════════════════════════════════════════
-- MÓDULO NO CATÁLOGO
-- ══════════════════════════════════════════════════════════════

INSERT INTO vertice_module_catalog (code, name, description, tier, package, tabs, dependencies)
VALUES (
  'ACOMP_EGRESSOS_PESQUISA', 'Pesquisas de Egressos',
  'Instrumentos de pesquisa versionados, convites, respostas e indicadores',
  'superior', 'acompanhamento360',
  ARRAY['egressos-pesquisa','egressos-indicadores'],
  ARRAY['ACOMP_EGRESSOS']
)
ON CONFLICT (code) DO UPDATE SET
  tabs = EXCLUDED.tabs,
  dependencies = EXCLUDED.dependencies;

INSERT INTO vertice_module_catalog (code, name, description, tier, package, tabs, dependencies)
VALUES (
  'ACOMP_EGRESSOS_CPA', 'Governança CPA de Egressos',
  'Achados, ações de melhoria e dossiê regulatório de egressos',
  'superior', 'gestao360',
  ARRAY['egressos-cpa'],
  ARRAY['ACOMP_EGRESSOS_PESQUISA']
)
ON CONFLICT (code) DO UPDATE SET
  tabs = EXCLUDED.tabs,
  dependencies = EXCLUDED.dependencies;

-- ══════════════════════════════════════════════════════════════
-- §6 — DADOS SINTÉTICOS DE TESTE
-- ══════════════════════════════════════════════════════════════
-- 100 elegíveis, 80 convidados, 72 entregas, 40 respondentes
-- 38 respostas válidas sobre trabalho; 30 trabalham
-- 28 responderam aderência; 21 na área ou correlata
-- 36 respostas válidas sobre estudos; 12 positivas
-- 34 com ambas válidas: 26 trabalham, 12 estudam, 9 fazem ambos
-- Esperados: 40/100=40%, 40/80=50%, 40/72≈55.56%, 30/38, 21/28, 12/36, 29/34

-- Função para gerar dados sintéticos (executar sob service_role)
CREATE OR REPLACE FUNCTION vertice_private.seed_alumni_test_data(
  p_institution_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_survey_id uuid;
  v_profile_ids uuid[];
  v_edu_ids uuid[];
  v_pid uuid;
  v_eid uuid;
  i integer;
  v_results jsonb;
BEGIN
  -- Limpar dados de teste anteriores (se existirem)
  DELETE FROM vertice_alumni_survey_invitations si
    USING vertice_alumni_surveys s
    WHERE si.survey_id = s.id AND s.institution_id = p_institution_id AND s.title = '[TESTE] Pesquisa Inicial de Egressos';
  DELETE FROM vertice_alumni_surveys WHERE institution_id = p_institution_id AND title = '[TESTE] Pesquisa Inicial de Egressos';

  -- Criar pesquisa de teste
  INSERT INTO vertice_alumni_surveys (institution_id, title, version, wave_type, status, opens_at, closes_at)
  VALUES (p_institution_id, '[TESTE] Pesquisa Inicial de Egressos', 1, 'conclusao', 'ativa', now() - interval '30 days', now() + interval '30 days')
  RETURNING id INTO v_survey_id;

  -- Criar 100 perfis elegíveis
  FOR i IN 1..100 LOOP
    INSERT INTO vertice_alumni_profiles (full_name, email, phone, source)
    VALUES (
      'Egresso Teste ' || i,
      CASE WHEN i <= 85 THEN 'teste' || i || '@example.com' ELSE NULL END,
      CASE WHEN i <= 80 THEN '639' || lpad(i::text, 8, '0') ELSE NULL END,
      'import'
    )
    RETURNING id INTO v_pid;
    v_profile_ids := array_append(v_profile_ids, v_pid);

    -- Educação: todos são egressos
    INSERT INTO vertice_alumni_education (profile_id, institution_id, enrollment_id, academic_status, conclusion_year, conclusion_semester, status_source)
    VALUES (v_pid, p_institution_id, 'TST' || lpad(i::text, 5, '0'), 'formado', 2024, 2, 'import')
    RETURNING id INTO v_eid;
    v_edu_ids := array_append(v_edu_ids, v_eid);
  END LOOP;

  -- 80 convidados
  FOR i IN 1..80 LOOP
    INSERT INTO vertice_alumni_survey_invitations (survey_id, profile_id, education_id, channel, sent_at, delivery_status, delivered_at)
    VALUES (
      v_survey_id, v_profile_ids[i], v_edu_ids[i], 'email',
      now() - interval '20 days',
      CASE WHEN i <= 72 THEN 'entregue' ELSE 'falhou' END,
      CASE WHEN i <= 72 THEN now() - interval '20 days' ELSE NULL END
    );
  END LOOP;

  -- 40 respondentes (dos 72 que receberam)
  FOR i IN 1..40 LOOP
    INSERT INTO vertice_alumni_survey_responses (survey_id, profile_id, education_id, status, completed_at)
    VALUES (v_survey_id, v_profile_ids[i], v_edu_ids[i], 'concluida', now() - interval '10 days');
  END LOOP;

  -- Emprego: 38 respostas válidas sobre trabalho, 30 trabalham
  FOR i IN 1..38 LOOP
    INSERT INTO vertice_alumni_employment (profile_id, employment_status, employment_type, field_relation, seeking_work, source, reference_date)
    VALUES (
      v_profile_ids[i],
      CASE
        WHEN i <= 30 THEN 'empregado_clt'  -- 30 trabalham
        WHEN i <= 35 THEN 'desempregado'   -- 5 desempregados
        ELSE 'desempregado'                -- 3 mais desempregados
      END,
      'principal',
      CASE
        WHEN i <= 21 THEN 'area_formacao'    -- 21 na área
        WHEN i <= 28 THEN 'outra_area'       -- 7 em outra
        ELSE NULL                            -- 10 não responderam aderência
      END,
      CASE
        WHEN i > 30 AND i <= 35 THEN true   -- 5 buscando
        WHEN i > 35 THEN false              -- 3 não buscando
        ELSE NULL
      END,
      'pesquisa',
      CURRENT_DATE
    );
  END LOOP;

  -- Formação continuada: 12 positivas das 36 que responderam
  -- (perfis 1-34 têm ambas as informações, conforme prompt)
  FOR i IN 1..12 LOOP
    -- Distribuir entre os 34 que têm ambas as respostas
    -- 9 fazem ambos (trabalham E estudam) = i 1..9 (que estão entre os que trabalham)
    -- 3 só estudam = i 10..12 (perfis 31..33, que são desempregados)
    INSERT INTO vertice_alumni_further_ed (profile_id, ed_type, status, source)
    VALUES (
      CASE
        WHEN i <= 9 THEN v_profile_ids[i]         -- 9 que trabalham e estudam
        ELSE v_profile_ids[28 + i]                 -- 3 que só estudam (perfis 31,32,33)
      END,
      'especializacao',
      'em_andamento',
      'pesquisa'
    );
  END LOOP;

  -- Verificar resultados esperados
  v_results := jsonb_build_object(
    'survey_id', v_survey_id,
    'profiles_created', array_length(v_profile_ids, 1),
    'note', 'Dados sintéticos inseridos. Esperados: participação 40/100=40%, 40/80=50%, 40/72≈55.56%, trabalho 30/38, aderência 21/28, estudos 12/36, trab_ou_estudo 29/34'
  );

  RETURN v_results;
END;
$$;

COMMENT ON FUNCTION vertice_private.seed_alumni_test_data IS
'Gera dados sintéticos do §6 do prompt de egressos para validação de indicadores. Executar com service_role.';

-- ══════════════════════════════════════════════════════════════
-- COMENTÁRIOS
-- ══════════════════════════════════════════════════════════════

COMMENT ON TABLE vertice_alumni_surveys IS 'Pesquisas de egressos versionadas por IES/curso com controle de período, ondas e status.';
COMMENT ON TABLE vertice_alumni_survey_questions IS 'Perguntas da pesquisa com ramificação condicional e mapeamento para indicadores.';
COMMENT ON TABLE vertice_alumni_survey_invitations IS 'Convites enviados com rastreamento de entrega por canal.';
COMMENT ON TABLE vertice_alumni_survey_responses IS 'Respostas individuais do egresso à pesquisa, com status de conclusão.';
COMMENT ON TABLE vertice_alumni_survey_answers IS 'Respostas por pergunta com rastreabilidade de correção.';
COMMENT ON TABLE vertice_alumni_services IS 'Ofertas de serviços e oportunidades para egressos.';
COMMENT ON TABLE vertice_alumni_service_interactions IS 'Interações dos egressos com serviços — diferencia clique, inscrição, participação, candidatura e contratação.';
COMMENT ON TABLE vertice_alumni_findings IS 'Achados das pesquisas vinculados a indicadores e instrumentos regulatórios.';
COMMENT ON TABLE vertice_alumni_actions IS 'Ações de melhoria 5W2H vinculadas a achados, com ciclo de execução e evidência.';
COMMENT ON TABLE vertice_alumni_indicator_catalog IS 'Catálogo de indicadores com nome, fórmula, numerador, denominador, fonte e limitações.';
COMMENT ON VIEW v_alumni_survey_indicators IS 'Indicadores de participação calculados por pesquisa: sobre elegíveis, convidados e entregas.';
COMMENT ON VIEW v_alumni_trajectory_indicators IS 'Indicadores de trajetória profissional e acadêmica por IES/curso.';
