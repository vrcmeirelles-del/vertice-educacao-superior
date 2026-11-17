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
