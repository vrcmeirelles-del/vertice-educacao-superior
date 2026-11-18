-- Lista acadêmica de participação, separada de extensão e do livro de horas complementares.
begin;

alter table public.vertice_teaching_activities add column total_minutes integer
 check (total_minutes is null or total_minutes between 0 and 60000);
comment on column public.vertice_teaching_activities.total_minutes is 'Carga informada da atividade. Independente das cargas individuais, sem crédito automático.';

create table vertice_private.teaching_activity_students (
 activity_id uuid not null references public.vertice_teaching_activities(id) on delete restrict,
 student_id uuid not null references public.vertice_student_registry(id) on delete restrict,
 participant_role text not null check (participant_role in ('organizador','participante')),
 minutes integer not null check (minutes between 0 and 60000),
 linked_at timestamptz not null default clock_timestamp(),
 changed_at timestamptz not null default clock_timestamp(),
 changed_by uuid references auth.users(id) on delete set null,
 removed_at timestamptz,
 primary key(activity_id, student_id)
);
alter table vertice_private.teaching_activity_students enable row level security;
revoke all on vertice_private.teaching_activity_students from public,anon,authenticated;
comment on table vertice_private.teaching_activity_students is 'Participação acadêmica. Não concede horas de extensão ou créditos de atividades complementares.';

create function vertice_private.teaching_roster(p_institution uuid,p_course uuid,p_activity uuid,p_query text)
returns table(student_id uuid,student_name text,enrollment_code text,participant_role text,minutes integer,editable boolean)
language plpgsql stable security definer set search_path='' as $$
declare q text:=lower(left(btrim(coalesce(p_query,'')),120)); searchable boolean;
begin
 if not vertice_private.teaching_access(p_institution,p_course,'record') then
  raise exception 'Lista de estudantes restrita à equipe autorizada deste curso.' using errcode='42501';
 end if;
 if p_activity is not null and not exists(select 1 from public.vertice_teaching_activities a
  where a.id=p_activity and a.institution_id=p_institution and a.course_id=p_course) then
  raise exception 'Atividade não localizada neste curso.' using errcode='22023';
 end if;
 searchable := length(q)>=2 and (p_activity is null or exists(select 1 from public.vertice_teaching_activities a
    where a.id=p_activity and a.status='rascunho' and (a.created_by=auth.uid() or vertice_private.teaching_access(p_institution,p_course,'validate'))));
 return query
 with selected as (
  select t.student_id,coalesce(s.full_name,'Matrícula fora do vínculo atual')::text as name,
    s.enrollment_code::text as code,t.participant_role,t.minutes,coalesce(s.academic_status='active' and s.verified,false)
  from vertice_private.teaching_activity_students t left join public.vertice_student_registry s
   on s.id=t.student_id and s.institution_id=p_institution and s.course_id=p_course
  where t.activity_id=p_activity and t.removed_at is null
 ), options as (
  select s.id,s.full_name::text,s.enrollment_code::text,null::text,null::integer,true
  from public.vertice_student_registry s
  where searchable and s.institution_id=p_institution and s.course_id=p_course
   and s.academic_status='active' and s.verified
   and (strpos(lower(s.full_name),q)>0 or strpos(lower(s.enrollment_code),q)>0)
   and not exists(select 1 from selected x where x.student_id=s.id)
  order by lower(s.full_name),s.id limit 25
 )
 select * from selected union all select * from options;
end $$;

create function public.vertice_teaching_roster(p_institution uuid,p_course uuid,p_activity uuid,p_query text default '')
returns table(student_id uuid,student_name text,enrollment_code text,participant_role text,minutes integer,editable boolean)
language sql stable security invoker set search_path='' as $$
 select * from vertice_private.teaching_roster(p_institution,p_course,p_activity,p_query);
$$;

create function vertice_private.teaching_save_activity(p_institution uuid,p_course uuid,p_activity uuid,p_fields jsonb,p_students jsonb)
returns public.vertice_teaching_activities language plpgsql security definer set search_path='' as $$
declare row_saved public.vertice_teaching_activities; f public.vertice_teaching_activities;
begin
 if not vertice_private.teaching_access(p_institution,p_course,'record') then
  raise exception 'Registro restrito à equipe autorizada deste curso.' using errcode='42501';
 end if;
 if jsonb_typeof(p_fields) is distinct from 'object' or (p_fields ? 'status') then
  raise exception 'Envie os dados do rascunho. Validação é uma ação separada.' using errcode='22023';
 end if;
 select * into f from jsonb_populate_record(null::public.vertice_teaching_activities,p_fields);
 if p_activity is null then
  insert into public.vertice_teaching_activities
   (institution_id,course_id,title,category,description,activity_date,organizer_role,exam_module,goal_id,evidence_doc_id,ods_goal,ods_rationale,total_minutes)
  values(p_institution,p_course,f.title,f.category,f.description,f.activity_date,f.organizer_role,f.exam_module,f.goal_id,f.evidence_doc_id,f.ods_goal,f.ods_rationale,f.total_minutes)
  returning * into row_saved;
 else
  update public.vertice_teaching_activities a set
   title=f.title,category=f.category,description=f.description,activity_date=f.activity_date,organizer_role=f.organizer_role,
   exam_module=f.exam_module,goal_id=f.goal_id,evidence_doc_id=f.evidence_doc_id,ods_goal=f.ods_goal,ods_rationale=f.ods_rationale,total_minutes=f.total_minutes
  where a.id=p_activity and a.institution_id=p_institution and a.course_id=p_course and a.status='rascunho'
    and a.updated_at=f.updated_at and (a.created_by=auth.uid() or vertice_private.teaching_access(p_institution,p_course,'validate'))
  returning * into row_saved;
  if not found then
   raise exception 'Rascunho indisponível ou alterado. Recarregue antes de editar.' using errcode='40001';
  end if;
 end if;

 if p_students is not null then
  if jsonb_typeof(p_students) is distinct from 'array' then
   raise exception 'Lista de estudantes inválida.' using errcode='22023';
  end if;
  if jsonb_array_length(p_students)>500 then
   raise exception 'O limite é de 500 estudantes por atividade.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_students) as r(student_id uuid,participant_role text,minutes integer)
      where r.student_id is null or r.participant_role is null or r.participant_role not in ('organizador','participante')
       or r.minutes is null or r.minutes not between 0 and 60000)
      or exists(select 1 from jsonb_to_recordset(p_students) as r(student_id uuid) group by r.student_id having count(*)>1) then
   raise exception 'Revise os estudantes, papéis e cargas horárias da atividade.' using errcode='22023';
  end if;
  -- Bloqueia mudanças concorrentes de matrícula na inclusão; referências históricas continuam visíveis sem cruzar IES/curso.
  perform 1 from public.vertice_student_registry s
   join jsonb_to_recordset(p_students) as r(student_id uuid) on r.student_id=s.id
   where s.institution_id=p_institution and s.course_id=p_course order by s.id for share of s;
  if exists(select 1 from jsonb_to_recordset(p_students) as r(student_id uuid,participant_role text,minutes integer)
    where not exists(select 1 from public.vertice_student_registry s where s.id=r.student_id and s.institution_id=p_institution
       and s.course_id=p_course and s.academic_status='active' and s.verified)
      and not exists(select 1 from vertice_private.teaching_activity_students t where t.activity_id=row_saved.id and t.student_id=r.student_id
       and t.removed_at is null and t.participant_role=r.participant_role and t.minutes=r.minutes)) then
   raise exception 'Somente matrículas ativas e verificadas neste curso podem ser vinculadas ou alteradas.' using errcode='22023';
  end if;
  update vertice_private.teaching_activity_students t
   set removed_at=clock_timestamp(),changed_at=clock_timestamp(),changed_by=auth.uid()
   where t.activity_id=row_saved.id and t.removed_at is null
    and not exists(select 1 from jsonb_to_recordset(p_students) as r(student_id uuid) where r.student_id=t.student_id);
  insert into vertice_private.teaching_activity_students as t(activity_id,student_id,participant_role,minutes,changed_by)
   select row_saved.id,r.student_id,r.participant_role,r.minutes,auth.uid()
   from jsonb_to_recordset(p_students) as r(student_id uuid,participant_role text,minutes integer)
   on conflict (activity_id,student_id) do update set participant_role=excluded.participant_role,minutes=excluded.minutes,
    removed_at=null,changed_at=clock_timestamp(),changed_by=auth.uid()
   where t.removed_at is not null or (t.participant_role,t.minutes) is distinct from (excluded.participant_role,excluded.minutes);
 end if;
 return row_saved;
end $$;

create function public.vertice_teaching_save_activity(p_institution uuid,p_course uuid,p_activity uuid,p_fields jsonb,p_students jsonb default null)
returns public.vertice_teaching_activities language sql volatile security invoker set search_path='' as $$
 select vertice_private.teaching_save_activity(p_institution,p_course,p_activity,p_fields,p_students);
$$;

revoke all on function vertice_private.teaching_roster(uuid,uuid,uuid,text),public.vertice_teaching_roster(uuid,uuid,uuid,text),
 vertice_private.teaching_save_activity(uuid,uuid,uuid,jsonb,jsonb),public.vertice_teaching_save_activity(uuid,uuid,uuid,jsonb,jsonb)
 from public,anon,authenticated;
grant execute on function vertice_private.teaching_roster(uuid,uuid,uuid,text),public.vertice_teaching_roster(uuid,uuid,uuid,text),
 vertice_private.teaching_save_activity(uuid,uuid,uuid,jsonb,jsonb),public.vertice_teaching_save_activity(uuid,uuid,uuid,jsonb,jsonb)
 to authenticated;
notify pgrst,'reload schema';
commit;
