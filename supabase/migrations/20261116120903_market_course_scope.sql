-- Legacy equipe users require an active, explicit course grant; never institution-wide.
CREATE OR REPLACE FUNCTION vertice_market.allowed(i uuid,c uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce((auth.jwt()->>'aal')='aal2',false)
 AND (CASE WHEN p='commercial' THEN vertice_private.is_master()
 ELSE vertice_private.member_role(i) IN ('master','reitor','diretor_geral','diretor_pedagogico','procurador','gestor')
 OR (c IS NOT NULL AND vertice_private.member_role(i) IN ('coordenador','nde','equipe') AND EXISTS(
 SELECT 1 FROM public.vertice_learning_staff_scope s WHERE s.institution_id=i AND s.course_id=c AND s.user_id=auth.uid() AND s.active)) END);
$$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['history','action_links','sightings','collection_runs'] LOOP
  EXECUTE format('CREATE POLICY market_gateway_only ON vertice_market.%I FOR ALL TO authenticated USING(false) WITH CHECK(false)',t);
 END LOOP;
END $$;
