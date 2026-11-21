-- Conecta: identity checked without email; reusable 72-hour links, scoped sessions.
BEGIN;
ALTER TABLE public.vertice_student_access_tokens ADD COLUMN access_scope text NOT NULL DEFAULT 'academic' CHECK(access_scope IN ('academic','conecta'));
ALTER TABLE public.vertice_student_access_tokens ADD COLUMN revoked_at timestamptz;
ALTER TABLE public.vertice_student_access_tokens ADD COLUMN last_used_at timestamptz;
ALTER TABLE public.vertice_student_sessions ADD COLUMN access_scope text NOT NULL DEFAULT 'academic' CHECK(access_scope IN ('academic','conecta'));
CREATE INDEX conecta_access_tokens_valid ON public.vertice_student_access_tokens(student_id,expires_at) WHERE access_scope='conecta' AND revoked_at IS NULL;
CREATE TABLE vertice_conecta.rate_limits(
 key_hash text PRIMARY KEY CHECK(key_hash ~ '^[0-9a-f]{64}$'),window_start timestamptz NOT NULL DEFAULT now(),hits integer NOT NULL DEFAULT 1
);
ALTER TABLE vertice_conecta.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_conecta.rate_limits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON vertice_conecta.rate_limits TO service_role;
CREATE FUNCTION public.vertice_conecta_rate_limit(p_key text,p_limit integer,p_seconds integer DEFAULT 900) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;BEGIN
 IF p_limit NOT BETWEEN 1 AND 1000 OR p_seconds NOT BETWEEN 60 AND 86400 THEN RAISE EXCEPTION 'Invalid limiter';END IF;
 INSERT INTO vertice_conecta.rate_limits(key_hash) VALUES(p_key)
 ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN rate_limits.window_start<now()-make_interval(secs=>p_seconds) THEN 1 ELSE rate_limits.hits+1 END,
 window_start=CASE WHEN rate_limits.window_start<now()-make_interval(secs=>p_seconds) THEN now() ELSE rate_limits.window_start END RETURNING hits INTO n;
 RETURN n<=p_limit;
END $$;
REVOKE ALL ON FUNCTION public.vertice_conecta_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_rate_limit(text,integer,integer) TO service_role;
CREATE FUNCTION public.vertice_conecta_access(p_action text,p_institution uuid,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE st public.vertice_student_registry;tk public.vertice_student_access_tokens;ss public.vertice_student_sessions;expiration timestamptz;new_id uuid;
BEGIN
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>12000 THEN RETURN jsonb_build_object('ok',false,'error','invalid_request');END IF;
 IF p_action IN ('login','redeem') AND (coalesce(p_payload->>'session_hash','') !~ '^[0-9a-f]{64}$') THEN RETURN jsonb_build_object('ok',false,'error','invalid_request');END IF;
 IF p_action='login' THEN
  IF coalesce(p_payload->>'token_hash','') !~ '^[0-9a-f]{64}$' OR coalesce(p_payload->>'cpf_hash','') !~ '^[0-9a-f]{64}$' OR length(coalesce(p_payload->>'enrollment','')) NOT BETWEEN 1 AND 40 THEN RETURN jsonb_build_object('ok',false,'error','invalid_credentials');END IF;
  SELECT * INTO st FROM public.vertice_student_registry WHERE institution_id=p_institution AND enrollment_code=p_payload->>'enrollment' AND cpf_hash=p_payload->>'cpf_hash' AND academic_status IN ('active','graduated');
  IF (SELECT count(*) FROM public.vertice_student_registry WHERE institution_id=p_institution AND enrollment_code=p_payload->>'enrollment' AND cpf_hash=p_payload->>'cpf_hash' AND academic_status IN ('active','graduated'))<>1 THEN RETURN jsonb_build_object('ok',false,'error','invalid_credentials');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=st.institution_id AND tier='superior') THEN RETURN jsonb_build_object('ok',false,'error','invalid_credentials');END IF;
  expiration:=now()+interval '72 hours';
  INSERT INTO public.vertice_student_access_tokens(institution_id,student_id,token_hash,purpose,expires_at,access_scope)
  VALUES(st.institution_id,st.id,p_payload->>'token_hash','session',expiration,'conecta') RETURNING * INTO tk;
 ELSIF p_action='redeem' THEN
  SELECT * INTO tk FROM public.vertice_student_access_tokens WHERE token_hash=p_payload->>'token_hash' AND institution_id=p_institution
   AND access_scope='conecta' AND purpose='session' AND expires_at>now() AND revoked_at IS NULL FOR UPDATE;
  IF tk.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','link_invalid');END IF;
  SELECT * INTO st FROM public.vertice_student_registry WHERE id=tk.student_id AND institution_id=tk.institution_id AND academic_status IN ('active','graduated');
  IF st.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','link_invalid');END IF;
  expiration:=tk.expires_at;
  UPDATE public.vertice_student_access_tokens SET last_used_at=now() WHERE id=tk.id;
 ELSIF p_action='logout' THEN
  SELECT * INTO ss FROM public.vertice_student_sessions WHERE session_key_hash=p_payload->>'session_hash' AND institution_id=p_institution AND access_scope='conecta' AND revoked_at IS NULL AND expires_at>now();
  IF ss.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','session_invalid');END IF;
  UPDATE public.vertice_student_access_tokens SET revoked_at=now() WHERE id=ss.token_id AND access_scope='conecta';
  UPDATE public.vertice_student_sessions SET revoked_at=now() WHERE token_id=ss.token_id AND access_scope='conecta';
  RETURN jsonb_build_object('ok',true);
 ELSE RETURN jsonb_build_object('ok',false,'error','invalid_action');END IF;
 INSERT INTO public.vertice_student_sessions(institution_id,student_id,token_id,session_key_hash,expires_at,access_scope)
 VALUES(st.institution_id,st.id,tk.id,p_payload->>'session_hash',expiration,'conecta') RETURNING id INTO new_id;
 RETURN jsonb_build_object('ok',true,'expires_at',expiration,'student',jsonb_build_object('id',st.id,'institution_id',st.institution_id,'course_id',st.course_id,'full_name',st.full_name,'enrollment_code',st.enrollment_code));
END $$;
REVOKE ALL ON FUNCTION public.vertice_conecta_access(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_access(text,uuid,jsonb) TO service_role;
-- A Conecta session cannot be used to access academic submissions and vice versa.
CREATE OR REPLACE FUNCTION public.vertice_conecta_student(p_session_hash text,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.vertice_student_registry;t vertice_conecta.tracks;BEGIN
 SELECT r.* INTO s FROM public.vertice_student_sessions x JOIN public.vertice_student_registry r ON r.id=x.student_id AND r.institution_id=x.institution_id
 WHERE x.session_key_hash=p_session_hash AND x.access_scope='conecta' AND x.expires_at>now() AND x.revoked_at IS NULL AND r.academic_status IN ('active','graduated');
 IF s.id IS NULL THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_institutions WHERE id=s.institution_id AND tier='superior') THEN RAISE EXCEPTION 'Instituição incompatível';END IF;
 IF p_action IS NULL OR p_action NOT IN ('detail','save_profile','preference','application','evidence') OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>50000 THEN RAISE EXCEPTION 'Solicitação inválida';END IF;
 INSERT INTO vertice_conecta.tracks(institution_id,course_id,student_id,data,source) VALUES(s.institution_id,s.course_id,s.id,jsonb_build_object('stage',CASE WHEN s.academic_status='graduated' THEN 'egresso' ELSE 'estudante' END,'employment','desconhecido'),'portal') ON CONFLICT(student_id) DO NOTHING;
 SELECT * INTO t FROM vertice_conecta.tracks WHERE student_id=s.id AND institution_id=s.institution_id FOR UPDATE;
 IF t.id IS NULL OR t.course_id IS DISTINCT FROM s.course_id THEN RAISE EXCEPTION 'Vínculo em revisão institucional';END IF;
 IF p_action='detail' THEN RETURN vertice_conecta.detail(t.id);END IF;
 RETURN vertice_conecta.mutate_track(t.id,p_action,p_payload,true);
END $$;
REVOKE ALL ON FUNCTION public.vertice_conecta_student(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_conecta_student(text,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION vertice_conecta.validate_profile(d jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE k text;allowed_keys text[]:=ARRAY['stage','headline','linkedin','lattes','interests','skills','strengths','weaknesses','opportunities','threats','objective','deadline','employment','in_field','contact_email','contact_phone'];r jsonb:='{}';BEGIN
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
 IF coalesce(r->>'contact_email','')<>'' AND (length(r->>'contact_email')>254 OR r->>'contact_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'E-mail de contato inválido';END IF;
 IF coalesce(r->>'contact_phone','')<>'' AND length(regexp_replace(r->>'contact_phone','[^0-9]','','g')) NOT BETWEEN 10 AND 15 THEN RAISE EXCEPTION 'Telefone inválido';END IF;
 RETURN r;
END $$;
COMMIT;

