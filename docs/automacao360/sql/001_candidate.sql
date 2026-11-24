-- CANDIDATA: executar apenas em PostgreSQL descartável. Não aplicar em produção.
-- Integração de autorização e vínculo curso/IES depende de revisão do contrato real.
BEGIN;
CREATE SCHEMA vertice_automation_candidate;
REVOKE ALL ON SCHEMA vertice_automation_candidate FROM PUBLIC, anon, authenticated;
CREATE TABLE vertice_automation_candidate.config_revision (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 course_id uuid REFERENCES public.vertice_courses(id),
 revision integer NOT NULL CHECK(revision>0),
 enabled boolean NOT NULL DEFAULT false,
 rule_ids text[] NOT NULL,
 configured_by uuid NOT NULL,
 approved_by uuid,
 configured_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz,
 CHECK ((approved_by IS NULL AND approved_at IS NULL) OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approved_by<>configured_by AND approved_at>=configured_at)),
 UNIQUE NULLS NOT DISTINCT(institution_id,course_id,revision)
);
CREATE TABLE vertice_automation_candidate.shadow_run (
 run_id uuid PRIMARY KEY,
 config_id bigint NOT NULL REFERENCES vertice_automation_candidate.config_revision(id),
 as_of timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('evaluated','partial')),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 source_count integer NOT NULL CHECK(source_count>=0),
 unmapped_count integer NOT NULL CHECK(unmapped_count>=0),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vertice_automation_candidate.shadow_alert (
 run_id uuid NOT NULL REFERENCES vertice_automation_candidate.shadow_run(run_id),
 alert_key text NOT NULL CHECK(alert_key ~ '^[a-f0-9]{64}$'),
 rule_id text NOT NULL,
 rule_version text NOT NULL,
 priority text NOT NULL CHECK(priority IN ('P0','P1','P2')),
 PRIMARY KEY(run_id,alert_key)
);
CREATE TABLE vertice_automation_candidate.audit_event (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 config_id bigint NOT NULL REFERENCES vertice_automation_candidate.config_revision(id),
 actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('configure','approve','disable','review')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 evidence_ref text NOT NULL CHECK(length(evidence_ref) BETWEEN 1 AND 150)
);
ALTER TABLE vertice_automation_candidate.config_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_automation_candidate.shadow_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_automation_candidate.shadow_alert ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_automation_candidate.audit_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA vertice_automation_candidate FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA vertice_automation_candidate FROM PUBLIC, anon, authenticated, service_role;
-- Fail closed: no browser policies or worker grants yet. The production RPC must
-- enforce native authorization, course ownership, current approved revision,
-- server-computed digest and atomic insert/ack; do not grant direct table access.
COMMIT;
