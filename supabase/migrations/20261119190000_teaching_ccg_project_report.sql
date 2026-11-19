-- Campos do CCG-MD1 (projeto) e CCG-MDL-02 (relatório) para Atividades de Ensino.
-- Fase "projeto" usa os campos já existentes + novos; fase "relatório" adiciona campos exclusivos.
-- Um único registro, duas fases. Campos compartilhados não se repetem.
begin;

-- ============ PROJETO (CCG-MD1) — campos novos ============
alter table public.vertice_teaching_activities
  add column unit_name          text,                              -- Unidade (Palmas etc.)
  add column courses_involved   text,                              -- Cursos proponentes (texto livre, pode ser mais de um)
  add column teachers_involved  text,                              -- Docente(s) participante(s) (nome, telefone, e-mail)
  add column technicians        text,                              -- Técnico(s) envolvido(s)
  add column activity_time      text,                              -- Horário da atividade
  add column location           text,                              -- Local (auditório, sala, Teams…)
  add column schedule_detail    text,                              -- Programação detalhada
  add column qty_students       integer check (qty_students is null or qty_students >= 0),
  add column qty_technicians    integer check (qty_technicians is null or qty_technicians >= 0),
  add column qty_teachers       integer check (qty_teachers is null or qty_teachers >= 0),
  add column partnerships       text,                              -- Parcerias/forma de apoio
  add column attendance_method  text,                              -- Modo de confirmação de presença
  add column proposed_budget    numeric(12,2),                     -- Valor proposto
  add column approved_budget    numeric(12,2),                     -- Valor aprovado
  add column general_objective  text,                              -- Objetivo geral
  add column specific_objectives text,                             -- Objetivos específicos
  add column infrastructure     text,                              -- Infraestrutura (checkboxes + necessidades serializado)
  add column evaluation_methods text,                              -- Formas de avaliação
  add column target_audience    text,                              -- Público-alvo (área de conhecimento)
  add column marketing_scope    text,                              -- Divulgação: alcance (interno/externo/ambos/mídias)
  add column marketing_channels text,                              -- Divulgação: canais (cartazes, folders, e-mail, mídias…)
  add column students_involved_desc text,                          -- Descrição dos alunos envolvidos (períodos)

  -- ============ RELATÓRIO (CCG-MDL-02) — campos exclusivos ============
  add column report_phase       text not null default 'projeto'    -- projeto | relatorio | finalizado
    check (report_phase in ('projeto','relatorio','finalizado')),
  add column report_presentation text,                             -- Apresentação do projeto executado (mín. 500 caracteres)
  add column report_results     text,                              -- Resultados alcançados
  add column report_engagement  text,                              -- Envolvimento dos participantes (texto + ata)
  add column report_budget_staff numeric(12,2),                    -- Valor investido: pessoal
  add column report_budget_materials numeric(12,2),                -- Valor investido: materiais
  add column report_materials_desc text,                           -- Descrição dos materiais
  add column report_dissemination text,                            -- Divulgação efetiva
  add column report_thanks      text,                              -- Agradecimentos
  add column report_opened_at   timestamptz,                       -- Quando o relatório foi aberto para edição
  add column report_submitted_at timestamptz;                      -- Quando o relatório foi submetido

comment on column public.vertice_teaching_activities.report_phase is 'Fase do registro: projeto (planejamento), relatorio (execução) ou finalizado.';
comment on column public.vertice_teaching_activities.unit_name is 'Unidade da IES onde a atividade acontece.';
comment on column public.vertice_teaching_activities.general_objective is 'Objetivo geral da atividade (CCG-MD1).';
comment on column public.vertice_teaching_activities.report_presentation is 'Apresentação do projeto executado no relatório final (CCG-MDL-02).';

-- Permitir que a função de salvamento aceite os novos campos
-- Recriar a função de salvamento com os novos campos
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
   (institution_id, course_id, title, category, description, activity_date, organizer_role,
    exam_module, goal_id, evidence_doc_id, ods_goal, ods_rationale, total_minutes,
    unit_name, courses_involved, teachers_involved, technicians, activity_time, location,
    schedule_detail, qty_students, qty_technicians, qty_teachers, partnerships,
    attendance_method, proposed_budget, approved_budget, general_objective, specific_objectives,
    infrastructure, evaluation_methods, target_audience, marketing_scope, marketing_channels,
    students_involved_desc, report_phase,
    report_presentation, report_results, report_engagement, report_budget_staff,
    report_budget_materials, report_materials_desc, report_dissemination, report_thanks)
  values(p_institution, p_course, f.title, f.category, f.description, f.activity_date, f.organizer_role,
    f.exam_module, f.goal_id, f.evidence_doc_id, f.ods_goal, f.ods_rationale, f.total_minutes,
    f.unit_name, f.courses_involved, f.teachers_involved, f.technicians, f.activity_time, f.location,
    f.schedule_detail, f.qty_students, f.qty_technicians, f.qty_teachers, f.partnerships,
    f.attendance_method, f.proposed_budget, f.approved_budget, f.general_objective, f.specific_objectives,
    f.infrastructure, f.evaluation_methods, f.target_audience, f.marketing_scope, f.marketing_channels,
    f.students_involved_desc, coalesce(f.report_phase,'projeto'),
    f.report_presentation, f.report_results, f.report_engagement, f.report_budget_staff,
    f.report_budget_materials, f.report_materials_desc, f.report_dissemination, f.report_thanks)
  returning * into row_saved;
 else
  update public.vertice_teaching_activities a set
   title=f.title, category=f.category, description=f.description, activity_date=f.activity_date,
   organizer_role=f.organizer_role, exam_module=f.exam_module, goal_id=f.goal_id,
   evidence_doc_id=f.evidence_doc_id, ods_goal=f.ods_goal, ods_rationale=f.ods_rationale,
   total_minutes=f.total_minutes,
   unit_name=f.unit_name, courses_involved=f.courses_involved, teachers_involved=f.teachers_involved,
   technicians=f.technicians, activity_time=f.activity_time, location=f.location,
   schedule_detail=f.schedule_detail, qty_students=f.qty_students, qty_technicians=f.qty_technicians,
   qty_teachers=f.qty_teachers, partnerships=f.partnerships, attendance_method=f.attendance_method,
   proposed_budget=f.proposed_budget, approved_budget=f.approved_budget,
   general_objective=f.general_objective, specific_objectives=f.specific_objectives,
   infrastructure=f.infrastructure, evaluation_methods=f.evaluation_methods,
   target_audience=f.target_audience, marketing_scope=f.marketing_scope,
   marketing_channels=f.marketing_channels, students_involved_desc=f.students_involved_desc,
   report_phase=coalesce(f.report_phase, a.report_phase),
   report_presentation=f.report_presentation, report_results=f.report_results,
   report_engagement=f.report_engagement, report_budget_staff=f.report_budget_staff,
   report_budget_materials=f.report_budget_materials, report_materials_desc=f.report_materials_desc,
   report_dissemination=f.report_dissemination, report_thanks=f.report_thanks,
   report_opened_at=case when f.report_phase='relatorio' and a.report_opened_at is null then clock_timestamp() else a.report_opened_at end,
   report_submitted_at=case when f.report_phase='finalizado' and a.report_submitted_at is null then clock_timestamp() else a.report_submitted_at end
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
