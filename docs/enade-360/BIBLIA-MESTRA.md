# Bíblia-Mestra — ENADE 360°
Versão: 0.1 (proposta documental) | 2026-11-16 | Situação: não homologado

## Princípio imutável
**Primeiro compreender profundamente os resultados oficiais; depois construir a inteligência capaz de transformá-los em decisões acadêmicas fundamentadas.**
Manter o passado recuperável e mirar no futuro: nenhuma nova versão poderá apagar decisões, evidências, limitações ou hipóteses anteriores. Toda correção deverá identificar a versão substituída e o motivo. Git conserva o histórico; o Diário de Bordo registra o significado das mudanças.

## Escopo e precedência
1. Núcleo genérico para **todos os bacharelados**, independente de curso, IES ou rede.
2. Especialização por área e por curso **somente após homologação do núcleo genérico**.
3. Integração futura com Sapiens 360°, planejamento estratégico, CPA e Fato & Ordem, com delimitação de permissões e fontes.
4. Não misturar ciclos, modalidades, instrumentos nem metodologias sem justificativa documentada. Não presumir nota, edição ou ciclo.

## Fontes primárias
- Página INEP Enade bacharelados e cursos superiores de tecnologia: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade-bacharelado-e-superiores-de-tecnologia
- Resultados: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/resultados
- Microdados: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade
- Indicadores: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-de-qualidade-da-educacao-superior
Todo dado importado exige URL, edição, data de extração, versão do arquivo, identificador de área, dicionário de variáveis e trilha de transformação.

## Método científico transversal
Leitura integral de relatórios/notas técnicas -> dicionário de dados e critérios de elegibilidade -> reprodução de indicadores -> comparação histórica somente entre bases comparáveis -> interpretação pedagógica com ressalvas -> hipóteses explícitas -> recomendações revisadas por humanos -> avaliação de resultados das intervenções.
Distinguir Conceito Enade, IDD, CPC e IGC; não tomar faixas como escala intervalar nem correlação como causalidade; preservar medidas contínuas e denominadores quando disponíveis.

## Regras do motor interpretativo (especificação, não normas do INEP)
- EN-001: fonte rastreável e indicador metodologicamente identificado.
- EN-002: comparar mesma área/instrumento e recorte compatível.
- EN-003: detectar quebras de comparabilidade temporal.
- EN-004: exibir universo, amostra, faltantes, filtros e incerteza.
- EN-005: não atribuir causalidade sem método apropriado.
- EN-006: ligar competências e habilidades apenas a evidência documental.
- EN-007: diferenciar fato verificado, cálculo reproduzido, inferência e hipótese; recomendações apontam evidências.
- EN-008: revisão humana da conclusão e da ação proposta, com justificativa.
- EN-009: reproduzir resultados oficiais com rotina automatizada, tolerância justificada e relatório de divergências.
- EN-010: registrar versão do modelo, prompt, dados, autor, parecer e alterações.

## Critério de aceite inegociável do núcleo genérico
**NÃO HOMOLOGAR** até (a) reproduzir corretamente indicadores oficiais selecionados e documentar divergências; (b) explicar limitações estatísticas; (c) distinguir fatos, cálculos e interpretações; (d) emitir relatórios auditáveis com fontes, métodos, versões e aprovação humana. Para cada requisito, produzir evidência independente e teste repetível. Só então iniciar personalização por curso/IES.

## Estado técnico preexistente (consulta ao repositório em 2026-11-16)
Existem interface `source-overrides/client/src/components/area/Enade360.tsx` e migração `supabase/migrations/20261107200000_enade360_continuous_quality.sql` com registros por curso, procedência e validação. Presença em código **não comprova publicação, integridade dos dados ou homologação científica**. Não modificar produção nesta fase documental.

## Evolução sem amnésia
A cada etapa: reler esta Bíblia, o Plano e o Diário; manter decisões anteriores; anexar fontes e resultados; explicitar mudança, impacto, regressões e pendências. Alterações metodológicas recebem novo número de versão. O passado é evidência; o futuro é hipótese/teste, nunca fato consumado.

## Limites desta versão
A análise de relatórios e microdados de 2021–2023 e a reconstrução histórica por curso ainda não foram concluídas nem reprocessadas neste registro. As regras acima são diretrizes de projeto sujeitas a validação.

## Adendo 0.2 — Base oficial de reprodução e horizonte 2026 (2026-11-16)
Conserva integralmente a versão 0.1. A Nota Técnica INEP nº 6/2024 estabelece, para Conceito Enade 2023: indicador por código de curso; exigência de pelo menos dois concluintes com resultados válidos; elegibilidade com TP_INSCRICAO=1, IN_REGULAR=1, TP_INSCRICAO_ADM ∈ {0,2}, TP_PRES=555; exclusões nos itens 5.3–5.5; cálculo de médias brutas FG e CE por curso; médias e desvios-padrão entre cursos da mesma área; padronização e reescalonamento, com tratamento de Z além de ±3; composição NC=0,25×NP_FG+0,75×NP_CE. Não confundir essa composição das notas **padronizadas de curso** com a nota bruta do estudante. Fonte: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nota_tecnica_6_metodologia_calculo_conceito_enade_2023.pdf

**Regras adicionais propostas:** EN-011 — parametrizar filtros de elegibilidade por edição, com contagem de exclusões e código de motivo; EN-012 — padronizar por área e edição, nunca entre provas distintas; EN-013 — distinguir nota individual, média bruta por curso, nota padronizada contínua e faixa do conceito; EN-014 — armazenar tabelas de referência e limiares com notas técnicas versionadas; EN-015 — impedir projeções de resultados oficiais antes da divulgação; EN-016 — separar leitura factual, recálculo replicado e hipótese pedagógica. Regras propostas, não normas adicionais do INEP.

**Acervo confirmado no portal público:** índices de microdados e sinopses para 2021, 2022 e 2023, entre outras edições; disponibilidade de índice não significa leitura/processamento integral dos arquivos. Fontes: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade ; https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/enade ; https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/resultados . Para bacharelados e tecnólogos, a prova 2026 está prevista em 29/11/2026 e a divulgação dos microdados/conceitos a partir de 30/08/2027: https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/exame-nacional-de-desempenho-dos-estudantes-enade . Não tratar previsão como divulgação realizada.

**Estado de evidência:** leitura direcionada da nota técnica 2023 e conferência dos índices oficiais concluídas; ingestão completa de microdados, séries por área, reexecução e conciliação de valores oficiais continuam pendentes. Núcleo NÃO HOMOLOGADO. O conteúdo existente acima é preservado como histórico de decisões.

## Adendo 0.3 — Inventário e prova quantitativa agregada 001 (2026-11-16)
Inventário inicial de 2021–2023: 10 áreas de bacharelado em 2021, 13 em 2022 e 22 em 2023 (45 pares área-edição, NÃO 45 cursos distintos). Arquivo `CATALOGO-BACHARELADOS-2021-2023.md` nesta pasta. Prova quantitativa agregada independente, usando os números do slide 10 da apresentação oficial do INEP de 2022, em `PROVA-QUANTITATIVA-001.md`: 25/26 percentuais de presença e respostas ao questionário conciliados após arredondamento; para Psicologia, 39.135/44.156 = 88,63% (89% arredondado), em contraste com 87% exposto na apresentação. Hipótese sobre origem da divergência não foi comprovada; requer confrontar sinopse/microdados. Inscritos somados em 13 bacharelados = 447.494, igual ao agregado do slide 6.

Regra EN-017 (especificação Vértice): cada número publicado passará por verificação de integridade aritmética, com fonte preservada, discrepância sinalizada e sem correção automática da origem. Advertência: recálculo de taxas com totais publicados NÃO equivale a reprodução dos indicadores oficiais de qualidade. Microdados ZIP ainda não obtidos/processados nesta execução, e nenhum conceito por curso foi reproduzido. Homologação bloqueada.

## Adendo 0.4 — Continuidade autorizada sem ZIP (2026-11-16)
Diretriz explícita do responsável: prosseguir com as etapas INDEPENDENTES do processamento dos microdados; o usuário enviará o(s) ZIP(s) posteriormente. A dependência externa **P-ZIP-001** fica formalmente ABERTA, com responsável pelo fornecimento: usuário, sem data comprometida. Não confundir promessa de envio com arquivo recebido. Os dados brutos não foram recebidos e nenhuma reprodução de conceito foi homologada.

Foram adicionados dois documentos normativos do projeto (especificações Vértice, não normas do INEP): `MATRIZ-COMPARABILIDADE-HISTORICA.md`, com classes C0/C1/C2/C3/C4/CX e critérios de bloqueio, e `PROTOCOLO-INGESTAO-E-ACEITE.md`, com etapas de quarentena, integridade, schema, filtros por edição, recálculo, comparação por curso, relatórios e 12 testes definidos. **Definidos não significa implementados ou executados**.

EN-018: bloquear comparações longitudinais sem compatibilidade demonstrada de área, grau, instrumento e metodologia. EN-019: diferenciar dependência externa de bloqueio metodológico; executar tarefas independentes e registrar seu aceite separadamente. EN-020: exigir identificação, SHA-256 e validação de conteúdo antes de processar ZIP. EN-021: fornecer relatório de divergência curso a curso com proveniência e limites. Versão 0.4 não altera o critério de homologação do núcleo, preserva todos os adendos anteriores e mantém especialização bloqueada.

## Adendo 0.5 — Notas técnicas, contratos de resultados e testes (2026-11-16)
Aprofundamento independente de P-ZIP-001: documentos novos `NOTAS-TECNICAS-POR-EDICAO.md` (NT Conceito 2021 nº 7/2022, 2022 nº 2/2023, 2023 nº 6/2024 e nota individual 2023 nº 12/2024), `CONTRATOS-RELATORIOS-ENADE360.md` (R0 cabeçalho, R1–R7 relatórios e rótulos epistêmicos por afirmação), `CASOS-TESTE-MOTOR-GENERICO.md` (M01–M18, 18 cenários sintéticos de aceite, **apenas especificados**).

**Achado técnico:** a NT nº 12/2024 registra mudança na composição da prova de 2023, com uma discursiva em FG e uma em CE, e alteração nos pesos das questões objetivas/discursivas; exige versão de cálculo individual por edição. Fonte: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nota_tecnica_12_calculo_nota_final_enade_2023.pdf . O portal de resultados 2022 indica atualização das planilhas de Conceito em 08/07/2025: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior/2022 . Portanto, armazenar revisões dos arquivos oficiais usados.

EN-022: cada afirmação em relatório terá classificação OFFICIAL_FACT, REPRODUCED_CALCULATION, STATISTICAL_INFERENCE, PEDAGOGICAL_HYPOTHESIS ou ACTION_PROPOSAL e referências. EN-023: alteração no instrumento, composição ou ponderação impõe nova versão de metodologia, com validação por edição. EN-024: atualizações de planilhas oficiais exigem nova conciliação sem apagar a anterior. EN-025: relatórios sem fontes, denominador, missing, metodologia e revisão humana não podem receber aceite.

**Pendências preservadas:** P-ZIP-001 arquivo(s) ZIP não recebido(s); P-NT-001 leitura integral/validação de fórmulas e notas individuais 2021/2022; P-REF-001 obtenção/versionamento das planilhas oficiais por curso. M01–M18 e T01–T12 não estão implementados nem executados em dados oficiais. Homologação do núcleo e especialização continuam BLOQUEADAS. Alterações apenas documentais na PR #169.

## Adendo 0.6 — Protótipo executável e 20 verificações sintéticas (2026-11-16)
Implementação isolada em `docs/enade-360/validator/validator.cjs` e suíte versionada `validator/test-validator.cjs` (sem conexão com aplicação ou banco). Foram executadas no runtime JavaScript isolado 18 verificações M01–M18 e duas adicionais V01–V02: **20 aprovadas, zero falhas**. Evidências, semântica e limitações constam de `EVIDENCIAS-TESTES-SINTETICOS-001.md`. Não houve execução Node/CI sobre os arquivos baixados do GitHub, nem execução com microdados reais. EN-026: distinguir explicitamente protótipo, teste sintético, teste de CI, validação com microdados e homologação científica. EN-027: quando prova for sintética, registrar fixture, resultado esperado e efetivo sem inferir qualidade de produção.

Permanecem P-ZIP-001, P-NT-001, P-REF-001 e novas pendências P-VAL-002 (Node/CI com artefatos versionados) e P-SCHEMA-001 (validação JSON Schema completa R0–R7). A especialização por curso continua bloqueada. Preservados os adendos anteriores.

## Adendo 0.7 — JSON Schema e validador contratual (2026-11-16)
Entregues `validator/report-schema-0.2.json` (JSON Schema Draft 2020-12 com R1–R7 e 23 campos comuns obrigatórios), `validator/schema-validator.cjs`, `validator/test-contracts.cjs` (26 cenários) e workflow isolado `.github/workflows/enade360-contracts.yml`. Registro em `EVIDENCIAS-CONTRATOS-002.md`. Execução **local** Node.js v22.16.0 sobre cópia de desenvolvimento: 26/26 testes sintéticos passaram; desenho do JSON Schema validado com Python jsonschema. **Não** foi executado checkout da versão gravada no GitHub; CI e SHA ainda pendentes de verificação. Contrato 0.2 e gates semânticos são prototípicos e não reproduzem indicadores oficiais. EN-028: declarar separadamente aprovação de fixture, validação JSON Schema, testes de regras semânticas, execução de CI e confronto oficial. EN-029: cada evidência de teste indicará código/commit, runtime, origem do artefato, entradas e limitações. P-SCHEMA-001 parcialmente atendida; P-VAL-002 parcialmente atendida; P-CI-001 aberta. P-ZIP-001, P-NT-001, P-REF-001 permanecem. Especialização e homologação bloqueadas.

## Adendo 0.7.1 — Confirmação independente do GitHub Actions (2026-11-16)
Concluído `ENADE 360 - Contract Tests`, run `43996319804`, commit `3ee01fd808e10fc2a62dd3b749cad528cf4b3e66`, com conclusão `success`. Os dois passos (suíte Node de cenários sintéticos versionados e verificação de sintaxe JSON Schema) concluíram com sucesso. Isto atualiza a ressalva do adendo 0.7 sobre ausência de confirmação do CI; preserva o registro histórico original e distingue a confirmação posterior. Os testes não constituem validação profunda das instâncias do contrato nem reprodução de indicadores do INEP. P-VAL-002/P-CI-001 atendidas para este commit; P-SCHEMA-001 parcial; P-ZIP-001, P-NT-001, P-REF-001 abertos; especialização BLOQUEADA.
