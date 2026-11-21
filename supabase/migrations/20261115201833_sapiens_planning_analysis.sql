-- Sapiens planning opinions are separate from plans and never publish them.
CREATE TABLE public.vertice_sapiens_planning_analyses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 course_id uuid REFERENCES public.vertice_courses(id), semester text, scope text NOT NULL CHECK(scope IN ('superior','escolas')),
 status text NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','pending_review','reviewed','rejected','failed')),
 context jsonb NOT NULL, result jsonb, review jsonb, generator_model text, reviewer_model text, input_hash text,
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz, review_note text,
 CHECK(octet_length(context::text)<1500000), CHECK(result IS NULL OR octet_length(result::text)<100000)
);
CREATE INDEX sapiens_planning_history ON public.vertice_sapiens_planning_analyses(institution_id,created_at DESC);
ALTER TABLE public.vertice_sapiens_planning_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_sapiens_planning_analyses FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.vertice_sapiens_planning_analyses TO service_role;
CREATE POLICY sapiens_planning_management ON public.vertice_sapiens_planning_analyses FOR SELECT TO authenticated USING(vertice_private.member_role(institution_id) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'));
CREATE OR REPLACE FUNCTION vertice_planning.sapiens(p_institution_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tier text; v_role text; v_context jsonb; v_courses jsonb; v_course uuid; v_term text; v_row public.vertice_sapiens_planning_analyses; v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 v_role:=vertice_private.member_role(p_institution_id);
 IF v_role IS NULL OR v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') THEN RAISE EXCEPTION 'Análise restrita à gestão autorizada com segundo fator' USING ERRCODE='42501'; END IF;
 SELECT tier INTO v_tier FROM public.vertice_institutions WHERE id=p_institution_id;
 IF v_tier IS NULL THEN RAISE EXCEPTION 'Instituição não localizada'; END IF;
 IF p_action='options' THEN
  RETURN jsonb_build_object('scope',CASE WHEN v_tier='escolas' THEN 'escolas' ELSE 'superior' END,'courses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name) FROM public.vertice_courses c WHERE c.institution_id=p_institution_id AND (EXISTS(SELECT 1 FROM vertice_app.strategic_plans s WHERE s.course_id=c.id AND s.institution_id=p_institution_id AND s.status<>'archived') OR EXISTS(SELECT 1 FROM vertice_app.semester_plannings s WHERE s.course_id=c.id AND s.institution_id=p_institution_id AND s.status<>'archived'))),'[]'));
 ELSIF p_action='list' THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(s)-'context') FROM (SELECT * FROM public.vertice_sapiens_planning_analyses WHERE institution_id=p_institution_id ORDER BY created_at DESC LIMIT 20) s),'[]');
 ELSIF p_action='review' THEN
  IF p_payload->>'status' NOT IN ('reviewed','rejected') OR length(btrim(coalesce(p_payload->>'note','')))<10 THEN RAISE EXCEPTION 'Registre decisão e justificativa (mínimo 10 caracteres)'; END IF;
  UPDATE public.vertice_sapiens_planning_analyses SET status=p_payload->>'status',review_note=left(p_payload->>'note',4000),reviewed_by=auth.uid(),reviewed_at=now() WHERE id=(p_payload->>'id')::uuid AND institution_id=p_institution_id AND status='pending_review' RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Parecer já revisado ou indisponível' USING ERRCODE='40001'; END IF;
  RETURN to_jsonb(v_row)-'context';
 ELSIF p_action<>'start' THEN RAISE EXCEPTION 'Operação inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':sapiens-planning',0));
 IF EXISTS(SELECT 1 FROM public.vertice_sapiens_planning_analyses WHERE institution_id=p_institution_id AND status='generating' AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'Já existe análise em andamento. Aguarde alguns minutos.'; END IF;
 v_course:=nullif(p_payload->>'course_id','')::uuid; v_term:=nullif(p_payload->>'semester','');
 IF v_term IS NOT NULL AND v_term !~ '^[0-9]{4}/[12]$' THEN RAISE EXCEPTION 'Semestre inválido'; END IF;
 IF v_tier='escolas' THEN
  IF v_course IS NOT NULL THEN RAISE EXCEPTION 'Escola utiliza escopo institucional'; END IF;
  v_context:=vertice_planning.school_planning(p_institution_id,'strategic','overview','{}');
  v_context:=jsonb_set(v_context,'{semesters}',coalesce((SELECT jsonb_agg(s) FROM jsonb_array_elements(v_context->'semesters') s WHERE v_term IS NULL OR s->>'semester'=v_term),'[]'));
  IF v_context->'strategic'='null'::jsonb AND jsonb_array_length(v_context->'semesters')=0 THEN RAISE EXCEPTION 'Salve um planejamento antes de solicitar a interpretação'; END IF;
 ELSE
  v_context:=vertice_planning.management(p_institution_id,v_term);
  SELECT coalesce(jsonb_agg(c),'[]') INTO v_courses FROM jsonb_array_elements(v_context->'courses') c WHERE (v_course IS NULL OR c->>'id'=v_course::text) AND (c->'strategic'<>'null'::jsonb OR c->'semester'<>'null'::jsonb);
  IF jsonb_array_length(v_courses)=0 THEN RAISE EXCEPTION 'Nenhum planejamento salvo neste recorte'; END IF;
  -- Include all saved strategic/semester fields, excluding author/contact metadata.
  SELECT jsonb_agg(c || jsonb_build_object('strategic',coalesce((SELECT to_jsonb(s)-ARRAY['created_by','updated_by','institution_id','course_id'] FROM vertice_app.strategic_plans s WHERE s.id=(c->'strategic'->>'id')::uuid),'null'::jsonb),'semester',coalesce((SELECT to_jsonb(s)-ARRAY['created_by','updated_by','institution_id','course_id'] FROM vertice_app.semester_plannings s WHERE s.id=(c->'semester'->>'id')::uuid),'null'::jsonb))) INTO v_courses FROM jsonb_array_elements(v_courses) c;
  v_context:=jsonb_set(v_context,'{courses}',v_courses);
 END IF;
 v_context:=v_context||jsonb_build_object('scope',CASE WHEN v_tier='escolas' THEN 'escolas' ELSE 'superior' END,'requested_semester',v_term,'institution_name',(SELECT name FROM public.vertice_institutions WHERE id=p_institution_id),'sources',CASE WHEN v_tier='escolas' THEN jsonb_build_array('vertice_planning.school_plans','vertice_goals','vertice_actions','v_enem_evolucao') ELSE jsonb_build_array('vertice_app.strategic_plans','vertice_app.semester_plannings','vertice_course_semester_stats','vertice_goals','vertice_actions','v_tcc_course_summary','v_ac_course_summary','v_internship_course_summary') END);
 INSERT INTO public.vertice_sapiens_planning_analyses(institution_id,course_id,semester,scope,context,created_by) VALUES(p_institution_id,v_course,v_term,CASE WHEN v_tier='escolas' THEN 'escolas' ELSE 'superior' END,v_context,auth.uid()) RETURNING id INTO v_id;
 RETURN jsonb_build_object('id',v_id,'context',v_context);
END $$;
REVOKE ALL ON FUNCTION vertice_planning.sapiens(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.sapiens(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.vertice_sapiens_planning(p_institution_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vertice_planning.sapiens(p_institution_id,p_action,p_payload); $$;
REVOKE ALL ON FUNCTION public.vertice_sapiens_planning(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_sapiens_planning(uuid,text,jsonb) TO authenticated;
