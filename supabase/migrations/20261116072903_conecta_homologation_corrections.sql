-- Conecta/Egressos: enforce native course/MFA boundaries and correct longitudinal indicators.
-- No real identity reconciliation, survey activation, or messaging is executed here.
BEGIN;
ALTER TABLE public.vertice_alumni_education ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;
ALTER TABLE public.vertice_alumni_surveys ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.vertice_alumni_education.is_synthetic IS 'Explicitly isolated fixtures; excluded from operational indicators and personal access.';
-- Exact signature of the pre-existing seed, confirmed during homologation. Preserve all sources.
UPDATE public.vertice_alumni_education e SET is_synthetic=true
FROM public.vertice_alumni_profiles p
WHERE p.id=e.profile_id AND e.course_id IS NULL AND e.enrollment_id ~ '^TST[0-9]{5}$'
AND p.full_name ~ '^Egresso Teste [0-9]+$' AND p.cpf_hash IS NULL
AND (p.email IS NULL OR p.email ~ '^teste[0-9]+@example[.]com$')
AND e.conclusion_year=2024 AND e.conclusion_semester=2 AND e.status_source='import' AND p.source='import';
UPDATE public.vertice_alumni_surveys s SET is_synthetic=true
WHERE s.title='[TESTE] Pesquisa Inicial de Egressos' AND s.survey_origin IS NULL
AND EXISTS(SELECT 1 FROM public.vertice_alumni_survey_responses r JOIN public.vertice_alumni_education e ON e.id=r.education_id
 WHERE r.survey_id=s.id AND e.institution_id=s.institution_id AND e.is_synthetic)
AND NOT EXISTS(SELECT 1 FROM public.vertice_alumni_survey_responses r LEFT JOIN public.vertice_alumni_education e ON e.id=r.education_id
 WHERE r.survey_id=s.id AND (e.id IS NULL OR e.institution_id<>s.institution_id OR NOT e.is_synthetic));

-- Private authorization lookups avoid recursive RLS; only return authorization booleans.
CREATE FUNCTION vertice_private.alumni_scope(inst uuid,course uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'aal','')='aal2'
 AND EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=inst AND tier='superior')
 AND (course IS NULL OR EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=course AND institution_id=inst))
 AND coalesce(vertice_conecta.allowed(inst,course),false)
$$;
CREATE FUNCTION vertice_private.alumni_profile_scope(person uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.vertice_alumni_education e
 WHERE e.profile_id=person AND NOT e.is_synthetic AND vertice_private.alumni_scope(e.institution_id,e.course_id))
$$;
CREATE FUNCTION vertice_private.alumni_formation_scope(person uuid,education uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.vertice_alumni_education e
 WHERE e.profile_id=person AND NOT e.is_synthetic AND vertice_private.alumni_scope(e.institution_id,e.course_id)
 AND (e.id=education OR (education IS NULL AND (SELECT count(*) FROM public.vertice_alumni_education x WHERE x.profile_id=person AND NOT x.is_synthetic)=1)))
$$;
CREATE FUNCTION vertice_private.alumni_survey_scope(survey uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.vertice_alumni_surveys s
 WHERE s.id=survey AND NOT s.is_synthetic AND vertice_private.alumni_scope(s.institution_id,s.course_id))
$$;
CREATE FUNCTION vertice_private.alumni_response_scope(response uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.vertice_alumni_survey_responses r
 WHERE r.id=response AND vertice_private.alumni_survey_scope(r.survey_id)
 AND vertice_private.alumni_formation_scope(r.profile_id,r.education_id))
$$;
REVOKE ALL ON FUNCTION vertice_private.alumni_scope(uuid,uuid),vertice_private.alumni_profile_scope(uuid),vertice_private.alumni_formation_scope(uuid,uuid),vertice_private.alumni_survey_scope(uuid),vertice_private.alumni_response_scope(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_private.alumni_scope(uuid,uuid),vertice_private.alumni_profile_scope(uuid),vertice_private.alumni_formation_scope(uuid,uuid),vertice_private.alumni_survey_scope(uuid),vertice_private.alumni_response_scope(uuid) TO authenticated,service_role;

REVOKE ALL ON public.vertice_alumni_profiles,public.vertice_alumni_education,public.vertice_alumni_employment,public.vertice_alumni_surveys,public.vertice_alumni_survey_questions,public.vertice_alumni_survey_invitations,public.vertice_alumni_survey_responses,public.vertice_alumni_survey_answers FROM anon;
-- Native writes of individual records go through scoped RPCs/Edge, not table APIs.
REVOKE INSERT,UPDATE,DELETE ON public.vertice_alumni_profiles,public.vertice_alumni_education,public.vertice_alumni_employment,
 public.vertice_alumni_survey_questions,public.vertice_alumni_survey_invitations,public.vertice_alumni_survey_responses,public.vertice_alumni_survey_answers FROM anon,authenticated;
REVOKE UPDATE,DELETE ON public.vertice_alumni_surveys FROM anon,authenticated;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['vertice_alumni_profiles','vertice_alumni_education','vertice_alumni_employment','vertice_alumni_surveys','vertice_alumni_survey_questions','vertice_alumni_survey_invitations','vertice_alumni_survey_responses','vertice_alumni_survey_answers']LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);END LOOP;END $$;
CREATE POLICY alumni_draft_insert_guard ON public.vertice_alumni_surveys AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(status='rascunho');
-- Restrictive policies compose with every pre-existing permissive policy, including Master.
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_education AS RESTRICTIVE FOR ALL TO authenticated
 USING(NOT is_synthetic AND vertice_private.alumni_scope(institution_id,course_id))
 WITH CHECK(NOT is_synthetic AND vertice_private.alumni_scope(institution_id,course_id));
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_profiles AS RESTRICTIVE FOR ALL TO authenticated
 USING(vertice_private.alumni_profile_scope(id)) WITH CHECK(vertice_private.alumni_profile_scope(id));
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_employment AS RESTRICTIVE FOR ALL TO authenticated
 USING(vertice_private.alumni_formation_scope(profile_id,education_id)) WITH CHECK(vertice_private.alumni_formation_scope(profile_id,education_id));
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_surveys AS RESTRICTIVE FOR ALL TO authenticated
 USING(NOT is_synthetic AND vertice_private.alumni_scope(institution_id,course_id))
 WITH CHECK(NOT is_synthetic AND vertice_private.alumni_scope(institution_id,course_id));
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_survey_questions AS RESTRICTIVE FOR ALL TO authenticated
 USING(vertice_private.alumni_survey_scope(survey_id)) WITH CHECK(vertice_private.alumni_survey_scope(survey_id));
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_survey_invitations AS RESTRICTIVE FOR ALL TO authenticated
 USING(vertice_private.alumni_survey_scope(survey_id) AND vertice_private.alumni_formation_scope(profile_id,education_id))
 WITH CHECK(vertice_private.alumni_survey_scope(survey_id) AND vertice_private.alumni_formation_scope(profile_id,education_id));
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_survey_responses AS RESTRICTIVE FOR ALL TO authenticated
 USING(vertice_private.alumni_survey_scope(survey_id) AND vertice_private.alumni_formation_scope(profile_id,education_id))
 WITH CHECK(vertice_private.alumni_survey_scope(survey_id) AND vertice_private.alumni_formation_scope(profile_id,education_id));
CREATE POLICY alumni_course_mfa_guard ON public.vertice_alumni_survey_answers AS RESTRICTIVE FOR ALL TO authenticated
 USING(vertice_private.alumni_response_scope(response_id)) WITH CHECK(vertice_private.alumni_response_scope(response_id));


CREATE OR REPLACE VIEW public.v_alumni_survey_indicators WITH(security_invoker=true) AS
WITH eligible_profiles AS (
 SELECT DISTINCT s.id survey_id,e.profile_id FROM public.vertice_alumni_surveys s
 JOIN public.vertice_alumni_education e ON e.institution_id=s.institution_id AND (s.course_id IS NULL OR s.course_id=e.course_id)
 WHERE NOT s.is_synthetic AND NOT e.is_synthetic AND
 CASE WHEN s.survey_origin='conecta_short' THEN coalesce(vertice_conecta.survey_eligible(s,e),false)
 ELSE e.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado','concluinte') END
), eligible AS(SELECT survey_id,count(*) total_eligible FROM eligible_profiles GROUP BY survey_id),
 invited AS(SELECT i.survey_id,count(*) total_invited,count(*) FILTER(WHERE i.delivery_status='entregue') total_delivered
 FROM public.vertice_alumni_survey_invitations i JOIN eligible_profiles e ON e.survey_id=i.survey_id AND e.profile_id=i.profile_id GROUP BY i.survey_id),
 responded AS(SELECT r.survey_id,count(DISTINCT r.profile_id) total_respondents FROM public.vertice_alumni_survey_responses r
 JOIN eligible_profiles e ON e.survey_id=r.survey_id AND e.profile_id=r.profile_id WHERE r.status IN ('concluida','corrigida') GROUP BY r.survey_id)
 SELECT s.institution_id,s.id survey_id,s.title survey_title,s.wave_type,
 coalesce(e.total_eligible,0::bigint) total_eligible,coalesce(i.total_invited,0::bigint) total_invited,
 coalesce(i.total_delivered,0::bigint) total_delivered,coalesce(r.total_respondents,0::bigint) total_respondents,
 CASE WHEN e.total_eligible>0 THEN round(100.0*coalesce(r.total_respondents,0)/e.total_eligible,2) ELSE NULL::numeric END pct_eligible,
 CASE WHEN i.total_invited>0 THEN round(100.0*coalesce(r.total_respondents,0)/i.total_invited,2) ELSE NULL::numeric END pct_invited,
 CASE WHEN i.total_delivered>0 THEN round(100.0*coalesce(r.total_respondents,0)/i.total_delivered,2) ELSE NULL::numeric END pct_delivered
 FROM public.vertice_alumni_surveys s LEFT JOIN eligible e ON e.survey_id=s.id LEFT JOIN invited i ON i.survey_id=s.id
 LEFT JOIN responded r ON r.survey_id=s.id WHERE NOT s.is_synthetic;

GRANT EXECUTE ON FUNCTION vertice_conecta.survey_eligible(public.vertice_alumni_surveys,public.vertice_alumni_education) TO authenticated;


CREATE OR REPLACE VIEW public.v_alumni_trajectory_indicators WITH(security_invoker=true) AS
WITH base AS(
 SELECT e.institution_id,e.course_id,e.profile_id,job.employment_status emp_status,
 CASE WHEN job.employment_status NOT IN ('desempregado','nao_informado') THEN job.field_relation END emp_field_relation,
 job.seeking_work emp_seeking,
 CASE WHEN EXISTS(SELECT 1 FROM public.vertice_alumni_further_ed fe WHERE fe.profile_id=e.profile_id)
 THEN EXISTS(SELECT 1 FROM public.vertice_alumni_further_ed fe WHERE fe.profile_id=e.profile_id AND fe.status IN ('em_andamento','concluido')) END has_further_ed
 FROM public.vertice_alumni_education e
 LEFT JOIN LATERAL(SELECT emp.* FROM public.vertice_alumni_employment emp
 WHERE emp.profile_id=e.profile_id AND emp.education_id=e.id AND (emp.employment_type='principal' OR emp.employment_type IS NULL)
 ORDER BY emp.reference_date DESC NULLS LAST,emp.reported_at DESC NULLS LAST,emp.id DESC LIMIT 1)job ON true
 WHERE NOT e.is_synthetic AND e.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado','concluinte'))
 SELECT institution_id,course_id,count(DISTINCT profile_id) total_egressos,
 count(DISTINCT profile_id) FILTER(WHERE emp_status IS NOT NULL AND emp_status<>'nao_informado') respostas_trabalho,
 count(DISTINCT profile_id) FILTER(WHERE emp_status IS NOT NULL AND emp_status NOT IN ('desempregado','nao_informado')) em_atividade,
 count(DISTINCT profile_id) FILTER(WHERE emp_status='desempregado') desempregados,
 count(DISTINCT profile_id) FILTER(WHERE emp_status='desempregado' AND emp_seeking) desempregados_buscando,
 count(DISTINCT profile_id) FILTER(WHERE emp_field_relation IS NOT NULL AND emp_field_relation<>'nao_informado') responderam_aderencia,
 count(DISTINCT profile_id) FILTER(WHERE emp_field_relation IN ('area_formacao','area_correlata')) area_ou_correlata,
 count(DISTINCT profile_id) FILTER(WHERE has_further_ed) respostas_estudos_validas,
 count(DISTINCT profile_id) FILTER(WHERE emp_status IS NOT NULL AND emp_status<>'nao_informado' AND has_further_ed IS NOT NULL) respostas_ambas,
 count(DISTINCT profile_id) FILTER(WHERE (emp_status IS NOT NULL AND emp_status NOT IN ('desempregado','nao_informado')) OR has_further_ed) trabalha_ou_estuda
 FROM base GROUP BY institution_id,course_id;

CREATE OR REPLACE VIEW public.vertice_alumni_overview WITH(security_invoker=true) AS  SELECT ae.institution_id,
    ae.course_id,
    c.name AS course_name,
    c.modality,
    ae.academic_status,
    ae.conclusion_year,
    ae.conclusion_semester,
    ae.status_verified,
    count(DISTINCT ae.profile_id) AS total_egressos,
    count(DISTINCT ae.profile_id) FILTER (WHERE ap.email IS NOT NULL) AS com_contato_valido,
    count(DISTINCT ae.profile_id) FILTER (WHERE ap.contact_updated_at > (now() - '1 year'::interval)) AS contato_atualizado_12m
   FROM vertice_alumni_education ae
     JOIN vertice_alumni_profiles ap ON ap.id = ae.profile_id
     LEFT JOIN vertice_courses c ON c.id = ae.course_id
  WHERE NOT ae.is_synthetic AND ae.academic_status = ANY (ARRAY['formado'::text, 'diplomado'::text, 'egresso_acompanhado'::text, 'integralizado'::text, 'concluinte'::text])
  GROUP BY ae.institution_id, ae.course_id, c.name, c.modality, ae.academic_status, ae.conclusion_year, ae.conclusion_semester, ae.status_verified;


CREATE FUNCTION vertice_conecta.alumni_indicators(inst uuid,kind text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r text;result jsonb;BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'Autenticação e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 r:=vertice_private.member_role(inst);
 IF r IS NULL OR r NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde','cpa') THEN RAISE EXCEPTION 'Vínculo institucional obrigatório' USING ERRCODE='42501';END IF;
 IF kind='overview' THEN SELECT jsonb_agg(v) INTO result FROM public.vertice_alumni_overview v WHERE v.institution_id=inst AND (r='cpa' OR vertice_private.alumni_scope(inst,v.course_id));
 ELSIF kind='surveys' THEN SELECT jsonb_agg(v) INTO result FROM public.v_alumni_survey_indicators v JOIN public.vertice_alumni_surveys s ON s.id=v.survey_id WHERE v.institution_id=inst AND (r='cpa' OR vertice_private.alumni_scope(inst,s.course_id));
 ELSIF kind='trajectory' THEN SELECT jsonb_agg(v) INTO result FROM public.v_alumni_trajectory_indicators v WHERE v.institution_id=inst AND (r='cpa' OR vertice_private.alumni_scope(inst,v.course_id));
 ELSE RAISE EXCEPTION 'Indicador inválido';END IF;RETURN coalesce(result,'[]');END $$;
REVOKE ALL ON FUNCTION vertice_conecta.alumni_indicators(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_conecta.alumni_indicators(uuid,text) TO authenticated;
CREATE FUNCTION public.vertice_alumni_indicators(p_institution uuid,p_kind text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT vertice_conecta.alumni_indicators(p_institution,p_kind) $$;
REVOKE ALL ON FUNCTION public.vertice_alumni_indicators(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_alumni_indicators(uuid,text) TO authenticated;


CREATE FUNCTION vertice_conecta.prepare_alumni_access(inst uuid,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.vertice_alumni_education;ap public.vertice_alumni_profiles;st public.vertice_student_registry; c uuid; n integer;BEGIN
 c:=nullif(p->>'course_id','')::uuid;
 IF NOT coalesce(vertice_conecta.allowed(inst,c),false) THEN RAISE EXCEPTION 'Vínculo, curso e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 IF p->>'confirmed' IS DISTINCT FROM 'true' OR length(btrim(coalesce(p->>'note',''))) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'Confirme os documentos e justifique o acesso';END IF;
 SELECT * INTO e FROM public.vertice_alumni_education WHERE id=(p->>'education_id')::uuid AND institution_id=inst AND NOT is_synthetic FOR UPDATE;
 IF e.id IS NULL OR e.course_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=e.course_id AND institution_id=inst) OR (c IS NOT NULL AND c<>e.course_id) OR NOT coalesce(vertice_conecta.allowed(inst,e.course_id),false) OR e.academic_status NOT IN ('formado','diplomado','egresso_acompanhado') THEN RAISE EXCEPTION 'Formação fora do escopo ou sem curso/conclusão validada';END IF;
 SELECT * INTO ap FROM public.vertice_alumni_profiles WHERE id=e.profile_id;
 IF coalesce(ap.cpf_hash,'') !~ '^[0-9a-f]{64}$' OR length(btrim(coalesce(e.enrollment_id,''))) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'CPF e matrícula documentados são obrigatórios';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(inst::text||':registry:'||upper(btrim(e.enrollment_id)),0));
 SELECT count(*) INTO n FROM public.vertice_student_registry WHERE institution_id=inst AND upper(btrim(enrollment_code))=upper(btrim(e.enrollment_id));
 IF n>1 THEN RAISE EXCEPTION 'Matrícula ambígua: revise a base institucional';END IF;
 SELECT * INTO st FROM public.vertice_student_registry WHERE institution_id=inst AND upper(btrim(enrollment_code))=upper(btrim(e.enrollment_id)) FOR UPDATE;
 IF st.id IS NOT NULL THEN
  IF st.course_id IS DISTINCT FROM e.course_id OR st.cpf_hash IS DISTINCT FROM ap.cpf_hash THEN RAISE EXCEPTION 'Curso ou CPF divergente: preparação bloqueada';END IF;
  RETURN jsonb_build_object('student_id',st.id,'already_prepared',true,'requires_reconciliation',true);
 END IF;
 INSERT INTO public.vertice_student_registry(institution_id,course_id,enrollment_code,cpf_hash,full_name,email,academic_status,verified)
 VALUES(inst,e.course_id,upper(btrim(e.enrollment_id)),ap.cpf_hash,ap.full_name,coalesce(ap.email,''),'graduated',true) RETURNING * INTO st;
 INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id,details) VALUES(inst,e.course_id,auth.uid(),'alumni.prepare_access',st.id,jsonb_build_object('education_id',e.id,'note',btrim(p->>'note')));
 RETURN jsonb_build_object('student_id',st.id,'requires_reconciliation',true);
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.prepare_alumni_access(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION vertice_conecta.longitudinal_admin(inst uuid, action text, p jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c uuid;st public.vertice_student_registry;ed public.vertice_alumni_education;ap public.vertice_alumni_profiles;
 link vertice_conecta.identity_links;track_id uuid;old_track uuid;note text;survey public.vertice_alumni_surveys;ident uuid;offset_n integer;counts jsonb;
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>20000 THEN RAISE EXCEPTION 'Conteúdo inválido';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=inst AND tier='superior') THEN RAISE EXCEPTION 'Instituição incompatível';END IF;
 c:=nullif(p->>'course_id','')::uuid;
 IF NOT coalesce(vertice_conecta.allowed(inst,c),false) THEN RAISE EXCEPTION 'Vínculo, curso e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 IF c IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=c AND institution_id=inst) THEN RAISE EXCEPTION 'Curso fora da instituição';END IF;
 offset_n:=greatest(0,least(coalesce((p->>'page')::int,0),10000))*30;
 IF action='list' THEN RETURN jsonb_build_object(
 'quality',jsonb_build_object('excluded_synthetic',(SELECT count(*) FROM public.vertice_alumni_education WHERE institution_id=inst AND is_synthetic),'missing_course',(SELECT count(*) FROM public.vertice_alumni_education WHERE institution_id=inst AND course_id IS NULL AND NOT is_synthetic AND vertice_conecta.allowed(inst,NULL))),
 'access_candidates',coalesce((SELECT jsonb_agg(q) FROM (SELECT e.id education_id,p.full_name,e.enrollment_id enrollment,e.course_id FROM public.vertice_alumni_education e JOIN public.vertice_alumni_profiles p ON p.id=e.profile_id WHERE e.institution_id=inst AND NOT e.is_synthetic AND e.course_id IS NOT NULL AND (c IS NULL OR c=e.course_id) AND p.cpf_hash ~ '^[0-9a-f]{64}$' AND nullif(btrim(e.enrollment_id),'') IS NOT NULL AND e.academic_status IN ('formado','diplomado','egresso_acompanhado') AND NOT EXISTS(SELECT 1 FROM public.vertice_student_registry s WHERE s.institution_id=inst AND upper(btrim(s.enrollment_code))=upper(btrim(e.enrollment_id))) ORDER BY e.id LIMIT 30 OFFSET offset_n)q),'[]'),
 'candidates',coalesce((SELECT jsonb_agg(q) FROM (
 SELECT student_row.id student_id,education_row.id education_id,student_row.full_name student_name,profile_row.full_name alumni_name,student_row.enrollment_code enrollment,student_row.course_id,
 education_row.conclusion_year,education_row.conclusion_semester,(profile_row.cpf_hash IS NOT NULL AND profile_row.cpf_hash=student_row.cpf_hash) cpf_matches
 FROM public.vertice_student_registry student_row JOIN public.vertice_alumni_education education_row ON education_row.institution_id=student_row.institution_id AND education_row.course_id=student_row.course_id AND upper(btrim(education_row.enrollment_id))=upper(btrim(student_row.enrollment_code))
 JOIN public.vertice_alumni_profiles profile_row ON profile_row.id=education_row.profile_id
 WHERE NOT education_row.is_synthetic AND student_row.institution_id=inst AND (c IS NULL OR student_row.course_id=c) AND (profile_row.cpf_hash IS NULL OR profile_row.cpf_hash=student_row.cpf_hash)
 AND NOT EXISTS(SELECT 1 FROM vertice_conecta.identity_links l WHERE l.revoked_at IS NULL AND (l.student_id=student_row.id OR l.education_id=education_row.id))
 ORDER BY student_row.full_name,student_row.id LIMIT 30 OFFSET offset_n) q),'[]'),
 'links',coalesce((SELECT jsonb_agg(q) FROM (SELECT l.*,student_row.full_name,student_row.enrollment_code FROM vertice_conecta.identity_links l JOIN public.vertice_student_registry student_row ON student_row.id=l.student_id
 WHERE l.institution_id=inst AND (c IS NULL OR l.course_id=c) AND l.revoked_at IS NULL ORDER BY l.created_at DESC LIMIT 30 OFFSET offset_n) q),'[]'));
 ELSIF action='prepare_alumni_access' THEN RETURN vertice_conecta.prepare_alumni_access(inst,p);
 ELSIF action='reconcile' THEN
  note:=btrim(coalesce(p->>'note',''));IF length(note) NOT BETWEEN 10 AND 4000 OR p->>'confirmed'<>'true' OR p->>'confirmed' IS NULL THEN RAISE EXCEPTION 'Confirme os documentos e justifique a conciliação';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(inst::text||':identity',0));
  SELECT * INTO st FROM public.vertice_student_registry WHERE id=(p->>'student_id')::uuid AND institution_id=inst;
  SELECT * INTO ed FROM public.vertice_alumni_education WHERE id=(p->>'education_id')::uuid AND institution_id=inst AND NOT is_synthetic;
  IF st.id IS NULL OR ed.id IS NULL OR st.course_id IS DISTINCT FROM ed.course_id OR (c IS NOT NULL AND c<>st.course_id)
   OR NOT coalesce(vertice_conecta.allowed(inst,st.course_id),false) OR nullif(btrim(ed.enrollment_id),'') IS NULL OR upper(btrim(ed.enrollment_id))<>upper(btrim(st.enrollment_code)) THEN RAISE EXCEPTION 'Vínculos incompatíveis ou fora do escopo';END IF;
  SELECT * INTO ap FROM public.vertice_alumni_profiles WHERE id=ed.profile_id;
  IF ap.cpf_hash IS NOT NULL AND ap.cpf_hash IS DISTINCT FROM st.cpf_hash THEN RAISE EXCEPTION 'CPF divergente: conciliação bloqueada';END IF;
  SELECT * INTO link FROM vertice_conecta.identity_links WHERE revoked_at IS NULL AND (student_id=st.id OR education_id=ed.id);
  IF link.id IS NOT NULL THEN
   IF link.student_id=st.id AND link.education_id=ed.id THEN RETURN jsonb_build_object('id',link.id,'canonical_track',link.canonical_track,'already_linked',true);END IF;
   RAISE EXCEPTION 'Um dos vínculos já está conciliado com outro cadastro';
  END IF;
  INSERT INTO vertice_conecta.tracks(institution_id,course_id,student_id,data) VALUES(inst,st.course_id,st.id,jsonb_build_object('stage',CASE WHEN st.academic_status='graduated' THEN 'egresso' ELSE 'estudante' END,'employment','desconhecido')) ON CONFLICT(student_id) DO NOTHING;
  SELECT id INTO track_id FROM vertice_conecta.tracks WHERE student_id=st.id;
  SELECT id INTO old_track FROM vertice_conecta.tracks WHERE education_id=ed.id AND id<>track_id;
  INSERT INTO vertice_conecta.identity_links(institution_id,course_id,student_id,education_id,canonical_track,source_track,note,created_by)
   VALUES(inst,st.course_id,st.id,ed.id,track_id,old_track,note,auth.uid()) RETURNING id INTO ident;
  INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id,details) VALUES(inst,st.course_id,auth.uid(),'identity.reconcile',ident,jsonb_build_object('canonical_track',track_id,'source_track',old_track,'note',note));
  RETURN jsonb_build_object('id',ident,'canonical_track',track_id);
 ELSIF action='unlink' THEN
  note:=btrim(coalesce(p->>'note',''));IF length(note) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'Justifique a revisão';END IF;
  SELECT * INTO link FROM vertice_conecta.identity_links WHERE id=(p->>'id')::uuid AND institution_id=inst AND revoked_at IS NULL FOR UPDATE;
  IF link.id IS NULL OR NOT coalesce(vertice_conecta.allowed(inst,link.course_id),false) OR (c IS NOT NULL AND link.course_id<>c) THEN RAISE EXCEPTION 'Conciliação fora do escopo';END IF;
  UPDATE vertice_conecta.identity_links SET revoked_at=now() WHERE id=link.id;
  INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id,details) VALUES(inst,link.course_id,auth.uid(),'identity.unlink',link.id,jsonb_build_object('note',note));
  RETURN jsonb_build_object('reviewed',true);
 ELSIF action='surveys' THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('eligible',(SELECT count(DISTINCT e.profile_id) FROM public.vertice_alumni_education e WHERE NOT e.is_synthetic AND vertice_conecta.survey_eligible(q,e)),
  'drafts',(SELECT count(*) FROM public.vertice_alumni_survey_responses WHERE survey_id=q.id AND status='em_andamento'),
  'respondents',(SELECT count(*) FROM public.vertice_alumni_survey_responses WHERE survey_id=q.id AND status IN ('concluida','corrigida'))))
  FROM (SELECT * FROM public.vertice_alumni_surveys WHERE institution_id=inst AND (c IS NULL OR course_id=c) AND survey_origin='conecta_short' AND NOT is_synthetic ORDER BY created_at DESC LIMIT 30 OFFSET offset_n) q),'[]');
 ELSIF action='create_survey' THEN
  IF length(btrim(coalesce(p->>'title',''))) NOT BETWEEN 3 AND 250 THEN RAISE EXCEPTION 'Informe o título da pesquisa';END IF;
  IF nullif(p->>'conclusion_year','') IS NULL OR nullif(p->>'conclusion_semester','') IS NULL THEN RAISE EXCEPTION 'Informe ano e semestre da turma de conclusão';END IF;
  IF nullif(p->>'opens_at','') IS NULL OR nullif(p->>'closes_at','') IS NULL OR (p->>'closes_at')::timestamptz<=(p->>'opens_at')::timestamptz THEN RAISE EXCEPTION 'Período de coleta inválido';END IF;
  ident:=(p->>'request_id')::uuid;
  IF ident IS NULL THEN RAISE EXCEPTION 'Identificador da pesquisa obrigatório';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('survey-create:'||ident::text,0));
  SELECT * INTO survey FROM public.vertice_alumni_surveys WHERE id=ident;
  IF survey.id IS NOT NULL THEN
   IF survey.institution_id IS DISTINCT FROM inst OR survey.course_id IS DISTINCT FROM c OR survey.survey_origin IS DISTINCT FROM 'conecta_short' OR survey.is_synthetic THEN RAISE EXCEPTION 'Identificador fora do escopo' USING ERRCODE='42501';END IF;
   IF survey.title IS DISTINCT FROM btrim(p->>'title') OR survey.conclusion_year IS DISTINCT FROM (p->>'conclusion_year')::smallint OR survey.conclusion_semester IS DISTINCT FROM (p->>'conclusion_semester')::smallint OR survey.followup_months IS DISTINCT FROM (p->>'followup_months')::smallint OR survey.target_audience IS DISTINCT FROM p->>'target_audience' OR survey.opens_at IS DISTINCT FROM (p->>'opens_at')::timestamptz OR survey.closes_at IS DISTINCT FROM (p->>'closes_at')::timestamptz THEN RAISE EXCEPTION 'A solicitação já existe com outros dados';END IF;
   RETURN jsonb_build_object('id',survey.id,'already_created',true);
  END IF;
  INSERT INTO public.vertice_alumni_surveys(id,institution_id,course_id,title,description,wave_type,custom_months,opens_at,closes_at,status,target_audience,responsible_id,conclusion_year,conclusion_semester,followup_months,survey_origin)
  VALUES(ident,inst,c,btrim(p->>'title'),'Questionário curto Conecta: trabalho, relação com a formação e apoio necessário. Respostas autodeclaradas.','custom',(p->>'followup_months')::smallint,(p->>'opens_at')::timestamptz,(p->>'closes_at')::timestamptz,'rascunho',p->>'target_audience',auth.uid(),(p->>'conclusion_year')::smallint,(p->>'conclusion_semester')::smallint,(p->>'followup_months')::smallint,'conecta_short');
  INSERT INTO public.vertice_alumni_survey_questions(survey_id,sort_order,question_text,question_type,options,required,indicator_key) VALUES
  (ident,1,'Como está sua situação profissional?','single_choice','[{"value":"empregado","label":"Empregado"},{"value":"servidor","label":"Servidor público"},{"value":"autonomo","label":"Autônomo"},{"value":"empreendedor","label":"Empreendedor"},{"value":"estagiario","label":"Estagiário"},{"value":"buscando","label":"Buscando oportunidade"},{"value":"nao_exerce","label":"Não exerce atividade"},{"value":"prefiro_nao_informar","label":"Prefiro não informar"}]',true,'employment'),
  (ident,2,'Se trabalha, sua atividade está relacionada à formação?','single_choice','[{"value":"true","label":"Sim"},{"value":"false","label":"Não"},{"value":"prefiro_nao_informar","label":"Prefiro não informar"}]',false,'in_field'),
  (ident,3,'Que apoio da instituição seria útil neste momento?','text',null,false,'support');
  INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id) VALUES(inst,c,auth.uid(),'survey.create',ident);
  RETURN jsonb_build_object('id',ident);
 ELSIF action IN ('activate_survey','close_survey') THEN
  SELECT * INTO survey FROM public.vertice_alumni_surveys WHERE id=(p->>'id')::uuid AND institution_id=inst AND survey_origin='conecta_short' FOR UPDATE;
  IF survey.id IS NULL OR NOT coalesce(vertice_conecta.allowed(inst,survey.course_id),false) OR (c IS NOT NULL AND c<>survey.course_id) THEN RAISE EXCEPTION 'Pesquisa fora do escopo';END IF;
  IF action='activate_survey' AND (survey.status<>'rascunho' OR survey.closes_at<=now() OR (SELECT count(*) FROM public.vertice_alumni_survey_questions WHERE survey_id=survey.id)<>3) THEN RAISE EXCEPTION 'Pesquisa não está pronta para ativação';END IF;
  UPDATE public.vertice_alumni_surveys SET status=CASE WHEN action='activate_survey' THEN 'ativa' ELSE 'encerrada' END,updated_at=now() WHERE id=survey.id;
  INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id) VALUES(inst,survey.course_id,auth.uid(),action,survey.id);
  RETURN jsonb_build_object('reviewed',true);
 ELSE RAISE EXCEPTION 'Operação inválida';END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.vertice_conecta_surveys_student(p_session_hash text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE st public.vertice_student_registry;ed public.vertice_alumni_education;t vertice_conecta.tracks;
 survey public.vertice_alumni_surveys;response public.vertice_alumni_survey_responses;question_row public.vertice_alumni_survey_questions;
 answers jsonb;answer_value_text text;employment text;field text;native_status text;new_id uuid;
BEGIN
 SELECT s.* INTO st FROM public.vertice_student_sessions x JOIN public.vertice_student_registry s ON s.id=x.student_id AND s.institution_id=x.institution_id
 WHERE x.session_key_hash=p_session_hash AND x.access_scope='conecta' AND x.expires_at>now() AND x.revoked_at IS NULL AND s.academic_status IN ('active','graduated');
 IF st.id IS NULL THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='42501';END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>16000 THEN RAISE EXCEPTION 'Conteúdo inválido';END IF;
 SELECT e.* INTO ed FROM vertice_conecta.identity_links l JOIN public.vertice_alumni_education e ON e.id=l.education_id AND e.institution_id=l.institution_id AND e.course_id=l.course_id
 WHERE NOT e.is_synthetic AND l.student_id=st.id AND l.institution_id=st.institution_id AND l.course_id=st.course_id AND l.revoked_at IS NULL;
 IF p_action='list' THEN
  IF ed.id IS NULL THEN RETURN jsonb_build_object('requires_reconciliation',true,'surveys','[]'::jsonb);END IF;
  RETURN jsonb_build_object('requires_reconciliation',false,'cohort',jsonb_build_object('year',ed.conclusion_year,'semester',ed.conclusion_semester),
  'surveys',coalesce((SELECT jsonb_agg(to_jsonb(s)-'responsible_id'||jsonb_build_object(
   'questions',(SELECT jsonb_agg(jsonb_build_object('id',q.id,'key',q.indicator_key,'label',q.question_text,'type',q.question_type,'required',q.required,'options',q.options) ORDER BY q.sort_order) FROM public.vertice_alumni_survey_questions q WHERE q.survey_id=s.id),
   'response',(SELECT jsonb_build_object('status',r.status,'answers',coalesce((SELECT jsonb_object_agg(q.indicator_key,a.answer_value) FROM public.vertice_alumni_survey_answers a JOIN public.vertice_alumni_survey_questions q ON q.id=a.question_id AND q.survey_id=s.id WHERE a.response_id=r.id),'{}'), 'completed_at',r.completed_at) FROM public.vertice_alumni_survey_responses r WHERE r.survey_id=s.id AND r.profile_id=ed.profile_id AND r.education_id=ed.id)))
   FROM public.vertice_alumni_surveys s WHERE NOT s.is_synthetic AND s.survey_origin='conecta_short' AND s.status='ativa' AND (s.opens_at IS NULL OR s.opens_at<=now()) AND (s.closes_at IS NULL OR s.closes_at>now()) AND vertice_conecta.survey_eligible(s,ed)),'[]'));
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('draft','submit') OR ed.id IS NULL THEN RAISE EXCEPTION 'Pesquisa indisponível para este vínculo';END IF;
 SELECT * INTO survey FROM public.vertice_alumni_surveys WHERE id=(p_payload->>'survey_id')::uuid AND survey_origin='conecta_short' AND NOT is_synthetic AND status='ativa' FOR SHARE;
 IF survey.id IS NULL OR NOT coalesce(vertice_conecta.survey_eligible(survey,ed),false) OR survey.opens_at>now() OR survey.closes_at<=now() THEN RAISE EXCEPTION 'Pesquisa encerrada ou fora do recorte';END IF;
 answers:=p_payload->'answers';
 IF answers IS NULL OR jsonb_typeof(answers)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(answers) k WHERE k NOT IN ('employment','in_field','support')) THEN RAISE EXCEPTION 'Respostas inválidas';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(survey.id::text||ed.profile_id::text,0));
 SELECT * INTO response FROM public.vertice_alumni_survey_responses WHERE survey_id=survey.id AND profile_id=ed.profile_id FOR UPDATE;
 IF response.id IS NOT NULL AND (response.education_id IS DISTINCT FROM ed.id OR response.status<>'em_andamento') THEN RAISE EXCEPTION 'Resposta já concluída ou vinculada a outra formação';END IF;
 IF response.id IS NULL THEN INSERT INTO public.vertice_alumni_survey_responses(survey_id,profile_id,education_id,status,device) VALUES(survey.id,ed.profile_id,ed.id,'em_andamento','conecta') RETURNING * INTO response;END IF;
 FOR question_row IN SELECT * FROM public.vertice_alumni_survey_questions WHERE survey_id=survey.id ORDER BY sort_order LOOP
  IF answers ? question_row.indicator_key THEN
   IF jsonb_typeof(answers->question_row.indicator_key)<>'string' THEN RAISE EXCEPTION 'Resposta textual inválida';END IF;
   answer_value_text:=btrim(answers->>question_row.indicator_key);
   IF length(answer_value_text)>4000 OR (question_row.question_type='single_choice' AND answer_value_text<>'' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(question_row.options) opt WHERE opt->>'value'=answer_value_text)) THEN RAISE EXCEPTION 'Opção inválida';END IF;
   INSERT INTO public.vertice_alumni_survey_answers(response_id,question_id,answer_value)
   VALUES(response.id,question_row.id,answer_value_text) ON CONFLICT(response_id,question_id) DO UPDATE SET previous_value=vertice_alumni_survey_answers.answer_value,answer_value=excluded.answer_value,corrected_at=now();
  END IF;
 END LOOP;
 IF p_action='submit' THEN
  IF EXISTS(SELECT 1 FROM public.vertice_alumni_survey_questions q LEFT JOIN public.vertice_alumni_survey_answers a ON a.question_id=q.id AND a.response_id=response.id WHERE q.survey_id=survey.id AND q.required AND nullif(btrim(a.answer_value),'') IS NULL) THEN RAISE EXCEPTION 'Responda os campos obrigatórios antes de concluir';END IF;
  SELECT a.answer_value INTO employment FROM public.vertice_alumni_survey_answers a JOIN public.vertice_alumni_survey_questions q ON q.id=a.question_id WHERE a.response_id=response.id AND q.indicator_key='employment';
  SELECT a.answer_value INTO field FROM public.vertice_alumni_survey_answers a JOIN public.vertice_alumni_survey_questions q ON q.id=a.question_id WHERE a.response_id=response.id AND q.indicator_key='in_field';
  IF employment NOT IN ('empregado','servidor','autonomo','empreendedor','estagiario') THEN field:=NULL;END IF;
  native_status:=CASE employment WHEN 'empregado' THEN 'empregado_clt' WHEN 'servidor' THEN 'servidor_publico' WHEN 'empreendedor' THEN 'empresario' WHEN 'buscando' THEN 'desempregado' WHEN 'nao_exerce' THEN 'desempregado' WHEN 'prefiro_nao_informar' THEN 'nao_informado' ELSE employment END;
  INSERT INTO public.vertice_alumni_employment(id,profile_id,education_id,employment_status,employment_type,field_relation,related_to_degree,seeking_work,source,reference_date)
  VALUES(response.id,ed.profile_id,ed.id,native_status,'principal',CASE field WHEN 'true' THEN 'area_formacao' WHEN 'false' THEN 'outra_area' ELSE NULL END,CASE field WHEN 'true' THEN true WHEN 'false' THEN false ELSE NULL END,CASE WHEN employment IN ('buscando','nao_exerce') THEN employment='buscando' ELSE NULL END,'pesquisa',current_date);
  SELECT * INTO t FROM vertice_conecta.tracks WHERE student_id=st.id FOR UPDATE;
  IF t.id IS NOT NULL THEN PERFORM vertice_conecta.mutate_track(t.id,'save_profile',jsonb_build_object('version',t.version,'data',jsonb_build_object('employment',employment,'in_field',CASE WHEN field IN ('true','false') THEN field ELSE '' END),'confirm_report',true),true);END IF;
  UPDATE public.vertice_alumni_survey_responses SET status='concluida',completed_at=now(),updated_at=now() WHERE id=response.id;
 ELSE UPDATE public.vertice_alumni_survey_responses SET updated_at=now() WHERE id=response.id;END IF;
 INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id) VALUES(st.institution_id,st.course_id,st.id,'survey.'||p_action,response.id);
 RETURN jsonb_build_object('saved',true,'status',CASE WHEN p_action='submit' THEN 'concluida' ELSE 'em_andamento' END);
END $function$
;

CREATE OR REPLACE FUNCTION vertice_conecta.enrich_sapiens()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF NEW.scope='superior' THEN
  NEW.context:=NEW.context||jsonb_build_object('conecta',vertice_conecta.metrics(NEW.institution_id,NEW.course_id),
  'conecta_partners',jsonb_build_object('pending_proposals',(SELECT count(*) FROM vertice_conecta.partner_proposals WHERE institution_id=NEW.institution_id AND status='pending' AND (NEW.course_id IS NULL OR course_id=NEW.course_id)),
  'approved_proposals',(SELECT count(*) FROM vertice_conecta.partner_proposals WHERE institution_id=NEW.institution_id AND status='approved' AND (NEW.course_id IS NULL OR course_id=NEW.course_id))),
  'conecta_collection',jsonb_build_object('active_surveys',(SELECT count(*) FROM public.vertice_alumni_surveys WHERE institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR course_id=NEW.course_id) AND NOT is_synthetic AND survey_origin='conecta_short' AND status='ativa'),
  'completed_responses',(SELECT count(*) FROM public.vertice_alumni_survey_responses r JOIN public.vertice_alumni_surveys s ON s.id=r.survey_id WHERE s.institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR s.course_id=NEW.course_id) AND NOT s.is_synthetic AND s.survey_origin='conecta_short' AND r.status IN ('concluida','corrigida')),
  'draft_responses',(SELECT count(*) FROM public.vertice_alumni_survey_responses r JOIN public.vertice_alumni_surveys s ON s.id=r.survey_id WHERE s.institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR s.course_id=NEW.course_id) AND NOT s.is_synthetic AND s.survey_origin='conecta_short' AND r.status='em_andamento'),
  'reconciled_enrollments',(SELECT count(*) FROM vertice_conecta.identity_links WHERE institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR course_id=NEW.course_id) AND revoked_at IS NULL)),
  'conecta_limitations','Dados agregados de vínculos, propostas e coleta. Respostas são contadas por pesquisa, não como pessoas únicas entre ondas; rascunhos não são respostas concluídas. Conciliações não alteram situação acadêmica. Inserção profissional apenas entre respondentes; não extrapolar ou inferir causalidade. Aprovação de proposta não comprova resultado, contratação, convênio, horas ou aprovação acadêmica.');
 END IF;RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION vertice_conecta.api(inst uuid, action text, p jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r text;c uuid;ident uuid;offset_n int;search_text text;v_track vertice_conecta.tracks;v_student public.vertice_student_registry;v_education public.vertice_alumni_education;
 g public.vertice_goals;o vertice_conecta.opportunities;cfg vertice_conecta.config;result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501';END IF;
 r:=vertice_private.member_role(inst);
 IF r IS NULL OR r NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde','cpa') THEN RAISE EXCEPTION 'Vínculo autorizado e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=inst AND tier='superior') THEN RAISE EXCEPTION 'Instituição de educação superior não localizada';END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>50000 THEN RAISE EXCEPTION 'Conteúdo inválido';END IF;
 c:=nullif(p->>'course_id','')::uuid;
 IF c IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=c AND institution_id=inst) THEN RAISE EXCEPTION 'Curso fora da instituição' USING ERRCODE='42501';END IF;
 IF action='options' THEN RETURN jsonb_build_object('courses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM public.vertice_courses WHERE institution_id=inst AND (r='cpa' OR vertice_conecta.allowed(inst,id))),'[]'),'role',r);END IF;
 IF r='cpa' AND action<>'overview' THEN RAISE EXCEPTION 'CPA possui acesso agregado' USING ERRCODE='42501';END IF;
 IF r<>'cpa' AND NOT vertice_conecta.allowed(inst,c) THEN RAISE EXCEPTION 'Selecione um curso do vínculo validado' USING ERRCODE='42501';END IF;
 offset_n:=greatest(0,least(coalesce((p->>'page')::int,0),10000))*30;search_text:=left(coalesce(p->>'search',''),100);
 IF action='overview' THEN RETURN vertice_conecta.metrics(inst,c);
 ELSIF action='people' THEN
 RETURN coalesce((SELECT jsonb_agg(q) FROM (SELECT t.*,coalesce(s.full_name,pr.social_name,pr.full_name) full_name,coalesce(s.enrollment_code,ed.enrollment_id) enrollment,cc.name course_name
 FROM vertice_conecta.tracks t LEFT JOIN public.vertice_student_registry s ON s.id=t.student_id LEFT JOIN public.vertice_alumni_education ed ON ed.id=t.education_id LEFT JOIN public.vertice_alumni_profiles pr ON pr.id=ed.profile_id JOIN public.vertice_courses cc ON cc.id=t.course_id
 WHERE t.institution_id=inst AND NOT EXISTS(SELECT 1 FROM vertice_conecta.identity_links WHERE source_track=t.id AND revoked_at IS NULL) AND (c IS NULL OR t.course_id=c) AND (search_text='' OR coalesce(s.full_name,pr.full_name) ILIKE '%'||search_text||'%' OR coalesce(s.enrollment_code,ed.enrollment_id) ILIKE '%'||search_text||'%') ORDER BY t.updated_at DESC,t.id LIMIT 30 OFFSET offset_n) q),'[]');
 ELSIF action='candidates' THEN
 RETURN coalesce((SELECT jsonb_agg(q) FROM (
 SELECT s.id,s.full_name,s.enrollment_code enrollment,s.course_id,'student' source FROM public.vertice_student_registry s WHERE s.institution_id=inst AND (c IS NULL OR s.course_id=c) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.tracks WHERE student_id=s.id) AND (s.full_name ILIKE '%'||search_text||'%' OR s.enrollment_code ILIKE '%'||search_text||'%')
 UNION ALL SELECT e.id,pr.full_name,e.enrollment_id,e.course_id,'alumni' FROM public.vertice_alumni_education e JOIN public.vertice_alumni_profiles pr ON pr.id=e.profile_id WHERE NOT e.is_synthetic AND e.institution_id=inst AND e.course_id IS NOT NULL AND (c IS NULL OR e.course_id=c) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.tracks WHERE education_id=e.id) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.identity_links WHERE education_id=e.id AND revoked_at IS NULL) AND (pr.full_name ILIKE '%'||search_text||'%' OR e.enrollment_id ILIKE '%'||search_text||'%')
 ORDER BY full_name,id LIMIT 30 OFFSET offset_n) q),'[]');
 ELSIF action='attach' THEN
 ident:=(p->>'source_id')::uuid;
 IF p->>'source'='student' THEN
  SELECT * INTO v_student FROM public.vertice_student_registry WHERE id=ident AND institution_id=inst;
  IF v_student.id IS NULL OR NOT vertice_conecta.allowed(inst,v_student.course_id) OR (c IS NOT NULL AND c<>v_student.course_id) THEN RAISE EXCEPTION 'Matrícula fora do escopo' USING ERRCODE='42501';END IF;
  INSERT INTO vertice_conecta.tracks(institution_id,course_id,student_id,data) VALUES(inst,v_student.course_id,v_student.id,'{"stage":"estudante","employment":"desconhecido"}') ON CONFLICT(student_id) DO NOTHING RETURNING id INTO ident;
 ELSIF p->>'source'='alumni' THEN
  SELECT * INTO v_education FROM public.vertice_alumni_education WHERE id=ident AND institution_id=inst AND NOT is_synthetic;
  IF v_education.id IS NULL OR v_education.course_id IS NULL OR NOT vertice_conecta.allowed(inst,v_education.course_id) OR (c IS NOT NULL AND c<>v_education.course_id) THEN RAISE EXCEPTION 'Formação fora do escopo' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM vertice_conecta.identity_links WHERE education_id=v_education.id AND revoked_at IS NULL) THEN RETURN jsonb_build_object('id',(SELECT canonical_track FROM vertice_conecta.identity_links WHERE education_id=v_education.id AND revoked_at IS NULL));END IF;
  INSERT INTO vertice_conecta.tracks(institution_id,course_id,education_id,data) VALUES(inst,v_education.course_id,v_education.id,'{"stage":"egresso","employment":"desconhecido"}') ON CONFLICT(education_id) DO NOTHING RETURNING id INTO ident;
 ELSE RAISE EXCEPTION 'Fonte inválida';END IF;
 IF ident IS NULL THEN SELECT id INTO ident FROM vertice_conecta.tracks WHERE CASE WHEN p->>'source'='student' THEN student_id=(p->>'source_id')::uuid ELSE education_id=(p->>'source_id')::uuid END;END IF;
 result:=jsonb_build_object('id',ident);
 ELSIF action IN ('detail','save_profile','preference','evidence','application') THEN
  SELECT * INTO v_track FROM vertice_conecta.tracks WHERE id=(p->>'id')::uuid AND institution_id=inst FOR UPDATE;
  IF v_track.id IS NULL OR NOT vertice_conecta.allowed(inst,v_track.course_id) OR (c IS NOT NULL AND c<>v_track.course_id) THEN RAISE EXCEPTION 'Trajetória fora do escopo' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM vertice_conecta.identity_links WHERE source_track=v_track.id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'Cadastro conciliado: abra a trajetória canônica';END IF;
  IF action='detail' THEN RETURN vertice_conecta.detail(v_track.id);END IF;
  RETURN vertice_conecta.mutate_track(v_track.id,action,p,false);
 ELSIF action='opportunities' THEN RETURN coalesce((SELECT jsonb_agg(q) FROM (SELECT * FROM vertice_conecta.opportunities WHERE institution_id=inst AND (c IS NULL OR course_id=c OR course_id IS NULL) ORDER BY created_at DESC,id LIMIT 30 OFFSET offset_n) q),'[]');
 ELSIF action='save_opportunity' THEN
 ident:=coalesce(nullif(p->>'id','')::uuid,(p->>'request_id')::uuid);
 SELECT * INTO o FROM vertice_conecta.opportunities WHERE id=ident FOR UPDATE;
 IF o.id IS NOT NULL AND (o.institution_id<>inst OR NOT vertice_conecta.allowed(inst,o.course_id)) THEN RAISE EXCEPTION 'Oportunidade fora do escopo' USING ERRCODE='42501';END IF;
 IF o.id IS NOT NULL AND (p->>'version')::int IS DISTINCT FROM o.version THEN RAISE EXCEPTION 'Oportunidade alterada. Atualize.' USING ERRCODE='40001';END IF;
 INSERT INTO vertice_conecta.opportunities(id,institution_id,course_id,title,employer,kind,description,url,deadline,status)
 VALUES(ident,inst,c,p->>'title',p->>'employer',p->>'kind',coalesce(p->>'description',''),coalesce(p->>'url',''),nullif(p->>'deadline','')::date,p->>'status')
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,employer=excluded.employer,kind=excluded.kind,description=excluded.description,url=excluded.url,deadline=excluded.deadline,status=excluded.status,version=opportunities.version+1,updated_at=now() RETURNING to_jsonb(opportunities) INTO result;
 ELSIF action='goals' THEN RETURN jsonb_build_object('goals',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'target',target,'unit',unit)) FROM public.vertice_goals WHERE institution_id=inst AND (c IS NULL OR course_id=c)),'[]'),
 'links',coalesce((SELECT jsonb_agg(q) FROM vertice_conecta.goal_links q WHERE institution_id=inst AND (c IS NULL OR course_id=c)),'[]'));
 ELSIF action IN ('link_goal','create_action') THEN
 SELECT * INTO g FROM public.vertice_goals WHERE id=(p->>'goal_id')::uuid AND institution_id=inst;
 IF g.id IS NULL OR NOT vertice_conecta.allowed(inst,g.course_id) OR (c IS NOT NULL AND c IS DISTINCT FROM g.course_id) THEN RAISE EXCEPTION 'Meta fora do escopo' USING ERRCODE='42501';END IF;
 ident:=g.id;c:=g.course_id;
 IF action='link_goal' THEN INSERT INTO vertice_conecta.goal_links(institution_id,course_id,goal_id,indicator) VALUES(inst,g.course_id,g.id,p->>'indicator') ON CONFLICT(goal_id,indicator) DO NOTHING;
 ELSE
  IF length(btrim(coalesce(p->>'what','')))<3 OR length(btrim(coalesce(p->>'who','')))<2 OR nullif(p->>'due_date','') IS NULL THEN RAISE EXCEPTION 'Ação, responsável e prazo são obrigatórios';END IF;
  INSERT INTO public.vertice_actions(id,institution_id,course_id,goal_id,what,why,where_at,who,start_date,due_date,how,how_much,origin_type,origin_ref,origin_label,created_by)
   VALUES((p->>'request_id')::uuid,inst,g.course_id,g.id,p->>'what',p->>'why',p->>'where_at',p->>'who',nullif(p->>'start_date','')::date,(p->>'due_date')::date,p->>'how',p->>'how_much','conecta',g.id,'Conecta 360°',auth.uid()) ON CONFLICT(id) DO NOTHING;
 END IF;result:=jsonb_build_object('recorded',true);
 ELSIF action='config' THEN RETURN coalesce((SELECT to_jsonb(q) FROM vertice_conecta.config q WHERE institution_id=inst),jsonb_build_object('version',0,'milestones',jsonb_build_array(0,3,6,12),'max_contacts',3));
 ELSIF action='save_config' THEN
 IF r NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') THEN RAISE EXCEPTION 'Configuração restrita à gestão institucional' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('conecta:'||inst::text,0));SELECT * INTO cfg FROM vertice_conecta.config WHERE institution_id=inst;
 IF (p->>'version')::int IS DISTINCT FROM coalesce(cfg.version,0) THEN RAISE EXCEPTION 'Configuração alterada. Atualize.' USING ERRCODE='40001';END IF;
 INSERT INTO vertice_conecta.config(institution_id,milestones,max_contacts) VALUES(inst,ARRAY(SELECT jsonb_array_elements_text(p->'milestones')::int),(p->>'max_contacts')::int)
 ON CONFLICT(institution_id) DO UPDATE SET milestones=excluded.milestones,max_contacts=excluded.max_contacts,version=config.version+1,updated_at=now() RETURNING to_jsonb(config) INTO result;
 ELSIF action='audit' THEN RETURN coalesce((SELECT jsonb_agg(q) FROM (SELECT au.action,au.entity_id,au.details,au.created_at FROM vertice_conecta.audit au WHERE au.institution_id=inst AND (c IS NULL OR au.course_id=c) ORDER BY au.created_at DESC,au.id DESC LIMIT 30 OFFSET offset_n) q),'[]');
 ELSE RAISE EXCEPTION 'Operação inválida';END IF;
 INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id) VALUES(inst,coalesce(c,v_student.course_id,v_education.course_id),auth.uid(),action,ident);
 RETURN result;
END $function$
;


CREATE FUNCTION vertice_conecta.import_alumni(inst uuid,course uuid,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pid uuid;eid uuid;enrol text;cpf text;existing public.vertice_alumni_education;BEGIN
 IF course IS NULL OR NOT coalesce(vertice_private.alumni_scope(inst,course),false) THEN RAISE EXCEPTION 'Curso institucional e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>20000 OR length(btrim(coalesce(p->>'nome',''))) NOT BETWEEN 2 AND 300 THEN RAISE EXCEPTION 'Registro de importação inválido';END IF;
 enrol:=upper(btrim(coalesce(p->>'matricula','')));cpf:=nullif(p->>'cpf_hash','');
 IF length(enrol) NOT BETWEEN 1 AND 40 OR (cpf IS NOT NULL AND cpf !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'Matrícula ou CPF inválido';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(inst::text||course::text||enrol,0));
 IF (SELECT count(*) FROM public.vertice_alumni_education WHERE institution_id=inst AND course_id=course AND upper(btrim(enrollment_id))=enrol)>1 THEN RAISE EXCEPTION 'Matrícula duplicada: revise as fontes';END IF;
 SELECT * INTO existing FROM public.vertice_alumni_education WHERE institution_id=inst AND course_id=course AND upper(btrim(enrollment_id))=enrol FOR UPDATE;
 IF existing.id IS NOT NULL THEN
  IF existing.is_synthetic OR (cpf IS NOT NULL AND cpf IS DISTINCT FROM (SELECT cpf_hash FROM public.vertice_alumni_profiles WHERE id=existing.profile_id)) THEN RAISE EXCEPTION 'Cadastro existente exige revisão documental';END IF;
  pid:=existing.profile_id;
 ELSE
  IF cpf IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('alumni-cpf:'||cpf,0));SELECT id INTO pid FROM public.vertice_alumni_profiles WHERE cpf_hash=cpf;END IF;
  IF pid IS NULL THEN INSERT INTO public.vertice_alumni_profiles(cpf_hash,full_name,email,phone,source) VALUES(cpf,btrim(p->>'nome'),nullif(btrim(p->>'email'),''),nullif(btrim(p->>'telefone'),''),'import') RETURNING id INTO pid;END IF;
 END IF;
 INSERT INTO public.vertice_alumni_education(id,profile_id,institution_id,course_id,enrollment_id,modality,degree,admission_year,admission_semester,academic_status,conclusion_year,conclusion_semester,graduation_date,status_source)
 VALUES(coalesce(existing.id,gen_random_uuid()),pid,inst,course,enrol,nullif(p->>'modalidade',''),nullif(p->>'grau',''),nullif(p->>'ano_ingresso','')::smallint,nullif(p->>'semestre_ingresso','')::smallint,coalesce(nullif(p->>'academic_status',''),'ativo'),nullif(p->>'ano_conclusao','')::smallint,nullif(p->>'semestre_conclusao','')::smallint,nullif(p->>'data_colacao','')::date,'import')
 ON CONFLICT(id) DO UPDATE SET modality=excluded.modality,degree=excluded.degree,admission_year=excluded.admission_year,admission_semester=excluded.admission_semester,academic_status=excluded.academic_status,conclusion_year=excluded.conclusion_year,conclusion_semester=excluded.conclusion_semester,graduation_date=excluded.graduation_date,updated_at=now() RETURNING id INTO eid;
 INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id) VALUES(inst,course,auth.uid(),'alumni.import',eid);
 RETURN jsonb_build_object('id',eid);
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.import_alumni(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_conecta.import_alumni(uuid,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.vertice_alumni_import_record(p_institution uuid,p_course uuid,p_record jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vertice_conecta.import_alumni(p_institution,p_course,p_record) $$;
REVOKE ALL ON FUNCTION public.vertice_alumni_import_record(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_alumni_import_record(uuid,uuid,jsonb) TO authenticated;
-- Old unscoped profile-import RPC is replaced by the scoped, atomic endpoint above.
DO $$ DECLARE x record;BEGIN FOR x IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='alumni_find_or_create_profile' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.signature);END LOOP;
 FOR x IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='vertice_private' AND p.proname='seed_alumni_test_data' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.signature);END LOOP;END $$;
COMMIT;
