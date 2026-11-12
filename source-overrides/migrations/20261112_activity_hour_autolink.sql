-- Trigger: ao concluir atividade, creditar horas aos participantes presentes
-- Cria lançamentos no livro-razão com estado 'executada'

CREATE OR REPLACE FUNCTION vertice_private.auto_credit_activity_hours()
RETURNS trigger AS $$
BEGIN
  -- Só dispara quando status muda para 'concluida'
  IF NEW.status = 'concluida' AND (OLD.status IS NULL OR OLD.status != 'concluida') THEN
    INSERT INTO vertice_extension_hour_entries (
      institution_id, project_id, student_id, entry_type, minutes,
      description, activity_date, hour_state, activity_id, recorded_by
    )
    SELECT
      p.institution_id,
      NEW.project_id,
      p.student_id,
      'credit',
      COALESCE(p.hours_credited, NEW.duration_minutes),
      'Auto: ' || NEW.title,
      COALESCE(NEW.scheduled_date::text, now()::date::text),
      'executada',
      NEW.id,
      NEW.responsible_id
    FROM vertice_extension_activity_participation p
    WHERE p.activity_id = NEW.id
    AND p.present = true
    -- Evitar duplicatas se trigger rodar mais de uma vez
    AND NOT EXISTS (
      SELECT 1 FROM vertice_extension_hour_entries h
      WHERE h.activity_id = NEW.id AND h.student_id = p.student_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_activity_auto_hours ON vertice_extension_activities;
CREATE TRIGGER trg_activity_auto_hours
  AFTER UPDATE ON vertice_extension_activities
  FOR EACH ROW
  EXECUTE FUNCTION vertice_private.auto_credit_activity_hours();
