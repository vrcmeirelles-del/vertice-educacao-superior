# Comparação concreta do baseline

Fonte do repositório confirmada em leitura nesta etapa: [foundation no main fixado](https://github.com/vrcmeirelles-del/vertice-educacao-superior/blob/79f42f112350a5375ff3b66e6e556fcfe264ac13/supabase/migrations/202610260001_access_foundation.sql).

- Commit: `79f42f112350a5375ff3b66e6e556fcfe264ac13`.
- Git blob: `5cad6bb1abae25552aca9af3f5d9c008d1348009`.
- SHA-256 do arquivo: `0a79566238fe1b43076690bf26d66fb646fc02dbbaa9698f637795990c241fcd`.
- A cópia local original e `native-postgres/baseline-foundation.sql` são idênticas byte a byte. O harness nativo usa o arquivo completo, não a extração parcial usada pelo PGlite.

## Dependências confirmadas e usadas sem mudar o contrato

- `vertice_admins`: `user_id uuid` como chave primária, FK para `auth.users(id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`.
- `vertice_audit`: id identity, actor uuid, table_name/action text obrigatórios, record_id text, occurred_at timestamptz com default now(). O novo fluxo preserva esta estrutura e usa seu trigger existente.
- `vertice_private.is_master()`: exige JWT AAL2 e presença do `auth.uid()` em `vertice_admins`; SECURITY DEFINER, search_path vazio. A proposta não substitui esta função.
- `vertice_admin_self`: authenticated lê apenas sua própria linha; sem grant de escrita authenticated na foundation.
- `vertice_audit_admins`: AFTER INSERT/UPDATE/DELETE chama `vertice_private.audit_change()`. A função escreve actor, tabela, operação e id em `public.vertice_audit`.

Também foram comparados arquivos de metadados já presentes em disco, `vertice-ies-cloud/baseline/{columns,constraints,policies,triggers,functions,grants}.json`, sem nova consulta à produção nesta etapa. Eles confirmam os tipos/PK/FK, política de leitura própria, semântica de is_master/audit_change e trigger acima; diferenças de whitespace/delimitador de corpo não alteram essas funções.

O coordenador também informou uma inspeção somente leitura às 12:17 UTC de 03/11/2026: owner postgres e RLS habilitada (não forçada) nas duas tabelas legadas; ACL postgres/service_role ALL e authenticated SELECT; mesmo trigger/função descritos acima; nenhum objeto master_invitation* existente. Trata-se de evidência encaminhada pelo coordenador, não de consulta executada por este harness. A proposta mantém os objetos legados e força RLS somente nas novas tabelas privadas.

## Diferenças e limitações reais

1. **service_role:** os metadados existentes mostram grants amplos de service_role em `vertice_admins` e `vertice_audit`, enquanto o SQL foundation não os concede explicitamente. A proposta revoga service_role em seus objetos novos; não modifica os privilégios administrativos existentes dessas duas tabelas. O harness modela BYPASSRLS e default ACLs amplas nas tabelas/sequências/funções novas antes de aplicar a proposta. A simulação não é uma consulta atual a pg_default_acl.
2. **Auth:** o schema de `auth.users` não é criado pela foundation. O harness define somente id/email/email_confirmed_at e funções auth.uid/auth.jwt baseadas em GUC. Não reproduz todos os índices/constraints/triggers do Supabase Auth, auth.sessions, auth.mfa_factors ou validação criptográfica. Integração real Auth/PostgREST permanece pendente.
3. **Auditoria legada:** a foundation e os metadados existentes não tornam a tabela legada imutável ao proprietário/service_role. A imutabilidade implementada na proposta aplica-se ao novo ledger privado. Uma conta administrativa do banco continua sendo um limite de confiança.
4. **Outras entidades:** a foundation completa cria instituições, memberships e cursos; o harness nativo as inclui fielmente, mas não incorpora governança, convites institucionais legados e demais migrações não necessárias para estas seis RPCs. Não se conclui compatibilidade integral do portal a partir desse teste.
5. **Estado remoto:** o commit e o baseline são pinados nesta consulta; publicação futura deve confirmar que não houve alteração relevante. Não houve nova inspeção de produção nem escrita remota nesta etapa.

Resultado: não foi identificada divergência estrutural nas dependências diretas Master/auditoria que impeça aplicar a proposta em um ambiente isolado. Isso não é aprovação de implantação; a execução PostgreSQL nativa permanece bloqueada localmente pela ausência dos binários.
