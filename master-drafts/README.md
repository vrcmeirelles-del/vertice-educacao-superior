# Convites globais de Master: proposta isolada

**Não implantado nem ativado.** `proposal.sql` não é uma migração ativa. Não houve acesso de escrita à produção, envio de convites ou promoção de contas reais. A fonte de autoridade permanece `public.vertice_admins`; convites institucionais legados não são alterados. Não há endpoint de remoção de Masters.

## Trava desta publicação da interface

`MASTER_INVITATIONS_RELEASE_AVAILABLE = false` bloqueia a disponibilidade no código. A flag efetiva combina essa constante com `VITE_MASTER_INVITATIONS_ENABLED === 'true'`; portanto, nem mesmo uma variável de ambiente configurada como `true` ativa esta release. Não é necessário ler nem alterar variáveis do Render para assegurar essa condição.

A ativação futura exige revisão e alteração explícita dessa constante, além do opt-in de ambiente, backend aprovado, staging de segurança comprovado e autorização específica para ampliação de acesso. Esta publicação não aplica SQL nem concede permissões. A trava da interface não substitui os controles e ACLs do banco.

## Arquivos e reprodução

- `proposal.sql`: tabelas privadas, seis RPCs, validações e auditoria.
- `run-sql-tests.mjs`: banco PGlite 0.3.14 apenas em memória, stub mínimo de Auth e base extraída de `supabase/migrations/202610260001_access_foundation.sql`.
- `sql-test-results.json`: resultado da execução, sem tokens ou dados reais.

Execute `node master-drafts/run-sql-tests.mjs` da raiz da cópia isolada. O harness usa PGlite 0.3.14, fixado no package.json/lockfile de master-drafts. Nesta validação, a dependência existente foi reaproveitada sem instalar pacotes. O harness não usa rede e não consulta variáveis de credenciais. Em outra cópia isolada, prepare essa dependência aprovada antes de rodar os testes. Os usuários são sintéticos, com endereços `example.invalid`, UUIDs fixos e tokens determinísticos sem validade externa. Somente o harness habilita temporariamente o recurso e concede EXECUTE dentro de sua instância descartável.

## Contrato e segurança

As assinaturas públicas seguem o contrato combinado: `vertice_list_masters`, `vertice_list_master_invitations`, `vertice_issue_master_invitation`, `vertice_preview_master_invitation`, `vertice_accept_master_invitation` e `vertice_revoke_master_invitation`. As listagens usam cursor `(created_at,id)` ou `(created_at,user_id)` descendente e limite de 1–100, padrão 50. Retornos não contêm token nem hash.

- EXECUTE e privilégios das novas tabelas/sequência revogados explicitamente de PUBLIC, anon, authenticated e service_role; configuração privada singleton começa com `enabled=false`. service_role pode ignorar RLS, por isso a revogação de ACL é indispensável. Nenhum grant de ativação está na proposta.
- A validade fixa de **24 horas é uma proposta de produto**, ainda sujeita a aprovação. A emissão calcula o prazo no servidor; o cliente não escolhe expiração.
- Todos os caminhos exigem AAL2. Emissão/listagem/revogação exigem identidade existente, e-mail confirmado e Master atual. A identidade do destinatário e a autoridade atual do emissor são novamente verificadas e bloqueadas no preview/aceite.
- E-mail normalizado por trim de espaços e minúsculas, comparação integral. Validação aceita endereços ASCII dot-atom e domínios DNS ASCII/punycode; rejeita controles, espaços internos, pontos duplicados, comprimentos inválidos e rótulos DNS inválidos. Não aceita local-part entre aspas ou e-mail internacionalizado; não remove `+tags` nem pontos do endereço.
- O cliente cria 32 bytes aleatórios e envia token base64url de 43 caracteres sem padding. A emissão recebe somente SHA-256 hexadecimal minúsculo. Preview/aceite recebem o token bruto e calculam `encode(sha256(convert_to(raw_token,'UTF8')),'hex')`. Um digest hexadecimal de 64 caracteres não é um bearer aceito. O servidor não consegue provar a entropia do token a partir de seu digest; o gerador seguro do cliente também precisa de revisão.
- Convite único aberto por e-mail, uso único e revogação idempotente. Nova emissão de convite ainda ativo é recusada. Um convite expirado somente é encerrado quando um Master pede explicitamente uma nova emissão, com novo token; não há reemissão automática.
- Advisory lock transacional por e-mail serializa inclusive a ausência inicial de linha; índice único é a segunda barreira. Aceite bloqueia o convite, a identidade atual do destinatário, a identidade do emissor e seu registro Master. O bloqueio de configuração impede alteração durante operações em andamento. Falhas/PK conflicts revertem tudo.
- A promoção, o consumo e o registro de aceitação são uma transação. O trigger existente de `vertice_admins` continua gerando `vertice_audit`; um ledger privado adicional guarda emissão, expiração encerrada, revogação e aceite, sem segredos, com actor, emissor, destinatário e prazo.
- Tabelas privadas sem grants nem políticas permissivas, RLS habilitada e forçada. Auditoria adicional rejeita UPDATE, DELETE e TRUNCATE. Um proprietário/superusuário ainda pode desabilitar proteções; retenção de auditoria independente é necessária contra esse nível de acesso.

Erros públicos previstos: `master_invitations_disabled`; `master_access_denied` (42501); `invalid_email`, `invalid_token_digest`, `invalid_pagination` (22023); `duplicate_master_invitation`, `master_target_unavailable` e `invitation_unavailable` (P0001). O último é genérico para token, destinatário, prazo, uso, revogação ou emissor inválido. Não-Masters não chegam à validação de entradas das rotas administrativas nem recebem listagens.

## Verificação e limites antes de qualquer implantação

A execução cobre 30 grupos seriais: grants/configuração, AAL2 e identidade confirmada, não enumeração, validação de entradas, duplicidade, token/hash incorreto, e-mail diferente, preview sem promoção, aceite/auditorias, uso único, revogação, expiração, emissor removido/deletado, destinatário deletado/promovido, rollback induzido por falha da auditoria, acesso direto/RLS, imutabilidade e paginação com empate. O harness cria service_role com BYPASSRLS e default privileges permissivos antes de aplicar a proposta; reproduz a capacidade de escrever apesar de RLS numa tabela descartável e confirma que a revogação bloqueia tabelas, configuração, sequência, helpers e RPCs do recurso, inclusive com configuração habilitada.

**PGlite não comprova concorrência entre conexões reais.** Antes de habilitar em ambiente separado, executar testes Postgres com duas conexões: emissão simultânea do mesmo e-mail; aceite duplo; aceite × revogação; aceite × exclusão de Master emissor; aceite × troca de e-mail/confirmação; aceite × promoção administrativa; desativação × operação em andamento. O contrato é que uma ordem serial válida prevaleça, com nenhum grant parcial. Lock timeout, deadlock ou serialização devem falhar com segurança; não repetir automaticamente uma emissão de resultado incerto. Testar resposta via PostgREST com JWTs reais de staging e fluxos MFA/confirmar e-mail também está pendente.

A verificação de sessão aqui usa `auth.uid()` e o claim AAL2 validado pelo Supabase; não consulta `auth.sessions`, expiração do JWT ou revogação de sessão em tempo real. O stub do harness não autentica pessoas nem verifica JWTs. Antes da ativação, definir política para invalidação de sessões e conferir configuração de autenticação, limites de chamadas e logs para que tokens brutos nunca sejam registrados. A função não envia e-mail, não prova entrega, não cria conta e não prepara consentimento externo.

Não aplicar diretamente a produção. Exigir revisão da política de acesso Master, validade de 24h, dos owners/ACLs/default privileges e do schema real; gerar migração revisada posteriormente, testar concorrência e rodar advisors no ambiente autorizado. Confirmar que `vertice_private` não é exposto na Data API. Só depois de aprovação separada conceder os seis EXECUTEs necessários a authenticated e habilitar a configuração; nunca conceder acesso direto às tabelas/helper. Reversão operacional proposta: desabilitar a configuração e retirar esses EXECUTEs, preservando os registros de auditoria. Não há alteração de produção neste material.

Referências consultadas: [funções e EXECUTE](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [AAL2/MFA](https://supabase.com/docs/guides/auth/auth-mfa), [locks PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html), [changelog Supabase](https://supabase.com/changelog). O índice `.md` não foi aceito pelo leitor; a versão HTML foi consultada, inclusive a mudança de exposição de novas tabelas. Esta proposta não depende de exposição direta de tabelas.
