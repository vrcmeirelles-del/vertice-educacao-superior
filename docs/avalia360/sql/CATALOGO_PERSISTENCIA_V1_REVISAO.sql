-- VÉRTICE AVALIA 360° — PROPOSTA DE PERSISTÊNCIA V1 (NÃO APLICAR EM PRODUÇÃO)
-- Este arquivo de revisão NÃO é uma migration operacional.
-- Confrontado em leitura com Supabase em 2026-11-19:
-- matriz curricular existente em vertice_app.curriculum_builds,
-- vertice_app.curriculum_competencies e vertice_app.curriculum_discipline_links.
-- Guardar em schema não exposto; permitir acesso SOMENTE via serviço de backend
-- com autenticação/autorização verificadas e privilégio mínimo. Validar em staging.
BEGIN;
CREATE SCHEMA IF NOT EXISTS vertice_avalia;
REVOKE ALL ON SCHEMA vertice_avalia FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA vertice_avalia TO service_role;

-- Snapshot imutável da matriz curricular referenciada.
CREATE TABLE vertice_avalia.catalog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_app.institutions(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES vertice_app.courses(id) ON DELETE RESTRICT,
  build_id uuid NOT NULL REFERENCES vertice_app.curriculum_builds(id) ON DELETE RESTRICT,
  build_version integer NOT NULL CHECK (build_version > 0),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','archived')),
  source_reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, course_id, build_id, version),
  UNIQUE (id, institution_id, course_id)
);

-- Confirma escopo e versão com a fonte oficial. Não autoriza por si só o solicitante.
CREATE OR REPLACE FUNCTION vertice_avalia.check_catalog_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b record; c record;
BEGIN
  SELECT institution_id,course_id,version,status INTO b
    FROM vertice_app.curriculum_builds WHERE id=NEW.build_id;
  IF NOT FOUND OR b.institution_id IS DISTINCT FROM NEW.institution_id
     OR b.course_id IS DISTINCT FROM NEW.course_id
     OR b.version IS DISTINCT FROM NEW.build_version THEN
    RAISE EXCEPTION 'Fonte curricular incompatível ou alterada' USING ERRCODE='23514';
  END IF;
  SELECT institution_id INTO c FROM vertice_app.courses WHERE id=NEW.course_id;
  IF NOT FOUND OR c.institution_id IS DISTINCT FROM NEW.institution_id THEN
    RAISE EXCEPTION 'Curso não pertence à instituição informada' USING ERRCODE='23514';
  END IF;
  IF NEW.status='validated' AND b.status<>'published' THEN
    RAISE EXCEPTION 'Catálogo validado requer matriz curricular publicada' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (
    OLD.institution_id IS DISTINCT FROM NEW.institution_id OR
    OLD.course_id IS DISTINCT FROM NEW.course_id OR
    OLD.build_id IS DISTINCT FROM NEW.build_id OR
    OLD.build_version IS DISTINCT FROM NEW.build_version OR
    OLD.version IS DISTINCT FROM NEW.version
  ) THEN
    RAISE EXCEPTION 'Escopo e versão curricular são imutáveis' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER avalia_catalog_source_guard
BEFORE INSERT OR UPDATE ON vertice_avalia.catalog_versions
FOR EACH ROW EXECUTE FUNCTION vertice_avalia.check_catalog_source();

-- Referência duplicada (catalog_id, competency_id) constitui âncora segura
-- de vínculos e relações dentro de uma versão de catálogo.
CREATE TABLE vertice_avalia.competency_placements (
  catalog_id uuid NOT NULL REFERENCES vertice_avalia.catalog_versions(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES vertice_app.curriculum_competencies(id) ON DELETE RESTRICT,
  period smallint NOT NULL CHECK (period BETWEEN 1 AND 30),
  validation_state text NOT NULL DEFAULT 'proposed'
    CHECK (validation_state IN ('proposed','validated','rejected')),
  source_reference text,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  PRIMARY KEY(catalog_id,competency_id),
  CHECK ((validation_state='validated') = (validated_by IS NOT NULL AND validated_at IS NOT NULL))
);
CREATE TABLE vertice_avalia.topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES vertice_avalia.catalog_versions(id) ON DELETE CASCADE,
  discipline_code text NOT NULL CHECK (length(btrim(discipline_code)) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 250),
  period smallint NOT NULL CHECK (period BETWEEN 1 AND 30),
  parent_id uuid,
  validation_state text NOT NULL DEFAULT 'proposed'
    CHECK (validation_state IN ('proposed','validated','rejected')),
  source_reference text,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  PRIMARY KEY(id),
  UNIQUE(catalog_id,id),
  FOREIGN KEY(catalog_id,parent_id) REFERENCES vertice_avalia.topics(catalog_id,id) DEFERRABLE,
  CHECK(parent_id IS NULL OR parent_id<>id),
  CHECK ((validation_state='validated') = (validated_by IS NOT NULL AND validated_at IS NOT NULL))
);
CREATE TABLE vertice_avalia.competency_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES vertice_avalia.catalog_versions(id) ON DELETE CASCADE,
  from_competency_id uuid NOT NULL,
  to_competency_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('prerequisito','aprofundamento','interdisciplinar')),
  validation_state text NOT NULL DEFAULT 'proposed'
    CHECK (validation_state IN ('proposed','validated','rejected')),
  source_reference text,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  FOREIGN KEY(catalog_id,from_competency_id)
    REFERENCES vertice_avalia.competency_placements(catalog_id,competency_id) ON DELETE CASCADE,
  FOREIGN KEY(catalog_id,to_competency_id)
    REFERENCES vertice_avalia.competency_placements(catalog_id,competency_id) ON DELETE CASCADE,
  CHECK (from_competency_id<>to_competency_id),
  CHECK ((validation_state='validated') = (validated_by IS NOT NULL AND validated_at IS NOT NULL)),
  UNIQUE(catalog_id,from_competency_id,to_competency_id,kind)
);

-- Chave composta garante que placement pertença ao build da mesma versão.
CREATE OR REPLACE FUNCTION vertice_avalia.check_competency_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vertice_avalia.catalog_versions v
    JOIN vertice_app.curriculum_competencies c ON c.build_id=v.build_id
    WHERE v.id=NEW.catalog_id AND c.id=NEW.competency_id
  ) THEN
    RAISE EXCEPTION 'Competência pertence a outra matriz curricular' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER avalia_placement_scope_guard
BEFORE INSERT OR UPDATE ON vertice_avalia.competency_placements
FOR EACH ROW EXECUTE FUNCTION vertice_avalia.check_competency_source();

-- O estado validated fica reservado para o serviço de homologação; o banco
-- não deve inferir validação humana a partir de metadados preenchidos.
-- Validar DAG de pré-requisitos e ciclos de temas na aplicação ANTES de aprovar catálogo.
CREATE INDEX avalia_catalog_by_course ON vertice_avalia.catalog_versions(institution_id,course_id,status,version DESC);
CREATE INDEX avalia_topics_by_catalog ON vertice_avalia.topics(catalog_id,discipline_code,period);
CREATE INDEX avalia_edges_by_catalog ON vertice_avalia.competency_edges(catalog_id,kind);
ALTER TABLE vertice_avalia.catalog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_avalia.competency_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_avalia.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_avalia.competency_edges ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy de usuário final nesta proposta: default deny.
REVOKE ALL ON ALL TABLES IN SCHEMA vertice_avalia FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vertice_avalia FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA vertice_avalia TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vertice_avalia TO service_role;
COMMIT;

-- PRÉ-REQUISITOS PARA HOMOLOGAÇÃO:
-- 1) Testes com role authenticated, anon e perfis autorizados via backend.
-- 2) Confirmar que vertice_avalia NÃO integra exposed schemas da Data API.
-- 3) Conferir permissões dos esquemas fonte para o papel de serviço.
-- 4) Validar bloqueio de competência de outro build, tópico de outro catálogo,
--    versão divergente, alterações de escopo e FK entre instituições.
-- 5) Sem aplicar este SQL em produção antes do aceite técnico.
