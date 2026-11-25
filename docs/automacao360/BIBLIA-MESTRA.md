# Vértice Automação 360° — Bíblia-Mestra
Versão 0.5 | 24/11/2026 | Candidata de desenvolvimento, sem autorização de implantação

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

## Bloco 05 — inteligência estratégica e comercial (v0.5)

`src/strategic.mjs` acrescenta oito regras ao catálogo (40 no total) e reutiliza cinco regras anteriores. O motor central permanece inalterado. Todas as saídas são propostas pendentes, sem efeito externo.

| Regra | Gatilho proposto | Evidência |
|---|---|---|
| capture.conversion | conversão inferior a 10% | coorte madura, pelo menos 30 leads elegíveis, matrícula vinculada e revisão |
| capture.sla | violações de SLA acima de zero | política versionada da IES |
| competition.change | mudança confirmada | fonte oficial e revisão humana |
| market.transaction | operação confirmada | documentação e revisão; rumores ficam na descoberta |
| due.blocker | bloqueio confirmado | checklist e revisão autorizada |
| finance.arrears | inadimplência superior a 10% | saldo vencido / saldo devido, mesma moeda e janela |
| finance.cashgap | compromissos superiores ao caixa disponível | valores conciliados em BRL, mesmo horizonte |
| alumni.response | resposta inferior a 30% | ao menos 30 convites elegíveis, deduplicados |

Os percentuais são limiares piloto, não referências oficiais ou metas universais. Taxas em pontos-base inteiros (100 pontos-base = 1%; truncamento para baixo explicitado); dinheiro em centavos inteiros, sem conversão monetária. O indicador de caixa é diferença de compromissos e disponibilidade, não previsão probabilística. Não confundir leads com matrículas, pesquisas respondidas com empregabilidade, anúncios com operações concluídas, nem ausência de alerta com ausência de risco. A verificação de fontes oficiais, definição de coorte, deduplicação, validação de reviewId e cálculo de agregados pertencem aos adaptadores autorizados. Não realizar scraping, enviar contatos, aprovar aquisição, bloquear acesso, alterar contratos ou aprovar plano 5W2H. Reutilizar descoberta de mercado e faturamento já agendados. Nenhuma previsão de vestibular enquanto fontes não reconciliadas.

### Evidências, pendências e reversão
192 testes cumulativos aprovados: 145 anteriores, 8 novos smoke tests e 39 testes específicos. Testes sintéticos, sem integração real. O catálogo anterior preserva IDs e versões; somente a expectativa de cardinalidade foi atualizada. Antes de ativar: validar mapeamentos, janela/coorte, consentimento, autorização financeira, RLS/MFA, comparação de agregados, concorrência e idempotência persistente; aprovar limiares por IES mediante contrato versionado (o núcleo atual usa limiares fixos do catálogo). Não criar novos coletores nem duplicar cron. Reversão por desativação seletiva das regras novas, mantendo auditoria. Próximo bloco 06: gestão institucional integrada, ciclo de decisão, 5W2H, acompanhamento, BI e reconciliação de alertas.

## Bloco 06 — Gestão institucional integrada (v0.6)

Adição cumulativa: `src/governance.mjs`, sem alteração das 40 regras anteriores. Central proposta para Master e painel de cada IES, com configuração explícita por instituição e curso, desativada enquanto não aprovada. A configuração exige MFA, permissão e aprovação por pessoa distinta. Não há herança implícita de escopo institucional para curso. O motor oferece fila determinística de alertas P0/P1/P2 e transições pendente → aprovado → em execução → concluído → verificado, ou rejeitado. Aprovação requer responsável e prazo futuro; conclusão e verificação exigem referência de evidência; verificador distinto do executor da conclusão. Mudanças retornam eventos versionados, não persistem dados por si mesmas. Revisão otimista deve ser aplicada atomicamente no banco. A proposta 5W2H nasce como rascunho idempotente, não como ação publicada. A efetividade compara agregados homologados, com mesma definição, unidade e população e mínimo proposto de 30 observações; diferença observada não equivale a causalidade. Nenhum dado insuficiente vira zero ou conclusão. Nenhuma decisão acadêmica definitiva, mensagem externa ou publicação é automática.

### Estado da entrega
Seis blocos de código independente; 40 regras e 220 testes locais aprovados em 24/11/2026, sendo 28 novos de governança. Não equivale a homologação de produção. A interface Master/IES, adaptadores autenticados, persistência transacional, política RLS, cron, integração 5W2H e BI continuam pendentes. Não foi ativada IA nem alterada a produção. Próxima fase: integração incremental em ambiente isolado, com inventário das nove rotinas existentes e reconciliação de duplicidades; validar permissões, dados reais anonimizados, custos, logs e reversão antes de autorização de publicação.

## Bloco 07 — Integração nativa (v0.7, 24/11/2026)
Preservados os blocos 01–06 e as 40 regras. Novo orquestrador `shadowRun` distribui 37 regras entre quatro famílias, usando adaptadores de leitura confiáveis injetados pelo servidor; três regras (`cpa.pending`, `pei.overdue`, `school.attendance`) permanecem explicitamente sem adaptador de família. Nenhum adaptador de produção dessas quatro famílias foi implementado neste bloco. Ausência, falha, escopo divergente, dados parciais ou obsoletos não equivalem a zero. A execução é sombra: não persiste, não publica, não envia e não altera notas. `readIntegrationHealth` implementa o contrato RPC já existente de monitoramento (Master com MFA, escopo IES), preservando contagens suprimidas e sem gerar evidência acadêmica. Identidade e permissões precisam vir do backend autenticado, nunca do corpo HTTP. Não usar service_role para contornar o contrato.

### Evidências e decisões
Repositório consultado: `vrcmeirelles-del/vertice-educacao-superior`, revisão 23072ecc79fb23325edfe677d8fa2fad43748ee0. Contratos e pendências detalhados em INTEGRACAO.md. Suíte cumulativa local: 238/238, 18 testes novos, sem dados reais. Não equivale a homologação do portal. Próximo bloco: persistência, transações, permissões reais, adaptadores SQL/RPC, auditoria e testes PostgreSQL descartável. Não ativar IA, cron ou deploy.

## Bloco 08 — Persistência e governança (v0.8)
Preserva integralmente os blocos 01–07 e as 40 regras. O recibo de execução sombra contém escopo, revisão da configuração, UUID da execução, data de referência, estado parcial/avaliado, contagens e identificadores das propostas, com SHA-256 para conferência de integridade (não assinatura nem autenticação). Não inclui texto de aluno nem evidência bruta. O transporte é injetado exclusivamente no servidor, e o recibo só é considerado aceito quando o destino confirma UUID e digest. O esquema SQL candidato define quatro tabelas privadas, restrições de integridade e RLS sem políticas permissivas. Não concede acesso ao navegador nem ao worker. Não há cron nem integração de produção.

### Portas obrigatórias antes de implantação
- Conferir no repositório e no banco os vínculos IES/curso e os contratos nativos de autorização; impor vínculo no servidor e no banco, não apenas FK independente. Autenticação MFA e permissões derivadas de identidade real; nunca aceitar identidade do payload.
- Criar RPC transacional com verificação de configuração vigente, aprovação independente, autorização por escopo e catálogo versionado; calcular digest no servidor e rejeitar conflito do UUID. Testar concorrência, replay, revisão otimista e falhas parciais. O cliente de persistência atual não implementa a transação no banco.
- Implementar fila de alertas operacionais separada de observações sombra; deduplicação entre execuções e ciclo de decisão com auditoria append-only e referências de evidência autorizadas. O candidato atual deduplica somente dentro de uma execução. Não converter observações sombra em intervenções.
- Validar SQL em PostgreSQL descartável (15+), executar testes RLS com papéis reais simulados, incluindo acesso cruzado, usuário sem MFA, revogação e concorrência. Não aplicar migração em produção. Gerar arquivo de migração definitivo via CLI após revisão.
- Definir retenção e minimização de metadados e auditoria; reversão por suspensão seletiva, sem apagar decisões. Revisar permissões do proprietário e papéis privilegiados; RLS não restringe superusuários.
- Próximo bloco 09: painel Master inicialmente somente leitura, mostrando estado real das fontes e bloqueios; nenhum botão de ativação enquanto RPCs e autorização não forem homologados.

### Evidência da execução local
254 testes Node.js aprovados (238 anteriores + 16 novos); zero falhas, zero ignorados. SQL não executado: ambiente sem PostgreSQL/psql. Nenhum dado real consultado neste bloco, nenhum deploy, IA ou agendamento ativado. O esquema e os contratos são candidatos, não persistência operacional homologada.

## Bloco 09 — Painel Master (v0.9)
Preserva os blocos 01–08. O novo modelo de leitura apresenta as 40 regras, versão, prioridade, frequência e estado observado por IES. Estados desconhecidos não equivalem a inativos; fonte indisponível, inválida ou anterior a 24 horas não gera contadores falsos. A projeção rejeita escopo divergente, versão desconhecida, duplicidade e data futura. O limite de 24h é proposta de frescor da projeção, não SLA de cada rotina. Identidade Master, MFA, permissão automation.read e lista de IES autorizadas devem vir da sessão validada no servidor. O painel React candidato é somente leitura, com busca, filtro e identidade visual azul. Não possui comandos de ativação, alteração ou aprovação. A projeção de produção, seletor institucional, visão global agregada, histórico de falhas, custos e testes de renderização ainda são pendentes. Não expor identificadores ou dados acadêmicos brutos. 268 testes Node aprovados (254 anteriores + 14 novos); não foi compilado o TSX nem executado SQL. Próximo bloco 10: painel individual por IES/curso e permissões nativas, mantendo a separação do Master. Nenhum deploy ou IA.

## Bloco 10 — Central de Automação por IES e curso (v0.10)
Preserva os blocos 01–09 e as 40 regras. O painel institucional candidato é somente leitura, com filtros por prioridade e texto e fila de propostas pendentes. O modelo de servidor exige MFA e autorização explícita para o par instituição/curso (curso nulo representa exclusivamente o escopo institucional); não herda autorização institucional ou de outro curso. As permissões propostas `automation.read`, `automation.configure` e `automation.approve` devem ser mapeadas às atribuições nativas, nunca aceitas do corpo HTTP. Configuração e revisão são funções puras, reutilizando a governança do bloco 06; uma proposta não é persistida nem ativa rotinas, e o autor não pode aprová-la. O escopo, versões, duplicidade e frescor da projeção são verificados; dados parciais ou indisponíveis não viram contagem zero. O limite de 24h é provisório para a projeção, não SLA dos jobs. Nenhum dado acadêmico bruto deve ser transportado. O painel não apresenta comandos de escrita e não tem seletor de escopo conectado: a aplicação hospedeira deverá resolver e reautorizar o escopo no servidor a cada consulta. A configuração de limiares específicos, responsáveis, integração com planejamento, persistência e testes de UI/RLS continuam pendentes. Foram executados 286 testes Node (268 anteriores + 18 novos), sem falhas ou skips. TSX não compilado no repositório oficial, SQL não executado. Próximo bloco 11: integração das propostas aprovadas com PEI, Sapiens, 5W2H e BI, mediante contratos nativos e sem efeitos de produção.

## Bloco 11 — Integração estratégica transversal (v0.11)
Preserva os blocos 01–10 e as 40 regras. `src/transversal.mjs` prepara propostas para planejamento e 5W2H e, para regras pedagógicas com curso, Sapiens. Exige escopo exato, MFA, permissão explícita, alerta operacional aprovado com evidência de aprovação verificada, meta ativa, responsável ativo e prazo futuro. Alertas sombra não são elegíveis. O rascunho 5W2H não inventa método ou custo (`null`). Revisão independente reconstrói o rascunho a partir das fontes confiáveis para detectar alterações e mudanças de revisão; aprovação significa apenas aptidão para preparar encaminhamento, não execução. `handoffIntent` gera chave idempotente por proposta e destino, sem chamadas externas. BI conta somente projeção operacional completa, sem duplicidade e com frescor de até 24h (parâmetro candidato); desconhecido permanece nulo. Efetividade reutiliza comparação de agregados homologados do bloco 06 e não atribui causalidade. Nenhuma nova regra de detecção, IA, cron ou deploy.

### Evidência e limites
311 testes Node.js aprovados (286 anteriores + 25 novos), zero falhas e skips. Funções puras, sem integração real. Aprovações, papéis e registros devem ser carregados de armazenamento autenticado e revalidados na transação de destino; não aceitar projeções do navegador. Não existe entrega automática a PEI, Sapiens ou 5W2H; a chave de intenção não substitui restrição única persistente. Mapeamento nativo de metas, responsáveis, modalidades de intervenção, permissões, custos e métricas ainda pendente. O BI não conta intervenções entregues ou concluídas neste bloco. Próximo bloco 12: homologação, reconciliação de fontes, testes reais de RLS/transações e plano de ativação controlada; não ativar antes de autorização expressa.

## Bloco 12 — Homologação e ativação controlada (v1.0-rc.1)
Preserva os onze blocos anteriores e as 40 regras. `src/release.mjs` inventaria regras sem presumir estado operacional e avalia elegibilidade para solicitar autorização, nunca ativa. As oito portas são adaptador nativo, RLS, transação, build de UI, comparação sombra, orçamento, ensaio de reversão e revisão humana. Exige escopo exato, versão da regra, MFA, permissão de revisão, autor distinto, referência para cada evidência e reconciliação de agendamento. Frescor de 7 dias e orçamento por unidade explícita são parâmetros candidatos, sujeitos à aprovação. Três regras ainda sem mapeamento permanecem bloqueadas. O resultado elegível não é autorização nem comprovante de implantação. Evidências devem ser obtidas e validadas no servidor; a função pura não verifica os documentos referenciados nem prova que seus conteúdos são verdadeiros. Não há executor de ativação, SQL novo ou alteração de cron.

### Evidência e pendências
334 testes Node aprovados (311 anteriores + 23 novos), zero falhas e skips, dados sintéticos. Não foram executados SQL, build React, ensaios reais de reversão ou testes de produção. A Bíblia-Mestra v1.0-rc.1 encerra a especificação candidata, não a homologação operacional. A versão definitiva exige aceite e evidências reais. Ver roteiro HOMOLOGACAO.md.

## Integração ao repositório (registro cumulativo)

Os pacotes acima são a fonte normativa. Este registro documenta como foram incorporados ao repositório; não altera requisitos.

| Data | Evento | Evidência | Pendência |
|---|---|---|---|
| 24/11/2026 | Bloco 01 (motor e catálogo) copiado sem alteração para `supabase/functions/_shared/automacao360/`; testes em `scripts/tests/automacao360/`; CI `verify-automacao360.yml` | 42/42 no Node 22 local e no CI | equivalência SHA-256 em Deno |
| 24/11/2026 | Bloco 02 recebido só como contrato; implementação provisória própria, escrita a partir do texto, para não bloquear a sequência | 62/62 com testes próprios | substituir pelo original quando recebido |
| 24/11/2026 | Pacote v0.3 recebido com o código original dos Blocos 02 e 03. A implementação provisória foi **substituída** pelo original (`documentary.mjs`, `pedagogical.mjs`) e pelos testes do pacote. Motor e catálogo conferidos byte a byte: idênticos | 96/96 no pacote e no repositório (Node 22) | ver observações abaixo; adaptadores reais, RLS, persistência, scheduler e UI |
| 24/11/2026 | Pacote v0.4 recebido (Bloco 04, gestão acadêmica). `academic.mjs` e o catálogo de 32 regras copiados sem alteração; motor e Blocos 02/03 conferidos byte a byte: idênticos. As 21 regras anteriores mantêm a versão `2026.11-proposal.1`, portanto as chaves de idempotência já calculadas não mudam | 145/145 no pacote e no repositório (Node 22) | ver observações do Bloco 04; adaptadores reais por módulo, reconciliação de horas e certificados |
| 24/11/2026 | Pacote v0.5 recebido (Bloco 05, inteligência estratégica e comercial). `strategic.mjs` e o catálogo de 40 regras copiados sem alteração; motor e Blocos 02 a 04 conferidos byte a byte: idênticos. As 32 regras anteriores mantêm suas versões | 192/192 no pacote e no repositório (Node 22) | ver observações do Bloco 05; mapeamento de captação, mercado, Due Diligence, faturamento e Conecta; limiares por IES |
| 24/11/2026 | Pacote v0.6 recebido (Bloco 06, governança institucional). `governance.mjs` copiado sem alteração; motor, catálogo (40 regras) e Blocos 02 a 05 conferidos byte a byte: idênticos | 220/220 no pacote e no repositório (Node 22) | ver observações do Bloco 06; persistência transacional com CAS, painel Master/IES, integração ao planejamento existente |
| 24/11/2026 | Pacote v0.7 recebido (Bloco 07, integração nativa). `native-integration.mjs` copiado sem alteração; motor, catálogo e Blocos 02 a 06 conferidos byte a byte: idênticos. Os seis arquivos citados como evidência no contrato existem no repositório; o contrato de `vertice_integration_monitor_read` (migração `20261115012658`) foi conferido contra o adaptador: campos fixos, nove flags, faixas mascaradas (`0`, `1–4`, `5`–`10000`, `10000+`, com o mesmo travessão U+2013) e exigência de Master com `aal2` coincidem | 238/238 no pacote e no repositório (Node 22) | ver observações do Bloco 07; adaptadores reais das quatro famílias; permissão `read_integration_master` a mapear |
| 24/11/2026 | Pacote v0.8 recebido (Bloco 08, persistência candidata). `persistence.mjs` copiado sem alteração; motor, catálogo e Blocos 02 a 07 conferidos byte a byte: idênticos. O DDL `001_candidate.sql` foi guardado em `docs/automacao360/sql/`, **fora** de `supabase/migrations*`, para não ser aplicado por engano. As tabelas referenciadas (`vertice_institutions`, `vertice_courses`) existem na migração `202610260001_access_foundation` | 254/254 no pacote e no repositório (Node 22). **DDL executado** em PostgreSQL 16 descartável com stubs (o pacote registrava "SQL não executado"): ver `sql/verificacao/RESULTADO_20261124.md` | três falhas de integridade a corrigir antes de virar migração (abaixo) |
| 24/11/2026 | Pacote v0.9 recebido (Bloco 09, painel Master somente leitura). `master-dashboard.mjs` copiado sem alteração; motor, catálogo, Blocos 02 a 08 e DDL candidato conferidos byte a byte: idênticos. `MasterAutomationPanel.tsx` guardado em `docs/automacao360/ui/`, fora do cliente, por não estar ligado a rota nem fonte real | 268/268 no pacote e no repositório (Node 22). **TSX compilado** em modo estrito (TypeScript 5.9.3) e **renderizado** com modelos reais de `loadMasterDashboard` (o pacote registrava "não foi compilado o TSX"): ver `ui/VERIFICACAO_20261124.md` | ajustes de interface antes de integrar ao layout Master; projeção real; seletor de IES |
| 24/11/2026 | Pacote v0.10 recebido (Bloco 10, painel por IES e curso). `institution-dashboard.mjs` copiado sem alteração; motor, catálogo, Blocos 02 a 09, painel Master e DDL conferidos byte a byte: idênticos. `InstitutionAutomationPanel.tsx` guardado em `docs/automacao360/ui/` | 286/286 no pacote e no repositório (Node 22). TSX compilado em modo estrito e renderizado em quatro cenários reais: ver `ui/VERIFICACAO_20261124.md` | mapear `automation.read/configure/approve` às atribuições nativas; projeção real; testes de UI no padrão do portal |
| 24/11/2026 | Pacote v0.11 recebido (Bloco 11, integração transversal). `transversal.mjs` copiado sem alteração; motor, catálogo, Blocos 02 a 10, painéis e DDL conferidos byte a byte: idênticos | 311/311 no pacote e no repositório (Node 22) | contrato nativo do 5W2H ausente do repositório (ver abaixo); mapear `automation.*` aos papéis nativos |
| 24/11/2026 | Pacote v1.0-rc.1 recebido (Bloco 12, homologação e liberação). `release.mjs` copiado sem alteração; demais módulos, painéis e DDL conferidos byte a byte: idênticos. `HOMOLOGACAO.md` adotado | 334/334 no pacote e no repositório (Node 22). Estado real das oito portas cruzado com as verificações deste repositório: `ESTADO_PORTAS_20261124.md` — nenhuma porta atendida, 40 regras bloqueadas | ver documento de portas |
| 24/11/2026 | Extração do contrato nativo do 5W2H: SQL da migração `20261111010933` lido de `schema_migrations` (somente leitura) e salvo em `contratos-nativos/5w2h/`; migração do repositório não alterada | MD5 idêntico ao registrado em produção e ao corpo atual das 6 funções. Reprodução em PostgreSQL descartável com o esquema real: **as 6 funções `governance_*` estão quebradas** (colunas `linked_*` inexistentes; `review_status = pendente` viola restrição) e aceitam usuário `leitor` | correção da Governança 360° (migração, sob autorização); handoff da automação deve mirar `vertice_actions`, não essas funções |
| 24/11/2026 | Missão "Integração, homologação e implantação operacional", E1–E3: núcleo de persistência como migração candidata em `supabase/migrations/20261124210000_automacao360_nucleo.sql` (schema `vertice_automation`, RLS fechada, gatilhos de imutabilidade, RPCs com CAS e idempotência, permissões derivadas de `member_role`/`course_function`/`is_master` nativos com MFA); seed gerado das 40 regras (`20261124210001`); matriz de rastreabilidade gerada (`MATRIZ_REGRAS.md`, `--check` no CI) | PGlite (PostgreSQL 17) com o esquema de produção: 18 testes do núcleo; commit `cd9f3a4` | aplicação em homologação real |
| 24/11/2026 | E3/E11: concorrência real (3 corridas em PostgreSQL 16 descartável), correção das 6 funções `governance_*` do 5W2H (`20261124210002`, assinaturas preservadas), equivalência Node/Deno 2.1.4 | 3/3 corridas; 7 testes do 5W2H; 9 chaves SHA-256 idênticas; commit `798fe37` | aplicar correção do 5W2H exige autorização (altera função em produção) |
| 24/11/2026 | E5–E9: adaptadores `source_documentary` (Repositório) e `source_planning` (PEI institucional e CPA), somente `service_role`; e2e sintético fonte → `shadowRun` → recibo → alerta → decisão → 5W2H → verificação → reversão | 25/25 SQL; commit `30e88b5` | demais 36 regras sem adaptador; 9 sem fonte |
| 24/11/2026 | E4: Central de Automação integrada ao Master (`central.tsx`) e à área da IES (aba `automacao360`, grupo Gestão), paleta azul, fundo claro, responsiva; coordenador só vê os próprios cursos; módulo `GEST_AUTOMACAO360` no catálogo com `active=false`. Os painéis candidatos de `docs/automacao360/ui/` não foram copiados: a Central reusa o RPC `vertice_automation_dashboard` | build estático completo; 0 erros TypeScript; 14 testes de interface; suítes do portal 510/452/45/35; commit `fc8cf47` | validação visual e de acessibilidade com usuários |
| 24/11/2026 | E10: reconciliação das 9 rotinas cron (`RECONCILIACAO_CRON_20261124.md`); E12: reversão em 5 níveis (`REVERSAO.md`), estado das portas atualizado | consulta somente leitura; teste de reversão | nenhuma porta verificada no banco real |
| 24/11/2026 | **Autorização do usuário ("Ative").** Ensaio das migrações núcleo e catálogo no esquema real de produção, dentro de transação desfeita (resultado: 40 regras, 6 tabelas com RLS, 8 RPCs, módulo inativo, origem `automacao_360` aceita; nada persistido, conferido depois). Aplicação real das três migrações em transação única, com registro em `schema_migrations` pela versão do arquivo e sha256 (`created_by = automacao360-autorizado-20261124`). Arquivos movidos para `supabase/migrations/` sem alteração de conteúdo | pós-aplicação: 40 regras, 6 tabelas com RLS, módulo `active=false`, 3 registros; `anon` sem execução em nenhuma RPC; adaptadores e `record_run` só `service_role`; avisos do Supabase só os esperados (RLS sem política por desenho; `SECURITY DEFINER` autenticadas com checagem própria) | ativação por IES (licenciamento), configuração e aprovação por duas pessoas, execução sombra com dados reais |
| 24/11/2026 | Divergência **anterior** a este trabalho, entre `supabase/migrations/` e produção: só em produção `20261122201139`, `20261122231214`, `20261123012153`; só no repositório `20261123000000`, `20261123010000`. Não corrigida aqui | consulta somente leitura | reconciliar conforme `supabase/MIGRACOES.md` |
| 24/11/2026 | **Ativação na UNITOP, sem custo** (autorização expressa). Uma linha em `vertice_module_activations` (`status='ativo'`, `package_origin='completo'`, `addon_monthly_fee=0`, `auto_activate=false`). O catálogo segue com `active=false` de propósito: com o módulo visível, gestores de outras IES poderiam iniciar degustação por conta própria. Nenhum adicional criado em `vertice_contract_addons`; o faturamento (`generate_billing_cycle`) só soma mensalidade do contrato e adicionais de contrato | `get_active_tabs` da UNITOP inclui `automacao360`; Faculdade de Caldas Novas não; 0 adicionais de contrato. Valor de tabela de referência, não cobrado: pacote Gestão 360 (ensino superior), ativação de adicional R$ 800 e mensalidade R$ 120 | configuração proposta e aprovada por duas pessoas da UNITOP; execução sombra |
| 25/11/2026 | **Executor autorizado e em produção.** `executor.mjs` (2026.11-executor.1) e Edge Function `vertice-automacao360-run` (só a rotina, `x-cron-secret` conferido por `vertice_espelho_cron_ok`, segredo de vault existente); `vertice_automation_due_configs` (service_role); rotina `vertice-automacao360-daily` às 08h43 UTC. Só modo sombra; operacional fica fora | migrações 20261125090000/1 registradas pela versão do arquivo; teste de fumaça em produção: 200 com segredo válido (0 configurações), 403 com inválido; Node e Deno com o mesmo resultado; 27/27 SQL | nenhuma configuração aprovada ainda: a rotina roda e não executa nada até a aprovação por duas pessoas |
| 25/11/2026 | Leitores acadêmico (TCC e estágio por prazo, checklist teaching-docs-v1) e estratégico (egressos reais pendentes; concorrência aprovada sem ação). Executor 2026.11-executor.2 marca regra sem fonte real como "sem adaptador". `market.new` vira fonte pendente. Seed aplicado congelado; mudança em migração nova | 28/28 SQL; commit `8230f42` | aplicado em 25/11/2026 por autorização expressa (ver linha seguinte) |
| 25/11/2026 | **Leitores e executor v2 em produção** (autorização expressa). Migração 20261125100000 registrada pela versão do arquivo (sha256 f13e1591…); função `vertice-automacao360-run` versão 2 publicada | leitura real da UNITOP em transação desfeita: 2 registros acadêmicos, concorrência com 0 mudanças confirmadas (6 achados pendentes), `market.new` pendente, `authenticated` sem execução; teste de fumaça 200 com `2026.11-executor.2`; 28/28 SQL | nenhuma configuração aprovada: a rotina diária roda sem executar regra até a aprovação por duas pessoas |
| 25/11/2026 | Leitor pedagógico `vertice_automation_source_pedagogical`: Construção Curricular (última matriz publicada; lacuna = competência sem disciplina), Avalia (planos de recuperação ativos por versão de regra) e Permanência (alertas triados por pessoa). `sapiens.low` sem adaptador: sem validação humana nem separação de nota provisória (diretriz 9). Executor 2026.11-executor.3 | 29/29 SQL; 334/334 motor; Deno ok. Fontes vazias em produção hoje | aplicado em 25/11/2026 por autorização expressa: migração registrada pela versão do arquivo (sha256 ec9029d0…); leitura real devolve 0 grupos (fontes vazias); `authenticated` sem execução; função versão 3 publicada, teste de fumaça 200 com `2026.11-executor.3` |
| 25/11/2026 | **Índices da automação** (autorização expressa). O verificador de desempenho do Supabase apontou 6 chaves estrangeiras sem índice em `vertice_automation`; a migração 20261125120000 cria 8 índices (6 chaves + execução e trilha recentes por escopo). Teste novo garante cobertura de toda chave estrangeira do schema | produção: 8 índices, 0 chaves sem índice na ordem exata, registro pela versão do arquivo; 30/30 SQL; o teste falha sem a migração | fora do escopo, anterior: 583 chaves sem índice, 229 índices sem uso e 10 pares duplicados no portal; `vertice_courses_scope_key` e `vertice_courses_institution_id_pair` são idênticos e a chave composta da automação depende de um deles |
| 25/11/2026 | **Executor v4 em produção** (autorização expressa). Defeito apontado pelo CI: o instante da rodada era fixado antes da leitura das fontes, e uma fonte lida no segundo seguinte era recusada como observação futura (execução parcial). O executor 2026.11-executor.4 lê cada fonte uma vez e só então fixa o instante. Segundo defeito, introduzido na correção e barrado pelo CI: `asOf` sem valor padrão em `runAll` quebrava a verificação de tipos do Deno; o cache local do `deno check` escondia o erro (reproduzido com `--reload`) | teste de regressão que falha no código anterior; SQL 31/31; motor 334/334; CI verde no commit 66150ef; função versão 4 publicada, teste de fumaça 200 com `2026.11-executor.4` | nenhuma configuração aprovada ainda |
| 25/11/2026 | **IA substituída por algoritmo onde havia alternativa** (PR #282, autorização expressa de merge e publicação). Relatório da CPA: seções analíticas 9, 10 e 12 redigidas por regras versionadas `cpa-analise-v1` (limites 4,0 e 3,0 na escala 1–5, cruzamento com achados, lacunas declaradas), sem chamada a provedor. Discursiva: segunda opinião por IA na correção retirada (`second_opinion_removed`); pré-nota sempre por algoritmo. Lista padrão de funções que podem usar IA reduzida a transcrição de manuscrito e geração de questão nova. Teste de varredura impede código de servidor que fale com provedor sem o bloqueio | CI verde no commit f73a743; merge 9395a03; publicadas só `vertice-cpa-report` (versão 7) e `vertice-discursiva` (versão 10), conferidas antes contra o código em produção (f10a32b e 040053f) e depois arquivo a arquivo contra o repositório (idênticas; só a grafia do escape `\u0300-\u036f` difere em 3 linhas); teste de fumaça pelo banco: 401 sem credencial nas duas | as outras 8 funções com a cópia da lista padrão ficam para a próxima publicação de rotina (mudança sem efeito: suas funções de IA nunca estiveram na lista e a chave geral mantém a IA suspensa). As 6 correspondências reconhecimento→Novo Instrumento 2026 em produção foram sugeridas por IA (`ai_metadata`) antes da suspensão e seguem sem revisão humana |

Correções de registros anteriores (missão de integração):
- **Bloco 08, Falha 1 — premissa errada.** Afirmei que `vertice_courses` não tem `UNIQUE (id, institution_id)`. Produção tem o índice único `vertice_courses_scope_key` (migração `20261106234208`). A falha do DDL candidato era real (o candidato não usava FK composta), mas a solução correta é a FK composta `(course_id, institution_id) → vertice_courses(id, institution_id)`, adotada na migração `20261124210000`, sem gatilho e sem alterar a tabela central. O mesmo vale para `sql/verificacao/RESULTADO_20261124.md`.
- **PEI é homônimo.** `pei_alerts`, `vertice_pei_alerts_refresh` e o job `vertice-pei-alerts-daily` tratam do Plano Educacional Individualizado. A regra `pei.overdue` trata do Planejamento Estratégico Institucional e usa `vertice_goals`/`vertice_actions`. A observação do Bloco 07 ("a rotina `pei-alerts-daily` já cobre o tema") está errada.
- **Financeiro.** `public.vertice_invoices` é o faturamento da Vértice às IES, não a mensalidade de alunos; `finance.overdue` e `finance.arrears` ficam sem fonte.
- **CPA e Escolas.** `cpa.pending` tem fonte (`vertice_cpa_actions` sem evidência); o "sem adaptador" do `inventory()` refere-se ao motor do pacote, não ao adaptador SQL. `school.attendance` segue sem fonte.

Observações da conferência (não corrigidas, para preservar a versão homologável do pacote):
- `documentaryRun` não recusa `config.ruleIds` com regras não documentais; como só gera registros de `repo.overdue`/`repo.due`, o efeito é nulo, mas o contrato pede configuração exclusivamente documental.
- `documentaryRun` aceita fuso inválido como erro genérico do `Intl` (falha fechada, sem mensagem própria).
- A versão provisória divergia do original em: formato de `deadlineSummary` (objeto × lista por data), retorno de `evidenceChecklist` (objeto × lista com `compliance:null`), data inválida (erro × `issue`) e fuso padrão (exigido × `America/Araguaina`). Prevalece o original.

Observações da conferência do Bloco 04 (não corrigidas):
- Nas regras de horas, documentos, certificados e duplicidade, a revisão enviada ao motor inclui o valor apurado (minutos ou itens faltantes). Cada crédito parcial validado gera uma nova chave e, portanto, uma nova proposta para o mesmo pendente. A persistência deve encerrar a proposta anterior ao abrir a nova, ou a fila acumulará propostas obsoletas.
- O fuso inválido em `academicRun` resulta em erro genérico do `Intl` (falha fechada, sem mensagem própria), como no Bloco 02.

Observações da conferência do Bloco 05 (não corrigidas):
- `strategicRun` aceita um único agregado por entidade e módulo, e cada regra exige um status próprio (`open` para `capture.stale`/`capture.sla`, `validated` para `capture.conversion`; o mesmo em mercado, finanças e egressos). Uma entidade com regras dos dois estados no mesmo módulo gera `state_not_eligible` para metade delas. O adaptador servidor precisa emitir agregados distintos (IDs distintos) por estado, ou o contrato precisa admitir status por regra.
- Diferentemente do Bloco 04, a revisão estratégica não inclui o valor apurado: a variação da taxa dentro da mesma janela e revisão mantém a mesma chave. Coerente com o contrato; a mudança substantiva deve vir pela `revision` atestada pelo servidor.

Observações da conferência do Bloco 06 (não corrigidas):
- O cabeçalho da Bíblia do pacote v0.6 ainda indica "Versão 0.5", embora o conteúdo inclua o Bloco 06 (v0.6).
- O ciclo de `transition` não tem saída para alerta aprovado ou em execução que perde objeto (pendência resolvida na fonte, prazo cancelado, regra desativada). A seção 5 prevê o estado "resolvido" e a fila "em análise"; nenhum dos dois existe na máquina de estados atual. Sem um estado de encerramento administrativo, alertas superados ficam presos em `approved`/`in_progress`. Isso se soma à observação do Bloco 04 sobre propostas superadas.
- Desativar a configuração passa por `configure`, que zera `approved`; como o motor exige `enabled` e `approved`, a desativação tem efeito imediato. Correto como kill switch, mas a reativação exige nova aprovação por outra pessoa, o que deve constar na interface.
- `transition` não confere se `ownerId` pertence ao escopo nem se o aprovador é distinto do executor; ambas as verificações ficam com o servidor, como o contrato prevê.

Observações da conferência do Bloco 07 (não corrigidas):
- `shadowRun` converte qualquer exceção do adaptador ou do executor da família em `source_rejected`, sem motivo. Para o modo sombra isso é seguro (falha fechada), mas a comparação com os indicadores originais exigirá o motivo em log de servidor, sem expô-lo ao cliente.
- `shadowRun` exige UUID em `institutionId`, `courseId` e `actor.id`; os blocos anteriores aceitam IDs opacos. Coerente com o portal (IDs reais são UUID), mas os adaptadores não podem pseudonimizar o escopo antes do orquestrador.
- O fuso é repassado a todas as famílias; `documentaryRun` usa `America/Araguaina` quando ausente, enquanto `academicRun` recusa. O servidor deve sempre informar o fuso da IES.
- `pei.overdue` fica sem adaptador de propósito: a rotina `pei-alerts-daily` já cobre o tema, e `vertice_pei_alerts_refresh` grava, não podendo ser chamada em sombra.

Observações da conferência do Bloco 08:
- Execução real do DDL candidato (PostgreSQL 16, sem dados reais): aplicou sem erro; RLS fechada e revogação funcionam inclusive contra `service_role` com BYPASSRLS; `NULLS NOT DISTINCT`, autoaprovação, digest, status, prioridade e replay conflitante são recusados.
- Falha 1 (confirmada; premissa da solução corrigida no registro da missão de integração): o banco aceita configuração da IES A com curso da IES B. `vertice_courses` não tem `UNIQUE (id, institution_id)`, então não há FK composta; resolver por gatilho de verificação, sem alterar a tabela central.
- Falha 2 (confirmada): `audit_event` aceita `UPDATE` pelo proprietário; a trilha só é append-only por convenção. Exigir gatilho que recuse `UPDATE`/`DELETE`.
- Falha 3 (confirmada, prevista no contrato): `shadow_run` aceita execução ligada a configuração não aprovada e desativada; o RPC (ou gatilho) deve impor a revisão vigente aprovada.
- `persistShadowReceipt` aceita `ack.status` `existing` sem exigir que o digest gravado seja igual; a conferência é feita só contra o digest enviado. O RPC deve recusar `run_id` existente com digest diferente (o DDL já recusa por chave primária, caso 8).

Observações da conferência do Bloco 09:
- `loadMasterDashboard` falha fechado antes de ler a fonte (sem MFA, sem Master, sem permissão ou IES não autorizada) e nunca converte fonte indisponível, inválida ou desatualizada em contadores; regra sem evidência fica "não verificada", não "inativa". Confirmado também na renderização.
- O painel exibe o UUID da IES e o status cru em inglês; reimplementa o filtro sem prioridade; sem `<caption>` e com estilos inline. Detalhes em `ui/VERIFICACAO_20261124.md`.
- A permissão `automation.read` e o campo `actor.master` são propostos; o portal hoje identifica Master por `vertice_admins` com `aal2` (ver `vertice_private.integration_is_master`, migração `20261115012658`). O adaptador de sessão deve derivar ambos dessa fonte, não criar papel paralelo.

Observações da conferência do Bloco 10:
- `loadInstitutionDashboard` exige concessão explícita para o par exato IES/curso; concessão de curso não vale para o escopo institucional e vice-versa. Fila vazia só aparece quando a fonte declara completude; parcial ou indisponível resulta em `pending: null` ("Não verificadas"). Confirmado na renderização.
- O painel institucional já não expõe UUID e traduz o status, corrigindo dois pontos do painel Master; restam identificadores técnicos de regra na fila e a diferença de critério entre os dois painéis para regras não observadas.
- As permissões `automation.*` são propostas. O portal tem papéis nativos em `vertice_memberships` (`gestor`, `equipe`, `leitor`, migração `202610260001_access_foundation`); o mapeamento deve partir deles, não criar papel paralelo.

Observações da conferência do Bloco 11:
- **Contrato nativo do 5W2H não está no repositório.** A migração `20261111010933_governance_360_phase3_routing_5w2h.sql` é só um marcador (`select 1`): foi aplicada direto em produção e o SQL está apenas em `supabase_migrations.schema_migrations.statements`. Antes de qualquer adaptador de `handoffIntent` para 5W2H, extrair esse SQL por consulta somente leitura e versioná-lo como referência. Funções de planejamento presentes no repositório: `vertice_course_planning`, `vertice_planning_management`, `vertice_sapiens_planning`, `vertice_school_planning`.
- `biSummary`: uma única linha `shadow` na projeção invalida o resumo inteiro (`counts: null`); não é "excluída", como sugere o nome do teste. Falha fechada e aceitável, mas o adaptador deve filtrar a fila operacional antes, ou o BI ficará sempre "não verificado".
- `reviewIntervention` reconstrói o rascunho com um ator sintético do autor; não detecta revogação do autor entre proposta e revisão (o contrato atribui isso à transação). Não há segregação entre quem aprova o alerta, quem prepara o encaminhamento e quem revisa, além de autor ≠ revisor.
- O campo `where` do rascunho 5W2H recebe o UUID do curso ou da IES; o destino deve resolver o rótulo legível.

Observações da conferência do Bloco 12:
- `assessRelease` só confere presença de referência textual em cada porta (`ref`); não valida o conteúdo, como o próprio contrato declara. Elegibilidade não é autorização.
- O README do pacote v1.0-rc.1 cita "311 testes" no primeiro parágrafo e "334" no segundo; o correto é 334.
- Pela evidência produzida neste repositório, a porta `rls` está **reprovada** no DDL candidato (três falhas confirmadas) e `ui_build` está apenas parcial. Ver `ESTADO_PORTAS_20261124.md`.

Observações da extração do 5W2H (detalhes em `contratos-nativos/5w2h/README.md`):
- As funções nativas de encaminhamento da Governança 360° falham em produção desde a aplicação; nunca foram exercidas (0 deliberações, 0 eventos). Não servem de destino para `handoffIntent`.
- O destino real é `vertice_actions`. Sua restrição `origin_type` não tem valor para a automação, `origin_ref` é UUID (a chave da automação é SHA-256) e não há unicidade por origem: três ajustes necessários antes de qualquer entrega.
- As funções `SECURITY DEFINER` checam só vínculo (qualquer papel, sem MFA) e contornam a RLS; isso é um problema de autorização do portal, independente da automação.
