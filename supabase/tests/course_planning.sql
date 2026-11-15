-- Run as an administrative test transaction; all synthetic content rolls back.
BEGIN;
SELECT set_config('request.jwt.claims',(
 SELECT jsonb_build_object('sub',user_id,'aal','aal2','role','authenticated')::text FROM public.vertice_admins LIMIT 1
),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; a jsonb; b jsonb; saved_id uuid; snapshot text;
BEGIN
 SELECT * INTO c FROM public.vertice_courses LIMIT 1;
 IF c.id IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Test requires one course and one existing Master'; END IF;
 a:=public.vertice_course_planning(c.institution_id,c.id,'strategic','save','{"vision_text":"Synthetic transaction test"}');
 saved_id:=(a->'plan'->>'id')::uuid;
 b:=public.vertice_course_planning(c.institution_id,c.id,'strategic','publish',jsonb_build_object('id',saved_id,'expected_updated_at',a->'plan'->>'updated_at'));
 IF b->'plan'->>'status'<>'published' THEN RAISE EXCEPTION 'Publication failed'; END IF;
 snapshot:=b->'plan'->>'vision_text';
 a:=public.vertice_course_planning(c.institution_id,c.id,'strategic','save',jsonb_build_object('id',saved_id,'expected_updated_at',b->'plan'->>'updated_at','coordinator_name','Synthetic coordinator'));
 IF a->'plan'->>'id'=saved_id::text OR a->'plan'->>'vision_text'<>snapshot OR (a->'plan'->>'version')::int<>(b->'plan'->>'version')::int+1 THEN RAISE EXCEPTION 'Published history was not preserved'; END IF;
 BEGIN
  PERFORM public.vertice_course_planning(c.institution_id,c.id,'strategic','save',jsonb_build_object('id',a->'plan'->>'id','expected_updated_at','2000-01-01T00:00:00Z'));
  RAISE EXCEPTION 'Stale update accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 a:=public.vertice_course_planning(c.institution_id,c.id,'semester','save','{"semester":"2026/2","activities":[{"month":"Novembro","event":"Synthetic activity"}]}');
 IF a->'plan'->>'semester'<>'2026/2' OR a->'plan' ? 'form_code' THEN RAISE EXCEPTION 'Semester result is invalid'; END IF;
 BEGIN
  PERFORM public.vertice_course_planning(c.institution_id,c.id,'semester','save','{"semester":"2026/2","activities":"invalid"}');
  RAISE EXCEPTION 'Malformed activity list accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
  PERFORM public.vertice_course_planning(gen_random_uuid(),c.id,'strategic','list');
  RAISE EXCEPTION 'Cross-institution course accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'aal','aal1','role','authenticated')::text,true);
 BEGIN
  PERFORM public.vertice_course_planning(c.institution_id,c.id,'strategic','list');
  RAISE EXCEPTION 'MFA requirement bypassed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'aal','aal2','role','authenticated')::text,true);
 BEGIN
  PERFORM public.vertice_course_planning(c.institution_id,c.id,'strategic','list');
  RAISE EXCEPTION 'Nonmember accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$$;
ROLLBACK;
SELECT 'Planning: save, publish, version, conflict, semester, validation, tenant, MFA and nonmember checks passed; rolled back' AS result;
