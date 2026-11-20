-- Vértice Avalia 360° — bucket de imagens em HOMOLOGAÇÃO, não aplicado.
-- Depende da instalação e migrações oficiais do Supabase Storage.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('avalia360-private','avalia360-private',false,10485760,
  ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
-- Não conceder políticas genéricas para anon/authenticated em storage.objects.
-- A Edge Function emitirá URL assinada apenas após autorização de IES/curso/
-- disciplina e registro de ticket validado por RPC; não expor bucket em público.
-- Confirmar as permissões reais e as regras de expiração no staging Supabase.
COMMIT;
