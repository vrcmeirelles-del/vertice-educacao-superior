-- CANDIDATO DE HOMOLOGAÇÃO: NÃO EXECUTAR DIRETAMENTE EM PRODUÇÃO.
-- Evidência: `vertice_app.curriculum_competencies` não possui período da competência.
-- Após migração aprovada, a Construção Curricular registrará período e status proposto.
-- A promoção para 'validated' requer posterior workflow institucional autenticado com
-- MFA/AAL2 e autoridade de PPC; NÃO efetuar automaticamente neste script.

BEGIN;
ALTER TABLE vertice_app.curriculum_competencies
  ADD COLUMN IF NOT EXISTS origin_period smallint,
  ADD COLUMN IF NOT EXISTS period_status text NOT NULL DEFAULT 'proposed';
ALTER TABLE vertice_app.curriculum_competencies
  ADD CONSTRAINT curriculum_origin_period_valid_range
    CHECK(origin_period IS NULL OR origin_period BETWEEN 1 AND 12);
ALTER TABLE vertice_app.curriculum_competencies
  ADD CONSTRAINT curriculum_period_status_allowed
    CHECK(period_status IN ('proposed','validated'));

-- Nenhuma atualização de competência preexistente nesta migração.
-- Todo período histórico permanece NULL até preenchimento e validação humana.
COMMIT;
