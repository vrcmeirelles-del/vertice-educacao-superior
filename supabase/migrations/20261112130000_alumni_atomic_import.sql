-- Local/review artifact only. Deploy with the matching client after authorization.
-- No historical cleanup, global identity merging, contact updates or external sends.
begin;
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
    or not vertice_private.has_role(p_institution,array['gestor']) then
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
revoke all on function public.alumni_import_education(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.alumni_import_education(uuid,uuid,text,jsonb) to authenticated;
-- The unscoped legacy function bypasses tenant authorization and can change global contacts.
-- No client caller remains after this coordinated release. Service jobs must be reviewed separately.
revoke execute on function public.alumni_find_or_create_profile(text,text,text,text,text) from public,anon,authenticated;
commit;
