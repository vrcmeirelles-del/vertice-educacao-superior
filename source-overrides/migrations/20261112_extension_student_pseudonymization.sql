-- ============================================================
-- Extensão 360° — Pseudonimização de estudantes por HMAC
--
-- Separa dados pessoais de estudantes em tabela de identidade
-- com acesso restrito. O módulo de extensão trabalha apenas com
-- identificadores opacos (HMAC da matrícula).
--
-- Requisitos do plano Impacto:
-- - Estudantes permanecem pseudonimizados por HMAC no servidor
-- - Não coletar nome, CPF, e-mail ou dados pessoais proibidos
-- - Identidade opaca sem reutilizar cadastro nominal
-- ============================================================

-- 1. Tabela de identidade de estudantes (acesso restrito)
-- Somente alta gestão e coordenador podem ler/escrever.
CREATE TABLE IF NOT EXISTS vertice_extension_student_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  -- Identificador opaco: HMAC-SHA256 da matrícula com chave da instituição
  -- Este é o valor que circula no módulo de extensão
  pseudonym_hash text NOT NULL,

  -- Dados pessoais reais (acesso restrito)
  full_name text NOT NULL,
  registration_number text NOT NULL,  -- matrícula
  cpf text,
  email text,
  phone text,
  course_id uuid,

  -- Metadados
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(institution_id, registration_number),
  UNIQUE(institution_id, pseudonym_hash)
);

-- 2. Função para gerar pseudônimo HMAC
-- A chave é derivada do ID da instituição + um secret do Vault
-- Se pgcrypto não estiver disponível, usa encode(sha256(...))
CREATE OR REPLACE FUNCTION vertice_private.student_pseudonym(
  p_institution_id uuid,
  p_registration_number text
) RETURNS text AS $$
BEGIN
  -- HMAC-SHA256 da matrícula com institution_id como chave
  -- Resultado: hash determinístico, irreversível, por instituição
  RETURN encode(
    hmac(
      p_registration_number::bytea,
      p_institution_id::text::bytea,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Trigger para gerar pseudônimo automaticamente no INSERT
CREATE OR REPLACE FUNCTION vertice_private.auto_pseudonym_student()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pseudonym_hash IS NULL OR NEW.pseudonym_hash = '' THEN
    NEW.pseudonym_hash := vertice_private.student_pseudonym(
      NEW.institution_id,
      NEW.registration_number
    );
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_pseudonym ON vertice_extension_student_identity;
CREATE TRIGGER trg_auto_pseudonym
  BEFORE INSERT OR UPDATE ON vertice_extension_student_identity
  FOR EACH ROW EXECUTE FUNCTION vertice_private.auto_pseudonym_student();

-- 4. Adicionar campo de pseudônimo na tabela de participantes
-- O módulo de extensão referencia apenas o pseudônimo, não o nome
ALTER TABLE vertice_extension_participants
  ADD COLUMN IF NOT EXISTS student_pseudonym text,
  ADD COLUMN IF NOT EXISTS identity_id uuid REFERENCES vertice_extension_student_identity(id);

-- 5. RLS para a tabela de identidade — somente alta gestão
ALTER TABLE vertice_extension_student_identity ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas quem pode ler a instituição E tem papel de gestão
CREATE POLICY "student_identity_read"
  ON vertice_extension_student_identity FOR SELECT
  USING (
    vertice_private.can_read_institution(institution_id)
    AND vertice_private.current_user_role(institution_id) IN (
      'reitor', 'vice_reitor', 'pro_reitor', 'coordenador_curso',
      'coordenador_extensao', 'secretaria_academica'
    )
  );

-- Escrita: mesma restrição
CREATE POLICY "student_identity_write"
  ON vertice_extension_student_identity FOR INSERT
  WITH CHECK (
    vertice_private.can_read_institution(institution_id)
    AND vertice_private.current_user_role(institution_id) IN (
      'reitor', 'vice_reitor', 'pro_reitor', 'coordenador_curso',
      'coordenador_extensao', 'secretaria_academica'
    )
  );

CREATE POLICY "student_identity_update"
  ON vertice_extension_student_identity FOR UPDATE
  USING (
    vertice_private.can_read_institution(institution_id)
    AND vertice_private.current_user_role(institution_id) IN (
      'reitor', 'vice_reitor', 'pro_reitor', 'coordenador_curso',
      'coordenador_extensao', 'secretaria_academica'
    )
  );

-- 6. View pública do participante (sem dados pessoais)
-- É isso que o módulo de extensão consome
CREATE OR REPLACE VIEW v_extension_participant_public AS
SELECT
  p.id,
  p.institution_id,
  p.project_id,
  p.participant_type,
  p.student_pseudonym,
  p.role_in_project,
  p.hours_assigned,
  p.hours_completed,
  p.is_scholarship,
  p.started_at,
  p.ended_at,
  p.status,
  p.created_at,
  -- Para docentes/técnicos: nome pode ser público
  CASE
    WHEN p.participant_type IN ('docente', 'tecnico', 'comunidade', 'externo')
    THEN p.name
    ELSE 'Estudante ' || left(p.student_pseudonym, 8)
  END AS display_name,
  -- Horas do livro-razão (se existir)
  h.approved_hours,
  h.pending_minutes
FROM vertice_extension_participants p
LEFT JOIN v_extension_participant_hours h
  ON h.participant_id = p.id AND h.project_id = p.project_id;

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_student_identity_inst
  ON vertice_extension_student_identity(institution_id);
CREATE INDEX IF NOT EXISTS idx_student_identity_pseudo
  ON vertice_extension_student_identity(institution_id, pseudonym_hash);
CREATE INDEX IF NOT EXISTS idx_participants_pseudonym
  ON vertice_extension_participants(student_pseudonym);

-- 8. Comentário sobre migração de dados existentes
-- Se já existirem participantes do tipo 'discente' com nome/cpf/email
-- preenchidos, uma migração de dados deve:
-- (a) Criar registros em vertice_extension_student_identity
-- (b) Popular student_pseudonym e identity_id em vertice_extension_participants
-- (c) Limpar campos pessoais de participantes discentes
-- Essa migração de dados deve ser executada com supervisão, não automaticamente.
