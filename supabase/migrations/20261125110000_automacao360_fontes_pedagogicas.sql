-- Automação 360° — adaptador de leitura da família pedagógica (somente service_role, escopo de curso).
-- Só agregados e identificadores; nenhum dado individual de estudante sai do banco.
--   curriculum.gap: matriz publicada mais recente do curso. Exigidas = competências da matriz;
--     cobertas = competências com ao menos uma disciplina vinculada. Publicar é decisão do NDE.
--   avalia.recovery: planos de recuperação ativos, por versão de regra do Avalia (motor existente).
--   retention.alert: alertas do motor de Permanência já atribuídos ou em andamento (triados por
--     pessoa), por versão de regra. Alertas em aberto, não triados, não contam.
--   sapiens.low fica sem adaptador: vertice_learning_course_metrics não registra validação humana
--     nem separa nota provisória (diretriz: nota provisória não entra no diagnóstico).
begin;

create or replace function public.vertice_automation_source_pedagogical(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'); v_groups jsonb;
begin
  if not (auth.role() = 'service_role') then raise exception 'acesso negado' using errcode = '42501'; end if;
  if p_course is null then raise exception 'escopo de curso obrigatório' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(g order by g->>'ruleId', g->>'id'), '[]'::jsonb) into v_groups from (
    -- Construção Curricular: última matriz publicada do curso.
    select jsonb_build_object('institutionId', b.institution_id, 'courseId', b.course_id, 'ruleId', 'curriculum.gap',
      'id', 'build:' || b.id, 'revision', left(md5(concat_ws('|', b.version, b.updated_at, c.req, c.cov)), 32),
      'status', 'validated', 'provisional', false, 'reviewId', 'build:' || b.id || ':v' || b.version, 'observedAt', v_now,
      'matrixKind', 'curriculum', 'matrixVersion', 'v' || b.version, 'mappingComplete', true,
      'required', coalesce(c.req, '[]'::jsonb), 'covered', coalesce(c.cov, '[]'::jsonb)) g
    from (select distinct on (x.course_id) x.* from vertice_app.curriculum_builds x
          where x.institution_id = p_institution and x.course_id = p_course and x.status = 'published'
          order by x.course_id, x.version desc) b
    cross join lateral (
      select jsonb_agg(k.id::text order by k.id) req,
             jsonb_agg(k.id::text order by k.id) filter (where exists (select 1 from vertice_app.curriculum_discipline_links l where l.competency_id = k.id)) cov
      from vertice_app.curriculum_competencies k where k.build_id = b.id) c
    where c.req is not null
    union all
    -- Avalia 360°: planos de recuperação ativos, por versão de regra.
    select jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'ruleId', 'avalia.recovery',
      'id', 'recovery:' || r.rules_version, 'revision', left(md5(string_agg(r.id::text || ':' || r.updated_at, ',' order by r.id)), 32),
      'status', 'validated', 'provisional', false, 'reviewId', 'plans:' || left(md5(string_agg(r.id::text, ',' order by r.id)), 16),
      'observedAt', v_now, 'existingEngineVerified', true, 'engineVersion', r.rules_version,
      'pendingRecovery', count(*) filter (where r.status = 'active'))
    from public.vertice_avalia_recovery_plans r
    where r.institution_id = p_institution and r.course_id = p_course and r.rules_version ~ '^[a-zA-Z0-9:._-]{1,150}$'
    group by r.rules_version
    union all
    -- Permanência: alertas triados por pessoa (atribuídos ou em andamento), por versão de regra.
    select jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'ruleId', 'retention.alert',
      'id', 'retention:' || a.rule_version, 'revision', left(md5(string_agg(a.id::text || ':' || a.status, ',' order by a.id)), 32),
      'status', 'validated', 'provisional', false, 'reviewId', 'triage:' || left(md5(string_agg(a.id::text || ':' || a.status, ',' order by a.id)), 16),
      'observedAt', v_now, 'existingEngineVerified', true, 'engineVersion', a.rule_version,
      'confirmedAlerts', count(*) filter (where a.status in ('assigned','in_progress')))
    from vertice_app.alerts a
    where a.institution_id = p_institution and a.course_id = p_course and a.rule_version ~ '^[a-zA-Z0-9:._-]{1,150}$'
    group by a.rule_version
  ) s;
  if jsonb_array_length(v_groups) > 2500 then raise exception 'volume acima do lote: paginar antes de habilitar' using errcode = '54000'; end if;
  return jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'id', 'pedagogical-v1', 'observedAt', v_now, 'complete', true, 'groups', v_groups);
end $$;

revoke all on function public.vertice_automation_source_pedagogical(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vertice_automation_source_pedagogical(uuid, uuid) to service_role;
commit;
