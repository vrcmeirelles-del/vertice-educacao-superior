-- PRIVATE operational rollback: disable Egressos, never restore broad old access.
-- Data, restrictive policies and individual authorization records remain intact.
begin;
revoke execute on function public.alumni_access_context(uuid),public.alumni_safe_overview(uuid),
 public.alumni_import_education(uuid,uuid,text,jsonb),
 public.alumni_find_or_create_profile(text,text,text,text,text) from public,anon,authenticated;
revoke select on public.vertice_alumni_profiles,public.vertice_alumni_education,public.vertice_alumni_overview
 from public,anon,authenticated;
do $$ declare t text; cols text; begin
 foreach t in array array['vertice_alumni_profiles','vertice_alumni_education'] loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns
   where table_schema='public' and table_name=t;
  execute format('revoke select (%s) on public.%I from public,anon,authenticated',cols,t);
 end loop;
end $$;
commit;
