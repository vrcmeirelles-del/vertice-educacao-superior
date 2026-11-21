-- Restore MFA enforcement for policies that use the shared Master predicate.
create or replace function vertice_private.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and exists (
      select 1 from public.vertice_admins where user_id = (select auth.uid())
    );
$$;
