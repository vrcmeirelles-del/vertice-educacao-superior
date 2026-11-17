-- Isolated ENAMED staging only. Narrow an observed overbroad course read.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vertice_private.enamed_test_bootstrap WHERE id AND status='done')
 OR (SELECT count(*) FROM auth.users)<>9
 OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vertice_courses' AND policyname='vertice_course_read' AND qual='vertice_private.can_read_institution(institution_id)')
 THEN RAISE EXCEPTION 'Unexpected fixture or policy baseline';END IF;
END $guard$;
CREATE FUNCTION vertice_private.can_read_course_scope(target_institution uuid,target_course uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE membership public.vertice_memberships;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RETURN false;END IF;
 IF vertice_private.is_master() THEN RETURN true;END IF;
 SELECT * INTO membership FROM public.vertice_memberships WHERE institution_id=target_institution AND user_id=auth.uid();
 IF membership.user_id IS NULL THEN RETURN false;END IF;
 IF membership.role IN('coordenador','nde') THEN RETURN membership.course_id=target_course;END IF;
 IF membership.role='equipe' THEN
  RETURN EXISTS(SELECT 1 FROM public.vertice_learning_staff_scope s WHERE s.institution_id=target_institution AND s.course_id=target_course AND s.user_id=auth.uid() AND s.active);
 END IF;
 RETURN membership.role IN('reitor','diretor_geral','diretor_pedagogico','procurador','cpa','gestor','leitor');
END $fn$;
REVOKE ALL ON FUNCTION vertice_private.can_read_course_scope(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vertice_private.can_read_course_scope(uuid,uuid) TO authenticated;
ALTER POLICY vertice_course_read ON public.vertice_courses USING(vertice_private.can_read_course_scope(institution_id,id));
-- Rotate only the one-time QA capability, not account passwords or MFA factors.
DO $rotate$ DECLARE t text;v uuid;BEGIN
 SELECT cap_secret_id INTO v FROM vertice_private.enamed_test_bootstrap WHERE id AND status='done';
 t:=encode(extensions.gen_random_bytes(32),'hex');PERFORM vault.update_secret(v,t);
 UPDATE vertice_private.enamed_test_bootstrap SET status='pending',attempts=0,cap_hash=encode(sha256(convert_to(t,'UTF8')),'hex'),expires_at=now()+interval '45 minutes' WHERE id;
END $rotate$;
COMMIT;
-- Reviewed rollback (NOT EXECUTED): ALTER POLICY vertice_course_read ON public.vertice_courses USING(vertice_private.can_read_institution(institution_id));
-- No account, answer, attempt or academic result is deleted.
