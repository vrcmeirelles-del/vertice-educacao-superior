-- Student notification campaigns for Aprendizagem Conectada
CREATE TABLE IF NOT EXISTS vertice_notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  created_by uuid NOT NULL,
  exam_type text NOT NULL CHECK (exam_type IN ('enade','oab','cfc','geral')),
  channels text[] NOT NULL DEFAULT ARRAY['email'],
  subject text NOT NULL DEFAULT '',
  body_email text NOT NULL DEFAULT '',
  body_whatsapp text NOT NULL DEFAULT '',
  body_sms text NOT NULL DEFAULT '',
  target_filter jsonb NOT NULL DEFAULT '{}',
  -- Stats
  total_recipients integer NOT NULL DEFAULT 0,
  sent_email integer NOT NULL DEFAULT 0,
  sent_whatsapp integer NOT NULL DEFAULT 0,
  sent_sms integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','error')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vertice_notification_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_institution" ON vertice_notification_campaigns
  FOR ALL USING (institution_id IN (
    SELECT institution_id FROM vertice_memberships
    WHERE user_id = auth.uid()
    AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
  ));

-- Individual delivery records
CREATE TABLE IF NOT EXISTS vertice_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES vertice_notification_campaigns(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  student_name text NOT NULL DEFAULT '',
  channel text NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  destination text NOT NULL DEFAULT '',  -- email/phone (masked in UI)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','failed','bounced')),
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vertice_notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_institution" ON vertice_notification_deliveries
  FOR ALL USING (institution_id IN (
    SELECT institution_id FROM vertice_memberships
    WHERE user_id = auth.uid()
    AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
  ));

CREATE INDEX IF NOT EXISTS idx_deliveries_campaign ON vertice_notification_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_institution ON vertice_notification_campaigns(institution_id, created_at DESC);
