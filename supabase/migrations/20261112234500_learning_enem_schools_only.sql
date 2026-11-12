-- ENEM is restricted to schools; higher-education modules remain separate.
ALTER TABLE vertice_private.learning_events DROP CONSTRAINT learning_events_module_check;
ALTER TABLE vertice_private.learning_events ADD CONSTRAINT learning_events_module_check CHECK (module IN ('oab','cfc','enade','enamed','residencia','enem','delegado','pf','estadual','federal','defensoria','mp'));
ALTER TABLE vertice_private.learning_subject_maps DROP CONSTRAINT learning_subject_maps_external_module_check;
ALTER TABLE vertice_private.learning_subject_maps ADD CONSTRAINT learning_subject_maps_external_module_check CHECK (external_module IN ('oab','cfc','enade','enamed','residencia','enem','delegado','pf','estadual','federal','defensoria','mp'));
ALTER TABLE public.vertice_learning_course_metrics DROP CONSTRAINT vertice_learning_course_metrics_module_check;
ALTER TABLE public.vertice_learning_course_metrics ADD CONSTRAINT vertice_learning_course_metrics_module_check CHECK (module IN ('oab','cfc','enade','enamed','residencia','enem','delegado','pf','estadual','federal','defensoria','mp'));

-- Preserve installed function bodies, grants and security settings; extend only their module allowlists.
DO $migration$
DECLARE fn record; definition text; changed text; matched integer:=0;
BEGIN
 FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('vertice_bridge_ingest_events','vertice_bridge_map_subject') AND p.prokind='f'
 LOOP
  definition:=pg_get_functiondef(fn.oid);
  changed:=replace(definition,$old$'oab','cfc','enade','enamed','residencia','delegado','pf','estadual','federal','defensoria','mp'$old$,$new$'oab','cfc','enade','enamed','residencia','enem','delegado','pf','estadual','federal','defensoria','mp'$new$);
  IF changed=definition AND position($new$'oab','cfc','enade','enamed','residencia','enem','delegado','pf','estadual','federal','defensoria','mp'$new$ IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected bridge module validation; migration aborted';
  END IF;
  IF changed<>definition THEN EXECUTE changed; END IF;
  matched:=matched+1;
 END LOOP;
 IF matched<>2 THEN RAISE EXCEPTION 'Expected two bridge validators, found %',matched; END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION vertice_private.learning_require_segment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $guard$
DECLARE module_value text; tier_value text;
BEGIN
 module_value:=to_jsonb(NEW)->>TG_ARGV[0];
 SELECT tier INTO tier_value FROM public.vertice_institutions WHERE id=NEW.institution_id;
 IF tier_value IS NULL OR tier_value NOT IN ('superior','escolas')
    OR ((module_value='enem') IS DISTINCT FROM (tier_value='escolas')) THEN
  RAISE EXCEPTION 'Learning module/institution segment mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION vertice_private.learning_require_segment() FROM PUBLIC;
CREATE TRIGGER learning_events_segment_guard BEFORE INSERT OR UPDATE ON vertice_private.learning_events
 FOR EACH ROW EXECUTE FUNCTION vertice_private.learning_require_segment('module');
CREATE TRIGGER learning_subject_maps_segment_guard BEFORE INSERT OR UPDATE ON vertice_private.learning_subject_maps
 FOR EACH ROW EXECUTE FUNCTION vertice_private.learning_require_segment('external_module');
CREATE TRIGGER learning_metrics_segment_guard BEFORE INSERT OR UPDATE ON public.vertice_learning_course_metrics
 FOR EACH ROW EXECUTE FUNCTION vertice_private.learning_require_segment('module');
