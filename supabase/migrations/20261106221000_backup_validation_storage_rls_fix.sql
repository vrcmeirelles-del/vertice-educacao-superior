-- Safe policy correction for proof-staging upload, preserving strict institution scope.
DROP POLICY IF EXISTS vx_structure_check_storage_insert ON storage.objects;
CREATE POLICY vx_structure_check_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(
   bucket_id='vertice-validacoes-ies'
   AND array_length(storage.foldername(name),1)=2
   AND (storage.foldername(name))[1] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   AND storage.filename(name) IN ('00_manifesto_conciliacao.json','02_642_tabelas.csv')
   AND vertice_private.has_role(((storage.foldername(name))[1])::uuid,ARRAY['gestor'])
   AND EXISTS(SELECT 1 FROM public.vertice_backup_structure_checks c
      WHERE c.id=((storage.foldername(name))[2])::uuid
      AND c.institution_id=((storage.foldername(name))[1])::uuid
      AND c.created_by=(SELECT auth.uid())
      AND c.stage='aguardando_arquivos')
 );
