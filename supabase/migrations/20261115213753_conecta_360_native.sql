-- Conecta 360° native domain. Academic people, enrollments and Auth remain canonical.
BEGIN;
CREATE SCHEMA vertice_conecta;
REVOKE ALL ON SCHEMA vertice_conecta FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA vertice_conecta TO authenticated,service_role;
CREATE TABLE vertice_conecta.tracks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 course_id uuid NOT NULL REFERENCES public.vertice_courses(id),student_id uuid UNIQUE REFERENCES public.vertice_student_registry(id),
 education_id uuid UNIQUE REFERENCES public.vertice_alumni_education(id),data jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,reported_at timestamptz,source text NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','portal')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(student_id IS NOT NULL OR education_id IS NOT NULL),CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=40000)
);
CREATE INDEX conecta_tracks_scope ON vertice_conecta.tracks(institution_id,course_id,updated_at DESC);
CREATE TABLE vertice_conecta.opportunities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),course_id uuid REFERENCES public.vertice_courses(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 250),employer text NOT NULL CHECK(length(btrim(employer)) BETWEEN 2 AND 250),
 kind text NOT NULL CHECK(kind IN ('emprego','estagio','mentoria','evento','formacao')),description text NOT NULL DEFAULT '' CHECK(length(description)<=8000),
 url text NOT NULL DEFAULT '' CHECK(length(url)<=1000 AND (url='' OR url ~ '^https://[^[:space:]]+$')),deadline date,
 status text NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','publicada','encerrada')),version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conecta_opportunities_scope ON vertice_conecta.opportunities(institution_id,course_id,status);
CREATE TABLE vertice_conecta.applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),track_id uuid NOT NULL REFERENCES vertice_conecta.tracks(id),opportunity_id uuid NOT NULL REFERENCES vertice_conecta.opportunities(id),
 status text NOT NULL CHECK(status IN ('interesse','candidatura','selecionado','contratado','encerrado')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(track_id,opportunity_id)
);
CREATE TABLE vertice_conecta.preferences (
 track_id uuid NOT NULL REFERENCES vertice_conecta.tracks(id),channel text NOT NULL CHECK(channel IN ('portal','email','whatsapp')),
 purpose text NOT NULL CHECK(purpose IN ('pesquisa','oportunidades','promocional')),allowed boolean NOT NULL DEFAULT false,
 basis text NOT NULL CHECK(length(btrim(basis)) BETWEEN 10 AND 2000),recorded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(track_id,channel,purpose)
);
CREATE TABLE vertice_conecta.evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),track_id uuid NOT NULL REFERENCES vertice_conecta.tracks(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 250),kind text NOT NULL CHECK(kind IN ('competencia','estagio','tcc','extensao','ac','certificacao','publicacao','experiencia')),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=4000),document_id uuid REFERENCES public.vertice_documents(id),
 source text NOT NULL CHECK(source IN ('manual','portal')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vertice_conecta.goal_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 course_id uuid REFERENCES public.vertice_courses(id),goal_id uuid NOT NULL REFERENCES public.vertice_goals(id),
 indicator text NOT NULL CHECK(indicator IN ('cobertura','insercao_respondentes','area_respondentes')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(goal_id,indicator)
);
CREATE TABLE vertice_conecta.config (
 institution_id uuid PRIMARY KEY REFERENCES public.vertice_institutions(id),milestones integer[] NOT NULL DEFAULT '{0,3,6,12}',
 max_contacts integer NOT NULL DEFAULT 3 CHECK(max_contacts BETWEEN 0 AND 10),version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),CHECK(cardinality(milestones) BETWEEN 1 AND 12 AND milestones<@ARRAY[0,3,6,12,18,24,36,48,60])
);
CREATE TABLE vertice_conecta.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,institution_id uuid NOT NULL,course_id uuid,actor uuid NOT NULL,
 action text NOT NULL,entity_id uuid,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conecta_audit_scope ON vertice_conecta.audit(institution_id,course_id,created_at DESC);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['tracks','opportunities','applications','preferences','evidence','goal_links','config','audit'] LOOP
 EXECUTE format('ALTER TABLE vertice_conecta.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON vertice_conecta.%I FROM PUBLIC,anon,authenticated',t);
END LOOP;END $$;
-- Helpers are private; browser callers cannot supply another person's identity.
CREATE FUNCTION vertice_conecta.allowed(inst uuid,course uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'aal','')='aal2' AND (
 vertice_private.member_role(inst) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') OR
 (vertice_private.member_role(inst) IN ('coordenador','nde') AND course IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.vertice_learning_staff_scope s WHERE s.institution_id=inst AND s.course_id=course AND s.user_id=auth.uid() AND s.active)))
$$;
CREATE FUNCTION vertice_conecta.metrics(inst uuid,course uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH s AS (SELECT * FROM vertice_conecta.tracks WHERE institution_id=inst AND (course IS NULL OR course_id=course)),
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
CREATE FUNCTION vertice_conecta.validate_profile(d jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE k text;allowed_keys text[]:=ARRAY['stage','headline','linkedin','lattes','interests','skills','strengths','weaknesses','opportunities','threats','objective','deadline','employment','in_field'];r jsonb:='{}';BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' THEN RAISE EXCEPTION 'Perfil inválido';END IF;
 FOREACH k IN ARRAY allowed_keys LOOP
  IF d ? k THEN
   IF jsonb_typeof(d->k) NOT IN ('string','null','boolean') OR length(coalesce(d->>k,''))>4000 THEN RAISE EXCEPTION 'Campo de perfil inválido: %',k;END IF;
   r:=r||jsonb_build_object(k,d->k);
  END IF;
 END LOOP;
 IF coalesce(r->>'stage','estudante') NOT IN ('estudante','estagiario','concluinte','egresso','formacao_continuada','mentor') THEN RAISE EXCEPTION 'Etapa inválida';END IF;
 IF coalesce(r->>'employment','desconhecido') NOT IN ('desconhecido','empregado','autonomo','empreendedor','servidor','estagiario','buscando','nao_exerce','prefiro_nao_informar') THEN RAISE EXCEPTION 'Situação profissional inválida';END IF;
 IF r ? 'in_field' AND r->'in_field'<>'null'::jsonb AND r->>'in_field' NOT IN ('true','false','') THEN RAISE EXCEPTION 'Relação com a formação inválida';END IF;
 IF coalesce(r->>'linkedin','')<>'' AND r->>'linkedin' !~ '^https://([a-z]{2,3}\.)?linkedin\.com/in/[^[:space:]]+$' THEN RAISE EXCEPTION 'Endereço LinkedIn inválido';END IF;
 IF coalesce(r->>'lattes','')<>'' AND r->>'lattes' !~ '^https://lattes\.cnpq\.br/[0-9]{16}$' THEN RAISE EXCEPTION 'Endereço Lattes inválido';END IF;
 IF length(coalesce(r->>'headline',''))>250 OR length(coalesce(r->>'linkedin',''))>500 OR length(coalesce(r->>'lattes',''))>500 THEN RAISE EXCEPTION 'Texto muito extenso';END IF;
 IF nullif(r->>'deadline','') IS NOT NULL THEN PERFORM (r->>'deadline')::date;END IF;
 RETURN r;
END $$;
CREATE FUNCTION vertice_conecta.detail(track uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('profile',to_jsonb(t)||jsonb_build_object('full_name',coalesce(s.full_name,p.social_name,p.full_name),'enrollment',coalesce(s.enrollment_code,e.enrollment_id)),
 'preferences',coalesce((SELECT jsonb_agg(q) FROM vertice_conecta.preferences q WHERE q.track_id=t.id),'[]'),
 'evidence',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('verified',d.status='approved')) FROM vertice_conecta.evidence q LEFT JOIN public.vertice_documents d ON d.id=q.document_id AND d.institution_id=t.institution_id WHERE q.track_id=t.id),'[]'),
 'applications',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('title',o.title)) FROM vertice_conecta.applications a JOIN vertice_conecta.opportunities o ON o.id=a.opportunity_id WHERE a.track_id=t.id),'[]'),
 'opportunities',coalesce((SELECT jsonb_agg(q) FROM (SELECT id,title,employer FROM vertice_conecta.opportunities WHERE institution_id=t.institution_id AND (course_id IS NULL OR course_id=t.course_id) AND status='publicada' AND (deadline IS NULL OR deadline>=current_date) ORDER BY created_at DESC LIMIT 100) q),'[]'),
 'internships',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'status',i.lifecycle,'starts_at',i.starts_at,'ends_at',i.ends_at)) FROM public.vertice_internship_placements i WHERE i.student_id=t.student_id AND i.institution_id=t.institution_id),'[]'),
 'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status)) FROM public.vertice_ac_submissions a WHERE a.student_id=t.student_id AND a.institution_id=t.institution_id),'[]'))
 FROM vertice_conecta.tracks t LEFT JOIN public.vertice_student_registry s ON s.id=t.student_id
 LEFT JOIN public.vertice_alumni_education e ON e.id=t.education_id LEFT JOIN public.vertice_alumni_profiles p ON p.id=e.profile_id WHERE t.id=track
$$;
-- Shared mutations are inaccessible directly from browsers and always receive an authorized row.
CREATE FUNCTION vertice_conecta.mutate_track(track uuid,action text,p jsonb,self_service boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t vertice_conecta.tracks;d jsonb;o vertice_conecta.opportunities;doc uuid;BEGIN
 SELECT * INTO t FROM vertice_conecta.tracks WHERE id=track FOR UPDATE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Trajetória indisponível';END IF;
 IF action='save_profile' THEN
  IF (p->>'version')::int IS DISTINCT FROM t.version THEN RAISE EXCEPTION 'Perfil alterado. Atualize antes de salvar.' USING ERRCODE='40001';END IF;
  d:=vertice_conecta.validate_profile(coalesce(p->'data','{}'));
  IF self_service THEN d:=d-'stage';END IF;
  UPDATE vertice_conecta.tracks SET data=data||d,version=version+1,updated_at=now(),source=CASE WHEN self_service THEN 'portal' ELSE 'manual' END,
   reported_at=CASE WHEN coalesce((p->>'confirm_report')::boolean,false) THEN now()
   WHEN (d ? 'employment' AND d->'employment' IS DISTINCT FROM t.data->'employment') OR (d ? 'in_field' AND d->'in_field' IS DISTINCT FROM t.data->'in_field') THEN NULL ELSE reported_at END WHERE id=t.id;
 ELSIF action='preference' THEN
  INSERT INTO vertice_conecta.preferences(track_id,channel,purpose,allowed,basis) VALUES(t.id,p->>'channel',p->>'purpose',(p->>'allowed')::boolean,p->>'basis')
   ON CONFLICT(track_id,channel,purpose) DO UPDATE SET allowed=excluded.allowed,basis=excluded.basis,recorded_at=now();
 ELSIF action='evidence' THEN
  doc:=nullif(p->>'document_id','')::uuid;
  IF doc IS NOT NULL AND (self_service OR NOT EXISTS(SELECT 1 FROM public.vertice_documents WHERE id=doc AND institution_id=t.institution_id AND (course_id IS NULL OR course_id=t.course_id))) THEN RAISE EXCEPTION 'Documento fora do escopo ou exige análise institucional' USING ERRCODE='42501';END IF;
  INSERT INTO vertice_conecta.evidence(id,track_id,title,kind,description,document_id,source)
   VALUES((p->>'request_id')::uuid,t.id,p->>'title',p->>'kind',coalesce(p->>'description',''),doc,CASE WHEN self_service THEN 'portal' ELSE 'manual' END) ON CONFLICT(id) DO NOTHING;
 ELSIF action='application' THEN
  IF self_service AND coalesce(p->>'status','') NOT IN ('interesse','candidatura','encerrado') THEN RAISE EXCEPTION 'Etapa depende de confirmação institucional';END IF;
  SELECT * INTO o FROM vertice_conecta.opportunities WHERE id=(p->>'opportunity_id')::uuid AND institution_id=t.institution_id AND (course_id IS NULL OR course_id=t.course_id) AND status='publicada' AND (deadline IS NULL OR deadline>=current_date);
  IF o.id IS NULL THEN RAISE EXCEPTION 'Oportunidade indisponível';END IF;
  INSERT INTO vertice_conecta.applications(track_id,opportunity_id,status) VALUES(t.id,o.id,p->>'status') ON CONFLICT(track_id,opportunity_id) DO UPDATE SET status=excluded.status;
 ELSE RAISE EXCEPTION 'Operação de trajetória inválida';END IF;
 INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id,details)
 VALUES(t.institution_id,t.course_id,CASE WHEN self_service THEN t.student_id ELSE auth.uid() END,CASE WHEN self_service THEN 'student.' ELSE '' END||action,t.id,
 jsonb_build_object('channel',p->>'channel','purpose',p->>'purpose','allowed',p->'allowed','sent',false));
 RETURN vertice_conecta.detail(t.id);
END $$;
CREATE FUNCTION vertice_conecta.api(inst uuid,action text,p jsonb DEFAULT '{}') RETURNS jsonb
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
 WHERE t.institution_id=inst AND (c IS NULL OR t.course_id=c) AND (search_text='' OR coalesce(s.full_name,pr.full_name) ILIKE '%'||search_text||'%' OR coalesce(s.enrollment_code,ed.enrollment_id) ILIKE '%'||search_text||'%') ORDER BY t.updated_at DESC,t.id LIMIT 30 OFFSET offset_n) q),'[]');
 ELSIF action='candidates' THEN
 RETURN coalesce((SELECT jsonb_agg(q) FROM (
 SELECT s.id,s.full_name,s.enrollment_code enrollment,s.course_id,'student' source FROM public.vertice_student_registry s WHERE s.institution_id=inst AND (c IS NULL OR s.course_id=c) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.tracks WHERE student_id=s.id) AND (s.full_name ILIKE '%'||search_text||'%' OR s.enrollment_code ILIKE '%'||search_text||'%')
 UNION ALL SELECT e.id,pr.full_name,e.enrollment_id,e.course_id,'alumni' FROM public.vertice_alumni_education e JOIN public.vertice_alumni_profiles pr ON pr.id=e.profile_id WHERE e.institution_id=inst AND e.course_id IS NOT NULL AND (c IS NULL OR e.course_id=c) AND NOT EXISTS(SELECT 1 FROM vertice_conecta.tracks WHERE education_id=e.id) AND (pr.full_name ILIKE '%'||search_text||'%' OR e.enrollment_id ILIKE '%'||search_text||'%')
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
  INSERT INTO vertice_conecta.tracks(institution_id,course_id,education_id,data) VALUES(inst,v_education.course_id,v_education.id,'{"stage":"egresso","employment":"desconhecido"}') ON CONFLICT(education_id) DO NOTHING RETURNING id INTO ident;
 ELSE RAISE EXCEPTION 'Fonte inválida';END IF;
 result:=jsonb_build_object('id',ident);
 ELSIF action IN ('detail','save_profile','preference','evidence','application') THEN
  SELECT * INTO v_track FROM vertice_conecta.tracks WHERE id=(p->>'id')::uuid AND institution_id=inst FOR UPDATE;
  IF v_track.id IS NULL OR NOT vertice_conecta.allowed(inst,v_track.course_id) OR (c IS NOT NULL AND c<>v_track.course_id) THEN RAISE EXCEPTION 'Trajetória fora do escopo' USING ERRCODE='42501';END IF;
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
CREATE FUNCTION public.vertice_conecta(p_institution uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT vertice_conecta.api(p_institution,p_action,p_payload)$$;
CREATE FUNCTION public.vertice_conecta_student(p_session_hash text,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.vertice_student_registry;t vertice_conecta.tracks;BEGIN
 SELECT r.* INTO s FROM public.vertice_student_sessions x JOIN public.vertice_student_registry r ON r.id=x.student_id AND r.institution_id=x.institution_id
 WHERE x.session_key_hash=p_session_hash AND x.expires_at>now() AND x.revoked_at IS NULL AND r.academic_status IN ('active','graduated');
 IF s.id IS NULL THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=s.institution_id AND tier='superior') THEN RAISE EXCEPTION 'Instituição incompatível';END IF;
 IF p_action IS NULL OR p_action NOT IN ('detail','save_profile','preference','application','evidence') OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>50000 THEN RAISE EXCEPTION 'Solicitação inválida';END IF;
 INSERT INTO vertice_conecta.tracks(institution_id,course_id,student_id,data,source) VALUES(s.institution_id,s.course_id,s.id,jsonb_build_object('stage',CASE WHEN s.academic_status='graduated' THEN 'egresso' ELSE 'estudante' END,'employment','desconhecido'),'portal') ON CONFLICT(student_id) DO NOTHING;
 SELECT * INTO t FROM vertice_conecta.tracks WHERE student_id=s.id AND institution_id=s.institution_id FOR UPDATE;
 IF t.id IS NULL OR t.course_id IS DISTINCT FROM s.course_id THEN RAISE EXCEPTION 'Vínculo em revisão institucional';END IF;
 IF p_action='detail' THEN RETURN vertice_conecta.detail(t.id);END IF;
 RETURN vertice_conecta.mutate_track(t.id,p_action,p_payload,true);
END $$;
CREATE FUNCTION vertice_conecta.enrich_sapiens() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN IF NEW.scope='superior' THEN NEW.context:=NEW.context||jsonb_build_object('conecta',vertice_conecta.metrics(NEW.institution_id,NEW.course_id),
 'conecta_limitations','Dados agregados de vínculos acompanhados; inserção apenas entre respondentes com confirmação. Não extrapolar para todos os egressos, não inferir causalidade e não aprovar ações.');END IF;RETURN NEW;END $$;
CREATE TRIGGER conecta_sapiens_snapshot BEFORE INSERT ON public.vertice_sapiens_planning_analyses FOR EACH ROW EXECUTE FUNCTION vertice_conecta.enrich_sapiens();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vertice_conecta FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION vertice_conecta.api(uuid,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.vertice_conecta(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_conecta(uuid,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.vertice_conecta_student(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_student(text,text,jsonb),vertice_conecta.detail(uuid),vertice_conecta.mutate_track(uuid,text,jsonb,boolean),vertice_conecta.validate_profile(jsonb) TO service_role;
GRANT SELECT,INSERT,UPDATE ON vertice_conecta.tracks,vertice_conecta.preferences,vertice_conecta.applications TO service_role;
GRANT SELECT,INSERT ON vertice_conecta.evidence,vertice_conecta.audit TO service_role;
GRANT SELECT ON vertice_conecta.opportunities TO service_role;
GRANT USAGE ON SEQUENCE vertice_conecta.audit_id_seq TO service_role;
COMMIT;
