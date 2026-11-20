-- Vértice Avalia 360° — ESPELHO ESTRUTURAL LIMITADO PARA STAGING
-- Tabelas/colunas e FKs conferidas no banco de produção em 2026-11-19.
-- NÃO é restauração integral da plataforma nem sua política curricular de escrita.
-- Sem dados copiados; RLS deny-all para usuários finais (ambiente isolado).
BEGIN;
CREATE SCHEMA IF NOT EXISTS vertice_app;
REVOKE ALL ON SCHEMA vertice_app FROM PUBLIC,anon,authenticated;
CREATE TABLE vertice_app.institutions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL, name text NOT NULL, cnpj text,
 timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
 retention_alerts_days integer, retention_records_days integer, retention_audit_days integer,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'trial',trial_ends_at timestamptz,
 activated_at timestamptz,suspended_at timestamptz,plan_code text NOT NULL DEFAULT 'piloto'
);
CREATE TABLE vertice_app.courses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES vertice_app.institutions(id) ON DELETE CASCADE,
 code text NOT NULL,name text NOT NULL,campus text,active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(institution_id,code)
);
CREATE TABLE vertice_app.curriculum_builds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES vertice_app.institutions(id),
 course_id uuid NOT NULL REFERENCES vertice_app.courses(id),
 version integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 graduate_profile text,dcn_reference text,created_by uuid,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
 graduate_profile_source text,dcn_document_url text
);
CREATE TABLE vertice_app.curriculum_competencies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 build_id uuid NOT NULL REFERENCES vertice_app.curriculum_builds(id) ON DELETE CASCADE,
 code text NOT NULL,title text NOT NULL,description text,sort_order integer DEFAULT 0
);
CREATE TABLE vertice_app.curriculum_discipline_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 competency_id uuid NOT NULL REFERENCES vertice_app.curriculum_competencies(id) ON DELETE CASCADE,
 discipline_name text NOT NULL,category text NOT NULL,
 source text DEFAULT 'manual',sort_order integer DEFAULT 0
);
ALTER TABLE vertice_app.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_app.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_app.curriculum_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_app.curriculum_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_app.curriculum_discipline_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA vertice_app FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA vertice_app TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA vertice_app TO service_role;
COMMIT;
