-- PRIVATE LOCAL REVIEW ONLY. Not an approved production migration.
-- Requires atomic importer + alumni_write_boundary first, coordinated compatible UI.
-- No person is granted access here. Administrative assignment workflow is NOT created.
begin;
-- Fail closed if the prerequisite write boundary was not applied. Merely hiding
-- nominal UI cannot protect INSERT, relink or the unscoped SECURITY DEFINER RPC.
do $$ declare r text; t text; begin
 if to_regprocedure('public.alumni_import_education(uuid,uuid,text,jsonb)') is null then
  raise exception 'Atomic alumni importer prerequisite missing';
 end if;
 foreach r in array array['anon','authenticated'] loop
  if has_function_privilege(r,'public.alumni_find_or_create_profile(text,text,text,text,text)','EXECUTE') then
   raise exception 'Legacy alumni RPC must be closed before nominal scope';
  end if;
  foreach t in array array['public.vertice_alumni_profiles','public.vertice_alumni_education'] loop
   if has_table_privilege(r,t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege(r,t,'INSERT,UPDATE,REFERENCES') then
    raise exception 'Alumni direct write boundary prerequisite missing';
   end if;
  end loop;
 end loop;
end $$;
create table if not exists public.vertice_alumni_nominal_grants (
 institution_id uuid not null,
 user_id uuid not null,
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 primary key(institution_id,user_id),
 foreign key(user_id,institution_id) references public.vertice_memberships(user_id,institution_id) on delete cascade,
 check(expires_at>granted_at)
);
alter table public.vertice_alumni_nominal_grants enable row level security;
revoke all on public.vertice_alumni_nominal_grants from public,anon,authenticated;
-- No browser policy, INSERT grant or assignment RPC. No self-service entitlement.
create or replace function vertice_private.alumni_can_view_nominal(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal'='aal2',false)
 and coalesce(vertice_private.can_read_institution(target),false)
 and (vertice_private.has_role(target,array['gestor']) or exists (
  select 1 from public.vertice_alumni_nominal_grants g
  join public.vertice_memberships m on m.institution_id=g.institution_id and m.user_id=g.user_id
  where g.institution_id=target and g.user_id=auth.uid()
  and g.revoked_at is null and g.expires_at>now()
 ));
$$;
create or replace function vertice_private.alumni_can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.vertice_alumni_education e
 where e.profile_id=target and vertice_private.alumni_can_view_nominal(e.institution_id));
$$;
revoke all on function vertice_private.alumni_can_view_nominal(uuid),vertice_private.alumni_can_view_profile(uuid) from public,anon;
grant execute on function vertice_private.alumni_can_view_nominal(uuid),vertice_private.alumni_can_view_profile(uuid) to authenticated;
drop policy if exists alumni_nominal_boundary on public.vertice_alumni_education;
create policy alumni_nominal_boundary on public.vertice_alumni_education as restrictive for select to authenticated
 using(vertice_private.alumni_can_view_nominal(institution_id));
drop policy if exists alumni_nominal_boundary on public.vertice_alumni_profiles;
create policy alumni_nominal_boundary on public.vertice_alumni_profiles as restrictive for select to authenticated
 using(vertice_private.alumni_can_view_profile(id));
-- Global history tables have no reliable institution provenance for all records.
-- They are not needed to deliver authorized names/contacts; fail closed until scoped design.
revoke all on public.vertice_alumni_employment,public.vertice_alumni_further_ed,
 public.vertice_alumni_contact_history,public.vertice_alumni_audit_log from public,anon,authenticated;
-- Remove surviving column grants on all nominal tables, including profile hashes.
do $$ declare t text; cols text; begin
 foreach t in array array['vertice_alumni_profiles','vertice_alumni_education','vertice_alumni_employment',
  'vertice_alumni_further_ed','vertice_alumni_contact_history','vertice_alumni_audit_log'] loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns
   where table_schema='public' and table_name=t;
  execute format('revoke select (%s),insert (%s),update (%s),references (%s) on public.%I from public,anon,authenticated',cols,cols,cols,cols,t);
 end loop;
end $$;
revoke select on public.vertice_alumni_profiles from public,anon,authenticated;
grant select(id,full_name,social_name,email,phone,preferred_channel,contact_updated_at,comm_opt_out,source,created_at,updated_at)
 on public.vertice_alumni_profiles to authenticated;
-- education retains authenticated SELECT from pre-existing grants, bounded by both RLS policies.
alter view public.vertice_alumni_overview set(security_invoker=true);
revoke all on public.vertice_alumni_overview from public,anon;
create or replace function public.alumni_access_context(p_institution_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(vertice_private.can_read_institution(p_institution_id),false) then
  raise exception 'Alumni access unavailable' using errcode='42501';
 end if;
 return jsonb_build_object('can_view_nominal',vertice_private.alumni_can_view_nominal(p_institution_id),
 'can_import',vertice_private.has_role(p_institution_id,array['gestor']));
end; $$;
create or replace function public.alumni_safe_overview(p_institution_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare n bigint; lo bigint;
begin
 if auth.uid() is null or not coalesce(vertice_private.can_read_institution(p_institution_id),false) then
  raise exception 'Alumni indicators unavailable' using errcode='42501';
 end if;
 select count(distinct profile_id) into n from public.vertice_alumni_education
 where institution_id=p_institution_id and academic_status in ('formado','diplomado','egresso_acompanhado','integralizado','concluinte');
 lo:=case when n>=5 then (n/5)*5 else null end;
 -- Conservative proposal, not an anonymity guarantee: no arbitrary filters,
 -- no small-cell/complement contact counts. Zero indistinguishable from 1..4.
 return jsonb_build_object('institution_id',p_institution_id,'total_egressos_min',lo,
 'total_egressos_max',case when lo is not null then lo+4 else null end,
 'suppression_applied',n<5,'privacy_mode','institution_band_5');
end; $$;
revoke all on function public.alumni_access_context(uuid),public.alumni_safe_overview(uuid) from public,anon;
grant execute on function public.alumni_access_context(uuid),public.alumni_safe_overview(uuid) to authenticated;
commit;
