-- Institutional scope for delegated portal calls to the registered Microsoft tenant.
-- This RPC does not expose app credentials or authorize arbitrary shared links.
create or replace function public.vertice_source_drive_authorize(p_institution uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(
   auth.uid() is not null
   and auth.jwt()->>'aal'='aal2'
   and vertice_private.has_role(p_institution,array['gestor'])
   and p_institution in (
      '1f5fd5b4-93c6-4626-834d-136884915587'::uuid,
      '4224e2fc-6a96-4761-820f-6f8e809ca1c1'::uuid
   ),false);
$$;
revoke all on function public.vertice_source_drive_authorize(uuid) from public,anon;
grant execute on function public.vertice_source_drive_authorize(uuid) to authenticated;