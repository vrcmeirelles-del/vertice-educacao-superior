# Contrato nativo do 5W2H — extração e diagnóstico (24/11/2026)

## Origem
A migração `20261111010933_governance_360_phase3_routing_5w2h` foi aplicada direto em produção. Em `supabase/migrations/` existe só o marcador `select 1` criado na reconciliação de 21/11 (ver `supabase/MIGRACOES.md`). O arquivo de migração **não foi alterado**, para preservar a paridade com `schema_migrations`.

O SQL aplicado foi lido de `supabase_migrations.schema_migrations.statements` do projeto `vertice-educacao-superior` por consulta **somente leitura** e salvo em `20261111010933_governance_360_phase3_routing_5w2h.producao.sql`. **Não executar este arquivo em nenhum ambiente real**: é referência.

## Integridade
| Conferência | Resultado |
|---|---|
| MD5 do arquivo × MD5 de `statements[1]` em produção | `8747e26bef720c5f73b6c46d651cc6f0` nos dois (15.329 caracteres) |
| MD5 do corpo de cada função no arquivo × `md5(pg_proc.prosrc)` em produção | idênticos nas 6 funções: o que roda hoje é exatamente este SQL |
| Migrações posteriores que redefinem as funções | nenhuma |

Funções: `governance_route_to_action`, `governance_link_to_goal`, `governance_route_to_goal_and_action`, `governance_batch_route`, `governance_deliberation_trace`, `governance_traceability_report`. Todas `SECURITY DEFINER`, executáveis por `authenticated` (não por `anon`).

## Diagnóstico: as seis funções estão quebradas em produção
Reprodução em PostgreSQL 16 descartável, com as tabelas recriadas a partir das colunas reais de produção (`reproducao_stubs.sql`), sem dados reais:

| Função | Resultado |
|---|---|
| `governance_route_to_action` | `column d.linked_goal_id does not exist` |
| `governance_link_to_goal` | usa `linked_goal_id` (mesma causa) |
| `governance_route_to_goal_and_action` | `column "linked_goal_id" of relation "governance_deliberations" does not exist` |
| `governance_batch_route` | não lança erro, mas devolve erro em cada item |
| `governance_deliberation_trace` | `column "linked_action_id" does not exist` |
| `governance_traceability_report` | `column "linked_action_id" does not exist` |

Causa 1: em produção, `governance_deliberations` tem `action_id` e `goal_id`; as funções usam `linked_action_id` e `linked_goal_id`.
Causa 2 (aparece se a 1 for corrigida): as funções gravam `review_status = 'pendente'` em `vertice_action_governance`, mas a restrição só aceita `rascunho`, `enviado`, `aprovado`, `devolvido`.

Uso real em produção (consulta em 24/11/2026): 0 deliberações, 0 ações com `deliberation_id`, 0 eventos de fluxo, 0 linhas em `vertice_action_governance`. O defeito nunca foi exercido; não há dado corrompido.

## Problemas de autorização (mascarados pelos erros acima)
- As funções checam apenas **vínculo** em `vertice_memberships`, de qualquer papel, inclusive `leitor`. Como são `SECURITY DEFINER`, contornam a RLS: `vertice_actions_insert` exige `gestor`/`equipe`/direção e `vertice_goals_insert` exige `gestor`. Na reprodução, um usuário `leitor` passou pela checagem.
- Não exigem MFA (`aal2`).
- `p_course_id` não é conferido contra a IES da deliberação.
- `governance_batch_route` vincula `goal_id` vindo do payload sem verificar a IES (o `governance_link_to_goal` verifica).

## Consequências para a Automação 360°
- **Não usar as funções `governance_*` como destino do `handoffIntent` (Bloco 11).** O alvo real do 5W2H é a tabela `vertice_actions` (com `vertice_goals` e `vertice_action_governance`).
- `vertice_actions.origin_type` só aceita: `nde`, `colegiado`, `coordenacao`, `cpa`, `bi_academico`, `egressos`, `inclusao`, `acompanhamento_especial`, `comply`, `auditoria`, `demanda_institucional`, `manual`. Não há valor para a automação; registrar a origem exige ampliar essa restrição (migração) ou usar `manual`, que perde rastreabilidade.
- `origin_ref` é `uuid`; a chave de idempotência da automação é SHA-256 (64 hex). É preciso um UUID próprio da proposta ou uma tabela de vínculo.
- Não há restrição única por origem em `vertice_actions`: a idempotência da entrega precisa ser garantida pela automação.
- A tabela tem dois conjuntos paralelos de colunas 5W2H (`what`/`why`/`where_at`/`who`/`how`/`how_much` e `what_description`/`why_justification`/`where_location`/`when_deadline`/`who_responsible`/`how_method`/`how_much_cost`); as funções nativas usam o primeiro. Confirmar com o portal qual conjunto a interface lê antes de gravar.
- `vertice_action_governance.review_status` começa em `rascunho`, o que é compatível com "rascunho, nunca ação publicada" da Bíblia.

## Correção sugerida (não aplicada)
Migração nova em `supabase/migrations_nao_aplicadas/`: trocar `linked_action_id`/`linked_goal_id` por `action_id`/`goal_id`, trocar `'pendente'` por `'rascunho'`, exigir papel compatível com a RLS e `aal2`, validar curso e meta contra a IES. Testar antes em banco descartável com `reproducao_stubs.sql`. Depende de autorização expressa.
