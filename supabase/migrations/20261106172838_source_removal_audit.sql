-- Retirada autorizada de arquivos de preparação e links; histórico não destrutivo.
-- Arquivos com análise vinculada não podem ser excluídos.
CREATE TABLE IF NOT EXISTS public.vertice_source_removal_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 record_type text NOT NULL CHECK(record_type IN ('arquivo','link')),
 record_id uuid NOT NULL,
 name text NOT NULL,
 actor uuid NOT NULL,
 removed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vertice_source_removal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_source_removal_events FROM anon,authenticated;
GRANT SELECT ON public.vertice_source_removal_events TO authenticated;
CREATE POLICY vx_source_removal_read ON public.vertice_source_removal_events
 FOR SELECT TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor']));

CREATE OR REPLACE FUNCTION vertice_private.source_removal_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT vertice_private.has_role(old.institution_id,ARRAY['gestor']) THEN
  RAISE EXCEPTION 'access_denied' USING errcode='42501';
 END IF;
 IF TG_TABLE_NAME='vertice_source_uploads' AND EXISTS(
   SELECT 1 FROM public.vertice_source_analyses a WHERE a.upload_id=old.id
 ) THEN
  RAISE EXCEPTION 'analysis_exists_do_not_remove_source' USING errcode='23514';
 END IF;
 RETURN old;
END $$;
DROP TRIGGER IF EXISTS vx_source_link_remove_guard ON public.vertice_source_links;
CREATE TRIGGER vx_source_link_remove_guard BEFORE DELETE ON public.vertice_source_links
 FOR EACH ROW EXECUTE FUNCTION vertice_private.source_removal_guard();
DROP TRIGGER IF EXISTS vx_source_upload_remove_guard ON public.vertice_source_uploads;
CREATE TRIGGER vx_source_upload_remove_guard BEFORE DELETE ON public.vertice_source_uploads
 FOR EACH ROW EXECUTE FUNCTION vertice_private.source_removal_guard();

CREATE OR REPLACE FUNCTION vertice_private.source_removal_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.vertice_source_removal_events(institution_id,record_type,record_id,name,actor)
 VALUES(old.institution_id,
  CASE WHEN TG_TABLE_NAME='vertice_source_uploads' THEN 'arquivo' ELSE 'link' END,
  old.id,
  CASE WHEN TG_TABLE_NAME='vertice_source_uploads' THEN old.original_name ELSE old.source_name END,
  auth.uid());
 RETURN null;
END $$;
REVOKE ALL ON FUNCTION vertice_private.source_removal_audit() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS vx_source_link_remove_audit ON public.vertice_source_links;
CREATE TRIGGER vx_source_link_remove_audit AFTER DELETE ON public.vertice_source_links
 FOR EACH ROW EXECUTE FUNCTION vertice_private.source_removal_audit();
DROP TRIGGER IF EXISTS vx_source_upload_remove_audit ON public.vertice_source_uploads;
CREATE TRIGGER vx_source_upload_remove_audit AFTER DELETE ON public.vertice_source_uploads
 FOR EACH ROW EXECUTE FUNCTION vertice_private.source_removal_audit();

GRANT DELETE ON public.vertice_source_links,public.vertice_source_uploads TO authenticated;
CREATE POLICY vx_source_link_delete ON public.vertice_source_links
 FOR DELETE TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor']));
CREATE POLICY vx_source_upload_delete ON public.vertice_source_uploads
 FOR DELETE TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor'])
 AND NOT EXISTS(SELECT 1 FROM public.vertice_source_analyses a WHERE a.upload_id=id));
CREATE POLICY vx_source_storage_delete ON storage.objects
 FOR DELETE TO authenticated USING(
 bucket_id='vertice-fontes-ies'
 AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND vertice_private.has_role(((storage.foldername(name))[1])::uuid,ARRAY['gestor'])
 AND EXISTS(
   SELECT 1 FROM public.vertice_source_uploads u
   WHERE u.storage_path=name
     AND u.institution_id=((storage.foldername(name))[1])::uuid
     AND NOT EXISTS(SELECT 1 FROM public.vertice_source_analyses a WHERE a.upload_id=u.id)
 )
);