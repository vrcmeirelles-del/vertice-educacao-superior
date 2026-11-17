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
