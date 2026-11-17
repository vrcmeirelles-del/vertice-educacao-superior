-- Stop if a concurrent release changed the function reviewed for this correction.
DO $guard$
BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.vertice_sapiens_bridge(text,uuid,uuid,uuid,jsonb)'::regprocedure)
  IS DISTINCT FROM 'cdf2bff2a761825e5522f0c509c3f78e' THEN
  RAISE EXCEPTION 'Sapiens RPC changed since privacy review; reconcile before applying';
 END IF;
END;
$guard$;
-- Preserve the existing service-only RPC signature, grants, and invoker security.
-- No interventions are approved, dispatched, deleted or backfilled.
CREATE OR REPLACE FUNCTION public.vertice_sapiens_bridge(p_action text,p_institution uuid,p_id uuid,p_actor uuid,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE i public.vertice_sapiens_interventions; d vertice_private.sapiens_delivery;
 diag public.vertice_sapiens_diagnoses; tokens jsonb; result jsonb; lease uuid; eff text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.vertice_admins WHERE user_id=p_actor) THEN RAISE EXCEPTION 'Master required'; END IF;
 SELECT * INTO i FROM public.vertice_sapiens_interventions WHERE id=p_id AND institution_id=p_institution FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Intervention outside institution'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vertice_courses WHERE id=i.course_id AND institution_id=p_institution) THEN RAISE EXCEPTION 'Course outside institution'; END IF;
 SELECT * INTO diag FROM public.vertice_sapiens_diagnoses WHERE id=i.diagnosis_id AND institution_id=p_institution AND course_id=i.course_id AND module=i.module;
 IF NOT FOUND THEN RAISE EXCEPTION 'Diagnosis outside scope'; END IF;
 SELECT * INTO d FROM vertice_private.sapiens_delivery WHERE intervention_id=p_id FOR UPDATE;
 IF p_action IN ('approve','reject') THEN
  IF i.status<>'proposed' THEN
   IF p_action='approve' AND i.status IN ('approved','sent') AND d.intervention_id IS NOT NULL THEN RETURN jsonb_build_object('status',i.status); END IF;
   IF p_action='reject' AND i.status='rejected' THEN RETURN jsonb_build_object('status','rejected'); END IF;
   RAISE EXCEPTION 'Decision already final';
  END IF;
  IF p_action='approve' THEN
   SELECT coalesce(jsonb_agg(student_token::text ORDER BY student_token),'[]'::jsonb) INTO tokens
    FROM vertice_private.learning_students WHERE institution_id=p_institution AND course_id=i.course_id AND active;
   IF jsonb_array_length(tokens)=0 OR jsonb_array_length(tokens)>5000 THEN RAISE EXCEPTION 'No eligible students or roster exceeds 5000'; END IF;
   result:=jsonb_build_object('contractVersion','v1','institutionId',p_institution,'interventionId',p_id,
    'approvedBy',p_actor,'approvedAt',now(),'scope',jsonb_build_object('courseId',i.course_id,'module',i.module,'competency',i.competency,'studentTokens',tokens),
    'intervention',jsonb_build_object('type',i.intervention_type,'title',i.title,'description',i.description,'suggestedKcIds',to_jsonb(i.suggested_kc_ids),'targetPKnow',i.target_p_know,'deadline',i.deadline),
    'metadata',jsonb_build_object('diagnosisId',i.diagnosis_id,'sapiensCycle',i.sapiens_cycle));
   INSERT INTO vertice_private.sapiens_delivery(intervention_id,institution_id,payload) VALUES(p_id,p_institution,result);
  END IF;
  UPDATE public.vertice_sapiens_interventions SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,
   reviewed_by=p_actor,reviewed_at=now() WHERE id=p_id;
  INSERT INTO public.vertice_sapiens_audit_trail(institution_id,entity_type,entity_id,action,actor_id,actor_type,details)
   VALUES(p_institution,'intervention',p_id,CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,p_actor,'user',jsonb_build_object('courseId',i.course_id,'contractVersion','v1'));
  RETURN jsonb_build_object('status',CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END);
 ELSIF p_action='claim' THEN
  IF i.status='sent' THEN RETURN jsonb_build_object('status','sent'); END IF;
  IF i.status<>'approved' OR d.intervention_id IS NULL THEN RAISE EXCEPTION 'Approved immutable delivery required'; END IF;
  IF d.lease_until>now() THEN RAISE EXCEPTION 'Delivery in progress'; END IF;
  lease:=gen_random_uuid();
  UPDATE vertice_private.sapiens_delivery SET lease_id=lease,lease_until=now()+interval '90 seconds',attempts=attempts+1 WHERE intervention_id=p_id;
  UPDATE public.vertice_sapiens_interventions SET delivery_status='sending',last_delivery_code=NULL WHERE id=p_id;
  RETURN jsonb_build_object('status','sending','leaseId',lease,'payload',d.payload);
 ELSIF p_action IN ('sent','failed') THEN
  IF d.lease_id IS DISTINCT FROM (p_payload->>'leaseId')::uuid THEN RAISE EXCEPTION 'Stale delivery lease'; END IF;
  IF p_action='sent' THEN
   result:=p_payload->'receipt';
   IF result->>'contractVersion' IS DISTINCT FROM 'v1' OR result->>'interventionId' IS DISTINCT FROM p_id::text OR result->>'institutionId' IS DISTINCT FROM p_institution::text
    OR result->>'courseId' IS DISTINCT FROM i.course_id::text OR (result->>'accepted')::boolean IS DISTINCT FROM true
    OR (result->>'registeredStudents')::integer IS DISTINCT FROM jsonb_array_length(d.payload->'scope'->'studentTokens')
    OR NULLIF(result->>'baselineMeasuredAt','') IS NULL THEN RAISE EXCEPTION 'Invalid delivery acknowledgement'; END IF;
   UPDATE vertice_private.sapiens_delivery SET receipt=result,lease_until=NULL,lease_id=NULL WHERE intervention_id=p_id;
   UPDATE public.vertice_sapiens_interventions SET status='sent',delivery_status='sent',sent_to_fo_at=now(),fo_accepted=true,
    fo_registered_students=(result->>'registeredStudents')::integer,last_delivery_code=NULL WHERE id=p_id;
  ELSE
   UPDATE vertice_private.sapiens_delivery SET lease_until=NULL,lease_id=NULL WHERE intervention_id=p_id;
   UPDATE public.vertice_sapiens_interventions SET delivery_status='failed',last_delivery_code=left(p_payload->>'code',60) WHERE id=p_id;
  END IF;
  INSERT INTO public.vertice_sapiens_audit_trail(institution_id,entity_type,entity_id,action,actor_id,actor_type,details)
   VALUES(p_institution,'intervention',p_id,CASE WHEN p_action='sent' THEN 'sent' ELSE 'updated' END,p_actor,'user',jsonb_build_object('delivery',p_action,'attempt',d.attempts,'code',p_payload->>'code'));
  RETURN jsonb_build_object('status',p_action);
 ELSIF p_action='feedback_request' THEN
  IF i.status<>'sent' OR d.receipt IS NULL THEN RAISE EXCEPTION 'Delivery not confirmed'; END IF;
  IF d.measurement_id IS NULL THEN
   UPDATE vertice_private.sapiens_delivery SET measurement_id=gen_random_uuid() WHERE intervention_id=p_id RETURNING * INTO d;
  END IF;
  RETURN jsonb_build_object('contractVersion','v1','institutionId',p_institution,'interventionId',p_id,'measurementId',d.measurement_id,
   'scope',jsonb_build_object('courseId',i.course_id,'module',i.module,'competency',i.competency));
 ELSIF p_action='feedback_save' THEN
  result:=p_payload;
  IF d.measurement_id IS NULL OR result->>'measurementId' IS DISTINCT FROM d.measurement_id::text OR result->>'contractVersion' IS DISTINCT FROM 'v1'
   OR result->>'institutionId' IS DISTINCT FROM p_institution::text OR result->>'courseId' IS DISTINCT FROM i.course_id::text OR result->>'interventionId' IS DISTINCT FROM p_id::text
   OR result->>'module' IS DISTINCT FROM i.module THEN RAISE EXCEPTION 'Feedback outside scope'; END IF;
  -- Defense in depth: enforce privacy even if an older Edge handler forwards raw estimates.
  result:=jsonb_set(result,'{quality,sufficient}',to_jsonb(
   coalesce((result->'quality'->>'sufficient')::boolean,false)
   AND coalesce((result->'baseline'->>'sampleSize')::integer,0)>=5
   AND coalesce((result->'current'->>'sampleSize')::integer,0)>=5
   AND coalesce((result->'delta'->>'sampleOverlap')::integer,0)>=5
   AND coalesce((result->'current'->>'attemptsSinceBaseline')::integer,0)>0
   AND coalesce((result->'quality'->>'counterResets')::integer,-1)=0
   AND (result->'delta'->>'pKnowChange') IS NOT NULL));
  IF coalesce((result->'baseline'->>'sampleSize')::integer,0)<5 THEN
   result:=jsonb_set(jsonb_set(result,'{baseline,avgPKnow}','null'::jsonb),'{baseline,avgEloRating}','null'::jsonb);
  END IF;
  IF coalesce((result->'current'->>'sampleSize')::integer,0)<5 THEN
   result:=jsonb_set(jsonb_set(result,'{current,avgPKnow}','null'::jsonb),'{current,avgEloRating}','null'::jsonb);
  END IF;
  IF (result->'quality'->>'sufficient')::boolean IS DISTINCT FROM true THEN
   result:=jsonb_set(jsonb_set(result,'{delta,pKnowChange}','null'::jsonb),'{delta,eloChange}','null'::jsonb);
  END IF;
  IF (result->'quality'->>'sufficient')::boolean IS DISTINCT FROM true THEN eff:='insufficient_data';
  ELSIF (result->'delta'->>'pKnowChange')::numeric>=0.10 THEN eff:='significant_improvement';
  ELSIF (result->'delta'->>'pKnowChange')::numeric>0 THEN eff:='moderate_improvement';
  ELSIF (result->'delta'->>'pKnowChange')::numeric<0 THEN eff:='regression'; ELSE eff:='no_change'; END IF;
  INSERT INTO public.vertice_sapiens_effectiveness(institution_id,intervention_id,measurement_id,measured_at,current_avg_p_know,current_avg_elo,current_sample_size,
   attempts_since_baseline,p_know_change,elo_change,sample_overlap,effectiveness,detail_snapshot)
  VALUES(p_institution,p_id,d.measurement_id,(result->'current'->>'measuredAt')::timestamptz,(result->'current'->>'avgPKnow')::numeric,
   (result->'current'->>'avgEloRating')::numeric,(result->'current'->>'sampleSize')::integer,(result->'current'->>'attemptsSinceBaseline')::integer,
   (result->'delta'->>'pKnowChange')::numeric,(result->'delta'->>'eloChange')::numeric,(result->'delta'->>'sampleOverlap')::integer,eff,
   jsonb_build_object('baseline',result->'baseline','quality',result->'quality')) ON CONFLICT(intervention_id,measurement_id) DO NOTHING;
  INSERT INTO public.vertice_sapiens_audit_trail(institution_id,entity_type,entity_id,action,actor_id,actor_type,details)
   VALUES(p_institution,'intervention',p_id,'updated',p_actor,'user',jsonb_build_object('measurementId',d.measurement_id,'effectiveness',eff));
  UPDATE vertice_private.sapiens_delivery SET measurement_id=NULL WHERE intervention_id=p_id;
  RETURN jsonb_build_object('status','measured','effectiveness',eff);
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
END;
$$;
