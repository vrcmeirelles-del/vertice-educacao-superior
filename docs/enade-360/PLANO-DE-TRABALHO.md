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
