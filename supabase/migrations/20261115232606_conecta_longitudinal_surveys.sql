-- Explicit academic identity reconciliation; append-only history and native alumni surveys.
BEGIN;
CREATE TABLE vertice_conecta.identity_links(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 course_id uuid NOT NULL REFERENCES public.vertice_courses(id),student_id uuid NOT NULL REFERENCES public.vertice_student_registry(id),
 education_id uuid NOT NULL REFERENCES public.vertice_alumni_education(id),canonical_track uuid NOT NULL REFERENCES vertice_conecta.tracks(id),
 source_track uuid REFERENCES vertice_conecta.tracks(id),note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 4000),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 CHECK(source_track IS NULL OR source_track<>canonical_track)
);
CREATE UNIQUE INDEX conecta_identity_student ON vertice_conecta.identity_links(student_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX conecta_identity_education ON vertice_conecta.identity_links(education_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX conecta_identity_source ON vertice_conecta.identity_links(source_track) WHERE revoked_at IS NULL;
CREATE INDEX conecta_identity_canonical ON vertice_conecta.identity_links(canonical_track) WHERE revoked_at IS NULL;
CREATE TABLE vertice_conecta.profile_history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,track_id uuid NOT NULL REFERENCES vertice_conecta.tracks(id),
 version integer NOT NULL,data jsonb NOT NULL,source text NOT NULL,reported_at timestamptz,
 recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(track_id,version)
);
ALTER TABLE vertice_conecta.identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertice_conecta.profile_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_conecta.identity_links,vertice_conecta.profile_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON vertice_conecta.identity_links TO service_role;
GRANT SELECT,INSERT ON vertice_conecta.profile_history TO service_role;
GRANT USAGE ON SEQUENCE vertice_conecta.profile_history_id_seq TO service_role;
INSERT INTO vertice_conecta.profile_history(track_id,version,data,source,reported_at) SELECT id,version,data,source,reported_at FROM vertice_conecta.tracks;
CREATE FUNCTION vertice_conecta.snapshot_profile() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 INSERT INTO vertice_conecta.profile_history(track_id,version,data,source,reported_at) VALUES(OLD.id,OLD.version,OLD.data,OLD.source,OLD.reported_at) ON CONFLICT(track_id,version) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.snapshot_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER conecta_profile_history BEFORE UPDATE ON vertice_conecta.tracks FOR EACH ROW EXECUTE FUNCTION vertice_conecta.snapshot_profile();

ALTER TABLE public.vertice_alumni_surveys
 ADD COLUMN conclusion_year smallint CHECK(conclusion_year BETWEEN 1900 AND 2200),
 ADD COLUMN conclusion_semester smallint CHECK(conclusion_semester IN (1,2)),
 ADD COLUMN followup_months smallint CHECK(followup_months BETWEEN 0 AND 120),
 ADD COLUMN survey_origin text CHECK(survey_origin IS NULL OR survey_origin='conecta_short');
CREATE FUNCTION vertice_conecta.survey_eligible(s public.vertice_alumni_surveys,e public.vertice_alumni_education) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT s.institution_id=e.institution_id AND (s.course_id IS NULL OR s.course_id=e.course_id)
 AND (s.conclusion_year IS NULL OR s.conclusion_year=e.conclusion_year)
 AND (s.conclusion_semester IS NULL OR s.conclusion_semester=e.conclusion_semester)
 AND CASE s.target_audience WHEN 'egressos' THEN e.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado')
 WHEN 'concluintes' THEN e.academic_status IN ('provavel_concluinte','concluinte','integralizado') ELSE e.academic_status IN ('ativo','provavel_concluinte','concluinte','integralizado','formado','diplomado','egresso_acompanhado') END
 AND (coalesce(s.followup_months,0)=0 OR (coalesce(e.graduation_date,CASE WHEN e.conclusion_year IS NOT NULL AND e.conclusion_semester IS NOT NULL THEN make_date(e.conclusion_year,CASE WHEN e.conclusion_semester=1 THEN 6 ELSE 12 END,CASE WHEN e.conclusion_semester=1 THEN 30 ELSE 31 END) END)+make_interval(months=>s.followup_months))::date<=current_date)
$$;
REVOKE ALL ON FUNCTION vertice_conecta.survey_eligible(public.vertice_alumni_surveys,public.vertice_alumni_education) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION vertice_conecta.survey_eligible(public.vertice_alumni_surveys,public.vertice_alumni_education) TO service_role;
CREATE FUNCTION vertice_conecta.longitudinal_admin(inst uuid,action text,p jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 'candidates',coalesce((SELECT jsonb_agg(q) FROM (
 SELECT student_row.id student_id,education_row.id education_id,student_row.full_name student_name,profile_row.full_name alumni_name,student_row.enrollment_code enrollment,student_row.course_id,
 education_row.conclusion_year,education_row.conclusion_semester,(profile_row.cpf_hash IS NOT NULL AND profile_row.cpf_hash=student_row.cpf_hash) cpf_matches
 FROM public.vertice_student_registry student_row JOIN public.vertice_alumni_education education_row ON education_row.institution_id=student_row.institution_id AND education_row.course_id=student_row.course_id AND upper(btrim(education_row.enrollment_id))=upper(btrim(student_row.enrollment_code))
 JOIN public.vertice_alumni_profiles profile_row ON profile_row.id=education_row.profile_id
 WHERE student_row.institution_id=inst AND (c IS NULL OR student_row.course_id=c) AND (profile_row.cpf_hash IS NULL OR profile_row.cpf_hash=student_row.cpf_hash)
 AND NOT EXISTS(SELECT 1 FROM vertice_conecta.identity_links l WHERE l.revoked_at IS NULL AND (l.student_id=student_row.id OR l.education_id=education_row.id))
 ORDER BY student_row.full_name,student_row.id LIMIT 30 OFFSET offset_n) q),'[]'),
 'links',coalesce((SELECT jsonb_agg(q) FROM (SELECT l.*,student_row.full_name,student_row.enrollment_code FROM vertice_conecta.identity_links l JOIN public.vertice_student_registry student_row ON student_row.id=l.student_id
 WHERE l.institution_id=inst AND (c IS NULL OR l.course_id=c) AND l.revoked_at IS NULL ORDER BY l.created_at DESC LIMIT 30 OFFSET offset_n) q),'[]'));
 ELSIF action='reconcile' THEN
  note:=btrim(coalesce(p->>'note',''));IF length(note) NOT BETWEEN 10 AND 4000 OR p->>'confirmed'<>'true' OR p->>'confirmed' IS NULL THEN RAISE EXCEPTION 'Confirme os documentos e justifique a conciliação';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(inst::text||':identity',0));
  SELECT * INTO st FROM public.vertice_student_registry WHERE id=(p->>'student_id')::uuid AND institution_id=inst;
  SELECT * INTO ed FROM public.vertice_alumni_education WHERE id=(p->>'education_id')::uuid AND institution_id=inst;
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
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('eligible',(SELECT count(DISTINCT e.profile_id) FROM public.vertice_alumni_education e WHERE vertice_conecta.survey_eligible(q,e)),
  'drafts',(SELECT count(*) FROM public.vertice_alumni_survey_responses WHERE survey_id=q.id AND status='em_andamento'),
  'respondents',(SELECT count(*) FROM public.vertice_alumni_survey_responses WHERE survey_id=q.id AND status IN ('concluida','corrigida'))))
  FROM (SELECT * FROM public.vertice_alumni_surveys WHERE institution_id=inst AND (c IS NULL OR course_id=c) AND survey_origin='conecta_short' ORDER BY created_at DESC LIMIT 30 OFFSET offset_n) q),'[]');
 ELSIF action='create_survey' THEN
  IF length(btrim(coalesce(p->>'title',''))) NOT BETWEEN 3 AND 250 THEN RAISE EXCEPTION 'Informe o título da pesquisa';END IF;
  IF nullif(p->>'conclusion_year','') IS NULL OR nullif(p->>'conclusion_semester','') IS NULL THEN RAISE EXCEPTION 'Informe ano e semestre da turma de conclusão';END IF;
  IF nullif(p->>'opens_at','') IS NULL OR nullif(p->>'closes_at','') IS NULL OR (p->>'closes_at')::timestamptz<=(p->>'opens_at')::timestamptz THEN RAISE EXCEPTION 'Período de coleta inválido';END IF;
  ident:=(p->>'request_id')::uuid;
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
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.longitudinal_admin(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_conecta.longitudinal_admin(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.vertice_conecta_longitudinal(p_institution uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT vertice_conecta.longitudinal_admin(p_institution,p_action,p_payload)$$;
REVOKE ALL ON FUNCTION public.vertice_conecta_longitudinal(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_longitudinal(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.vertice_conecta_surveys_student(p_session_hash text,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE st public.vertice_student_registry;ed public.vertice_alumni_education;t vertice_conecta.tracks;
 survey public.vertice_alumni_surveys;response public.vertice_alumni_survey_responses;question_row public.vertice_alumni_survey_questions;
 answers jsonb;answer_value_text text;employment text;field text;native_status text;new_id uuid;
BEGIN
 SELECT s.* INTO st FROM public.vertice_student_sessions x JOIN public.vertice_student_registry s ON s.id=x.student_id AND s.institution_id=x.institution_id
 WHERE x.session_key_hash=p_session_hash AND x.access_scope='conecta' AND x.expires_at>now() AND x.revoked_at IS NULL AND s.academic_status IN ('active','graduated');
 IF st.id IS NULL THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='42501';END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>16000 THEN RAISE EXCEPTION 'Conteúdo inválido';END IF;
 SELECT e.* INTO ed FROM vertice_conecta.identity_links l JOIN public.vertice_alumni_education e ON e.id=l.education_id AND e.institution_id=l.institution_id AND e.course_id=l.course_id
 WHERE l.student_id=st.id AND l.institution_id=st.institution_id AND l.course_id=st.course_id AND l.revoked_at IS NULL;
 IF p_action='list' THEN
  IF ed.id IS NULL THEN RETURN jsonb_build_object('requires_reconciliation',true,'surveys','[]'::jsonb);END IF;
  RETURN jsonb_build_object('requires_reconciliation',false,'cohort',jsonb_build_object('year',ed.conclusion_year,'semester',ed.conclusion_semester),
  'surveys',coalesce((SELECT jsonb_agg(to_jsonb(s)-'responsible_id'||jsonb_build_object(
   'questions',(SELECT jsonb_agg(jsonb_build_object('id',q.id,'key',q.indicator_key,'label',q.question_text,'type',q.question_type,'required',q.required,'options',q.options) ORDER BY q.sort_order) FROM public.vertice_alumni_survey_questions q WHERE q.survey_id=s.id),
   'response',(SELECT jsonb_build_object('status',r.status,'answers',coalesce((SELECT jsonb_object_agg(q.indicator_key,a.answer_value) FROM public.vertice_alumni_survey_answers a JOIN public.vertice_alumni_survey_questions q ON q.id=a.question_id AND q.survey_id=s.id WHERE a.response_id=r.id),'{}'), 'completed_at',r.completed_at) FROM public.vertice_alumni_survey_responses r WHERE r.survey_id=s.id AND r.profile_id=ed.profile_id AND r.education_id=ed.id)))
   FROM public.vertice_alumni_surveys s WHERE s.survey_origin='conecta_short' AND s.status='ativa' AND (s.opens_at IS NULL OR s.opens_at<=now()) AND (s.closes_at IS NULL OR s.closes_at>now()) AND vertice_conecta.survey_eligible(s,ed)),'[]'));
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('draft','submit') OR ed.id IS NULL THEN RAISE EXCEPTION 'Pesquisa indisponível para este vínculo';END IF;
 SELECT * INTO survey FROM public.vertice_alumni_surveys WHERE id=(p_payload->>'survey_id')::uuid AND survey_origin='conecta_short' AND status='ativa' FOR SHARE;
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
END $$;
REVOKE ALL ON FUNCTION public.vertice_conecta_surveys_student(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_surveys_student(text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION vertice_conecta.metrics(inst uuid,course uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH s AS (SELECT * FROM vertice_conecta.tracks WHERE institution_id=inst AND (course IS NULL OR course_id=course) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.identity_links l WHERE l.source_track=tracks.id AND l.revoked_at IS NULL)),
 c AS (SELECT count(*) total,count(*) FILTER(WHERE student_id IS NOT NULL) linked,
 count(*) FILTER(WHERE reported_at IS NOT NULL AND data->>'employment' NOT IN ('desconhecido','prefiro_nao_informar')) respondents,
 count(*) FILTER(WHERE reported_at IS NOT NULL AND data->>'employment' IN ('empregado','autonomo','empreendedor','servidor','estagiario')) employed,
 count(*) FILTER(WHERE reported_at IS NOT NULL AND data->>'employment' IN ('empregado','autonomo','empreendedor','servidor','estagiario') AND data->>'in_field' IN ('true','false')) field_respondents,
 count(*) FILTER(WHERE reported_at IS NOT NULL AND data->>'employment' IN ('empregado','autonomo','empreendedor','servidor','estagiario') AND data->>'in_field'='true') in_field,
 count(*) FILTER(WHERE reported_at<now()-interval '12 months') outdated,max(reported_at) last_report FROM s)
 SELECT jsonb_build_object('tracks',total,'registry_linked',linked,'registry_population',(SELECT count(*) FROM public.vertice_student_registry WHERE institution_id=inst AND (course IS NULL OR course_id=course)),
 'respondents',respondents,'employed',employed,'field_respondents',field_respondents,'in_field',in_field,'outdated',outdated,'last_report',last_report,'retrieved_at',now(),
 'period','Retrato cadastral atual; inclui estudantes e egressos; respostas antigas são identificadas.',
 'unit','vínculos acadêmicos acompanhados','source','vertice_student_registry + vertice_conecta.tracks') FROM c
$$;

CREATE OR REPLACE FUNCTION vertice_conecta.detail(track uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('longitudinal',jsonb_build_object('education_id',coalesce(t.education_id,(SELECT education_id FROM vertice_conecta.identity_links WHERE canonical_track=t.id AND revoked_at IS NULL)),'history',coalesce((SELECT jsonb_agg(h) FROM (SELECT DISTINCT ON(track_id,version) track_id,version,data,source,reported_at,recorded_at FROM (SELECT track_id,version,data,source,reported_at,recorded_at FROM vertice_conecta.profile_history UNION ALL SELECT id,version,data,source,reported_at,updated_at FROM vertice_conecta.tracks) all_history WHERE track_id=t.id OR track_id IN(SELECT source_track FROM vertice_conecta.identity_links WHERE canonical_track=t.id AND revoked_at IS NULL) ORDER BY track_id,version DESC LIMIT 20) h),'[]')), 'profile',to_jsonb(t)||jsonb_build_object('full_name',coalesce(s.full_name,p.social_name,p.full_name),'enrollment',coalesce(s.enrollment_code,e.enrollment_id)),
 'preferences',coalesce((SELECT jsonb_agg(q) FROM (SELECT DISTINCT ON(channel,purpose) * FROM vertice_conecta.preferences q WHERE q.track_id IN (SELECT t.id UNION SELECT l.source_track FROM vertice_conecta.identity_links l WHERE l.canonical_track=t.id AND l.revoked_at IS NULL AND l.source_track IS NOT NULL) ORDER BY channel,purpose,recorded_at DESC,allowed) q),'[]'),
 'evidence',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('verified',d.status='approved')) FROM vertice_conecta.evidence q LEFT JOIN public.vertice_documents d ON d.id=q.document_id AND d.institution_id=t.institution_id WHERE q.track_id IN (SELECT t.id UNION SELECT l.source_track FROM vertice_conecta.identity_links l WHERE l.canonical_track=t.id AND l.revoked_at IS NULL AND l.source_track IS NOT NULL)),'[]'),
 'applications',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('title',o.title)) FROM vertice_conecta.applications a JOIN vertice_conecta.opportunities o ON o.id=a.opportunity_id WHERE a.track_id IN (SELECT t.id UNION SELECT l.source_track FROM vertice_conecta.identity_links l WHERE l.canonical_track=t.id AND l.revoked_at IS NULL AND l.source_track IS NOT NULL)),'[]'),
 'opportunities',coalesce((SELECT jsonb_agg(q) FROM (SELECT id,title,employer FROM vertice_conecta.opportunities WHERE institution_id=t.institution_id AND (course_id IS NULL OR course_id=t.course_id) AND status='publicada' AND (deadline IS NULL OR deadline>=current_date) ORDER BY created_at DESC LIMIT 100) q),'[]'),
 'internships',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'status',i.lifecycle,'starts_at',i.starts_at,'ends_at',i.ends_at)) FROM public.vertice_internship_placements i WHERE i.student_id=t.student_id AND i.institution_id=t.institution_id),'[]'),
 'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status)) FROM public.vertice_ac_submissions a WHERE a.student_id=t.student_id AND a.institution_id=t.institution_id),'[]'))
 FROM vertice_conecta.tracks t LEFT JOIN public.vertice_student_registry s ON s.id=t.student_id
 LEFT JOIN public.vertice_alumni_education e ON e.id=coalesce(t.education_id,(SELECT education_id FROM vertice_conecta.identity_links WHERE canonical_track=t.id AND revoked_at IS NULL)) LEFT JOIN public.vertice_alumni_profiles p ON p.id=e.profile_id WHERE t.id=track
$$;
-- Shared mutations are inaccessible directly from browsers and always receive an authorized row.

CREATE OR REPLACE FUNCTION vertice_conecta.api(inst uuid,action text,p jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 UNION ALL SELECT e.id,pr.full_name,e.enrollment_id,e.course_id,'alumni' FROM public.vertice_alumni_education e JOIN public.vertice_alumni_profiles pr ON pr.id=e.profile_id WHERE e.institution_id=inst AND e.course_id IS NOT NULL AND (c IS NULL OR e.course_id=c) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.tracks WHERE education_id=e.id) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.identity_links WHERE education_id=e.id AND revoked_at IS NULL) AND (pr.full_name ILIKE '%'||search_text||'%' OR e.enrollment_id ILIKE '%'||search_text||'%')
 ORDER BY full_name,id LIMIT 30 OFFSET offset_n) q),'[]');
 ELSIF action='attach' THEN
 ident:=(p->>'source_id')::uuid;
 IF p->>'source'='student' THEN
  SELECT * INTO v_student FROM public.vertice_student_registry WHERE id=ident AND institution_id=inst;
  IF v_student.id IS NULL OR NOT vertice_conecta.allowed(inst,v_student.course_id) OR (c IS NOT NULL AND c<>v_student.course_id) THEN RAISE EXCEPTION 'Matrícula fora do escopo' USING ERRCODE='42501';END IF;
  INSERT INTO vertice_conecta.tracks(institution_id,course_id,student_id,data) VALUES(inst,v_student.course_id,v_student.id,'{"stage":"estudante","employment":"desconhecido"}') ON CONFLICT(student_id) DO NOTHING RETURNING id INTO ident;
 ELSIF p->>'source'='alumni' THEN
  SELECT * INTO v_education FROM public.vertice_alumni_education WHERE id=ident AND institution_id=inst;
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
END $$;


-- Native participation denominators honor course, cohort and scheduled follow-up.
CREATE OR REPLACE VIEW public.v_alumni_survey_indicators AS
WITH eligible_profiles AS (
 SELECT DISTINCT ae.institution_id,s.id survey_id,ae.profile_id
 FROM public.vertice_alumni_education ae JOIN public.vertice_alumni_surveys s ON s.institution_id=ae.institution_id AND (s.course_id IS NULL OR s.course_id=ae.course_id)
 WHERE CASE WHEN s.survey_origin='conecta_short' THEN
  (s.conclusion_year IS NULL OR s.conclusion_year=ae.conclusion_year) AND (s.conclusion_semester IS NULL OR s.conclusion_semester=ae.conclusion_semester)
  AND CASE s.target_audience WHEN 'egressos' THEN ae.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado')
  WHEN 'concluintes' THEN ae.academic_status IN ('provavel_concluinte','concluinte','integralizado') ELSE ae.academic_status IN ('ativo','provavel_concluinte','concluinte','integralizado','formado','diplomado','egresso_acompanhado') END
  AND (coalesce(s.followup_months,0)=0 OR (coalesce(ae.graduation_date,CASE WHEN ae.conclusion_year IS NOT NULL AND ae.conclusion_semester IS NOT NULL THEN make_date(ae.conclusion_year,CASE WHEN ae.conclusion_semester=1 THEN 6 ELSE 12 END,CASE WHEN ae.conclusion_semester=1 THEN 30 ELSE 31 END) END)+make_interval(months=>s.followup_months))::date<=current_date)
 ELSE ae.academic_status IN ('formado','diplomado','egresso_acompanhado','integralizado','concluinte') END
), eligible AS (SELECT institution_id,survey_id,count(DISTINCT profile_id) total_eligible FROM eligible_profiles GROUP BY institution_id,survey_id),
 invited AS (SELECT i.survey_id,count(*) total_invited,count(*) FILTER(WHERE i.delivery_status='entregue') total_delivered FROM public.vertice_alumni_survey_invitations i JOIN eligible_profiles e ON e.survey_id=i.survey_id AND e.profile_id=i.profile_id GROUP BY i.survey_id),
 responded AS (SELECT r.survey_id,count(DISTINCT r.profile_id) total_respondents FROM public.vertice_alumni_survey_responses r JOIN eligible_profiles e ON e.survey_id=r.survey_id AND e.profile_id=r.profile_id WHERE r.status IN ('concluida','corrigida') GROUP BY r.survey_id)
 SELECT e.institution_id,e.survey_id,s.title survey_title,s.wave_type,e.total_eligible,coalesce(i.total_invited,0::bigint) total_invited,coalesce(i.total_delivered,0::bigint) total_delivered,coalesce(r.total_respondents,0::bigint) total_respondents,
 CASE WHEN e.total_eligible>0 THEN round(100.0*coalesce(r.total_respondents,0::bigint)::numeric/e.total_eligible::numeric,2) ELSE null::numeric END pct_eligible,
 CASE WHEN coalesce(i.total_invited,0::bigint)>0 THEN round(100.0*coalesce(r.total_respondents,0::bigint)::numeric/i.total_invited::numeric,2) ELSE null::numeric END pct_invited,
 CASE WHEN coalesce(i.total_delivered,0::bigint)>0 THEN round(100.0*coalesce(r.total_respondents,0::bigint)::numeric/i.total_delivered::numeric,2) ELSE null::numeric END pct_delivered
 FROM eligible e JOIN public.vertice_alumni_surveys s ON s.id=e.survey_id LEFT JOIN invited i ON i.survey_id=e.survey_id LEFT JOIN responded r ON r.survey_id=e.survey_id;
CREATE INDEX conecta_native_surveys_scope ON public.vertice_alumni_surveys(institution_id,course_id,created_at DESC) WHERE survey_origin='conecta_short';
CREATE OR REPLACE FUNCTION vertice_conecta.enrich_sapiens() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.scope='superior' THEN
  NEW.context:=NEW.context||jsonb_build_object('conecta',vertice_conecta.metrics(NEW.institution_id,NEW.course_id),
  'conecta_partners',jsonb_build_object('pending_proposals',(SELECT count(*) FROM vertice_conecta.partner_proposals WHERE institution_id=NEW.institution_id AND status='pending' AND (NEW.course_id IS NULL OR course_id=NEW.course_id)),
  'approved_proposals',(SELECT count(*) FROM vertice_conecta.partner_proposals WHERE institution_id=NEW.institution_id AND status='approved' AND (NEW.course_id IS NULL OR course_id=NEW.course_id))),
  'conecta_collection',jsonb_build_object('active_surveys',(SELECT count(*) FROM public.vertice_alumni_surveys WHERE institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR course_id=NEW.course_id) AND survey_origin='conecta_short' AND status='ativa'),
  'completed_responses',(SELECT count(*) FROM public.vertice_alumni_survey_responses r JOIN public.vertice_alumni_surveys s ON s.id=r.survey_id WHERE s.institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR s.course_id=NEW.course_id) AND s.survey_origin='conecta_short' AND r.status IN ('concluida','corrigida')),
  'draft_responses',(SELECT count(*) FROM public.vertice_alumni_survey_responses r JOIN public.vertice_alumni_surveys s ON s.id=r.survey_id WHERE s.institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR s.course_id=NEW.course_id) AND s.survey_origin='conecta_short' AND r.status='em_andamento'),
  'reconciled_enrollments',(SELECT count(*) FROM vertice_conecta.identity_links WHERE institution_id=NEW.institution_id AND (NEW.course_id IS NULL OR course_id=NEW.course_id) AND revoked_at IS NULL)),
  'conecta_limitations','Dados agregados de vínculos, propostas e coleta. Respostas são contadas por pesquisa, não como pessoas únicas entre ondas; rascunhos não são respostas concluídas. Conciliações não alteram situação acadêmica. Inserção profissional apenas entre respondentes; não extrapolar ou inferir causalidade. Aprovação de proposta não comprova resultado, contratação, convênio, horas ou aprovação acadêmica.');
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.enrich_sapiens() FROM PUBLIC,anon,authenticated;
COMMIT;
