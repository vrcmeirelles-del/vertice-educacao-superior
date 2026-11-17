# Matriz de metodologias, denominadores e divergências — ENADE 360°
Versão 0.1 | Data 2026-11-16 | Status: conferência documental dirigida, NÃO auditoria integral de todas as notas técnicas

## Regra de ouro
A unidade de evidência é (indicador, edição, fonte, versão do arquivo, metodologia, nível de agregação, população elegível, regra de cálculo, arredondamento). Uma metodologia não pode ser copiada para outra edição por analogia.

## Matriz documental
| Indicador | Edição 2021 | Edição 2022 | Edição 2023 | Nível | Prova quantitativa |
|---|---|---|---|---|---|
| Conceito Enade | NT 7/2022 — documento identificado | NT 2/2023 — documento identificado | NT 6/2024 — documento identificado, faixas contínuas verificadas | Curso/área | Ainda sem reprodução por código |
| IDD | Nota específica e parâmetros ainda a conferir | Aperfeiçoamento metodológico mencionado na NT 5/2024 (IGC 2022), com referência à NT 29/2023 | Portaria 500/2024 indica insumos e notas específicas por indicador; fórmula completa pendente | Curso | Sem vínculo Enade-Enem individual |
| CPC | Nota técnica por edição pendente de auditoria integral | Planilhas com revisão em 08/07/2025 | Portaria 500/2024 prevê fontes Enade, Enem, Censo e questionários | Curso | Sem componentes completos |
| IGC | Nota por edição pendente de auditoria integral | NT 5/2024 estabelece transição; planilha revisada em 17/09/2025 | Portaria 500/2024; usa informações de graduação e CAPES quando aplicável | Instituição/triênio | Sem base censitária/Capes |

Fontes oficiais:
- 2021 Conceito: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2019/nota_tecnica_n_7_2022_CGCQES_DAES_metodologia_calculo_conceito_enade_2021.pdf
- 2022 Conceito: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2023/nota_tecnica_n_2_2023_cei_cggi_daes_descricao_da_metodologia_de_calculo_do_conceito_enade.pdf
- 2023 Conceito: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nota_tecnica_6_metodologia_calculo_conceito_enade_2023.pdf
- IGC 2022/Transição IDD: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nt_5-2024-CEI-CGGI-DAES-sobre_IGC_2022.pdf
- Indicadores e critérios gerais: https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/indicadores-de-qualidade-da-educacao-superior
- IDD: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-de-qualidade-da-educacao-superior/indicador-de-diferenca-entre-os-desempenhos-observado-e-esperado-idd
- CPC: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-de-qualidade-da-educacao-superior/conceito-preliminar-de-curso-cpc
- IGC: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-de-qualidade-da-educacao-superior/indice-geral-de-cursos-igc
- Planilhas 2022 e versões: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior/2022
- Portaria 500/2024: https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=26%2F11%2F2024&jornal=515&pagina=32

## Critérios de arredondamento/tolerância
1. Preservar valor contínuo original, escala, precisão publicada e data de extração.
2. A conversão para faixa do Conceito Enade de 2023 usa limiares 0,945; 1,945; 2,945; 3,945 (NT 6/2024); esse limiar não é tolerância de cálculo nem arredondamento facultativo.
3. Testes de apresentação com arredondamento decimal positivo (half-up) são convenção interna sintética e só podem produzir status ROUNDING_REVIEW, nunca MATCH automático.
4. **Nenhuma tolerância de reprodução oficial** (epsilon) está autorizada: enquanto não houver regras de precisão/arredondamento verificadas para a edição/indicador, diferenças não idênticas são divergências a investigar.
5. Separar origem da divergência: erro aritmético de cálculo, metodologia incompatível, versão distinta de fonte, contexto de amostragem não comparável ou hipótese pedagógica. Causalidade não é inferida.
6. Revisões de planilha anulam aceite anterior até reconciliação com a versão correta; preservar ambos os arquivos e hashes.

## Regras de níveis e indicadores
- Conceito Enade e CPC: unidade curso. Não transformar ausência de conceito em zero.
- IDD: requer dados do Enem vinculados aos concluintes; o portal INEP cita mínimo de dois estudantes com recuperação do Enem e 20% de cobertura para o cálculo, sujeitos à metodologia da edição. **Não inferir IDD só do Enade**.
- IGC: índice da IES em janela trienal, com CPC de cursos e, quando aplicável, pós-graduação Capes. Nunca atribuí-lo como nota individual de um curso.

## Pendências verificáveis
P-NT-001 — auditar integralmente todas as fórmulas, convenções de arredondamento, exceções e mudanças de 2021/2022/2023; especialmente IDD/CPC/IGC.
P-TOL-001 — determinar a precisão de apresentação e tolerâncias oficiais por indicador/edição com fontes originais.
P-REF-001 — obter planilhas originais, versões e SHA-256.
P-ZIP-001 — microdados fornecidos posteriormente pelo usuário.
Qualquer valor ainda não encontrado é marcado **NÃO VERIFICADO**, nunca inferido.


## Referências de edição confirmadas no catálogo — 17/11/2026

O HTML oficial de outros-documentos/2022 identifica expressamente a NT 29/2023 em substituição à NT 3/2023 (IDD 2022), e a NT 5/2024 para a definição/transição do IGC 2022. Os catálogos 2021/2023 também foram preservados no inventário. Não foram atribuídas fórmulas, tolerâncias ou equivalência às notas cujo PDF retornou 503. A referência ao pacote público de IDD não comprova o recebimento dos insumos. Ver evidencias/20261117-work/methodology-catalog-receipts.json e idd-binary-receipts.json.
