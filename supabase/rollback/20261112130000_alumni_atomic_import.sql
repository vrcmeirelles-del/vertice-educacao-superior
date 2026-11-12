-- Non-destructive operational rollback after an authorized deployment.
-- Disable import UI at the same time. Never restore the unscoped legacy RPC.
begin;
revoke execute on function public.alumni_import_education(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke execute on function public.alumni_find_or_create_profile(text,text,text,text,text) from public,anon,authenticated;
-- Preserve profiles, education, IDs, history and all constraints.
-- Forward migration reapplication restores ONLY the scoped RPC after review.
commit;
