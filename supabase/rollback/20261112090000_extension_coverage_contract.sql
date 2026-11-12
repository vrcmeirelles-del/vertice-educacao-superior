-- Non-destructive operational rollback. Hide the v2 coverage UI first.
-- Preserve validated writes, legacy rows, both new views and all constraints/triggers.
begin;
revoke select on public.v_extension_coverage_v2,public.v_extension_student_quality from public,anon,authenticated;
-- No DROP CONSTRAINT, historical data edit or restoration of unsafe attribution.
-- Reapplying the reviewed forward migration restores authenticated reads.
commit;
