# Vértice Automação 360° — Bíblia-Mestra
Versão 0.4 | 24/11/2026 | Candidata de desenvolvimento, sem autorização de implantação

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

## 9. Fontes internas
Repositório https://github.com/vrcmeirelles-del/vertice-educacao-superior : UPDATE_POLITICA_IA_20261120.md; UPDATE_ALGORITMOS_TREINADOS_20261121.md; UPDATE_ALGORITMOS_3_4_5_20261120.md; UPDATE_ALERTA_EVASAO_20261120.md; UPDATE_DISCIPLINAS_GARGALO_20261120.md; docs/avalia360/ROADMAP_INTELIGENCIA_PEDAGOGICA.md; docs/SAPIENS_NATIVE_BRIDGE_20261114.md; docs/integracao/AUTOMACAO_PARA_APROVACAO.md; docs/INTELIGENCIA_MERCADO_20261116.md. Consulta Supabase de 24/11/2026 (somente metadados cron). 

## Bloco 02 — inteligência documental e regulatória (v0.2)

Incremento cumulativo: preserva o motor e as 21 regras da v0.1. O adaptador puro `src/documentary.mjs` reutiliza `repo.overdue` e `repo.due`; não cria novo agendamento nem duplica o motor. Versão do adaptador: `2026.11-documentary.1`.

### Entregue
- Datas de vencimento estritas e contagem por dia civil no fuso institucional (padrão America/Araguaina). Vencido: dias negativos; próximo: 0–7 dias; ambos são limiares propostos, não normativos.
- Pedidos abertos e devolvidos entram na triagem. Enviados, validados e cancelados não geram cobrança de entrega. Estados reais devem ser mapeados e homologados; desconhecidos e datas ausentes são relatados, nunca convertidos em zero.
- Resumo por data de vencimento e evidências de origem; chaves estáveis na mesma faixa, com nova chave quando a faixa, status ou revisão muda. Persistência e deduplicação transacional ainda não implementadas.
- Checklist de vínculos documentais: sem evidência vinculada, aguardando revisão, ou evidência validada por humano presente. Nenhum desses estados constitui parecer de conformidade; `compliance` permanece nulo.
- 20 novos testes sintéticos, 62 no acumulado. Nenhuma alteração em sistemas reais.

### Continuidade e limites
O adaptador pressupõe snapshots completos e autorizados por IES/curso, com IDs opacos e revisão confiável, até 2.500 pedidos. A consulta real, paginação, persistência, autenticação e confirmação de autoria do parecer são responsabilidade do adaptador servidor a homologar. O checklist não verifica validade, suficiência, autenticidade ou conformidade jurídica do documento. Não extrai texto de imagem nem classifica PDFs. Reutilizar a pré-análise documental e o algoritmo repository-pace existentes; não substituí-los por este código. A proposta de cobrança é somente um alerta pendente; não envia mensagens, não publica ações 5W2H, não aprova documentos.

### Próximos gates
1. Mapear tabelas e RPC existentes de pedidos, documentos, evidências e responsáveis, inclusive estados reais e fuso por instituição. Conferir totais com fontes autorizadas.
2. Implementar adaptador servidor e modo sombra, testes de RLS, concorrência, reabertura, cancelamento e idempotência real. Reconciliar alertas resolvidos sem apagar histórico.
3. Integrar painel de pendências e encaminhamento humano ao 5W2H. Definir destinatários, cadência e escalonamento aprovados por IES. Não duplicar cron PEI/OneDrive.
4. Homologar em base descartável; solicitar autorização separada para merge, migração e ativação.
5. Próximo bloco: inteligência pedagógica longitudinal (Sapiens/Avalia/Construção Curricular/ENADE/ENAMED), consumindo apenas evidências validadas.

## Bloco 03 — inteligência pedagógica longitudinal (v0.3)

Incremento cumulativo: `src/pedagogical.mjs`, versão `2026.11-pedagogical.1`, reutiliza seis regras do catálogo existente. Não substitui o motor de domínio do Avalia ou Sapiens, não cria notas nem risco individual.

| Regra | Evidência exigida | Saída |
|---|---|---|
| sapiens.low | grupo por competência e janela, contagens válidas, >=30 respostas corrigidas, >=5 estudantes, revisão humana | proposta se acerto <50% |
| curriculum.gap | matriz curricular versionada, mapeamento completo | competências requeridas não cobertas |
| enade.gap / enamed.gap | matriz específica versionada, mapeamento completo | lacuna de cobertura, não previsão de nota |
| avalia.recovery | contagem do motor existente, versão e validação | proposta de acompanhamento |
| retention.alert | contagem de alertas confirmados do motor existente | proposta agregada, não risco novo |

Os limiares são propostas sujeitas a aprovação institucional; o mínimo de cinco estudantes não equivale a garantia de anonimato. Pré-notas, grupos sem revisão, fontes incompletas, dados antigos, matrizes vazias ou inconsistentes são excluídos ou rejeitados. Ausência de alerta não implica domínio. A chave de competência precisa ser mapeada para identidade estável do Avalia (normalização documentada no roadmap); IDs opacos do adaptador não são novos códigos curriculares. Não misturar cursos, períodos, matrizes ou revisões. A comparação longitudinal continua nos motores existentes: este bloco não estima tendência nem recalcula domínio.

### Evidências e continuidade
- 34 novos testes sintéticos; 96 cumulativos executados e aprovados. Sem teste integrado de produção.
- Adaptadores reais, comprovação de autoria da revisão, associação competência/janela, paginação, RLS, persistência e execução recorrente seguem pendentes. Não criar ações, enviar intervenções ao F&O nem alterar diagnóstico sem validação autorizada.
- Próximo bloco 04: gestão acadêmica (Estágio, TCC, Extensão, Ensino e AC), preservando horas e homologação humana.

## Bloco 04 — gestão acadêmica (v0.4)

`src/academic.mjs` reutiliza o motor central e cinco regras anteriores, acrescentando onze regras ao catálogo (32 no total). O adaptador exige curso explícito, fuso institucional, fonte completa, revisão estável e configuração aprovada. Resultados são propostas para revisão, jamais aprovação de horas ou emissão de certificados.

| Módulo | Regras | Fonte exigida |
|---|---|---|
| Estágio | prazo próximo/vencido, minutos faltantes, evidências faltantes | prazo vigente, PPC/regulamento aprovado, créditos validados, checklist versionado |
| TCC | prazo próximo/vencido, evidências faltantes | etapa aberta e checklist vigente |
| Extensão | evidências, minutos, certificados pendentes | cadastro de projeto e participantes elegíveis, critérios aprovados |
| Ensino | certificados, minutos, documentos | participantes elegíveis e registro validado |
| AC | candidatos a duplicidade, minutos, documentos | resultado de verificação existente e créditos validados |

Prazos de 0–7 dias são proposta de alerta, não regra legal; horas são representadas em minutos inteiros. Exigir equivalência de hora-aula conforme regulamento antes de converter. Não presumir cargas mínimas, equivalências, elegibilidade ou autenticidade. O adaptador deve deduplicar créditos por identidade da atividade e beneficiário, preservar distinção entre extensão curricular, AC, ensino e estágio e não somar automaticamente entre categorias. A detecção de duplicidade consome contagem de candidatos de verificador versionado, não declara fraude. Evidência vinculada não significa evidência aprovada. Certificados pendentes são diferença entre elegíveis e emitidos, sem emissão automática. O estado submitted não gera alertas neste núcleo; fila de validação deve ser tratada separadamente. Não enviar notificações ou publicar 5W2H. Não gerar risco individual.

### Evidência e gates
145 testes cumulativos aprovados (96 anteriores, 38 testes específicos e 11 novos smoke tests de catálogo). A expectativa fixa de tamanho do catálogo foi atualizada de 21 para 32; versões das regras anteriores preservadas. Testes exclusivamente locais com fixtures sintéticas. Nenhuma migração, cron, integração real ou publicação. Antes de ativação: mapear tabelas/RPC por módulo, validar autoria e escopo dos registros, reconciliar horas e certificados com fontes reais, testar RLS/MFA, concorrência, paginação, resolução/reabertura e outbox. O motor retorna propostas; a deduplicação persistente depende de restrição única no banco. Reversão: desativar somente regras do bloco e manter histórico; não apagar registros acadêmicos. Próximo bloco 05: inteligência estratégica e comercial.

## Integração ao repositório (registro cumulativo)

Os pacotes acima são a fonte normativa. Este registro documenta como foram incorporados ao repositório; não altera requisitos.

| Data | Evento | Evidência | Pendência |
|---|---|---|---|
| 24/11/2026 | Bloco 01 (motor e catálogo) copiado sem alteração para `supabase/functions/_shared/automacao360/`; testes em `scripts/tests/automacao360/`; CI `verify-automacao360.yml` | 42/42 no Node 22 local e no CI | equivalência SHA-256 em Deno |
| 24/11/2026 | Bloco 02 recebido só como contrato; implementação provisória própria, escrita a partir do texto, para não bloquear a sequência | 62/62 com testes próprios | substituir pelo original quando recebido |
| 24/11/2026 | Pacote v0.3 recebido com o código original dos Blocos 02 e 03. A implementação provisória foi **substituída** pelo original (`documentary.mjs`, `pedagogical.mjs`) e pelos testes do pacote. Motor e catálogo conferidos byte a byte: idênticos | 96/96 no pacote e no repositório (Node 22) | ver observações abaixo; adaptadores reais, RLS, persistência, scheduler e UI |
| 24/11/2026 | Pacote v0.4 recebido (Bloco 04, gestão acadêmica). `academic.mjs` e o catálogo de 32 regras copiados sem alteração; motor e Blocos 02/03 conferidos byte a byte: idênticos. As 21 regras anteriores mantêm a versão `2026.11-proposal.1`, portanto as chaves de idempotência já calculadas não mudam | 145/145 no pacote e no repositório (Node 22) | ver observações do Bloco 04; adaptadores reais por módulo, reconciliação de horas e certificados |

Observações da conferência (não corrigidas, para preservar a versão homologável do pacote):
- `documentaryRun` não recusa `config.ruleIds` com regras não documentais; como só gera registros de `repo.overdue`/`repo.due`, o efeito é nulo, mas o contrato pede configuração exclusivamente documental.
- `documentaryRun` aceita fuso inválido como erro genérico do `Intl` (falha fechada, sem mensagem própria).
- A versão provisória divergia do original em: formato de `deadlineSummary` (objeto × lista por data), retorno de `evidenceChecklist` (objeto × lista com `compliance:null`), data inválida (erro × `issue`) e fuso padrão (exigido × `America/Araguaina`). Prevalece o original.

Observações da conferência do Bloco 04 (não corrigidas):
- Nas regras de horas, documentos, certificados e duplicidade, a revisão enviada ao motor inclui o valor apurado (minutos ou itens faltantes). Cada crédito parcial validado gera uma nova chave e, portanto, uma nova proposta para o mesmo pendente. A persistência deve encerrar a proposta anterior ao abrir a nova, ou a fila acumulará propostas obsoletas.
- O fuso inválido em `academicRun` resulta em erro genérico do `Intl` (falha fechada, sem mensagem própria), como no Bloco 02.
