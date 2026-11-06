-- Stage 2 after UNI_GIZ is restored in an external, isolated SQL Server.
-- Structure-only evidence. NO student record processing, BI import, or automatic approval.
-- Independent review remains mandatory.
CREATE TABLE IF NOT EXISTS public.vertice_backup_structure_checks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 backup_id uuid NOT NULL REFERENCES public.vertice_academic_backups(id),
 expected_tables integer NOT NULL DEFAULT 642 CHECK(expected_tables=642),
 found_tables integer NOT NULL CHECK(found_tables BETWEEN 0 AND 642),
 missing_tables integer NOT NULL CHECK(missing_tables BETWEEN 0 AND 642),
 extra_tables integer NOT NULL CHECK(extra_tables BETWEEN 0 AND 100000),
 catalog_sha256 text NOT NULL CHECK(catalog_sha256='af1c81ab7dcdce0f8a164e6778386715c9065673cbd99755529d156491622b1f'),
 query_sha256 text NOT NULL CHECK(query_sha256='1e4da89de373d8e642e7130a97bdb9b524e0d71734fd4e02864e9e6bb39b9318'),
 manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 tables_csv_sha256 text NOT NULL CHECK(tables_csv_sha256 ~ '^[a-f0-9]{64}$'),
 manifest_bytes integer NOT NULL CHECK(manifest_bytes BETWEEN 100 AND 131072),
 tables_csv_bytes integer NOT NULL CHECK(tables_csv_bytes BETWEEN 200 AND 4194304),
 origin_database text NOT NULL DEFAULT 'UNI_GIZ_HOMOLOGACAO' CHECK(origin_database='UNI_GIZ_HOMOLOGACAO'),
 origin_readonly boolean NOT NULL CHECK(origin_readonly),
 stage text NOT NULL DEFAULT 'aguardando_arquivos' CHECK(stage IN ('aguardando_arquivos','evidencias_recebidas')),
 review_state text NOT NULL DEFAULT 'pendente_analise_tecnica' CHECK(review_state='pendente_analise_tecnica'),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 received_at timestamptz,
 CONSTRAINT vx_backup_check_totals CHECK(found_tables+missing_tables=expected_tables),
 CONSTRAINT vx_backup_check_unique_report UNIQUE(institution_id,backup_id,manifest_sha256)
);
CREATE INDEX IF NOT EXISTS vx_structure_checks_inst_date ON public.vertice_backup_structure_checks(institution_id,created_at DESC);
ALTER TABLE public.vertice_backup_structure_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_backup_structure_checks FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE(stage,received_at) ON public.vertice_backup_structure_checks TO authenticated;
CREATE POLICY vx_structure_checks_read ON public.vertice_backup_structure_checks
 FOR SELECT TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor']));
CREATE POLICY vx_structure_checks_insert ON public.vertice_backup_structure_checks
 FOR INSERT TO authenticated WITH CHECK(
 vertice_private.has_role(institution_id,ARRAY['gestor'])
 AND created_by=(SELECT auth.uid())
 AND stage='aguardando_arquivos' AND review_state='pendente_analise_tecnica'
 AND EXISTS(SELECT 1 FROM public.vertice_academic_backups b
    WHERE b.id=backup_id AND b.institution_id=vertice_backup_structure_checks.institution_id
      AND b.stage='recebido')
);
CREATE POLICY vx_structure_checks_update ON public.vertice_backup_structure_checks
 FOR UPDATE TO authenticated
 USING(vertice_private.has_role(institution_id,ARRAY['gestor']) AND created_by=(SELECT auth.uid()))
 WITH CHECK(vertice_private.has_role(institution_id,ARRAY['gestor']) AND created_by=(SELECT auth.uid()));

-- Repair the already-existing request policy: the original unqualified
-- institution_id in its nested query resolved to b.institution_id, allowing
-- a reference to a backup from a different institution.
DROP POLICY IF EXISTS vx_backup_requests_insert ON public.vertice_backup_restore_requests;
CREATE POLICY vx_backup_requests_insert ON public.vertice_backup_restore_requests
 FOR INSERT TO authenticated WITH CHECK(
   vertice_private.has_role(institution_id,ARRAY['gestor'])
   AND requested_by=(SELECT auth.uid()) AND state='solicitada'
   AND EXISTS (SELECT 1 FROM public.vertice_academic_backups b
      WHERE b.id=backup_id
        AND b.institution_id=vertice_backup_restore_requests.institution_id
        AND b.stage='recebido')
 );

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('vertice-validacoes-ies','vertice-validacoes-ies',false,4194304,
 ARRAY['application/json','text/csv','text/plain'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY vx_structure_check_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(
   bucket_id='vertice-validacoes-ies'
   AND (storage.foldername(name))[1] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   AND (storage.foldername(name))[2] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   AND storage.filename(name) IN ('00_manifesto_conciliacao.json','02_642_tabelas.csv')
   AND vertice_private.has_role(((storage.foldername(name))[1])::uuid,ARRAY['gestor'])
   AND EXISTS(SELECT 1 FROM public.vertice_backup_structure_checks c
      WHERE c.id=((storage.foldername(name))[2])::uuid
      AND c.institution_id=((storage.foldername(name))[1])::uuid
      AND c.created_by=(SELECT auth.uid())
      AND c.stage='aguardando_arquivos')
 );
CREATE POLICY vx_structure_check_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(
   bucket_id='vertice-validacoes-ies'
   AND (storage.foldername(name))[1] ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   AND vertice_private.has_role(((storage.foldername(name))[1])::uuid,ARRAY['gestor'])
 );

CREATE OR REPLACE FUNCTION vertice_private.backup_structure_check_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 prefix text;
BEGIN
 IF TG_OP='INSERT' THEN
   IF new.created_by IS DISTINCT FROM auth.uid() THEN
     RAISE EXCEPTION 'actor_mismatch' USING errcode='42501';
   END IF;
 ELSE
   IF to_jsonb(new)-(ARRAY['stage','received_at']::text[]) IS DISTINCT FROM
      to_jsonb(old)-(ARRAY['stage','received_at']::text[]) THEN
     RAISE EXCEPTION 'immutable_validation_report' USING errcode='42501';
   END IF;
   IF old.stage <> 'aguardando_arquivos' OR new.stage <> 'evidencias_recebidas' THEN
     RAISE EXCEPTION 'invalid_validation_transition' USING errcode='23514';
   END IF;
   prefix=new.institution_id::text||'/'||new.id::text||'/';
   IF NOT EXISTS(SELECT 1 FROM storage.objects o
        WHERE o.bucket_id='vertice-validacoes-ies'
          AND o.name=prefix||'00_manifesto_conciliacao.json')
      OR NOT EXISTS(SELECT 1 FROM storage.objects o
        WHERE o.bucket_id='vertice-validacoes-ies'
          AND o.name=prefix||'02_642_tabelas.csv') THEN
       RAISE EXCEPTION 'validation_evidence_missing' USING errcode='23514';
   END IF;
   new.received_at=now();
 END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS vx_structure_check_guard ON public.vertice_backup_structure_checks;
CREATE TRIGGER vx_structure_check_guard BEFORE INSERT OR UPDATE
 ON public.vertice_backup_structure_checks FOR EACH ROW
 EXECUTE FUNCTION vertice_private.backup_structure_check_guard();
-- No deletion, no promotion to approved, and no student rows.
