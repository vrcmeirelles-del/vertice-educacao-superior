-- Roster import history for Aprendizagem Conectada
CREATE TABLE IF NOT EXISTS vertice_roster_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id),
  course_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  filename text NOT NULL DEFAULT '',
  total_rows integer NOT NULL DEFAULT 0,
  matched integer NOT NULL DEFAULT 0,
  linked integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE vertice_roster_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roster_imports_institution" ON vertice_roster_imports
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM vertice_users
      WHERE user_id = auth.uid()
      AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
    )
  );

-- Roster entries (individual student records from CSV)
CREATE TABLE IF NOT EXISTS vertice_roster_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES vertice_roster_imports(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  student_name text NOT NULL DEFAULT '',
  cpf_hash text NOT NULL DEFAULT '',
  course_label text NOT NULL DEFAULT '',
  turma text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matched','not_found','error')),
  student_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vertice_roster_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roster_entries_institution" ON vertice_roster_entries
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM vertice_users
      WHERE user_id = auth.uid()
      AND role IN ('master','reitor','gestor','diretor_geral','diretor_pedagogico')
    )
  );

CREATE INDEX IF NOT EXISTS idx_roster_entries_import ON vertice_roster_entries(import_id);
CREATE INDEX IF NOT EXISTS idx_roster_imports_institution ON vertice_roster_imports(institution_id);
