-- Native planning extension. No scheduler, alternate application or new identity store.
CREATE TABLE vertice_planning.competitive_profiles (
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
  course_id uuid NOT NULL REFERENCES public.vertice_courses(id),
  config jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(institution_id,course_id)
);
CREATE TABLE vertice_planning.competitive_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  course_id uuid NOT NULL,
  external_key text NOT NULL CHECK(length(external_key) BETWEEN 1 AND 200),
  report jsonb NOT NULL,
  plan_id uuid NOT NULL REFERENCES vertice_app.strategic_plans(id),
  objective_index integer NOT NULL,
  objective_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  action_id uuid REFERENCES public.vertice_actions(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(institution_id,course_id,external_key),
  FOREIGN KEY(institution_id,course_id) REFERENCES vertice_planning.competitive_profiles(institution_id,course_id)
);
CREATE TABLE vertice_planning.competitive_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id uuid NOT NULL,
  course_id uuid NOT NULL,
  finding_id uuid REFERENCES vertice_planning.competitive_findings(id),
  actor_id uuid REFERENCES auth.users(id),
  event text NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(institution_id,course_id) REFERENCES vertice_planning.competitive_profiles(institution_id,course_id)
);
CREATE INDEX competitive_events_scope ON vertice_planning.competitive_events(institution_id,course_id,id DESC);
CREATE INDEX competitive_findings_plan ON vertice_planning.competitive_findings(plan_id);
CREATE INDEX competitive_findings_action ON vertice_planning.competitive_findings(action_id);
ALTER TABLE vertice_planning.competitive_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_planning.competitive_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_planning.competitive_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_planning.competitive_profiles,vertice_planning.competitive_findings,vertice_planning.competitive_events FROM PUBLIC,anon,authenticated;

-- Shared import bridge: callable by the authorized connector/service role, or by
-- the scoped portal RPC below. Payloads are immutable and idempotent by key.
CREATE FUNCTION vertice_planning.ingest_competitive_report(p_institution uuid,p_course uuid,p_report jsonb,p_actor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg jsonb; item jsonb; competitor jsonb; saved vertice_app.strategic_plans%ROWTYPE;
  previous jsonb; item_id uuid; host text; idx integer; inserted integer:=0; skipped integer:=0;
BEGIN
  SELECT config INTO cfg FROM vertice_planning.competitive_profiles
    WHERE institution_id=p_institution AND course_id=p_course FOR UPDATE;
  IF cfg IS NULL THEN RAISE EXCEPTION 'Configure o monitoramento deste curso primeiro.'; END IF;
  IF jsonb_typeof(p_report->'findings') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_report->'findings') NOT BETWEEN 1 AND 100
     OR octet_length(p_report::text)>1000000
     OR p_report->>'campus' IS DISTINCT FROM cfg->>'campus' THEN
    RAISE EXCEPTION 'Relatório inválido ou campus divergente.';
  END IF;
  SELECT * INTO saved FROM vertice_app.strategic_plans WHERE id=(p_report->>'plan_id')::uuid
    AND institution_id=p_institution AND course_id=p_course AND status<>'archived' FOR SHARE;
  IF saved.id IS NULL THEN RAISE EXCEPTION 'Planejamento não pertence ao curso ou está arquivado.'; END IF;
  IF saved.updated_at IS DISTINCT FROM nullif(p_report->>'expected_updated_at','')::timestamptz THEN
    RAISE EXCEPTION 'Planejamento alterado; atualize a revisão e confira os objetivos antes de importar.'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_report->'findings') LOOP
    IF length(coalesce(item->>'external_key','')) NOT BETWEEN 1 AND 200
       OR length(coalesce(item->>'title','')) NOT BETWEEN 1 AND 500
       OR length(coalesce(item->>'current_condition','')) NOT BETWEEN 1 AND 8000
       OR coalesce(item->>'event_type','') NOT IN ('baseline','change')
       OR coalesce(item->>'kind','') NOT IN ('fact','inference')
       OR coalesce(item->>'verification','') NOT IN ('confirmed','unverified')
       OR coalesce(item->>'relevance','') NOT IN ('low','medium','high')
       OR nullif(item->>'consulted_on','') IS NULL
       OR (item->>'consulted_on')::date>current_date THEN
      RAISE EXCEPTION 'Achado inválido: informe tipo, verificação, relevância, fonte e data de consulta.';
    END IF;
    SELECT value INTO competitor FROM jsonb_array_elements(cfg->'competitors')
      WHERE value->>'name'=item->>'competitor';
    host:=substring(item->>'source_url' FROM '^https://([a-z0-9.-]+)(?:/|$)');
    IF competitor IS NULL OR host IS NULL OR NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements_text(competitor->'official_hosts') h WHERE h=host
    ) THEN RAISE EXCEPTION 'Fonte fora dos domínios oficiais configurados para o concorrente.'; END IF;
    -- Missing dates stay NULL. A document date is not a publication date.
    PERFORM nullif(item->>'published_on','')::date, nullif(item->>'document_on','')::date,
      nullif(item->>'valid_from','')::date, nullif(item->>'valid_until','')::date;
    IF nullif(item->>'valid_from','')::date > nullif(item->>'valid_until','')::date THEN
      RAISE EXCEPTION 'Intervalo de vigência inválido.'; END IF;
    idx:=(item->>'objective_index')::integer;
    IF idx IS NULL OR idx<0 OR idx>=jsonb_array_length(saved.strategic_objectives) THEN
      RAISE EXCEPTION 'Selecione um objetivo existente no plano salvo.'; END IF;
    SELECT report,id INTO previous,item_id FROM vertice_planning.competitive_findings
      WHERE institution_id=p_institution AND course_id=p_course AND external_key=item->>'external_key';
    IF item_id IS NOT NULL THEN
      IF previous IS DISTINCT FROM item THEN RAISE EXCEPTION 'Chave já importada com conteúdo diferente. Use nova chave e registre a evolução.'; END IF;
      skipped:=skipped+1; CONTINUE;
    END IF;
    INSERT INTO vertice_planning.competitive_findings(institution_id,course_id,external_key,report,plan_id,objective_index,objective_snapshot)
      VALUES(p_institution,p_course,item->>'external_key',item,saved.id,idx,saved.strategic_objectives->idx) RETURNING id INTO item_id;
    INSERT INTO vertice_planning.competitive_events(institution_id,course_id,finding_id,actor_id,event,details)
      VALUES(p_institution,p_course,item_id,p_actor,'imported',jsonb_build_object('origin',p_report->>'origin','link_state','suggested','plan_revision',saved.updated_at,'report',item));
    inserted:=inserted+1;
  END LOOP;
  RETURN jsonb_build_object('inserted',inserted,'skipped',skipped,'status','pending_review');
END $$;
REVOKE ALL ON FUNCTION vertice_planning.ingest_competitive_report(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA vertice_planning TO service_role;
GRANT EXECUTE ON FUNCTION vertice_planning.ingest_competitive_report(uuid,uuid,jsonb,uuid) TO service_role;

CREATE FUNCTION vertice_planning.competitive_intelligence(p_institution uuid,p_course uuid,p_operation text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg jsonb; comp jsonb; h text; finding vertice_planning.competitive_findings%ROWTYPE;
 saved vertice_app.strategic_plans%ROWTYPE; idx integer; action uuid; goal uuid; result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT vertice_planning.can_interpret(p_institution,p_course) THEN
    RAISE EXCEPTION 'Acesso negado ao monitoramento deste curso.' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=p_course AND institution_id=p_institution) THEN
    RAISE EXCEPTION 'Curso e instituição divergentes.'; END IF;
  IF p_operation='context' THEN
    RETURN jsonb_build_object(
      'profile',(SELECT to_jsonb(p) FROM vertice_planning.competitive_profiles p WHERE institution_id=p_institution AND course_id=p_course),
      'plans',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'version',version,'updated_at',updated_at,'objectives',strategic_objectives) ORDER BY updated_at DESC) FROM vertice_app.strategic_plans WHERE institution_id=p_institution AND course_id=p_course AND status<>'archived'),'[]'::jsonb),
      'goals',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'indicator',indicator)) FROM public.vertice_goals WHERE institution_id=p_institution AND course_id=p_course),'[]'::jsonb),
      'findings',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY created_at DESC) FROM vertice_planning.competitive_findings f WHERE institution_id=p_institution AND course_id=p_course),'[]'::jsonb),
      'history',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY id DESC) FROM (SELECT * FROM vertice_planning.competitive_events WHERE institution_id=p_institution AND course_id=p_course ORDER BY id DESC LIMIT 200) e),'[]'::jsonb));
  ELSIF p_operation='configure' THEN
    cfg:=p_payload->'config';
    IF jsonb_typeof(cfg) IS DISTINCT FROM 'object' OR length(coalesce(cfg->>'campus','')) NOT BETWEEN 1 AND 250
       OR length(coalesce(cfg->>'relevance_criteria','')) NOT BETWEEN 1 AND 4000
       OR coalesce(cfg->>'minimum_relevance','') NOT IN ('low','medium','high')
       OR jsonb_typeof(cfg->'competitors') IS DISTINCT FROM 'array'
       OR jsonb_array_length(cfg->'competitors') NOT BETWEEN 1 AND 30 OR octet_length(cfg::text)>50000 THEN
       RAISE EXCEPTION 'Informe campus, critérios, relevância mínima e concorrentes.'; END IF;
    FOR comp IN SELECT value FROM jsonb_array_elements(cfg->'competitors') LOOP
      IF length(coalesce(comp->>'name','')) NOT BETWEEN 1 AND 250
         OR jsonb_typeof(comp->'official_hosts') IS DISTINCT FROM 'array'
         OR jsonb_array_length(comp->'official_hosts') NOT BETWEEN 1 AND 20 THEN
         RAISE EXCEPTION 'Informe nome e domínios oficiais de cada concorrente.'; END IF;
      FOR h IN SELECT value FROM jsonb_array_elements_text(comp->'official_hosts') LOOP
        IF h !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' OR h LIKE '%..%' THEN
          RAISE EXCEPTION 'Domínio oficial inválido; informe somente o host, sem https ou caminho.'; END IF;
      END LOOP;
    END LOOP;
    IF (SELECT count(*) FROM jsonb_array_elements(cfg->'competitors')) <>
       (SELECT count(DISTINCT value->>'name') FROM jsonb_array_elements(cfg->'competitors')) THEN
       RAISE EXCEPTION 'Concorrentes duplicados.'; END IF;
    -- Serialize first creation and concurrent edits for this course.
    PERFORM 1 FROM public.vertice_courses WHERE id=p_course FOR UPDATE;
    IF EXISTS(SELECT 1 FROM vertice_planning.competitive_profiles WHERE institution_id=p_institution AND course_id=p_course
      AND updated_at IS DISTINCT FROM nullif(p_payload->>'expected_updated_at','')::timestamptz) THEN
      RAISE EXCEPTION 'Configuração alterada por outro usuário; atualize a página.'; END IF;
    INSERT INTO vertice_planning.competitive_profiles VALUES(p_institution,p_course,cfg,clock_timestamp())
      ON CONFLICT(institution_id,course_id) DO UPDATE SET config=EXCLUDED.config,updated_at=EXCLUDED.updated_at;
    INSERT INTO vertice_planning.competitive_events(institution_id,course_id,actor_id,event,details)
      VALUES(p_institution,p_course,auth.uid(),'configured',cfg);
    RETURN jsonb_build_object('saved',true);
  ELSIF p_operation='import' THEN
    RETURN vertice_planning.ingest_competitive_report(p_institution,p_course,p_payload,auth.uid());
  ELSIF p_operation IN ('approve','reject') THEN
    SELECT * INTO finding FROM vertice_planning.competitive_findings WHERE id=(p_payload->>'finding_id')::uuid
      AND institution_id=p_institution AND course_id=p_course FOR UPDATE;
    IF finding.id IS NULL THEN RAISE EXCEPTION 'Achado não pertence ao curso.'; END IF;
    IF finding.status<>'pending' THEN
      IF finding.status='approved' AND p_operation='approve' THEN RETURN jsonb_build_object('action_id',finding.action_id,'already_reviewed',true); END IF;
      RAISE EXCEPTION 'Achado já revisado; registre novos fatos em outro achado.';
    END IF;
    IF length(trim(coalesce(p_payload->>'review_note',''))) NOT BETWEEN 1 AND 4000 THEN
      RAISE EXCEPTION 'Registre a justificativa da decisão.'; END IF;
    IF p_operation='approve' THEN
      IF finding.report->>'verification'<>'confirmed' THEN RAISE EXCEPTION 'Informação não verificável: revalide a fonte antes de propor ação.'; END IF;
      SELECT * INTO saved FROM vertice_app.strategic_plans WHERE id=(p_payload->>'plan_id')::uuid
        AND institution_id=p_institution AND course_id=p_course AND status<>'archived' FOR SHARE;
      IF saved.id IS NULL OR saved.updated_at IS DISTINCT FROM nullif(p_payload->>'expected_updated_at','')::timestamptz THEN
        RAISE EXCEPTION 'Planejamento alterado; atualize e reveja o objetivo.'; END IF;
      idx:=(p_payload->>'objective_index')::integer;
      IF idx IS NULL OR idx<0 OR idx>=jsonb_array_length(saved.strategic_objectives) THEN RAISE EXCEPTION 'Objetivo inválido.'; END IF;
      goal:=nullif(p_payload->>'goal_id','')::uuid;
      IF goal IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_goals WHERE id=goal AND institution_id=p_institution AND course_id=p_course) THEN
        RAISE EXCEPTION 'Meta não pertence ao curso.'; END IF;
      IF length(trim(coalesce(p_payload->>'what',''))) NOT BETWEEN 1 AND 500
         OR length(trim(coalesce(p_payload->>'who',''))) NOT BETWEEN 1 AND 250
         OR length(trim(coalesce(p_payload->>'how',''))) NOT BETWEEN 1 AND 4000
         OR length(coalesce(p_payload->>'how_much',''))>250
         OR nullif(p_payload->>'due_date','') IS NULL OR (p_payload->>'due_date')::date<current_date THEN
         RAISE EXCEPTION 'Informe ação, responsável, método e prazo futuro ou de hoje.'; END IF;
      INSERT INTO public.vertice_actions(institution_id,course_id,goal_id,what,why,where_at,who,due_date,how,how_much,
        status,progress,evidence,created_by,origin_type,origin_ref,origin_label)
      VALUES(p_institution,p_course,goal,p_payload->>'what',left(concat('Objetivo: ',saved.strategic_objectives->idx->>'theme',E'\nDecisão: ',p_payload->>'review_note'),2000),
        left((SELECT config->>'campus' FROM vertice_planning.competitive_profiles WHERE institution_id=p_institution AND course_id=p_course),250),
        p_payload->>'who',(p_payload->>'due_date')::date,p_payload->>'how',p_payload->>'how_much','nao_iniciada',0,
        left(concat('Tipo: ',finding.report->>'kind','; verificação: ',finding.report->>'verification',E'\nFonte: ',finding.report->>'source_url',E'\nConsulta: ',finding.report->>'consulted_on',E'\n',finding.report->>'current_condition'),4000),
        auth.uid(),'manual',finding.id,'Inteligência competitiva · revisão do gestor') RETURNING id INTO action;
      UPDATE vertice_planning.competitive_findings SET status='approved',action_id=action,plan_id=saved.id,objective_index=idx,
        objective_snapshot=saved.strategic_objectives->idx WHERE id=finding.id;
    ELSE UPDATE vertice_planning.competitive_findings SET status='rejected' WHERE id=finding.id;
    END IF;
    INSERT INTO vertice_planning.competitive_events(institution_id,course_id,finding_id,actor_id,event,details)
      VALUES(p_institution,p_course,finding.id,auth.uid(),p_operation,jsonb_build_object('decision',p_payload,'action_id',action,'objective_snapshot',saved.strategic_objectives->idx));
    RETURN jsonb_build_object('action_id',action,'reviewed',true);
  END IF;
  RAISE EXCEPTION 'Operação inválida.';
END $$;
REVOKE ALL ON FUNCTION vertice_planning.competitive_intelligence(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.competitive_intelligence(uuid,uuid,text,jsonb) TO authenticated;

CREATE FUNCTION public.vertice_competitive_intelligence(p_institution_id uuid,p_course_id uuid,p_operation text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT vertice_planning.competitive_intelligence(p_institution_id,p_course_id,p_operation,p_payload)
$$;
REVOKE ALL ON FUNCTION public.vertice_competitive_intelligence(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_competitive_intelligence(uuid,uuid,text,jsonb) TO authenticated;
COMMENT ON FUNCTION public.vertice_competitive_intelligence(uuid,uuid,text,jsonb) IS 'Native planning competitive evidence: scoped MFA access, immutable imports, explicit human review and native 5W2H actions. Does not approve or publish strategic plans.';
