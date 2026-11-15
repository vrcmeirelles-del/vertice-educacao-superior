-- Bootstrap for a NEW Supabase environment; existing schemas are preserved.
BEGIN;
CREATE SCHEMA IF NOT EXISTS vertice_app;
REVOKE ALL ON SCHEMA vertice_app FROM PUBLIC,anon,authenticated;
SET LOCAL search_path=vertice_app,pg_catalog,extensions;
DO $init$ BEGIN
 IF to_regclass('vertice_app.institutions') IS NULL THEN
  EXECUTE $schema$
-- ============================================================================
-- Vértice — esquema inicial
-- Princípios: tenant_id em toda tabela de cliente, auditoria imutável,
-- pseudonimização obrigatória, nenhuma coluna para dados proibidos no MVP.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE institutions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name          text NOT NULL,
  cnpj          text,
  timezone      text NOT NULL DEFAULT 'America/Sao_Paulo',
  -- Retenção configurável por cliente (dias). NULL = não expira automaticamente.
  retention_alerts_days    integer CHECK (retention_alerts_days IS NULL OR retention_alerts_days > 0),
  retention_records_days   integer CHECK (retention_records_days IS NULL OR retention_records_days > 0),
  retention_audit_days     integer CHECK (retention_audit_days IS NULL OR retention_audit_days > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  campus          text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, code)
);
CREATE INDEX courses_institution_idx ON courses (institution_id);

-- ---------------------------------------------------------------------------
-- Identidade e autorização
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  name           text NOT NULL,
  password_hash  text NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  mfa_secret     text,                 -- reservado; MFA obrigatório só para admin
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- platform_admin não tem instituição; os demais papéis têm.
CREATE TABLE memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id  uuid REFERENCES institutions(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN (
                    'platform_admin','institution_admin','regulatory_manager',
                    'coordinator','auditor_readonly','privacy_officer')),
  -- Escopo por curso; vazio = todos os cursos da instituição.
  course_scope    uuid[] NOT NULL DEFAULT '{}',
  expires_at      timestamptz,          -- obrigatório para auditor_readonly
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, institution_id, role),
  CHECK (role = 'platform_admin' OR institution_id IS NOT NULL),
  CHECK (role <> 'auditor_readonly' OR expires_at IS NOT NULL)
);
CREATE INDEX memberships_user_idx ON memberships (user_id) WHERE revoked_at IS NULL;

-- Revogação de sessão imediata (jti do JWT).
CREATE TABLE revoked_sessions (
  jti         uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at  timestamptz NOT NULL DEFAULT now(),
  reason      text
);

-- ---------------------------------------------------------------------------
-- Catálogo regulatório versionado
-- ---------------------------------------------------------------------------

CREATE TABLE instruments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL,           -- ex.: INEP-BACHARELADO
  version            text NOT NULL,           -- ex.: 2024.2
  title              text NOT NULL,
  official_source    text NOT NULL,           -- URL/portaria de origem
  effective_from     date NOT NULL,
  effective_to       date,
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('draft','active','superseded')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);

CREATE TABLE instrument_requirements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id   uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  code            text NOT NULL,
  axis            text NOT NULL,
  indicator       text NOT NULL,
  criterion       text NOT NULL,
  expected_evidence text NOT NULL,
  criticality     text NOT NULL DEFAULT 'normal'
                    CHECK (criticality IN ('low','normal','high','critical')),
  UNIQUE (instrument_id, code)
);

-- ---------------------------------------------------------------------------
-- Regras de risco (versionadas por instituição/curso)
-- ---------------------------------------------------------------------------

CREATE TABLE rulesets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  course_id           uuid REFERENCES courses(id) ON DELETE CASCADE,
  version             integer NOT NULL,
  attendance_threshold          numeric(5,2) NOT NULL DEFAULT 80,
  attendance_weight             integer NOT NULL DEFAULT 35,
  consecutive_absence_threshold integer NOT NULL DEFAULT 3,
  consecutive_absence_weight    integer NOT NULL DEFAULT 25,
  low_assessment_weight         integer NOT NULL DEFAULT 20,
  exit_request_weight           integer NOT NULL DEFAULT 30,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft','active','retired')),
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (attendance_weight BETWEEN 0 AND 100),
  CHECK (consecutive_absence_weight BETWEEN 0 AND 100),
  CHECK (low_assessment_weight BETWEEN 0 AND 100),
  CHECK (exit_request_weight BETWEEN 0 AND 100),
  CHECK (attendance_threshold BETWEEN 0 AND 100),
  CHECK (consecutive_absence_threshold >= 0),
  UNIQUE (institution_id, course_id, version)
);
CREATE INDEX rulesets_active_idx ON rulesets (institution_id, course_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Ingestão e retenção
-- ---------------------------------------------------------------------------

CREATE TABLE ingestion_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','validated','processed','rejected')),
  source          text NOT NULL,
  received_by     uuid REFERENCES users(id),
  total_records   integer NOT NULL DEFAULT 0,
  accepted_records integer NOT NULL DEFAULT 0,
  rejected_records integer NOT NULL DEFAULT 0,
  rejection_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);
CREATE INDEX ingestion_batches_tenant_idx ON ingestion_batches (institution_id, created_at DESC);

CREATE TABLE retention_records (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id       uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  batch_id             uuid REFERENCES ingestion_batches(id) ON DELETE SET NULL,
  course_id            uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  -- HMAC do identificador enviado pela IES. O valor bruto nunca é persistido.
  student_ref_hash     text NOT NULL,
  attendance_percent   numeric(5,2),
  consecutive_absences integer,
  assessment_average   numeric(4,2),
  passing_average      numeric(4,2),
  open_requests        text[] NOT NULL DEFAULT '{}',
  observed_at          timestamptz NOT NULL,
  source               text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, student_ref_hash, course_id, observed_at)
);
CREATE INDEX retention_records_tenant_course_idx
  ON retention_records (institution_id, course_id, observed_at DESC);

CREATE TABLE alerts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  course_id          uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  record_id          uuid NOT NULL REFERENCES retention_records(id) ON DELETE CASCADE,
  score              integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  level              text NOT NULL CHECK (level IN ('low','medium','high','critical')),
  factors            jsonb NOT NULL,
  ruleset_id         uuid REFERENCES rulesets(id),
  rule_version       text NOT NULL,
  review_required    boolean NOT NULL DEFAULT false,
  recommended_action text NOT NULL,
  automated_decision jsonb,            -- sempre NULL no MVP; coluna existe para auditoria
  status             text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','assigned','in_progress','resolved','dismissed','snoozed')),
  assigned_to        uuid REFERENCES users(id),
  snoozed_until      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id)
);
CREATE INDEX alerts_tenant_status_idx ON alerts (institution_id, status, created_at DESC);
CREATE INDEX alerts_course_idx ON alerts (institution_id, course_id, status);

CREATE TABLE alert_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  alert_id     uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES users(id),
  type         text NOT NULL CHECK (type IN (
                 'created','assigned','contact_logged','action_taken',
                 'snoozed','resolved','dismissed','reopened','comment')),
  action_code  text,             -- ação institucional pré-aprovada
  note         text,             -- texto do coordenador (não do aluno)
  outcome      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alert_events_alert_idx ON alert_events (alert_id, created_at);

-- ---------------------------------------------------------------------------
-- Pasta de evidências regulatórias
-- ---------------------------------------------------------------------------

CREATE TABLE evidence_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  course_id         uuid REFERENCES courses(id) ON DELETE CASCADE,
  instrument_id     uuid NOT NULL REFERENCES instruments(id),
  requirement_id    uuid NOT NULL REFERENCES instrument_requirements(id),
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_review','validated','changes_requested','expired','not_applicable')),
  owner_id          uuid REFERENCES users(id),
  due_date          date,
  valid_until       date,
  reviewer_opinion  text,
  reviewed_by       uuid REFERENCES users(id),
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_tenant_idx ON evidence_items (institution_id, status, due_date);

CREATE TABLE documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  storage_key     text NOT NULL,        -- objeto no bucket; nunca caminho local
  file_name       text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL CHECK (size_bytes > 0),
  sha256          text NOT NULL,
  classification  text NOT NULL DEFAULT 'internal'
                    CHECK (classification IN ('public','internal','restricted')),
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, sha256)
);

CREATE TABLE evidence_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  evidence_id  uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version      integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidence_id, document_id)
);

CREATE TABLE evidence_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  evidence_id   uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  from_status   text,
  to_status     text NOT NULL,
  actor_id      uuid REFERENCES users(id),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Integração (extensão) e LGPD
-- ---------------------------------------------------------------------------

-- Token curto de pareamento da extensão. Guardamos só o hash.
CREATE TABLE pairing_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,
  label           text NOT NULL,
  created_by      uuid REFERENCES users(id),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE data_subject_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  request_type    text NOT NULL CHECK (request_type IN ('access','correction','deletion','anonymization','export')),
  student_ref_hash text NOT NULL,
  status          text NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','in_progress','completed','rejected')),
  handled_by      uuid REFERENCES users(id),
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- Auditoria (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  institution_id  uuid REFERENCES institutions(id) ON DELETE SET NULL,
  actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_kind      text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user','system','extension')),
  action          text NOT NULL,
  resource_type   text NOT NULL,
  resource_id     uuid,
  outcome         text NOT NULL CHECK (outcome IN ('success','denied','error')),
  ip              inet,
  user_agent      text,
  -- Nunca gravar notas, textos de requerimento ou conteúdo de documento.
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON audit_log (institution_id, created_at DESC);
CREATE INDEX audit_log_resource_idx ON audit_log (resource_type, resource_id);

CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- ============================================================================
-- 0002 — Upload de documentos com antivírus e integridade
-- ============================================================================

-- Estado do ciclo de vida do arquivo:
--   pending_upload → após criar a URL pré-assinada (arquivo ainda não existe)
--   pending_scan   → upload confirmado, aguardando antivírus
--   clean          → escaneado e aprovado, pode ser vinculado a evidência
--   infected       → bloqueado; nunca é servido
--   failed         → scan falhou ou excedeu prazo (falha fechada)
CREATE TYPE document_scan_status AS ENUM ('pending_upload','pending_scan','clean','infected','failed');

ALTER TABLE documents
  ADD COLUMN scan_status document_scan_status NOT NULL DEFAULT 'pending_upload',
  ADD COLUMN scan_engine text,
  ADD COLUMN scanned_at timestamptz,
  ADD COLUMN scan_detail text,
  ADD COLUMN uploaded_at timestamptz,
  ADD COLUMN deleted_at timestamptz;

-- Documento novo só existe com metadados completos; o status guia o fluxo.
CREATE INDEX documents_pending_idx
  ON documents (institution_id, scan_status)
  WHERE scan_status IN ('pending_upload','pending_scan');

-- Ninguém vincula documento não aprovado. O trigger é a última linha de defesa:
-- mesmo que uma rota futura esqueça a checagem, o banco recusa.
CREATE OR REPLACE FUNCTION evidence_document_requires_clean_document()
RETURNS trigger AS $$
DECLARE
  doc_status document_scan_status;
  doc_institution uuid;
BEGIN
  SELECT scan_status, institution_id INTO doc_status, doc_institution
    FROM documents WHERE id = NEW.document_id;

  IF doc_institution IS DISTINCT FROM NEW.institution_id THEN
    RAISE EXCEPTION 'documento pertence a outra instituição';
  END IF;

  IF doc_status <> 'clean' THEN
    RAISE EXCEPTION 'documento % não está aprovado (status=%)', NEW.document_id, doc_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_documents_require_clean
  BEFORE INSERT OR UPDATE ON evidence_documents
  FOR EACH ROW EXECUTE FUNCTION evidence_document_requires_clean_document();

-- Histórico de acessos a arquivo: quem baixou o quê e quando.
CREATE TABLE document_access_log (
  id             bigserial PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id    uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  actor_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  action         text NOT NULL CHECK (action IN ('upload_url_issued','upload_confirmed','download_url_issued','scan_completed')),
  result         text NOT NULL,
  ip             inet,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_access_log_doc_idx ON document_access_log (document_id, created_at DESC);

CREATE OR REPLACE FUNCTION document_access_log_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'document_access_log é append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_access_log_no_update BEFORE UPDATE ON document_access_log
  FOR EACH ROW EXECUTE FUNCTION document_access_log_immutable();
CREATE TRIGGER document_access_log_no_delete BEFORE DELETE ON document_access_log
  FOR EACH ROW EXECUTE FUNCTION document_access_log_immutable();

-- ============================================================================
-- Plano de controle do SaaS
--
-- O que entra aqui NÃO é dado de cliente: é o estado comercial da instituição
-- (plano, ciclo de vida, assinatura) e o convite de acesso. Nada nesta migração
-- toca identificador de estudante, métrica acadêmica ou conteúdo de documento.
--
-- Regra que vale para o resto do sistema: plano é cota e estado, nunca papel.
-- Autorização continua sendo membership.role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo de planos
--
-- `price_brl_monthly` fica NULL de propósito: preço é decisão comercial,
-- registrada em contrato, não esquecida dentro de uma migração.
-- ---------------------------------------------------------------------------

CREATE TABLE plan_limits (
  plan_code            text PRIMARY KEY,
  label                text NOT NULL,
  -- NULL = sem limite. Prefira NULL a um número inventado.
  max_users            integer CHECK (max_users IS NULL OR max_users > 0),
  max_alerts_month     integer CHECK (max_alerts_month IS NULL OR max_alerts_month > 0),
  max_storage_mb       integer CHECK (max_storage_mb IS NULL OR max_storage_mb > 0),
  max_batches_day      integer CHECK (max_batches_day IS NULL OR max_batches_day > 0),
  max_courses          integer CHECK (max_courses IS NULL OR max_courses > 0),
  max_batch_records    integer CHECK (max_batch_records IS NULL OR max_batch_records > 0),
  trial_days           integer NOT NULL DEFAULT 30 CHECK (trial_days >= 0),
  price_brl_monthly    numeric(12,2),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plan_limits
  (plan_code, label, max_users, max_alerts_month, max_storage_mb,
   max_batches_day, max_courses, max_batch_records, trial_days, notes)
VALUES
  ('piloto', 'Piloto',
   10,    5000,   2048,   20,   30,   1000, 30,
   'Um curso ou uma frente. Suficiente para validar o fluxo com dado real.'),
  ('essencial', 'Essencial',
   25,    25000,  10240,  60,   100,  1000, 30,
   'Operação contínua de uma IES de pequeno porte.'),
  ('institucional', 'Institucional',
   100,   100000, 51200,  240,  500,  1000, 30,
   'Todas as coordenações, retenção e evidências simultâneas.'),
  ('contrato', 'Contrato',
   NULL,  NULL,   NULL,   NULL, NULL, 1000, 0,
   'Sem cota. Usado só quando o contrato assinado diz isso por escrito.')
ON CONFLICT (plan_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Ciclo de vida da instituição
--
-- Instituições que já existiam antes desta migração são clientes em operação:
-- viram `active`. Só instituições criadas depois nascem `trial`.
-- ---------------------------------------------------------------------------

ALTER TABLE institutions
  ADD COLUMN status        text NOT NULL DEFAULT 'trial'
                             CHECK (status IN ('trial','active','past_due','suspended','churned')),
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN activated_at  timestamptz,
  ADD COLUMN suspended_at  timestamptz,
  ADD COLUMN plan_code     text NOT NULL DEFAULT 'piloto';

ALTER TABLE institutions
  ADD CONSTRAINT institutions_plan_code_fkey
  FOREIGN KEY (plan_code) REFERENCES plan_limits(plan_code);

UPDATE institutions
   SET status       = 'active',
       activated_at = coalesce(activated_at, now())
 WHERE status = 'trial';

CREATE INDEX institutions_status_idx ON institutions (status);

-- ---------------------------------------------------------------------------
-- Assinatura
--
-- O estado comercial vive aqui, no banco da Vértice. Nenhuma requisição de
-- negócio pergunta ao provedor de pagamento se o cliente está em dia: se o
-- provedor cair, a plataforma continua operando com o último estado conhecido.
-- ---------------------------------------------------------------------------

CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  plan_code             text NOT NULL REFERENCES plan_limits(plan_code),
  status                text NOT NULL CHECK (status IN ('trialing','active','past_due','canceled')),
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at             timestamptz,
  provider              text,      -- 'asaas' | 'pagarme' | 'manual'
  provider_ref          text,      -- id da assinatura no provedor
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Uma assinatura aberta por instituição. Histórico fica nas linhas encerradas.
CREATE UNIQUE INDEX subscriptions_open_idx
  ON subscriptions (institution_id)
  WHERE status IN ('trialing','active','past_due');

CREATE INDEX subscriptions_provider_idx ON subscriptions (provider, provider_ref);

-- ---------------------------------------------------------------------------
-- Eventos de cobrança (idempotência do webhook)
--
-- O payload é guardado para reconciliação. Ele NUNCA deve conter dado de
-- estudante: o provedor não recebe nada além de instituição, plano e valor.
-- ---------------------------------------------------------------------------

CREATE TABLE billing_events (
  id             bigserial PRIMARY KEY,
  provider       text NOT NULL,
  event_id       text NOT NULL,
  event_type     text NOT NULL,
  institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
  payload        jsonb NOT NULL DEFAULT '{}',
  processed_at   timestamptz,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX billing_events_institution_idx ON billing_events (institution_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Convites de acesso
--
-- Substitui o desenho antigo em que o administrador digitava a senha do novo
-- usuário. Só o hash do token é persistido — mesmo desenho de pairing_tokens.
--
-- CHECK (role <> 'platform_admin') é uma fronteira de segurança, não um
-- detalhe: nenhuma instituição consegue emitir acesso de operador da Vértice.
-- ---------------------------------------------------------------------------

CREATE TABLE user_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text NOT NULL CHECK (role IN (
                     'institution_admin','regulatory_manager','coordinator',
                     'auditor_readonly','privacy_officer')),
  course_scope     uuid[] NOT NULL DEFAULT '{}',
  token_hash       text NOT NULL UNIQUE,
  expires_at       timestamptz NOT NULL,
  invited_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at      timestamptz,
  accepted_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (role <> 'auditor_readonly' OR expires_at IS NOT NULL)
);

-- Um convite pendente por e-mail por instituição. Reenviar revoga o anterior
-- em vez de deixar dois tokens válidos para a mesma pessoa.
CREATE UNIQUE INDEX user_invites_pending_idx
  ON user_invites (institution_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX user_invites_expiry_idx ON user_invites (expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ============================================================================
-- 0004 — Ordenação dos eventos de cobrança
--
-- Idempotência (0003) resolve evento repetido. NÃO resolve evento fora de
-- ordem, que é o erro caro: provedor reentrega `subscription.deleted` antes de
-- `payment.confirmed`, o cliente cancelou, e a conta continua escrevendo.
--
-- A solução aqui é comparar o instante do evento — declarado pelo provedor —
-- com o instante do último evento aplicado na assinatura. Evento mais antigo
-- que o já aplicado é registrado para auditoria e descartado.
--
-- `occurred_at` fica NULL quando o provedor não informa o instante: nesse caso
-- não há como ordenar, e o evento é aplicado (a idempotência ainda protege a
-- repetição). Preferimos assumir o risco de um estado velho sobre descartar
-- silenciosamente um evento que talvez fosse o mais novo.
-- ============================================================================

ALTER TABLE billing_events
  ADD COLUMN occurred_at timestamptz,
  -- Quando o evento chegou ordenado mas foi descartado por ser antigo, o
  -- motivo fica registrado: "por que a conta não mudou?" tem que ter resposta.
  ADD COLUMN skipped_reason text;

COMMENT ON COLUMN billing_events.occurred_at IS
  'Instante do fato segundo o provedor. NULL = provedor não informou.';
COMMENT ON COLUMN billing_events.skipped_reason IS
  'Motivo de o evento ter sido gravado sem alterar a assinatura.';

ALTER TABLE subscriptions
  ADD COLUMN last_event_at timestamptz;

COMMENT ON COLUMN subscriptions.last_event_at IS
  'occurred_at do último evento aplicado. Base da checagem de ordem.';

-- Busca do histórico de uma assinatura por ordem de acontecimento.
CREATE INDEX billing_events_institution_order_idx
  ON billing_events (institution_id, occurred_at DESC NULLS LAST);

-- ============================================================================
-- 0005 — Matrícula agregada por curso
--
-- O sinal de retenção (por aluno) já existia em `retention_records`. O que
-- faltava era o número que a coordenação usa primeiro: quantas matrículas cada
-- curso tem no semestre, aberto por status, e como isso varia em relação ao
-- semestre anterior.
--
-- Decisões que não são óbvias:
--
--  * Agregado, nunca pessoa. Esta tabela não tem identificador de estudante,
--    nem coluna que permita derivá-lo. É contagem de vínculos (matrícula no
--    semestre), não de pessoas únicas — o comentário fica na coluna para que
--    ninguém leia o número como "alunos distintos".
--
--  * `source_ref` guarda o relatório de origem ("eORBIT — relatório
--    estatístico de alunos"), não um caminho de arquivo nem texto livre.
--
--  * Turmas ficam em JSONB, e não em tabela filha, por um motivo concreto: na
--    origem a mesma turma aparece repetida dentro do semestre (ex.: ADM-1A com
--    12 e com 1 matrícula em 001/2025-02). Uma UNIQUE por código de turma
--    obrigaria a inventar uma chave que o e-ORBIT não tem. O array preserva a
--    origem exatamente como ela é, que é o que o CLAUDE.md manda fazer com
--    divergência de acervo.
--
--  * `vagas` é a soma das vagas cadastradas nas turmas. NÃO é vaga autorizada
--    pelo MEC — o nome da coluna não pode sugerir isso.
-- ============================================================================

CREATE TABLE enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id          uuid REFERENCES ingestion_batches(id) ON DELETE SET NULL,

  -- Semestre letivo no formato AAAA/SS (ex.: 2026/02). Texto de propósito:
  -- é um rótulo acadêmico, não uma data, e ordena corretamente como string.
  semester          text NOT NULL CHECK (semester ~ '^[0-9]{4}/(0[12])$'),

  -- Vagas das turmas, não vagas autorizadas.
  vagas             integer NOT NULL DEFAULT 0 CHECK (vagas >= 0),

  -- Um contador por status do e-ORBIT. Todos existem sempre: zero é um dado,
  -- ausência é extração incompleta. A distinção importa na leitura.
  matriculado       integer NOT NULL DEFAULT 0 CHECK (matriculado >= 0),
  pre_matriculado   integer NOT NULL DEFAULT 0 CHECK (pre_matriculado >= 0),
  trancado          integer NOT NULL DEFAULT 0 CHECK (trancado >= 0),
  abandono          integer NOT NULL DEFAULT 0 CHECK (abandono >= 0),
  concluido         integer NOT NULL DEFAULT 0 CHECK (concluido >= 0),
  cancelado         integer NOT NULL DEFAULT 0 CHECK (cancelado >= 0),
  transferido       integer NOT NULL DEFAULT 0 CHECK (transferido >= 0),
  troca_curso       integer NOT NULL DEFAULT 0 CHECK (troca_curso >= 0),
  graduado          integer NOT NULL DEFAULT 0 CHECK (graduado >= 0),

  -- Total de registros do relatório e soma dos subtotais por turma. Podem
  -- divergir do somatório dos status na origem; guardamos os dois como vieram
  -- em vez de "consertar" o número.
  total_registros   integer NOT NULL DEFAULT 0 CHECK (total_registros >= 0),
  turmas_somadas    integer NOT NULL DEFAULT 0 CHECK (turmas_somadas >= 0),

  -- Turmas com 1 ou mais matriculados: [{serie, turma, matriculados}].
  -- Turma com zero aluno não entra, por definição do relatório.
  turmas            jsonb NOT NULL DEFAULT '[]'::jsonb,

  source            text NOT NULL,
  observed_at       timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Um agregado por curso e semestre. Reimportar o mesmo semestre corrige o
  -- valor em vez de duplicar a linha — o relatório é um retrato, não um fato
  -- que se acumula.
  UNIQUE (institution_id, course_id, semester)
);

CREATE INDEX enrollments_tenant_semester_idx
  ON enrollments (institution_id, semester DESC);

CREATE INDEX enrollments_course_semester_idx
  ON enrollments (institution_id, course_id, semester DESC);

-- O agregado alimenta painel; não é trilha de auditoria. Mas alteração de
-- número publicado merece registro, e por isso não há trigger de imutabilidade
-- aqui: a correção é a operação normal (relatório reemitido pela secretaria).

-- ============================================================================
-- 0006 — Planejamento Estratégico do Curso
--
-- Cobre o ciclo do PEC (Planejamento Estratégico de Curso) e o Planejamento
-- Semestral de Atividades.
--
-- Princípios: institution_id em toda tabela, course_id como agregador,
-- versão para histórico, auditoria via audit_log, nenhum dado pessoal de aluno.
-- ============================================================================

CREATE TABLE strategic_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  course_id             uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version               integer NOT NULL DEFAULT 1,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),

  -- 1. Identificação
  coordinator_name      text,
  coordinator_since     text,
  enrolled_count        integer CHECK (enrolled_count IS NULL OR enrolled_count >= 0),
  first_semester        text,

  -- 2. Visão
  vision_text           text,
  vision_inspirations   jsonb NOT NULL DEFAULT '[]'::jsonb,
  vision_reflections    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 3. Ciclo de vida
  lifecycle_stage       text,
  lifecycle_strategies  jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 4. Matriz BCG
  bcg_market_growth     text,
  bcg_market_share      text,
  bcg_quadrant          text,
  bcg_strategies        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 5. Posicionamento estratégico (5 forças de Porter)
  porter_rivalry        text,
  porter_buyer_power    text,
  porter_supplier_power text,
  porter_substitutes    text,
  porter_new_entrants   text,

  -- 6-9. Fatores Críticos de Sucesso
  fcs_institutional     jsonb NOT NULL DEFAULT '[]'::jsonb,
  fcs_course            jsonb NOT NULL DEFAULT '[]'::jsonb,
  fcs_competitors       jsonb NOT NULL DEFAULT '[]'::jsonb,
  fcs_competitive_matrix jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 10. Matriz de atributos
  attributes_matrix     jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 11. Objetivos estratégicos (horizonte de 5 anos)
  strategic_objectives  jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 12. Objetivos operacionais / plano de ação
  operational_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, course_id, version)
);

CREATE INDEX strategic_plans_inst_course_idx ON strategic_plans (institution_id, course_id);
CREATE INDEX strategic_plans_status_idx ON strategic_plans (institution_id, status);

CREATE TABLE semester_plannings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  course_id      uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester       text NOT NULL CHECK (semester ~ '^[0-9]{4}/[12]$'),
  form_code      text,
  version        integer NOT NULL DEFAULT 1,
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'archived')),
  activities     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, course_id, semester, version)
);

CREATE INDEX semester_plannings_inst_course_idx
  ON semester_plannings (institution_id, course_id, semester);

$schema$;
  CREATE TABLE vertice_app.schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
  INSERT INTO vertice_app.schema_migrations(name) VALUES ('0001_init.sql');
  INSERT INTO vertice_app.schema_migrations(name) VALUES ('0002_documents.sql');
  INSERT INTO vertice_app.schema_migrations(name) VALUES ('0003_saas.sql');
  INSERT INTO vertice_app.schema_migrations(name) VALUES ('0004_billing_order.sql');
  INSERT INTO vertice_app.schema_migrations(name) VALUES ('0005_enrollment.sql');
  INSERT INTO vertice_app.schema_migrations(name) VALUES ('0006_strategic_planning.sql');
 END IF;
END $init$;
DO $security$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='vertice_app' LOOP
  EXECUTE format('ALTER TABLE vertice_app.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END $security$;
COMMIT;
