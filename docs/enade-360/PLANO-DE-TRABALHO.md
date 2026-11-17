# Plano de Trabalho — ENADE 360°
Versão 0.1 | 2026-11-16 | Somente documentação; nenhuma homologação implícita.

## Etapas e portas de qualidade
1. **Inventário de fontes oficiais:** identificar edições, áreas, relatórios, microdados, notas técnicas e revisões; aceite: links funcionais, versões, inventário e lacunas.
2. **Leitura e interpretação profunda:** analisar relatórios oficiais, dimensões, questões e estatísticas por edição/área; aceite: fichas de leitura com citações e ressalvas.
3. **Séries históricas por área:** construir mapa de ciclos e rupturas; aceite: matriz explícita de comparabilidade; proibir comparações incompatíveis.
4. **Reprodução quantitativa:** processar microdados com scripts versionados, filtrar população, calcular indicadores elegíveis; aceite: conciliação com tabelas oficiais e registro de divergências.
5. **Motor metodológico geral:** implementar EN-001 a EN-010, rótulos fato/cálculo/inferência/hipótese e trilhas de auditoria; aceite: testes automatizados e revisão independente.
6. **Relatórios auditáveis:** panorama, desempenho, perfil discente, indicadores, benchmark por área e intervenções; aceite: fontes, método, amostra, versões e validação humana em cada relatório.
7. **Homologação do núcleo genérico:** verificar conjuntamente todos os quatro critérios obrigatórios da Bíblia. Sem aceite total, bloqueado avanço.
8. **Especialização:** somente após a etapa 7, parametrizar DCNs, matrizes, itens e contexto de cada curso/IES com pilotos controlados.
9. **Integrações:** Sapiens, CPA, Planejamento e Fato & Ordem por contratos de dados, segregação institucional, consentimento/base legal quando aplicável, testes e rollback.

## Ordem imediata
Concluir inventário e leitura das edições oficiais aplicáveis; escolher indicadores reproduzíveis; documentar filtros e dicionário; produzir relatório de diferenças entre edições e áreas. Não presumir completude do acervo ou validação de indicadores.

## Regra de continuidade
Antes de cada etapa consultar os três documentos. Concluído só com evidência; implementado não é testado; testado com mocks não é homologado com dados reais. Preservar produção; documentar bloqueios.

## Adendo de execução — 2026-11-16 (v0.2, sem substituir o plano anterior)
- Etapa 1: inventário inicial dos índices de resultados, microdados, sinopses e nota técnica 2023 confirmado; falta inventariar arquivo a arquivo, checksums, formatos, revisões e todas as áreas de bacharelado.
- Etapa 2: leitura dirigida da Nota Técnica nº 6/2024 realizada; leitura integral dos relatórios síntese por área permanece pendente.
- Etapa 3: elaborar tabela (edição, área de avaliação, grau bacharelado, instrumento, mudança de metodologia, intervalo válido) antes da comparação histórica.
- Etapa 4: pipeline reprodutível deve (1) obter dicionário da edição; (2) aplicar filtros explícitos de concluintes válidos; (3) agregar por código curso e área; (4) excluir cursos SC; (5) obter média/desvio de cursos por área e aplicar extremos e padronização; (6) calcular conceito contínuo/faixa; (7) conciliar com valores publicados e explicar divergências; (8) gerar trilha de exclusões. **Pendente de implementação e execução em microdados reais.**
- Prova de 2026 para bacharelados: 29/11/2026 prevista; microdados/conceitos previstos a partir de 30/08/2027. Não simular como dados publicados.
- Portão de especialização: permanece bloqueado. Atualizações apenas documentais na branch da PR; nenhuma operação em produção.

## Adendo v0.3 — execução da prova 001 (2026-11-16)
- Catalogação 2021–2023 inicial executada e documentada em `CATALOGO-BACHARELADOS-2021-2023.md`: 45 combinações área-edição (10/13/22); catalogação integral desde 2004 pendente.
- Recalcular taxas de 2022 usando 13 áreas: prova quantitativa agregada executada em `PROVA-QUANTITATIVA-001.md`. Resultado 25/26 confrontos consistentes, 1 divergência no percentual de presença de Psicologia; hipótese causal não determinada.
- Próximo critério de aceite: ingestão íntegra dos microdados ZIP e dicionário oficial, SHA-256 dos arquivos, filtros específicos por edição, processamento por área/código e confronto com planilhas dos conceitos contínuos e em faixa.
- Não marcar 'reprodução do Conceito Enade' como concluída com base na prova agregada. Não homologado. Nenhuma mudança de produção.

## Adendo v0.4 — replanejamento sem dependência indevida (2026-11-16)
- **P-ZIP-001 — ABERTA:** aguardando ZIP(s) oficial(is) de microdados enviados pelo usuário, sem prazo definido. Preferir, quando disponíveis, dicionário da edição, nota técnica e tabela oficial de Conceito Enade para conciliação. Não tratar arquivo como recebido nem concluir ingestão.
- Realizado independentemente do ZIP: `MATRIZ-COMPARABILIDADE-HISTORICA.md` (classes C0–CX, exemplos e bloqueios) e `PROTOCOLO-INGESTAO-E-ACEITE.md` (sequência de controle, testes T01–T12 e aceite); arquivos apenas documentais.
- Próximas tarefas independentes: conferir notas técnicas de cada edição; preencher mapeamento dos códigos de áreas, graus, instrumentos e versões; especificar formatos de relatório e de registro de divergências; desenhar testes sintéticos e casos-limite sem alegar validação oficial.
- Tarefas condicionadas a P-ZIP-001: hashes dos arquivos efetivos; parsing real; filtros por edição; recálculo individual de indicadores; conciliação por código; homologação com bases reais.
- Porta de qualidade: mesmo que atividades documentais estejam concluídas, **não avançar à especialização** antes da homologação completa e auditável.

## Adendo v0.5 — entrega independente de ZIP (2026-11-16)
- Criados e verificados três artefatos em `docs/enade-360`: `NOTAS-TECNICAS-POR-EDICAO.md`, `CONTRATOS-RELATORIOS-ENADE360.md` e `CASOS-TESTE-MOTOR-GENERICO.md`.
- Pesquisa: identificadas e registradas NT 7/2022 (Conceito 2021), NT 2/2023 (Conceito 2022), NT 6/2024 (Conceito 2023) e NT 12/2024 (nota individual 2023). Mudança da composição da prova 2023 identificada; sem transcrever fórmulas ainda não auditadas integralmente.
- Contratos propostos R0–R7 definidos, com versões, fonte, população, evidência por afirmação e revisão. Implementação de validador JSON Schema ainda pendente.
- 18 cenários M01–M18 propostos, não executados nem homologados. Próxima tarefa independente: construir fixtures/validador e executar testes sintéticos, depois confrontar todas as normas de edições anteriores. A execução real da reprodução de Conceito Enade depende de P-ZIP-001 e P-REF-001.
- Não há promoção de estágio: porta de qualidade para especialização permanece fechada.

## Adendo v0.6 — primeira implementação do validador (2026-11-16)
- Entregues `validator/validator.cjs` e `validator/test-validator.cjs` como protótipo independente em branch documental. Não integrados ao runtime Vértice.
- Testes sintéticos M01–M18 + V01–V02 executados no JavaScript isolado: 20/20 aprovados; fonte e limitações em `EVIDENCIAS-TESTES-SINTETICOS-001.md`. A suíte salva no GitHub ainda precisa ser executada no Node/CI e anexar logs da mesma versão.
- P-VAL-002: executar Node/CI em artefatos commitados, registrar hash do commit/ambiente, corrigir eventuais falhas.
- P-SCHEMA-001: criar schemas formais R0–R7 e testar validadores profundos, campo a campo, incluindo números, versão, fontes, estado de revisão e status de SC.
- P-ZIP-001/P-NT-001/P-REF-001 permanecem; reprodução de indicadores e homologação não concluídas.

## Adendo v0.7 — contrato estruturado e Node local (2026-11-16)
- Entregues: JSON Schema 0.2, gate semântico prototípico, suíte Node 26 casos, workflow CI isolado, evidência `EVIDENCIAS-CONTRATOS-002.md`.
- Aprovados 26/26 testes sintéticos no Node local; JSON Schema conferido estruturalmente na cópia de desenvolvimento. Não há prova de execução dos arquivos baixados do commit versionado, nem de GitHub Actions verde.
- P-VAL-002 passa a parcial: concluir checkout SHA + execução Node/CI; P-SCHEMA-001 parcial: aprofundar tipos/cross-field, fixture por classe e validação Schema independente; P-CI-001 aberta: registrar job GitHub, SHA, logs e evidência.
- P-ZIP-001 (ZIP), P-NT-001 (notas) e P-REF-001 (fontes de resultados) continuam abertos; núcleo genérico não homologado.

## Adendo v0.7.1 — aceite do CI específico (2026-11-16)
- GitHub Actions `ENADE 360 - Contract Tests` confirmado com conclusão success: run 43996319804 para commit 3ee01fd808e10fc2a62dd3b749cad528cf4b3e66. Os passos de Node e sintaxe JSON concluíram success.
- Marcar P-VAL-002 e P-CI-001 como atendidos apenas para esse commit. **Próximo gate:** validação real do JSON Schema 2020-12 contra fixtures (positivas e negativas) em CI, mais verificações cruzadas; P-SCHEMA-001 permanece parcial.
- P-ZIP-001/P-NT-001/P-REF-001 abertos; sem processamento real e sem homologação.

## Adendo v0.8 — Novo portão de qualidade do CI (2026-11-16)
- Novo Schema 0.3 e bateria com 7 instâncias positivas R1–R7 e 21 negativas, usando Python Draft202012Validator e FormatChecker. Revisão da workflow GitHub Actions para executar efetivamente a validação de instâncias mais testes semânticos Node.
- Entrega de arquivos não equivale a execução comprovada: P-CI-002 exige verificar run final, SHA do commit, logs e resultados. P-SCHEMA-001 exige validar instâncias, consistência entre engines e ampliar asserts cruzados; permanece em andamento.
- Seguintes trabalhos independentes: confrontar exceções do JSON Schema com gate semântico; testar populações e reconciliações contraditórias e rótulos epistêmicos falsos; preparar relatório de equivalência entre R0/R1–R7.
- Dependências preservadas P-ZIP-001, P-NT-001 e P-REF-001. Não avançar a especialização sem reprodução oficial.

## Adendo v0.8.1 — Corrigir falha observada do CI (2026-11-16)
## Evidência de falha e correção — 2026-11-16
- CI inicial do novo gate: GitHub run `43996758502`, conclusão `failure` no passo `Validate positive and negative Draft 2020-12 instances`; gate semântico Node passou (26/26). No Python, 26/28 passaram, 2 falhas: `bad_datetime` e `bad_method_url` foram erroneamente aceitos.
- Causa provável tecnicamente fundamentada: instalação `jsonschema==4.23.0` sem extras de verificadores de formato opcional; isso pode impedir validação de `date-time` e `uri` mesmo quando o `FormatChecker` está presente. Não remover os testes.
- Correção versionada no workflow: `python -m pip install "jsonschema[format]==4.23.0"`, commit `1f62c2163db65309e40957553abc7272d6b603a2`. Resultado final da repetição ainda sujeito a confirmação do CI.
- Esta falha faz parte do histórico auditável e não deve ser apagada. Não representa prova com microdados INEP.

## Adendo v0.8.2 — Integração estrutural e semântica (2026-11-16)
- Gate real 28/28 confirmado no CI run `43996910743` após correção do formato URI/data; histórico da falha anterior preservado.
- Implementado `integrated-gate.cjs` e estendida suíte Python para que as mesmas fixtures percorram JSON Schema e validações semânticas/pedagógicas, adicionando 4 negativos: hipóteses e inferências sem ressalvas, ação sem aprovação, contagens ilógicas.
- Total esperado na nova suíte: 32, ainda sujeito a confirmação de execução CI própria. Próximo passo: obter conclusão final, corrigir eventuais falhas e registrar log, SHA e aceites reais.
- Dependências oficiais P-ZIP-001, P-REF-001, P-NT-001 abertas; sem especialização.

## Adendo v0.8.3 — aceite sintético do gate integrado (2026-11-16)
- CI `ENADE 360 - Contract Tests` concluído success no run `43997052017`, commit `a9cc729dcef66e34adbe9a0ad2d5011f60d94ecc`.
- Evidência: 26/26 cenários semânticos Node, 32/32 validações combinadas Draft 2020-12 + Node (7 aceites positivos e 25 rejeições negativas); testes documentados e logs preservados em `EVIDENCIAS-SCHEMA-003.md`.
- Próximo marco independente: estender cobertura de regras intercampos, identificação de metodologia por edição, controle de SC e tolerâncias, preparar integração controlada sem publicação. Nenhuma especialização até prova oficial.
- P-ZIP-001/P-NT-001/P-REF-001 continuam abertos; homologação do núcleo ainda bloqueada.

## Adendo v0.9 — Aceite do protótipo de controles por edição (2026-11-16)
- Implementados e testados isoladamente filtros/SC para 2022 e 2023, limiares da faixa do Conceito somente em 2023, comparação decimal textual sem tolerância implícita e rótulos distintos para diferença numérica, metodologia incompatível e hipótese pedagógica.
- CI run 43997964988 (commit 2ab634f48ade5dbb22ec40e7e8eb295f319c3258) comprovou 34 novos testes aprovados; ao todo 92/92 nas três suítes sintéticas. Evidência EVIDENCIAS-EDICAO-004.md.
- Próxima tarefa independente P-CROSS-001: vincular códigos e edições aos relatórios R1–R7 e ao gate integrado, impedindo mescla de cursos; P-TOL-001: conferir fonte e tolerâncias específicas antes de admitir aproximações oficiais.
- P-ZIP-001, P-NT-001 e P-REF-001 permanecem. Gate de especialização bloqueado; sem deploy.

## Adendo v1.0 — Integração intercampos e políticas de conciliação (2026-11-16)
- Implementados `cross-report-controls.cjs` e 26 testes de identidade institucional/curso/edição/área/grau, referências versionadas, SC e divergências R7, ligados ao gate interpretativo.
- GitHub Actions run 43999088145, commit 7cad9ec20abc0405d30221d42bf585e233aa31de: 118/118 testes sintéticos aprovados, evidenciados em `EVIDENCIAS-INTEGRACAO-005.md`.
- P-CROSS-001 parcial: completar payloads R2–R6 com schema rico, IDs reais e conciliações agregadas; não confundir teste de campos com integração de banco de dados.
- P-TOL-001 aberta: buscar comprovação documental do tratamento de arredondamentos e tolerâncias no Conceito, IDD, CPC e IGC por edição; não inventar epsilon nem aceitar diferenças automaticamente.
- P-ZIP-001 aguardando arquivos do usuário; P-NT-001/P-REF-001 continuam abertos. Homologação e especialização bloqueadas.

## Adendo v1.1 — Contratos R2–R6 e matriz metodológica (2026-11-16)
- Implementação isolada dos controles R2, R3, R4, R5 e R6, integrada ao gate de relatórios; 23 cenários novos positivos/negativos em `test-r2-r6.cjs`, fixtures adaptadas no Python.
- CI GitHub `43999596607` para commit `265afdf8fed2a80d06eee3d12ae14dad7c106c57`: 141/141 testes sintéticos verdes, conforme `EVIDENCIAS-R2-R6-006.md`.
- Documentada `MATRIZ-METODOLOGIAS-E-TOLERANCIAS.md` com identificação de fontes e lacunas das metodologias de Conceito, IDD, CPC e IGC 2021–2023. Ainda NÃO se concluiu auditoria integral das fórmulas, exceções, precisão, arredondamentos ou tolerâncias.
- Próxima frente independente: aprofundar os contratos R2–R6 com modelos de itens/variáveis por prova, condições de ausência e em especial distinção de SC de indicador não aplicável; parametrizar fontes por edição sem valores presumidos. Executar novos casos de borda e revisão humana.
- P-ZIP-001, P-NT-001, P-REF-001, P-TOL-001 permanecem abertas; P-CROSS-001 parcial até dados reais e integração autorizada. Gate de especialização permanece fechado.

## Adendo v1.2 — Estados de dados e exceções (2026-11-17)
- Criados `result-state-controls.cjs` e `test-result-states.cjs` e integrado o controle ao gate interpretativo.
- Seis estados distintos com exigência documental e semântica; SC restrito a edições/indicadores com política cadastrada; nenhum estado não numérico pode ter valor zero como substituto.
- GitHub Actions run 44016416528, commit 94c42399989dd181a37cf459b4ab48c9a8ca4f45: 178/178 testes sintéticos aprovados, evidências no arquivo `EVIDENCIAS-ESTADOS-007.md`.
- P-STATE-001 aberta: formalizar regras por indicador e edição com fontes, expandir testes e distinguir ausência na fonte, exceção de elegibilidade e inaplicabilidade normativa.
- P-CROSS-001 parcial, P-TOL-001/P-NT-001/P-REF-001 abertas, P-ZIP-001 aguardando usuário.
- Próximo passo independente do ZIP: validar metadados de proveniência nos relatórios R1–R7, matriz de aplicabilidade do indicador, e projetar contrato de importação, sem implantar em produção.
- Núcleo científico e especialização bloqueados até reprodução auditável de indicadores oficiais.

## Adendo v1.3 — Trilha de auditoria sem publicação (2026-11-17)
- Entregues `CONTRATO-RASTREABILIDADE-RESULTADOS.md`, `validator/traceability-controls.cjs`, suíte de 28 testes e seis testes no gate integrado.
- GitHub Actions run 44044766932, commit e55e2ac5c60276c63c2d2030e65d7eda03f233d4: 212/212 testes sintéticos aprovados. Prova e limitações em `EVIDENCIAS-RASTREABILIDADE-008.md`.
- Bloqueada publicação automática; trilha ainda opt-in e não aplicada a dados persistidos. P-TRACE-001 aberta para migração reversível, integridade real de documentos, isolamento por IES/curso, autorização de usuário e testes de ponta a ponta.
- Próximo marco independente do ZIP: desenho de esquema persistente de eventos imutáveis, contrato de API somente leitura de evidências e matriz de permissões por perfil; nenhuma alteração no banco/produção sem homologação técnica e autorização específica.
- P-ZIP-001, P-NT-001, P-REF-001 e P-TOL-001 continuam abertos; P-CROSS-001 parcial; especialização bloqueada.

## Adendo v1.4 — Projeto de persistência auditável e perfil de acesso (2026-11-17)
- Produzidos `ARQUITETURA-AUDITORIA-PERSISTENTE.md`, `validator/audit-event-prototype.cjs` e `validator/test-audit-governance.cjs`.
- GitHub Actions run 44046339541, commit f09ad17a49c1f1d1f2a94222928d56973d829bfb: 240/240 testes sintéticos aprovados, evidência `EVIDENCIAS-GOVERNANCA-009.md`.
- Próxima prioridade técnica: conferir o schema e as permissões reais da Vértice para desenhar migração reversível, seguida de testes de RLS em ambiente isolado; modelar API autenticada GET de eventos, evidências e decisões com logs de acesso, sem endpoint de publicação.
- P-TRACE-001, P-ACCESS-001 e P-API-001 abertas: documentação e simulações não equivalem a aplicação real. Manter P-ZIP-001, P-NT-001, P-REF-001, P-TOL-001 abertas e P-CROSS-001 parcial.
- Nenhum banco ou produção alterado; núcleo genérico e especialização bloqueados.

## Adendo v1.5 — Ciclo 01 em três ações (2026-11-17)
1. **Confronto do repositório:** examinadas as migrations ENADE 360, espelho e área real; identificado acesso por IES, FK composta e lacuna de permissão por curso. Concluído como inspeção de código, não banco vivo.
2. **Plano reversível:** produzido `CICLO-01-TRES-ACOES.md` com contrato de estrutura aditiva e critérios de pré-migração, sem SQL aplicado ou criado para produção.
3. **Testes:** autorização sintética passou a exigir MFA aal2, com dois negativos adicionais. CI `44046955001`, commit d339a13dca41fd834a3095b8edaab828ac3f18a0, 242/242 casos aprovados.
**Ciclo 02 sugerido:** (1) consultar metadados vivos do Supabase em leitura, (2) fechar correspondência papéis-vínculos por curso, (3) preparar testes SQL de RLS em banco isolado. Nenhum deploy implícito.
Pendências P-SCHEMA-REAL-001, P-ACCESS-001, P-TRACE-001, P-API-001, P-CROSS-001, P-ZIP-001, P-NT-001, P-REF-001 e P-TOL-001 mantidas.

## Adendo v1.6 — Ciclo 02 em três ações (2026-11-17)
- **Ação 1:** consulta de catálogos reais do projeto Supabase Vértice, somente leitura; tabelas, constraints, funções relevantes e policies identificadas. P-SCHEMA-REAL-001 parcial.
- **Ação 2:** documentada matriz conceitual de perfis vs `vertice_memberships`, `vertice_impacto_roles` e `vertice_learning_staff_scope`, com necessidade de validar escopo de curso, MFA e mapeamento UUID/bigint. P-ACCESS-001 aberta.
- **Ação 3:** executada suíte sintética de 24 casos JS em CI, não RLS PostgreSQL. Run 44047694892, commit ad82b1c7d743a5934a93c340ab45ae403878a02d: 266/266 testes sintéticos aprovados. P-RLS-SQL-001 aberta (PostgreSQL descartável).
- **Ciclo 03 proposto:** (1) reconciliar contratos e tabelas reais de autorização e vínculo e-ORBIT; (2) preparar testes SQL de RLS para ambiente descartável; (3) executar em banco isolado, se disponível, com provas de negação e rollback. Nada aplicar em produção.
- P-TRACE-001/P-API-001 e pendências científicas preservadas.

## Adendo v1.7 — Ciclo 03, três ações executadas (2026-11-17)
1. Consulta agregada da fonte real: 289 linhas de espelho, 241 com ID, 48 sem, 62 pares distintos, zero linhas em `vertice_enade_course_config`. Criada P-MAP-001 para conciliar por IES/código com evidência, não por aproximação textual.
2. Teste SQL RLS estruturado em `validator/test-rls-postgres-disposable.sql` com PostgreSQL 17 exclusivo do GitHub Actions e sem rede com produção.
3. CI run 44048407509, commit 7a3672384565bd078b30e137e06248d7a5582b96: jobs `contract-tests` e `disposable-postgres-rls` success, 266 testes sintéticos anteriores verdes e teste SQL de isolamento/rollback aprovado.
P-RLS-SQL-001 atendida apenas no modelo. P-RLS-REAL-001 aberta: ensaiar políticas e autenticação efetivas em ambiente isolado com esquema clonado. P-MAP-001 aberta. P-ACCESS-001, P-TRACE-001, P-API-001, P-CROSS-001 e pendências científicas/ZIP preservadas.
**Ciclo 04 em três ações sugerido:** (1) levantar ligações e-ORBIT→Vértice com regras exatas e candidatos não presumidos; (2) projetar clonagem sem PII do schema e políticas RLS atuais; (3) executar teste de regressão em clone descartável, sem alterar produção. Nenhuma especialização antes da homologação com INEP.

## Encerramento da fase técnica — 2026-11-17
Contrato de governança, testes sintéticos e protótipo isolado entregues. Ver `TERMO-ENCERRAMENTO-FASE-TECNICA.md`. Não programar mais ciclos de extensão sem dados ou ambiente que permitam homologação material. Bloqueios específicos: (1) microdados/resultados oficiais para cálculos, (2) equivalência confirmada de 62 pares IES/curso e-ORBIT para integração, (3) ambiente clone para permissões RLS reais e persistência, (4) normas completas de metodologia/tolerância. CI anterior 266/266 testes sintéticos e prova SQL isolada aprovados. O aceite final científico permanece pendente; produção não modificada.

## Atualização de execução (2026-11-17)
- Migração de auditoria privada aplicada no Supabase Vértice e verificada: 10 baselines, trigger e RPC de leitura protegida. Não restam apenas protótipos para esta função de auditoria.
- PR #171 para tela ENADE 360 em validação de CI/merge/deploy.
- Microdados 2023 obtidos? **NÃO**. URL oficial identificada; falha de download; zero resultados oficiais validados no banco. Não há reprodução científica comprovada. Preservar distinção entre integração operacional parcial e homologação científica pendente.

## Fechamento de integração operacional (2026-11-17)
- Migração privada de auditoria instalada/confirmada no Supabase com dez eventos baseline, trigger e função RPC restrita.
- PR #171 integrada na main; deploy Render `vertice-portal` `dep-dbu1er5g1s2s73eoudv0` com status live. Módulo de auditoria operacional publicado na interface.
- Homologação científica oficial NÃO atendida: ZIP e planilhas não processados, zero reprodução oficial; não promover resultados por inferência.

## Execução Work — 2026-11-17 (acumulativa)
- Repositório, PRs #169/#171, deploy live e estrutura Supabase verificados; treze documentos obrigatórios lidos integralmente. Recuperada a migração aplicada que ainda não estava versionada.
- Executada conferência de integridade de 10/10 eventos BASELINE e 10/10 linhas atuais, sem divergência; negação SQL read-only sem identidade confirmada, zero registros/eventos.
- Obtenção oficial executada: 4 HTML com hashes, 18 binários não recebidos por HTTP 503. Recibos arquivo a arquivo preservados. Reprodução e conciliação de Conceito Enade/IDD/CPC/IGC não executáveis sem as bases/documentos. Nenhum valor foi estimado.
- Reconciliado o namespace institucional em leitura; 62 pares de cursos permanecem sem equivalência comprovada. Identificados 49 candidatos apenas textuais e 43 colisões numéricas incompatíveis; nenhum vínculo automático gravado.
- Correções preparadas/testadas: hash v2 verificável, bloqueio científico em trigger e UI, resolução segura do espelho, build de CI igual ao overlay atual. 24 asserts SQL de regressão e 6 testes do leitor passaram; TypeScript/build locais passaram. Não repetir prototipação encerrada.
- Credenciais recusadas pelo portal impedem homologação de sessões reais; não substituir por SQL com claims sintéticos. Permissões de negócio não serão ampliadas automaticamente. Manter P-ACCESS-001/P-RLS-REAL-001 e pendências científicas abertas.
- Confirmar CI da revisão, aplicar somente a migração aditiva testada, integrar e conferir ambos os serviços Render existentes. Registrar o resultado efetivo no próximo adendo de conclusão; esta linha não declara execução futura.

### Precisão dos achados Work
- Acrescentado caso de fuso horário: 25 asserts SQL locais aprovados. Run 44054965128 comprovou em PostgreSQL 17 a revisão anterior de 24 asserts. Os registros históricos continuam intactos.
- Exportados os 62 pares para decisão humana: 49 candidatos textuais únicos, 11 múltiplos, 2 sem candidato. Nenhum candidato foi promovido a equivalência. Snapshot e-MEC existente é parcial e contém instrução de modelo, sem evidência oficial dos códigos de curso.

## Aceite da correção de banco (2026-11-17)
Migração efetiva 20261117092634 aplicada. Trigger v2 ensaiado no banco real e revertido: hashes e cadeia conferidos, 10/10 registros/eventos originais preservados. Código SQL da revisão final passou CI 44055417849 (PostgreSQL 17); renomeação do arquivo sincroniza o repositório com o histórico aplicado e é verificada novamente em CI. Zero grants de curso/papéis ativos nos mecanismos consultados; não ampliar acesso para simular sessões. Dois PDFs disponíveis foram recuperados, mas são duplicatas do relatório Direito/Faculdade de Olímpia 2022, não bases nacionais nem relatórios UNITOP. Ciência e conciliação continuam sem aceite.

## Fechamento efetivo Work — 2026-11-17
PR #169 merged em ff0963d após sete workflows success. Migração 20261117092634 aplicada, trigger e bloqueio testados no banco real com rollback. Deploys live: portal dep-dbu1um0ae00c73a5fd4g e institucional dep-dbu1um0ae00c73a5fd10; artefatos HTTP conferidos com hashes e mensagens da correção. Documentação e evidências preservadas no relatório executivo único. Correções operacionais entregues; sessões reais, equivalências, reprodução e homologação científica não receberam aceite. Nenhum novo ciclo de prototipação aberto. Publicação e especialização bloqueadas.


## Atualização cumulativa — Sessão real Master e recuperação adicional — 17/11/2026

A sessão autenticada Master no Chrome conectado foi utilizada efetivamente. Na instituição FV-DEMO, curso Direito, criou-se uma evidência explicitamente operacional, sem resultado acadêmico, e rejeitou-se o registro pelo portal. A RPC exibiu os eventos INSERT e UPDATE; os dois hashes canônicos v2 foram recalculados no Supabase e coincidem. Registro: `52df267f-1067-4f8d-bf06-8d4db969b7cd`. Os dez baselines anteriores permanecem preservados; após o teste existem 11 registros e 12 eventos. Não houve concessão de privilégios nem publicação de indicador.

A afirmação anterior de ausência de sessão real fica superada para Master. Reitoria, Coordenação, NDE e CPA continuam sem teste de sessão real; não houve novo desafio MFA. O Master é global: sua leitura de UNITOP e FV-DEMO não comprova isolamento dos perfis restritos.

Foi confirmado um defeito de atualização: o histórico aberto não refletia imediatamente a rejeição. A correção invalida o painel após escrita; teste de regressão UI aprovado (1/1) e TypeScript aprovado. Sua integração/publicação deve ser comprovada pela PR e deploy, sem presumir sucesso antecipado.

Foi acrescentada execução no GitHub Actions para receber diretamente os 18 binários oficiais anteriormente indisponíveis, registrar SHA-256 e verificar estrutura/CRC. Neste registro a execução ainda não está concluída; não contar arquivos, reproduções ou conciliações sem recibo real. A homologação científica continua bloqueada.

Evidência: [sessão Master](evidencias/20261117-work/master-real-session.json). O comprovante anterior de testes transacionais permanece intacto, como histórico.


## Fechamento verificável — Encerramento da execução conectada — 17/11/2026

PR [#173](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/173) integrada pelo commit `f116cddc83766be5a79f5c16ccc2ae8f39b5fcde`. Seis workflows técnicos concluíram com sucesso, incluindo TypeScript Node 22/24, regressão UI do histórico e builds. Deploys live: portal `dep-dbu2k6lbedkc73eutlfg` (07:19:44, Brasília) e institucional `dep-dbu2k6lbedkc73eutlk0` (07:19:47). `version.json` e chunks efetivamente servidos confirmam o commit, a invalidação do histórico após escrita e a mensagem de homologação pendente.

Teste HTTP real adicional, sem token de usuário: leitura retornou HTTP 200/lista vazia e RPC de auditoria retornou HTTP 401/permission denied. Nos logs reais da sessão Master: criação 201, rejeição 204 e RPC 200. Esses resultados não comprovam os perfis Reitoria/Coordenação/NDE/CPA nem um novo desafio MFA.

A execução de aquisição no GitHub [44063161236](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44063161236) terminou: 18 alvos, zero recebidos. HTTPS apresentou falha TLS; o diagnóstico direto não recebeu certificado do par e registrou reset de conexão. A tentativa alternativa HTTP no mesmo host oficial terminou em timeout para os 18 alvos. A verificação TLS não foi desativada. Sucesso da execução do workflow significa geração dos recibos, NÃO recuperação ou validação dos dados.

Os catálogos oficiais de IDD/CPC/IGC e de notas 2021–2023 foram recebidos e preservados com SHA-256. Quinze notas técnicas e os três pacotes públicos de microdados IDD foram tentados diretamente e retornaram HTTP 503. O catálogo oficial confirma que a NT 29/2023 substitui a NT 3/2023 do IDD 2022 e referencia a NT 5/2024 para a transição do IGC 2022. Foram localizadas referências, não lidos integralmente os PDFs indisponíveis. Não se deve afirmar que o IDD é genericamente impossível por ausência de ligação pública: existe pacote IDD oficial; seus bytes ainda não foram recebidos nesta execução.

Contagem reconfirmada: espelho 289/241/48, 62 pares IES/curso, cadastro 196, equivalências 0. Nenhum vínculo por nome ou código de namespace incompatível foi gravado. Núcleo científico: zero indicadores reproduzidos, zero conciliações com planilhas oficiais, zero aprovações científicas humanas. Homologação e publicação acadêmica continuam bloqueadas; a integração técnica não autoriza especialização por bacharelado.

Evidências adicionais: [sessão Master](evidencias/20261117-work/master-real-session.json), [negação HTTP real](evidencias/20261117-work/anonymous-http-access.json), [artefatos publicados](evidencias/20261117-work/published-audit-refresh.json), [recibos GitHub](evidencias/20261117-work/github-official-receipts.json), [catálogos metodológicos](evidencias/20261117-work/methodology-catalog-receipts.json). Permanecem intactas as entradas anteriores, inclusive tentativas de login e testes transacionais anteriores.


## Camada de evidências: classificação, extração e vínculos — 17/11/2026

O recorte correto é o repositório de ensino superior: 776 arquivos no conjunto, 771 da UNITOP com objetos presentes no Storage; 515 classificações existentes no conjunto, 511 na UNITOP. Os 11 registros de vertice_documents são da Escola Vértice — Demonstração, sem objetos originais; não representam a ausência de documentos do ensino superior e não foram artificialmente preenchidos.

Foi aplicada a migração 20261117113047_enade360_evidence_text_index: texto e páginas extraídas, SHA-256, método, cobertura parcial e sugestões de palavras-chave na pré-validação existente; busca compartilhada por arquivo/curso/indicador/solicitação/meta. RPC usa security invoker, MFA e perfil de gestão já autorizado, além das RLS existentes. As 14 políticas consultadas, 776 arquivos e 515 classificações permanecem preservados. Contexto sem identidade: autorização false e zero resultados.

O código substitui leitura binária de PDF/ZIP por parsers PDF/DOCX/XLSX/PPTX, com limites e rejeição de imagens sem OCR; preserva páginas/células/partes XML e não envia conteúdo à IA na ação index. Citações sugeridas precisam existir no texto da página indicada; os vínculos permanecem sugeridos até revisão humana. O catálogo institucional estava vazio: não se utilizam códigos e versões regulatórias inventados. A busca foi preparada para ENADE, Sapiens e planejamentos, com origens institucionais separadas dos vínculos do curso.

Validação local: 8 testes de motor/banco e 2 de UI, TypeScript aprovado. Um PDF existente foi realmente extraído: 46 páginas físicas, 69.619 caracteres, SHA-256 8ac0753e25be12d34349ee6d26a9b97e53bdcdd387963b538cfd619c04812c9a. É cópia do Drive do relatório de Direito/Faculdade de Olímpia/2022; não é original autenticado INEP nem UNITOP. Esse teste não é reprodução de indicador. Páginas sem texto exigem conferência e a cobertura parcial é explicitada.

Publicação da função e interface: pendente neste registro. Nenhum dos arquivos privados foi declarado processado em lote. O navegador em nuvem abriu o login do Supabase, sem sessão; o conector retornou erro interno ao recuperar a fonte implantada da função. Não foram emitidas credenciais, ampliadas permissões ou publicadas notas oficiais para contornar a dependência. Evidência: evidencias/20261117-work/evidence-layer-status.json.


## Publicação comprovada da camada documental — 17/11/2026

A PR [#175](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/175) foi integrada no commit `c266140afcb9c81d612a5c7917d476329e3aff6a`, após nove workflows aprovados no head `27d60d8a99c0a3183b64c58ad5fbde9050e51744`. A função existente vertice-doc-prevalidate foi publicada na versão 3, com verify_jwt=true; os três arquivos recuperados da implantação conferem byte a byte com a fonte preparada. O erro de recuperação da versão anterior não impediu a verificação da versão nova.

Render: institucional `dep-dbu6n0ijnfac73e5ceig` e portal `dep-dbu6n0ijnfac73e5cem0`, ambos live em 17/11 às 11:58:52 (Brasília). A busca compartilhada e as ações de indexação estão integradas à interface. As requisições HTTP reais sem sessão para indexação e busca foram negadas com 401. A migração mantém as políticas e os dados existentes.

Contagem final: 776 arquivos/515 classificações existentes preservados; zero fontes privadas indexadas nesta execução e zero vínculos IA criados. Na UNITOP, 768 dos 771 arquivos já possuem vínculo de curso, três são institucionais e nenhum possui vínculo de meta. A busca recupera relações existentes e não cria associações a metas por suposição.

A autenticação segura no navegador expirou sem confirmação; em uma aba nova, /master exibiu “Entre para acessar sua conta”. Portanto a etapa de processamento do acervo privado permanece pendente de sessão real com MFA. O catálogo institucional de instrumentos continua sem registros configurados: a classificação por códigos e versões requer fonte/catalogação verificável, enquanto os indicadores já cadastrados nos arquivos permanecem preservados. O lote não foi dado como processado, e esta publicação técnica não homologa indicadores oficiais.

Evidências: [estado final](evidencias/20261117-work/evidence-layer-status.json), [função publicada](evidencias/20261117-work/evidence-function-deployment.json), [negação HTTP](evidencias/20261117-work/evidence-anonymous-http.json), [arquivos servidos](evidencias/20261117-work/evidence-published-assets.json).

A inspeção dos JavaScripts efetivamente servidos localizou a RPC vertice_evidence_search e o controle de extração dos resultados no chunk compartilhado PlanningManagement, em ambos os domínios. As verificações em chunks individuais que não contêm o módulo foram mantidas no recibo; o scan de dependências identifica os arquivos corretos e seus SHA-256. Isso comprova presença do código publicado, sem substituir teste autenticado do processamento privado.


## Catálogo de referência aplicado e origem preservada — 17/11/2026

Aplicada no Supabase a migração `20261117153003_enade360_official_reference_catalog`. A UNITOP passou de zero para um catálogo ativo, IACG de reconhecimento/renovação de reconhecimento, edição outubro/2017, com 58 objetos. Foram conferidos todos os títulos, 35 textos de aplicabilidade e respectivas páginas físicas em uma cópia da publicação INEP redistribuída no repositório oficial da UFAL: 908.787 bytes, 54 páginas, SHA-256 `bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768`. O catálogo registra as URLs canônica e de obtenção, data, hash e limitações. A igualdade binária com o servidor INEP não foi comprovada; a rota direta respondeu 503. O original recebido foi preservado no [pacote de fonte](https://chatgpt.com/library?file_id=libfile_5860a77abee08191a7e61ec06bcc1cf5&account_id=personal).

O catálogo permite sugerir códigos de uma referência rastreável; não contém critérios para calcular conceitos, não aprova vínculos e não aplica automaticamente indicadores a cursos. Dois títulos existentes abreviados (2.15 e 3.15) foram completados somente no novo catálogo, sem reescrever classificações históricas. Não foi ativado instrumento proposto de 2026 como norma vigente.

Verificação posterior no banco: um catálogo, 58 objetos e correspondência exata com o arquivo de referência; 776 arquivos, 515 classificações, 771 arquivos UNITOP, zero pré-validações e zero vínculos IA. Políticas de acesso dos catálogos idênticas antes/depois. Nove testes locais de extração/banco aprovados, incluindo execução e repetição idempotente da migração em PostgreSQL isolado; a autenticação desses testes é sintética e não substitui sessão real. As 58 verificações do PDF usaram bytes reais e não constituem reprodução científica de indicador.

A nova conferência do navegador em nuvem abriu /master e recebeu “Entre para acessar sua conta”. O controle da sessão anterior pela extensão não está disponível nesta execução. Nenhuma credencial foi fabricada nem proteção removida: o lote privado permanece em zero processados. A reprodução e conciliação científica de Conceito Enade, IDD, CPC e IGC seguem sem comprovação; publicação de resultados oficiais bloqueada.

Evidências: [catálogo](fontes/iacg2017-reconhecimento-catalog.json), [verificação do PDF](evidencias/20261117-work/reference-catalog-extraction.json), [conferência do banco](evidencias/20261117-work/reference-catalog-database.json). Integração GitHub/CI deste bloco: a confirmar após publicação da branch.


### Integração e publicação confirmadas — catálogo IACG 2017

PR [#176](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/176) integrada no commit `147dee06c1b405fea9a0d5b21af650ad735f9b4f`, após cinco workflows aprovados no head `55211f5aa6173c1281b31fab34c48d12e5055cb2`. O workflow de evidências executou nove testes e a verificação Deno da função existente. Render institucional `dep-dbu793tckfvc73cc19q0` live às 12:37:31 de 17/11 (Brasília); portal `dep-dbu793tckfvc73cc19u0` live às 12:37:29. Os alertas de segurança mantiveram as contagens anteriores, sem achados para as duas tabelas de catálogo. Esta confirmação resolve a pendência de integração/publicação do registro anterior; mantém pendentes a sessão autenticada, o lote privado e a homologação científica. [Recibo de publicação](evidencias/20261117-work/reference-catalog-publication.json).
