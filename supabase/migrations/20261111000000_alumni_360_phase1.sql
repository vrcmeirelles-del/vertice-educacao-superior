-- ============================================================
-- VÉRTICE EGRESSOS 360° — FASE 1: FUNDAÇÃO E BASE LONGITUDINAL
-- Migração: 20261111000000_alumni_360_phase1.sql
-- ============================================================
-- Tabelas:
--   vertice_alumni_profiles      — Perfil longitudinal do egresso
--   vertice_alumni_education     — Histórico de cursos e conclusões
--   vertice_alumni_employment    — Histórico profissional
--   vertice_alumni_further_ed    — Formação continuada
--   vertice_alumni_contact_hist  — Histórico de atualizações de contato
--   vertice_alumni_audit_log     — Auditoria de alterações
--   vertice_alumni_config        — Configurações por IES (marcos, canais)
-- ============================================================

-- 1. PERFIL LONGITUDINAL DO EGRESSO
-- Identificador único da pessoa (pode ter múltiplas formações).
-- CPF é identificador auxiliar de conciliação, nunca exposto publicamente.
CREATE TABLE IF NOT EXISTS vertice_alumni_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- conciliação
  cpf_hash        text,            -- SHA-256 do CPF normalizado (só dígitos), para dedup sem expor
  -- identificação
  full_name       text NOT NULL,
  social_name     text,
  email           text,
  phone           text,
  preferred_channel text DEFAULT 'email' CHECK (preferred_channel IN ('email','whatsapp','sms','portal','nenhum')),
  -- controle
  contact_verified_at  timestamptz,
  contact_updated_at   timestamptz,
  comm_opt_out    boolean NOT NULL DEFAULT false,  -- direito de opt-out LGPD
  -- metadados
  source          text NOT NULL DEFAULT 'import' CHECK (source IN ('import','eorbit','api','portal','manual')),
  source_ref      text,           -- referência na fonte (matrícula, ID externo)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alumni_profiles_cpf_hash
  ON vertice_alumni_profiles (cpf_hash) WHERE cpf_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_profiles_email
  ON vertice_alumni_profiles (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_profiles_name
  ON vertice_alumni_profiles (full_name);

-- 2. HISTÓRICO DE CURSOS E CONCLUSÕES
-- Cada linha é uma formação do egresso em uma IES/curso específico.
-- Um alumni_profile pode ter N education records (múltiplas formações).
CREATE TABLE IF NOT EXISTS vertice_alumni_education (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL REFERENCES vertice_alumni_profiles(id) ON DELETE CASCADE,
  institution_id    uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id         uuid REFERENCES vertice_courses(id),
  -- dados acadêmicos
  enrollment_id     text,          -- matrícula histórica
  modality          text,          -- presencial, semipresencial, EAD
  degree            text,          -- bacharelado, licenciatura, tecnólogo
  admission_year    smallint,
  admission_semester smallint CHECK (admission_semester IN (1, 2)),
  -- status com distinção obrigatória (prompt §4)
  academic_status   text NOT NULL DEFAULT 'ativo' CHECK (academic_status IN (
    'ativo','provavel_concluinte','concluinte','integralizado',
    'formado','diplomado','egresso_acompanhado',
    'desistente','transferido','jubilado','cancelado'
  )),
  conclusion_year   smallint,
  conclusion_semester smallint CHECK (conclusion_semester IN (1, 2)),
  graduation_date   date,          -- colação de grau
  diploma_date      date,          -- diplomação
  -- vínculo com e-ORBIT legado (quando existir)
  eorbit_aluno_id   bigint,        -- FK lógica para vertice_eorbit_alunos.id
  eorbit_curso_id   bigint,        -- FK lógica para vertice_eorbit_cursos.id
  -- rastreabilidade
  status_source     text NOT NULL DEFAULT 'import' CHECK (status_source IN ('import','eorbit','api','portal','manual','academico')),
  status_verified   boolean NOT NULL DEFAULT false,
  status_verified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- impedir duplicata da mesma matrícula no mesmo curso/IES
  UNIQUE (institution_id, course_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_alumni_education_profile
  ON vertice_alumni_education (profile_id);
CREATE INDEX IF NOT EXISTS idx_alumni_education_institution
  ON vertice_alumni_education (institution_id);
CREATE INDEX IF NOT EXISTS idx_alumni_education_course
  ON vertice_alumni_education (course_id);
CREATE INDEX IF NOT EXISTS idx_alumni_education_status
  ON vertice_alumni_education (academic_status);
CREATE INDEX IF NOT EXISTS idx_alumni_education_conclusion
  ON vertice_alumni_education (conclusion_year, conclusion_semester);

-- 3. HISTÓRICO PROFISSIONAL
CREATE TABLE IF NOT EXISTS vertice_alumni_employment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES vertice_alumni_profiles(id) ON DELETE CASCADE,
  -- situação
  employment_status text NOT NULL CHECK (employment_status IN (
    'empregado_clt','servidor_publico','autonomo','empresario',
    'estagiario','freelancer','desempregado','nao_informado','outro'
  )),
  occupation      text,           -- cargo ou função
  sector          text,           -- setor econômico
  field_of_work   text,           -- área de atuação
  employer_name   text,
  -- relação com formação
  related_to_degree boolean,       -- atua na área de formação?
  education_id    uuid REFERENCES vertice_alumni_education(id),  -- qual formação
  -- temporalidade
  started_at      date,
  ended_at        date,
  months_to_first_job smallint,    -- tempo até primeira ocupação após conclusão
  -- autodeclarado
  salary_range    text CHECK (salary_range IN (
    'ate_1sm','1_3sm','3_5sm','5_10sm','10_20sm','acima_20sm','nao_informado'
  )),
  location_city   text,
  location_state  text,
  -- fonte e rastreabilidade
  source          text NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','pesquisa','import','manual')),
  reported_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alumni_employment_profile
  ON vertice_alumni_employment (profile_id);
CREATE INDEX IF NOT EXISTS idx_alumni_employment_education
  ON vertice_alumni_employment (education_id);

-- 4. FORMAÇÃO CONTINUADA
CREATE TABLE IF NOT EXISTS vertice_alumni_further_ed (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES vertice_alumni_profiles(id) ON DELETE CASCADE,
  ed_type         text NOT NULL CHECK (ed_type IN (
    'especializacao','mba','mestrado','doutorado','residencia',
    'certificacao','curso_livre','pos_doc','outro'
  )),
  program_name    text,
  institution_name text,
  field_of_study  text,
  start_year      smallint,
  end_year        smallint,
  status          text DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluido','abandonado')),
  source          text NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','pesquisa','import','manual')),
  reported_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alumni_further_ed_profile
  ON vertice_alumni_further_ed (profile_id);

-- 5. HISTÓRICO DE CONTATO / COMUNICAÇÃO
CREATE TABLE IF NOT EXISTS vertice_alumni_contact_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES vertice_alumni_profiles(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email','whatsapp','sms','portal','telefone','presencial')),
  direction       text NOT NULL CHECK (direction IN ('outbound','inbound')),  -- IES→egresso ou egresso→IES
  purpose         text,           -- pesquisa, convite, atualização, oportunidade
  campaign_ref    text,           -- referência da campanha/pesquisa
  status          text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','entregue','lido','respondido','falhou','bounce')),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alumni_contact_profile
  ON vertice_alumni_contact_history (profile_id);
CREATE INDEX IF NOT EXISTS idx_alumni_contact_sent
  ON vertice_alumni_contact_history (sent_at DESC);

-- 6. AUDITORIA
CREATE TABLE IF NOT EXISTS vertice_alumni_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL,   -- alumni_profile, alumni_education, alumni_employment, etc.
  entity_id       uuid NOT NULL,
  action          text NOT NULL CHECK (action IN ('create','update','delete','merge','import','export','consent_change')),
  changed_by      uuid,            -- auth.uid() quando disponível
  changed_by_role text,            -- master, gestor, egresso, sistema
  institution_id  uuid REFERENCES vertice_institutions(id),
  old_values      jsonb,
  new_values      jsonb,
  ip_address      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alumni_audit_entity
  ON vertice_alumni_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alumni_audit_institution
  ON vertice_alumni_audit_log (institution_id);
CREATE INDEX IF NOT EXISTS idx_alumni_audit_created
  ON vertice_alumni_audit_log (created_at DESC);

-- 7. CONFIGURAÇÃO POR IES (marcos temporais, canais, preferências)
CREATE TABLE IF NOT EXISTS vertice_alumni_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL UNIQUE REFERENCES vertice_institutions(id),
  -- marcos temporais configuráveis (meses após conclusão)
  milestone_months integer[] NOT NULL DEFAULT '{-6,0,6,12,24,36,60}',
  -- canais habilitados
  channels_enabled text[] NOT NULL DEFAULT '{email,portal}',
  -- política
  policy_document_url text,
  policy_approved_at  timestamptz,
  policy_approved_by  uuid,
  -- limites de comunicação
  max_contacts_per_month integer DEFAULT 3,
  quiet_hours_start  time,
  quiet_hours_end    time,
  -- metadados
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 8. RLS — Row Level Security
ALTER TABLE vertice_alumni_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_further_ed ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_alumni_config ENABLE ROW LEVEL SECURITY;

-- Master pode ver tudo
CREATE POLICY alumni_profiles_master ON vertice_alumni_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
  );

CREATE POLICY alumni_education_master ON vertice_alumni_education
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
  );

CREATE POLICY alumni_employment_master ON vertice_alumni_employment
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
  );

CREATE POLICY alumni_further_ed_master ON vertice_alumni_further_ed
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
  );

CREATE POLICY alumni_contact_master ON vertice_alumni_contact_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
  );

CREATE POLICY alumni_audit_master ON vertice_alumni_audit_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
  );

CREATE POLICY alumni_config_master ON vertice_alumni_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vertice_admins WHERE user_id = auth.uid())
  );

-- Gestor vê egressos da sua IES (via education → institution_id)
CREATE POLICY alumni_education_gestor ON vertice_alumni_education
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vertice_memberships m
      WHERE m.user_id = auth.uid()
        AND m.institution_id = vertice_alumni_education.institution_id
    )
  );

-- Gestor vê profiles que têm education na sua IES
CREATE POLICY alumni_profiles_gestor ON vertice_alumni_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vertice_alumni_education ae
      JOIN vertice_memberships m ON m.institution_id = ae.institution_id
      WHERE ae.profile_id = vertice_alumni_profiles.id
        AND m.user_id = auth.uid()
    )
  );

-- Gestor vê employment ligado a education da sua IES
CREATE POLICY alumni_employment_gestor ON vertice_alumni_employment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vertice_alumni_education ae
      JOIN vertice_memberships m ON m.institution_id = ae.institution_id
      WHERE ae.profile_id = vertice_alumni_employment.profile_id
        AND m.user_id = auth.uid()
    )
  );

-- Gestor vê formação continuada de egressos da sua IES
CREATE POLICY alumni_further_ed_gestor ON vertice_alumni_further_ed
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vertice_alumni_education ae
      JOIN vertice_memberships m ON m.institution_id = ae.institution_id
      WHERE ae.profile_id = vertice_alumni_further_ed.profile_id
        AND m.user_id = auth.uid()
    )
  );

-- Gestor vê config da sua IES
CREATE POLICY alumni_config_gestor ON vertice_alumni_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vertice_memberships m
      WHERE m.user_id = auth.uid()
        AND m.institution_id = vertice_alumni_config.institution_id
    )
  );

-- Service role (edge functions, importações) — bypass automático do RLS

-- 9. FUNÇÃO DE DEDUPLICAÇÃO POR CPF_HASH
CREATE OR REPLACE FUNCTION alumni_find_or_create_profile(
  p_cpf_hash text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_source text DEFAULT 'import'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Tenta encontrar por cpf_hash
  IF p_cpf_hash IS NOT NULL THEN
    SELECT id INTO v_id FROM vertice_alumni_profiles WHERE cpf_hash = p_cpf_hash;
    IF v_id IS NOT NULL THEN
      -- Atualiza contato se mais recente
      UPDATE vertice_alumni_profiles
      SET email = COALESCE(p_email, email),
          phone = COALESCE(p_phone, phone),
          contact_updated_at = CASE WHEN p_email IS NOT NULL OR p_phone IS NOT NULL THEN now() ELSE contact_updated_at END,
          updated_at = now()
      WHERE id = v_id;
      RETURN v_id;
    END IF;
  END IF;

  -- Cria novo perfil
  INSERT INTO vertice_alumni_profiles (cpf_hash, full_name, email, phone, source)
  VALUES (p_cpf_hash, p_full_name, p_email, p_phone, p_source)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 10. VIEW consolidada para BI (sem dados pessoais sensíveis)
CREATE OR REPLACE VIEW vertice_alumni_overview AS
SELECT
  ae.institution_id,
  ae.course_id,
  c.name AS course_name,
  c.modality,
  ae.academic_status,
  ae.conclusion_year,
  ae.conclusion_semester,
  ae.status_verified,
  COUNT(DISTINCT ae.profile_id) AS total_egressos,
  COUNT(DISTINCT ae.profile_id) FILTER (WHERE ap.email IS NOT NULL) AS com_contato_valido,
  COUNT(DISTINCT ae.profile_id) FILTER (WHERE ap.contact_updated_at > now() - interval '12 months') AS contato_atualizado_12m
FROM vertice_alumni_education ae
JOIN vertice_alumni_profiles ap ON ap.id = ae.profile_id
LEFT JOIN vertice_courses c ON c.id = ae.course_id
WHERE ae.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado','concluinte')
GROUP BY ae.institution_id, ae.course_id, c.name, c.modality,
         ae.academic_status, ae.conclusion_year, ae.conclusion_semester, ae.status_verified;

-- 11. COMENTÁRIOS
COMMENT ON TABLE vertice_alumni_profiles IS 'Perfil longitudinal do egresso — identifica a pessoa, independente de quantas formações possua. CPF armazenado apenas como hash SHA-256 para deduplicação.';
COMMENT ON TABLE vertice_alumni_education IS 'Histórico de formações do egresso — cada registro vincula o perfil a uma IES/curso específico, com status granular conforme §4 do prompt.';
COMMENT ON TABLE vertice_alumni_employment IS 'Histórico profissional autodeclarado ou coletado por pesquisa — rastreia inserção, evolução e relação com a formação.';
COMMENT ON TABLE vertice_alumni_further_ed IS 'Formação continuada do egresso — especialização, mestrado, doutorado, certificações.';
COMMENT ON TABLE vertice_alumni_contact_history IS 'Registro de toda comunicação entre IES e egresso — preserva histórico para auditoria e controle de frequência.';
COMMENT ON TABLE vertice_alumni_audit_log IS 'Trilha de auditoria completa — quem alterou o quê, quando e de onde.';
COMMENT ON TABLE vertice_alumni_config IS 'Configurações do programa de egressos por IES — marcos temporais, canais, limites, política.';
COMMENT ON VIEW vertice_alumni_overview IS 'Visão consolidada para BI de egressos — contagens por IES/curso/status sem dados pessoais.';
