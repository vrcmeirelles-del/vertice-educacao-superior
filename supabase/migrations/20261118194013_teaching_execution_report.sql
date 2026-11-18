-- Relatório de execução no cadastro nativo de Atividades de Ensino.
-- Rascunhos podem estar incompletos; validação requer revisão humana explícita.
begin;
alter table public.vertice_teaching_activities
 add column execution_report jsonb not null default '{}'::jsonb,
 add column minutes_doc_id uuid references public.vertice_documents(id) on delete restrict;
grant insert(execution_report,minutes_doc_id),update(execution_report,minutes_doc_id)
 on public.vertice_teaching_activities to authenticated;
comment on column public.vertice_teaching_activities.execution_report is 'Relato declarado da execução. Não comprova resultados, não altera indicadores e não concede horas. Mínimo de uma folha conferido por humano na validação.';
comment on column public.vertice_teaching_activities.minutes_doc_id is 'Referência à ata no mesmo curso/IES. Vínculo não atesta assinaturas nem publica o documento.';

create function vertice_private.teaching_report_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text; v jsonb; lim integer; amount numeric;
 text_keys constant text[] := array['event_name','coordinator','teachers','technicians','presentation','results','acknowledgments','partners_support','schedule','personnel','materials','publicity'];
begin
 if (tg_op='INSERT' or (new.execution_report,new.minutes_doc_id) is distinct from (old.execution_report,old.minutes_doc_id)
     or (new.status='validada' and old.status is distinct from new.status))
   and not vertice_private.teaching_access(new.institution_id,new.course_id,'record') then
  raise exception 'Relatório restrito à equipe autorizada deste curso com MFA.' using errcode='42501';
 end if;
 if tg_op='UPDATE' and old.status='validada' and
  (new.execution_report,new.minutes_doc_id) is distinct from (old.execution_report,old.minutes_doc_id) then
  raise exception 'Relatório validado e ata vinculada não podem ser substituídos.' using errcode='23514';
 end if;
 if jsonb_typeof(new.execution_report) is distinct from 'object' then
  raise exception 'Relatório de execução inválido.' using errcode='23514';
 end if;
 for k,v in select key,value from jsonb_each(new.execution_report) loop
  if k=any(text_keys) then
   lim:=case k when 'event_name' then 250 when 'coordinator' then 1000 when 'teachers' then 4000 when 'technicians' then 4000 when 'presentation' then 30000 when 'results' then 20000 when 'schedule' then 10000 else 6000 end;
   if jsonb_typeof(v)<>'string' or length(new.execution_report->>k)>lim then
    raise exception 'Campo do relatório inválido ou acima do limite: %.',k using errcode='23514';
   end if;
  elsif k='investment_amount' then
   if v<>'null'::jsonb then
    if jsonb_typeof(v)<>'number' then raise exception 'Valor investido deve ser numérico.' using errcode='23514'; end if;
    amount:=(new.execution_report->>k)::numeric;
    if amount<0 or amount>1000000000 or amount<>round(amount,2) then
     raise exception 'Valor investido inválido; use até duas casas decimais.' using errcode='23514';
    end if;
   end if;
  elsif k='presentation_page_reviewed' then
   if jsonb_typeof(v)<>'boolean' then raise exception 'Conferência humana inválida.' using errcode='23514'; end if;
   if v='true'::jsonb and (new.status<>'validada' or ((tg_op='INSERT' or old.status is distinct from new.status) and not vertice_private.teaching_access(new.institution_id,new.course_id,'validate'))) then
    raise exception 'A conferência é registrada apenas na validação por pessoa autorizada.' using errcode='42501';
   end if;
  else
   raise exception 'Campo não previsto no relatório: %.',k using errcode='23514';
  end if;
 end loop;
 if new.minutes_doc_id is not null then
  perform 1 from public.vertice_documents d where d.id=new.minutes_doc_id
   and d.institution_id=new.institution_id and d.course_id=new.course_id
   and d.status in ('active','approved') and d.superseded_by is null for share;
  if not found then raise exception 'Selecione uma ata disponível da Mesa Digital deste curso.' using errcode='23514'; end if;
 end if;
 if new.status='validada' and (tg_op='INSERT' or old.status is distinct from new.status) then
  foreach k in array text_keys loop
   if nullif(btrim(new.execution_report->>k),'') is null then
    raise exception 'Complete o relatório antes de validar: %.',k using errcode='23514';
   end if;
  end loop;
  if new.execution_report->>'investment_amount' is null or new.minutes_doc_id is null then
   raise exception 'Informe o valor investido e a ata com assinaturas antes de validar.' using errcode='23514';
  end if;
  if new.execution_report->'presentation_page_reviewed' is distinct from 'true'::jsonb then
   raise exception 'Confirme a revisão da apresentação com no mínimo uma folha, dos resultados e da ata assinada.' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function vertice_private.teaching_report_guard() from public,anon,authenticated;
create trigger teaching_report_guard before insert or update on public.vertice_teaching_activities
 for each row execute function vertice_private.teaching_report_guard();

create or replace function vertice_private.teaching_save_activity(p_institution uuid,p_course uuid,p_activity uuid,p_fields jsonb,p_students jsonb)
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
   (institution_id,course_id,title,category,description,activity_date,organizer_role,exam_module,goal_id,evidence_doc_id,ods_goal,ods_rationale,total_minutes,execution_report,minutes_doc_id)
  values(p_institution,p_course,f.title,f.category,f.description,f.activity_date,f.organizer_role,f.exam_module,f.goal_id,f.evidence_doc_id,f.ods_goal,f.ods_rationale,f.total_minutes,coalesce(f.execution_report,'{}'::jsonb),f.minutes_doc_id)
  returning * into row_saved;
 else
  update public.vertice_teaching_activities a set
   title=f.title,category=f.category,description=f.description,activity_date=f.activity_date,organizer_role=f.organizer_role,
   exam_module=f.exam_module,goal_id=f.goal_id,evidence_doc_id=f.evidence_doc_id,ods_goal=f.ods_goal,ods_rationale=f.ods_rationale,total_minutes=f.total_minutes,
   execution_report=case when p_fields ? 'execution_report' then f.execution_report else a.execution_report end,
   minutes_doc_id=case when p_fields ? 'minutes_doc_id' then f.minutes_doc_id else a.minutes_doc_id end
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

notify pgrst,'reload schema';
commit;
