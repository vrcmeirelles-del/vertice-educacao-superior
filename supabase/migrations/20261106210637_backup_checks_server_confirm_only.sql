-- Final verification is performed only by authenticated Edge Function with its
-- service key, after server-side byte-size and SHA-256 checks. No browser may
-- advance a structural validation report to "evidencias_recebidas" directly.
REVOKE UPDATE(stage,received_at) ON public.vertice_backup_structure_checks FROM authenticated;
DROP POLICY IF EXISTS vx_structure_checks_update ON public.vertice_backup_structure_checks;
