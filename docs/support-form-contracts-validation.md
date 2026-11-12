# Support form contracts validation

Scope: isolated local frontend fixes. No database writes, migrations, deployment, real-person data, external services, or decisions about any person were executed.

Schema metadata was read from the connected Supabase project on 2026-11-12. Source builds on commit 06c9076, independently of deploying or merging PR95.

## Fixed

- Invalid order columns (`opened_at`, `decided_at`, category `name`, `accommodation_type`) replaced with existing columns.
- Allowed initial statuses, inclusion origins and accommodation categories match database CHECKs.
- Special cases include a UUID-derived unique protocol. Inclusion retains the existing database protocol trigger.
- Special requests require explicit origin and use the selected institution's case student.
- Decisions require justification and current role, preserve decision type and use lifecycle status `vigente`. A rejection is never labeled as approval.
- Individual plans require an institution-scoped case and inherit its student/course; objective text is stored in a JSON array and historical JSON renders safely.
- Special plans start as drafts; free-text `elaborated_by` is removed because the database column is a UUID, not a name. No automatic validation or activation.
- Case, category and plan references are checked against the current institution's loaded records. This is additional UI defense, not a replacement for RLS/server constraints.
- Date ordering and valid calendar dates checked before writes.
- Writes inspect returned errors, preserve forms on failure, lock repeat clicks, and close/reset forms only on success. Failed reads do not display empty/zero KPIs.
- Institution changes remount the module and discard old forms; late reads are ignored.

## Verification

Targeted tests use pure contracts and a synthetic React DOM with mocked Supabase, not the live portal. Run with jsdom and the client alias resolved. Full TypeScript/regression/build results are in the handoff report. Live acceptance testing remains pending deployment authorization.

## Explicit non-goals

No workflow approval, cross-table transaction, RLS change, BI aggregation, document ingestion or automatic course-action generation was added. Drafts and cases are not claimed to be completed education-support workflows.
