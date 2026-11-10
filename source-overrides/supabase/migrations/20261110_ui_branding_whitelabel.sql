-- ============================================================
-- Vértice – White-Label UI Branding
-- Migração: expandir document_branding → ui_branding
-- Executar no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar coluna ui_branding (jsonb) em vertice_institutions
ALTER TABLE vertice_institutions
ADD COLUMN IF NOT EXISTS ui_branding jsonb DEFAULT '{}'::jsonb;

-- 2. Comentário para documentação
COMMENT ON COLUMN vertice_institutions.ui_branding IS
'Configuração visual white-label do painel: cores, logo, favicon, texto do rodapé. Aplicado dinamicamente no login do gestor/equipe.';

-- 3. Copiar cor institucional existente do document_branding como ponto de partida
UPDATE vertice_institutions
SET ui_branding = jsonb_build_object(
  'primary_color',   COALESCE(document_branding->>'color', '#1a56db'),
  'secondary_color',  '#1e293b',
  'accent_color',     '#f59e0b',
  'logo_url',         COALESCE(document_branding->>'logo_url', ''),
  'favicon_url',      '',
  'sidebar_style',    'dark',
  'powered_by',       true
)
WHERE document_branding IS NOT NULL
  AND (ui_branding IS NULL OR ui_branding = '{}'::jsonb);

-- 4. View auxiliar para o front buscar o tema no login
CREATE OR REPLACE VIEW v_institution_theme AS
SELECT
  i.id,
  i.name,
  COALESCE(i.ui_branding->>'primary_color',   '#1a56db') AS primary_color,
  COALESCE(i.ui_branding->>'secondary_color',  '#1e293b') AS secondary_color,
  COALESCE(i.ui_branding->>'accent_color',     '#f59e0b') AS accent_color,
  COALESCE(i.ui_branding->>'logo_url',         '')        AS logo_url,
  COALESCE(i.ui_branding->>'favicon_url',      '')        AS favicon_url,
  COALESCE(i.ui_branding->>'sidebar_style',    'dark')    AS sidebar_style,
  COALESCE((i.ui_branding->>'powered_by')::boolean, true) AS powered_by
FROM vertice_institutions i;

-- 5. RLS: gestor e equipe veem só a própria instituição; master vê tudo
-- (Ajustar conforme a política RLS já existente na tabela)
-- A view herda o RLS da tabela base vertice_institutions.

-- 6. Função RPC para o front buscar tema de forma leve (sem expor a view inteira)
CREATE OR REPLACE FUNCTION get_institution_theme(p_institution_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'primary_color',   COALESCE(ui_branding->>'primary_color',   '#1a56db'),
    'secondary_color', COALESCE(ui_branding->>'secondary_color',  '#1e293b'),
    'accent_color',    COALESCE(ui_branding->>'accent_color',     '#f59e0b'),
    'logo_url',        COALESCE(ui_branding->>'logo_url',         ''),
    'favicon_url',     COALESCE(ui_branding->>'favicon_url',      ''),
    'sidebar_style',   COALESCE(ui_branding->>'sidebar_style',    'dark'),
    'powered_by',      COALESCE((ui_branding->>'powered_by')::boolean, true),
    'institution_name', name
  )
  FROM vertice_institutions
  WHERE id = p_institution_id;
$$;
