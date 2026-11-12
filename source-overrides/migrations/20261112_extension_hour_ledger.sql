-- ============================================================
-- Extensão 360° — Livro-razão de horas (append-only)
-- Substituição do campo mutable hours_completed por registro
-- imutável de eventos de lançamento de horas.
-- ============================================================

-- 1. Tabela de lançamentos de horas (append-only)
-- Cada registro é um evento: lançamento, correção compensatória ou estorno.
-- Nenhum UPDATE ou DELETE é permitido via RLS/policy.
CREATE TABLE IF NOT EXISTS vertice_extension_hour_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES vertice_extension_participants(id) ON DELETE CASCADE,

  -- Tipo do lançamento
  entry_type text NOT NULL DEFAULT 'credit'
    CHECK (entry_type IN ('credit', 'correction', 'reversal')),

  -- Minutos inteiros (positivo = crédito, negativo = estorno/correção)
  minutes int NOT NULL CHECK (minutes != 0),

  -- Evidência e contexto
  description text NOT NULL,
  evidence_doc_id uuid,          -- link para vertice_documents
  activity_date date NOT NULL,    -- data da atividade realizada
  reference_entry_id uuid,        -- para correções: aponta para o lançamento original

  -- Auditoria
  recorded_by uuid NOT NULL,      -- auth.uid() de quem registrou
  recorded_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,               -- quem validou (null = pendente)
  approved_at timestamptz,

  -- Constraint: correções devem referenciar um lançamento original
  CONSTRAINT chk_correction_ref CHECK (
    (entry_type = 'credit') OR (reference_entry_id IS NOT NULL)
  )
);

-- Append-only: impedir UPDATE e DELETE via trigger
CREATE OR REPLACE FUNCTION vertice_private.prevent_hour_entry_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Lançamentos de horas são imutáveis. Use um lançamento de correção ou estorno.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hour_entry_immutable ON vertice_extension_hour_entries;
CREATE TRIGGER trg_hour_entry_immutable
  BEFORE UPDATE OR DELETE ON vertice_extension_hour_entries
  FOR EACH ROW EXECUTE FUNCTION vertice_private.prevent_hour_entry_mutation();

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_hour_entries_participant
  ON vertice_extension_hour_entries(participant_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_hour_entries_project
  ON vertice_extension_hour_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_hour_entries_institution
  ON vertice_extension_hour_entries(institution_id);

-- 3. View: saldo de horas por participante (derivado do livro-razão)
CREATE OR REPLACE VIEW v_extension_participant_hours AS
SELECT
  e.institution_id,
  e.project_id,
  e.participant_id,
  -- Horas aprovadas (em minutos → horas inteiras arredondadas p/ baixo)
  coalesce(sum(e.minutes) FILTER (WHERE e.approved_at IS NOT NULL), 0) AS approved_minutes,
  floor(coalesce(sum(e.minutes) FILTER (WHERE e.approved_at IS NOT NULL), 0)::numeric / 60) AS approved_hours,
  -- Horas pendentes de aprovação
  coalesce(sum(e.minutes) FILTER (WHERE e.approved_at IS NULL), 0) AS pending_minutes,
  -- Total de lançamentos
  count(*) AS total_entries,
  count(*) FILTER (WHERE e.approved_at IS NOT NULL) AS approved_entries,
  count(*) FILTER (WHERE e.approved_at IS NULL) AS pending_entries,
  -- Última atividade
  max(e.activity_date) AS last_activity_date
FROM vertice_extension_hour_entries e
GROUP BY e.institution_id, e.project_id, e.participant_id;

-- 4. Atualizar view de cobertura para usar o livro-razão
CREATE OR REPLACE VIEW v_extension_coverage AS
SELECT
  p.institution_id,
  unnest(p.course_ids) AS course_id,
  p.semester,
  count(DISTINCT p.id) AS total_projects,
  count(DISTINCT par.id) FILTER (WHERE par.participant_type = 'discente') AS total_students,
  coalesce(
    floor(sum(h.approved_minutes)::numeric / 60) FILTER (WHERE par.participant_type = 'discente'),
    0
  ) AS total_student_hours,
  count(DISTINCT par.id) FILTER (WHERE par.participant_type = 'docente') AS total_faculty,
  count(DISTINCT del.id) AS total_deliverables
FROM vertice_extension_projects p
LEFT JOIN vertice_extension_participants par ON par.project_id = p.id
LEFT JOIN v_extension_participant_hours h ON h.participant_id = par.id AND h.project_id = p.id
LEFT JOIN vertice_extension_deliverables del ON del.project_id = p.id
WHERE p.status NOT IN ('cancelado','suspenso')
GROUP BY p.institution_id, unnest(p.course_ids), p.semester;

-- 5. Atualizar view de resumo institucional
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
  coalesce(
    floor(sum(h.approved_minutes)::numeric / 60) FILTER (WHERE par.participant_type = 'discente'),
    0
  ) AS total_student_hours,
  count(DISTINCT del.id) AS total_deliverables,
  count(DISTINCT unnest) AS courses_with_extension,
  array_agg(DISTINCT p.semester ORDER BY p.semester DESC) FILTER (WHERE p.semester IS NOT NULL) AS semesters
FROM vertice_extension_projects p
LEFT JOIN vertice_extension_participants par ON par.project_id = p.id
LEFT JOIN v_extension_participant_hours h ON h.participant_id = par.id AND h.project_id = p.id
LEFT JOIN vertice_extension_deliverables del ON del.project_id = p.id
LEFT JOIN LATERAL unnest(p.course_ids) ON true
WHERE p.status NOT IN ('cancelado','suspenso')
GROUP BY p.institution_id;

-- 6. RLS — somente INSERT permitido; leitura por instituição
ALTER TABLE vertice_extension_hour_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hour_entries_read"
  ON vertice_extension_hour_entries FOR SELECT
  USING (vertice_private.can_read_institution(institution_id));

CREATE POLICY "hour_entries_insert"
  ON vertice_extension_hour_entries FOR INSERT
  WITH CHECK (vertice_private.can_read_institution(institution_id));

-- Sem policy para UPDATE/DELETE — o trigger já bloqueia, mas a ausência
-- de policy é uma segunda barreira.

-- 7. Comentário: o campo hours_completed em vertice_extension_participants
-- permanece como cache desnormalizado para queries rápidas.
-- Um trigger pode atualizá-lo automaticamente a partir do livro-razão,
-- mas isso é opcional e pode ser adicionado depois.
-- A view v_extension_participant_hours é a fonte de verdade.
