CREATE TABLE IF NOT EXISTS vertice_private.learning_sync_cursors(
 institution_id uuid PRIMARY KEY REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
 after_time timestamptz NOT NULL DEFAULT '2000-01-01T00:00:00Z',
 after_event_id text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE vertice_private.learning_sync_cursors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vertice_private.learning_sync_cursors FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.vertice_bridge_read_cursor(p_institution uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT jsonb_build_object('after',coalesce((SELECT after_time FROM vertice_private.learning_sync_cursors
 WHERE institution_id=p_institution),'2000-01-01T00:00:00Z'::timestamptz),
 'afterId',coalesce((SELECT after_event_id FROM vertice_private.learning_sync_cursors
 WHERE institution_id=p_institution),''));
$fn$;

CREATE OR REPLACE FUNCTION public.vertice_bridge_commit_cursor(p_institution uuid,p_after timestamptz,p_after_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF p_after IS NULL OR p_after_id IS NULL OR length(p_after_id)>200 THEN
  RAISE EXCEPTION 'Invalid bridge cursor'; END IF;
 INSERT INTO vertice_private.learning_sync_cursors(institution_id,after_time,after_event_id)
 VALUES(p_institution,p_after,p_after_id)
 ON CONFLICT(institution_id) DO UPDATE SET
  after_time=CASE WHEN (excluded.after_time,excluded.after_event_id)>
                    (learning_sync_cursors.after_time,learning_sync_cursors.after_event_id)
   THEN excluded.after_time ELSE learning_sync_cursors.after_time END,
  after_event_id=CASE WHEN (excluded.after_time,excluded.after_event_id)>
                    (learning_sync_cursors.after_time,learning_sync_cursors.after_event_id)
   THEN excluded.after_event_id ELSE learning_sync_cursors.after_event_id END,
  updated_at=now();
 RETURN jsonb_build_object('saved',true);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.vertice_bridge_reset_cursor(p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 INSERT INTO vertice_private.learning_sync_cursors(institution_id,after_time,after_event_id)
 VALUES(p_institution,'2000-01-01T00:00:00Z','')
 ON CONFLICT(institution_id) DO UPDATE SET after_time='2000-01-01T00:00:00Z',
  after_event_id='',updated_at=now();
 RETURN jsonb_build_object('reset',true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.vertice_bridge_read_cursor(uuid),
 public.vertice_bridge_commit_cursor(uuid,timestamptz,text),
 public.vertice_bridge_reset_cursor(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vertice_bridge_read_cursor(uuid),
 public.vertice_bridge_commit_cursor(uuid,timestamptz,text),
 public.vertice_bridge_reset_cursor(uuid) TO service_role;
