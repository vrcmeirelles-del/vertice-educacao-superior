-- Extend the higher-education bridge; ENEM remains excluded.
ALTER TABLE vertice_private.learning_events DROP CONSTRAINT learning_events_module_check;
ALTER TABLE vertice_private.learning_events ADD CONSTRAINT learning_events_module_check CHECK (module IN ('oab','cfc','enade','enamed','residencia','delegado','pf','estadual','federal','defensoria','mp'));
ALTER TABLE vertice_private.learning_subject_maps DROP CONSTRAINT learning_subject_maps_external_module_check;
ALTER TABLE vertice_private.learning_subject_maps ADD CONSTRAINT learning_subject_maps_external_module_check CHECK (external_module IN ('oab','cfc','enade','enamed','residencia','delegado','pf','estadual','federal','defensoria','mp'));
ALTER TABLE public.vertice_learning_course_metrics DROP CONSTRAINT vertice_learning_course_metrics_module_check;
ALTER TABLE public.vertice_learning_course_metrics ADD CONSTRAINT vertice_learning_course_metrics_module_check CHECK (module IN ('oab','cfc','enade','enamed','residencia','delegado','pf','estadual','federal','defensoria','mp'));

-- Preserve installed function bodies, grants and security settings; extend only their module allowlists.
DO $migration$
DECLARE fn record; definition text; changed text; matched integer:=0;
BEGIN
 FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('vertice_bridge_ingest_events','vertice_bridge_map_subject') AND p.prokind='f'
 LOOP
  definition:=pg_get_functiondef(fn.oid);
  changed:=replace(definition,$old$'oab','cfc','enade','delegado','pf','estadual','federal','defensoria','mp'$old$,$new$'oab','cfc','enade','enamed','residencia','delegado','pf','estadual','federal','defensoria','mp'$new$);
  IF changed=definition AND position($new$'oab','cfc','enade','enamed','residencia','delegado','pf','estadual','federal','defensoria','mp'$new$ IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected bridge module validation; migration aborted';
  END IF;
  IF changed<>definition THEN EXECUTE changed; END IF;
  matched:=matched+1;
 END LOOP;
 IF matched<>2 THEN RAISE EXCEPTION 'Expected two bridge validators, found %',matched; END IF;
END
$migration$;
