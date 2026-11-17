# Diário de Bordo — ENADE 360°
Registro acumulativo; nunca substituir entradas antigas. Data: 2026-11-16.

## Entrada 001 — Diretriz e escopo
- Decisão: primeiro compreender os resultados oficiais, depois desenvolver a inteligência interpretativa.
- Escopo: núcleo genérico para todos os bacharelados; especialização por curso/IES posteriormente.
- Porta de homologação: reprodução de indicadores oficiais; limitações estatísticas; distinção entre fatos e interpretações; relatórios auditáveis.
- Status: diretrizes aprovadas pelo responsável pelo projeto. Implementação/homologação do novo método: **não comprovadas**.

## Entrada 002 — Diagnóstico documental de repositório
- Consulta constatou `source-overrides/client/src/components/area/Enade360.tsx` e `supabase/migrations/20261107200000_enade360_continuous_quality.sql`.
- Código registra classes de dados e proveniência/validação; não é evidência de homologação de indicadores nacionais ou validação em produção.
- Busca por "Bíblia-Mestra" e "diario de bordo" no repositório não localizou arquivos correspondentes nas buscas efetuadas; isso não prova inexistência em caminhos não indexados.
- Ação: propor documentação inicial em branch separada; nenhuma alteração de aplicação/banco.

## Pendências abertas
- Leitura integral e conferência das fontes do INEP, inclusive relatórios síntese por área.
- Tratamento comparável de edições, mudanças de metodologia e lacunas.
- Processamento reprodutível de microdados, recálculo e conciliação dos indicadores.
- Testes independentes e homologação do núcleo genérico.
- Planejamento de futuras especializações e integrações condicionado à homologação.

## Protocolo das próximas entradas
Data/hora; etapa; fonte/URL/versão; ação executada; resultado e evidências; limitações; decisão; mudanças de critérios; responsável e próximo teste. Jamais transformar uma intenção em status concluído.

## Entrada 003 — 2026-11-16 — Verificação metodológica transversal INEP
- Fontes consultadas: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/resultados ; https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade ; https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/enade ; Nota Técnica nº 6/2024: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nota_tecnica_6_metodologia_calculo_conceito_enade_2023.pdf ; calendário https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/exame-nacional-de-desempenho-dos-estudantes-enade .
- Fatos conferidos: filtros de elegibilidade 2023 e exigência mínima de 2 concluintes válidos; médias por curso/área, reescalonamento e pesos 25% FG e 75% CE padronizados. Índices de microdados 2021–2023 disponíveis. Aplicação de bacharelados 2026 prevista para 29/11/2026, microdados/conceitos previstos desde 30/08/2027.
- Interpretação: média bruta de estudantes não equivale automaticamente ao Conceito Enade; comparação exige identificação de área, edição e método.
- Limites: nenhuma base de microdados 2021–2023 foi integralmente processada neste registro; nenhum indicador foi reproduzido numericamente ou homologado; sem diagnóstico por IES/curso.
- Decisão: acrescentar regras EN-011 a EN-016; preservar núcleo genérico para bacharelados, adiar qualquer especialização.
- Próximo teste: baixar arquivos e dicionários oficiais, catalogar todas as áreas, testar filtros e confrontar resultados calculados com planilhas oficiais de conceito.

## Entrada 004 — 2026-11-16 — Inventário e primeira conciliação agregada
- Atos: inventariadas as listas oficiais de bacharelados de 2021 (10), 2022 (13), 2023 (22), preservadas em `CATALOGO-BACHARELADOS-2021-2023.md`; criada `PROVA-QUANTITATIVA-001.md` com linhas de entrada e cálculo reconstruível.
- Fonte do teste: https://download.inep.gov.br/educacao_superior/enade/apresentacao/2022/apresentacao_resultados_enade_2022.pdf (slides 6 e 10). Apresentações e documentos usados para a lista: https://download.inep.gov.br/educacao_superior/indicadores/resultados/2021/apresentacao_CPC_IGC_2021.pdf e https://www.gov.br/inep/pt-br/relatorio-anual-de-atividades-e-gestao-do-inep-2023/avaliacoes-e-exames-educacionais/avaliacoes-exames-nacionais/enade .
- Resultado: 447.494 inscritos em bacharelados de 2022 reproduzidos por soma; 25 dos 26 percentuais publicados conciliados por arredondamento; Psicologia 39.135/44.156=88,63% contra 87% na fonte (1 divergência).
- Limite: uso de estatísticas agregadas publicadas, não de registros individuais ZIP. Acesso aos downloads brutos não se concretizou nesta sessão. Sem reprodução de Conceito Enade nem diagnóstico por IES. Área 2023 validada como 22 bacharelados no relatório institucional. Nomes e códigos finais precisam de dicionários e anexos.
- Decisão: EN-017, validação aritmética e relatório de divergências sem alterar a fonte. Portão para especialização fechado.
- Próximo passo: baixar e verificar ZIPs e planilhas oficiais, processar filtros e notas para primeira reconciliação por código de curso.

## Entrada 005 — 2026-11-16 — Autorização para prosseguir e registro da dependência
- Solicitação do responsável: 'Prossiga para próxima depois te mando o zíp anote na Bíblia a pendências'. Interpretação operacional: desenvolver documentação independente, sem declarar testes de microdados concluídos.
- Consulta anterior aos três documentos realizada antes da mudança. Histórico 0.1 a 0.3 preservado.
- Criados `MATRIZ-COMPARABILIDADE-HISTORICA.md` e `PROTOCOLO-INGESTAO-E-ACEITE.md` com classes de comparabilidade, schema mínimo, doze testes especificados e critérios de aceite.
- **Pendência externa P-ZIP-001:** entrega posterior do(s) ZIP(s) oficial(is) pelo usuário; estado AGUARDANDO RECEBIMENTO, prazo não definido. Dependências: ingestão/validação do arquivo, recálculo de indicadores e conciliação contra tabelas INEP.
- Evidência desta execução: alterações apenas na branch documental da PR #169, sem leitura de registros individuais, sem testes reais e sem modificações de aplicação ou produção.
- Próxima ação independente: verificação adicional de notas técnicas e contratos de saída dos relatórios, preservando a matriz; retomar processamento quando o ZIP chegar. Núcleo ainda NÃO HOMOLOGADO.

## Entrada 006 — 2026-11-16 — Auditoria documental e contratos interpretativos
- Consultadas fontes públicas oficiais do INEP: NT nº 7/2022 (2021), NT nº 2/2023 (2022), NT nº 6/2024 (2023), NT nº 12/2024 (cálculo da nota individual de 2023), página de planilhas 2022, documentação geral dos indicadores.
- Resultado: localizado conjunto de quatro notas técnicas com finalidade distinguida; identificada mudança na composição da prova em 2023 e existência de revisão posterior de planilha de conceitos de 2022. Ressalva: consulta dirigida, NÃO auditoria integral de todos os cálculos e versões.
- Entregues especificações `NOTAS-TECNICAS-POR-EDICAO.md`, `CONTRATOS-RELATORIOS-ENADE360.md` e `CASOS-TESTE-MOTOR-GENERICO.md` (18 cenários). Nenhum cenário foi executado contra motor em produção nem usado para homologação.
- Pendências: P-ZIP-001 (fornecimento ZIP pelo usuário); P-NT-001 (análise completa/itens das NTs por edição, inclusive nota individual 2021/2022); P-REF-001 (planilhas oficiais versionadas por código de curso); validador automático ainda não implementado.
- Decisão: continuar documentando sem perder adendos anteriores, preservar código e produção, não especializar por curso; próximo marco é implementar um validador e executar testes sintéticos independentes do ZIP, identificando claramente que isso não reproduz indicadores oficiais.

## Entrada 007 — 2026-11-16 — Protótipo e testes sintéticos
- Consultadas Bíblia, Plano e Diário cumulativos antes da implementação.
- Código criado: `docs/enade-360/validator/validator.cjs` (validador contratual básico, comparabilidade, elegibilidade sintética, percentuais e conciliação), `docs/enade-360/validator/test-validator.cjs` (20 cenários).
- Execução efetiva: no runtime JavaScript isolado, M01–M18 e V01–V02 executados com resultado 20 PASS / 0 FAIL; registro em `EVIDENCIAS-TESTES-SINTETICOS-001.md`.
- Limitação: código não está integrado nem publicado; suite Node/CI do repositório não executada nesta sessão; resultado sintético não é conferência oficial por curso, nem homologação científica.
- Pendências: P-ZIP-001, P-NT-001, P-REF-001; abertas P-VAL-002 (executar versionados via Node/CI) e P-SCHEMA-001 (JSON Schema integral).
- Decisão: preservar a PR documental, não alterar sistemas em produção, manter portão de especialização fechado.

## Entrada 008 — 2026-11-16 — Contratos JSON Schema e execução sintética Node
- Consultados os três documentos de governança, preservadas entradas 001–007.
- Criados na branch documental arquivos `validator/report-schema-0.2.json`, `validator/schema-validator.cjs`, `validator/test-contracts.cjs` e `.github/workflows/enade360-contracts.yml`. Nenhuma integração de aplicação ou banco.
- Execução observada: Node.js v22.16.0 no ambiente local de desenvolvimento, 26 testes, 26 PASS, 0 FAIL. JSON Schema verificado com Python Draft202012Validator.check_schema em cópia local.
- Limites expressos: acesso HTTP direto à branch GitHub indisponível; código local não conferido byte a byte com o versionado. Nenhum GitHub Actions confirmado verde, nenhuma reprodução de indicador com microdados reais.
- Evidência principal: `EVIDENCIAS-CONTRATOS-002.md`; pendências P-VAL-002 (parcial), P-SCHEMA-001 (parcial), P-CI-001 (aberta), P-ZIP-001/P-NT-001/P-REF-001 (abertas). Homologação bloqueada.

## Entrada 009 — 2026-11-16 — Confirmação GitHub CI
- Consulta dos workflow runs do commit `3ee01fd808e10fc2a62dd3b749cad528cf4b3e66` e dos jobs do run `43996319804`.
- Resultado final: workflow `ENADE 360 - Contract Tests` `completed/success`; passo de execução sintética Node 22 `success`; passo de sintaxe JSON `success`.
- Escopo do resultado: arquivos efetivamente versionados executados no checkout GitHub e parse do JSON; NÃO prova validação das instâncias contra todos os requisitos do Schema, nem reprodução de nota ou conceito oficiais.
- Evolução das pendências: P-VAL-002 e P-CI-001 atendidas nesse commit; P-SCHEMA-001 parcial; P-ZIP-001/P-NT-001/P-REF-001 permanecem. Não houve alteração de produção; portão de homologação permanece fechado.
