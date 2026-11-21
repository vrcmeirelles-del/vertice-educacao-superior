-- Native partner intake, institutional review, canonical internship/extension projections.
BEGIN;
CREATE TABLE vertice_conecta.partner_registrations(
 id uuid PRIMARY KEY,institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=24000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
 organization_id uuid REFERENCES public.vertice_internship_organizations(id),
 extension_partner_id uuid REFERENCES public.vertice_extension_partners(id),
 version integer NOT NULL DEFAULT 1,review_note text,reviewed_by uuid,reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conecta_partner_intake_scope ON vertice_conecta.partner_registrations(institution_id,status,created_at DESC);
CREATE TABLE vertice_conecta.partner_links(
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),partner_id uuid NOT NULL REFERENCES vertice_conecta.partner_registrations(id),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '72 hours',revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conecta_partner_links_owner ON vertice_conecta.partner_links(partner_id,expires_at);
CREATE TABLE vertice_conecta.partner_proposals(
 id uuid PRIMARY KEY,institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 partner_id uuid NOT NULL REFERENCES vertice_conecta.partner_registrations(id),course_id uuid REFERENCES public.vertice_courses(id),
 kind text NOT NULL CHECK(kind IN ('emprego','estagio','campo_estagio','evento','extensao','formacao','mentoria','acao_institucional')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 250),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=24000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 opportunity_id uuid REFERENCES vertice_conecta.opportunities(id),field_id uuid REFERENCES public.vertice_internship_fields(id),
 extension_project_id uuid REFERENCES public.vertice_extension_projects(id),goal_id uuid REFERENCES public.vertice_goals(id),action_id uuid REFERENCES public.vertice_actions(id),
 review_note text,reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conecta_partner_proposal_scope ON vertice_conecta.partner_proposals(institution_id,course_id,status,created_at DESC);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['partner_registrations','partner_links','partner_proposals'] LOOP
 EXECUTE format('ALTER TABLE vertice_conecta.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON vertice_conecta.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON vertice_conecta.%I TO service_role',t);
END LOOP;END $$;
CREATE FUNCTION vertice_conecta.partner_data(d jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE k text;r jsonb:='{}';BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' THEN RAISE EXCEPTION 'Cadastro inválido';END IF;
 FOREACH k IN ARRAY ARRAY['name','trade_name','identifier','partner_type','contact_name','contact_email','contact_phone','address','city','state','sector'] LOOP
  IF d ? k THEN
   IF jsonb_typeof(d->k)<>'string' OR length(d->>k)>(CASE WHEN k='address' THEN 1000 ELSE 250 END) THEN RAISE EXCEPTION 'Campo inválido: %',k;END IF;
   r:=r||jsonb_build_object(k,btrim(d->>k));
  END IF;
 END LOOP;
 IF length(coalesce(r->>'name','')) NOT BETWEEN 3 AND 250 OR length(coalesce(r->>'contact_name',''))<3 THEN RAISE EXCEPTION 'Organização e responsável são obrigatórios';END IF;
 IF coalesce(r->>'partner_type','') NOT IN ('empresa','organizacao','governo','ong','comunidade','pessoa_fisica') THEN RAISE EXCEPTION 'Tipo de parceiro inválido';END IF;
 IF coalesce(r->>'contact_email','')<>'' AND r->>'contact_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail inválido';END IF;
 IF coalesce(r->>'contact_phone','')<>'' AND length(regexp_replace(r->>'contact_phone','[^0-9]','','g')) NOT BETWEEN 10 AND 15 THEN RAISE EXCEPTION 'Telefone inválido';END IF;
 IF coalesce(r->>'contact_email','')='' AND coalesce(r->>'contact_phone','')='' THEN RAISE EXCEPTION 'Informe ao menos um contato: telefone ou e-mail';END IF;
 IF coalesce(r->>'identifier','')<>'' THEN
  k:=regexp_replace(r->>'identifier','[^0-9]','','g');
  IF length(k) NOT IN (11,14) OR k ~ '^([0-9])\1+$' THEN RAISE EXCEPTION 'CPF/CNPJ inválido';END IF;
  r:=r||jsonb_build_object('identifier',k);
 END IF;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.partner_data(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION vertice_conecta.partner_data(jsonb) TO service_role;
CREATE FUNCTION public.vertice_conecta_partner_public(p_action text,p_institution uuid,p_token_hash text DEFAULT NULL,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE reg vertice_conecta.partner_registrations;v_id uuid;d jsonb;k text;v_course uuid;v_kind text;v_title text;BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions i JOIN public.vertice_institution_addresses a ON a.institution_id=i.id AND a.active WHERE i.id=p_institution AND i.tier='superior') THEN RAISE EXCEPTION 'Instituição indisponível';END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>30000 THEN RAISE EXCEPTION 'Conteúdo inválido';END IF;
 IF p_action='info' THEN
  RETURN jsonb_build_object('name',(SELECT display_name FROM public.vertice_institution_addresses WHERE institution_id=p_institution AND active LIMIT 1),
  'courses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name) FROM public.vertice_courses c WHERE c.institution_id=p_institution),'[]'));
 END IF;
 IF coalesce(p_token_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Link inválido' USING ERRCODE='42501';END IF;
 IF p_action='register' THEN
  d:=vertice_conecta.partner_data(p_payload->'data');v_id:=(p_payload->>'request_id')::uuid;
  INSERT INTO vertice_conecta.partner_registrations(id,institution_id,data) VALUES(v_id,p_institution,d) ON CONFLICT(id) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','already_received');END IF;
  INSERT INTO vertice_conecta.partner_links(token_hash,partner_id) VALUES(p_token_hash,v_id);
  INSERT INTO vertice_conecta.audit(institution_id,actor,action,entity_id) VALUES(p_institution,v_id,'partner.register',v_id);
  RETURN jsonb_build_object('ok',true,'id',v_id,'expires_at',(SELECT expires_at FROM vertice_conecta.partner_links WHERE token_hash=p_token_hash));
 END IF;
 SELECT r.* INTO reg FROM vertice_conecta.partner_links l JOIN vertice_conecta.partner_registrations r ON r.id=l.partner_id
 WHERE l.token_hash=p_token_hash AND r.institution_id=p_institution AND l.expires_at>now() AND l.revoked_at IS NULL AND r.status NOT IN ('rejected','suspended');
 IF reg.id IS NULL THEN RAISE EXCEPTION 'Link inválido ou expirado' USING ERRCODE='42501';END IF;
 IF p_action='logout' THEN UPDATE vertice_conecta.partner_links SET revoked_at=now() WHERE token_hash=p_token_hash;RETURN jsonb_build_object('ok',true);END IF;
 IF p_action='me' THEN RETURN jsonb_build_object('partner',to_jsonb(reg)-ARRAY['reviewed_by','organization_id','extension_partner_id'],
  'proposals',coalesce((SELECT jsonb_agg(to_jsonb(q)-'reviewed_by') FROM (SELECT * FROM vertice_conecta.partner_proposals WHERE partner_id=reg.id AND institution_id=p_institution ORDER BY created_at DESC LIMIT 100) q),'[]'),
  'expires_at',(SELECT expires_at FROM vertice_conecta.partner_links WHERE token_hash=p_token_hash));
 ELSIF p_action='proposal' THEN
  v_course:=nullif(p_payload->>'course_id','')::uuid;v_kind:=p_payload->>'kind';v_title:=btrim(p_payload->>'title');
  IF v_course IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=v_course AND institution_id=p_institution) THEN RAISE EXCEPTION 'Curso fora da instituição';END IF;
  IF v_kind NOT IN ('emprego','estagio','campo_estagio','evento','extensao','formacao','mentoria','acao_institucional') OR length(coalesce(v_title,'')) NOT BETWEEN 3 AND 250 THEN RAISE EXCEPTION 'Informe tipo e título da proposta';END IF;
  d:='{}';
  FOREACH k IN ARRAY ARRAY['description','url','deadline','address','area_of_practice','capacity','start_date','end_date','location'] LOOP
   IF p_payload ? k THEN
    IF jsonb_typeof(p_payload->k)<>'string' OR length(p_payload->>k)>(CASE WHEN k='description' THEN 8000 ELSE 1000 END) THEN RAISE EXCEPTION 'Campo da proposta inválido: %',k;END IF;
    d:=d||jsonb_build_object(k,btrim(p_payload->>k));
   END IF;
  END LOOP;
  IF length(coalesce(d->>'description',''))<10 THEN RAISE EXCEPTION 'Descreva a proposta com ao menos 10 caracteres';END IF;
  IF coalesce(d->>'url','')<>'' AND d->>'url' !~ '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'Use uma URL HTTPS';END IF;
  IF nullif(d->>'capacity','') IS NOT NULL AND ((d->>'capacity')::int<1 OR (d->>'capacity')::int>100000) THEN RAISE EXCEPTION 'Capacidade inválida';END IF;
  IF nullif(d->>'deadline','') IS NOT NULL AND (d->>'deadline')::date<current_date THEN RAISE EXCEPTION 'Prazo já encerrado';END IF;
  IF nullif(d->>'start_date','') IS NOT NULL THEN PERFORM (d->>'start_date')::date;END IF;
  IF nullif(d->>'end_date','') IS NOT NULL THEN PERFORM (d->>'end_date')::date;END IF;
  IF nullif(d->>'end_date','')::date<nullif(d->>'start_date','')::date THEN RAISE EXCEPTION 'Fim anterior ao início';END IF;
  v_id:=(p_payload->>'request_id')::uuid;
  INSERT INTO vertice_conecta.partner_proposals(id,institution_id,partner_id,course_id,kind,title,data)
   VALUES(v_id,p_institution,reg.id,v_course,v_kind,v_title,d) ON CONFLICT(id) DO NOTHING;
  IF NOT FOUND THEN
   IF NOT EXISTS(SELECT 1 FROM vertice_conecta.partner_proposals WHERE id=v_id AND partner_id=reg.id) THEN RAISE EXCEPTION 'Referência indisponível';END IF;
   RETURN jsonb_build_object('ok',true,'received',true,'id',v_id);
  END IF;
  INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id) VALUES(p_institution,v_course,reg.id,'partner.proposal',v_id);
  RETURN jsonb_build_object('ok',true,'received',true,'id',v_id,'status','pending');
 ELSE RAISE EXCEPTION 'Operação inválida';END IF;
END $$;
REVOKE ALL ON FUNCTION public.vertice_conecta_partner_public(text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_partner_public(text,uuid,text,jsonb) TO service_role;
CREATE FUNCTION vertice_conecta.partners_admin(inst uuid,action text,p jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text;c uuid;full_access boolean;reg vertice_conecta.partner_registrations;proposal vertice_conecta.partner_proposals;
 decision text;note text;org uuid;ext uuid;n integer;identifier_value text;v_goal public.vertice_goals;result jsonb;page_offset integer;
BEGIN
 r:=vertice_private.member_role(inst);c:=nullif(p->>'course_id','')::uuid;
 IF auth.uid() IS NULL OR r IS NULL OR NOT vertice_conecta.allowed(inst,c) THEN RAISE EXCEPTION 'Vínculo validado e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=inst AND tier='superior') THEN RAISE EXCEPTION 'Instituição inválida';END IF;
 IF c IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=c AND institution_id=inst) THEN RAISE EXCEPTION 'Curso fora da instituição' USING ERRCODE='42501';END IF;
 full_access:=r IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador');
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>20000 THEN RAISE EXCEPTION 'Conteúdo inválido';END IF;
 page_offset:=greatest(0,least(coalesce((p->>'page')::int,0),10000))*30;
 IF action='list' THEN RETURN jsonb_build_object(
  'registrations',coalesce((SELECT jsonb_agg(q) FROM (SELECT * FROM vertice_conecta.partner_registrations rg WHERE rg.institution_id=inst
   AND (full_access OR EXISTS(SELECT 1 FROM vertice_conecta.partner_proposals pp WHERE pp.partner_id=rg.id AND pp.course_id=c)) ORDER BY created_at DESC,id LIMIT 30 OFFSET page_offset) q),'[]'),
  'proposals',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('partner_name',(SELECT data->>'name' FROM vertice_conecta.partner_registrations WHERE id=q.partner_id))) FROM
   (SELECT * FROM vertice_conecta.partner_proposals WHERE institution_id=inst AND (c IS NULL OR course_id=c) ORDER BY created_at DESC,id LIMIT 30 OFFSET page_offset) q),'[]'),
  'can_review_registration',full_access);
 END IF;
 decision:=p->>'decision';note:=btrim(coalesce(p->>'note',''));
 IF decision IS NULL OR decision NOT IN ('approve','reject') OR length(note)<10 OR length(note)>4000 THEN RAISE EXCEPTION 'Informe decisão e justificativa (10 a 4000 caracteres)';END IF;
 IF action='review_registration' THEN
  IF NOT full_access THEN RAISE EXCEPTION 'Cadastro de parceiros exige gestão institucional' USING ERRCODE='42501';END IF;
  SELECT * INTO reg FROM vertice_conecta.partner_registrations WHERE id=(p->>'id')::uuid AND institution_id=inst FOR UPDATE;
  IF reg.id IS NULL THEN RAISE EXCEPTION 'Cadastro fora do escopo' USING ERRCODE='42501';END IF;
  IF reg.status<>'pending' THEN RAISE EXCEPTION 'Cadastro já revisado. Atualize.' USING ERRCODE='40001';END IF;
  IF decision='approve' THEN
   identifier_value:=nullif(reg.data->>'identifier','');
   PERFORM pg_advisory_xact_lock(hashtextextended(inst::text||':partner:'||coalesce(identifier_value,reg.id::text),0));
   IF identifier_value IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.vertice_internship_organizations WHERE institution_id=inst AND regexp_replace(identifier,'[^0-9]','','g')=identifier_value;
    IF n>1 THEN RAISE EXCEPTION 'Há concedentes duplicadas com este documento. Concilie o cadastro existente.';END IF;
    SELECT id INTO org FROM public.vertice_internship_organizations WHERE institution_id=inst AND regexp_replace(identifier,'[^0-9]','','g')=identifier_value;
    IF org IS NOT NULL AND EXISTS(SELECT 1 FROM public.vertice_internship_organizations WHERE id=org AND status<>'active') THEN RAISE EXCEPTION 'Concedente existente bloqueada ou inativa; revise no módulo de estágio';END IF;
    SELECT count(*) INTO n FROM public.vertice_extension_partners WHERE institution_id=inst AND regexp_replace(cnpj_cpf,'[^0-9]','','g')=identifier_value;
    IF n>1 THEN RAISE EXCEPTION 'Há parceiros de extensão duplicados. Concilie o cadastro existente.';END IF;
    SELECT id INTO ext FROM public.vertice_extension_partners WHERE institution_id=inst AND regexp_replace(cnpj_cpf,'[^0-9]','','g')=identifier_value;
    IF ext IS NOT NULL AND EXISTS(SELECT 1 FROM public.vertice_extension_partners WHERE id=ext AND NOT active) THEN RAISE EXCEPTION 'Parceiro de extensão existente inativo; revise na origem';END IF;
   END IF;
   IF org IS NULL THEN
    INSERT INTO public.vertice_internship_organizations(institution_id,name,trade_name,identifier,identifier_type,address,city,state,contact_name,contact_email,contact_phone,sector,status)
    VALUES(inst,reg.data->>'name',nullif(reg.data->>'trade_name',''),identifier_value,CASE WHEN length(identifier_value)=11 THEN 'cpf' ELSE 'cnpj' END,
    reg.data->>'address',reg.data->>'city',reg.data->>'state',reg.data->>'contact_name',nullif(reg.data->>'contact_email',''),nullif(reg.data->>'contact_phone',''),reg.data->>'sector','active') RETURNING id INTO org;
   END IF;
   IF ext IS NULL THEN
    INSERT INTO public.vertice_extension_partners(institution_id,name,partner_type,cnpj_cpf,contact_name,contact_email,contact_phone,address,active)
    VALUES(inst,reg.data->>'name',reg.data->>'partner_type',identifier_value,reg.data->>'contact_name',nullif(reg.data->>'contact_email',''),nullif(reg.data->>'contact_phone',''),reg.data->>'address',true) RETURNING id INTO ext;
   END IF;
  ELSE
   UPDATE vertice_conecta.partner_links SET revoked_at=now() WHERE partner_id=reg.id;
  END IF;
  UPDATE vertice_conecta.partner_registrations SET status=CASE WHEN decision='approve' THEN 'approved' ELSE 'rejected' END,organization_id=org,extension_partner_id=ext,
   review_note=note,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now(),version=version+1 WHERE id=reg.id;
  INSERT INTO vertice_conecta.audit(institution_id,actor,action,entity_id,details) VALUES(inst,auth.uid(),'partner.registration.'||decision,reg.id,jsonb_build_object('note',note,'organization_id',org,'extension_partner_id',ext));
  RETURN jsonb_build_object('reviewed',true,'organization_id',org,'extension_partner_id',ext);
 ELSIF action='review_proposal' THEN
  SELECT * INTO proposal FROM vertice_conecta.partner_proposals WHERE id=(p->>'id')::uuid AND institution_id=inst FOR UPDATE;
  IF proposal.id IS NULL OR NOT vertice_conecta.allowed(inst,proposal.course_id) OR (c IS NOT NULL AND c IS DISTINCT FROM proposal.course_id) THEN RAISE EXCEPTION 'Proposta fora do escopo' USING ERRCODE='42501';END IF;
  IF proposal.status<>'pending' THEN RAISE EXCEPTION 'Proposta já revisada. Atualize.' USING ERRCODE='40001';END IF;
  SELECT * INTO reg FROM vertice_conecta.partner_registrations WHERE id=proposal.partner_id AND institution_id=inst;
  IF decision='approve' THEN
   IF reg.status<>'approved' THEN RAISE EXCEPTION 'Valide primeiro o cadastro da organização';END IF;
   IF proposal.kind='campo_estagio' THEN
    IF reg.organization_id IS NULL THEN RAISE EXCEPTION 'Concedente não vinculada';END IF;
    INSERT INTO public.vertice_internship_fields(id,institution_id,organization_id,name,location_type,address,capacity,area_of_practice,status)
    VALUES(proposal.id,inst,reg.organization_id,proposal.title,'external',proposal.data->>'address',nullif(proposal.data->>'capacity','')::int,proposal.data->>'area_of_practice','under_review');
    proposal.field_id:=proposal.id;
   ELSIF proposal.kind='extensao' THEN
    INSERT INTO public.vertice_extension_projects(id,institution_id,title,code,project_type,description,status,review_status,start_date,end_date,course_ids)
    VALUES(proposal.id,inst,proposal.title,'CONECTA-'||left(proposal.id::text,8),'projeto',proposal.data->>'description','planejamento','pendente',nullif(proposal.data->>'start_date','')::date,nullif(proposal.data->>'end_date','')::date,CASE WHEN proposal.course_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[proposal.course_id] END);
    IF reg.extension_partner_id IS NOT NULL THEN INSERT INTO public.vertice_extension_project_partners(project_id,partner_id,role_in_project,contribution) VALUES(proposal.id,reg.extension_partner_id,'parceiro','Proposta recebida pelo Conecta; validação acadêmica pendente');END IF;
    proposal.extension_project_id:=proposal.id;
   ELSE
    INSERT INTO vertice_conecta.opportunities(id,institution_id,course_id,title,employer,kind,description,url,deadline,status)
    VALUES(proposal.id,inst,proposal.course_id,proposal.title,reg.data->>'name',CASE WHEN proposal.kind='acao_institucional' THEN 'evento' ELSE proposal.kind END,proposal.data->>'description',coalesce(proposal.data->>'url',''),nullif(proposal.data->>'deadline','')::date,'publicada');
    proposal.opportunity_id:=proposal.id;
   END IF;
   IF nullif(p->>'goal_id','') IS NOT NULL THEN
    SELECT * INTO v_goal FROM public.vertice_goals WHERE id=(p->>'goal_id')::uuid AND institution_id=inst;
    IF v_goal.id IS NULL OR NOT vertice_conecta.allowed(inst,v_goal.course_id) OR (proposal.course_id IS NOT NULL AND v_goal.course_id IS DISTINCT FROM proposal.course_id) THEN RAISE EXCEPTION 'Meta fora do escopo';END IF;
    IF length(btrim(coalesce(p->>'who','')))<2 OR nullif(p->>'due_date','') IS NULL THEN RAISE EXCEPTION 'Informe responsável e prazo para vincular o 5W2H';END IF;
    INSERT INTO public.vertice_actions(id,institution_id,course_id,goal_id,what,why,who,due_date,how,origin_type,origin_ref,origin_label,created_by)
    VALUES(proposal.id,inst,proposal.course_id,v_goal.id,left('Acompanhar proposta: '||proposal.title,500),note,p->>'who',(p->>'due_date')::date,'Acompanhar execução e registrar evidências no módulo nativo de destino','conecta_partner',proposal.id,'Conecta · parceiros',auth.uid());
    proposal.goal_id:=v_goal.id;proposal.action_id:=proposal.id;
   END IF;
  END IF;
  UPDATE vertice_conecta.partner_proposals SET status=CASE WHEN decision='approve' THEN 'approved' ELSE 'rejected' END,review_note=note,reviewed_by=auth.uid(),reviewed_at=now(),
   opportunity_id=proposal.opportunity_id,field_id=proposal.field_id,extension_project_id=proposal.extension_project_id,goal_id=proposal.goal_id,action_id=proposal.action_id WHERE id=proposal.id;
  INSERT INTO vertice_conecta.audit(institution_id,course_id,actor,action,entity_id,details) VALUES(inst,proposal.course_id,auth.uid(),'partner.proposal.'||decision,proposal.id,jsonb_build_object('note',note,'opportunity_id',proposal.opportunity_id,'field_id',proposal.field_id,'extension_project_id',proposal.extension_project_id,'goal_id',proposal.goal_id,'action_id',proposal.action_id));
  RETURN jsonb_build_object('reviewed',true,'opportunity_id',proposal.opportunity_id,'field_id',proposal.field_id,'extension_project_id',proposal.extension_project_id,'action_id',proposal.action_id);
 ELSE RAISE EXCEPTION 'Operação inválida';END IF;
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.partners_admin(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_conecta.partners_admin(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.vertice_conecta_partners_admin(p_institution uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT vertice_conecta.partners_admin(p_institution,p_action,p_payload)$$;
REVOKE ALL ON FUNCTION public.vertice_conecta_partners_admin(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_partners_admin(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION vertice_conecta.enrich_sapiens() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.scope='superior' THEN
  NEW.context:=NEW.context||jsonb_build_object('conecta',vertice_conecta.metrics(NEW.institution_id,NEW.course_id),
  'conecta_partners',jsonb_build_object('pending_proposals',(SELECT count(*) FROM vertice_conecta.partner_proposals WHERE institution_id=NEW.institution_id AND status='pending' AND (NEW.course_id IS NULL OR course_id=NEW.course_id)),
  'approved_proposals',(SELECT count(*) FROM vertice_conecta.partner_proposals WHERE institution_id=NEW.institution_id AND status='approved' AND (NEW.course_id IS NULL OR course_id=NEW.course_id))),
  'conecta_limitations','Dados agregados de vínculos e propostas acompanhadas. Inserção profissional apenas entre respondentes; não extrapolar ou inferir causalidade. Aprovação de proposta não comprova resultado, contratação, convênio, horas ou aprovação acadêmica.');
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vertice_conecta.enrich_sapiens() FROM PUBLIC,anon,authenticated;
COMMIT;

