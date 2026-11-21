-- The aggregator already supports '*'. Make this explicit, reviewed option usable.
-- No mappings, rosters, events, grants or policies are created by this migration.
ALTER TABLE vertice_private.learning_subject_maps
 DROP CONSTRAINT learning_subject_maps_mapped_competency_check;
ALTER TABLE vertice_private.learning_subject_maps
 ADD CONSTRAINT learning_subject_maps_mapped_competency_check
 CHECK (mapped_competency='*' OR length(mapped_competency) BETWEEN 3 AND 500);

-- Preserve the installed function's segment validation, security settings and ACL.
DO $migration$
DECLARE definition text; changed text;
BEGIN
 SELECT pg_get_functiondef('public.vertice_bridge_map_subject(uuid,uuid,text,text,text,text,uuid)'::regprocedure)
 INTO definition;
 changed:=replace(definition,'length(btrim(p_competency))<3',
  '(btrim(p_competency)<>''*'' AND length(btrim(p_competency))<3)');
 IF changed=definition THEN RAISE EXCEPTION 'Unexpected mapping validator; migration aborted'; END IF;
 EXECUTE changed;
END
$migration$;
