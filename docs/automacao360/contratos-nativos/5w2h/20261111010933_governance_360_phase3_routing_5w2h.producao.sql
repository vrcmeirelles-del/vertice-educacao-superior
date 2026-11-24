
-- ============================================================
-- GOVERNANÇA 360° — FASE 3: Encaminhamento e Integração 5W2H
-- ============================================================

-- 1. Encaminhar deliberação → criar ação 5W2H vinculada
CREATE OR REPLACE FUNCTION public.governance_route_to_action(
  p_deliberation_id uuid,
  p_what text,
  p_why text DEFAULT NULL,
  p_where_at text DEFAULT NULL,
  p_who text DEFAULT NULL,
  p_how text DEFAULT NULL,
  p_how_much text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_responsible_user_id uuid DEFAULT NULL,
  p_course_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action_id uuid;
  v_inst_id uuid;
  v_body_course_id uuid;
  v_goal_id uuid;
  v_delib_due date;
  v_delib_subject text;
BEGIN
  -- Buscar dados da deliberação
  SELECT d.institution_id, d.linked_goal_id, d.due_date, d.subject,
         b.course_id
  INTO v_inst_id, v_goal_id, v_delib_due, v_delib_subject, v_body_course_id
  FROM governance_deliberations d
  JOIN governance_bodies b ON b.id = d.body_id
  WHERE d.id = p_deliberation_id;

  IF NOT EXISTS (SELECT 1 FROM vertice_memberships WHERE institution_id = v_inst_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'acesso_negado';
  END IF;

  -- Criar ação 5W2H
  INSERT INTO vertice_actions (
    institution_id, course_id, goal_id,
    what, why, where_at, who, how, how_much,
    start_date, due_date, status, progress,
    responsible_user_id, created_by
  ) VALUES (
    v_inst_id,
    COALESCE(p_course_id, v_body_course_id),
    v_goal_id,
    COALESCE(p_what, v_delib_subject),
    COALESCE(p_why, 'Deliberação colegiada: ' || v_delib_subject),
    p_where_at,
    p_who,
    p_how,
    p_how_much,
    COALESCE(p_start_date, current_date),
    COALESCE(p_due_date, v_delib_due),
    'nao_iniciada', 0,
    p_responsible_user_id,
    auth.uid()
  ) RETURNING id INTO v_action_id;

  -- Vincular deliberação à ação criada
  UPDATE governance_deliberations SET
    linked_action_id = v_action_id,
    status = 'encaminhada'
  WHERE id = p_deliberation_id;

  -- Registrar evento de encaminhamento
  INSERT INTO governance_workflow_events (
    deliberation_id, institution_id, event_type,
    from_actor, to_actor, to_sector,
    status_before, status_after, event_note
  ) VALUES (
    p_deliberation_id, v_inst_id, 'encaminhamento',
    auth.uid(), p_responsible_user_id, p_where_at,
    'registrada', 'encaminhada',
    'Ação 5W2H criada: ' || COALESCE(p_what, v_delib_subject)
  );

  -- Inicializar governança da ação (review workflow existente)
  INSERT INTO vertice_action_governance (action_id, institution_id, review_status)
  VALUES (v_action_id, v_inst_id, 'pendente')
  ON CONFLICT (action_id) DO NOTHING;

  RETURN v_action_id;
END;
$$;


-- 2. Vincular deliberação a meta existente
CREATE OR REPLACE FUNCTION public.governance_link_to_goal(
  p_deliberation_id uuid,
  p_goal_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inst_id uuid;
BEGIN
  SELECT institution_id INTO v_inst_id
  FROM governance_deliberations WHERE id = p_deliberation_id;

  IF NOT EXISTS (SELECT 1 FROM vertice_memberships WHERE institution_id = v_inst_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'acesso_negado';
  END IF;

  -- Verificar se a meta pertence à mesma IES
  IF NOT EXISTS (SELECT 1 FROM vertice_goals WHERE id = p_goal_id AND institution_id = v_inst_id) THEN
    RAISE EXCEPTION 'meta_nao_encontrada';
  END IF;

  UPDATE governance_deliberations SET linked_goal_id = p_goal_id WHERE id = p_deliberation_id;

  INSERT INTO governance_workflow_events (
    deliberation_id, institution_id, event_type, from_actor,
    status_before, status_after, event_note
  ) VALUES (
    p_deliberation_id, v_inst_id, 'vinculacao_meta', auth.uid(),
    (SELECT status FROM governance_deliberations WHERE id = p_deliberation_id),
    (SELECT status FROM governance_deliberations WHERE id = p_deliberation_id),
    'Vinculada à meta: ' || (SELECT title FROM vertice_goals WHERE id = p_goal_id)
  );
END;
$$;


-- 3. Encaminhar deliberação → criar meta + ação vinculada (combo)
CREATE OR REPLACE FUNCTION public.governance_route_to_goal_and_action(
  p_deliberation_id uuid,
  -- Meta
  p_goal_title text,
  p_goal_indicator text,
  p_goal_target numeric,
  p_goal_direction text DEFAULT 'aumentar',
  p_goal_unit text DEFAULT NULL,
  p_goal_baseline numeric DEFAULT NULL,
  p_goal_due_date date DEFAULT NULL,
  p_goal_frequency text DEFAULT 'semestral',
  -- Ação 5W2H
  p_action_what text DEFAULT NULL,
  p_action_who text DEFAULT NULL,
  p_action_how text DEFAULT NULL,
  p_action_due_date date DEFAULT NULL,
  p_responsible_user_id uuid DEFAULT NULL,
  p_course_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inst_id uuid;
  v_goal_id uuid;
  v_action_id uuid;
  v_subject text;
  v_body_course_id uuid;
BEGIN
  SELECT d.institution_id, d.subject, b.course_id
  INTO v_inst_id, v_subject, v_body_course_id
  FROM governance_deliberations d
  JOIN governance_bodies b ON b.id = d.body_id
  WHERE d.id = p_deliberation_id;

  IF NOT EXISTS (SELECT 1 FROM vertice_memberships WHERE institution_id = v_inst_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'acesso_negado';
  END IF;

  -- Criar meta
  INSERT INTO vertice_goals (
    institution_id, course_id, title, indicator,
    target, direction, unit, baseline, due_date, frequency,
    owner_name, owner_user_id, status, created_by
  ) VALUES (
    v_inst_id, COALESCE(p_course_id, v_body_course_id),
    p_goal_title, p_goal_indicator,
    p_goal_target, p_goal_direction, p_goal_unit,
    p_goal_baseline, p_goal_due_date, p_goal_frequency,
    p_action_who, p_responsible_user_id,
    'ativa', auth.uid()
  ) RETURNING id INTO v_goal_id;

  -- Vincular meta à deliberação
  UPDATE governance_deliberations SET linked_goal_id = v_goal_id WHERE id = p_deliberation_id;

  -- Criar ação 5W2H vinculada
  INSERT INTO vertice_actions (
    institution_id, course_id, goal_id,
    what, why, who, how,
    start_date, due_date, status, progress,
    responsible_user_id, created_by
  ) VALUES (
    v_inst_id, COALESCE(p_course_id, v_body_course_id), v_goal_id,
    COALESCE(p_action_what, v_subject),
    'Deliberação colegiada: ' || v_subject,
    p_action_who, p_action_how,
    current_date, COALESCE(p_action_due_date, p_goal_due_date),
    'nao_iniciada', 0,
    p_responsible_user_id, auth.uid()
  ) RETURNING id INTO v_action_id;

  -- Atualizar deliberação
  UPDATE governance_deliberations SET
    linked_action_id = v_action_id,
    status = 'encaminhada'
  WHERE id = p_deliberation_id;

  -- Registrar eventos
  INSERT INTO governance_workflow_events (
    deliberation_id, institution_id, event_type, from_actor,
    status_before, status_after, event_note
  ) VALUES (
    p_deliberation_id, v_inst_id, 'encaminhamento', auth.uid(),
    'registrada', 'encaminhada',
    'Meta e ação 5W2H criadas: ' || p_goal_title
  );

  -- Inicializar governança da ação
  INSERT INTO vertice_action_governance (action_id, institution_id, review_status)
  VALUES (v_action_id, v_inst_id, 'pendente')
  ON CONFLICT (action_id) DO NOTHING;

  RETURN jsonb_build_object('goal_id', v_goal_id, 'action_id', v_action_id);
END;
$$;


-- 4. Encaminhamento em lote (múltiplas deliberações da mesma reunião)
CREATE OR REPLACE FUNCTION public.governance_batch_route(
  p_routes jsonb
  -- [{deliberation_id, what, who, due_date, responsible_user_id, goal_id?}]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_action_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_inst_id uuid;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_routes)
  LOOP
    SELECT institution_id INTO v_inst_id
    FROM governance_deliberations WHERE id = (v_item->>'deliberation_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM vertice_memberships WHERE institution_id = v_inst_id AND user_id = auth.uid()) THEN
      v_results := v_results || jsonb_build_object(
        'deliberation_id', v_item->>'deliberation_id', 'error', 'acesso_negado');
      CONTINUE;
    END IF;

    -- Vincular a meta se informada
    IF v_item ? 'goal_id' AND v_item->>'goal_id' IS NOT NULL THEN
      UPDATE governance_deliberations
      SET linked_goal_id = (v_item->>'goal_id')::uuid
      WHERE id = (v_item->>'deliberation_id')::uuid;
    END IF;

    -- Criar ação
    BEGIN
      v_action_id := governance_route_to_action(
        (v_item->>'deliberation_id')::uuid,
        v_item->>'what',
        p_why := v_item->>'why',
        p_who := v_item->>'who',
        p_due_date := CASE WHEN v_item ? 'due_date' THEN (v_item->>'due_date')::date ELSE NULL END,
        p_responsible_user_id := CASE WHEN v_item ? 'responsible_user_id' THEN (v_item->>'responsible_user_id')::uuid ELSE NULL END
      );

      v_results := v_results || jsonb_build_object(
        'deliberation_id', v_item->>'deliberation_id',
        'action_id', v_action_id,
        'status', 'ok'
      );
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object(
        'deliberation_id', v_item->>'deliberation_id',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN v_results;
END;
$$;


-- 5. Visão integrada: deliberação + ação + meta (rastreabilidade completa)
CREATE OR REPLACE FUNCTION public.governance_deliberation_trace(
  p_deliberation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inst_id uuid;
  v_delib jsonb;
  v_action jsonb;
  v_goal jsonb;
  v_events jsonb;
  v_evidence jsonb;
  v_action_gov jsonb;
BEGIN
  SELECT institution_id INTO v_inst_id FROM governance_deliberations WHERE id = p_deliberation_id;
  IF NOT EXISTS (SELECT 1 FROM vertice_memberships WHERE institution_id = v_inst_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'acesso_negado';
  END IF;

  -- Deliberação com corpo e reunião
  SELECT jsonb_build_object(
    'deliberation', to_jsonb(d.*),
    'body', jsonb_build_object('name', gb.name, 'acronym', gb.acronym, 'body_type', gb.body_type),
    'meeting', CASE WHEN gm.id IS NOT NULL THEN jsonb_build_object(
      'scheduled_date', gm.scheduled_date, 'meeting_type', gm.meeting_type, 'meeting_number', gm.meeting_number
    ) ELSE NULL END
  ) INTO v_delib
  FROM governance_deliberations d
  JOIN governance_bodies gb ON gb.id = d.body_id
  LEFT JOIN governance_meetings gm ON gm.id = d.meeting_id
  WHERE d.id = p_deliberation_id;

  -- Ação 5W2H vinculada
  SELECT to_jsonb(a.*) INTO v_action
  FROM vertice_actions a
  WHERE a.id = (SELECT linked_action_id FROM governance_deliberations WHERE id = p_deliberation_id);

  -- Meta vinculada
  SELECT to_jsonb(g.*) INTO v_goal
  FROM vertice_goals g
  WHERE g.id = (SELECT linked_goal_id FROM governance_deliberations WHERE id = p_deliberation_id);

  -- Governança da ação (se existir)
  SELECT to_jsonb(ag.*) INTO v_action_gov
  FROM vertice_action_governance ag
  WHERE ag.action_id = (SELECT linked_action_id FROM governance_deliberations WHERE id = p_deliberation_id);

  -- Linha do tempo de eventos
  SELECT COALESCE(jsonb_agg(to_jsonb(e.*) ORDER BY e.occurred_at), '[]'::jsonb) INTO v_events
  FROM governance_workflow_events e WHERE e.deliberation_id = p_deliberation_id;

  -- Evidências
  SELECT COALESCE(jsonb_agg(to_jsonb(ev.*)), '[]'::jsonb) INTO v_evidence
  FROM governance_evidence ev WHERE ev.deliberation_id = p_deliberation_id;

  RETURN jsonb_build_object(
    'deliberation', v_delib,
    'linked_action', v_action,
    'linked_goal', v_goal,
    'action_governance', v_action_gov,
    'workflow_events', v_events,
    'evidence', v_evidence
  );
END;
$$;


-- 6. Relatório de rastreabilidade por órgão (indicador 2.12)
CREATE OR REPLACE FUNCTION public.governance_traceability_report(
  p_institution_id uuid,
  p_body_id uuid DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vertice_memberships WHERE institution_id = p_institution_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'acesso_negado';
  END IF;

  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_date_from, 'to', p_date_to),
    'summary', (
      SELECT jsonb_build_object(
        'total_deliberations', count(*),
        'routed_to_action', count(*) FILTER (WHERE linked_action_id IS NOT NULL),
        'linked_to_goal', count(*) FILTER (WHERE linked_goal_id IS NOT NULL),
        'completed', count(*) FILTER (WHERE status = 'concluida'),
        'overdue', count(*) FILTER (WHERE due_date < current_date AND status NOT IN ('concluida','cancelada')),
        'pending_routing', count(*) FILTER (WHERE status = 'registrada' AND linked_action_id IS NULL),
        'routing_rate', CASE WHEN count(*) > 0
          THEN round(count(*) FILTER (WHERE linked_action_id IS NOT NULL)::numeric / count(*) * 100, 1)
          ELSE 0 END,
        'completion_rate', CASE WHEN count(*) FILTER (WHERE linked_action_id IS NOT NULL) > 0
          THEN round(count(*) FILTER (WHERE status = 'concluida')::numeric / count(*) FILTER (WHERE linked_action_id IS NOT NULL) * 100, 1)
          ELSE 0 END
      )
      FROM governance_deliberations
      WHERE institution_id = p_institution_id
        AND (p_body_id IS NULL OR body_id = p_body_id)
        AND (p_date_from IS NULL OR created_at >= p_date_from)
        AND (p_date_to IS NULL OR created_at <= p_date_to + interval '1 day')
    ),
    'by_body', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'body_name', gb.name,
        'body_acronym', gb.acronym,
        'total', cnt.total,
        'routed', cnt.routed,
        'completed', cnt.completed,
        'routing_rate', cnt.routing_rate
      ) ORDER BY gb.name), '[]'::jsonb)
      FROM (
        SELECT body_id,
          count(*) as total,
          count(*) FILTER (WHERE linked_action_id IS NOT NULL) as routed,
          count(*) FILTER (WHERE status = 'concluida') as completed,
          CASE WHEN count(*) > 0
            THEN round(count(*) FILTER (WHERE linked_action_id IS NOT NULL)::numeric / count(*) * 100, 1)
            ELSE 0 END as routing_rate
        FROM governance_deliberations
        WHERE institution_id = p_institution_id
          AND (p_body_id IS NULL OR body_id = p_body_id)
          AND (p_date_from IS NULL OR created_at >= p_date_from)
          AND (p_date_to IS NULL OR created_at <= p_date_to + interval '1 day')
        GROUP BY body_id
      ) cnt
      JOIN governance_bodies gb ON gb.id = cnt.body_id
    ),
    'by_status', (
      SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
      FROM (
        SELECT status, count(*) as cnt
        FROM governance_deliberations
        WHERE institution_id = p_institution_id
          AND (p_body_id IS NULL OR body_id = p_body_id)
          AND (p_date_from IS NULL OR created_at >= p_date_from)
          AND (p_date_to IS NULL OR created_at <= p_date_to + interval '1 day')
        GROUP BY status
      ) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
