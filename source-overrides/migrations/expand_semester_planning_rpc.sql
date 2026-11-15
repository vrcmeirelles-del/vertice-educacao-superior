-- ============================================================
-- Migração: Planejamento Semestral Expandido
-- Executar no SQL Editor do Supabase (projeto qvetbbmviatxxatzzuzc)
-- ============================================================

-- 1. Novas colunas (já executadas via execute_sql)
-- ALTER TABLE vertice_app.semester_plannings
--   ADD COLUMN IF NOT EXISTS context jsonb DEFAULT '{}',
--   ADD COLUMN IF NOT EXISTS calendar jsonb DEFAULT '[]',
--   ADD COLUMN IF NOT EXISTS course_offerings jsonb DEFAULT '[]',
--   ADD COLUMN IF NOT EXISTS faculty jsonb DEFAULT '{}',
--   ADD COLUMN IF NOT EXISTS semester_goals jsonb DEFAULT '[]',
--   ADD COLUMN IF NOT EXISTS extension_ac jsonb DEFAULT '{}',
--   ADD COLUMN IF NOT EXISTS internship_tcc jsonb DEFAULT '{}',
--   ADD COLUMN IF NOT EXISTS infrastructure jsonb DEFAULT '[]',
--   ADD COLUMN IF NOT EXISTS student_support jsonb DEFAULT '{}',
--   ADD COLUMN IF NOT EXISTS engagement jsonb DEFAULT '{}';

-- 2. Atualizar RPC para aceitar os novos campos
CREATE OR REPLACE FUNCTION vertice_planning.course_planning(
  p_institution_id uuid, p_course_id uuid, p_kind text, p_action text, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
 v_actor uuid := auth.uid();
 v_role text;
 v_table text;
 v_result jsonb;
 v_existing jsonb;
 v_row jsonb;
 v_id uuid;
 v_version integer;
 v_semester text;
 v_columns text;
 v_fields text[];
 v_field text;
 v_item jsonb;
 v_course public.vertice_courses;
 v_institution public.vertice_institutions;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 v_role := vertice_private.member_role(p_institution_id);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Acesso institucional ou verificação de segurança pendente' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_course FROM public.vertice_courses WHERE id=p_course_id AND institution_id=p_institution_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Curso não pertence à instituição autorizada' USING ERRCODE='42501'; END IF;
 IF v_role IN ('coordenador','nde') AND NOT EXISTS (
   SELECT 1 FROM public.vertice_learning_staff_scope WHERE user_id=v_actor AND institution_id=p_institution_id AND course_id=p_course_id AND active
 ) THEN RAISE EXCEPTION 'Seu vínculo com este curso precisa ser validado pela gestão' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('strategic','semester') OR p_action NOT IN ('list','save','publish') THEN
   RAISE EXCEPTION 'Operação de planejamento inválida' USING ERRCODE='22023';
 END IF;
 v_table := CASE p_kind WHEN 'strategic' THEN 'strategic_plans' ELSE 'semester_plannings' END;
 IF p_action='list' THEN
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t)-''form_code'' ORDER BY updated_at DESC,version DESC),''[]''::jsonb) FROM vertice_app.%I t WHERE institution_id=$1 AND course_id=$2',v_table)
   INTO v_result USING p_institution_id,p_course_id;
   RETURN jsonb_build_object('plans',v_result);
 END IF;
 IF v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde') THEN
   RAISE EXCEPTION 'Seu perfil permite apenas consultar o planejamento' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>524288 THEN
   RAISE EXCEPTION 'Conteúdo do planejamento inválido ou muito extenso' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('course-planning:'||p_course_id::text,0));
 v_id := nullif(p_payload->>'id','')::uuid;
 IF v_id IS NOT NULL THEN
   EXECUTE format('SELECT to_jsonb(t) FROM vertice_app.%I t WHERE id=$1 AND institution_id=$2 AND course_id=$3 FOR UPDATE',v_table)
   INTO v_existing USING v_id,p_institution_id,p_course_id;
   IF v_existing IS NULL THEN RAISE EXCEPTION 'Planejamento não localizado neste curso' USING ERRCODE='42501'; END IF;
   IF nullif(p_payload->>'expected_updated_at','') IS NULL OR
      (p_payload->>'expected_updated_at')::timestamptz<>(v_existing->>'updated_at')::timestamptz THEN
     RAISE EXCEPTION 'Outra pessoa atualizou este planejamento. Reabra a versão antes de salvar.' USING ERRCODE='40001';
   END IF;
 END IF;
 IF p_action='publish' THEN
   IF v_existing IS NULL OR v_existing->>'status'<>'draft' THEN
     RAISE EXCEPTION 'Somente uma versão salva em rascunho pode ser publicada' USING ERRCODE='22023';
   END IF;
   EXECUTE format('UPDATE vertice_app.%I SET status=''published'',updated_at=clock_timestamp() WHERE id=$1 RETURNING to_jsonb(%I)-''form_code''',v_table,v_table)
   INTO v_result USING v_id;
 ELSE
   SELECT * INTO v_institution FROM public.vertice_institutions WHERE id=p_institution_id;
   INSERT INTO vertice_app.institutions(id,slug,name,status,activated_at)
     VALUES(p_institution_id,'portal-'||p_institution_id::text,v_institution.name,'active',now()) ON CONFLICT(id) DO NOTHING;
   INSERT INTO vertice_app.courses(id,institution_id,code,name)
     VALUES(p_course_id,p_institution_id,'portal-'||p_course_id::text,v_course.name) ON CONFLICT(id) DO NOTHING;
   IF NOT EXISTS(SELECT 1 FROM vertice_app.courses WHERE id=p_course_id AND institution_id=p_institution_id) THEN
     RAISE EXCEPTION 'Vínculo institucional do curso inconsistente' USING ERRCODE='23514';
   END IF;
   v_semester := CASE WHEN p_kind='semester' THEN p_payload->>'semester' ELSE NULL END;
   IF p_kind='semester' AND (v_semester IS NULL OR v_semester!~'^[0-9]{4}/[12]$') THEN
     RAISE EXCEPTION 'Informe o semestre no formato AAAA/1 ou AAAA/2' USING ERRCODE='22023';
   END IF;
   IF p_kind='strategic' THEN
     v_fields := ARRAY['coordinator_name','coordinator_since','enrolled_count','first_semester','vision_text','vision_inspirations','vision_reflections','lifecycle_stage','lifecycle_strategies','bcg_market_growth','bcg_market_share','bcg_quadrant','bcg_strategies','porter_rivalry','porter_buyer_power','porter_supplier_power','porter_substitutes','porter_new_entrants','fcs_institutional','fcs_course','fcs_competitors','fcs_competitive_matrix','attributes_matrix','strategic_objectives','operational_objectives'];
   ELSE
     v_fields := ARRAY['semester','activities','context','calendar','course_offerings','faculty','semester_goals','extension_ac','internship_tcc','infrastructure','student_support','engagement'];
   END IF;
   IF v_existing IS NULL OR v_existing->>'status'<>'draft' THEN
     IF p_kind='strategic' THEN
       SELECT coalesce(max(version),0)+1 INTO v_version FROM vertice_app.strategic_plans WHERE institution_id=p_institution_id AND course_id=p_course_id;
       INSERT INTO vertice_app.strategic_plans(institution_id,course_id,version,created_by) VALUES(p_institution_id,p_course_id,v_version,v_actor) RETURNING id INTO v_id;
     ELSE
       SELECT coalesce(max(version),0)+1 INTO v_version FROM vertice_app.semester_plannings WHERE institution_id=p_institution_id AND course_id=p_course_id AND semester=v_semester;
       INSERT INTO vertice_app.semester_plannings(institution_id,course_id,semester,version,created_by) VALUES(p_institution_id,p_course_id,v_semester,v_version,v_actor) RETURNING id INTO v_id;
     END IF;
     EXECUTE format('SELECT to_jsonb(t) FROM vertice_app.%I t WHERE id=$1',v_table) INTO v_row USING v_id;
   ELSE v_row := v_existing; END IF;
   IF v_existing IS NOT NULL AND v_existing->>'status'<>'draft' THEN
     v_row := v_existing||jsonb_build_object('id',v_id,'version',v_version,'status','draft','created_by',v_actor);
   END IF;
   SELECT v_row||coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO v_row FROM jsonb_each(p_payload) WHERE key=ANY(v_fields);
   -- Validate array fields
   FOREACH v_field IN ARRAY ARRAY['vision_inspirations','vision_reflections','lifecycle_strategies','bcg_strategies','fcs_institutional','fcs_course','fcs_competitors','fcs_competitive_matrix','attributes_matrix','strategic_objectives','operational_objectives','activities','calendar','course_offerings','semester_goals','infrastructure'] LOOP
     IF v_row ? v_field THEN
       IF jsonb_typeof(v_row->v_field)<>'array' THEN RAISE EXCEPTION 'Lista inválida: %',v_field USING ERRCODE='22023'; END IF;
       IF jsonb_array_length(v_row->v_field)>500 THEN RAISE EXCEPTION 'Lista muito extensa: %',v_field USING ERRCODE='22023'; END IF;
       FOR v_item IN SELECT value FROM jsonb_array_elements(v_row->v_field) LOOP
         IF jsonb_typeof(v_item)<>'object' THEN RAISE EXCEPTION 'Item inválido: %',v_field USING ERRCODE='22023'; END IF;
         IF v_field='fcs_competitors' AND (jsonb_typeof(v_item->'competitors') IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_item->'competitors')='array' THEN v_item->'competitors' ELSE '[]'::jsonb END) x WHERE jsonb_typeof(x)<>'object')) THEN
           RAISE EXCEPTION 'Informe os concorrentes como uma lista' USING ERRCODE='22023';
         END IF;
         IF v_field='strategic_objectives' AND jsonb_typeof(v_item->'targets') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Informe as metas anuais do objetivo' USING ERRCODE='22023'; END IF;
         IF v_field IN ('operational_objectives','activities') AND v_item ? 'status' AND v_item->>'status' NOT IN ('planned','in_progress','completed','cancelled') THEN RAISE EXCEPTION 'Situação da atividade inválida' USING ERRCODE='22023'; END IF;
       END LOOP;
     END IF;
   END LOOP;
   -- Validate object fields
   FOREACH v_field IN ARRAY ARRAY['context','faculty','extension_ac','internship_tcc','student_support','engagement'] LOOP
     IF v_row ? v_field AND jsonb_typeof(v_row->v_field)<>'object' THEN
       RAISE EXCEPTION 'Seção inválida: %',v_field USING ERRCODE='22023';
     END IF;
   END LOOP;
   v_row := v_row||jsonb_build_object('form_code',NULL,'updated_at',clock_timestamp());
   SELECT string_agg(format('%I',f),',') INTO v_columns FROM unnest(v_fields||ARRAY['updated_at']) f;
   EXECUTE format('UPDATE vertice_app.%I SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::vertice_app.%I,$1)) WHERE id=$2 RETURNING to_jsonb(%I)-''form_code''',v_table,v_columns,v_columns,v_table,v_table)
   INTO v_result USING v_row,v_id;
 END IF;
 INSERT INTO vertice_app.audit_log(institution_id,actor_kind,action,resource_type,resource_id,outcome,metadata)
 VALUES(p_institution_id,'user','portal.planning.'||p_action,p_kind,v_id,'success',jsonb_build_object('portal_actor_id',v_actor,'course_id',p_course_id,'version',v_result->'version'));
 RETURN jsonb_build_object('plan',v_result);
END;
$fn$;
