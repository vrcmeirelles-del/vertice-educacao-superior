-- Bucket de Storage para evidências de extensão
-- Executar no SQL Editor do Supabase

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'extension-evidence',
  'extension-evidence',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf','image/jpeg','image/png','image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/csv','text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: usuários autenticados da instituição
CREATE POLICY "evidence_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'extension-evidence'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM vertice_institutions
      WHERE id IN (
        SELECT institution_id FROM vertice_impacto_roles
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

-- Leitura: mesma instituição
CREATE POLICY "evidence_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'extension-evidence'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM vertice_institutions
      WHERE id IN (
        SELECT institution_id FROM vertice_impacto_roles
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

-- Delete: apenas master/coordenador_extensao/pro_reitoria
CREATE POLICY "evidence_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'extension-evidence'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM vertice_institutions
      WHERE id IN (
        SELECT institution_id FROM vertice_impacto_roles
        WHERE user_id = auth.uid() AND active = true
        AND role IN ('master','coordenador_extensao','pro_reitoria')
      )
    )
  );
