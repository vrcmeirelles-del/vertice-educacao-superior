# Vértice Automação 360°

Situação: **motor puro integrado ao repositório, inativo.** Nenhuma migração, cron, Edge Function, UI ou chamada externa foi criada.

| Peça | Local |
|---|---|
| Motor determinístico (`evaluate`) | `supabase/functions/_shared/automacao360/engine.mjs` |
| Catálogo versionado (21 regras propostas, opt-in) | `supabase/functions/_shared/automacao360/catalog.mjs` |
| Adaptador documental (Bloco 02) | `supabase/functions/_shared/automacao360/documentary.mjs` |
| Testes (62) | `scripts/tests/automacao360/` (42 do motor + 20 do Bloco 02) |
| CI | `.github/workflows/verify-automacao360.yml` |
| Norma do módulo | `BIBLIA-MESTRA.md` |
| Contrato para o desenvolvedor | `INTEGRACAO.md` |

Executar: `node --test scripts/tests/automacao360/*.test.mjs`

O motor fica em `_shared` porque só pode rodar no servidor (Edge Function/Deno ou worker Node). Não importar no cliente. Ele não lê banco, não grava, não agenda e não envia nada: recebe um snapshot já autorizado e devolve propostas `pending_review` com `requiresHumanApproval: true` e motivos de abstenção.

Bloco 02 (adaptação documental: `documentaryRun` e `evidenceChecklist`): implementado a partir do contrato em `INTEGRACAO.md`. É implementação própria: o código original do pacote não foi recebido. Ponto de atenção para homologação: `complete:true` e `reviewId` precisam ser atestados pelo servidor; as funções só conferem forma, escopo e estado.

Próximo passo (Onda 0 da Bíblia): inventário de jobs, triggers, workers Render e Edge Functions; mapeamento das fontes reais do Repositório e do Sapiens; teste de equivalência do SHA-256 em Deno. Merge, migração e ativação são autorizações separadas.
