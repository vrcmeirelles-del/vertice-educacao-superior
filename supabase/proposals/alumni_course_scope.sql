-- LOCAL REVIEW ONLY. Requires alumni_nominal_scope.sql. No assignments seeded.
-- Account-linked designation, NEVER inferred from registry name/email/job title.
begin;
do $$ declare r text; t text; begin
 if to_regclass('public.vertice_alumni_nominal_grants') is null
  or to_regprocedure('vertice_private.alumni_can_view_profile(uuid)') is null
  or not exists(select 1 from pg_policy where polrelid='public.vertice_alumni_profiles'::regclass
    and polname='alumni_nominal_boundary' and not polpermissive) then
  raise exception 'Alumni nominal scope prerequisite missing';
 end if;
 foreach r in array array['anon','authenticated'] loop
  if has_function_privilege(r,'public.alumni_find_or_create_profile(text,text,text,text,text)','EXECUTE') then
   raise exception 'Legacy importer must remain closed';
  end if;
  foreach t in array array['public.vertice_alumni_profiles','public.vertice_alumni_education'] loop
   if has_table_privilege(r,t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege(r,t,'INSERT,UPDATE,REFERENCES') then
    raise exception 'Alumni direct write boundary prerequisite missing';
   end if;
  end loop;
 end loop;
end $$;
create table if not exists public.vertice_alumni_role_grants (
 institution_id uuid not null,
 user_id uuid not null,
 access_role text not null check(access_role in ('reitoria','direcao','coordenador')),
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 primary key(institution_id,user_id),
 unique(institution_id,user_id,access_role),
 foreign key(user_id,institution_id) references public.vertice_memberships(user_id,institution_id) on delete cascade,
 check(expires_at>granted_at)
);
create table if not exists public.vertice_alumni_course_grants (
 institution_id uuid not null,
 user_id uuid not null,
 course_id uuid not null references public.vertice_courses(id) on delete cascade,
 access_role text not null default 'coordenador' check(access_role='coordenador'),
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 primary key(institution_id,user_id,course_id),
 foreign key(institution_id,user_id,access_role)
  references public.vertice_alumni_role_grants(institution_id,user_id,access_role) on delete cascade,
 check(expires_at>granted_at)
);
alter table public.vertice_alumni_role_grants enable row level security;
alter table public.vertice_alumni_course_grants enable row level security;
revoke all on public.vertice_alumni_role_grants,public.vertice_alumni_course_grants from public,anon,authenticated;
create or replace function vertice_private.alumni_validate_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='vertice_alumni_role_grants' then
  -- One-way revocation only: retain the designation as a blocking tombstone.
  -- This does not authorize the caller; table privileges remain unchanged.
  if tg_op='UPDATE' and old.access_role='coordenador'
   and old.revoked_at is null and new.revoked_at is not null
   and (to_jsonb(new)-'revoked_at') = (to_jsonb(old)-'revoked_at') then
   return new;
  end if;
  if new.access_role<>'coordenador' then
   if exists(select 1 from public.vertice_memberships m where m.user_id=new.user_id
    and m.institution_id=new.institution_id and m.role='coordenador') then
    raise exception 'Conflicting coordinator membership and institutional designation' using errcode='23514';
   end if;
   return new;
  end if;
  if exists(select 1 from public.vertice_admins a where a.user_id=new.user_id)
   or exists(select 1 from public.vertice_memberships m where m.user_id=new.user_id
    and m.institution_id=new.institution_id and m.role in ('gestor','reitor','diretor_geral','diretor_pedagogico'))
   or exists(select 1 from public.vertice_alumni_nominal_grants g where g.user_id=new.user_id
    and g.institution_id=new.institution_id and g.revoked_at is null and g.expires_at>now()) then
    raise exception 'Conflicting institutional and coordinator access; review assignment explicitly' using errcode='23514';
  end if;
 elsif tg_table_name='vertice_alumni_nominal_grants' then
  if new.revoked_at is null and new.expires_at>now() and exists(
   select 1 from public.vertice_alumni_role_grants r where r.user_id=new.user_id
    and r.institution_id=new.institution_id and r.access_role='coordenador') then
    raise exception 'Coordinator cannot receive generic institutional nominal grant' using errcode='23514';
  end if;
 elsif tg_table_name='vertice_alumni_course_grants' then
  if not exists(select 1 from public.vertice_courses c where c.id=new.course_id and c.institution_id=new.institution_id) then
   raise exception 'Course belongs to another institution' using errcode='23514';
  end if;
 end if;
 return new;
end; $$;
revoke all on function vertice_private.alumni_validate_assignment() from public,anon,authenticated;
drop trigger if exists alumni_assignment_guard on public.vertice_alumni_role_grants;
create trigger alumni_assignment_guard before insert or update on public.vertice_alumni_role_grants for each row execute function vertice_private.alumni_validate_assignment();
drop trigger if exists alumni_assignment_guard on public.vertice_alumni_course_grants;
create trigger alumni_assignment_guard before insert or update on public.vertice_alumni_course_grants for each row execute function vertice_private.alumni_validate_assignment();
drop trigger if exists alumni_assignment_guard on public.vertice_alumni_nominal_grants;
create trigger alumni_assignment_guard before insert or update on public.vertice_alumni_nominal_grants for each row execute function vertice_private.alumni_validate_assignment();
create or replace function vertice_private.alumni_effective_scope(target uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare r public.vertice_alumni_role_grants%rowtype; full_member boolean;
begin
 if auth.uid() is null or not coalesce(vertice_private.can_read_institution(target),false) then return 'none'; end if;
 full_member:=vertice_private.has_role(target,array['gestor','reitor','diretor_geral','diretor_pedagogico']);
 select * into r from public.vertice_alumni_role_grants where institution_id=target and user_id=auth.uid();
 if found then
  if r.access_role='coordenador' then
   -- Fail closed on later membership/master promotion or a conflicting legacy grant.
   -- No precedence rule silently widens a coordinator to the institution.
   if full_member or exists(select 1 from public.vertice_alumni_nominal_grants g
     where g.institution_id=target and g.user_id=auth.uid() and g.revoked_at is null and g.expires_at>now()) then return 'none'; end if;
   if r.revoked_at is not null or r.expires_at<=now() then return 'none'; end if;
   if exists(select 1 from public.vertice_alumni_course_grants g join public.vertice_courses c
      on c.id=g.course_id and c.institution_id=g.institution_id
      where g.institution_id=target and g.user_id=auth.uid() and g.revoked_at is null and g.expires_at>now()) then return 'courses'; end if;
   return 'none';
  end if;
  -- Fail closed also if an institutional designee becomes a coordinator later.
  if vertice_private.member_role(target)='coordenador' then return 'none'; end if;
  -- Revocation does not fall through to a forgotten generic grant.
  if r.revoked_at is not null or r.expires_at<=now() then return 'none'; end if;
  return 'institution';
 end if;
 -- Future course-scoped membership cannot inherit a generic institution grant.
 if vertice_private.member_role(target)='coordenador' then return 'none'; end if;
 if full_member then return 'institution'; end if;
 if exists(select 1 from public.vertice_alumni_nominal_grants g where g.institution_id=target
   and g.user_id=auth.uid() and g.revoked_at is null and g.expires_at>now()) then return 'institution'; end if;
 return 'none';
end; $$;
create or replace function vertice_private.alumni_can_view_education(target uuid,target_course uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case vertice_private.alumni_effective_scope(target)
 when 'institution' then true
 when 'courses' then exists(select 1 from public.vertice_alumni_course_grants g
  join public.vertice_courses c on c.id=g.course_id and c.institution_id=g.institution_id
  where g.institution_id=target and g.user_id=auth.uid() and g.course_id=target_course
   and g.revoked_at is null and g.expires_at>now()) else false end;
$$;
create or replace function vertice_private.alumni_can_view_nominal(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select vertice_private.alumni_effective_scope(target) in ('institution','courses');
$$;
create or replace function vertice_private.alumni_can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.vertice_alumni_education e where e.profile_id=target
  and vertice_private.alumni_can_view_education(e.institution_id,e.course_id));
$$;
revoke all on function vertice_private.alumni_effective_scope(uuid),vertice_private.alumni_can_view_education(uuid,uuid) from public,anon;
grant execute on function vertice_private.alumni_effective_scope(uuid),vertice_private.alumni_can_view_education(uuid,uuid) to authenticated;
drop policy if exists alumni_nominal_boundary on public.vertice_alumni_education;
create policy alumni_nominal_boundary on public.vertice_alumni_education as restrictive for select to authenticated
 using(vertice_private.alumni_can_view_education(institution_id,course_id));
create or replace function public.alumni_access_context(p_institution_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare scope text; courses jsonb;
begin
 if auth.uid() is null or not coalesce(vertice_private.can_read_institution(p_institution_id),false) then
  raise exception 'Alumni access unavailable' using errcode='42501';
 end if;
 scope:=vertice_private.alumni_effective_scope(p_institution_id);
 select coalesce(jsonb_agg(g.course_id order by g.course_id),'[]'::jsonb) into courses
 from public.vertice_alumni_course_grants g join public.vertice_courses c
 on c.id=g.course_id and c.institution_id=g.institution_id
 where scope='courses' and g.institution_id=p_institution_id and g.user_id=auth.uid()
  and g.revoked_at is null and g.expires_at>now();
 return jsonb_build_object('can_view_nominal',scope<>'none',
  'can_import',scope='institution' and vertice_private.has_role(p_institution_id,array['gestor']),
  'nominal_scope',scope,'allowed_course_ids',courses);
end; $$;
-- Preserve the atomic importer implementation and existing gestor/master check.
-- Add only the contradictory-scope boundary; nominal reads never grant import.
create or replace function public.alumni_import_education(p_institution uuid, p_course uuid, p_enrollment text, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_education public.vertice_alumni_education%rowtype;
 v_profile uuid;
 v_hash text := nullif(btrim(p_record->>'cpf_hash'), '');
 v_name text := nullif(btrim(p_record->>'full_name'), '');
 v_status text := p_record->>'academic_status';
 v_existing_hash text;
 v_created boolean := false;
begin
 if auth.uid() is null or not coalesce(auth.jwt()->>'aal' = 'aal2',false)
    or not vertice_private.has_role(p_institution,array['gestor'])
    or vertice_private.alumni_effective_scope(p_institution)<>'institution' then
   raise exception 'Sem permissão de importação nesta instituição' using errcode='42501';
 end if;
 if not exists(select 1 from public.vertice_institutions where id=p_institution and status='ativa') then
   raise exception 'Instituição indisponível' using errcode='22023';
 end if;
 p_enrollment := nullif(btrim(p_enrollment),'');
 if p_enrollment is null or length(p_enrollment)>200 or v_name is null or length(v_name)>500
    or jsonb_typeof(p_record) is distinct from 'object' then
   raise exception 'Nome e matrícula estável são obrigatórios' using errcode='22023';
 end if;
 if p_course is null or not exists(select 1 from public.vertice_courses where id=p_course and institution_id=p_institution) then
   raise exception 'Curso não pertence à instituição' using errcode='22023';
 end if;
 if v_hash is not null and v_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Identificador inválido' using errcode='22023';
 end if;
 if v_status is null or v_status <> all(array['ativo','provavel_concluinte','concluinte','integralizado','formado','diplomado','egresso_acompanhado','desistente','transferido','jubilado','cancelado']) then
   raise exception 'Situação acadêmica inválida' using errcode='22023';
 end if;
 -- Lock the institution-scoped natural key before looking up or creating a profile.
 perform pg_advisory_xact_lock(hashtextextended(p_institution::text||'/'||p_course::text||'/'||p_enrollment,0));
 select * into v_education from public.vertice_alumni_education
 where institution_id=p_institution and course_id=p_course and enrollment_id=p_enrollment for update;
 if found then
   v_profile := v_education.profile_id;
   select cpf_hash into v_existing_hash from public.vertice_alumni_profiles where id=v_profile;
   if v_hash is not null and v_hash is distinct from v_existing_hash then
     raise exception 'Identidade divergente: requer conciliação revisada' using errcode='22023';
   end if;
   -- Never replace the global profile, overwrite its contacts, or merge by name.
 else
   if v_hash is not null and exists(select 1 from public.vertice_alumni_profiles where cpf_hash=v_hash) then
     raise exception 'Identidade requer conciliação revisada' using errcode='22023';
   end if;
   insert into public.vertice_alumni_profiles(cpf_hash,full_name,email,phone,source)
   values(v_hash,v_name,nullif(btrim(p_record->>'email'),''),nullif(btrim(p_record->>'phone'),''),'import') returning id into v_profile;
   v_created := true;
 end if;
 insert into public.vertice_alumni_education(profile_id,institution_id,course_id,enrollment_id,
   modality,degree,admission_year,admission_semester,academic_status,conclusion_year,conclusion_semester,graduation_date,status_source)
 values(v_profile,p_institution,p_course,p_enrollment,nullif(p_record->>'modality',''),nullif(p_record->>'degree',''),
   nullif(p_record->>'admission_year','')::smallint,nullif(p_record->>'admission_semester','')::smallint,v_status,
   nullif(p_record->>'conclusion_year','')::smallint,nullif(p_record->>'conclusion_semester','')::smallint,
   nullif(p_record->>'graduation_date','')::date,'import')
 on conflict(institution_id,course_id,enrollment_id) do update set
   modality=coalesce(excluded.modality,vertice_alumni_education.modality),
   degree=coalesce(excluded.degree,vertice_alumni_education.degree),
   admission_year=coalesce(excluded.admission_year,vertice_alumni_education.admission_year),
   admission_semester=coalesce(excluded.admission_semester,vertice_alumni_education.admission_semester),
   academic_status=excluded.academic_status,
   conclusion_year=coalesce(excluded.conclusion_year,vertice_alumni_education.conclusion_year),
   conclusion_semester=coalesce(excluded.conclusion_semester,vertice_alumni_education.conclusion_semester),
   graduation_date=coalesce(excluded.graduation_date,vertice_alumni_education.graduation_date),
   status_source='import',status_verified=false,status_verified_at=null,updated_at=now()
 returning * into v_education;
 if v_education.profile_id is distinct from v_profile then
   raise exception 'Vínculo alterado concorrentemente; confira e repita a importação' using errcode='40001';
 end if;
 return jsonb_build_object('education_id',v_education.id,'profile_id',v_education.profile_id,'created',v_created);
end;
$$;
commit;
