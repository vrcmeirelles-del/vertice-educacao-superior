-- Migração: Avaliação Simulada por Indicador (Reconhecimento de Curso)
-- Tabela para armazenar conceito atual, conceito viável, parecer, lacunas e perguntas prováveis
-- por indicador do instrumento INEP, vinculados a uma IES e a um curso.

CREATE TABLE IF NOT EXISTS vertice_avaliacao_simulada (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL,
  course_id     uuid NOT NULL,
  indicador     text NOT NULL,          -- "1.10", "2.3" etc.
  dimensao      smallint NOT NULL,      -- 1, 2 ou 3
  conceito_atual   smallint CHECK (conceito_atual BETWEEN 1 AND 5),
  conceito_viavel  smallint CHECK (conceito_viavel BETWEEN 1 AND 5),
  parecer          text DEFAULT '',
  lacunas          text DEFAULT '',
  plano_nde        text DEFAULT '',
  perguntas_comissao text DEFAULT '',
  updated_by    uuid,
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),

  UNIQUE (institution_id, course_id, indicador)
);

-- Índice para consulta rápida por IES + curso
CREATE INDEX IF NOT EXISTS idx_avs_inst_course
  ON vertice_avaliacao_simulada (institution_id, course_id);

-- RLS
ALTER TABLE vertice_avaliacao_simulada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avs_select" ON vertice_avaliacao_simulada
  FOR SELECT USING (true);

CREATE POLICY "avs_insert" ON vertice_avaliacao_simulada
  FOR INSERT WITH CHECK (true);

CREATE POLICY "avs_update" ON vertice_avaliacao_simulada
  FOR UPDATE USING (true);

CREATE POLICY "avs_delete" ON vertice_avaliacao_simulada
  FOR DELETE USING (true);

COMMENT ON TABLE vertice_avaliacao_simulada IS
  'Avaliação simulada por indicador INEP para Reconhecimento de Curso. Cada linha armazena o conceito atribuído pelo consultor, o conceito viável, o parecer técnico, as lacunas para conceito 5, o plano de ação para o NDE e as perguntas prováveis da comissão.';
