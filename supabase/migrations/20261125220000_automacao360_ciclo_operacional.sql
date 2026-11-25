-- Automação 360°: ciclo operacional completo, sem IA e sem substituir decisão humana.
--
-- 1. Homologação da fonte por regra. Só Master com MFA (vertice_admins + aal2) marca a fonte de uma regra
--    como validada, com justificativa; pode também revogar. Antes disso, a regra fica "bloqueada" no painel
--    e o modo operacional não abre alerta para ela (o painel já prometia isso; agora o banco garante).
-- 2. Baixa na fonte. Quando uma execução operacional avalia uma regra com fonte completa e limpa (sem
--    registro recusado) e a ocorrência não aparece mais, o alerta ainda sem decisão humana passa a
--    'resolved'. Alerta já aprovado ou em execução não muda de estado: recebe um registro na trilha
--    ("ocorrência não encontrada na fonte") para quem decidiu encerrar ou concluir. Se a mesma ocorrência
--    voltar, o alerta baixado reabre para revisão, com trilha.
-- 3. Painel: a fila mostra responsável, prazo, ação 5W2H vinculada e o aviso de fonte normalizada; conta
--    as baixas dos últimos 30 dias.
--
-- Parte do texto vigente em produção (mesmo hash do repositório em 25/11/2026). Sem 'evaluatedRules' no
-- recibo, record_run se comporta como antes (nenhuma baixa).

-- Estado novo do alerta.
alter table vertice_automation.alert drop constraint alert_status_check;
alter table vertice_automation.alert add constraint alert_status_check
  check (status = any (array['pending_review','approved','rejected','in_progress','completed','verified','closed_admin','resolved']));

-- Quem homologou a fonte, quando e por quê.
alter table vertice_automation.rules
  add column source_validated_by uuid,
  add column source_validated_at timestamptz,
  add column source_validation_note text check (source_validation_note is null or length(source_validation_note) between 5 and 2000);

-- Homologação (ou revogação) da fonte de uma regra. Fonte pendente não pode ser validada.
create function public.vertice_automation_validate_source(p_rule text, p_validate boolean, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare r vertice_automation.rules; v_to text;
begin
  if not vertice_private.is_master() then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then raise exception 'justificativa obrigatória' using errcode = '22023'; end if;
  select * into r from vertice_automation.rules where id = p_rule for update;
  if r.id is null then raise exception 'regra desconhecida' using errcode = '22023'; end if;
  if p_validate then
    if r.source_status <> 'identificada' then raise exception 'somente fonte identificada pode ser validada' using errcode = '22023'; end if;
    v_to := 'validada';
  else
    if r.source_status <> 'validada' then raise exception 'fonte não está validada' using errcode = '22023'; end if;
    v_to := 'identificada';
  end if;
  update vertice_automation.rules set source_status = v_to,
    source_validated_by = case when p_validate then auth.uid() else null end,
    source_validated_at = case when p_validate then now() else null end,
    source_validation_note = btrim(p_reason)
  where id = r.id;
  return v_to;
end $$;

create or replace function public.vertice_automation_record_run(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_run uuid := (p_payload->>'runId')::uuid; v_existing text; c vertice_automation.config_revision;
  v_eval text[]; v_keys text[]; a record; v_re vertice_automation.alert; v_resolved integer := 0; v_cleared integer := 0;
begin
  select digest into v_existing from vertice_automation.run where run_id = v_run;
  if v_existing is not null then
    if v_existing = p_payload->>'digest' then return jsonb_build_object('runId', v_run, 'digest', v_existing, 'status', 'existing'); end if;
    raise exception 'run_id existente com digest diferente' using errcode = '23505';
  end if;
  c := vertice_automation.current_config((p_payload->>'institutionId')::uuid, nullif(p_payload->>'courseId', '')::uuid);
  if c.id is null or c.revision <> (p_payload->>'configRevision')::integer then
    raise exception 'configuração vigente divergente' using errcode = '40001';
  end if;
  begin
    insert into vertice_automation.run(run_id, config_id, institution_id, course_id, mode, as_of, status, digest, source_count, unmapped_count, alert_count, duration_ms)
    values (v_run, c.id, c.institution_id, c.course_id, c.mode, (p_payload->>'asOf')::timestamptz, p_payload->>'status', p_payload->>'digest',
            (p_payload->>'sourceCount')::integer, (p_payload->>'unmappedCount')::integer, jsonb_array_length(coalesce(p_payload->'alerts', '[]')),
            nullif(p_payload->>'durationMs', '')::integer);
  exception when unique_violation then
    -- Gravação concorrente do mesmo run_id venceu: confirma se for o mesmo recibo.
    select digest into v_existing from vertice_automation.run where run_id = v_run;
    if v_existing = p_payload->>'digest' then return jsonb_build_object('runId', v_run, 'digest', v_existing, 'status', 'existing'); end if;
    raise exception 'run_id existente com digest diferente' using errcode = '23505';
  end;
  for r in select * from jsonb_array_elements(coalesce(p_payload->'alerts', '[]')) loop
    if not ((r->>'rule') = any(c.rule_ids)) then raise exception 'regra fora da configuração' using errcode = '22023'; end if;
    if not exists (select 1 from vertice_automation.rules x where x.id = r->>'rule' and x.version = r->>'version' and x.priority = r->>'priority') then
      raise exception 'versão ou prioridade divergente do catálogo' using errcode = '22023';
    end if;
    insert into vertice_automation.run_alert(run_id, alert_key, rule_id, rule_version, priority) values (v_run, r->>'key', r->>'rule', r->>'version', r->>'priority');
    -- Sombra nunca vira fila operacional; no modo operacional, só regra com fonte homologada abre alerta.
    if c.mode = 'operational' and exists (select 1 from vertice_automation.rules x where x.id = r->>'rule' and x.source_status = 'validada') then
      insert into vertice_automation.alert(institution_id, course_id, rule_id, rule_version, priority, idempotency_key, source_run)
      values (c.institution_id, c.course_id, r->>'rule', r->>'version', r->>'priority', r->>'key', v_run)
      on conflict (institution_id, course_id, idempotency_key) do nothing;
      -- A mesma ocorrência voltou depois de baixada na fonte: reabre para revisão, com trilha.
      update vertice_automation.alert x set status = 'pending_review', revision = x.revision + 1, updated_at = now()
      where x.institution_id = c.institution_id and x.course_id is not distinct from c.course_id and x.idempotency_key = r->>'key' and x.status = 'resolved'
      returning x.* into v_re;
      if v_re.id is not null then
        perform vertice_automation.log(v_re.institution_id, v_re.course_id, 'alert', v_re.id::text, 'reopen', 'resolved', 'pending_review',
          'Ocorrência voltou a aparecer na fonte na execução ' || v_run, null);
        v_re := null;
      end if;
    end if;
  end loop;
  -- Baixa na fonte: só para regras que o executor declarou avaliadas com fonte completa e limpa.
  if c.mode = 'operational' and jsonb_typeof(p_payload->'evaluatedRules') = 'array' then
    select coalesce(array_agg(x), '{}') into v_eval from jsonb_array_elements_text(p_payload->'evaluatedRules') x;
    if exists (select 1 from unnest(v_eval) x where not (x = any(c.rule_ids))) then raise exception 'regra avaliada fora da configuração' using errcode = '22023'; end if;
    select coalesce(array_agg(alert_key), '{}') into v_keys from vertice_automation.run_alert where run_id = v_run;
    for a in select * from vertice_automation.alert x
             where x.institution_id = c.institution_id and x.course_id is not distinct from c.course_id
               and x.rule_id = any(v_eval) and not (x.idempotency_key = any(v_keys))
               and x.status in ('pending_review','approved','in_progress') for update loop
      if a.status = 'pending_review' then
        update vertice_automation.alert set status = 'resolved', revision = revision + 1, updated_at = now() where id = a.id;
        perform vertice_automation.log(a.institution_id, a.course_id, 'alert', a.id::text, 'resolve', 'pending_review', 'resolved',
          'Ocorrência não encontrada na fonte na execução ' || v_run, null);
        v_resolved := v_resolved + 1;
      elsif not exists (select 1 from vertice_automation.event e where e.entity = 'alert' and e.entity_ref = a.id::text and e.action = 'source_cleared') then
        perform vertice_automation.log(a.institution_id, a.course_id, 'alert', a.id::text, 'source_cleared', a.status, a.status,
          'Ocorrência não encontrada na fonte na execução ' || v_run || '; decisão de concluir ou encerrar segue com o responsável', null);
        v_cleared := v_cleared + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('runId', v_run, 'digest', p_payload->>'digest', 'status', 'inserted', 'resolved', v_resolved, 'sourceCleared', v_cleared);
end $$;

create or replace function public.vertice_automation_dashboard(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c vertice_automation.config_revision; v_last vertice_automation.run;
begin
  if not vertice_private.automation_can(p_institution, p_course, 'read') then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  c := vertice_automation.current_config(p_institution, p_course);
  select * into v_last from vertice_automation.run where institution_id = p_institution and course_id is not distinct from p_course order by recorded_at desc limit 1;
  return jsonb_build_object(
    'institutionId', p_institution, 'courseId', p_course, 'readOnly', false,
    'config', case when c.id is null then null else jsonb_build_object('revision', c.revision, 'enabled', c.enabled, 'mode', c.mode, 'ruleIds', to_jsonb(c.rule_ids), 'approvedAt', c.approved_at) end,
    'pendingConfig', (select jsonb_build_object('id', p.id, 'revision', p.revision, 'mode', p.mode) from vertice_automation.config_revision p
                      where p.institution_id = p_institution and p.course_id is not distinct from p_course and p.approved_by is null
                        and p.revision > coalesce(c.revision, 0) order by p.revision desc limit 1),
    'rules', (select jsonb_agg(jsonb_build_object('id', r.id, 'version', r.version, 'module', r.module, 'priority', r.priority, 'cadence', r.cadence,
                'sourceStatus', r.source_status,
                'state', case when c.id is null or not (r.id = any(c.rule_ids)) then 'inactive' when not c.enabled then 'inactive'
                              when r.source_status <> 'validada' then 'blocked' when c.mode = 'shadow' then 'shadow' else 'active' end) order by r.module, r.id)
              from vertice_automation.rules r),
    'lastRun', case when v_last.run_id is null then null else jsonb_build_object('at', v_last.recorded_at, 'asOf', v_last.as_of, 'status', v_last.status, 'mode', v_last.mode, 'alerts', v_last.alert_count, 'durationMs', v_last.duration_ms) end,
    'pending', case when c.mode = 'operational' and c.enabled then (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'ruleId', a.rule_id, 'priority', a.priority, 'status', a.status, 'revision', a.revision,
                      'ownerId', a.owner_id, 'dueAt', a.due_at, 'createdAt', a.created_at,
                      'actionId', (select v.id from public.vertice_actions v where v.origin_type = 'automacao_360' and v.origin_ref = a.id),
                      'sourceCleared', exists (select 1 from vertice_automation.event e where e.entity = 'alert' and e.entity_ref = a.id::text and e.action = 'source_cleared'))
                      order by a.priority, a.created_at), '[]'::jsonb)
                    from vertice_automation.alert a where a.institution_id = p_institution and a.course_id is not distinct from p_course and a.status in ('pending_review','approved','in_progress','completed')) else null end,
    'resolvedLast30', (select count(*) from vertice_automation.alert a where a.institution_id = p_institution and a.course_id is not distinct from p_course
                         and a.status = 'resolved' and a.updated_at > now() - interval '30 days'),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('at', e.at, 'entity', e.entity, 'action', e.action, 'to', e.to_status) order by e.id desc), '[]'::jsonb)
               from (select * from vertice_automation.event where institution_id = p_institution and course_id is not distinct from p_course order by id desc limit 20) e)
  );
end $$;

revoke all on function public.vertice_automation_validate_source(text, boolean, text) from public, anon;
grant execute on function public.vertice_automation_validate_source(text, boolean, text) to authenticated;
