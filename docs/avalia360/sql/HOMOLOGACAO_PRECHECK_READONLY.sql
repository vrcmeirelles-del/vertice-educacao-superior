-- Vértice Avalia 360° — inspeção SOMENTE LEITURA, homologação Supabase.
-- Nenhum resultado desta consulta deve ser interpretado como execução E2E.
WITH dependencies AS (
 SELECT 'cursos_institucionais'::text AS check_name,
        to_regclass('public.vertice_courses') IS NOT NULL AS ready
 UNION ALL SELECT 'lotacao_docente',
        to_regclass('public.vertice_learning_staff_scope') IS NOT NULL
 UNION ALL SELECT 'matriz_curricular',
        to_regclass('vertice_app.curriculum_builds') IS NOT NULL
 UNION ALL SELECT 'autorizacao_institucional',
        to_regprocedure('vertice_private.member_role(uuid)') IS NOT NULL
 UNION ALL SELECT 'rpc_rascunhos',
        to_regprocedure('public.vertice_avalia_draft(uuid,uuid,text,text,jsonb)') IS NOT NULL
 UNION ALL SELECT 'rpc_imagens',
        to_regprocedure('public.vertice_avalia_media(uuid,uuid,text,uuid,text,jsonb)') IS NOT NULL
 UNION ALL SELECT 'rpc_finalizacao_imagens',
        to_regprocedure('public.vertice_avalia_media_finalize(uuid,text,integer,text)') IS NOT NULL
 UNION ALL SELECT 'bucket_privado',
        EXISTS(SELECT 1 FROM storage.buckets b
          WHERE b.id='avalia360-private' AND b.public=false
            AND b.file_size_limit=10485760)
 UNION ALL SELECT 'storage_rls_ativo',
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='storage' AND c.relname='objects' AND c.relrowsecurity)
)
SELECT check_name,ready FROM dependencies ORDER BY check_name;

-- Executar separadamente, somente após obter autorização para testes reais:
-- (a) check de políticas de acesso por bucket em pg_policies;
-- (b) MFA/AAL2 com sessão Auth verdadeira;
-- (c) emitir ticket, upload, download, hash, reabertura e integridade;
-- (d) execução de CI e aprovação acadêmica com PPC publicado.
