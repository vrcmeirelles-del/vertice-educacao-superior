# FV-DEMO BI source audit (12 November 2026)

## Verified sources (read-only database)
Institution: a0d3b0de-0000-4000-8000-000000000001. No database mutations or deployment were performed by this change.

- 48 enrollment snapshots, all with lowercase `matriculado`: 12 courses per term. Totals: 2025/01 1277; 2025/02 1350; 2026/01 1427; 2026/02 1500.
- 24 course-semester statistics rows and 24 academic reports of kind `reprovacoes_semestre` (course-specific, two terms). These are not interchangeable sources.
- No e-ORBIT semester, course or quantity records for this institution. The general academic view cannot claim measured zero or silently substitute unrelated snapshots.
- Parent browser verification confirmed existing Reitoria `/master#bi=1` reflects 7 goals, 1 validated document, 9 pending requirements and 7 actions. Enrollment remains absent in deployed UI because strict uppercase filtering rejects the existing lowercase snapshots.

## Local corrections
- Normalize enrolled status consistently without accepting pre-enrollment or other statuses. Both summary and individual snapshot consumers use the shared predicate; PostgREST equality filters use case-insensitive matching.
- Enable each academic tab from its own source coverage. The simulator now accepts failure reports independently of faculty or admissions data.
- Preserve report/course identity in the simulator. Reports sharing a semester are separate selectable records, not an arbitrary institution-wide value or an unverified sum. Retention output is explicitly hypothetical.
- Require explicit selection in existing PortalBI. Clear prior institution state on changes; late prior-scope responses are ignored. No new Reitoria route was introduced.
- Remove unsupported claims that all records are real or never demonstrative. Expose missing sources separately from measured zero.
- Stop attributing global acquisitions to a selected institution. The current green gateway strips institution_id and does not provide an institutional filter, so the BI explicitly marks this integration unavailable while the standalone module remains accessible.
- Correct goal metric navigation and preserve unknown document values during load/error.

## Still pending / minimal fixtures proposed (not executed)
- To exercise general academic e-ORBIT views, create a clearly synthetic, coherent semester/course/quantity set using the supported importer, then verify lineage. Do not relabel snapshots as e-ORBIT.
- Create small typed synthetic academic reports for professors, disciplines/dossiers, admissions flow and cohort dropout to exercise currently unpopulated tabs. Include institution, course, period and source tags; no real personal records.
- Define and implement an institution-scoped acquisitions contract before re-enabling its BI metric. Global authorized access is not institution-specific provenance.
- Reitoria captation now embeds the existing institution-scoped CaptacaoBI. Its full registered history is explicitly independent of the academic enrollment semester. Manual captation/permanence calculations remain a separate simulation, not a financial feed or additional recorded totals.
- ReitorBI/ModoTV has a separate legacy component chain; consolidate or remove deliberately later rather than exposing two competing Reitoria dashboards.
- These changes are generic code corrections, not automatic replication of fictitious data or activation of integrations for real institutions.

## Validation
New tests cover source gating, preservation of course/report identity, normalized enrolled statuses, missing vs zero, explicit institution selection, switching/clearing scope and stale responses. The final consolidated branch passes TypeScript without errors and all 467 tests in 56 files. Production build passes. Minimal independent baseline type fixes cover DocumentManager, ProfileSimulator, Workspace and ExperiencePortal; no pre-analysis functionality was transported. The obsolete invitation-navigation assertion now checks the existing MasterHub entry rather than an HTML link no longer present. No browser test of these unpublished changes has occurred. Full regression results are recorded separately in delivery; synthetic DOM tests are not production E2E evidence.

## Strict prerender follow-up

The static build now bundles the public SSR entry with esbuild and executes it with Node. Server-side stylesheet imports are omitted only from SSR; Vite remains responsible for client CSS. There is no error-swallowing fallback. Tests prove React HTML generation with CSS, failure propagation and temporary-directory cleanup. A fresh Vite template and nonempty public-page markup are mandatory. Local validation rendered 14 public pages and 19 reserved/demo shells, checked public h1/root contents and identical clean-path aliases, and verified noindex and robots exclusions. This is an independent build fix, not pre-analysis functionality.
