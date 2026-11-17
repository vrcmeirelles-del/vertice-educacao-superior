-- ENADE 360 CYCLE 3 — DISPOSABLE PostgreSQL ONLY.
-- Synthetic database created by CI postgres:17. NEVER run against Vértice Supabase.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA enade_fixture;
CREATE ROLE e_master NOLOGIN;
CREATE ROLE e_reitoria NOLOGIN;
CREATE ROLE e_coord NOLOGIN;
CREATE ROLE e_nde NOLOGIN;
CREATE ROLE e_cpa NOLOGIN;
CREATE ROLE e_outsider NOLOGIN;
CREATE ROLE e_no_mfa NOLOGIN;
CREATE TABLE enade_fixture.grants (
 principal name NOT NULL,
 institution text NOT NULL,
 course text,
 business_role text NOT NULL,
 mfa_verified boolean NOT NULL,
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE enade_fixture.evidence (
 id int PRIMARY KEY,
 institution text NOT NULL,
 course text,
 visibility text NOT NULL CHECK (visibility IN ('COURSE','AGGREGATED')),
 personal boolean NOT NULL DEFAULT false,
 publication_status text NOT NULL DEFAULT 'DRAFT_ONLY' CHECK(publication_status='DRAFT_ONLY')
);
INSERT INTO enade_fixture.grants(principal,institution,course,business_role,mfa_verified) VALUES
 ('e_master','IES_A',NULL,'MASTER',true),
 ('e_reitoria','IES_A',NULL,'REITORIA',true),
 ('e_coord','IES_A','C1','COORDENACAO',true),
 ('e_nde','IES_A','C2','NDE',true),
 ('e_cpa','IES_A',NULL,'CPA',true),
 ('e_no_mfa','IES_A',NULL,'REITORIA',false);
INSERT INTO enade_fixture.evidence(id,institution,course,visibility,personal) VALUES
 (1,'IES_A','C1','COURSE',false),
 (2,'IES_A','C2','COURSE',false),
 (3,'IES_A',NULL,'AGGREGATED',false),
 (4,'IES_B','C1','COURSE',false),
 (5,'IES_A','C1','COURSE',true);
ALTER TABLE enade_fixture.evidence ENABLE ROW LEVEL SECURITY;
-- Fixture reads a server-owned grants table; in production use trustworthy
-- session/auth state and real grants, NEVER client-provided custom JWT fields.
CREATE POLICY enade_fixture_read ON enade_fixture.evidence FOR SELECT
USING (
 EXISTS (
  SELECT 1 FROM enade_fixture.grants g
  WHERE g.principal=current_user AND g.institution=evidence.institution
    AND g.mfa_verified AND g.active
    AND NOT evidence.personal
    AND (
       g.business_role IN ('MASTER','REITORIA')
       OR (g.business_role IN ('COORDENACAO','NDE')
           AND g.course IS NOT NULL AND g.course=evidence.course
           AND evidence.visibility='COURSE')
       OR (g.business_role='CPA' AND evidence.visibility='AGGREGATED')
    )
 )
);
GRANT USAGE ON SCHEMA enade_fixture TO e_master,e_reitoria,e_coord,e_nde,e_cpa,e_outsider,e_no_mfa;
GRANT SELECT ON enade_fixture.grants TO e_master,e_reitoria,e_coord,e_nde,e_cpa,e_outsider,e_no_mfa;
GRANT SELECT ON enade_fixture.evidence TO e_master,e_reitoria,e_coord,e_nde,e_cpa,e_outsider,e_no_mfa;
COMMIT;
-- Positive/negative evidence under actual PostgreSQL SET ROLE and RLS.
SET ROLE e_master;
DO $$ BEGIN
 IF (SELECT count(*) FROM enade_fixture.evidence) <> 3 THEN RAISE EXCEPTION 'Master scoped read'; END IF;
 IF has_table_privilege(current_user,'enade_fixture.evidence','INSERT') THEN RAISE EXCEPTION 'Master must not write'; END IF;
END $$;
RESET ROLE;
SET ROLE e_reitoria;
DO $$ BEGIN IF (SELECT count(*) FROM enade_fixture.evidence) <> 3 THEN RAISE EXCEPTION 'Reitoria institutional scope'; END IF; END $$;
RESET ROLE;
SET ROLE e_coord;
DO $$ BEGIN
 IF (SELECT count(*) FROM enade_fixture.evidence) <> 1 THEN RAISE EXCEPTION 'Coord course scope'; END IF;
 IF EXISTS(SELECT 1 FROM enade_fixture.evidence WHERE course='C2') THEN RAISE EXCEPTION 'Cross-course read'; END IF;
END $$;
RESET ROLE;
SET ROLE e_nde;
DO $$ BEGIN IF (SELECT count(*) FROM enade_fixture.evidence) <> 1 THEN RAISE EXCEPTION 'NDE course scope'; END IF; END $$;
RESET ROLE;
SET ROLE e_cpa;
DO $$ BEGIN
 IF (SELECT count(*) FROM enade_fixture.evidence) <> 1 THEN RAISE EXCEPTION 'CPA aggregate scope'; END IF;
 IF EXISTS(SELECT 1 FROM enade_fixture.evidence WHERE visibility='COURSE') THEN RAISE EXCEPTION 'CPA detail read'; END IF;
END $$;
RESET ROLE;
SET ROLE e_outsider;
DO $$ BEGIN IF (SELECT count(*) FROM enade_fixture.evidence) <> 0 THEN RAISE EXCEPTION 'Unauthorized user read'; END IF; END $$;
RESET ROLE;
SET ROLE e_no_mfa;
DO $$ BEGIN IF (SELECT count(*) FROM enade_fixture.evidence) <> 0 THEN RAISE EXCEPTION 'No-MFA read'; END IF; END $$;
RESET ROLE;
-- Exercise rollback of an isolated, uncommitted test write. Does not modify production.
BEGIN;
INSERT INTO enade_fixture.evidence(id,institution,course,visibility) VALUES (99,'IES_A','C1','COURSE');
ROLLBACK;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM enade_fixture.evidence WHERE id=99) THEN RAISE EXCEPTION 'Rollback failed'; END IF; END $$;
SELECT 'PASS: disposable PostgreSQL RLS cases and transaction rollback' AS result;
