-- Avalia 360° — bloco 3: mapa de erros e recuperação personalizada (algoritmo, sem IA).
-- 1. vertice_avalia_error_evidence: alternativas erradas marcadas por aluno, com o erro conceitual
--    que o professor associou à alternativa (snapshot.questions[].distractorNotes), as competências
--    da questão (chave estável 'cmp:') e os itens do banco que cada aluno já respondeu.
-- 2. vertice_avalia_recovery_plans + vertice_avalia_recovery: planos de recuperação por aluno
--    (itens do banco por competência não demonstrada) e registro das revisões. A agenda de
--    repetição espaçada é recalculada no cliente a partir do registro (recovery.ts).
begin;

create function public.vertice_avalia_error_evidence(p_institution uuid,p_course uuid,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); v_app uuid; v_disc text; validator boolean; result jsonb;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Mapa de erros restrito à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 validator := vertice_private.avalia_access(p_institution,p_course,'validate');
 begin v_app := nullif(p_payload->>'applicationId','')::uuid;
 exception when others then raise exception 'Identificador inválido.' using errcode='22023'; end;
 v_disc := vertice_private.avalia_discipline(p_payload->>'discipline');
 if num_nonnulls(v_app, v_disc) <> 1 then raise exception 'Informe uma aplicação ou uma disciplina.' using errcode='22023'; end if;
 if v_app is not null then perform vertice_private.avalia_application_access(v_app,false); end if;

 with apps as (
  select a.id, a.applied_on, a.class_label, a.discipline, a.status, d.title, v.snapshot
  from public.vertice_avalia_applications a
  join public.vertice_avalia_drafts d on d.id=a.draft_id
  join public.vertice_avalia_draft_revisions v on v.draft_id=a.draft_id and v.revision=a.revision
  where a.institution_id=p_institution and a.course_id=p_course
    and (d.created_by=uid or a.created_by=uid or validator)
    and ((v_app is not null and a.id=v_app) or (v_disc is not null and a.status='closed' and lower(a.discipline)=lower(v_disc)))
 ), qs as (
  select apps.id app, q->>'id' qid, q
  from apps cross join lateral jsonb_array_elements(apps.snapshot->'questions') q
 ), qkeys as (
  select qs.app, qs.qid, jsonb_agg(distinct vertice_private.avalia_competency_key(p_course,c)) keys
  from qs join apps on apps.id=qs.app
  cross join lateral jsonb_array_elements(coalesce(apps.snapshot->'meta'->'declaredPedagogy'->'competencies','[]'::jsonb)) c
  where coalesce(qs.q->'competencyIds','[]'::jsonb) ? (c->>'id')
  group by 1,2
 ), sheets as (
  select s.id, s.application_id app, s.student_id, coalesce(st.full_name,s.student_label) label
  from public.vertice_avalia_sheets s left join public.vertice_student_registry st on st.id=s.student_id
  where s.application_id in (select id from apps) and (v_app is not null or s.student_id is not null)
 )
 select jsonb_build_object(
  'scope', case when v_app is not null then 'application' else 'discipline' end,
  'applications', coalesce((select jsonb_agg(jsonb_build_object('id',id,'appliedOn',applied_on,'classLabel',class_label,'discipline',discipline,'title',title,'status',status) order by applied_on) from apps),'[]'::jsonb),
  'students', coalesce((select jsonb_agg(jsonb_build_object('studentId',student_id,'label',label,'applications',n) order by label)
     from (select student_id,label,count(*) n from sheets group by 1,2) x),'[]'::jsonb),
  'objectiveAnswers', coalesce((select jsonb_agg(jsonb_build_object('questionId',question_id,'applicationId',application_id,'n',n)) from (
     select i.question_id, i.application_id, count(*) n from public.vertice_avalia_item_scores i join sheets s on s.id=i.sheet_id
     where i.kind='objetiva' and i.outcome in ('correct','wrong') group by 1,2) y),'[]'::jsonb),
  'errors', coalesce((select jsonb_agg(jsonb_build_object('studentId',s.student_id,'label',s.label,'applicationId',s.app,
     'questionId',i.question_id,'statement',left(qs.q->>'statement',140),'optionId',i.chosen_option,
     'note',nullif(btrim(qs.q->'distractorNotes'->>i.chosen_option),''),'competencies',coalesce(k.keys,'[]'::jsonb))
     order by s.label, s.app, i.display_number)
   from public.vertice_avalia_item_scores i join sheets s on s.id=i.sheet_id
   join qs on qs.app=i.application_id and qs.qid=i.question_id
   left join qkeys k on k.app=i.application_id and k.qid=i.question_id
   where i.kind='objetiva' and i.outcome='wrong'),'[]'::jsonb),
  'answeredBank', coalesce((select jsonb_agg(jsonb_build_object('studentId',student_id,'label',label,'bankIds',ids)) from (
     select s.student_id, s.label, jsonb_agg(distinct qs.q->>'sourceBankId') ids
     from sheets s join public.vertice_avalia_item_scores i on i.sheet_id=s.id
     join qs on qs.app=i.application_id and qs.qid=i.question_id
     where nullif(qs.q->>'sourceBankId','') is not null group by 1,2) z),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.vertice_avalia_error_evidence(uuid,uuid,jsonb) from public,anon;
grant execute on function public.vertice_avalia_error_evidence(uuid,uuid,jsonb) to authenticated;

create table public.vertice_avalia_recovery_plans (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 discipline text not null,
 student_id uuid not null references public.vertice_student_registry(id) on delete restrict,
 start_on date not null,
 competencies jsonb not null,
 items jsonb not null,
 log jsonb not null default '[]'::jsonb,
 status text not null default 'active' check (status in ('active','closed')),
 rules_version text not null,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vertice_avalia_recovery_scope on public.vertice_avalia_recovery_plans(institution_id,course_id,lower(discipline),status);
create index vertice_avalia_recovery_student on public.vertice_avalia_recovery_plans(student_id,created_at desc);
alter table public.vertice_avalia_recovery_plans enable row level security;
revoke all on public.vertice_avalia_recovery_plans from public, anon, authenticated;
create trigger avalia_recovery_audit after insert or update on public.vertice_avalia_recovery_plans for each row execute function vertice_private.audit_change();
comment on table public.vertice_avalia_recovery_plans is 'Planos de recuperação do Avalia 360°: itens do banco por competência não demonstrada e registro das revisões (repetição espaçada).';

create function public.vertice_avalia_recovery(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); validator boolean; disc text; plan jsonb; created integer := 0; r public.vertice_avalia_recovery_plans;
 entry jsonb; v_on date;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Recuperação restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 validator := vertice_private.avalia_access(p_institution,p_course,'validate');
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;

 if p_action='create' then
  disc := vertice_private.avalia_discipline(p_payload->>'discipline');
  if disc is null then raise exception 'Informe a disciplina.' using errcode='22023'; end if;
  if jsonb_typeof(p_payload->'plans') is distinct from 'array' or jsonb_array_length(p_payload->'plans') not between 1 and 200 then
   raise exception 'Envie entre 1 e 200 planos.' using errcode='22023';
  end if;
  for plan in select value from jsonb_array_elements(p_payload->'plans') loop
   if not exists(select 1 from public.vertice_student_registry s where s.id::text=plan->>'studentId'
                 and s.institution_id=p_institution and s.course_id=p_course) then
    raise exception 'Aluno fora do cadastro deste curso.' using errcode='22023';
   end if;
   if jsonb_typeof(plan->'items') is distinct from 'array' or jsonb_array_length(plan->'items') not between 1 and 30
      or jsonb_typeof(plan->'competencies') is distinct from 'array' or jsonb_array_length(plan->'competencies') not between 1 and 30 then
    raise exception 'Cada plano precisa de 1 a 30 competências e de 1 a 30 itens.' using errcode='22023';
   end if;
   if exists(select 1 from jsonb_array_elements(plan->'items') it
             where not exists(select 1 from public.vertice_avalia_bank b where b.id::text=it->>'bankId'
                              and b.institution_id=p_institution and b.course_id=p_course and lower(b.discipline)=lower(disc))) then
    raise exception 'Item do plano fora do Banco de Questões desta disciplina.' using errcode='22023';
   end if;
   begin v_on := (plan->>'startOn')::date; exception when others then v_on := null; end;
   if v_on is null then raise exception 'Informe a data de início do plano.' using errcode='22023'; end if;
   insert into public.vertice_avalia_recovery_plans(institution_id,course_id,discipline,student_id,start_on,competencies,items,rules_version,created_by)
   values(p_institution,p_course,disc,(plan->>'studentId')::uuid,v_on,plan->'competencies',
     (select jsonb_agg(jsonb_build_object('bankId',it->>'bankId','competency',left(it->>'competency',300))) from jsonb_array_elements(plan->'items') it),
     left(coalesce(plan->>'rulesVersion',''),20),uid);
   created := created+1;
  end loop;
  return jsonb_build_object('created',created);
 end if;

 if p_action='list' then
  disc := vertice_private.avalia_discipline(p_payload->>'discipline');
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'studentId',p.student_id,'label',s.full_name,'discipline',p.discipline,
     'startOn',p.start_on,'competencies',p.competencies,'items',(select jsonb_agg(it || jsonb_build_object('statement',left(b.record->'question'->>'statement',160)))
        from jsonb_array_elements(p.items) it left join public.vertice_avalia_bank b on b.id::text=it->>'bankId'),
     'log',p.log,'status',p.status,'rulesVersion',p.rules_version,'createdAt',p.created_at) order by s.full_name, p.created_at desc)
   from public.vertice_avalia_recovery_plans p join public.vertice_student_registry s on s.id=p.student_id
   where p.institution_id=p_institution and p.course_id=p_course
     and (disc is null or lower(p.discipline)=lower(disc))
     and (nullif(p_payload->>'studentId','') is null or p.student_id::text=p_payload->>'studentId')
     and (p.created_by=uid or validator)
     and (coalesce(p_payload->>'includeClosed','false')='true' or p.status='active')),'[]'::jsonb);
 end if;

 select * into r from public.vertice_avalia_recovery_plans p
  where p.id::text=p_payload->>'id' and p.institution_id=p_institution and p.course_id=p_course and (p.created_by=uid or validator)
  for update;
 if not found then raise exception 'Plano não localizado.' using errcode='P0002'; end if;

 if p_action='record' then
  if r.status<>'active' then raise exception 'Plano encerrado.' using errcode='23514'; end if;
  entry := p_payload->'entry';
  begin v_on := (entry->>'on')::date; exception when others then v_on := null; end;
  if v_on is null or v_on < r.start_on or v_on > current_date + 1 or jsonb_typeof(entry->'correct')<>'boolean'
     or not exists(select 1 from jsonb_array_elements(r.items) it where it->>'bankId'=entry->>'bankId') then
   raise exception 'Revisão inválida: item do plano, data a partir do início e resultado (acertou/errou).' using errcode='22023';
  end if;
  if jsonb_array_length(r.log) >= 500 then raise exception 'Limite de registros do plano atingido.' using errcode='54000'; end if;
  update public.vertice_avalia_recovery_plans set log=log || jsonb_build_array(jsonb_build_object('bankId',entry->>'bankId','on',v_on,
    'correct',(entry->>'correct')::boolean,'by',uid,'at',now())), updated_at=now() where id=r.id;
  return jsonb_build_object('id',r.id,'entries',jsonb_array_length(r.log)+1);
 end if;

 if p_action='close' then
  update public.vertice_avalia_recovery_plans set status='closed',updated_at=now() where id=r.id;
  return jsonb_build_object('id',r.id,'status','closed');
 end if;

 raise exception 'Ação inválida.' using errcode='22023';
end $$;
revoke all on function public.vertice_avalia_recovery(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_recovery(uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
