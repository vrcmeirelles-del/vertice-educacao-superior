-- Run transactionally in a test-capable environment. No business rows are changed.
BEGIN;
DO $$ BEGIN
 IF has_function_privilege('anon','public.vertice_planning_management(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous execution must not be granted';
 END IF;
 BEGIN
  PERFORM public.vertice_planning_management('00000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Unauthenticated request unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
 BEGIN
  PERFORM public.vertice_planning_management('00000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Unlinked request unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
