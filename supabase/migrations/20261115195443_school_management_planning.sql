-- Institutional school planning: shared editor, native school scope, no synthetic higher-education course.
CREATE TABLE IF NOT EXISTS vertice_planning.school_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 kind text NOT NULL CHECK(kind IN ('strategic','semester')), semester text,
 version integer NOT NULL CHECK(version>0), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(data)='object'),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((kind='strategic' AND semester IS NULL) OR (kind='semester' AND semester ~ '^[0-9]{4}/[12]$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS school_plans_version ON vertice_planning.school_plans(institution_id,kind,coalesce(semester,''),version);
ALTER TABLE vertice_planning.school_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_planning.school_plans FROM PUBLIC,anon,authenticated;
CREATE POLICY school_plan_management_read ON vertice_planning.school_plans FOR SELECT TO authenticated USING(vertice_private.member_role(institution_id) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'));
CREATE OR REPLACE FUNCTION vertice_planning.school_planning(p_institution_id uuid,p_kind text,p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_result jsonb; v_old vertice_planning.school_plans; v_new vertice_planning.school_plans; v_sem text; v_version int; v_data jsonb; v_key text; v_part jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 v_role:=vertice_private.member_role(p_institution_id);
 IF v_role IS NULL OR v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') THEN RAISE EXCEPTION 'Planejamento escolar restrito à gestão autorizada com segundo fator' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=p_institution_id AND tier='escolas') THEN RAISE EXCEPTION 'Instituição não pertence ao ambiente Escolas' USING ERRCODE='22023'; END IF;
 IF p_kind NOT IN ('strategic','semester') OR p_action NOT IN ('list','save','publish','overview') THEN RAISE EXCEPTION 'Operação inválida' USING ERRCODE='22023'; END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.updated_at DESC,s.version DESC),'[]'::jsonb) INTO v_result FROM vertice_planning.school_plans s WHERE s.institution_id=p_institution_id AND s.kind=p_kind;
  RETURN jsonb_build_object('plans',v_result);
 END IF;
 IF p_action='overview' THEN
  RETURN jsonb_build_object('institution_id',p_institution_id,'fetched_at',now(),
   'strategic',(SELECT to_jsonb(s) FROM vertice_planning.school_plans s WHERE s.institution_id=p_institution_id AND kind='strategic' AND status<>'archived' ORDER BY version DESC LIMIT 1),
   'semesters',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY semester DESC) FROM (SELECT DISTINCT ON(semester) * FROM vertice_planning.school_plans WHERE institution_id=p_institution_id AND kind='semester' AND status<>'archived' ORDER BY semester,version DESC) s),'[]'::jsonb),
   'goals',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'indicator',g.indicator,'baseline',g.baseline,'target',g.target,'source',g.source,'status',g.status)) FROM public.vertice_goals g WHERE institution_id=p_institution_id),'[]'::jsonb),
   'actions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'what',a.what,'who',a.who,'due_date',a.due_date,'status',a.status,'validated',a.validated_by_superior IS NOT NULL)) FROM public.vertice_actions a WHERE institution_id=p_institution_id),'[]'::jsonb),
   'enem',(SELECT jsonb_build_object('year',e.year,'average',e.media_geral,'participants',e.participantes) FROM public.v_enem_evolucao e WHERE institution_id=p_institution_id ORDER BY year DESC LIMIT 1));
 END IF;
 IF jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>524288 THEN RAISE EXCEPTION 'Conteúdo inválido ou muito extenso' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('school-planning:'||p_institution_id::text||p_kind,0));
 IF nullif(p_payload->>'id','') IS NOT NULL THEN
  SELECT * INTO v_old FROM vertice_planning.school_plans WHERE id=(p_payload->>'id')::uuid AND institution_id=p_institution_id AND kind=p_kind FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Planejamento não localizado nesta escola' USING ERRCODE='42501'; END IF;
  IF nullif(p_payload->>'expected_updated_at','') IS NULL OR (p_payload->>'expected_updated_at')::timestamptz<>v_old.updated_at THEN RAISE EXCEPTION 'Outra pessoa atualizou o planejamento. Reabra a versão antes de salvar.' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action='publish' THEN
  IF v_old.id IS NULL OR v_old.status<>'draft' THEN RAISE EXCEPTION 'Publique somente uma versão salva em rascunho' USING ERRCODE='22023'; END IF;
  UPDATE vertice_planning.school_plans SET status='published',updated_at=clock_timestamp() WHERE id=v_old.id RETURNING * INTO v_new;
 ELSE
  v_sem:=CASE WHEN p_kind='semester' THEN p_payload->>'semester' ELSE NULL END;
  IF p_kind='semester' AND (v_sem IS NULL OR v_sem !~ '^[0-9]{4}/[12]$') THEN RAISE EXCEPTION 'Informe semestre AAAA/1 ou AAAA/2' USING ERRCODE='22023'; END IF;
  IF v_old.id IS NOT NULL AND v_old.status='draft' AND v_old.semester IS DISTINCT FROM v_sem THEN RAISE EXCEPTION 'Crie novo planejamento para outro semestre' USING ERRCODE='22023'; END IF;
  v_data:=p_payload->'data';
  IF jsonb_typeof(v_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Conteúdo obrigatório' USING ERRCODE='22023'; END IF;
  v_data:=v_data-ARRAY['id','version','status','updated_at','created_at','courseId','form_code'];
  FOREACH v_key IN ARRAY ARRAY['vision_reflections','vision_inspirations','lifecycle_strategies','bcg_strategies','fcs_institutional','fcs_course','fcs_competitors','fcs_competitive_matrix','attributes_matrix','strategic_objectives','operational_objectives','alignment','risks','benchmarking','activities','semester_goals','calendar','infrastructure'] LOOP
   IF v_data?v_key AND (jsonb_typeof(v_data->v_key) IS DISTINCT FROM 'array') THEN RAISE EXCEPTION 'Lista inválida: %',v_key USING ERRCODE='22023'; END IF;
   IF v_data?v_key AND jsonb_array_length(v_data->v_key)>500 THEN RAISE EXCEPTION 'Lista muito extensa: %',v_key USING ERRCODE='22023'; END IF;
   FOR v_part IN SELECT value FROM jsonb_array_elements(coalesce(v_data->v_key,'[]'::jsonb)) LOOP
    IF jsonb_typeof(v_part)<>'object' THEN RAISE EXCEPTION 'Item inválido: %',v_key USING ERRCODE='22023'; END IF;
   END LOOP;
  END LOOP;
  IF v_data?'swot' THEN
   FOREACH v_key IN ARRAY ARRAY['strengths','weaknesses','opportunities','threats'] LOOP
    IF jsonb_typeof(v_data->'swot'->v_key) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Quadrante SWOT inválido' USING ERRCODE='22023'; END IF;
   END LOOP;
  END IF;
  IF v_old.id IS NOT NULL AND v_old.status='draft' THEN UPDATE vertice_planning.school_plans SET data=v_data,updated_at=clock_timestamp() WHERE id=v_old.id RETURNING * INTO v_new;
  ELSE
   SELECT coalesce(max(version),0)+1 INTO v_version FROM vertice_planning.school_plans WHERE institution_id=p_institution_id AND kind=p_kind AND semester IS NOT DISTINCT FROM v_sem;
   INSERT INTO vertice_planning.school_plans(institution_id,kind,semester,version,data,created_by) VALUES(p_institution_id,p_kind,v_sem,v_version,v_data,auth.uid()) RETURNING * INTO v_new;
  END IF;
 END IF;
 RETURN jsonb_build_object('plan',to_jsonb(v_new));
END; $$;
REVOKE ALL ON FUNCTION vertice_planning.school_planning(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.school_planning(uuid,text,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.vertice_school_planning(p_institution_id uuid,p_kind text,p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vertice_planning.school_planning(p_institution_id,p_kind,p_action,p_payload); $$;
REVOKE ALL ON FUNCTION public.vertice_school_planning(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_school_planning(uuid,text,text,jsonb) TO authenticated;
