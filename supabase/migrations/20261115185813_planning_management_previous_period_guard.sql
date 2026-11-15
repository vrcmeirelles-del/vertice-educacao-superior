-- Read-only institutional portfolio. Authorization reuses the portal's MFA-aware membership.
CREATE OR REPLACE FUNCTION vertice_planning.management(p_institution_id uuid,p_semester text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_term text; v_terms jsonb; v_courses jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 v_role:=vertice_private.member_role(p_institution_id);
 IF v_role IS NULL OR v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') THEN
  RAISE EXCEPTION 'Consolidação restrita à gestão da instituição com verificação de segurança' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=p_institution_id) THEN
  RAISE EXCEPTION 'Instituição não localizada' USING ERRCODE='22023';
 END IF;
 IF p_semester IS NOT NULL AND p_semester !~ '^[0-9]{4}/[12]$' THEN RAISE EXCEPTION 'Semestre inválido' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(semester ORDER BY semester DESC),'[]'::jsonb) INTO v_terms FROM (
  SELECT regexp_replace(semestre,'/0([12])$','/\1') semester FROM public.vertice_course_semester_stats WHERE institution_id=p_institution_id AND semestre ~ '^[0-9]{4}/0?[12]$'
  UNION SELECT semester FROM vertice_app.semester_plannings WHERE institution_id=p_institution_id AND semester ~ '^[0-9]{4}/[12]$'
 ) periods;
 v_term:=coalesce(p_semester,v_terms->>0);
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
 FROM public.vertice_courses c WHERE c.institution_id=p_institution_id;
 RETURN jsonb_build_object('institution_id',p_institution_id,'semester',v_term,'semesters',v_terms,'courses',v_courses,'fetched_at',now());
END; $$;
REVOKE ALL ON FUNCTION vertice_planning.management(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_planning.management(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.vertice_planning_management(p_institution_id uuid,p_semester text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT vertice_planning.management(p_institution_id,p_semester); $$;
REVOKE ALL ON FUNCTION public.vertice_planning_management(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_planning_management(uuid,text) TO authenticated;
