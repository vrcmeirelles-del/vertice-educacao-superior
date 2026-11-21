# Migrações do Supabase — regra de operação

Desde a reconciliação de 2026-11-21, `supabase/migrations/` espelha exatamente
`supabase_migrations.schema_migrations` do projeto de produção: 275 versões, sem sobras de nenhum lado.

## Ao criar uma migração
1. Nomeie o arquivo `AAAAMMDDHHMMSS_nome.sql` (versão única).
2. Aplique por um destes caminhos e **registre com a versão do nome do arquivo**:
   - integração do Supabase (`apply_migration`) — atenção: ela grava a hora da aplicação como versão.
     Se isso acontecer, renomeie o arquivo para a versão gravada **ou** ajuste o registro;
   - SQL Editor — depois, insira em `supabase_migrations.schema_migrations` (version, name, statements, created_by).
3. Confira a paridade (mesma contagem e mesmo hash):
   ```sql
   select count(*), md5(string_agg(version, ',' order by version)) from supabase_migrations.schema_migrations;
   ```
   ```bash
   ls supabase/migrations | grep -E '^[0-9]+_.*\.sql$' | cut -d_ -f1 | LC_ALL=C sort | paste -sd, | tr -d '\n' | md5sum
   ```

## O que a reconciliação fez
- 102 arquivos renomeados para a versão registrada em produção (referências em testes e documentos atualizadas).
- 30 arquivos aplicados mas sem registro: conferidos objeto a objeto em produção e registrados com a versão do arquivo
  (`created_by = 'registro-manual'`, `statements` aponta para o arquivo e o sha256).
- 103 registros de produção sem arquivo: criado arquivo de referência (`select 1;`) com a mesma versão e nome.
  O SQL que foi aplicado está em `schema_migrations.statements`.
- 3 arquivos nunca aplicados foram para `supabase/migrations_nao_aplicadas/` (ver o README de lá).
- `novo_instrumento.sql` (sem versão) permanece; a CLI ignora arquivos fora do padrão. Seu conteúdo existe em produção.

## Limite
A pasta registra o histórico; ela **não** reconstrói o banco do zero (`supabase db reset`): os arquivos de referência não
contêm o SQL original, e várias migrações antigas foram aplicadas em partes com outros nomes.
