-- Preparation only: apply after approval. Existing business plans and measurements are untouched.
CREATE OR REPLACE FUNCTION vertice_planning.can_interpret(p_institution uuid,p_course uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(
  vertice_private.member_role(p_institution) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') OR
  (p_course IS NOT NULL AND vertice_private.member_role(p_institution) IN ('coordenador','nde') AND EXISTS(
   SELECT 1 FROM public.vertice_learning_staff_scope s JOIN public.vertice_courses c ON c.id=s.course_id AND c.institution_id=s.institution_id
   WHERE s.user_id=auth.uid() AND s.institution_id=p_institution AND s.course_id=p_course AND s.active)),false);
$$;
REVOKE ALL ON FUNCTION vertice_planning.can_interpret(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.can_interpret(uuid,uuid) TO authenticated;

-- Freeze only the indicator's definition. Progress, deadlines and target changes
-- do not by themselves change the meaning of an objective/indicator association.
-- Optional definition fields are read through JSON, without requiring new columns.
CREATE OR REPLACE FUNCTION vertice_planning.indicator_definition(p_goal jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_strip_nulls(jsonb_build_object(
  'indicator',p_goal->'indicator','unit',p_goal->'unit','direction',p_goal->'direction',
  'formula',coalesce(nullif(p_goal->'indicator_formula','null'::jsonb),p_goal->'formula'),
  'population',coalesce(nullif(p_goal->'indicator_population','null'::jsonb),p_goal->'population')));
$$;
REVOKE ALL ON FUNCTION vertice_planning.indicator_definition(jsonb) FROM PUBLIC,anon,authenticated;

CREATE TABLE vertice_planning.objective_goal_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 course_id uuid NOT NULL REFERENCES public.vertice_courses(id),plan_id uuid NOT NULL REFERENCES vertice_app.strategic_plans(id),
 objective_index integer NOT NULL CHECK(objective_index>=0),objective_snapshot jsonb NOT NULL,goal_id uuid NOT NULL REFERENCES public.vertice_goals(id),
 indicator_snapshot jsonb NOT NULL CHECK(jsonb_typeof(indicator_snapshot)='object'),
 rationale text NOT NULL CHECK(length(btrim(rationale)) BETWEEN 10 AND 2000),linked_by uuid NOT NULL REFERENCES auth.users(id),linked_at timestamptz NOT NULL DEFAULT now(),
 unlinked_by uuid REFERENCES auth.users(id),unlinked_at timestamptz,
 CHECK((unlinked_by IS NULL)=(unlinked_at IS NULL))
);
CREATE UNIQUE INDEX planning_objective_active_link ON vertice_planning.objective_goal_links(plan_id,objective_index,goal_id) WHERE unlinked_at IS NULL;
CREATE INDEX planning_objective_links_scope ON vertice_planning.objective_goal_links(institution_id,course_id,plan_id);
ALTER TABLE vertice_planning.objective_goal_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_planning.objective_goal_links FROM PUBLIC,anon,authenticated;
CREATE POLICY objective_links_read ON vertice_planning.objective_goal_links FOR SELECT TO authenticated USING(vertice_planning.can_interpret(institution_id,course_id));
GRANT ALL ON vertice_planning.objective_goal_links TO service_role;
-- Read-only institutional portfolio. Authorization reuses the portal's MFA-aware membership.
CREATE OR REPLACE FUNCTION vertice_planning.portfolio(p_institution_id uuid,p_semester text DEFAULT NULL,p_course_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_term text; v_terms jsonb; v_courses jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 v_role:=vertice_private.member_role(p_institution_id);
 IF NOT coalesce(vertice_planning.can_interpret(p_institution_id,p_course_id),false) THEN
  RAISE EXCEPTION 'Consolidação restrita à gestão da instituição com verificação de segurança' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=p_institution_id) THEN
  RAISE EXCEPTION 'Instituição não localizada' USING ERRCODE='22023';
 END IF;
 IF p_semester IS NOT NULL AND p_semester !~ '^[0-9]{4}/[12]$' THEN RAISE EXCEPTION 'Semestre inválido' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(semester ORDER BY semester DESC),'[]'::jsonb) INTO v_terms FROM (
  SELECT regexp_replace(semestre,'/0([12])$','/\1') semester FROM public.vertice_course_semester_stats WHERE institution_id=p_institution_id AND (p_course_id IS NULL OR codigo=(SELECT code FROM public.vertice_courses WHERE id=p_course_id AND institution_id=p_institution_id)) AND semestre ~ '^[0-9]{4}/0?[12]$'
  UNION SELECT semester FROM vertice_app.semester_plannings WHERE institution_id=p_institution_id AND (p_course_id IS NULL OR course_id=p_course_id) AND semester ~ '^[0-9]{4}/[12]$'
 ) periods;
 v_term:=coalesce(p_semester,(SELECT max(value) FROM jsonb_array_elements_text(v_terms) WHERE value<=to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY')||CASE WHEN extract(month FROM now() AT TIME ZONE 'America/Sao_Paulo')<=6 THEN '/1' ELSE '/2' END));
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'name',c.name,'code',c.code,
  'strategic',(SELECT jsonb_build_object('id',s.id,'version',s.version,'status',s.status,'updated_at',s.updated_at,'strategic_objectives',s.strategic_objectives,'operational_objectives',s.operational_objectives,'risks',s.risks,'alignment',s.alignment,'swot',s.swot) FROM vertice_app.strategic_plans s WHERE s.institution_id=p_institution_id AND s.course_id=c.id AND s.status<>'archived' ORDER BY s.version DESC,s.updated_at DESC,s.id LIMIT 1),
  'semester',(SELECT jsonb_build_object('id',s.id,'version',s.version,'status',s.status,'updated_at',s.updated_at,'semester',s.semester,'activities',s.activities,'semester_goals',s.semester_goals) FROM vertice_app.semester_plannings s WHERE s.institution_id=p_institution_id AND s.course_id=c.id AND s.semester=v_term AND s.status<>'archived' ORDER BY s.version DESC,s.updated_at DESC,s.id LIMIT 1),
  'code_matches',(SELECT count(*) FROM public.vertice_courses c2 WHERE c2.institution_id=p_institution_id AND c2.code=c.code),
  'stats_matches',(SELECT count(*) FROM public.vertice_course_semester_stats st WHERE st.institution_id=p_institution_id AND st.codigo=c.code AND regexp_replace(st.semestre,'/0([12])$','/\1')=v_term),
  'stats',CASE WHEN (SELECT count(*) FROM public.vertice_courses c2 WHERE c2.institution_id=p_institution_id AND c2.code=c.code)=1 AND (SELECT count(*) FROM public.vertice_course_semester_stats st WHERE st.institution_id=p_institution_id AND st.codigo=c.code AND regexp_replace(st.semestre,'/0([12])$','/\1')=v_term)=1 THEN
   (SELECT jsonb_build_object('matriculados',st.matriculados,'semestre',st.semestre,'created_at',st.created_at) FROM public.vertice_course_semester_stats st WHERE st.institution_id=p_institution_id AND st.codigo=c.code AND regexp_replace(st.semestre,'/0([12])$','/\1')=v_term) ELSE NULL END,
  'previous_stats',CASE WHEN (SELECT count(*) FROM public.vertice_courses c2 WHERE c2.institution_id=p_institution_id AND c2.code=c.code)=1 THEN
   (SELECT jsonb_build_object('matriculados',min(st.matriculados),'semestre',min(st.semestre),'created_at',max(st.created_at)) FROM public.vertice_course_semester_stats st WHERE st.institution_id=p_institution_id AND st.codigo=c.code AND regexp_replace(st.semestre,'/0([12])$','/\1')=CASE WHEN right(v_term,1)='2' THEN left(v_term,4)||'/1' ELSE ((left(v_term,4)::int)-1)::text||'/2' END HAVING count(*)=1) ELSE NULL END,
  'goals',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'indicator',g.indicator,'baseline',g.baseline,'target',g.target,'source',g.source,'owner_name',g.owner_name,'status',g.status) ORDER BY g.id) FROM public.vertice_goals g WHERE g.institution_id=p_institution_id AND g.course_id=c.id),'[]'::jsonb),
  'actions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'what',coalesce(a.what,a.what_description),'who',coalesce(a.who,a.who_responsible),'due_date',coalesce(a.due_date,a.when_deadline),'status',a.status,'validated_by_superior',a.validated_by_superior IS NOT NULL,'has_evidence',a.evidence_doc_id IS NOT NULL OR nullif(btrim(a.evidence::text),'') IS NOT NULL) ORDER BY a.id) FROM public.vertice_actions a WHERE a.institution_id=p_institution_id AND a.course_id=c.id),'[]'::jsonb),
  'tcc',(SELECT jsonb_build_object('works_active',t.works_active,'works_overdue',t.works_overdue) FROM public.v_tcc_course_summary t WHERE t.institution_id=p_institution_id AND t.course_id=c.id),
  'ac',(SELECT jsonb_build_object('submissions_pending',a.submissions_pending) FROM public.v_ac_course_summary a WHERE a.institution_id=p_institution_id AND a.course_id=c.id),
  'internship',(SELECT jsonb_build_object('placements_active',i.placements_active) FROM public.v_internship_course_summary i WHERE i.institution_id=p_institution_id AND i.course_id=c.id)
 ) ORDER BY c.name,c.id),'[]'::jsonb) INTO v_courses
 FROM public.vertice_courses c WHERE c.institution_id=p_institution_id AND (p_course_id IS NULL OR c.id=p_course_id);
 RETURN jsonb_build_object('institution_id',p_institution_id,'semester',v_term,'semesters',v_terms,'courses',v_courses,'fetched_at',now());
END; $$;
REVOKE ALL ON FUNCTION vertice_planning.portfolio(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.portfolio(uuid,text,uuid) TO authenticated;

-- Existing institutional endpoint remains high-management only through the null course scope.
CREATE OR REPLACE FUNCTION vertice_planning.management(p_institution_id uuid,p_semester text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT vertice_planning.portfolio(p_institution_id,p_semester,NULL);
$$;

-- Only trusted callers build the enrichment, using the already authorized portfolio.
CREATE OR REPLACE FUNCTION vertice_planning.interpretation_context(p_context jsonb,p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; enriched jsonb:='[]'; cid uuid; term text:=p_context->>'semester'; observed_term text:=to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY')||CASE WHEN extract(month FROM now() AT TIME ZONE 'America/Sao_Paulo')<=6 THEN '/1' ELSE '/2' END; cutoff date; goals jsonb; history jsonb; learning jsonb; risk jsonb;
BEGIN
 cutoff:=least((now() AT TIME ZONE 'America/Sao_Paulo')::date,CASE WHEN term IS NULL THEN CURRENT_DATE WHEN right(term,1)='1' THEN (left(term,4)||'-06-30')::date ELSE (left(term,4)||'-12-31')::date END);
 FOR c IN SELECT value FROM jsonb_array_elements(coalesce(p_context->'courses','[]')) LOOP
  cid:=(c->>'id')::uuid;
  IF term>observed_term THEN c:=c||jsonb_build_object('stats',NULL,'previous_stats',NULL); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'indicator',g.indicator,'unit',g.unit,'direction',g.direction,'baseline',g.baseline,'baseline_date',g.baseline_date,'target',g.target,'due_date',g.due_date,'status',g.status,'source',g.source,'updated_at',g.updated_at,'indicator_definition',vertice_planning.indicator_definition(to_jsonb(g)),
   'action_documents',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM (SELECT DISTINCT d.id,d.status,d.version_number,d.approved_at,d.expiry_date,d.updated_at,
    (d.status='active' AND d.approved_by IS NOT NULL AND d.approved_at IS NOT NULL AND d.superseded_by IS NULL AND (d.expiry_date IS NULL OR d.expiry_date>=(now() AT TIME ZONE 'America/Sao_Paulo')::date)) human_approved
    FROM public.vertice_actions a JOIN public.vertice_documents d ON d.id=a.evidence_doc_id AND d.institution_id=p_institution AND (d.course_id=cid OR d.course_id IS NULL)
    WHERE a.institution_id=p_institution AND a.course_id=cid AND a.goal_id=g.id AND a.status<>'cancelada') d),'[]'),
   'measurement_limit',24,'measurement_total',(SELECT count(*) FROM public.vertice_goal_measurements m WHERE m.institution_id=p_institution AND m.goal_id=g.id AND m.measured_on<=cutoff),
   'measurements',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.measured_on,m.id) FROM (SELECT m.id,m.measured_on,m.value,m.source,m.updated_at FROM public.vertice_goal_measurements m WHERE m.institution_id=p_institution AND m.goal_id=g.id AND m.measured_on<=cutoff ORDER BY m.measured_on DESC,m.id LIMIT 24) m),'[]'),
   'documents',coalesce((SELECT jsonb_agg(jsonb_build_object('request_id',r.id,'goal_id',r.goal_id,'semester',r.semester,'not_applicable',r.not_applicable,'id',f.id,'status',f.status,'created_at',f.created_at,'reviewed_at',f.reviewed_at) ORDER BY r.id)
    FROM public.vertice_repository_requests r LEFT JOIN LATERAL(SELECT f.id,f.status,f.created_at,f.reviewed_at FROM public.vertice_repository_files f WHERE f.institution_id=p_institution AND f.request_id=r.id ORDER BY f.created_at DESC,f.id DESC LIMIT 1) f ON true
    WHERE r.institution_id=p_institution AND r.course_id=cid AND r.goal_id=g.id AND r.active),'[]')) ORDER BY g.id),'[]') INTO goals
   FROM public.vertice_goals g WHERE g.institution_id=p_institution AND g.course_id=cid;
  SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.semester),'[]') INTO history FROM (
   SELECT regexp_replace(st.semestre,'/0([12])$','/\1') semester,count(*) matches,CASE WHEN count(*)=1 THEN min(st.id::text) ELSE NULL END id,
    CASE WHEN count(*)=1 AND (c->>'code_matches')::integer=1 THEN min(st.matriculados) ELSE NULL END matriculados,
    CASE WHEN count(*)=1 AND (c->>'code_matches')::integer=1 THEN min(st.abandono) ELSE NULL END abandono,
    CASE WHEN count(*)=1 AND (c->>'code_matches')::integer=1 THEN min(st.trancado) ELSE NULL END trancado,
    CASE WHEN count(*)=1 AND (c->>'code_matches')::integer=1 THEN min(st.cancelado) ELSE NULL END cancelado,
    CASE WHEN count(*)=1 AND (c->>'code_matches')::integer=1 THEN min(st.transferido) ELSE NULL END transferido,
    max(st.created_at) created_at
   FROM public.vertice_course_semester_stats st WHERE st.institution_id=p_institution AND st.codigo=c->>'code' AND st.semestre ~ '^[0-9]{4}/0?[12]$' AND regexp_replace(st.semestre,'/0([12])$','/\1')<=least(coalesce(term,observed_term),observed_term)
   GROUP BY regexp_replace(st.semestre,'/0([12])$','/\1') ORDER BY semester DESC LIMIT 8) h;
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.semester,m.subject_code,m.module,m.competency),'[]') INTO learning FROM (
   SELECT m.semester,m.subject_code,m.module,m.competency,m.participants,m.paired_students,m.curricular_average,m.external_accuracy,m.activity_rate,m.updated_at
   FROM public.vertice_learning_course_metrics m WHERE m.institution_id=p_institution AND m.course_id=cid AND m.participants>=5 AND (m.semester<=coalesce(least(term,observed_term),observed_term))
   ORDER BY m.semester DESC,m.subject_code,m.module,m.competency LIMIT 100) m;
  risk:=jsonb_build_object('status','unavailable','notice','Fonte de risco não disponível; ausência não é zero.');
  IF to_regclass('public.v_student_evasion_risk') IS NOT NULL THEN
   BEGIN
    EXECUTE 'SELECT jsonb_build_object(''status'',''available'',''reference'',''current'',''groups'',coalesce(jsonb_agg(jsonb_build_object(''risk_level'',r.risk_level,''students'',CASE WHEN r.n>=5 THEN r.n ELSE NULL END,''suppressed'',r.n<5)),''[]''),''notice'',''Heurística cadastral atual, sem probabilidade calibrada ou taxa de evasão; grupos menores que cinco suprimidos.'') FROM (SELECT risk_level,count(*) n FROM public.v_student_evasion_risk WHERE institution_id=$1 AND course_id=$2 GROUP BY risk_level) r' INTO risk USING p_institution,cid;
   EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
   END;
  END IF;
  SELECT c||jsonb_build_object('goals',goals,'enrollment_history',history,'learning_history',learning,'learning_history_total',(SELECT count(*) FROM public.vertice_learning_course_metrics m WHERE m.institution_id=p_institution AND m.course_id=cid AND m.participants>=5 AND m.semester<=coalesce(least(term,observed_term),observed_term)),'permanence',risk,
   'objective_links',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'plan_id',l.plan_id,'goal_id',l.goal_id,'objective_index',l.objective_index,'rationale',l.rationale,'linked_at',l.linked_at,'linked_by',l.linked_by,'indicator_snapshot',l.indicator_snapshot,
    'valid_for_snapshot',l.objective_snapshot=(c->'strategic'->'strategic_objectives'->l.objective_index) AND EXISTS(SELECT 1 FROM public.vertice_goals g WHERE g.id=l.goal_id AND g.institution_id=p_institution AND g.course_id=cid AND g.status<>'cancelada' AND l.indicator_snapshot=vertice_planning.indicator_definition(to_jsonb(g)))) ORDER BY l.id) FROM vertice_planning.objective_goal_links l WHERE l.institution_id=p_institution AND l.course_id=cid AND l.plan_id=(c->'strategic'->>'id')::uuid AND l.unlinked_at IS NULL),'[]'),
   'actions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'goal_id',a.goal_id,'what',coalesce(a.what,a.what_description),'why',coalesce(a.why,a.why_justification),'where',coalesce(a.where_at,a.where_location),'who',coalesce(a.who,a.who_responsible),'how',coalesce(a.how,a.how_method),'declared_cost',coalesce(a.how_much,a.how_much_cost::text),'validated_by_superior',a.validated_by_superior IS NOT NULL,'evidence_doc_id',CASE WHEN EXISTS(SELECT 1 FROM public.vertice_documents d WHERE d.id=a.evidence_doc_id AND d.institution_id=p_institution AND (d.course_id=cid OR d.course_id IS NULL)) THEN a.evidence_doc_id ELSE NULL END,'status',a.status,'due_date',coalesce(a.due_date,a.when_deadline),'has_evidence',a.evidence_doc_id IS NOT NULL OR nullif(btrim(a.evidence::text),'') IS NOT NULL,'updated_at',a.updated_at) ORDER BY a.id) FROM public.vertice_actions a WHERE a.institution_id=p_institution AND a.course_id=cid),'[]')) INTO c;
  enriched:=enriched||jsonb_build_array(c);
 END LOOP;
 RETURN jsonb_set(p_context,'{courses}',enriched)||jsonb_build_object('reference_date',cutoff,'collection_rules',jsonb_build_object('academic_semester',term,'future_academic_period',coalesce(term>observed_term,false),'measurements_cutoff',cutoff,'enrollment_period_limit',8,'goal_measurement_limit',24,'learning_group_limit',100,
  'current_sources','Estratégia mais recente, metas, ações, documentos, risco e TCC/AC/estágio são cadastro atual. Selecionar semestre passado não reconstrói estado histórico destes registros.',
  'longitudinal_limits','Contagens de abandono, trancamento, cancelamento e transferência são as declaradas na carga semestral, sem coorte/denominador verificado. Medições da mesma meta cadastral não historizam mudanças da fórmula, unidade ou população. Aprendizagem é por grupo e pode conter os mesmos alunos em grupos distintos. Não somar participantes.',
  'evidence_limits','Metadados do documento mais recente por solicitação e dos documentos explicitamente referenciados nas ações do curso; aprovação humana vigente é distinta de documento ativo.  conteúdo e suficiência material não aferidos. Fonte textual de medição não equivale a validação humana.',
  'pdi','Alinhamento declarado preservado; vínculo estruturado ao PDI não comprovado.'));
END $$;
REVOKE ALL ON FUNCTION vertice_planning.interpretation_context(jsonb,uuid) FROM PUBLIC,anon,authenticated;

-- Avoid sending institution-wide inventory to a course-scoped analyst.
CREATE OR REPLACE FUNCTION vertice_private.sapiens_module_context() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.course_id IS NULL THEN
  NEW.context:=NEW.context||jsonb_build_object('institutional_module_inventory',vertice_private.bi_module_snapshot(NEW.institution_id),
   'module_inventory_limit','Disponibilidade cadastral institucional; contagens incluem rascunhos e não comprovam resultado.');
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION vertice_planning.sapiens(p_institution_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tier text; v_role text; v_management boolean; v_context jsonb; v_courses jsonb; v_course uuid; v_term text; v_row public.vertice_sapiens_planning_analyses; v_id uuid; v_plan vertice_app.strategic_plans; v_index integer; v_goal public.vertice_goals;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>20000 THEN RAISE EXCEPTION 'Conteúdo inválido'; END IF;
 v_role:=vertice_private.member_role(p_institution_id);
 v_management:=coalesce(v_role IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador'),false);
 v_course:=nullif(p_payload->>'course_id','')::uuid; v_term:=nullif(p_payload->>'semester','');
 IF NOT coalesce(v_role IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde'),false) THEN RAISE EXCEPTION 'Análise exige vínculo autorizado e segundo fator' USING ERRCODE='42501'; END IF;
 SELECT tier INTO v_tier FROM public.vertice_institutions WHERE id=p_institution_id;
 IF v_tier IS NULL THEN RAISE EXCEPTION 'Instituição não localizada'; END IF;
 IF v_term IS NOT NULL AND v_term !~ '^[0-9]{4}/[12]$' THEN RAISE EXCEPTION 'Semestre inválido'; END IF;
 IF p_action='options' THEN
  RETURN jsonb_build_object('scope',CASE WHEN v_tier='escolas' THEN 'escolas' ELSE 'superior' END,'can_review',v_management,'institutional',v_management,
   'audience',CASE WHEN NOT v_management THEN 'coordenacao' WHEN v_role='diretor_pedagogico' THEN 'direcao' ELSE 'alta_gestao' END,
   'courses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM public.vertice_courses c WHERE c.institution_id=p_institution_id AND vertice_planning.can_interpret(p_institution_id,c.id) AND
    (EXISTS(SELECT 1 FROM vertice_app.strategic_plans s WHERE s.course_id=c.id AND s.institution_id=p_institution_id AND s.status<>'archived') OR EXISTS(SELECT 1 FROM vertice_app.semester_plannings s WHERE s.course_id=c.id AND s.institution_id=p_institution_id AND s.status<>'archived'))),'[]'));
 END IF;
 IF NOT vertice_planning.can_interpret(p_institution_id,v_course) OR (v_tier='escolas' AND NOT v_management) THEN RAISE EXCEPTION 'Recorte fora do vínculo autorizado' USING ERRCODE='42501'; END IF;
 IF v_course IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=v_course AND institution_id=p_institution_id) THEN RAISE EXCEPTION 'Curso fora da instituição' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(s)-'context') FROM (
   SELECT * FROM public.vertice_sapiens_planning_analyses a WHERE a.institution_id=p_institution_id AND (v_course IS NULL OR a.course_id=v_course)
    AND (v_term IS NULL OR coalesce(a.semester,a.context->>'semester',a.context->>'requested_semester')=v_term)
    AND (v_management OR a.result->>'schema_version'='2' OR a.status IN ('generating','failed')) ORDER BY created_at DESC,id DESC LIMIT 20) s),'[]');
 ELSIF p_action='links' THEN
  IF v_course IS NULL THEN RAISE EXCEPTION 'Selecione um curso'; END IF;
  SELECT * INTO v_plan FROM vertice_app.strategic_plans WHERE institution_id=p_institution_id AND course_id=v_course AND status<>'archived' ORDER BY version DESC,updated_at DESC,id LIMIT 1;
  RETURN jsonb_build_object('plan',CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object('id',v_plan.id,'version',v_plan.version,'status',v_plan.status,'updated_at',v_plan.updated_at,'strategic_objectives',v_plan.strategic_objectives) END,
   'goals',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'indicator',g.indicator,'unit',g.unit,'direction',g.direction,'updated_at',g.updated_at,'indicator_definition',vertice_planning.indicator_definition(to_jsonb(g))) ORDER BY g.id) FROM public.vertice_goals g WHERE g.institution_id=p_institution_id AND g.course_id=v_course AND g.status<>'cancelada'),'[]'),
   'links',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'goal_id',l.goal_id,'objective_index',l.objective_index,'rationale',l.rationale,'indicator_snapshot',l.indicator_snapshot,
    'objective_matches',l.objective_snapshot=(v_plan.strategic_objectives->l.objective_index),
    'indicator_matches',EXISTS(SELECT 1 FROM public.vertice_goals g WHERE g.id=l.goal_id AND g.institution_id=p_institution_id AND g.course_id=v_course AND g.status<>'cancelada' AND l.indicator_snapshot=vertice_planning.indicator_definition(to_jsonb(g))),
    'valid_for_snapshot',l.objective_snapshot=(v_plan.strategic_objectives->l.objective_index) AND EXISTS(SELECT 1 FROM public.vertice_goals g WHERE g.id=l.goal_id AND g.institution_id=p_institution_id AND g.course_id=v_course AND g.status<>'cancelada' AND l.indicator_snapshot=vertice_planning.indicator_definition(to_jsonb(g)))) ORDER BY l.id) FROM vertice_planning.objective_goal_links l WHERE l.institution_id=p_institution_id AND l.course_id=v_course AND l.plan_id=v_plan.id AND l.unlinked_at IS NULL),'[]'));
 ELSIF p_action IN ('link_objective','unlink_objective') THEN
  IF v_course IS NULL THEN RAISE EXCEPTION 'Selecione um curso'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('course-planning:'||v_course::text,0));
  SELECT * INTO v_plan FROM vertice_app.strategic_plans WHERE institution_id=p_institution_id AND course_id=v_course AND status<>'archived' ORDER BY version DESC,updated_at DESC,id LIMIT 1 FOR UPDATE;
  IF v_plan.id IS NULL OR v_plan.id IS DISTINCT FROM (p_payload->>'plan_id')::uuid OR v_plan.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION 'Versão alterada. Atualize os vínculos antes de continuar.' USING ERRCODE='40001'; END IF;
  IF p_action='unlink_objective' THEN
   UPDATE vertice_planning.objective_goal_links SET unlinked_at=now(),unlinked_by=auth.uid() WHERE id=(p_payload->>'id')::uuid AND institution_id=p_institution_id AND course_id=v_course AND plan_id=v_plan.id AND unlinked_at IS NULL RETURNING id INTO v_id;
   IF v_id IS NULL THEN RAISE EXCEPTION 'Vínculo não localizado neste curso'; END IF;
  ELSE
   v_index:=(p_payload->>'objective_index')::integer;
   IF v_index IS NULL OR v_index<0 OR jsonb_typeof(v_plan.strategic_objectives->v_index) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Objetivo inválido'; END IF;
   SELECT * INTO v_goal FROM public.vertice_goals WHERE id=(p_payload->>'goal_id')::uuid AND institution_id=p_institution_id AND course_id=v_course AND status<>'cancelada' FOR UPDATE;
   IF v_goal.id IS NULL THEN RAISE EXCEPTION 'Meta fora do curso autorizado' USING ERRCODE='42501'; END IF;
   IF v_goal.updated_at IS DISTINCT FROM nullif(p_payload->>'expected_goal_updated_at','')::timestamptz OR
      vertice_planning.indicator_definition(to_jsonb(v_goal)) IS DISTINCT FROM p_payload->'expected_indicator_definition' THEN
    RAISE EXCEPTION 'Meta ou indicador alterado. Atualize os vínculos antes de confirmar.' USING ERRCODE='40001';
   END IF;
   IF length(btrim(coalesce(p_payload->>'rationale',''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Justifique o vínculo entre objetivo, meta e indicador (10 a 2000 caracteres)'; END IF;
   INSERT INTO vertice_planning.objective_goal_links(institution_id,course_id,plan_id,objective_index,objective_snapshot,goal_id,indicator_snapshot,rationale,linked_by)
    VALUES(p_institution_id,v_course,v_plan.id,v_index,v_plan.strategic_objectives->v_index,v_goal.id,vertice_planning.indicator_definition(to_jsonb(v_goal)),p_payload->>'rationale',auth.uid()) RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v_id);
 ELSIF p_action='review' THEN
  IF NOT v_management THEN RAISE EXCEPTION 'Revisão gerencial restrita à direção e alta gestão' USING ERRCODE='42501'; END IF;
  IF p_payload->>'status' IS NULL OR p_payload->>'status' NOT IN ('reviewed','rejected') OR length(btrim(coalesce(p_payload->>'note','')))<10 THEN RAISE EXCEPTION 'Registre decisão e justificativa (mínimo 10 caracteres)'; END IF;
  UPDATE public.vertice_sapiens_planning_analyses SET status=p_payload->>'status',review_note=left(p_payload->>'note',4000),reviewed_by=auth.uid(),reviewed_at=now()
   WHERE id=(p_payload->>'id')::uuid AND institution_id=p_institution_id AND (v_course IS NULL OR course_id=v_course) AND status='pending_review' RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Parecer já revisado ou indisponível' USING ERRCODE='40001'; END IF;
  RETURN to_jsonb(v_row)-'context';
 ELSIF p_action<>'start' THEN RAISE EXCEPTION 'Operação inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':sapiens-planning',0));
 IF EXISTS(SELECT 1 FROM public.vertice_sapiens_planning_analyses WHERE institution_id=p_institution_id AND status='generating' AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'Já existe análise em andamento. Aguarde alguns minutos.'; END IF;
 IF v_tier='escolas' THEN
  IF v_course IS NOT NULL THEN RAISE EXCEPTION 'Escola utiliza escopo institucional'; END IF;
  v_context:=vertice_planning.school_planning(p_institution_id,'strategic','overview','{}');
  v_context:=v_context||jsonb_build_object('school_operations',vertice_planning.school_operations_context(p_institution_id,CASE WHEN v_term IS NOT NULL THEN left(v_term,4)::int ELSE NULL END));
  v_context:=jsonb_set(v_context,'{semesters}',coalesce((SELECT jsonb_agg(s) FROM jsonb_array_elements(v_context->'semesters') s WHERE v_term IS NULL OR s->>'semester'=v_term),'[]'));
  IF v_context->'strategic'='null'::jsonb AND jsonb_array_length(v_context->'semesters')=0 THEN RAISE EXCEPTION 'Salve um planejamento antes de solicitar a interpretação'; END IF;
  v_context:=v_context||jsonb_build_object('reference_date',(now() AT TIME ZONE 'America/Sao_Paulo')::date);
 ELSE
  v_context:=vertice_planning.portfolio(p_institution_id,v_term,v_course);
  SELECT coalesce(jsonb_agg(c),'[]') INTO v_courses FROM jsonb_array_elements(v_context->'courses') c WHERE c->'strategic'<>'null'::jsonb OR c->'semester'<>'null'::jsonb;
  IF jsonb_array_length(v_courses)=0 THEN RAISE EXCEPTION 'Nenhum planejamento salvo neste recorte'; END IF;
  SELECT jsonb_agg(c||jsonb_build_object('strategic',coalesce((SELECT to_jsonb(s)-ARRAY['created_by','updated_by','institution_id','course_id'] FROM vertice_app.strategic_plans s WHERE s.id=(c->'strategic'->>'id')::uuid),'null'::jsonb),
   'semester',coalesce((SELECT to_jsonb(s)-ARRAY['created_by','updated_by','institution_id','course_id'] FROM vertice_app.semester_plannings s WHERE s.id=(c->'semester'->>'id')::uuid),'null'::jsonb))) INTO v_courses FROM jsonb_array_elements(v_courses) c;
  v_context:=vertice_planning.interpretation_context(jsonb_set(v_context,'{courses}',v_courses),p_institution_id);
 END IF;
 v_context:=v_context||jsonb_build_object('scope',CASE WHEN v_tier='escolas' THEN 'escolas' ELSE 'superior' END,'requested_semester',v_term,'audience',CASE WHEN NOT v_management THEN 'coordenacao' WHEN v_role='diretor_pedagogico' THEN 'direcao' ELSE 'alta_gestao' END,
  'institution_name',(SELECT name FROM public.vertice_institutions WHERE id=p_institution_id),'sources',jsonb_build_array('Planejamentos salvos','Metas e medições','Ações 5W2H','Metadados documentais','Indicadores acadêmicos e Sapiens disponíveis'));
 INSERT INTO public.vertice_sapiens_planning_analyses(institution_id,course_id,semester,scope,context,created_by)
  VALUES(p_institution_id,v_course,coalesce(v_term,v_context->>'semester'),CASE WHEN v_tier='escolas' THEN 'escolas' ELSE 'superior' END,v_context,auth.uid()) RETURNING id,context INTO v_id,v_context;
 -- Return the exact persisted context, including authorized trigger enrichment, for a matching hash.
 RETURN jsonb_build_object('id',v_id,'context',v_context);
END $$;
REVOKE ALL ON FUNCTION vertice_planning.sapiens(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.sapiens(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
