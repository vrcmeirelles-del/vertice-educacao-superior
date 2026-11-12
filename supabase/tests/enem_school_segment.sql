BEGIN;
DO $test$
DECLARE school uuid; ies uuid; c uuid:=gen_random_uuid(); token text:=md5(random()::text)||md5(random()::text); event text:='enem:validation-'||gen_random_uuid()::text; payload jsonb; result jsonb;
BEGIN
 SELECT id INTO school FROM public.vertice_institutions WHERE tier='escolas' AND name ILIKE '%Demonstração%' LIMIT 1;
 SELECT id INTO ies FROM public.vertice_institutions WHERE tier='superior' LIMIT 1;
 IF school IS NULL OR ies IS NULL THEN RAISE EXCEPTION 'Validation institutions unavailable'; END IF;
 INSERT INTO public.vertice_courses(id,institution_id,name,code,modality,degree,status)
 VALUES(c,school,'ENEM validation (rolled back)',c::text,'presencial','outro','ativo');
 INSERT INTO vertice_private.learning_students(institution_id,student_token,course_id,enrollment_ref,source_label,source_checked_at)
 VALUES(school,token,c,'fixture','Rollback-only ENEM validation',now());
 payload:=jsonb_build_array(jsonb_build_object('studentToken',token,'courseId',c,'module','enem','eventId',event,'itemId','enem-fixture','occurredAt',now(),'subject','matematica','competency','H1','graded',true,'correct',true,'confidence',3));
 result:=public.vertice_bridge_ingest_events(school,payload);
 IF result->>'inserted'<>'1' THEN RAISE EXCEPTION 'School ENEM ingest failed'; END IF;
 result:=public.vertice_bridge_ingest_events(school,payload);
 IF result->>'inserted'<>'0' OR result->>'ignored'<>'1' THEN RAISE EXCEPTION 'Idempotency validation failed'; END IF;
 BEGIN
  INSERT INTO vertice_private.learning_events(institution_id,source_event_id,student_token,course_id,module,source_item_id,source_occurred_at,graded,correct)
  VALUES(ies,event||'-wrong-tier',token,c,'enem','fixture',now(),true,true);
  RAISE EXCEPTION 'ENEM was accepted for higher education';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM<>'Learning module/institution segment mismatch' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO vertice_private.learning_events(institution_id,source_event_id,student_token,course_id,module,source_item_id,source_occurred_at,graded,correct)
  VALUES(school,event||'-wrong-module',token,c,'oab','fixture',now(),true,true);
  RAISE EXCEPTION 'OAB was accepted for a school';
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM<>'Learning module/institution segment mismatch' THEN RAISE; END IF;
 END;
END
$test$;
ROLLBACK;