-- ENADE Eligibility Engine
-- Stores course ENADE configuration and computed student eligibility

-- Course ENADE config: duration, area, next exam year
CREATE TABLE IF NOT EXISTS vertice_enade_course_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid,                    -- FK to vertice_courses if available
  eorbit_curso_id bigint,            -- FK to vertice_eorbit_cursos.id
  course_name text NOT NULL DEFAULT '',
  modalidade text NOT NULL DEFAULT 'presencial',
  area_enade text NOT NULL DEFAULT '',           -- e.g. 'Direito', 'Administração', 'Medicina'
  area_code text NOT NULL DEFAULT '',            -- INEP area code
  total_periodos integer NOT NULL DEFAULT 10,    -- total semesters for the course
  carga_horaria_total integer NOT NULL DEFAULT 0, -- total hours
  -- ENADE cycle config
  proximo_enade_ano integer,                      -- next ENADE exam year for this area
  ciclo_enade_anos integer[] DEFAULT ARRAY[3],    -- cycle in years (usually 3)
  -- Eligibility thresholds (INEP rules)
  ingressante_max_pct numeric NOT NULL DEFAULT 0.25,   -- <= 25% = ingressante
  concludente_min_pct numeric NOT NULL DEFAULT 0.80,   -- >= 80% = concludente
  -- Status
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, eorbit_curso_id)
);

ALTER TABLE vertice_enade_course_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enade_config_institution" ON vertice_enade_course_config
  FOR ALL USING (institution_id IN (
    SELECT institution_id FROM vertice_memberships
    WHERE user_id = auth.uid()
    AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
  ));

-- Student eligibility records (computed)
CREATE TABLE IF NOT EXISTS vertice_enade_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  config_id uuid NOT NULL REFERENCES vertice_enade_course_config(id) ON DELETE CASCADE,
  eorbit_aluno_id bigint,
  student_name text NOT NULL DEFAULT '',
  matricula text NOT NULL DEFAULT '',
  cpf text,                              -- only when available from roster
  curso_name text NOT NULL DEFAULT '',
  modalidade text NOT NULL DEFAULT '',
  periodo integer NOT NULL DEFAULT 0,
  situacao text NOT NULL DEFAULT '',
  -- Computed eligibility
  elegibility_type text NOT NULL CHECK (elegibility_type IN ('ingressante','concludente','regular','irregular')),
  pct_conclusao numeric NOT NULL DEFAULT 0,  -- periodo / total_periodos
  enade_ano integer,                          -- year of the ENADE exam
  -- Status
  status text NOT NULL DEFAULT 'elegivel' CHECK (status IN ('elegivel','dispensado','irregular','vinculado_fo','atividade_concluida')),
  fo_linked boolean NOT NULL DEFAULT false,
  fo_linked_at timestamptz,
  -- Metadata
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vertice_enade_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enade_eligibility_institution" ON vertice_enade_eligibility
  FOR ALL USING (institution_id IN (
    SELECT institution_id FROM vertice_memberships
    WHERE user_id = auth.uid()
    AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
  ));

CREATE INDEX IF NOT EXISTS idx_enade_eligibility_institution ON vertice_enade_eligibility(institution_id);
CREATE INDEX IF NOT EXISTS idx_enade_eligibility_config ON vertice_enade_eligibility(config_id);
CREATE INDEX IF NOT EXISTS idx_enade_eligibility_type ON vertice_enade_eligibility(elegibility_type, status);
CREATE INDEX IF NOT EXISTS idx_enade_config_institution ON vertice_enade_course_config(institution_id);
