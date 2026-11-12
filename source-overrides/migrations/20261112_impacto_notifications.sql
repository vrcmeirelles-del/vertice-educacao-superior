-- Notificações in-app para o módulo Impacto
-- Alertas persistentes com leitura/dispensa por usuário

CREATE TABLE IF NOT EXISTS vertice_extension_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,

  -- Destinatário (null = todos da instituição)
  target_user_id uuid,
  target_role text,  -- null, ou role específico do vertice_impacto_roles

  -- Conteúdo
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'info'
    CHECK (category IN ('info','alerta','critico','acao','sucesso')),

  -- Contexto
  source_type text,  -- 'projeto','evidencia','achado','hora','conformidade'
  source_id uuid,    -- ID do objeto relacionado
  action_url text,   -- deep link para a ação (ex: tab do Extensao360)

  -- Estado
  read_by uuid[] DEFAULT '{}',
  dismissed_by uuid[] DEFAULT '{}',

  -- Auditoria
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz  -- null = não expira
);

ALTER TABLE vertice_extension_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read" ON vertice_extension_notifications
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "notifications_insert" ON vertice_extension_notifications
  FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));
CREATE POLICY "notifications_update" ON vertice_extension_notifications
  FOR UPDATE USING (vertice_private.can_read_institution(institution_id));

CREATE INDEX IF NOT EXISTS idx_notifications_inst ON vertice_extension_notifications(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON vertice_extension_notifications(target_user_id);

-- Trigger: gerar notificação quando achado crítico é criado
CREATE OR REPLACE FUNCTION vertice_private.notify_critical_finding()
RETURNS trigger AS $$
BEGIN
  IF NEW.severity = 'critico' THEN
    INSERT INTO vertice_extension_notifications (
      institution_id, title, message, category, source_type, source_id, created_by
    ) VALUES (
      NEW.institution_id,
      '🔴 Achado crítico: ' || NEW.title,
      NEW.description,
      'critico',
      'achado',
      NEW.id,
      NEW.found_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_critical_finding ON vertice_extension_findings;
CREATE TRIGGER trg_notify_critical_finding
  AFTER INSERT ON vertice_extension_findings
  FOR EACH ROW
  EXECUTE FUNCTION vertice_private.notify_critical_finding();

-- Trigger: notificar quando evidência é rejeitada
CREATE OR REPLACE FUNCTION vertice_private.notify_evidence_rejected()
RETURNS trigger AS $$
BEGIN
  IF NEW.validation_status = 'rejeitada' AND (OLD.validation_status IS NULL OR OLD.validation_status != 'rejeitada') THEN
    INSERT INTO vertice_extension_notifications (
      institution_id, title, message, category, source_type, source_id, created_by
    ) VALUES (
      NEW.institution_id,
      '❌ Evidência rejeitada: ' || NEW.title,
      COALESCE(NEW.rejection_reason, 'Sem motivo informado.'),
      'alerta',
      'evidencia',
      NEW.id,
      NEW.validated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_evidence_rejected ON vertice_extension_evidence_registry;
CREATE TRIGGER trg_notify_evidence_rejected
  AFTER UPDATE ON vertice_extension_evidence_registry
  FOR EACH ROW
  EXECUTE FUNCTION vertice_private.notify_evidence_rejected();
