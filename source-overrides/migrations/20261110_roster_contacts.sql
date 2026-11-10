-- Add email and phone columns to roster entries for notification campaigns
ALTER TABLE vertice_roster_entries ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE vertice_roster_entries ADD COLUMN IF NOT EXISTS telefone text NOT NULL DEFAULT '';
ALTER TABLE vertice_roster_entries ADD COLUMN IF NOT EXISTS periodo text NOT NULL DEFAULT '';
