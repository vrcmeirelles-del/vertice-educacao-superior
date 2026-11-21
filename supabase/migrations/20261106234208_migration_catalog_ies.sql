-- UNI_GIZ (UNICALDAS) — trusted catalog of SOURCE NAMES ONLY, never academic rows.
-- This staging stays separate from approved BI indicators and must not imply restore success.
CREATE TABLE IF NOT EXISTS public.vertice_migration_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
  source_upload_id uuid NOT NULL REFERENCES public.vertice_source_uploads(id),
  backup_id uuid NOT NULL REFERENCES public.vertice_academic_backups(id),
  system_name text NOT NULL CHECK(system_name IN ('UNI_GIZ')),
  source_file text NOT NULL CHECK(source_file='tabelas_UNI_GIZ.csv'),
  source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
  expected_tables integer NOT NULL CHECK(expected_tables BETWEEN 1 AND 100000),
  recorded_tables integer NOT NULL CHECK(recorded_tables BETWEEN 1 AND 100000),
  catalog_state text NOT NULL DEFAULT 'inventario_nao_restaurado'
    CHECK(catalog_state='inventario_nao_restaurado'),
  source_scope text NOT NULL DEFAULT 'somente_nomes_tabelas'
    CHECK(source_scope='somente_nomes_tabelas'),
  registered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vx_migcat_one_per_source UNIQUE (institution_id, source_sha256),
  CONSTRAINT vx_migcat_same_count CHECK(recorded_tables=expected_tables),
  CONSTRAINT vx_migcat_tenant_ref UNIQUE(id,institution_id)
);
ALTER TABLE public.vertice_migration_catalogs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_migration_catalogs FROM anon,authenticated;
GRANT SELECT ON public.vertice_migration_catalogs TO authenticated;
CREATE POLICY vx_migcat_select ON public.vertice_migration_catalogs
  FOR SELECT TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor']));

CREATE TABLE IF NOT EXISTS public.vertice_migration_catalog_tables (
  catalog_id uuid NOT NULL,
  institution_id uuid NOT NULL,
  table_schema text NOT NULL CHECK(length(table_schema) BETWEEN 1 AND 64 AND table_schema ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
  table_name text NOT NULL CHECK(length(table_name) BETWEEN 1 AND 128 AND table_name ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
  area_sugerida text CHECK(area_sugerida IS NULL OR length(area_sugerida)<=100),
  prioridade_sugerida smallint CHECK(prioridade_sugerida BETWEEN 1 AND 3),
  observacao text CHECK(observacao IS NULL OR length(observacao)<=350),
  confirmation_state text NOT NULL DEFAULT 'nao_verificado'
    CHECK(confirmation_state='nao_verificado'),
  row_count bigint CHECK(row_count IS NULL),
  included_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(catalog_id,table_schema,table_name),
  FOREIGN KEY(catalog_id,institution_id)
    REFERENCES public.vertice_migration_catalogs(id,institution_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS vx_migcat_tables_area
 ON public.vertice_migration_catalog_tables(catalog_id,area_sugerida,prioridade_sugerida);
ALTER TABLE public.vertice_migration_catalog_tables ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_migration_catalog_tables FROM anon,authenticated;
GRANT SELECT ON public.vertice_migration_catalog_tables TO authenticated;
CREATE POLICY vx_migcat_tables_select ON public.vertice_migration_catalog_tables
 FOR SELECT TO authenticated USING(vertice_private.has_role(institution_id,ARRAY['gestor']));

-- Defensive authorization: a trusted ingestion must never join a UNITOP source
-- to a UNICALDAS backup, even when running with migration privileges.
CREATE OR REPLACE FUNCTION vertice_private.migration_catalog_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM public.vertice_source_uploads u
    WHERE u.id=new.source_upload_id
      AND u.institution_id=new.institution_id
      AND u.original_name=new.source_file
      AND u.upload_status='recebido'
 ) THEN RAISE EXCEPTION 'source_upload_institution_mismatch' USING errcode='23514'; END IF;
 IF NOT EXISTS (
    SELECT 1 FROM public.vertice_academic_backups b
    WHERE b.id=new.backup_id AND b.institution_id=new.institution_id
      AND b.backup_kind='bak' AND b.stage='recebido'
 ) THEN RAISE EXCEPTION 'backup_institution_mismatch' USING errcode='23514'; END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS vx_migration_catalog_guard ON public.vertice_migration_catalogs;
CREATE TRIGGER vx_migration_catalog_guard BEFORE INSERT OR UPDATE
 ON public.vertice_migration_catalogs FOR EACH ROW
 EXECUTE FUNCTION vertice_private.migration_catalog_guard();

-- Catalog is immutable, only back-office privileged migrations add entries;
-- existing source, vault, academic/BI and student tables are not modified.
