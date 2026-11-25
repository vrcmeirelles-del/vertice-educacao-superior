-- Automação 360° — adaptadores de leitura das famílias acadêmica e estratégica (somente service_role).
-- Só metadados (ids, datas, contagens); nenhum nome, texto livre ou dado pessoal.
-- Cobertura deliberadamente parcial; o executor marca como "sem adaptador" o que não está aqui:
--   acadêmica: tcc.due/overdue (prazo da etapa), internship.due/overdue (prazo do relatório),
--              teaching.documents (checklist teaching-docs-v1: fotos, lista de presença, relatório).
--   estratégica: alumni.pending (convites entregues sem resposta, pesquisas reais e abertas) e
--                competition.change (achados aprovados por pessoa e ainda sem ação vinculada).
-- Pesquisas marcadas como sintéticas (is_synthetic) ficam fora: teste não vira dado institucional.
begin;

create or replace function public.vertice_automation_source_academic(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'); v_entries jsonb;
begin
  if not (auth.role() = 'service_role') then raise exception 'acesso negado' using errcode = '42501'; end if;
  if p_course is null then raise exception 'escopo de curso obrigatório' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(e order by e->>'module', e->>'id'), '[]'::jsonb) into v_entries from (
    -- TCC: prazo da etapa atual.
    select jsonb_build_object('institutionId', w.institution_id, 'courseId', w.course_id, 'module', 'tcc', 'id', 'tcc:' || w.id,
      'revision', left(md5(concat_ws('|', w.stage, w.stage_deadline, w.version, w.updated_at)), 32),
      'status', case when w.stage = 'changes_requested' then 'returned'
                     when w.stage in ('final_validated','deposited','archived') then 'closed'
                     when w.stage in ('suspended','cancelled') then 'cancelled' else 'open' end,
      'dueDate', to_char(w.stage_deadline, 'YYYY-MM-DD'), 'observedAt', v_now) e
    from public.vertice_tcc_works w
    where w.institution_id = p_institution and w.course_id = p_course
    union all
    -- Estágio: prazo de cada relatório, pelo curso do vínculo.
    select jsonb_build_object('institutionId', p.institution_id, 'courseId', p.course_id, 'module', 'internship', 'id', 'report:' || r.id,
      'revision', left(md5(concat_ws('|', r.status, r.due_date, r.submitted_at, r.reviewed_at)), 32),
      'status', case r.status when 'draft' then 'open' when 'revision_requested' then 'returned'
                              when 'submitted' then 'submitted' else 'validated' end,
      'dueDate', to_char(r.due_date, 'YYYY-MM-DD'), 'observedAt', v_now)
    from public.vertice_internship_reports r
    join public.vertice_internship_placements p on p.id = r.placement_id and p.institution_id = r.institution_id
    where r.institution_id = p_institution and p.course_id = p_course and p.lifecycle <> 'cancelled'
    union all
    -- Atividades de Ensino já realizadas e não validadas: checklist versionado de evidências.
    select jsonb_build_object('institutionId', a.institution_id, 'courseId', a.course_id, 'module', 'teaching', 'id', 'teaching:' || a.id,
      'revision', left(md5(concat_ws('|', a.status, a.updated_at, a.report_submitted_at)), 32),
      'status', case a.status when 'validada' then 'validated' else 'open' end, 'observedAt', v_now,
      'checklistComplete', true, 'checklistVersion', 'teaching-docs-v1',
      'requiredEvidence', '["fotos","presenca","relatorio"]'::jsonb,
      'linkedEvidence', to_jsonb(array_remove(array[
        case when jsonb_typeof(a.evidence_photos) = 'array' and jsonb_array_length(a.evidence_photos) > 0 then 'fotos' end,
        case when jsonb_typeof(a.evidence_attendance) = 'array' and jsonb_array_length(a.evidence_attendance) > 0 then 'presenca' end,
        case when a.report_submitted_at is not null then 'relatorio' end], null)))
    from public.vertice_teaching_activities a
    where a.institution_id = p_institution and a.course_id = p_course and a.activity_date <= current_date
  ) s;
  if jsonb_array_length(v_entries) > 2000 then raise exception 'volume acima do lote: paginar antes de habilitar' using errcode = '54000'; end if;
  return jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'id', 'academic-v1', 'observedAt', v_now, 'complete', true, 'entries', v_entries);
end $$;

create or replace function public.vertice_automation_source_strategic(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_now timestamptz := date_trunc('second', now()); v_iso text; v_entries jsonb;
begin
  if not (auth.role() = 'service_role') then raise exception 'acesso negado' using errcode = '42501'; end if;
  v_iso := to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  select coalesce(jsonb_agg(e order by e->>'module', e->>'id'), '[]'::jsonb) into v_entries from (
    -- Egressos: convites entregues/enviados ainda sem resposta, por pesquisa real e aberta.
    select jsonb_build_object('institutionId', s.institution_id, 'courseId', s.course_id, 'module', 'alumni', 'id', 'survey:' || s.id,
      'revision', left(md5(concat_ws('|', s.status, s.closes_at, count(i.id), count(i.responded_at))), 32),
      'status', 'open', 'observedAt', v_iso, 'complete', true, 'definitionVersion', 'alumni-pending-v1',
      'windowStart', to_char(least(date_trunc('second', s.opens_at), v_now - interval '1 second') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'windowEnd', to_char(least(v_now, coalesce(s.closes_at, v_now)) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'metrics', jsonb_build_object('pendingSurveys', count(i.id) filter (where i.responded_at is null and i.delivery_status in ('enviado','entregue')))) e
    from public.vertice_alumni_surveys s
    left join public.vertice_alumni_survey_invitations i on i.survey_id = s.id
    where s.institution_id = p_institution and s.course_id is not distinct from p_course
      and s.status = 'ativa' and not coalesce(s.is_synthetic, false) and s.opens_at < v_now
      and (s.closes_at is null or s.closes_at > s.opens_at)
    group by s.id
    union all
    -- Concorrência: achados aprovados por pessoa (status approved) e ainda sem ação 5W2H vinculada.
    select jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'module', 'competition',
      'id', 'competition:' || coalesce(p_course::text, 'ies'),
      'revision', left(md5(coalesce(string_agg(f.id::text || ':' || f.status || ':' || coalesce(f.action_id::text, ''), ',' order by f.id), '')), 32),
      'status', 'validated', 'observedAt', v_iso, 'complete', true, 'definitionVersion', 'competition-approved-v1',
      'windowStart', to_char(least(date_trunc('second', min(f.created_at)), v_now - interval '1 second') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'windowEnd', v_iso, 'verified', true,
      'reviewId', 'findings:' || left(md5(coalesce(string_agg(f.id::text, ',' order by f.id) filter (where f.status = 'approved'), 'nenhum')), 16),
      'metrics', jsonb_build_object('confirmedChanges', count(f.id) filter (where f.status = 'approved' and f.action_id is null)))
    from vertice_planning.competitive_findings f
    where f.institution_id = p_institution and f.course_id is not distinct from p_course
    having count(f.id) > 0
  ) x;
  return jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'id', 'strategic-v1', 'observedAt', v_iso, 'complete', true, 'entries', v_entries);
end $$;

revoke all on function public.vertice_automation_source_academic(uuid, uuid) from public, anon, authenticated;
revoke all on function public.vertice_automation_source_strategic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vertice_automation_source_academic(uuid, uuid) to service_role;
grant execute on function public.vertice_automation_source_strategic(uuid, uuid) to service_role;

-- market.new: sightings não têm estado de revisão por IES; a fonte passa a 'pendente' (source-map.mjs).
update vertice_automation.rules set source_status = 'pendente' where id = 'market.new';
commit;
