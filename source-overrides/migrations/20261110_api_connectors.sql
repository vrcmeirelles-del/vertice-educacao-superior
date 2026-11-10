-- API Connectors for automatic roster sync
CREATE TABLE IF NOT EXISTS vertice_api_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  connector_type text NOT NULL DEFAULT 'rest_api' CHECK (connector_type IN ('rest_api','database_readonly','onedrive_folder','manual_only')),
  label text NOT NULL DEFAULT '',
  -- REST API config
  api_base_url text NOT NULL DEFAULT '',
  api_auth_type text NOT NULL DEFAULT 'bearer' CHECK (api_auth_type IN ('bearer','basic','api_key_header','oauth2_client')),
  api_auth_value text NOT NULL DEFAULT '',  -- encrypted at rest by Supabase
  api_roster_endpoint text NOT NULL DEFAULT '/alunos/matriculados',
  api_roster_method text NOT NULL DEFAULT 'GET',
  api_response_mapping jsonb NOT NULL DEFAULT '{"students":"data","cpf":"cpf","name":"nome","course":"curso","turma":"turma","status":"situacao"}',
  -- Sync config
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_interval_hours integer NOT NULL DEFAULT 24 CHECK (sync_interval_hours >= 1 AND sync_interval_hours <= 168),
  sync_auto_link boolean NOT NULL DEFAULT true,
  sync_filter_status text[] NOT NULL DEFAULT ARRAY['matriculado','ativo','cursando'],
  -- State
  last_sync_at timestamptz,
  last_sync_status text DEFAULT 'never' CHECK (last_sync_status IN ('never','success','error','running')),
  last_sync_message text,
  last_sync_matched integer DEFAULT 0,
  last_sync_linked integer DEFAULT 0,
  last_sync_total integer DEFAULT 0,
  -- Metadata
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vertice_api_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_connectors_institution" ON vertice_api_connectors
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM vertice_users
      WHERE user_id = auth.uid()
      AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
    )
  );

CREATE INDEX IF NOT EXISTS idx_api_connectors_institution ON vertice_api_connectors(institution_id);
CREATE INDEX IF NOT EXISTS idx_api_connectors_sync ON vertice_api_connectors(sync_enabled, last_sync_at) WHERE sync_enabled = true;

-- Sync execution log
CREATE TABLE IF NOT EXISTS vertice_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES vertice_api_connectors(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  total_fetched integer DEFAULT 0,
  matched integer DEFAULT 0,
  linked integer DEFAULT 0,
  skipped integer DEFAULT 0,
  new_students integer DEFAULT 0,
  error_message text
);

ALTER TABLE vertice_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_institution" ON vertice_sync_log
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM vertice_users
      WHERE user_id = auth.uid()
      AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
    )
  );

CREATE INDEX IF NOT EXISTS idx_sync_log_connector ON vertice_sync_log(connector_id, started_at DESC);
