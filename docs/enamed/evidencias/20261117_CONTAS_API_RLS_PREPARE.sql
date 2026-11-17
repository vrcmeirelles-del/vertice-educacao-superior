BEGIN;
CREATE OR REPLACE FUNCTION public.enamed_test_bootstrap(p_token text,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE j vertice_private.enamed_test_bootstrap;f jsonb;a jsonb;v_profile text;v_email text;v_user uuid;v_vault uuid;v_inst uuid;v_course uuid;v_role text;v_master uuid;v_a uuid;v_b uuid;v_ca uuid;v_cx uuid;v_cb uuid;v_secret jsonb;
BEGIN
 SELECT * INTO j FROM vertice_private.enamed_test_bootstrap WHERE id=true FOR UPDATE;
 IF j.cap_hash IS NULL OR j.expires_at<now() OR p_token IS NULL OR length(p_token)<>64
 OR encode(sha256(convert_to(p_token,'UTF8')),'hex')<>j.cap_hash
 THEN RAISE EXCEPTION 'bootstrap_denied' USING ERRCODE='42501'; END IF;
 IF p_action='claim' THEN
  IF j.status NOT IN('pending','failed') OR j.attempts>=3 THEN RAISE EXCEPTION 'bootstrap_not_claimable';END IF;
  UPDATE vertice_private.enamed_test_bootstrap SET status='running',attempts=attempts+1,started_at=now(),last_error=NULL WHERE id=true;
  RETURN jsonb_build_object('fixture',j.fixture,'accounts',j.accounts);
 END IF;
 IF j.status<>'running' THEN RAISE EXCEPTION 'bootstrap_not_running';END IF;
 IF p_action='seed' THEN
  IF j.fixture<>'{}'::jsonb THEN RETURN j.fixture;END IF;
  IF EXISTS(SELECT 1 FROM public.vertice_institutions) THEN RAISE EXCEPTION 'unexpected_institution';END IF;
  INSERT INTO public.vertice_institutions(name,acronym,tier,notes) VALUES('IES SINTÉTICA A — ENAMED HOMOLOGAÇÃO','QA-ENAMED-A','superior','SYNTHETIC ENAMED360_TEST_20261117; not an actual IES') RETURNING id INTO v_a;
  INSERT INTO public.vertice_institutions(name,acronym,tier,notes) VALUES('IES SINTÉTICA B — ENAMED HOMOLOGAÇÃO','QA-ENAMED-B','superior','SYNTHETIC ENAMED360_TEST_20261117; not an actual IES') RETURNING id INTO v_b;
  INSERT INTO public.vertice_courses(institution_id,name,code,degree,modality) VALUES(v_a,'MEDICINA SINTÉTICA A — HOMOLOGAÇÃO','QA-MED-A','bacharelado','presencial') RETURNING id INTO v_ca;
  INSERT INTO public.vertice_courses(institution_id,name,code,degree,modality) VALUES(v_a,'CURSO SINTÉTICO RESTRITO — HOMOLOGAÇÃO','QA-OUTRO-A','bacharelado','presencial') RETURNING id INTO v_cx;
  INSERT INTO public.vertice_courses(institution_id,name,code,degree,modality) VALUES(v_b,'MEDICINA SINTÉTICA B — HOMOLOGAÇÃO','QA-MED-B','bacharelado','presencial') RETURNING id INTO v_cb;
  f:=jsonb_build_object('institutionA',v_a,'institutionB',v_b,'courseA',v_ca,'otherCourseA',v_cx,'courseB',v_cb);
  UPDATE vertice_private.enamed_test_bootstrap SET fixture=f WHERE id=true;RETURN f;
 ELSIF p_action='register' THEN
  v_profile:=p_payload->>'profile';v_email:='enamed.qa.'||v_profile||'.20261117@example.com';v_user:=(p_payload->>'userId')::uuid;
  IF v_profile NOT IN('master','reitoria','direcao','cpa','coordenacao','nde','docente','sem_autorizacao','outra_ies') OR j.accounts ? v_profile THEN RAISE EXCEPTION 'invalid_fixture_profile';END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_user AND email=v_email AND raw_app_meta_data->>'enamed_fixture'='ENAMED360_TEST_20261117') THEN RAISE EXCEPTION 'not_synthetic_auth_user';END IF;
  IF length(p_payload->>'password')<32 THEN RAISE EXCEPTION 'invalid_fixture_password';END IF;
  v_vault:=vault.create_secret(jsonb_build_object('password',p_payload->>'password','totpSecret',NULL)::text,'enamed360_qa_'||v_profile||'_20261117','Synthetic test credentials. Do not export to logs, code or docs.');
  v_inst:=(j.fixture->>'institutionA')::uuid;
  IF v_profile='master' THEN INSERT INTO public.vertice_admins(user_id) VALUES(v_user);
  ELSIF v_profile<>'sem_autorizacao' THEN
   v_role:=CASE v_profile WHEN 'reitoria' THEN 'reitor' WHEN 'direcao' THEN 'diretor_geral' WHEN 'cpa' THEN 'cpa' WHEN 'coordenacao' THEN 'coordenador' WHEN 'nde' THEN 'nde' WHEN 'docente' THEN 'equipe' WHEN 'outra_ies' THEN 'reitor' END;
   IF v_profile='outra_ies' THEN v_inst:=(j.fixture->>'institutionB')::uuid;END IF;
   v_course:=CASE WHEN v_profile IN('coordenacao','nde') THEN (j.fixture->>'courseA')::uuid ELSE NULL END;
   INSERT INTO public.vertice_memberships(user_id,institution_id,role,course_id) VALUES(v_user,v_inst,v_role,v_course);
   IF v_profile IN('coordenacao','nde','docente') THEN
    SELECT (value->>'userId')::uuid INTO v_master FROM jsonb_each(j.accounts) WHERE key='master';
    INSERT INTO public.vertice_learning_staff_scope(institution_id,course_id,subject_code,user_id,granted_by) VALUES(v_inst,(j.fixture->>'courseA')::uuid,'QA-ENAMED-CLINICA',v_user,v_master);
   END IF;
  END IF;
  a:=jsonb_build_object('userId',v_user,'email',v_email,'vaultId',v_vault,'role',coalesce(v_role,CASE WHEN v_profile='master' THEN 'master' ELSE 'none' END),'mfaVerified',false,'aalVerified',false);
  UPDATE vertice_private.enamed_test_bootstrap SET accounts=accounts||jsonb_build_object(v_profile,a) WHERE id=true;RETURN a;
 ELSIF p_action IN('credential','mfa_secret','verified') THEN
  v_profile:=p_payload->>'profile';a:=j.accounts->v_profile;IF a IS NULL THEN RAISE EXCEPTION 'unknown_fixture_profile';END IF;
  SELECT decrypted_secret::jsonb INTO v_secret FROM vault.decrypted_secrets WHERE id=(a->>'vaultId')::uuid;
  IF p_action='credential' THEN RETURN v_secret;END IF;
  IF p_action='mfa_secret' THEN
   IF nullif(v_secret->>'totpSecret','') IS NOT NULL THEN RAISE EXCEPTION 'factor_already_saved';END IF;
   IF length(p_payload->>'totpSecret')<16 THEN RAISE EXCEPTION 'invalid_factor_secret';END IF;
   PERFORM vault.update_secret((a->>'vaultId')::uuid,(v_secret||jsonb_build_object('totpSecret',p_payload->>'totpSecret','factorId',p_payload->>'factorId'))::text);
   RETURN jsonb_build_object('saved',true);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=(a->>'userId')::uuid AND factor_type='totp' AND status='verified')
  OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=(a->>'userId')::uuid AND aal='aal2') THEN RAISE EXCEPTION 'auth_mfa_not_verified';END IF;
  a:=a||jsonb_build_object('mfaVerified',true,'aalVerified',true,'verifiedAt',now(),'observations',p_payload->'observations');
  UPDATE vertice_private.enamed_test_bootstrap SET accounts=accounts||jsonb_build_object(v_profile,a) WHERE id=true;RETURN a-'vaultId';
 ELSIF p_action='finish' THEN
  IF (SELECT count(*) FROM jsonb_each(j.accounts))<>9 OR EXISTS(SELECT 1 FROM jsonb_each(j.accounts) WHERE value->>'mfaVerified'<>'true' OR value->>'aalVerified'<>'true') THEN RAISE EXCEPTION 'fixture_not_complete';END IF;
  UPDATE vertice_private.enamed_test_bootstrap SET status='done',cap_hash=NULL,expires_at=now(),finished_at=now() WHERE id=true;
  RETURN jsonb_build_object('status','done','accountCount',9,'fixture',j.fixture,'accounts',(SELECT jsonb_object_agg(key,value-'vaultId') FROM jsonb_each(j.accounts)));
 ELSIF p_action='failed' THEN
  UPDATE vertice_private.enamed_test_bootstrap SET status='failed',last_error=left(p_payload->>'error',200) WHERE id=true;RETURN jsonb_build_object('status','failed');
 END IF;
 RAISE EXCEPTION 'unknown_bootstrap_action';
END $fn$;
REVOKE ALL ON FUNCTION public.enamed_test_bootstrap(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enamed_test_bootstrap(text,text,jsonb) TO service_role;

DO $rotate$ DECLARE t text;v uuid;BEGIN
 SELECT cap_secret_id INTO v FROM vertice_private.enamed_test_bootstrap WHERE id AND status='done';
 IF v IS NULL THEN RAISE EXCEPTION 'Expected completed synthetic account provisioning';END IF;
 t:=encode(extensions.gen_random_bytes(32),'hex');PERFORM vault.update_secret(v,t);
 UPDATE vertice_private.enamed_test_bootstrap SET status='pending',attempts=0,cap_hash=encode(sha256(convert_to(t,'UTF8')),'hex'),expires_at=now()+interval '45 minutes' WHERE id;
END $rotate$;
COMMIT;
