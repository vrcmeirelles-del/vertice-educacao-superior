-- Correção das funções de encaminhamento da Governança 360° para o 5W2H.
-- CANDIDATA. NÃO APLICAR EM PRODUÇÃO SEM AUTORIZAÇÃO EXPRESSA.
-- Origem: migração 20261111010933_governance_360_phase3_routing_5w2h, aplicada só em produção
-- (SQL extraído em docs/automacao360/contratos-nativos/5w2h/). As seis funções falham hoje:
--  1. usam governance_deliberations.linked_action_id/linked_goal_id; as colunas reais são action_id/goal_id;
--  2. gravam vertice_action_governance.review_status = 'pendente', que a restrição não aceita;
--  3. checam só vínculo (qualquer papel, sem MFA) e, sendo SECURITY DEFINER, contornam a RLS;
--  4. não validam curso nem meta contra a IES.
-- Correção: mesmas assinaturas; papéis iguais às políticas nativas (vertice_actions_insert;
-- vertice_goals_insert para criar meta); member_role exige aal2; curso e meta conferidos na IES;
-- vertice_actions.deliberation_id preenchido; revisão inicial 'rascunho' (padrão nativo).
begin;

create or replace function vertice_private.governance_can_write(inst uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(vertice_private.member_role(inst) in ('master','gestor','equipe','reitor','diretor_geral','diretor_pedagogico','procurador'), false)
$$;
revoke all on function vertice_private.governance_can_write(uuid) from public, anon, authenticated;

create or replace function vertice_private.governance_course_ok(inst uuid, course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select course is null or exists (select 1 from public.vertice_courses c where c.id = course and c.institution_id = inst)
$$;
revoke all on function vertice_private.governance_course_ok(uuid, uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.governance_route_to_action(
  p_deliberation_id uuid, p_what text, p_why text DEFAULT NULL, p_where_at text DEFAULT NULL, p_who text DEFAULT NULL,
  p_how text DEFAULT NULL, p_how_much text DEFAULT NULL, p_start_date date DEFAULT NULL, p_due_date date DEFAULT NULL,
  p_responsible_user_id uuid DEFAULT NULL, p_course_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_action_id uuid; v_inst_id uuid; v_body_course_id uuid; v_goal_id uuid; v_delib_due date; v_delib_subject text; v_status text; v_course uuid;
BEGIN
  SELECT d.institution_id, d.goal_id, d.due_date, d.subject, d.status, b.course_id
  INTO v_inst_id, v_goal_id, v_delib_due, v_delib_subject, v_status, v_body_course_id
  FROM public.governance_deliberations d JOIN public.governance_bodies b ON b.id = d.body_id
  WHERE d.id = p_deliberation_id;
  IF v_inst_id IS NULL OR NOT vertice_private.governance_can_write(v_inst_id) THEN RAISE EXCEPTION 'acesso_negado' USING errcode = '42501'; END IF;
  v_course := COALESCE(p_course_id, v_body_course_id);
  IF NOT vertice_private.governance_course_ok(v_inst_id, v_course) THEN RAISE EXCEPTION 'curso_fora_da_instituicao' USING errcode = '22023'; END IF;
  IF p_responsible_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vertice_memberships m WHERE m.user_id = p_responsible_user_id AND m.institution_id = v_inst_id) THEN
    RAISE EXCEPTION 'responsavel_sem_vinculo' USING errcode = '22023';
  END IF;

  INSERT INTO public.vertice_actions (institution_id, course_id, goal_id, deliberation_id, what, why, where_at, who, how, how_much,
    start_date, due_date, status, progress, responsible_user_id, created_by, origin_type, origin_ref, origin_label)
  VALUES (v_inst_id, v_course, v_goal_id, p_deliberation_id, COALESCE(p_what, v_delib_subject),
    COALESCE(p_why, 'Deliberação colegiada: ' || v_delib_subject), p_where_at, p_who, p_how, p_how_much,
    COALESCE(p_start_date, current_date), COALESCE(p_due_date, v_delib_due), 'nao_iniciada', 0,
    p_responsible_user_id, auth.uid(), 'colegiado', p_deliberation_id, 'Deliberação colegiada')
  RETURNING id INTO v_action_id;

  UPDATE public.governance_deliberations SET action_id = v_action_id, status = 'encaminhada' WHERE id = p_deliberation_id;

  INSERT INTO public.governance_workflow_events (deliberation_id, institution_id, event_type, from_actor, to_actor, to_sector, status_before, status_after, event_note)
  VALUES (p_deliberation_id, v_inst_id, 'encaminhamento', auth.uid(), p_responsible_user_id, p_where_at, v_status, 'encaminhada',
    'Ação 5W2H criada: ' || COALESCE(p_what, v_delib_subject));

  INSERT INTO public.vertice_action_governance (action_id, institution_id, review_status) VALUES (v_action_id, v_inst_id, 'rascunho')
  ON CONFLICT (action_id) DO NOTHING;
  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.governance_link_to_goal(p_deliberation_id uuid, p_goal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_inst_id uuid; v_status text;
BEGIN
  SELECT institution_id, status INTO v_inst_id, v_status FROM public.governance_deliberations WHERE id = p_deliberation_id;
  IF v_inst_id IS NULL OR NOT vertice_private.governance_can_write(v_inst_id) THEN RAISE EXCEPTION 'acesso_negado' USING errcode = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vertice_goals WHERE id = p_goal_id AND institution_id = v_inst_id) THEN RAISE EXCEPTION 'meta_nao_encontrada' USING errcode = '22023'; END IF;
  UPDATE public.governance_deliberations SET goal_id = p_goal_id WHERE id = p_deliberation_id;
  INSERT INTO public.governance_workflow_events (deliberation_id, institution_id, event_type, from_actor, status_before, status_after, event_note)
  VALUES (p_deliberation_id, v_inst_id, 'vinculacao_meta', auth.uid(), v_status, v_status,
    'Vinculada à meta: ' || (SELECT title FROM public.vertice_goals WHERE id = p_goal_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.governance_route_to_goal_and_action(
  p_deliberation_id uuid, p_goal_title text, p_goal_indicator text, p_goal_target numeric,
  p_goal_direction text DEFAULT 'aumentar', p_goal_unit text DEFAULT NULL, p_goal_baseline numeric DEFAULT NULL,
  p_goal_due_date date DEFAULT NULL, p_goal_frequency text DEFAULT 'semestral', p_action_what text DEFAULT NULL,
  p_action_who text DEFAULT NULL, p_action_how text DEFAULT NULL, p_action_due_date date DEFAULT NULL,
  p_responsible_user_id uuid DEFAULT NULL, p_course_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_inst_id uuid; v_goal_id uuid; v_action_id uuid; v_subject text; v_body_course_id uuid; v_course uuid; v_status text;
BEGIN
  SELECT d.institution_id, d.subject, d.status, b.course_id INTO v_inst_id, v_subject, v_status, v_body_course_id
  FROM public.governance_deliberations d JOIN public.governance_bodies b ON b.id = d.body_id WHERE d.id = p_deliberation_id;
  -- Criar meta exige o mesmo papel da política nativa vertice_goals_insert (gestor; master).
  IF v_inst_id IS NULL OR NOT coalesce(vertice_private.member_role(v_inst_id) IN ('master','gestor'), false) THEN
    RAISE EXCEPTION 'acesso_negado' USING errcode = '42501';
  END IF;
  v_course := COALESCE(p_course_id, v_body_course_id);
  IF NOT vertice_private.governance_course_ok(v_inst_id, v_course) THEN RAISE EXCEPTION 'curso_fora_da_instituicao' USING errcode = '22023'; END IF;

  INSERT INTO public.vertice_goals (institution_id, course_id, title, indicator, target, direction, unit, baseline, due_date, frequency,
    owner_name, owner_user_id, status, created_by, origin_type, origin_ref)
  VALUES (v_inst_id, v_course, p_goal_title, p_goal_indicator, p_goal_target, p_goal_direction, p_goal_unit, p_goal_baseline,
    p_goal_due_date, p_goal_frequency, p_action_who, p_responsible_user_id, 'ativa', auth.uid(), 'colegiado', p_deliberation_id)
  RETURNING id INTO v_goal_id;

  UPDATE public.governance_deliberations SET goal_id = v_goal_id WHERE id = p_deliberation_id;

  INSERT INTO public.vertice_actions (institution_id, course_id, goal_id, deliberation_id, what, why, who, how,
    start_date, due_date, status, progress, responsible_user_id, created_by, origin_type, origin_ref, origin_label)
  VALUES (v_inst_id, v_course, v_goal_id, p_deliberation_id, COALESCE(p_action_what, v_subject), 'Deliberação colegiada: ' || v_subject,
    p_action_who, p_action_how, current_date, COALESCE(p_action_due_date, p_goal_due_date), 'nao_iniciada', 0,
    p_responsible_user_id, auth.uid(), 'colegiado', p_deliberation_id, 'Deliberação colegiada')
  RETURNING id INTO v_action_id;

  UPDATE public.governance_deliberations SET action_id = v_action_id, status = 'encaminhada' WHERE id = p_deliberation_id;
  INSERT INTO public.governance_workflow_events (deliberation_id, institution_id, event_type, from_actor, status_before, status_after, event_note)
  VALUES (p_deliberation_id, v_inst_id, 'encaminhamento', auth.uid(), v_status, 'encaminhada', 'Meta e ação 5W2H criadas: ' || p_goal_title);
  INSERT INTO public.vertice_action_governance (action_id, institution_id, review_status) VALUES (v_action_id, v_inst_id, 'rascunho')
  ON CONFLICT (action_id) DO NOTHING;
  RETURN jsonb_build_object('goal_id', v_goal_id, 'action_id', v_action_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.governance_batch_route(p_routes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_item jsonb; v_action_id uuid; v_results jsonb := '[]'::jsonb; v_inst_id uuid;
BEGIN
  IF jsonb_typeof(p_routes) <> 'array' OR jsonb_array_length(p_routes) > 200 THEN RAISE EXCEPTION 'lote_invalido' USING errcode = '22023'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_routes) LOOP
    BEGIN
      SELECT institution_id INTO v_inst_id FROM public.governance_deliberations WHERE id = (v_item->>'deliberation_id')::uuid;
      IF v_inst_id IS NULL OR NOT vertice_private.governance_can_write(v_inst_id) THEN
        v_results := v_results || jsonb_build_object('deliberation_id', v_item->>'deliberation_id', 'error', 'acesso_negado');
        CONTINUE;
      END IF;
      -- A meta informada no lote precisa ser da mesma IES (antes não era conferida).
      IF v_item ? 'goal_id' AND v_item->>'goal_id' IS NOT NULL THEN
        PERFORM public.governance_link_to_goal((v_item->>'deliberation_id')::uuid, (v_item->>'goal_id')::uuid);
      END IF;
      v_action_id := public.governance_route_to_action(
        (v_item->>'deliberation_id')::uuid, v_item->>'what',
        p_why := v_item->>'why', p_who := v_item->>'who',
        p_due_date := CASE WHEN v_item ? 'due_date' THEN (v_item->>'due_date')::date ELSE NULL END,
        p_responsible_user_id := CASE WHEN v_item ? 'responsible_user_id' THEN (v_item->>'responsible_user_id')::uuid ELSE NULL END);
      v_results := v_results || jsonb_build_object('deliberation_id', v_item->>'deliberation_id', 'action_id', v_action_id, 'status', 'ok');
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('deliberation_id', v_item->>'deliberation_id', 'error', SQLERRM);
    END;
  END LOOP;
  RETURN v_results;
END;
$$;

CREATE OR REPLACE FUNCTION public.governance_deliberation_trace(p_deliberation_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_inst_id uuid; v_delib jsonb; v_action jsonb; v_goal jsonb; v_events jsonb; v_evidence jsonb; v_action_gov jsonb; v_action_id uuid; v_goal_id uuid;
BEGIN
  SELECT institution_id, action_id, goal_id INTO v_inst_id, v_action_id, v_goal_id FROM public.governance_deliberations WHERE id = p_deliberation_id;
  IF v_inst_id IS NULL OR vertice_private.member_role(v_inst_id) IS NULL THEN RAISE EXCEPTION 'acesso_negado' USING errcode = '42501'; END IF;
  SELECT jsonb_build_object('deliberation', to_jsonb(d.*),
    'body', jsonb_build_object('name', gb.name, 'acronym', gb.acronym, 'body_type', gb.body_type),
    'meeting', CASE WHEN gm.id IS NOT NULL THEN jsonb_build_object('scheduled_date', gm.scheduled_date, 'meeting_type', gm.meeting_type, 'meeting_number', gm.meeting_number) ELSE NULL END)
  INTO v_delib FROM public.governance_deliberations d JOIN public.governance_bodies gb ON gb.id = d.body_id
  LEFT JOIN public.governance_meetings gm ON gm.id = d.meeting_id WHERE d.id = p_deliberation_id;
  SELECT to_jsonb(a.*) INTO v_action FROM public.vertice_actions a WHERE a.id = v_action_id AND a.institution_id = v_inst_id;
  SELECT to_jsonb(g.*) INTO v_goal FROM public.vertice_goals g WHERE g.id = v_goal_id AND g.institution_id = v_inst_id;
  SELECT to_jsonb(ag.*) INTO v_action_gov FROM public.vertice_action_governance ag WHERE ag.action_id = v_action_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(e.*) ORDER BY e.occurred_at), '[]'::jsonb) INTO v_events FROM public.governance_workflow_events e WHERE e.deliberation_id = p_deliberation_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(ev.*)), '[]'::jsonb) INTO v_evidence FROM public.governance_evidence ev WHERE ev.deliberation_id = p_deliberation_id;
  RETURN jsonb_build_object('deliberation', v_delib, 'linked_action', v_action, 'linked_goal', v_goal,
    'action_governance', v_action_gov, 'workflow_events', v_events, 'evidence', v_evidence);
END;
$$;

CREATE OR REPLACE FUNCTION public.governance_traceability_report(p_institution_id uuid, p_body_id uuid DEFAULT NULL, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF vertice_private.member_role(p_institution_id) IS NULL THEN RAISE EXCEPTION 'acesso_negado' USING errcode = '42501'; END IF;
  WITH base AS (
    SELECT * FROM public.governance_deliberations
    WHERE institution_id = p_institution_id AND (p_body_id IS NULL OR body_id = p_body_id)
      AND (p_date_from IS NULL OR created_at >= p_date_from) AND (p_date_to IS NULL OR created_at <= p_date_to + interval '1 day'))
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_date_from, 'to', p_date_to),
    -- Taxas sem denominador ficam nulas: ausência de dado não vira zero.
    'summary', (SELECT jsonb_build_object('total_deliberations', count(*),
        'routed_to_action', count(*) FILTER (WHERE action_id IS NOT NULL), 'linked_to_goal', count(*) FILTER (WHERE goal_id IS NOT NULL),
        'completed', count(*) FILTER (WHERE status = 'concluida'),
        'overdue', count(*) FILTER (WHERE due_date < current_date AND status NOT IN ('concluida','cancelada')),
        'pending_routing', count(*) FILTER (WHERE status = 'registrada' AND action_id IS NULL),
        'routing_rate', CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE action_id IS NOT NULL)::numeric / count(*) * 100, 1) END,
        'completion_rate', CASE WHEN count(*) FILTER (WHERE action_id IS NOT NULL) > 0
          THEN round(count(*) FILTER (WHERE status = 'concluida')::numeric / count(*) FILTER (WHERE action_id IS NOT NULL) * 100, 1) END) FROM base),
    'by_body', (SELECT COALESCE(jsonb_agg(jsonb_build_object('body_name', gb.name, 'body_acronym', gb.acronym, 'total', c.total,
        'routed', c.routed, 'completed', c.completed, 'routing_rate', c.routing_rate) ORDER BY gb.name), '[]'::jsonb)
      FROM (SELECT body_id, count(*) total, count(*) FILTER (WHERE action_id IS NOT NULL) routed, count(*) FILTER (WHERE status = 'concluida') completed,
              round(count(*) FILTER (WHERE action_id IS NOT NULL)::numeric / count(*) * 100, 1) routing_rate FROM base GROUP BY body_id) c
      JOIN public.governance_bodies gb ON gb.id = c.body_id),
    'by_status', (SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb) FROM (SELECT status, count(*) cnt FROM base GROUP BY status) s)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

revoke all on function public.governance_route_to_action(uuid, text, text, text, text, text, text, date, date, uuid, uuid) from public, anon;
revoke all on function public.governance_link_to_goal(uuid, uuid) from public, anon;
revoke all on function public.governance_route_to_goal_and_action(uuid, text, text, numeric, text, text, numeric, date, text, text, text, text, date, uuid, uuid) from public, anon;
revoke all on function public.governance_batch_route(jsonb) from public, anon;
revoke all on function public.governance_deliberation_trace(uuid) from public, anon;
revoke all on function public.governance_traceability_report(uuid, uuid, date, date) from public, anon;
grant execute on function public.governance_route_to_action(uuid, text, text, text, text, text, text, date, date, uuid, uuid) to authenticated;
grant execute on function public.governance_link_to_goal(uuid, uuid) to authenticated;
grant execute on function public.governance_route_to_goal_and_action(uuid, text, text, numeric, text, text, numeric, date, text, text, text, text, date, uuid, uuid) to authenticated;
grant execute on function public.governance_batch_route(jsonb) to authenticated;
grant execute on function public.governance_deliberation_trace(uuid) to authenticated;
grant execute on function public.governance_traceability_report(uuid, uuid, date, date) to authenticated;

commit;
