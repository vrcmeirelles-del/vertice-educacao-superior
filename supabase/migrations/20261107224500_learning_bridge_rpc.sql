-- RPCs for the trusted Edge Function only. No public/anon/authenticated execution.
-- Token HMAC creation happens in the Edge Function using a secret held outside the DB.
ALTER TABLE vertice_private.learning_events
  ADD COLUMN IF NOT EXISTS academic_semester text
    CHECK(academic_semester IS NULL OR academic_semester ~ '^20[0-9]{2}/[12]$');

CREATE TABLE IF NOT EXISTS vertice_private.learning_semester_windows (
  institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  academic_semester text NOT NULL CHECK(academic_semester ~ '^20[0-9]{2}/[12]$'),
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK(ends_on >= starts_on),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 3 AND 500),
  PRIMARY KEY(institution_id,course_id,academic_semester),
  FOREIGN KEY(course_id,institution_id) REFERENCES public.vertice_courses(id,institution_id)
);
ALTER TABLE vertice_private.learning_semester_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_private.learning_semester_windows FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.vertice_bridge_accept_roster(p_institution uuid,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  rec jsonb; v_token text; v_course uuid; v_ref text; v_source text;
  inserted_count integer:=0;
BEGIN
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>200
    OR jsonb_array_length(p_rows)<1 THEN
    RAISE EXCEPTION 'Invalid roster batch size';
  END IF;
  FOR rec IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_token:=rec->>'studentToken';
    IF v_token IS NULL OR v_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid token'; END IF;
    v_course:=(rec->>'courseId')::uuid;
    v_ref:=NULLIF(btrim(rec->>'enrollmentRef'),'');
    v_source:=NULLIF(btrim(rec->>'sourceLabel'),'');
    IF v_ref IS NULL OR v_source IS NULL OR length(v_ref)>120 OR length(v_source)>200
      THEN RAISE EXCEPTION 'Missing verified roster provenance'; END IF;
    INSERT INTO vertice_private.learning_students
      (institution_id,student_token,course_id,enrollment_ref,source_label,source_checked_at,active)
    VALUES(p_institution,v_token,v_course,v_ref,v_source,now(),TRUE)
    ON CONFLICT(institution_id,student_token,course_id) DO UPDATE
    SET enrollment_ref=excluded.enrollment_ref,source_label=excluded.source_label,
      source_checked_at=excluded.source_checked_at,active=TRUE,verified_at=now();
    inserted_count:=inserted_count+1;
  END LOOP;
  RETURN jsonb_build_object('accepted',inserted_count);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.vertice_bridge_candidates(p_institution uuid,p_tokens jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
  IF jsonb_typeof(p_tokens)<>'array' OR jsonb_array_length(p_tokens)>5000
    THEN RAISE EXCEPTION 'Invalid candidate batch'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('studentToken',candidate.student_token,
                                               'courseId',candidate.course_id)), '[]'::jsonb)
  INTO result FROM (
    SELECT l.student_token,min(l.course_id::text)::uuid AS course_id
    FROM vertice_private.learning_students l
    WHERE l.institution_id=p_institution AND l.active
      AND l.student_token IN (SELECT value #>> '{}' FROM jsonb_array_elements(p_tokens))
    GROUP BY l.student_token
    HAVING count(DISTINCT l.course_id)=1
    LIMIT 5000
  ) candidate;
  RETURN result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.vertice_bridge_accept_windows(p_institution uuid,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE rec jsonb; v_course uuid; v_period text; v_start date; v_end date; v_ref text; n integer:=0;
BEGIN
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)<1 OR jsonb_array_length(p_rows)>200
    THEN RAISE EXCEPTION 'Invalid academic calendar batch'; END IF;
  FOR rec IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_course:=(rec->>'courseId')::uuid;
    v_period:=rec->>'semester';v_start:=(rec->>'startsOn')::date;v_end:=(rec->>'endsOn')::date;
    v_ref:=NULLIF(btrim(rec->>'sourceRef'),'');
    IF v_period !~ '^20[0-9]{2}/[12]$' OR v_start>v_end OR v_ref IS NULL
      THEN RAISE EXCEPTION 'Unverified calendar'; END IF;
    IF EXISTS (
      SELECT 1 FROM vertice_private.learning_semester_windows s
      WHERE s.institution_id=p_institution AND s.course_id=v_course
        AND s.academic_semester<>v_period
        AND daterange(s.starts_on,s.ends_on,'[]') && daterange(v_start,v_end,'[]')
    ) THEN RAISE EXCEPTION 'Overlapping academic windows'; END IF;
    INSERT INTO vertice_private.learning_semester_windows
      (institution_id,course_id,academic_semester,starts_on,ends_on,source_ref)
    VALUES(p_institution,v_course,v_period,v_start,v_end,v_ref)
    ON CONFLICT(institution_id,course_id,academic_semester) DO UPDATE
      SET starts_on=excluded.starts_on,ends_on=excluded.ends_on,source_ref=excluded.source_ref;
    n:=n+1;
  END LOOP;
  RETURN jsonb_build_object('accepted',n);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.vertice_bridge_ingest_events(p_institution uuid,p_events jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  rec jsonb; v_token text; v_course uuid; v_module text; v_event text; v_item text;
  v_time timestamptz; v_sem text; v_graded boolean; v_correct boolean;
  v_confidence integer; v_subject text; v_competency text;
  accepted integer:=0; ignored integer:=0;
BEGIN
  IF jsonb_typeof(p_events)<>'array' OR jsonb_array_length(p_events)>500
    THEN RAISE EXCEPTION 'Invalid event batch'; END IF;
  FOR rec IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    v_token:=rec->>'studentToken';v_course:=(rec->>'courseId')::uuid;
    v_module:=rec->>'module';v_event:=rec->>'eventId';v_item:=rec->>'itemId';
    v_time:=(rec->>'occurredAt')::timestamptz;
    v_subject:=nullif(left(btrim(rec->>'subject'),250),'');
    v_competency:=nullif(left(btrim(rec->>'competency'),500),'');
    v_graded:=coalesce((rec->>'graded')::boolean,FALSE);
    v_correct:=(rec->>'correct')::boolean;
    v_confidence:=(rec->>'confidence')::integer;
    IF v_token IS NULL OR v_token !~ '^[a-f0-9]{64}$' OR v_module NOT IN
      ('oab','cfc','enade','delegado','pf','estadual','federal','defensoria','mp')
       OR length(v_event)<5 OR length(v_event)>200 OR length(v_item)<1 OR length(v_item)>200
       OR v_time IS NULL OR v_time>now()+interval '1 day'
       OR (v_graded AND v_correct IS NULL) OR (NOT v_graded AND v_correct IS NOT NULL)
      THEN RAISE EXCEPTION 'Malformed learning event'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM vertice_private.learning_students r
      WHERE r.institution_id=p_institution AND r.course_id=v_course
        AND r.student_token=v_token AND r.active
    ) THEN
      ignored:=ignored+1;
      CONTINUE;
    END IF;
    SELECT w.academic_semester INTO v_sem FROM vertice_private.learning_semester_windows w
      WHERE w.institution_id=p_institution AND w.course_id=v_course
        AND v_time::date BETWEEN w.starts_on AND w.ends_on
      ORDER BY w.starts_on DESC LIMIT 1;
    INSERT INTO vertice_private.learning_events(
      institution_id,source_event_id,student_token,course_id,module,source_item_id,
      source_subject,source_competency,source_occurred_at,graded,correct,confidence,academic_semester
    ) VALUES(p_institution,v_event,v_token,v_course,v_module,v_item,v_subject,v_competency,
             v_time,v_graded,v_correct,v_confidence,v_sem)
    ON CONFLICT(institution_id,source_event_id) DO NOTHING;
    IF FOUND THEN accepted:=accepted+1; ELSE ignored:=ignored+1; END IF;
    v_sem:=NULL;
  END LOOP;
  RETURN jsonb_build_object('inserted',accepted,'ignored',ignored);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.vertice_bridge_ingest_grades(p_institution uuid,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE rec jsonb; v_token text; v_course uuid; v_sem text; v_subject text;
        v_assessment text; v_name text; v_score numeric; v_max numeric; v_source text; n integer:=0;
BEGIN
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>200 OR jsonb_array_length(p_rows)<1
    THEN RAISE EXCEPTION 'Invalid grade batch'; END IF;
  FOR rec IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_token:=rec->>'studentToken';v_course:=(rec->>'courseId')::uuid;
    v_sem:=rec->>'semester';v_subject:=rec->>'subjectCode';
    v_assessment:=rec->>'assessmentCode';v_name:=rec->>'subjectName';
    v_score:=(rec->>'score')::numeric;v_max:=(rec->>'scoreMax')::numeric;
    v_source:=rec->>'sourceRef';
    IF v_token !~ '^[a-f0-9]{64}$' OR v_sem !~ '^20[0-9]{2}/[12]$'
       OR v_score<0 OR v_max<=0 OR v_score>v_max
       OR length(v_source)<3 OR length(v_name)<3
      THEN RAISE EXCEPTION 'Invalid verified curricular grade'; END IF;
    INSERT INTO vertice_private.learning_curricular_grades(
      institution_id,student_token,course_id,semester,subject_code,assessment_code,
      subject_name,score,score_max,source_ref,assessed_at
    ) VALUES(p_institution,v_token,v_course,v_sem,v_subject,v_assessment,v_name,v_score,v_max,v_source,
             NULLIF(rec->>'assessedAt','')::date)
    ON CONFLICT(institution_id,student_token,course_id,semester,subject_code,assessment_code)
    DO UPDATE SET score=excluded.score,score_max=excluded.score_max,
      subject_name=excluded.subject_name,source_ref=excluded.source_ref,
      assessed_at=excluded.assessed_at,imported_at=now();
    n:=n+1;
  END LOOP;
  RETURN jsonb_build_object('accepted',n);
END;
$fn$;

REVOKE ALL ON FUNCTION public.vertice_bridge_accept_roster(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vertice_bridge_candidates(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vertice_bridge_accept_windows(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vertice_bridge_ingest_events(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vertice_bridge_ingest_grades(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_bridge_accept_roster(uuid,jsonb),
  public.vertice_bridge_candidates(uuid,jsonb),
  public.vertice_bridge_accept_windows(uuid,jsonb),
  public.vertice_bridge_ingest_events(uuid,jsonb),
  public.vertice_bridge_ingest_grades(uuid,jsonb) TO service_role;
