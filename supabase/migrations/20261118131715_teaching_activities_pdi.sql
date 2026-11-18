-- Atividades de Ensino (não Extensão / não horas AC) e programas do PDI.
-- As metas usam o cadastro e os indicadores já existentes; contribuições não são medições.
begin;

create function vertice_private.teaching_access(inst uuid, course uuid, mode text)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(
   (select auth.uid()) is not null and (select auth.jwt()->>'aal')='aal2'
   and exists(select 1 from public.vertice_courses c join public.vertice_institutions i on i.id=c.institution_id
              where c.id=course and c.institution_id=inst and i.tier='superior')
   and (vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
      or (exists(select 1 from public.vertice_learning_staff_scope st
                 where st.user_id=(select auth.uid()) and st.institution_id=inst and st.course_id=course and st.active)
          and (vertice_private.member_role(inst)='coordenador'
             or (mode='read' and vertice_private.member_role(inst)='nde')
             or (mode in ('read','record') and vertice_private.member_role(inst)='equipe')))),false)
$$;
revoke all on function vertice_private.teaching_access(uuid,uuid,text) from public,anon;
grant execute on function vertice_private.teaching_access(uuid,uuid,text) to authenticated;

create function vertice_private.pdi_access(inst uuid, edit boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(
   (select auth.uid()) is not null and (select auth.jwt()->>'aal')='aal2'
   and exists(select 1 from public.vertice_institutions i where i.id=inst and i.tier='superior')
   and (vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
      or (not edit and vertice_private.member_role(inst) in ('coordenador','nde','equipe') and exists(
        select 1 from public.vertice_learning_staff_scope st join public.vertice_courses c on c.id=st.course_id and c.institution_id=st.institution_id
        where st.user_id=(select auth.uid()) and st.institution_id=inst and st.active
      ))),false)
$$;
revoke all on function vertice_private.pdi_access(uuid,boolean) from public,anon;
grant execute on function vertice_private.pdi_access(uuid,boolean) to authenticated;

create table public.vertice_pdi_programs (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 title text not null check (length(btrim(title)) between 1 and 250),
 description text check (description is null or length(description)<=4000),
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(institution_id,id)
);
create unique index vertice_pdi_programs_title_by_ies on public.vertice_pdi_programs(institution_id,lower(btrim(title)));
alter table public.vertice_pdi_programs enable row level security;
revoke all on public.vertice_pdi_programs from public,anon,authenticated;
grant select on public.vertice_pdi_programs to authenticated;
grant insert(institution_id,title,description) on public.vertice_pdi_programs to authenticated;
grant update(title,description) on public.vertice_pdi_programs to authenticated;
create policy pdi_program_read on public.vertice_pdi_programs for select to authenticated using (vertice_private.pdi_access(institution_id,false));
create policy pdi_program_create on public.vertice_pdi_programs for insert to authenticated with check (vertice_private.pdi_access(institution_id,true));
create policy pdi_program_edit on public.vertice_pdi_programs for update to authenticated using (vertice_private.pdi_access(institution_id,true)) with check (vertice_private.pdi_access(institution_id,true));
create trigger pdi_program_touch before update on public.vertice_pdi_programs for each row execute function vertice_private.touch_updated();
create trigger pdi_program_audit after insert or update on public.vertice_pdi_programs for each row execute function vertice_private.audit_change();

alter table public.vertice_goals
 add column pdi_program_id uuid,
 add column pdi_expected_result text,
 add constraint vertice_goals_pdi_same_institution foreign key (institution_id,pdi_program_id)
  references public.vertice_pdi_programs(institution_id,id) on delete restrict,
 add constraint vertice_goals_pdi_requirements check (
  (pdi_program_id is null and pdi_expected_result is null)
  or (pdi_program_id is not null and course_id is null and due_date is not null
      and owner_name is not null and length(btrim(owner_name))>0
      and length(btrim(indicator))>0 and length(btrim(title))>0
      and pdi_expected_result is not null and length(btrim(pdi_expected_result)) between 1 and 4000)
 );
create index vertice_goals_pdi_lookup on public.vertice_goals(institution_id,pdi_program_id) where pdi_program_id is not null;
-- Aditivo: não expande a escrita nas metas que não são PDI.
create policy pdi_goal_create on public.vertice_goals for insert to authenticated with check (pdi_program_id is not null and vertice_private.pdi_access(institution_id,true));
create policy pdi_goal_edit on public.vertice_goals for update to authenticated using (pdi_program_id is not null and vertice_private.pdi_access(institution_id,true)) with check (pdi_program_id is not null and vertice_private.pdi_access(institution_id,true));
create policy pdi_goal_create_guard on public.vertice_goals as restrictive for insert to authenticated
 with check (pdi_program_id is null or vertice_private.pdi_access(institution_id,true));
create policy pdi_goal_edit_guard on public.vertice_goals as restrictive for update to authenticated
 using (pdi_program_id is null or vertice_private.pdi_access(institution_id,true))
 with check (pdi_program_id is null or vertice_private.pdi_access(institution_id,true));
create policy pdi_goal_delete_guard on public.vertice_goals as restrictive for delete to authenticated using (pdi_program_id is null);

create table public.vertice_teaching_activities (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
 course_id uuid not null references public.vertice_courses(id) on delete restrict,
 title text not null check (length(btrim(title)) between 1 and 250),
 category text not null check (category in ('evento','pratica','monitoria','visita','avaliacao','estudo','outra')),
 description text not null check (length(btrim(description)) between 1 and 6000),
 activity_date date not null,
 organizer_role text not null check (organizer_role in ('docente','discente','coordenacao','outro')),
 exam_module text check (exam_module is null or (category='avaliacao' and exam_module in ('enade','oab','enamed','cfc','residencia-medica','carreiras-juridicas','outro'))),
 goal_id uuid references public.vertice_goals(id) on delete restrict,
 evidence_doc_id uuid references public.vertice_documents(id) on delete set null,
 ods_goal smallint,
 ods_rationale text,
 status text not null default 'rascunho' check (status in ('rascunho','validada')),
 validated_by uuid references auth.users(id) on delete set null,
 validated_at timestamptz,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint teaching_ods_pair check ((ods_goal is null and ods_rationale is null) or
   (ods_goal is not null and ods_goal between 1 and 17 and ods_rationale is not null and length(btrim(ods_rationale)) between 1 and 1500)),
 constraint teaching_validation_state check ((status='validada')=(validated_at is not null))
);
create index teaching_ies_course_date_idx on public.vertice_teaching_activities(institution_id,course_id,activity_date desc);
create index teaching_goal_idx on public.vertice_teaching_activities(goal_id) where goal_id is not null;
create index teaching_evidence_idx on public.vertice_teaching_activities(evidence_doc_id) where evidence_doc_id is not null;
comment on column public.vertice_teaching_activities.exam_module is 'Classificação declarada; não comprova sincronização ou realização no Fato & Ordem.';
comment on column public.vertice_teaching_activities.goal_id is 'Contribuição ao PDI. Não gera medição ou alteração automática do indicador.';
alter table public.vertice_teaching_activities enable row level security;
revoke all on public.vertice_teaching_activities from public,anon,authenticated;
grant select on public.vertice_teaching_activities to authenticated;
grant insert(institution_id,course_id,title,category,description,activity_date,organizer_role,exam_module,goal_id,evidence_doc_id,ods_goal,ods_rationale) on public.vertice_teaching_activities to authenticated;
grant update(title,category,description,activity_date,organizer_role,exam_module,goal_id,evidence_doc_id,ods_goal,ods_rationale,status) on public.vertice_teaching_activities to authenticated;
create policy teaching_read on public.vertice_teaching_activities for select to authenticated using (vertice_private.teaching_access(institution_id,course_id,'read'));
create policy teaching_create on public.vertice_teaching_activities for insert to authenticated with check (status='rascunho' and vertice_private.teaching_access(institution_id,course_id,'record'));
create policy teaching_edit on public.vertice_teaching_activities for update to authenticated
 using (status='rascunho' and (vertice_private.teaching_access(institution_id,course_id,'validate')
   or (created_by=(select auth.uid()) and vertice_private.teaching_access(institution_id,course_id,'record'))))
 with check (vertice_private.teaching_access(institution_id,course_id,'validate') or
   (status='rascunho' and created_by=(select auth.uid()) and vertice_private.teaching_access(institution_id,course_id,'record')));

-- Consistência transacional das referências, sem expor metadados de outros cursos.
create function vertice_private.teaching_validate_refs() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.status='validada' and
   (new.goal_id,new.institution_id,new.course_id,new.title,new.category,new.description,new.activity_date,new.organizer_role,new.exam_module,new.ods_goal,new.ods_rationale,new.status)
    is distinct from
   (old.goal_id,old.institution_id,old.course_id,old.title,old.category,old.description,old.activity_date,old.organizer_role,old.exam_module,old.ods_goal,old.ods_rationale,old.status) then
   raise exception 'Atividade validada não pode ser substituída.' using errcode='23514';
 end if;
 if tg_op='INSERT' or new.goal_id is distinct from old.goal_id or new.status is distinct from old.status then
  if new.goal_id is not null then
   perform 1 from public.vertice_goals g where g.id=new.goal_id and g.institution_id=new.institution_id
     and g.course_id is null and g.pdi_program_id is not null and g.status<>'cancelada' for share;
   if not found then raise exception 'Selecione uma meta ativa do PDI desta instituição.' using errcode='23514'; end if;
  end if;
 end if;
 if new.evidence_doc_id is not null then
  perform 1 from public.vertice_documents d where d.id=new.evidence_doc_id
   and d.institution_id=new.institution_id and d.course_id=new.course_id
   and d.status in ('active','approved') and d.superseded_by is null for share;
  if not found then raise exception 'Selecione uma evidência disponível da Mesa Digital deste curso.' using errcode='23514'; end if;
 end if;
 if new.status='validada' and (tg_op='INSERT' or old.status is distinct from new.status) then
  if not vertice_private.teaching_access(new.institution_id,new.course_id,'validate') then
   raise exception 'Validação restrita à coordenação deste curso e à gestão.' using errcode='42501';
  end if;
  new.validated_at:=now();
  new.validated_by:=auth.uid();
 end if;
 return new;
end $$;
revoke all on function vertice_private.teaching_validate_refs() from public,anon,authenticated;
create trigger teaching_references before insert or update on public.vertice_teaching_activities for each row execute function vertice_private.teaching_validate_refs();
create trigger teaching_touch before update on public.vertice_teaching_activities for each row execute function vertice_private.touch_updated();
create trigger teaching_audit after insert or update on public.vertice_teaching_activities for each row execute function vertice_private.audit_change();

-- Protege a identidade de metas já vinculadas sem impedir revisão de indicador, resultado esperado ou cancelamento.
create function vertice_private.teaching_preserve_goal_scope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.pdi_program_id is not null and
  (new.institution_id is distinct from old.institution_id or new.course_id is not null or new.pdi_program_id is null) then
  raise exception 'O escopo institucional das metas do PDI não pode ser removido.' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function vertice_private.teaching_preserve_goal_scope() from public,anon,authenticated;
create trigger teaching_preserve_goal_scope before update on public.vertice_goals for each row execute function vertice_private.teaching_preserve_goal_scope();

-- Exporta só identificador e título, sem URL, binário, trecho ou caminho de armazenamento.
create function public.vertice_teaching_evidence_options(p_institution uuid,p_course uuid,p_query text default '',p_document uuid default null)
returns table(id uuid,title text)
language sql stable security invoker set search_path='' as $$
 select d.id,d.title from public.vertice_documents d
 where vertice_private.teaching_access(p_institution,p_course,'read')
   and d.institution_id=p_institution and d.course_id=p_course and d.status in ('active','approved') and d.superseded_by is null
   and (p_document is null or d.id=p_document)
   and (nullif(btrim(p_query),'') is null or strpos(lower(d.title),lower(left(btrim(p_query),160)))>0)
 order by lower(d.title),d.id limit 100
$$;
revoke all on function public.vertice_teaching_evidence_options(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.vertice_teaching_evidence_options(uuid,uuid,text,uuid) to authenticated;
-- O seletor recorta no servidor, sem reutilizar catálogo institucional amplo.
create function public.vertice_teaching_course_options(p_institution uuid)
returns table(id uuid,name text,degree text)
language sql stable security definer set search_path='' as $$
 select c.id,c.name,c.degree::text from public.vertice_courses c
 where c.institution_id=p_institution and vertice_private.teaching_access(p_institution,c.id,'read')
 order by c.name,c.id
$$;
revoke all on function public.vertice_teaching_course_options(uuid) from public,anon;
grant execute on function public.vertice_teaching_course_options(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
