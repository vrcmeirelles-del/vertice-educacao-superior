-- Prepared locally. Requires deployment approval. Never removes or rewrites existing data.
-- Fail closed on legacy duplicates; resolve them explicitly before retrying this migration.
begin;
do $$ begin
  if exists (select 1 from public.vertice_actions where deliberation_id is not null
             group by deliberation_id having count(*) > 1) then
    raise exception 'Governance action migration blocked: duplicate deliberation links require review';
  end if;
end $$;
create unique index if not exists vertice_actions_one_per_deliberation
  on public.vertice_actions(deliberation_id) where deliberation_id is not null;

create or replace function public.governance_create_action(p_institution_id uuid, p_deliberation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.governance_deliberations%rowtype;
  b public.governance_bodies%rowtype;
  a public.vertice_actions%rowtype;
  v_action_id uuid;
  origin text;
begin
  if auth.uid() is null
     or not coalesce(vertice_private.can_read_institution(p_institution_id), false)
     or not coalesce(vertice_private.has_role(p_institution_id,
       array['gestor','equipe','reitor','diretor_geral','diretor_pedagogico','procurador']), false) then
    raise exception 'Governance action not authorized' using errcode='42501';
  end if;
  select * into d from public.governance_deliberations
    where id=p_deliberation_id and institution_id=p_institution_id for update;
  if not found then raise exception 'Deliberation unavailable' using errcode='P0002'; end if;
  -- Retry returns the same action, even after the deliberation lifecycle has advanced.
  if d.action_id is not null then
    select * into a from public.vertice_actions where id=d.action_id;
    if not found or a.institution_id is distinct from p_institution_id or a.deliberation_id is distinct from d.id then
      raise exception 'Inconsistent existing governance action link' using errcode='23514';
    end if;
    return a.id;
  end if;
  if d.status not in ('registrada','encaminhada','em_execucao')
     or d.decision_type not in ('deliberacao_aprovada','recomendacao','encaminhamento')
     or d.duplicate_of is not null then
    raise exception 'Deliberation is not eligible for an action' using errcode='23514';
  end if;
  select * into b from public.governance_bodies
    where id=d.body_id and institution_id=p_institution_id and status='ativo' for share;
  if not found then raise exception 'Governing body unavailable' using errcode='23514'; end if;
  perform 1 from public.governance_meetings m where m.id=d.meeting_id
      and m.institution_id=p_institution_id and m.body_id=b.id and m.status='realizada' for share;
  if not found then raise exception 'A completed meeting of the same institution and body is required' using errcode='23514'; end if;
  if b.course_id is not null and not exists (
    select 1 from public.vertice_courses c where c.id=b.course_id and c.institution_id=p_institution_id
  ) then raise exception 'Course belongs to another institution' using errcode='23514'; end if;
  if d.goal_id is not null and not exists (
    select 1 from public.vertice_goals g where g.id=d.goal_id and g.institution_id=p_institution_id
  ) then raise exception 'Goal belongs to another institution' using errcode='23514'; end if;
  -- Recover an existing correctly scoped action left by an older non-atomic client.
  select * into a from public.vertice_actions where deliberation_id=d.id;
  if found then
    if a.institution_id is distinct from p_institution_id then
      raise exception 'Inconsistent existing governance action institution' using errcode='23514';
    end if;
    v_action_id := a.id;
  else
    -- Match prevent_executor_forgery (20261106134500): INSERT must not bypass
    -- the management-only assignment rule enforced there for UPDATE.
    if d.responsible_user_id is not null then
      if not coalesce(vertice_private.has_role(p_institution_id,array['gestor']),false) then
        raise exception 'Atribuição de executor reservada à gestão' using errcode='42501';
      end if;
      if not exists (
        select 1 from public.vertice_memberships m where m.user_id=d.responsible_user_id
          and m.institution_id=p_institution_id and m.role in ('gestor','equipe')
      ) and not exists (
        select 1 from public.vertice_admins adm where adm.user_id=d.responsible_user_id
      ) then raise exception 'Executor precisa ter vínculo autorizado' using errcode='23514'; end if;
    end if;
    origin := case b.body_type when 'nde' then 'nde' when 'cpa' then 'cpa'
      when 'colegiado' then 'colegiado' when 'conselho_superior' then 'colegiado'
      else 'demanda_institucional' end;
    insert into public.vertice_actions(institution_id, course_id, goal_id, what, why, who,
      due_date, status, progress, origin_type, origin_ref, origin_label, deliberation_id,
      responsible_user_id, created_by)
    values(p_institution_id,b.course_id,d.goal_id,d.subject,
      left('Deliberação '||coalesce(d.protocol,d.id::text)||': '||d.full_text,2000),
      nullif(btrim(d.responsible_name),''),d.due_date,'nao_iniciada',0,origin,d.id,
      'Deliberação '||coalesce(d.protocol,d.id::text),d.id,d.responsible_user_id,auth.uid())
    returning id into v_action_id;
  end if;
  update public.governance_deliberations set action_id=v_action_id,
    updated_at=now() where id=d.id and institution_id=p_institution_id;
  if not found then raise exception 'Deliberation link was not persisted' using errcode='23514'; end if;
  -- No implicit approval, goal creation, execution status or evidence completion.
  return v_action_id;
end $$;
revoke all on function public.governance_create_action(uuid,uuid) from public, anon;
grant execute on function public.governance_create_action(uuid,uuid) to authenticated;
comment on function public.governance_create_action(uuid,uuid) is
  'Atomically creates or recovers one institution-scoped action per eligible deliberation; preserves deliberation lifecycle.';
commit;
