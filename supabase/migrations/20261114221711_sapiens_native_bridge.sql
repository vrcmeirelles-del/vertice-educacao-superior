-- PREREQUISITE: source-overrides/migrations/20261115000000_sapiens_core_tables.sql.
-- The legacy core has a future filename. Apply the two explicit files in this order;
-- do not run an indiscriminate db push. No legacy interventions are auto-approved/sent.
ALTER TABLE public.vertice_sapiens_interventions ALTER COLUMN suggested_kc_ids TYPE text[] USING suggested_kc_ids::text[];
ALTER TABLE public.vertice_sapiens_interventions ADD COLUMN delivery_status text NOT NULL DEFAULT 'pending'
 CHECK(delivery_status IN ('pending','sending','sent','failed'));
ALTER TABLE public.vertice_sapiens_interventions ADD COLUMN last_delivery_code text;
CREATE TABLE vertice_private.sapiens_delivery (
 intervention_id uuid PRIMARY KEY REFERENCES public.vertice_sapiens_interventions(id),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 payload jsonb NOT NULL,
 lease_id uuid,
 lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 receipt jsonb,
 measurement_id uuid
);
ALTER TABLE vertice_private.sapiens_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_private.sapiens_delivery FROM PUBLIC,anon,authenticated;
ALTER TABLE public.vertice_sapiens_effectiveness ADD COLUMN measurement_id uuid;
CREATE UNIQUE INDEX sapiens_effectiveness_measurement ON public.vertice_sapiens_effectiveness(intervention_id,measurement_id);
-- Service-only invoker: follows the existing bridge RPC boundary. Authorization is
-- checked in the Edge Function (verified JWT + AAL2 + Master) and again here.
CREATE FUNCTION public.vertice_sapiens_bridge(p_action text,p_institution uuid,p_id uuid,p_actor uuid,p_payload jsonb DEFAULT '{}')
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
REVOKE ALL ON FUNCTION public.vertice_sapiens_bridge(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_sapiens_bridge(text,uuid,uuid,uuid,jsonb) TO service_role;
GRANT USAGE ON SCHEMA vertice_private TO service_role;
GRANT SELECT,INSERT,UPDATE ON vertice_private.sapiens_delivery TO service_role;
GRANT SELECT ON public.vertice_admins,public.vertice_courses,vertice_private.learning_students,public.vertice_sapiens_diagnoses TO service_role;
GRANT SELECT,UPDATE ON public.vertice_sapiens_interventions TO service_role;
GRANT SELECT,INSERT ON public.vertice_sapiens_effectiveness,public.vertice_sapiens_audit_trail TO service_role;
GRANT USAGE ON SEQUENCE public.vertice_sapiens_audit_trail_id_seq TO service_role;
-- Defense in depth: browsers cannot forge decisions or mutate audit/effectiveness.
REVOKE INSERT,UPDATE,DELETE ON public.vertice_sapiens_interventions,public.vertice_sapiens_effectiveness,public.vertice_sapiens_audit_trail FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.vertice_sapiens_can_read(inst uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND auth.jwt()->>'aal'='aal2' AND (
  EXISTS(SELECT 1 FROM public.vertice_admins WHERE user_id=auth.uid()) OR
  EXISTS(SELECT 1 FROM public.vertice_memberships WHERE user_id=auth.uid() AND institution_id=inst
   AND role IN ('gestor','reitor','diretor_geral','diretor_pedagogico','procurador','cpa')))
$$;
REVOKE ALL ON FUNCTION public.vertice_sapiens_can_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vertice_sapiens_can_read(uuid) TO authenticated;
