-- Vértice: separate, tenant-scoped quarantine/staging for academic backups.
-- NO SQL Server restoration, archive decompression or automatic BI import.
-- Only authorised managers with MFA can read or create backup records.

CREATE TABLE IF NOT EXISTS public.vertice_academic_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
  source_system text NOT NULL CHECK(length(btrim(source_system)) BETWEEN 2 AND 120),
  backup_kind text NOT NULL CHECK(backup_kind IN ('rar','zip','bak')),
  signature_label text NOT NULL CHECK(signature_label IN ('RAR4','RAR5','ZIP','BAK_NAO_VERIFICADO')),
  original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 250 AND original_name !~ '[/\\]'),
  bytes bigint NOT NULL CHECK(bytes BETWEEN 1 AND 52428800),
  file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text UNIQUE NOT NULL,
  source_url text CHECK(source_url IS NULL OR (length(source_url)<=1800 AND source_url ~* '^https://')),
  reference_period text CHECK(reference_period IS NULL OR length(reference_period)<=35),
  observed_on date,
  description text CHECK(description IS NULL OR length(description)<=1500),
  stage text NOT NULL DEFAULT 'aguardando_arquivo'
    CHECK(stage IN ('aguardando_arquivo','recebido','falhou')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  CONSTRAINT vx_backup_kind_signature CHECK(
    (backup_kind='rar' AND signature_label IN ('RAR4','RAR5'))
    OR (backup_kind='zip' AND signature_label='ZIP')
    OR (backup_kind='bak' AND signature_label='BAK_NAO_VERIFICADO')
  ),
  CONSTRAINT vx_backup_name_extension CHECK(
     lower(right(original_name,length(backup_kind)+1))='.'||backup_kind
  )
);
CREATE INDEX IF NOT EXISTS vx_academic_backups_inst_created
ON public.vertice_academic_backups(institution_id,created_at DESC);
ALTER TABLE public.vertice_academic_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_academic_backups FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE(stage) ON public.vertice_academic_backups TO authenticated;

CREATE POLICY vx_academic_backup_read ON public.vertice_academic_backups
 FOR SELECT TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor']));
CREATE POLICY vx_academic_backup_insert ON public.vertice_academic_backups
 FOR INSERT TO authenticated WITH CHECK(
  vertice_private.has_role(institution_id,ARRAY['gestor'])
  AND created_by=(SELECT auth.uid())
  AND stage='aguardando_arquivo'
  AND storage_path=institution_id::text||'/'||id::text||'/'||original_name
 );
CREATE POLICY vx_academic_backup_update ON public.vertice_academic_backups
 FOR UPDATE TO authenticated
 USING(vertice_private.has_role(institution_id,ARRAY['gestor']) AND created_by=(SELECT auth.uid()))
 WITH CHECK(vertice_private.has_role(institution_id,ARRAY['gestor']) AND created_by=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION vertice_private.academic_backup_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF new.created_by IS DISTINCT FROM auth.uid() OR new.storage_path IS DISTINCT FROM
       new.institution_id::text||'/'||new.id::text||'/'||new.original_name
      THEN RAISE EXCEPTION 'invalid_backup_owner_or_path' USING errcode='42501';END IF;
 ELSE
   IF to_jsonb(new)-(ARRAY['stage','received_at']::text[]) IS DISTINCT FROM
      to_jsonb(old)-(ARRAY['stage','received_at']::text[]) THEN
      RAISE EXCEPTION 'immutable_backup_metadata' USING errcode='42501';
   END IF;
   IF old.stage='recebido' OR new.stage NOT IN ('recebido','falhou') THEN
      RAISE EXCEPTION 'invalid_backup_transition' USING errcode='23514';
   END IF;
   IF new.stage='recebido' THEN
      IF NOT EXISTS(
       SELECT 1 FROM storage.objects obj
       WHERE obj.bucket_id='vertice-backups-ies'
       AND obj.name=new.storage_path
      ) THEN RAISE EXCEPTION 'backup_file_missing' USING errcode='23514';END IF;
      new.received_at=now();
   END IF;
 END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS vx_academic_backup_guard ON public.vertice_academic_backups;
CREATE TRIGGER vx_academic_backup_guard BEFORE INSERT OR UPDATE
 ON public.vertice_academic_backups FOR EACH ROW
 EXECUTE FUNCTION vertice_private.academic_backup_guard();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES(
 'vertice-backups-ies','vertice-backups-ies',false,52428800,
 ARRAY['application/vnd.rar','application/zip','application/octet-stream']
) ON CONFLICT (id) DO NOTHING;
-- No UPDATE or DELETE policies: original uploaded backups are immutable evidence.
CREATE POLICY vx_academic_backup_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(
 bucket_id='vertice-backups-ies'
 AND (storage.foldername(name))[1] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 AND vertice_private.has_role(((storage.foldername(name))[1])::uuid,ARRAY['gestor'])
 AND EXISTS(
   SELECT 1 FROM public.vertice_academic_backups b
   WHERE b.storage_path=name AND b.stage='aguardando_arquivo'
     AND b.institution_id=((storage.foldername(name))[1])::uuid
     AND b.created_by=auth.uid()
 )
);
CREATE POLICY vx_academic_backup_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(
 bucket_id='vertice-backups-ies'
 AND (storage.foldername(name))[1] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 AND vertice_private.has_role(((storage.foldername(name))[1])::uuid,ARRAY['gestor'])
);

CREATE TABLE IF NOT EXISTS public.vertice_backup_restore_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 backup_id uuid NOT NULL UNIQUE REFERENCES public.vertice_academic_backups(id),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 request_note text CHECK(request_note IS NULL OR length(request_note)<=800),
 state text NOT NULL DEFAULT 'solicitada'
   CHECK(state='solicitada')
);
ALTER TABLE public.vertice_backup_restore_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_backup_restore_requests FROM anon,authenticated;
GRANT SELECT,INSERT ON public.vertice_backup_restore_requests TO authenticated;
CREATE POLICY vx_backup_requests_read ON public.vertice_backup_restore_requests
 FOR SELECT TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor']));
CREATE POLICY vx_backup_requests_insert ON public.vertice_backup_restore_requests
 FOR INSERT TO authenticated WITH CHECK(
  vertice_private.has_role(institution_id,ARRAY['gestor']) AND requested_by=(SELECT auth.uid())
  AND state='solicitada'
  AND EXISTS(
    SELECT 1 FROM public.vertice_academic_backups b
    WHERE b.id=backup_id AND b.institution_id=institution_id AND b.stage='recebido'
  )
);
-- There is intentionally no worker, scheduled restore or automatic BI publication.
