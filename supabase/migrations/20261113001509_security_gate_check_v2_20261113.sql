-- Migração aplicada diretamente em produção, sem arquivo correspondente no repositório.
-- Arquivo de referência criado na reconciliação com o histórico do Supabase (2026-11-21):
-- mantém a pasta de migrações igual a supabase_migrations.schema_migrations, para que a CLI
-- não acuse versão remota ausente. O SQL aplicado está em schema_migrations.statements
-- (versão 20261113001509, nome security_gate_check_v2_20261113). Não contém instruções: reexecutar não altera o banco.
select 1;
