-- Preserve the prior objective association when a manager selects another saved
-- version/objective, or when the draft objective changed since import.
CREATE FUNCTION vertice_planning.capture_competitive_association()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.plan_id IS DISTINCT FROM NEW.plan_id OR OLD.objective_index IS DISTINCT FROM NEW.objective_index
    OR OLD.objective_snapshot IS DISTINCT FROM NEW.objective_snapshot THEN
  INSERT INTO vertice_planning.competitive_events(institution_id,course_id,finding_id,actor_id,event,details)
  VALUES(OLD.institution_id,OLD.course_id,OLD.id,auth.uid(),'objective_relinked',
    jsonb_build_object('previous',jsonb_build_object('plan_id',OLD.plan_id,'objective_index',OLD.objective_index,'objective_snapshot',OLD.objective_snapshot),
                       'current',jsonb_build_object('plan_id',NEW.plan_id,'objective_index',NEW.objective_index,'objective_snapshot',NEW.objective_snapshot)));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vertice_planning.capture_competitive_association() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER competitive_association_history BEFORE UPDATE ON vertice_planning.competitive_findings
 FOR EACH ROW EXECUTE FUNCTION vertice_planning.capture_competitive_association();
