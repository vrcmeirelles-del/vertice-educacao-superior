BEGIN;
DO $$ DECLARE manager uuid; inst uuid; j jsonb; r jsonb; BEGIN
 SELECT user_id INTO manager FROM public.vertice_admins LIMIT 1;
 SELECT institution_id INTO inst FROM vertice_app.strategic_plans WHERE status<>'archived' LIMIT 1;
 IF manager IS NULL OR inst IS NULL THEN RAISE EXCEPTION 'Fixtures required'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',manager,'aal','aal2','role','authenticated')::text,true);
 j:=public.vertice_sapiens_planning(inst,'start','{}');
 IF j->'context'->'courses' IS NULL THEN RAISE EXCEPTION 'Context absent'; END IF;
 BEGIN PERFORM public.vertice_sapiens_planning(inst,'start','{}'); RAISE EXCEPTION 'Concurrency guard failed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Já existe%' THEN RAISE; END IF; END;
 UPDATE public.vertice_sapiens_planning_analyses SET status='pending_review' WHERE id=(j->>'id')::uuid;
 r:=public.vertice_sapiens_planning(inst,'review',jsonb_build_object('id',j->>'id','status','reviewed','note','Teste transacional de revisão'));
 IF r->>'status'<>'reviewed' THEN RAISE EXCEPTION 'Review absent'; END IF;
 PERFORM set_config('request.jwt.claims','{}',true);
 BEGIN PERFORM public.vertice_sapiens_planning(inst,'list','{}'); RAISE EXCEPTION 'Anonymous accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
