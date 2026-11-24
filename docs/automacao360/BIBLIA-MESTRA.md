# Vértice Automação 360° — Bíblia-Mestra
Versão 0.1 | 24/11/2026 | Candidata de desenvolvimento, sem autorização de implantação

## 1. Missão e continuidade
Transformar dados existentes em alertas explicáveis, propostas de intervenção e acompanhamento de resultados. Algoritmo determinístico primeiro; nenhuma API generativa. Reutilizar a identidade institucional, permissões, Sapiens, PEI, Construção Curricular, Avalia 360° e seus contratos. Não criar uma segunda fonte de verdade. Esta Bíblia é cumulativa: cada alteração registra versão, decisão, evidência, teste, pendência e reversão; não apaga requisitos anteriores. O roadmap oficial do Avalia permanece normativo para esse módulo.

## 2. Evidência inicial (24/11/2026)
Consulta somente leitura a cron.job e cron.job_run_details: 9 rotinas ativas, última execução succeeded, zero falhas cron nos sete dias consultados. Isso não comprova sucesso funcional HTTP.

| Rotina existente | Cadência | Decisão |
|---|---|---|
| billing-daily | diária | preservar; não duplicar faturamento |
| conexoes-sync-semanal | semanal | preservar |
| integration-observe-hourly | horária | preservar; conferir payload |
| market-public-discovery-daily | diária | preservar; revisão humana |
| onedrive-docs-unicaldas-semanal | semanal | preservar |
| onedrive-docs-unitop-semanal | semanal | preservar |
| onedrive-espelho-semanal | semanal | preservar |
| pei-alerts-daily | diária | preservar; reutilizar alertas |
| security-gate-daily | diária | preservar |

Não foi comprovada a ausência de rotinas externas, triggers ou workers. Inventariar Render, Edge Functions, logs funcionais e interface autenticada antes de novos agendamentos. Os 901 pedidos com prazo, 252 com vencimento em 15/12, 95 docentes com padrão uniforme e zero respostas homologadas são retratos documentados em 20–21/11, não métricas atuais.

## 3. Arquitetura e invariantes
Fontes existentes → adaptadores de leitura autorizada → snapshot normalizado → motor puro versionado → fila de propostas → revisão humana → ação existente do módulo → medição de impacto. Não há escrita acadêmica pelo motor. Dados faltantes, vencidos, provisórios ou inconsistentes nunca são convertidos em zero. Escopo exato instituição/curso; null significa instituição inteira, não curinga. O servidor deve validar vínculo, papel e MFA antes de obter dados. O motor não é um mecanismo de autenticação. Identificadores pseudonimizados, sem nomes no log. Usar UTC para persistência e calendário local configurado para prazos.

## 4. Catálogo inicial e contratos
Todos os limiares abaixo são PROPOSTOS e devem ser homologados por responsáveis; regras já existentes nos módulos prevalecem. Cadência é sugestão, não agendamento ativo. O catálogo executável em src/catalog.mjs é a fonte versionada desta candidata.

| Regra | Entrada normalizada | Gatilho | Encaminhamento |
|---|---|---|---|
| repo.overdue | dias para prazo | <0 | gestor documental |
| repo.due | dias para prazo | 0–7 | responsável documental |
| sapiens.low | acurácia validada e n corrigido | <50%, n≥30 | coordenação/NDE |
| curriculum.gap | competências descobertas | >0 | NDE |
| avalia.recovery | recuperações pendentes | >0 | docente |
| enade.gap | competências sem cobertura | >0 | coordenação |
| enamed.gap | competências sem cobertura | >0 | coordenação médica |
| cpa.pending | evidências faltantes | >0 | CPA |
| retention.alert | alertas do algoritmo existente | >0 | permanência |
| pei.overdue | ações vencidas | >0 | gestor da meta |
| extension.pending | evidências faltantes | >0 | extensão |
| teaching.pending | certificados pendentes | >0 | ensino |
| internship.due | dias para prazo | 0–7 | estágio |
| tcc.overdue | dias para prazo | <0 | orientação |
| ac.duplicate | suspeitas de duplicidade | >0 | AC |
| alumni.pending | pesquisas pendentes | >0 | egressos |
| capture.stale | leads sem atendimento segundo SLA aprovado | >0 | captação |
| market.new | publicações ainda não revistas | >0 | inteligência de mercado |
| due.pending | evidências faltantes | >0 | due diligence |
| school.attendance | alertas validados existentes | >0 | gestão escolar |
| finance.overdue | faturas vencidas | >0 | financeiro |

Os adaptadores devem calcular métricas segundo semântica do módulo, não contar zeros artificiais nem misturar coortes. ENADE/ENAMED usam matriz oficial versionada; não inventar competências. Avalia usa competency_key, evidências homologadas e escopos definidos no roadmap. Sapiens exclui pré-notas discursivas e amostras sem validação. Permanência reutiliza os algoritmos já testados; não atribui risco individual novo. AC apenas sinaliza duplicidade, sem indeferir. Mercado usa fontes oficiais, separa descoberta e fato confirmado. Financeiro apenas alerta; não cobra nem suspende acesso. Não gerar certificados, aprovar horas ou enviar mensagens automaticamente.

## 5. Central de gestão proposta
Master: catálogo, versão, saúde dos jobs e configuração padrão desativada. IES: caixas de seleção por módulo, escopo, responsável, cadência, limiar aprovado, última execução, evidência, próxima execução, pausa. Coordenação: somente cursos autorizados. Alertas: pendente, em análise, aprovado, rejeitado, resolvido; decisão com justificativa e autor. A aprovação cria proposta de ação no módulo existente, nunca a executa automaticamente. Painel azul uniforme, acessível, sem exibir detalhes de outras IES. BI mostra cobertura, pendências, tempo de resolução e fonte desatualizada.

## 6. Implementação por ondas
Onda 0: inventariar jobs, triggers, endpoints, versões e evidências; conferir RLS/MFA. Onda 1: integrar motor, adaptadores do Repositório e Sapiens em modo sombra. Onda 2: Construção Curricular, Avalia, ENADE, ENAMED, com saneamento da persistência curricular e homologação de amostras. Onda 3: CPA, permanência, PEI e rotinas acadêmicas. Onda 4: captação, mercado, egressos, escolas e financeiro. Cada onda: PR isolada, revisão, testes sintéticos, homologação em ambiente separado, autorização de ativação por IES, observabilidade e reversão. Não substituir jobs existentes.

## 7. Critérios de aceite e reversão
Testar isolamento de IES/curso (incluindo acesso direto à API), RBAC/MFA, dados ausentes, amostra insuficiente, duplicidade, concorrência, timezone, atualização de revisão, retry, fonte desatualizada, limiar de fronteira, rejeição de pré-nota, falha HTTP, limites de volume e custo. Testar cada adaptador com fixtures do esquema real, sem registros reais. Execução idempotente por revisão do estado, regra e escopo; persistência com unique constraint e transação. Reversão: pausar catálogo e scheduler novo, manter histórico e decisões; reverter PR sem desfazer registros acadêmicos. Não aplicar migrações históricas nem editar cron atual.

## 8. Registro cumulativo
| Versão | Decisão | Evidência | Pendência |
|---|---|---|---|
| 0.1 | motor puro e catálogo opt-in | testes Node em docs/test-results.txt | adaptadores reais, RLS, scheduler, UI, integração |
| 0.2 | motor e catálogo integrados ao repositório em `supabase/functions/_shared/automacao360/`, inativos; CI dedicado | 42/42 testes Node 22 em `scripts/tests/automacao360/` (24/11/2026) | equivalência SHA-256 em Deno, Onda 0, adaptadores, persistência, RLS, scheduler, UI |
| 0.3 | Bloco 02: `documentaryRun` e `evidenceChecklist` em `documentary.mjs`, implementação própria a partir do contrato (o código do pacote não foi recebido); prazo pelo dia local do fuso da IES; revisão = revisão do pedido + faixa de prazo; regras restritas a repo.overdue/repo.due; `no_linked_evidence` nunca é não conformidade | 62/62 testes Node 22 (42 do motor + 20 do Bloco 02) em 24/11/2026 | conferir com o código original do pacote, se existir; fixtures do esquema real do Repositório; paginação e atestado de completude no servidor |

## 9. Fontes internas
Repositório https://github.com/vrcmeirelles-del/vertice-educacao-superior : UPDATE_POLITICA_IA_20261120.md; UPDATE_ALGORITMOS_TREINADOS_20261121.md; UPDATE_ALGORITMOS_3_4_5_20261120.md; UPDATE_ALERTA_EVASAO_20261120.md; UPDATE_DISCIPLINAS_GARGALO_20261120.md; docs/avalia360/ROADMAP_INTELIGENCIA_PEDAGOGICA.md; docs/SAPIENS_NATIVE_BRIDGE_20261114.md; docs/integracao/AUTOMACAO_PARA_APROVACAO.md; docs/INTELIGENCIA_MERCADO_20261116.md. Consulta Supabase de 24/11/2026 (somente metadados cron). 
