
-- Market intelligence: public sightings are separate from institution/commercial analyses.
CREATE SCHEMA IF NOT EXISTS vertice_market;
REVOKE ALL ON SCHEMA vertice_market FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA vertice_market TO authenticated,service_role;
CREATE TABLE vertice_market.operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 course_id uuid REFERENCES public.vertice_courses(id), perspective text NOT NULL CHECK(perspective IN ('institution','commercial')),
 operation_key text NOT NULL CHECK(length(operation_key) BETWEEN 3 AND 160),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object'), revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES auth.users(id), updated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE NULLS NOT DISTINCT(institution_id,course_id,perspective,operation_key)
);
CREATE TABLE vertice_market.history (
 operation_id uuid NOT NULL REFERENCES vertice_market.operations(id), revision integer NOT NULL,
 body jsonb NOT NULL, created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(operation_id,revision)
);
CREATE TABLE vertice_market.action_links (
 operation_id uuid PRIMARY KEY REFERENCES vertice_market.operations(id), revision integer NOT NULL,
 action_id uuid NOT NULL REFERENCES public.vertice_actions(id), created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vertice_market.sightings (
 url text PRIMARY KEY CHECK(url ~ '^https://[^[:space:]]+$'), source text NOT NULL, title text NOT NULL,
 published_on date, discovered_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vertice_market.collection_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 result jsonb, status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','ok','partial','failed'))
);
CREATE INDEX market_operations_scope ON vertice_market.operations(institution_id,course_id,updated_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['operations','history','action_links','sightings','collection_runs'] LOOP
  EXECUTE format('ALTER TABLE vertice_market.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON vertice_market.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON vertice_market.%I TO service_role',t);
 END LOOP;
END $$;
CREATE FUNCTION vertice_market.allowed(i uuid,c uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce((auth.jwt()->>'aal')='aal2',false)
 AND (CASE WHEN p='commercial' THEN vertice_private.is_master()
 ELSE vertice_private.member_role(i) IN ('master','reitor','diretor_geral','diretor_pedagogico','procurador','gestor')
 OR (c IS NOT NULL AND vertice_private.member_role(i) IN ('coordenador','nde') AND EXISTS(
 SELECT 1 FROM public.vertice_learning_staff_scope s WHERE s.institution_id=i AND s.course_id=c AND s.user_id=auth.uid() AND s.active)) END);
$$;
REVOKE ALL ON FUNCTION vertice_market.allowed(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_market.allowed(uuid,uuid,text) TO authenticated;
CREATE POLICY operations_read ON vertice_market.operations FOR SELECT TO authenticated USING(vertice_market.allowed(institution_id,course_id,perspective));

CREATE FUNCTION vertice_market.request(p_institution uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r vertice_market.operations; saved vertice_market.operations; c uuid:=nullif(p_payload->>'course_id','')::uuid;
 per text:=coalesce(p_payload->>'perspective','institution'); b jsonb:=p_payload->'body'; s jsonb; k text; n numeric;
 new_id uuid:=nullif(p_payload->>'id','')::uuid; result jsonb; g uuid; a uuid; v_key text;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce((auth.jwt()->>'aal')='aal2',false) THEN RAISE EXCEPTION 'Login e segundo fator obrigatórios' USING ERRCODE='42501'; END IF;
 IF per NOT IN ('institution','commercial') THEN RAISE EXCEPTION 'Perspectiva inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=p_institution) THEN RAISE EXCEPTION 'Instituição não localizada' USING ERRCODE='42501'; END IF;
 IF c IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=c AND institution_id=p_institution) THEN RAISE EXCEPTION 'Curso não pertence à instituição' USING ERRCODE='42501'; END IF;
 -- Course staff must choose an authorized course, including for list/inbox requests.
 IF NOT coalesce(vertice_market.allowed(p_institution,c,per),false) THEN RAISE EXCEPTION 'Escopo não autorizado' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.updated_at DESC),'[]') INTO result FROM (
   SELECT o.*,l.action_id FROM vertice_market.operations o LEFT JOIN vertice_market.action_links l ON l.operation_id=o.id
   WHERE o.institution_id=p_institution AND o.perspective=per AND (c IS NULL OR o.course_id=c)
   AND coalesce(vertice_market.allowed(o.institution_id,o.course_id,o.perspective),false) ORDER BY o.updated_at DESC LIMIT 500) q;
  RETURN jsonb_build_object('operations',result,'limit',500,'fetched_at',now(),
   'runs',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM vertice_market.collection_runs ORDER BY started_at DESC LIMIT 10) x),'[]'),
   'sightings',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM vertice_market.sightings ORDER BY discovered_at DESC LIMIT 100) x),'[]'));
 END IF;
 IF p_action NOT IN ('save','history','action') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
 IF new_id IS NOT NULL THEN
  SELECT * INTO r FROM vertice_market.operations WHERE id=new_id FOR UPDATE;
  IF r.id IS NULL OR r.institution_id<>p_institution OR r.perspective<>per OR r.course_id IS DISTINCT FROM c THEN RAISE EXCEPTION 'Operação fora do escopo' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_action='history' THEN
  IF r.id IS NULL THEN RAISE EXCEPTION 'Selecione a operação'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY revision DESC),'[]') INTO result FROM vertice_market.history h WHERE operation_id=r.id;
  RETURN jsonb_build_object('history',result);
 END IF;
 IF p_action='save' THEN
  IF b IS NULL OR jsonb_typeof(b)<>'object' OR length(b::text)>64000 THEN RAISE EXCEPTION 'Ficha inválida ou muito extensa'; END IF;
  -- Allowlist prevents hidden approval flags or unrelated fields from entering snapshots.
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(b) x WHERE x NOT IN ('title','buyer','seller','kind','stage','fact_date','region','courses','cnpj','emec','value_brl','students','reference_year','sources','facts','inferences','opportunity','risk','urgency','effort','rationale','owner','next_step','deadline','confidence','exposure','units','monthly_price','scenario_basis')) THEN RAISE EXCEPTION 'Campo não permitido'; END IF;
  IF length(btrim(coalesce(b->>'title','')))<5 OR length(b->>'title')>250 OR length(btrim(coalesce(b->>'facts','')))<10 THEN RAISE EXCEPTION 'Informe título e fatos com evidências'; END IF;
  IF coalesce(b->>'kind','') NOT IN ('acquisition','merger','unification','asset_sale','minority','trend') OR coalesce(b->>'stage','') NOT IN ('rumor','negotiation','announced','signed','regulatory','closed','integration','cancelled','trend') THEN RAISE EXCEPTION 'Tipo ou estágio inválido'; END IF;
  IF coalesce(b->>'confidence','') NOT IN ('unverified','conflicting','secondary','primary') THEN RAISE EXCEPTION 'Confiança inválida'; END IF;
  IF coalesce(b->>'fact_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR (b->>'fact_date')::date>CURRENT_DATE THEN RAISE EXCEPTION 'Informe a data do fato até hoje'; END IF;
  IF jsonb_typeof(b->'sources') IS DISTINCT FROM 'array' OR jsonb_array_length(b->'sources') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Vincule de 1 a 12 fontes'; END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(b->'sources') LOOP
   IF coalesce(s->>'url','') !~ '^https://[^[:space:]]+$' OR length(s->>'url')>2400 OR length(btrim(coalesce(s->>'evidence','')))<10 OR coalesce(s->>'published_on','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(s->>'checked_on','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(s->>'type','') NOT IN ('primary','secondary') THEN RAISE EXCEPTION 'Cada fonte exige HTTPS, datas, tipo e evidência resumida'; END IF;
   IF (s->>'published_on')::date>CURRENT_DATE OR (s->>'checked_on')::date>CURRENT_DATE THEN RAISE EXCEPTION 'Fonte com data futura'; END IF;
  END LOOP;
  IF b->>'stage' IN ('signed','regulatory','closed','integration') AND (b->>'confidence'<>'primary' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'sources') x WHERE x->>'type'='primary')) THEN RAISE EXCEPTION 'Este estágio exige fonte primária conferida'; END IF;
  FOREACH k IN ARRAY ARRAY['opportunity','risk','urgency','effort'] LOOP
   IF b->k IS NOT NULL AND b->k<>'null'::jsonb THEN n:=(b->>k)::numeric; IF n<1 OR n>5 OR n<>trunc(n) THEN RAISE EXCEPTION 'Escalas devem ir de 1 a 5'; END IF; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['value_brl','students','units','monthly_price'] LOOP
   IF b->k IS NOT NULL AND b->k<>'null'::jsonb THEN n:=(b->>k)::numeric; IF n<0 OR n>1000000000000 THEN RAISE EXCEPTION 'Dimensão numérica inválida'; END IF; END IF;
  END LOOP;
  IF (b->>'students') IS NOT NULL AND coalesce(b->>'reference_year','') !~ '^20[0-9]{2}$' THEN RAISE EXCEPTION 'Matrículas exigem ano de referência'; END IF;
  IF b->>'deadline' IS NOT NULL AND b->>'deadline'<>'' THEN PERFORM (b->>'deadline')::date; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(jsonb_build_array(b->'opportunity',b->'risk',b->'urgency',b->'effort')) x WHERE x IS NOT NULL) AND length(btrim(coalesce(b->>'rationale','')))<10 THEN RAISE EXCEPTION 'Justifique as escalas'; END IF;
  IF r.id IS NULL THEN
   v_key:=lower(btrim(p_payload->>'operation_key'));
   IF v_key IS NULL OR length(v_key) NOT BETWEEN 3 AND 160 THEN RAISE EXCEPTION 'Informe chave estável para evitar duplicidade'; END IF;
   INSERT INTO vertice_market.operations(institution_id,course_id,perspective,operation_key,body,created_by,updated_by)
   VALUES(p_institution,c,per,v_key,b,auth.uid(),auth.uid()) RETURNING * INTO saved;
  ELSE
   IF coalesce((p_payload->>'expected_revision')::int,0)<>r.revision THEN RAISE EXCEPTION 'Ficha alterada em outra sessão; recarregue' USING ERRCODE='40001'; END IF;
   IF r.body=b THEN RETURN to_jsonb(r); END IF;
   UPDATE vertice_market.operations SET body=b,revision=revision+1,updated_by=auth.uid(),updated_at=now() WHERE id=r.id RETURNING * INTO saved;
  END IF;
  INSERT INTO vertice_market.history(operation_id,revision,body,created_by) VALUES(saved.id,saved.revision,b,auth.uid());
  RETURN to_jsonb(saved);
 END IF;
 -- Human-triggered action creation is idempotent and never marks completion/validation.
 IF r.id IS NULL OR per<>'institution' OR p_payload->'confirm_human' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Ação institucional exige confirmação humana'; END IF;
 IF r.revision<>coalesce((p_payload->>'expected_revision')::int,0) THEN RAISE EXCEPTION 'Revise a ficha atualizada' USING ERRCODE='40001'; END IF;
 SELECT action_id INTO a FROM vertice_market.action_links WHERE operation_id=r.id;
 IF a IS NOT NULL THEN RETURN jsonb_build_object('action_id',a,'reused',true); END IF;
 g:=nullif(p_payload->>'goal_id','')::uuid;
 IF g IS NULL OR NOT EXISTS(SELECT 1 FROM public.vertice_goals WHERE id=g AND institution_id=p_institution AND course_id IS NOT DISTINCT FROM c) THEN RAISE EXCEPTION 'Vincule uma meta do mesmo escopo'; END IF;
 IF length(btrim(coalesce(p_payload->>'what','')))<5 OR length(p_payload->>'what')>500 OR length(btrim(coalesce(p_payload->>'who','')))<2 OR length(p_payload->>'who')>250 OR coalesce(p_payload->>'due_date','')='' THEN RAISE EXCEPTION 'Informe ação, responsável e prazo'; END IF;
 INSERT INTO public.vertice_actions(institution_id,course_id,goal_id,what,why,who,due_date,how,status,progress,evidence,created_by)
 VALUES(p_institution,c,g,p_payload->>'what',left('Inferência para revisão: '||coalesce(r.body->>'inferences','')||' '||coalesce(r.body->>'rationale',''),2000),p_payload->>'who',(p_payload->>'due_date')::date,left(coalesce(p_payload->>'how',''),4000),'nao_iniciada',0,'Inteligência de Mercado · operação '||r.id::text||' · revisão '||r.revision::text,auth.uid()) RETURNING id INTO a;
 INSERT INTO vertice_market.action_links(operation_id,revision,action_id,created_by) VALUES(r.id,r.revision,a,auth.uid());
 RETURN jsonb_build_object('action_id',a,'reused',false);
END $$;
REVOKE ALL ON FUNCTION vertice_market.request(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_market.request(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.vertice_market_intelligence(p_institution uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT vertice_market.request(p_institution,p_action,p_payload);
$$;
REVOKE ALL ON FUNCTION public.vertice_market_intelligence(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_market_intelligence(uuid,text,jsonb) TO authenticated;
-- Service-only collector gateway. No business operations or approvals are created.
CREATE FUNCTION public.vertice_market_collect(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid; x jsonb;
BEGIN
 IF p_action='start' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('vertice-market-collector',0));
  IF EXISTS(SELECT 1 FROM vertice_market.collection_runs WHERE started_at>now()-interval '15 minutes' AND status='running') THEN RETURN jsonb_build_object('skipped',true); END IF;
  INSERT INTO vertice_market.collection_runs DEFAULT VALUES RETURNING id INTO v_id; RETURN jsonb_build_object('id',v_id);
 ELSIF p_action='finish' THEN
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'items','[]')) LOOP
   INSERT INTO vertice_market.sightings(url,source,title,published_on) VALUES(x->>'url',x->>'source',left(x->>'title',500),nullif(x->>'published_on','')::date)
   ON CONFLICT(url) DO UPDATE SET last_seen_at=now();
  END LOOP;
  UPDATE vertice_market.collection_runs SET completed_at=now(),status=p_payload->>'status',result=p_payload->'result' WHERE id=(p_payload->>'id')::uuid;
  RETURN jsonb_build_object('ok',true);
 END IF;
 RAISE EXCEPTION 'Ação inválida';
END $$;
REVOKE ALL ON FUNCTION public.vertice_market_collect(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_market_collect(text,jsonb) TO service_role;
COMMENT ON SCHEMA vertice_market IS 'Inteligência de mercado: fatos, inferências e revisão humana. Não contém documentos reservados de due diligence.';

-- Scheduled discovery has its own random secret in Vault, never shipped to browsers.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='vertice_market_collector') THEN
  PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'vertice_market_collector','Autorização exclusiva da coleta pública de mercado');
 END IF;
END $$;
CREATE FUNCTION public.vertice_market_collector_token(p_token text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT length(coalesce(p_token,''))=64 AND EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='vertice_market_collector' AND decrypted_secret=p_token);
$$;
REVOKE ALL ON FUNCTION public.vertice_market_collector_token(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_market_collector_token(text) TO service_role;
CREATE FUNCTION public.vertice_market_can_collect() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce((auth.jwt()->>'aal')='aal2',false) AND vertice_private.is_master();
$$;
REVOKE ALL ON FUNCTION public.vertice_market_can_collect() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_market_can_collect() TO authenticated;
CREATE FUNCTION vertice_market.enqueue_collection() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text; request_id bigint;
BEGIN
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='vertice_market_collector';
 IF token IS NULL THEN RAISE EXCEPTION 'Credencial da coleta ausente'; END IF;
 SELECT net.http_post(url:='https://qvetbbmviatxxatzzuzc.supabase.co/functions/v1/vertice-market-collect',headers:=jsonb_build_object('Content-Type','application/json','x-market-token',token),body:='{}'::jsonb,timeout_milliseconds:=120000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION vertice_market.enqueue_collection() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION vertice_market.enqueue_collection() TO service_role;
SELECT cron.schedule('vertice-market-public-discovery-daily','0 6 * * *','select vertice_market.enqueue_collection()');
