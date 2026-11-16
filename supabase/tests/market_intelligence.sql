-- All fixtures and action inserts roll back. No real business row is updated.
BEGIN;
DO $$
DECLARE i uuid;c uuid;g uuid;u uuid;other_user uuid:=gen_random_uuid();other_i uuid;op jsonb;b jsonb;outcome jsonb;cnt int;
BEGIN
 IF has_function_privilege('anon','public.vertice_market_intelligence(uuid,text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.vertice_market_collect(text,jsonb)','EXECUTE') OR has_table_privilege('authenticated','vertice_market.operations','SELECT') THEN RAISE EXCEPTION 'Excessive privileges'; END IF;
 SELECT user_id INTO u FROM public.vertice_admins LIMIT 1;
 SELECT institution_id,course_id,id INTO i,c,g FROM public.vertice_goals WHERE course_id IS NOT NULL LIMIT 1;
 IF u IS NULL OR i IS NULL THEN RAISE EXCEPTION 'Authorized fixtures unavailable'; END IF;
 SELECT id INTO other_i FROM public.vertice_institutions WHERE id<>i LIMIT 1;
 PERFORM set_config('request.jwt.claims','{}',true);
 BEGIN PERFORM public.vertice_market_intelligence(i,'list'); RAISE EXCEPTION 'Unauthenticated allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal1','role','authenticated')::text,true);
 BEGIN PERFORM public.vertice_market_intelligence(i,'list'); RAISE EXCEPTION 'MFA bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal2','role','authenticated')::text,true);
 b:=jsonb_build_object('title','TESTE TRANSACIONAL MERCADO','kind','acquisition','stage','announced','confidence','unverified','fact_date',CURRENT_DATE,'facts','Evidência sintética exclusiva do teste transacional.','sources',jsonb_build_array(jsonb_build_object('url','https://example.org/test','type','secondary','published_on',CURRENT_DATE,'checked_on',CURRENT_DATE,'evidence','Fonte sintética de teste; não é notícia real.')));
 op:=public.vertice_market_intelligence(i,'save',jsonb_build_object('course_id',c,'operation_key','TEST-'||gen_random_uuid()::text,'body',b));
 -- Unknown score remains absent, never replaced with zero.
 IF op->'body' ? 'risk' THEN RAISE EXCEPTION 'Risk fabricated'; END IF;
 outcome:=public.vertice_market_intelligence(i,'save',jsonb_build_object('id',op->>'id','course_id',c,'expected_revision',1,'body',b));
 IF (outcome->>'revision')::int<>1 THEN RAISE EXCEPTION 'Unchanged snapshot duplicated'; END IF;
 BEGIN PERFORM public.vertice_market_intelligence(i,'save',jsonb_build_object('id',op->>'id','course_id',c,'expected_revision',0,'body',b)); RAISE EXCEPTION 'Stale write allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.vertice_market_intelligence(i,'save',jsonb_build_object('id',op->>'id','course_id',c,'expected_revision',1,'body',b||'{"stage":"closed"}'::jsonb)); RAISE EXCEPTION 'Closing without primary evidence allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Closing without primary evidence allowed' THEN RAISE; END IF; END;
 outcome:=public.vertice_market_intelligence(i,'save',jsonb_build_object('id',op->>'id','course_id',c,'expected_revision',1,'body',b||'{"inferences":"Hipótese sintética para teste"}'::jsonb));
 IF (outcome->>'revision')::int<>2 THEN RAISE EXCEPTION 'Revision missing'; END IF;
 SELECT count(*) INTO cnt FROM vertice_market.history WHERE operation_id=(op->>'id')::uuid;
 IF cnt<>2 THEN RAISE EXCEPTION 'History lost'; END IF;
 outcome:=public.vertice_market_intelligence(i,'action',jsonb_build_object('id',op->>'id','course_id',c,'expected_revision',2,'confirm_human',true,'goal_id',g,'what','TESTE TRANSACIONAL DE AÇÃO','who','Equipe sintética','due_date',CURRENT_DATE+10));
 IF NOT EXISTS(SELECT 1 FROM public.vertice_actions WHERE id=(outcome->>'action_id')::uuid AND status='nao_iniciada' AND progress=0 AND validated_by_superior IS NULL) THEN RAISE EXCEPTION 'Automatic approval or wrong initial status'; END IF;
 outcome:=public.vertice_market_intelligence(i,'action',jsonb_build_object('id',op->>'id','course_id',c,'expected_revision',2,'confirm_human',true));
 IF outcome->>'reused'<>'true' THEN RAISE EXCEPTION 'Action duplicated'; END IF;
 -- A course-linked user cannot access commercial material, other institutions or institutional scope.
 INSERT INTO auth.users(id) VALUES(other_user);
 INSERT INTO public.vertice_memberships(institution_id,user_id,role) VALUES(i,other_user,'equipe');
 INSERT INTO public.vertice_learning_staff_scope(institution_id,course_id,user_id,subject_code,granted_by) VALUES(i,c,other_user,'TEST_MARKET',u);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'aal','aal2','role','authenticated')::text,true);
 outcome:=public.vertice_market_intelligence(i,'list',jsonb_build_object('course_id',c));
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(outcome->'operations') x WHERE x->>'id'=op->>'id') THEN RAISE EXCEPTION 'Authorized course missing'; END IF;
 BEGIN PERFORM public.vertice_market_intelligence(i,'list'); RAISE EXCEPTION 'Institutional scope leaked'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.vertice_market_intelligence(i,'list',jsonb_build_object('course_id',c,'perspective','commercial')); RAISE EXCEPTION 'Commercial scope leaked'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.vertice_market_intelligence(other_i,'list'); RAISE EXCEPTION 'Other institution leaked'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF public.vertice_market_can_collect() THEN RAISE EXCEPTION 'Non-master collector allowed'; END IF;
END $$;
ROLLBACK;
