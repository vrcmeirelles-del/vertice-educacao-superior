BEGIN;
DO $$ DECLARE school uuid; manager uuid; a jsonb; b jsonb; c jsonb; BEGIN
 SELECT id INTO school FROM public.vertice_institutions WHERE tier='escolas' ORDER BY id LIMIT 1;
 SELECT user_id INTO manager FROM public.vertice_admins ORDER BY user_id LIMIT 1;
 IF school IS NULL OR manager IS NULL THEN RAISE NOTICE 'School/admin fixture unavailable'; RETURN; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',manager,'aal','aal2','role','authenticated')::text,true);
 a:=public.vertice_school_planning(school,'strategic','save','{"data":{"vision_text":"Synthetic transaction test"}}');
 b:=public.vertice_school_planning(school,'strategic','publish',jsonb_build_object('id',a->'plan'->>'id','expected_updated_at',a->'plan'->>'updated_at'));
 c:=public.vertice_school_planning(school,'strategic','save',jsonb_build_object('id',b->'plan'->>'id','expected_updated_at',b->'plan'->>'updated_at','data','{}'::jsonb));
 IF c->'plan'->>'id'=b->'plan'->>'id' OR (c->'plan'->>'version')::int<>(b->'plan'->>'version')::int+1 THEN RAISE EXCEPTION 'Published version was not preserved'; END IF;
 BEGIN
  PERFORM public.vertice_school_planning(school,'strategic','save',jsonb_build_object('id',c->'plan'->>'id','expected_updated_at','2000-01-01T00:00:00Z','data','{}'::jsonb));
  RAISE EXCEPTION 'Stale revision accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
END $$;
ROLLBACK;
