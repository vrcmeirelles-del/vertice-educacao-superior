# Automação 360° — relatório final da missão de integração e homologação

Data: 24/11/2026. Branch: `ccr-a55e7f28-o8iqhf`. PR: https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/279 (rascunho, sem merge).

## Síntese
A Automação 360° foi integrada à Vértice existente, sem plataforma, login, banco ou serviço paralelo: motor determinístico em `_shared`, persistência em migração candidata no projeto Supabase existente, permissões derivadas do RBAC nativo com MFA e Central de Automação dentro do Master e da área da IES. Tudo foi testado em ambiente descartável com dados sintéticos. **Nada foi aplicado em produção, publicado ou ativado.** Inteligência artificial generativa permanece desativada; nenhuma API externa é chamada.

## Matriz das 40 regras
Estados possíveis: integrada → testada em ambiente descartável → homologada (banco real) → ativada. Nenhuma regra passou de "testada".

| Regra | Módulo | Prioridade | Fonte | Adaptador | Estado | Homologada | Ativada |
|---|---|---|---|---|---|---|---|
| `repo.overdue` | Repositório | P0 | identificada | `vertice_automation_source_documentary` | Testada em ambiente descartável (adaptador SQL + e2e sintético) | não | não |
| `repo.due` | Repositório | P0 | identificada | `vertice_automation_source_documentary` | Testada em ambiente descartável (adaptador SQL + e2e sintético) | não | não |
| `sapiens.low` | Sapiens 360° | P0 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `curriculum.gap` | Construção Curricular | P0 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `avalia.recovery` | Avalia 360° | P0 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `enade.gap` | ENADE 360° | P0 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `enamed.gap` | ENAMED 360° | P0 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `cpa.pending` | CPA | P1 | identificada | `vertice_automation_source_planning` | Testada em ambiente descartável (adaptador SQL + e2e sintético) | não | não |
| `retention.alert` | Permanência | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `pei.overdue` | Planejamento Estratégico | P1 | identificada | `vertice_automation_source_planning` | Testada em ambiente descartável (adaptador SQL + e2e sintético) | não | não |
| `extension.pending` | Extensão 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `teaching.pending` | Atividades de Ensino | P1 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `internship.due` | Estágio 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `tcc.overdue` | TCC 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `ac.duplicate` | AC 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `alumni.pending` | Conecta 360° | P2 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `capture.stale` | Captação | P1 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `market.new` | Inteligência de Mercado | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `due.pending` | Due Diligence | P2 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `school.attendance` | Vértice Escolas | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `finance.overdue` | Financeiro | P2 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `internship.overdue` | Estágio 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `internship.hours` | Estágio 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `internship.documents` | Estágio 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `tcc.due` | TCC 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `tcc.documents` | TCC 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `extension.hours` | Extensão 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `extension.certificates` | Extensão 360° | P1 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `teaching.hours` | Atividades de Ensino | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `teaching.documents` | Atividades de Ensino | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `ac.hours` | AC 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `ac.documents` | AC 360° | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `capture.conversion` | Captação | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `capture.sla` | Captação | P1 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `competition.change` | Inteligência de Mercado | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `market.transaction` | Inteligência de Mercado | P2 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `due.blocker` | Due Diligence | P1 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |
| `finance.arrears` | Financeiro | P2 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `finance.cashgap` | Financeiro | P2 | pendente | — | Bloqueada: fonte inexistente ou não confiável | não | não |
| `alumni.response` | Conecta 360° | P2 | identificada | — | Integrada (motor, catálogo, Central); adaptador pendente | não | não |

**Totais:** 40 regras · 4 testadas em ambiente descartável · 27 integradas com adaptador pendente · 9 bloqueadas por fonte · 0 homologadas · 0 ativadas. Detalhe de fontes e observações: `MATRIZ_REGRAS.md`.

## Migrações (candidatas, não aplicadas)
| Arquivo | Conteúdo | Efeito em dados existentes |
|---|---|---|
| `20261124210000_automacao360_nucleo.sql` | schema `vertice_automation` (6 tabelas, RLS fechada, sem grants diretos), gatilhos de imutabilidade e de revisão vigente, `vertice_private.automation_can`, 8 RPCs, origem `automacao_360` em `vertice_actions` com índice único, módulo `GEST_AUTOMACAO360` inativo | altera a restrição `origin_type` de `vertice_actions` (só acrescenta valor); insere 1 linha no catálogo de módulos |
| `20261124210001_automacao360_catalogo.sql` | seed gerado das 40 regras | nenhum |
| `20261124210002_governanca_5w2h_correcao.sql` | corrige as 6 funções `governance_*`, mantendo assinaturas | substitui funções que hoje falham em produção (0 deliberações registradas) |

## Evidências de execução
| Verificação | Resultado |
|---|---|
| Motor e famílias (Node 22) | 334/334 |
| SQL em PGlite (PostgreSQL 17) com o esquema de produção | 25/25 (núcleo 18, 5W2H 7) |
| Concorrência real em PostgreSQL 16 descartável | 3/3 corridas |
| Equivalência Node × Deno 2.1.4 | 9 chaves SHA-256 idênticas |
| Portal: TypeScript | 0 erros |
| Portal: `npm run build:static` completo | aprovado |
| Portal: vitest (portal-types, npm test, extensão, Conecta) | 510, 452, 45, 35 — todos aprovados; inclui 14 testes novos de interface |
| Fonte canônica e matriz (`--check`) | aprovadas |
| Isolamento entre IES (duas IES sintéticas no papel de UNITOP e UNICALDAS; não foram usados dados reais), coordenador fora do curso, sem MFA, cliente chamando adaptador | recusados nos testes |

## Segurança — pendências
- Testes com JWT real (aal1/aal2) só em homologação autorizada.
- `SECURITY DEFINER` nativas antigas do 5W2H checavam só vínculo; corrigidas na `…210002`, ainda não aplicadas.
- Execução sombra com dados reais depende de autorização e controles de proteção de dados.
- Nenhuma credencial privilegiada no frontend: adaptadores e `record_run` só com `service_role`.

## Custos e impactos
- Custo novo: nenhum criado (sem job, Edge Function, worker ou API externa). [Não verificado] custo de armazenamento e CPU em produção: não medido.
- Impacto no portal: nova aba "Automação 360°" (grupo Gestão) e item na Central Master, bloqueados enquanto o módulo estiver inativo no catálogo.
- Cron: 9 rotinas existentes reconciliadas, nenhuma duplicada nem criada (`RECONCILIACAO_CRON_20261124.md`).

## Reversão
Cinco níveis, de suspensão por revisão desativada (ensaiada) à remoção do schema: `REVERSAO.md`.

## Autorizações necessárias (separadas)
1. Merge do PR #279.
2. Aplicar as três migrações em homologação e, depois, em produção.
3. Publicar o portal (aba bloqueada pelo módulo inativo).
4. Execução sombra com dados reais.
5. Ativar o módulo e regras por IES.

Bíblia-Mestra atualizada cumulativamente: `BIBLIA-MESTRA.md`, seção "Integração ao repositório".
