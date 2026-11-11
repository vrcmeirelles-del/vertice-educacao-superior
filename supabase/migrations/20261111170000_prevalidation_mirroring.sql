-- ============================================================
-- PRÉ-VALIDAÇÃO INTELIGENTE E ESPELHAMENTO DE EVIDÊNCIAS
-- Migração reversível — não altera dados existentes
-- ============================================================

-- 1. Catálogo de instrumentos regulatórios disponíveis
CREATE TABLE IF NOT EXISTS vertice_instrument_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  instrument_code text NOT NULL,       -- reconhecimento_curso, recredenciamento_2017, novo_instrumento_2026, autorizacao_curso, avaliacao_institucional
  instrument_label text NOT NULL,
  instrument_version text NOT NULL DEFAULT '2017',
  is_active boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'curso', -- curso | institucional | ambos
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id, instrument_code, instrument_version)
);

-- 2. Objetos de avaliação por instrumento (consolidação)
CREATE TABLE IF NOT EXISTS vertice_instrument_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES vertice_instrument_catalog(id) ON DELETE CASCADE,
  object_code text NOT NULL,           -- 1.1, 2.3, E1.5, R1.2 etc
  dimension text,                       -- Dimensão ou Eixo
  object_label text NOT NULL,
  description text,
  criteria text,                        -- Critérios de avaliação
  evidence_types text[] DEFAULT '{}',   -- Tipos de evidência esperados
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, object_code)
);

-- 3. Pré-validação IA por documento
CREATE TABLE IF NOT EXISTS vertice_doc_prevalidation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  document_id uuid,                    -- FK para vertice_documents (gestão documental)
  repository_file_id uuid,             -- FK para vertice_repository_files (repositório)
  source_table text NOT NULL,          -- 'vertice_documents' ou 'vertice_repository_files'

  -- Resultado da análise IA
  ai_status text NOT NULL DEFAULT 'pending'
    CHECK (ai_status IN ('pending','processing','completed','failed')),
  ai_summary text,                     -- Resumo do conteúdo
  ai_nature text,                      -- Natureza do documento (PPC, ata, regulamento etc.)
  ai_institution_detected text,        -- Instituição detectada no documento
  ai_course_detected text,             -- Curso detectado
  ai_period_detected text,             -- Período de referência
  ai_scope_detected text,              -- Abrangência (institucional/curso/ambos)
  ai_model_version text,
  ai_analyzed_at timestamptz,
  ai_error text,

  -- Metadados
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (document_id IS NOT NULL OR repository_file_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_prevalidation_institution ON vertice_doc_prevalidation(institution_id);
CREATE INDEX IF NOT EXISTS idx_prevalidation_document ON vertice_doc_prevalidation(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prevalidation_repo_file ON vertice_doc_prevalidation(repository_file_id) WHERE repository_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prevalidation_status ON vertice_doc_prevalidation(ai_status);

-- 4. Vínculos documento ↔ indicador (resultado da pré-validação)
CREATE TABLE IF NOT EXISTS vertice_doc_indicator_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prevalidation_id uuid NOT NULL REFERENCES vertice_doc_prevalidation(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),

  -- Indicador associado
  instrument_code text NOT NULL,       -- reconhecimento_curso, novo_instrumento_2026 etc
  instrument_version text NOT NULL DEFAULT '2017',
  object_code text NOT NULL,           -- 1.5, E2.3 etc
  dimension text,
  is_primary boolean NOT NULL DEFAULT false,

  -- Análise
  compatibility text NOT NULL CHECK (compatibility IN ('alta','media','baixa')),
  justification text NOT NULL,
  evidence_excerpts jsonb DEFAULT '[]', -- [{page, section, text}]
  limitations text,

  -- Aprovação humana
  status text NOT NULL DEFAULT 'sugerido'
    CHECK (status IN ('sugerido','aprovado','rejeitado','revisao_humana')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(prevalidation_id, instrument_code, instrument_version, object_code)
);

CREATE INDEX IF NOT EXISTS idx_indicator_links_institution ON vertice_doc_indicator_links(institution_id);
CREATE INDEX IF NOT EXISTS idx_indicator_links_status ON vertice_doc_indicator_links(status);
CREATE INDEX IF NOT EXISTS idx_indicator_links_instrument ON vertice_doc_indicator_links(instrument_code, object_code);

-- 5. Espelhamento transversal — expansão da correspondencias para multi-instrumento
-- Adicionar colunas à tabela existente sem quebrar nada
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vertice_instrumento_correspondencias' AND column_name='source_instrument') THEN
    ALTER TABLE vertice_instrumento_correspondencias
      ADD COLUMN source_instrument text DEFAULT 'reconhecimento_curso',
      ADD COLUMN source_instrument_version text DEFAULT '2017',
      ADD COLUMN target_instrument text DEFAULT 'novo_instrumento_2026',
      ADD COLUMN target_instrument_version text DEFAULT '2026',
      ADD COLUMN compatibility text DEFAULT 'media' CHECK (compatibility IN ('alta','media','baixa')),
      ADD COLUMN evidence_excerpts jsonb DEFAULT '[]',
      ADD COLUMN prevalidation_id uuid REFERENCES vertice_doc_prevalidation(id);
  END IF;
END $$;

-- 6. Log de auditoria de espelhamento
CREATE TABLE IF NOT EXISTS vertice_mirror_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  action text NOT NULL,                -- prevalidation_requested, prevalidation_completed, link_suggested, link_approved, link_rejected, mirror_created, document_updated, version_replaced
  entity_type text NOT NULL,           -- prevalidation, indicator_link, correspondencia, document
  entity_id uuid NOT NULL,
  actor_id uuid,                       -- Quem executou (null = IA)
  actor_type text NOT NULL DEFAULT 'ai' CHECK (actor_type IN ('ai','human','system')),
  details jsonb DEFAULT '{}',
  ai_model text,
  instrument_version_consulted text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mirror_audit_institution ON vertice_mirror_audit_log(institution_id);
CREATE INDEX IF NOT EXISTS idx_mirror_audit_entity ON vertice_mirror_audit_log(entity_type, entity_id);

-- 7. View consolidada: Biblioteca de Evidências
CREATE OR REPLACE VIEW v_evidence_library AS
SELECT
  d.id AS document_id,
  d.institution_id,
  d.title,
  d.file_name,
  d.category_code,
  d.status AS doc_status,
  d.ai_status,
  d.ai_compliance_score,
  d.version_number,
  d.effective_date,
  d.expiry_date,
  d.storage_path,
  d.course_id,
  d.created_at,
  d.uploaded_by,
  pv.id AS prevalidation_id,
  pv.ai_summary AS pv_summary,
  pv.ai_nature,
  pv.ai_scope_detected,
  COUNT(DISTINCT il.id) FILTER (WHERE il.status = 'aprovado') AS approved_links,
  COUNT(DISTINCT il.id) FILTER (WHERE il.status = 'sugerido') AS pending_links,
  COUNT(DISTINCT il.instrument_code) FILTER (WHERE il.status IN ('aprovado','sugerido')) AS instruments_reached,
  array_agg(DISTINCT il.instrument_code) FILTER (WHERE il.status IN ('aprovado','sugerido')) AS linked_instruments
FROM vertice_documents d
LEFT JOIN vertice_doc_prevalidation pv ON pv.document_id = d.id
LEFT JOIN vertice_doc_indicator_links il ON il.prevalidation_id = pv.id
GROUP BY d.id, d.institution_id, d.title, d.file_name, d.category_code, d.status,
         d.ai_status, d.ai_compliance_score, d.version_number, d.effective_date,
         d.expiry_date, d.storage_path, d.course_id, d.created_at, d.uploaded_by,
         pv.id, pv.ai_summary, pv.ai_nature, pv.ai_scope_detected;

-- 8. View: Saúde do espelhamento por instrumento
CREATE OR REPLACE VIEW v_mirror_health AS
SELECT
  il.institution_id,
  il.instrument_code,
  il.instrument_version,
  COUNT(DISTINCT il.id) AS total_links,
  COUNT(DISTINCT il.id) FILTER (WHERE il.status = 'aprovado') AS approved,
  COUNT(DISTINCT il.id) FILTER (WHERE il.status = 'sugerido') AS pending,
  COUNT(DISTINCT il.id) FILTER (WHERE il.status = 'rejeitado') AS rejected,
  COUNT(DISTINCT il.id) FILTER (WHERE il.compatibility = 'alta') AS high_compat,
  COUNT(DISTINCT il.id) FILTER (WHERE il.compatibility = 'media') AS medium_compat,
  COUNT(DISTINCT il.id) FILTER (WHERE il.compatibility = 'baixa') AS low_compat,
  COUNT(DISTINCT il.object_code) AS objects_covered
FROM vertice_doc_indicator_links il
GROUP BY il.institution_id, il.instrument_code, il.instrument_version;

-- 9. RLS
ALTER TABLE vertice_doc_prevalidation ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_doc_indicator_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_instrument_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_instrument_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_mirror_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies baseadas no padrão existente da Vértice
CREATE POLICY "institution_read_prevalidation" ON vertice_doc_prevalidation
  FOR SELECT USING (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_insert_prevalidation" ON vertice_doc_prevalidation
  FOR INSERT WITH CHECK (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_update_prevalidation" ON vertice_doc_prevalidation
  FOR UPDATE USING (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_read_indicator_links" ON vertice_doc_indicator_links
  FOR SELECT USING (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_insert_indicator_links" ON vertice_doc_indicator_links
  FOR INSERT WITH CHECK (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_update_indicator_links" ON vertice_doc_indicator_links
  FOR UPDATE USING (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_read_catalog" ON vertice_instrument_catalog
  FOR SELECT USING (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_read_objects" ON vertice_instrument_objects
  FOR SELECT USING (
    catalog_id IN (
      SELECT ic.id FROM vertice_instrument_catalog ic
      JOIN vertice_users vu ON vu.institution_id = ic.institution_id
      WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

CREATE POLICY "institution_read_mirror_audit" ON vertice_mirror_audit_log
  FOR SELECT USING (
    institution_id IN (
      SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
  );

-- Service role pode inserir auditoria
CREATE POLICY "service_insert_mirror_audit" ON vertice_mirror_audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_insert_catalog" ON vertice_instrument_catalog
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_insert_objects" ON vertice_instrument_objects
  FOR INSERT WITH CHECK (true);

-- 10. Trigger de updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_prevalidation') THEN
    CREATE TRIGGER set_updated_at_prevalidation BEFORE UPDATE ON vertice_doc_prevalidation
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_indicator_links') THEN
    CREATE TRIGGER set_updated_at_indicator_links BEFORE UPDATE ON vertice_doc_indicator_links
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- 11. Registrar módulos no catálogo
INSERT INTO vertice_module_catalog (code, label, tier, package, tab_codes, depends_on, sort_order)
VALUES ('REG_PREVALIDACAO', 'Pré-validação Inteligente', 'superior', 'regulacao360', ARRAY['repositorio','documentos'], ARRAY['DOCS_IA'], 45)
ON CONFLICT (code) DO NOTHING;
