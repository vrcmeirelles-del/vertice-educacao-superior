# Medical learning bridge: reviewed replay and mapping

This change is based on the existing medical and school integrations in main. It does not reintroduce the previous medical-only allowlist over the school integration.

## Scope

- Preserve the published Edge v22 contract and JWT verification. No change to authentication, authorization, role lists, secrets, RLS, grants or policies.
- Keep ENAMED and Residência Médica in Superior, ENEM in Escolas. Validate each source page before writing events or committing its cursor. Source and cursor failures do not advance progress.
- Preserve timestamp strings, including PostgreSQL microseconds, in both `sync` and `sync_enem`.
- Add explicit, reviewed historical replay to the existing management UI. This calls the existing institution-scoped reset RPC, without deleting events. Replay imports at most four pages. If more remain, continue with **Sincronizar desempenho**, not replay again.
- Allow the aggregator's existing `*` mapping option through the mapping constraint and existing RPC. This means **the entire module, across all booklets and exams**, including events without a competency. It is not a single-booklet mapping. No mapping is automatically created. The UI explains the scope, requires review and confirmation, and clears review after any field/context change.
- Prevent repeated actions while pending and discard stale results after changing institution/segment.

## Migration and permissions

`20261113033000_learning_reviewed_module_mapping.sql` modifies only:

1. `vertice_private.learning_subject_maps_mapped_competency_check`: accepts `*` in addition to strings of length 3–500.
2. The minimum-length expression in the installed `public.vertice_bridge_map_subject(uuid,uuid,text,text,text,text,uuid)` function. Its current module validation and security settings are preserved; unexpected source text aborts the migration.

No roster, academic calendar, grade, event, mapping or metric is created. No credential or production record belongs in this public repository. The SQL test snapshots and compares ACL, RLS, policies and function security configuration before and after this migration.

## Validation

Compose the source ZIP and overrides as described in the root README. Copy `supabase/` into the composed directory. Install the locked dependencies with `npm ci --legacy-peer-deps`; install the already locked test runtime in `scripts/tests/runtime/` (jsdom 27.2.0 and PGlite 0.5.16) and symlink those two packages into the composed build, without changing the application's lockfile. Copy `scripts/medical.vitest.config.ts` into the composed `scripts/` directory. The dedicated workflow documents these exact steps. PGlite 0.5.8 is also covered in local compatibility validation.

From the composed directory:

- `npm run check`
- `npm test`
- `./node_modules/.bin/vitest run --config scripts/medical.vitest.config.ts`
- `npm run build:static`
- `node --test ../scripts/tests/learning-medical-replay.test.mjs`

New tests exercise the actual Edge handler using synthetic service responses; React DOM interactions cover module segregation, canceled and repeated replay, field changes and institutional navigation. The isolated database test applies actual learning migrations and validates medical ingestion, school isolation, idempotency, exact cursors, cohort suppression and whole-module mapping across two synthetic booklets. No production database is used for these tests.

These checks do not establish production end-to-end operation, real-browser visual QA or multi-connection PostgreSQL behavior. Full operation still requires institutional enrollment provenance, explicit mappings, calendar windows, consent and sufficient cohort data. A Fato account link or roster-upload audit row is not an accepted academic enrollment in `learning_students`. Do not fabricate enrollment provenance or official ENEM scores.

## Local result

Validated on the composed source with its lockfile: 407 existing tests, 20 new handler/DOM tests and the isolated SQL test passed; TypeScript passed; static build/prerender produced 15 public pages and 19 noindex demonstration areas. SQL validation passed with both PGlite 0.5.8 and the repository's locked 0.5.16. Browser visual QA, remote CI and deployment were not performed by this change. The runtime test stubs use synthetic identities and do not contact live services.
