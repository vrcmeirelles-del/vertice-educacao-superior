-- SEPARATE SECURITY PROPOSAL: NOT a migration and NOT authorized for live application.
-- Review table/column grants, external callers, owner roles and all SECURITY DEFINER
-- entrypoints first. Run on a complete staging schema with actual RLS/auth helpers.
-- Goal: all browser writes to profiles/education go through scoped atomic RPC.
begin;
-- Existing permissive FOR ALL membership policies cannot enforce RPC-only writes.
-- Table grants must not leave a raw INSERT/UPDATE/DELETE bypass.
revoke insert,update,delete,truncate,references,trigger on
  public.vertice_alumni_profiles,public.vertice_alumni_education from public,anon,authenticated;
-- Column-level grants can survive a table revoke. Remove them explicitly as well.
do $$ declare t text; cols text; begin
 foreach t in array array['vertice_alumni_profiles','vertice_alumni_education'] loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns
   where table_schema='public' and table_name=t;
  execute format('revoke insert (%s),update (%s),references (%s) on public.%I from public,anon,authenticated',cols,cols,cols,t);
 end loop;
end $$;
revoke execute on function public.alumni_find_or_create_profile(text,text,text,text,text) from public,anon,authenticated;
-- Retain legitimate institution-scoped SELECT, but require identity + MFA even
-- for the legacy master policy. RESTRICTIVE policies cannot widen existing RLS.
do $$ declare t text; begin
 foreach t in array array['vertice_alumni_profiles','vertice_alumni_education'] loop
  execute format('drop policy if exists alumni_read_mfa_boundary on public.%I',t);
  execute format('create policy alumni_read_mfa_boundary on public.%I as restrictive for select to authenticated using (auth.uid() is not null and coalesce(auth.jwt()->>''aal'' = ''aal2'',false))',t);
 end loop;
end $$;
alter view public.vertice_alumni_overview set (security_invoker=true);
revoke all on public.vertice_alumni_overview from public,anon;
revoke select on public.vertice_alumni_profiles,public.vertice_alumni_education from public,anon;
-- Authenticated SELECT remains subject to original tenant RLS + restrictive MFA.
-- This proposal intentionally does not grant additional SELECT or bypass roles.
-- Verify alumni_import_education owner has required writes and its scoped checks
-- remain effective. Review inherited grants to other roles before approval.
commit;
