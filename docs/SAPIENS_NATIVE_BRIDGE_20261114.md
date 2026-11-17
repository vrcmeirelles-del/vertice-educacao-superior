# Sapiens 360 ↔ Fato & Ordem: implementação e revisão

Registro histórico da revisão anterior à publicação. A integração foi posteriormente publicada pelas PRs [Vértice #131](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/131) e [F&O #254](https://github.com/vrcmeirelles-del/fato-e-ordem/pull/254). As operações propostas abaixo descrevem aquele momento; não devem ser reaplicadas como pendências atuais. Correção de privacidade e validações em [SAPIENS_FEEDBACK_PRIVACY_20261117.md](SAPIENS_FEEDBACK_PRIVACY_20261117.md). A publicação não equivale à homologação de intervenções com dados reais.

## Comportamento implementado

1. O Master escolhe expressamente uma IES no painel. Aprovação/rejeição passam por uma Edge Function que verifica o usuário com `auth.getUser`, exige AAL2 e consulta `vertice_admins`. O navegador não altera o status diretamente e não recebe segredos da ponte.
2. A RPC transacional repete a autorização Master, verifica instituição/curso/diagnóstico, registra a decisão e congela o payload v1 e os tokens de estudantes ativos daquele curso em tabela privada. Lista vazia ou maior que 5.000 bloqueia a aprovação.
3. O encaminhamento usa HTTPS, host permitido, chave de serviço, bloqueio de redirecionamento, timeout e lease de 90 segundos. Somente um recibo v1 com IDs e quantidade compatíveis muda o estado para `sent`. Falha mantém `approved` e permite repetir; registro pré-existente sem payload imutável não é enviado automaticamente.
4. O F&O exige tokens explícitos. A seleção cruza instituição, curso, token, vínculo verificado e não revogado. Qualquer participante fora desse escopo recusa o lote inteiro. A transação congela os participantes e a linha de base por estudante/KC. `suggested_kc_ids` passa de `integer[]` para `text[]`, conforme o motor existente. Se a lista de KCs estiver vazia, são resolvidos e congelados os KCs ativos mapeados para o módulo e a disciplina solicitados; sem mapeamento a operação é recusada.
5. A identificação da intervenção e um hash do conteúdo normalizado controlam a idempotência. Repetição idêntica retorna o recibo original; mesmo ID com conteúdo diferente retorna 409. A repetição não amplia a turma nem redefine a baseline.
6. `Atualizar resultados` no painel consulta o retorno longitudinal. O F&O usa os participantes originais ainda elegíveis; compara KCs emparelhados e conta diferenças de tentativas, sem somar todo o histórico. Revogação, mudança de curso e reinício de contadores são considerados. A medição tem UUID próprio, resultado imutável no F&O e pendência persistente na Vértice para repetir após uma falha local.
7. A Vértice salva apenas agregados permitidos. Não recebe nomes, CPF, matrícula, e-mail, resposta textual ou tokens na devolutiva. Não são copiados dados individuais para o histórico público de efetividade. As tabelas individuais e os recibos internos do F&O têm RLS e acesso das roles de navegador revogado. Os grants específicos são aplicados somente quando as roles existem, mantendo a compatibilidade com PostgreSQL local sem roles Supabase.
8. A trilha registra ator, decisão, tentativas, entrega, código de falha e medições. Logs de falha não incluem corpos remotos ou segredos.

## Testes executados

| Verificação | Resultado |
|---|---:|
| F&O: regressão da ponte e segurança/longitudinal novos | 29/29 |
| Ciclo entre dois PostgreSQL PGlite e HTTP local real | 7/7 |
| Contratos do portal, incluindo 3 testes novos do Sapiens | 83/83 |
| Suíte existente do portal | 408/408 |
| TypeScript completo do portal | aprovado |
| Build estático completo | aprovado |
| Deno check da Edge Function com dependência exata 2.45.4 instalada localmente | aprovado |

Os cenários incluem aprovação, rejeição sem despacho, ausência de elegíveis, destinatários de outro curso/IES, MFA insuficiente, usuário não Master, JWT inválido, origem não permitida, contrato inválido, perda de confirmação após aceitação, HTTP 503, resposta inválida, falha no commit local, lease concorrente/expirado e retomada, revogação de vínculos e falha ao salvar devolutiva. As consultas de ACL/RLS foram executadas sob as roles `authenticated` e `anon` quando aplicáveis.

## Alcance da evidência

Os testes usam dados exclusivamente sintéticos e o código efetivo dos handlers e das migrações. O transporte HTTP local conecta o handler Vértice ao handler F&O; as duas bases são instâncias independentes de PostgreSQL via PGlite. O verificador externo de usuários Supabase é substituído por uma identidade sintética nos testes: login real, emissão/verificação real de JWT, gateway hospedado, TLS de produção e DNS não foram homologados. Na verificação local não foi executada a aplicação inteira do F&O, nem sua suíte completa; foram testadas sua ponte e as novas rotas já conectadas a ela. A suíte completa também é executada pelo GitHub Actions; o resultado de cada revisão deve ser consultado na PR correspondente.

A medição é acionada pelo Master no painel; este pacote não cria agendamento recorrente. A entrega registra a intervenção na ponte existente do F&O; não acrescenta uma interface de execução pedagógica do aluno nem muda o algoritmo de seleção de questões. `active_intervention_id` continua sendo um marcador de compatibilidade e os participantes longitudinais usam a nova relação própria.

Os estados de domínio/mastery são globais por estudante/KC no motor atual. O módulo restringe o conjunto de KCs por mapeamento; o delta observado não prova causalidade exclusiva da intervenção. Para os tipos de carreira que compartilham `question_kind=carreiras`, o mapeamento existente é comum. Não se declara efeito causal, êxito acadêmico garantido ou conclusão automática da intervenção.

Para a classificação descritiva, a RPC usa: incremento p_know >=0,10, incremento >0, estabilidade ou regressão. Menos de cinco estudantes comparáveis, nenhuma tentativa nova ou contador reiniciado produz `insufficient_data`. Esses limiares são uma convenção explícita do pacote, não validação estatística de impacto.

## Reprodução

Em checkouts das duas branches correspondentes, com Node 24:

```bash
npm ci --prefix scripts/tests/sapiens-runtime --no-audit --no-fund
FATO_ORDEM_REPO=/caminho/absoluto/fato-e-ordem node --test scripts/tests/sapiens-runtime/native-cycle.test.mjs
```

No F&O, com as dependências do seu package-lock instaladas:

```bash
node --test test/vertice-bridge.test.mjs test/vertice-intervention.test.mjs test/sapiens-native.test.mjs
```

O portal deve ser composto como o build existente: extrair `vertice-servidor-source.zip`, sobrepor `source-overrides/`, instalar com lockfile e executar `npm run check`, `npm test`, os contratos definidos em `scripts/portal-types.vitest.config.ts` e `npm run build:static`.

## Operações propostas — AGUARDANDO APROVAÇÃO EXPRESSA

Nenhuma das operações abaixo foi executada.

### 1. Migrar somente os dois arquivos novos

- F&O, Supabase `nckgdluyfubnvarxuiaf`: `db/migrations/941_sapiens_native_bridge.sql`.
  - Converter `fo_vertice_interventions.suggested_kc_ids` para `text[]`.
  - Acrescentar `request_hash` e `receipt`.
  - Criar `fo_vertice_intervention_students` e `fo_vertice_intervention_feedback`.
  - Ativar RLS nas três tabelas de intervenção/participantes/feedback; revogar acesso de `anon`/`authenticated`; conceder acesso ao servidor `service_role`.
  - Registrar o arquivo e seu SHA-256 em `schema_migrations` na mesma transação, se a aplicação for manual. O runner existente usa esse histórico; não executar o SQL manualmente sem o registro correspondente.
- Vértice, Supabase `qvetbbmviatxxatzzuzc`: `supabase/migrations/20261114221711_sapiens_native_bridge.sql`.
  - Converter os IDs de KC para `text[]` e acrescentar `delivery_status` (valor inicial `pending`) e `last_delivery_code`.
  - Criar `vertice_private.sapiens_delivery`, com RLS e acesso de navegador revogado.
  - Acrescentar `measurement_id` e índice único na efetividade.
  - Criar a RPC `vertice_sapiens_bridge`, executável somente por `service_role`.
  - Restringir escrita direta do navegador e exigir AAL2 na leitura do Sapiens.

As estruturas fundacionais das PRs #127/#252 foram encontradas por consulta de metadados. Não reaplicar a migração 940 nem a migração fundacional Sapiens. O arquivo fundacional da Vértice tem nome futuro (`20261115000000`) em `source-overrides`; não usar `db push` indiscriminado. A consulta do histórico do F&O encontrou as 105 migrações do snapshot-base aplicadas, incluindo 940; verificar novamente antes da liberação.

A conversão de tipo e o default da coluna nova afetam a representação dos registros existentes. As migrações não aprovam, encaminham, atribuem ou recalculam nenhuma intervenção anterior. Usar transação e timeout de lock apropriado; em conflito ou divergência estrutural, interromper e apresentar a alteração necessária.

### 2. Publicar os dois códigos aprovados

- Integrar exclusivamente os commits das duas PRs revisadas em `main`. Confirmar que a base e as configurações não mudaram antes do merge.
- O merge dispara os serviços existentes com autoDeploy; não criar projetos ou bancos paralelos.
- F&O: `fato-e-ordem-portal` (`srv-dbeuk90ae00c73e66gm0`) e `fato-e-ordem-lab` (`srv-da8eagon74is73dmu400`), workspace `tea-d925voi8qa3s73csvir0`.
- Vértice: `vertice-portal` (`srv-dbm52uhsrm7s73f3ojkg`) e `vertice-educacao-superior` (`srv-dbbm6q3ncjis7396t7fg`), mesmo workspace.
- Os outros serviços consultados estão sem autoDeploy ou suspensos; não alterar sua configuração ou estado.
- Publicar **somente** a nova Edge Function `vertice-sapiens-bridge`, a partir de `supabase/functions/vertice-sapiens-bridge/`, no projeto Vértice, com `verify_jwt=true`. Não republicar as três funções anteriores.
- Reutilizar `SUPABASE_URL`, credencial server-side, `VERTICE_BRIDGE_API_KEY` e `FATO_ORDEM_BRIDGE_URL`; não imprimir valores ou copiar segredos para o frontend. Conferir configuração e o papel PostgreSQL do runtime antes da ativação; se forem necessários novos valores ou permissões, apresentar a operação específica.

O F&O aplica migrações no startup pelo runner de `PostgresAppStore`. Para aplicar a 941 manualmente antes do merge, registrar o checksum em `schema_migrations` para que o startup não a execute de novo. O reinício também dispara a inicialização já existente da aplicação, incluindo limpeza de sessões expiradas e demais rotinas já presentes no bootstrap; a alteração deste pacote não as modifica. A revisão dessa inicialização no ambiente alvo é uma condição de liberação: não autorizar por inferência novos envios, importações ou reprocessamentos de dados reais.

### 3. Verificar a implantação, sem acionar intervenções reais

Após a autorização e a implantação: consultar saúde, versão, presença da função, configuração de JWT e permissões/RLS. Não aprovar intervenções existentes, não importar alunos, não enviar mensagens e não criar dados sintéticos dentro dos bancos hospedados neste lote. Uma homologação funcional hospedada com identidade Master real e tenant sintético exigirá um roteiro separado com as inserções/limpeza exatas e nova aprovação antes de qualquer escrita.

### Reversão proposta

Se houver falha após publicação, reverter os commits de aplicação e retirar/desabilitar a nova Edge Function. Preservar os registros de auditoria, baseline e medições. Não fazer DROP de tabelas, reduzir `text[]` de volta a `integer[]` ou apagar registros como rollback automático; qualquer reversão de banco será apresentada separadamente para aprovação.
