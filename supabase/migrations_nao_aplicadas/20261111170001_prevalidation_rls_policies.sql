-- RLS Policies para pré-validação e espelhamento
-- Executar manualmente no SQL Editor do Supabase

CREATE POLICY "institution_read_prevalidation" ON vertice_doc_prevalidation FOR SELECT USING (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_insert_prevalidation" ON vertice_doc_prevalidation FOR INSERT WITH CHECK (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_update_prevalidation" ON vertice_doc_prevalidation FOR UPDATE USING (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_read_indicator_links" ON vertice_doc_indicator_links FOR SELECT USING (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_insert_indicator_links" ON vertice_doc_indicator_links FOR INSERT WITH CHECK (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_update_indicator_links" ON vertice_doc_indicator_links FOR UPDATE USING (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_read_catalog" ON vertice_instrument_catalog FOR SELECT USING (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_read_objects" ON vertice_instrument_objects FOR SELECT USING (
  catalog_id IN (
    SELECT ic.id FROM vertice_instrument_catalog ic
    JOIN vertice_users vu ON vu.institution_id = ic.institution_id WHERE vu.user_id = auth.uid()
  ) OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "institution_read_mirror_audit" ON vertice_mirror_audit_log FOR SELECT USING (
  institution_id IN (SELECT vu.institution_id FROM vertice_users vu WHERE vu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM vertice_users vu WHERE vu.user_id = auth.uid() AND vu.role = 'master')
);
CREATE POLICY "service_insert_mirror_audit" ON vertice_mirror_audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "service_insert_catalog" ON vertice_instrument_catalog FOR INSERT WITH CHECK (true);
CREATE POLICY "service_insert_objects" ON vertice_instrument_objects FOR INSERT WITH CHECK (true);

INSERT INTO vertice_module_catalog (code, label, tier, package, tab_codes, depends_on, sort_order)
VALUES ('REG_PREVALIDACAO', 'Pré-validação Inteligente', 'superior', 'regulacao360', ARRAY['repositorio','documentos'], ARRAY['DOCS_IA'], 45)
ON CONFLICT (code) DO NOTHING;
