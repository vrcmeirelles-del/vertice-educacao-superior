-- Automação 360°: regra goal.unmeasured (meta sem medição no período da sua frequência), família planning.
-- Depende de 20261125190000_metas_medicao_indices (medição automática das metas de checklist).
-- O leitor vertice_automation_source_planning parte do texto vigente em produção (mesmo hash do repositório,
-- 25/11/2026) e só acrescenta um registro agregado por escopo; pei.overdue e cpa.pending não mudam.
begin;
insert into vertice_automation.rules(id, version, module, priority, cadence, family, source_status) values
  ('goal.unmeasured', '2026.11-goals.1', 'Metas e Indicadores', 'P1', 'weekly', 'planning', 'identificada');

create or replace function public.vertice_automation_source_planning(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_records jsonb;
begin
  if not (auth.role() = 'service_role' or vertice_private.automation_can(p_institution, p_course, 'read')) then
    raise exception 'acesso negado ou MFA pendente' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(r order by r->>'ruleId', r->>'entityId'), '[]'::jsonb) into v_records from (
    select jsonb_build_object('institutionId', g.institution_id, 'courseId', g.course_id, 'entityId', g.id::text, 'ruleId', 'pei.overdue', 'state', 'open',
             'revision', left(md5(coalesce(string_agg(a.id::text || ':' || a.status || ':' || coalesce(a.due_date::text, ''), ',' order by a.id), '')), 32),
             'metrics', jsonb_build_object('overdueActions', count(a.id))) r
    from public.vertice_goals g
    left join public.vertice_actions a on a.goal_id = g.id and a.institution_id = g.institution_id
      and a.due_date < current_date and a.status not in ('concluida','cancelada')
    where g.institution_id = p_institution and g.course_id is not distinct from p_course and g.status = 'ativa'
    group by g.id, g.institution_id, g.course_id
    union all
    select jsonb_build_object('institutionId', p_institution, 'courseId', null, 'entityId', f.id::text, 'ruleId', 'cpa.pending', 'state', 'open',
             'revision', left(md5(coalesce(string_agg(x.id::text || ':' || x.status || ':' || (x.evidence_description is not null or x.evidence_url is not null)::text, ',' order by x.id), '')), 32),
             'metrics', jsonb_build_object('missingEvidence', count(x.id) filter (where x.status = 'executada' and nullif(btrim(coalesce(x.evidence_description, '')), '') is null and nullif(btrim(coalesce(x.evidence_url, '')), '') is null))) r
    from public.vertice_cpa_findings f
    join public.vertice_cpa_actions x on x.finding_id = f.id and x.institution_id = f.institution_id
    where p_course is null and f.institution_id = p_institution
    group by f.id
    union all
    -- goal.unmeasured (goal-unmeasured-v1): metas abertas do escopo com medição atrasada para a própria
    -- frequência. Metas de checklist ficam fora: são medidas todo dia pela rotina meta-checklist-v1, que só
    -- grava quando o valor muda. Frequência não reconhecida não conta como atraso (vai em goalsWithoutFrequency).
    select jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'entityId', 'goals:' || coalesce(p_course::text, 'ies'),
             'ruleId', 'goal.unmeasured', 'state', 'open',
             'revision', left(md5(coalesce(string_agg(m.id::text || ':' || coalesce(m.last_on::text, '') || ':' || coalesce(m.window_days::text, ''), ',' order by m.id), '')), 32),
             'metrics', jsonb_build_object(
               'unmeasuredGoals', count(*) filter (where m.window_days is not null and coalesce(m.last_on, m.created_on) < current_date - m.window_days),
               'goalsWithoutFrequency', count(*) filter (where m.window_days is null),
               'eligibleGoals', count(*))) r
    from (
      select g.id, g.created_at::date created_on,
        (select max(x.measured_on) from public.vertice_goal_measurements x where x.goal_id = g.id) last_on,
        case lower(coalesce(g.frequency, '')) when 'mensal' then 31 when 'bimestral' then 62 when 'trimestral' then 92
          when 'quadrimestral' then 123 when 'semestral' then 183 when 'anual' then 366 end window_days
      from public.vertice_goals g
      where g.institution_id = p_institution and g.course_id is not distinct from p_course
        and coalesce(g.status, '') not in ('concluida', 'cancelada')
        and coalesce(g.formula, '') not like '100 × itens aplicáveis concluídos e conferidos%'
    ) m
    having count(*) > 0
  ) s;
  if jsonb_array_length(v_records) > 10000 then raise exception 'volume acima do lote: paginar antes de habilitar' using errcode = '54000'; end if;
  return jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'sourceId', 'planning-cpa',
    'observedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'complete', true, 'records', v_records);
end $$;

revoke all on function public.vertice_automation_source_planning(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vertice_automation_source_planning(uuid, uuid) to service_role;
commit;
