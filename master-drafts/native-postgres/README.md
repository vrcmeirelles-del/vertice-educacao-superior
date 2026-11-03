# Testes PostgreSQL concorrentes: portátil, ainda não executado

Estado local em 03/11/2026: Python 3.12 disponível, mas `postgres`, `initdb`, `pg_ctl`, `psql` e Docker não encontrados. A checagem produz `native-prerequisites.json` com `status=blocked`. Nenhum servidor foi iniciado, nenhum pacote foi instalado e nenhum teste concorrente real foi declarado aprovado.

## Executar em um executor Linux isolado

Pré-requisitos: Python 3.10+ e binários PostgreSQL 15+ já instalados de distribuição oficial, pertencentes à mesma versão. O executor deve rodar como usuário Unix não-root. Não são necessários pacote Python, driver, Docker, conta Supabase, segredo, conexão externa ou acesso à produção.

1. Checar sem iniciar servidor:

   `python3 master-drafts/native-postgres/run_concurrency.py --pg-bin /usr/lib/postgresql/17/bin`

2. Quando os binários oficiais estiverem disponíveis, executar somente o cluster descartável criado pelo harness:

   `python3 master-drafts/native-postgres/run_concurrency.py --pg-bin /usr/lib/postgresql/17/bin --execute-isolated`

Não há opção de DSN, host ou banco existente. O script ignora variáveis PG herdadas, cria um diretório temporário novo com modo 0700, inicializa um cluster privado, usa autenticação peer Unix e desabilita TCP completamente. O único banco testado é `vertice_master_concurrency_test` dentro desse cluster novo. Não gera senhas/tokens reais ou acesso persistente externo. O servidor é parado ao concluir ou falhar, inclusive quando o início tem resultado incerto; os arquivos sintéticos locais ficam retidos para diagnóstico. O caminho é registrado no resultado, sem credenciais.

`native-run-results.json` só representa execução quando registra cenários com `observed_blocking=true`. Ausência de binários, pré-condições inválidas, falha de SQL ou uma sessão que não demonstrou contenção causam falha explícita. `native-prerequisites.json` nunca significa aprovação dos testes.

## Como a concorrência é provada

Cada cenário abre duas sessões `psql` independentes. A executa sua operação e mantém a transação aberta. B tenta a operação concorrente. Uma terceira sessão exige que `pg_stat_activity` mostre B esperando por lock e que `pg_blocking_pids(B)` identifique A como bloqueador. Só então A confirma; o script verifica o resultado/SQLSTATE de B e o estado final. Sleeps não substituem a prova de contenção. O único atraso intencional adicional faz um prazo vencer depois que a contenção já foi observada.

12 corridas preparadas:

1. Duas emissões para o mesmo e-mail sem linha anterior: um convite/auditoria.
2. Dois aceites: um grant, um consumo, uma auditoria.
3. Revogação vence aceite pendente: nenhum grant.
4. Aceite vence revogação pendente: grant válido, revogação recusada.
5. Remoção da autoridade do emissor vence aceite: nenhum grant.
6. Aceite mantém a autoridade do emissor bloqueada até confirmar.
7. Troca de e-mail do destinatário vence aceite: nenhum grant.
8. Remoção de confirmação do e-mail vence aceite: nenhum grant.
9. Promoção administrativa concorrente: aceite revalida depois do lock da FK; não consome nem audita parcialmente.
10. Desativação vence aceite: nenhum grant.
11. Aceite mantém configuração bloqueada até confirmar; desativação espera.
12. Prazo vence durante espera pelo emissor: relógio é verificado novamente e o grant é recusado.

Além das corridas: carregar a foundation completa, validar grants desativados sob default ACLs permissivas de service_role BYPASSRLS e injetar falha na auditoria para comprovar rollback do grant, consumo e auditoria legada. Esses cenários só estarão executados quando um resultado real os confirmar.

## Baseline e limites

`baseline-foundation.sql` é cópia byte a byte do arquivo do repositório no commit `79f42f112350a5375ff3b66e6e556fcfe264ac13`, confirmado como main na consulta desta etapa. SHA-256 fixo é verificado antes de qualquer SQL. Veja `BASELINE-COMPARISON.md` para diferenças concretas e limites.

O Auth permanece um stub sintético: não verifica assinatura JWT, login, MFA real, sessões, SSO ou PostgREST. Não aplica todas as demais migrações do portal. Os testes seriais PGlite continuam separados; preparar este harness não transforma seus resultados em prova de concorrência. Mesmo aprovação destas corridas não prova todas as ordens possíveis de locks, carga, políticas de sessão ou integração HTTP. Não há implantação, ativação ou envio de convite neste script.
