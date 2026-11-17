# Evidência 004 — Controles de edição, SC, arredondamento e diagnóstico
Data do registro: 2026-11-16 (horário do projeto); logs CI em 2026-11-17 01:45 UTC.
Estado: **TESTES SINTÉTICOS APROVADOS; NÃO HOMOLOGADO COM DADOS REAIS**.

## Artefatos versionados
- `validator/edition-controls.cjs`: motor isolado de regras explicitamente identificadas para 2022 e 2023, sem reproduzir conceito oficial.
- `validator/test-edition-controls.cjs`: 34 casos sintéticos.
- `.github/workflows/enade360-contracts.yml`: mantém 26 testes semânticos, adiciona testes por edição e preserva 32 validações combinadas Draft 2020-12 + Node.

## Evidências reais de execução
GitHub Actions `ENADE 360 - Contract Tests`, run **43997964988**, job **133754617740**, commit **2ab634f48ade5dbb22ec40e7e8eb295f319c3258**: completed/success.
Log:
- `{"tests":26,"passed":26,"failed":0,"node":"v22.23.4"}`
- `{"suite":"edition-controls","tests":34,"passed":34,"failed":0,"node":"v22.23.4"}`
- `{"schema_draft":"2020-12","tests":32,"passed":32,"failed":0,"positive":7,"negative":25}`
Total: 92 testes sintéticos, todos aprovados, em três suítes. URL: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/43997964988

## Normas de referência
- ENADE 2022, Nota Técnica nº 2/2023: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2023/nota_tecnica_n_2_2023_cei_cggi_daes_descricao_da_metodologia_de_calculo_do_conceito_enade.pdf
- ENADE 2023, Nota Técnica nº 6/2024: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nota_tecnica_6_metodologia_calculo_conceito_enade_2023.pdf
Ambas indicam mínimo de 2 concluintes válidos e filtros específicos: TP_INSCRICAO=1, IN_REGULAR=1, TP_INSCRICAO_ADM em 0/2 e TP_PRES=555. A NT 6/2024 traz limiares da nota contínua (0; 0,945; 1,945; 2,945; 3,945; 5) para faixas 1–5. Não generalizar os limiares à edição 2022 sem verificação.

## Alcance técnico
- SC não é zero; caso elegível indica apenas aptidão para cálculo posterior.
- Regras por edição com identificador obrigatório; edição sem política verificada bloqueada.
- Filtro registra motivos de exclusão; implementação atual supõe que os registros já pertençam ao MESMO código de curso, dependência que deve ser validada pelo pipeline definitivo.
- Arredondamento decimal positivo em string e limiares exatos testados; tratamento de valores negativos e outras convenções não implementado.
- Nenhuma tolerância numérica oficial presumida. Igualdade exata é aceite; arredondamento de EXIBIÇÃO aprovado é marcado para revisão, não para homologação.
- Classificadores distinguem METHODOLOGY_DIFFERENCE, CALCULATION_DIVERGENCE e PEDAGOGICAL_HYPOTHESIS (com revisão humana).
- O código continua isolado; não integrado à produção nem ao cálculo completo de Conceito Enade/IDD/CPC/IGC.

## Pendências
P-ZIP-001 arquivo(s) de microdados aguardados do usuário; P-NT-001 completar conferência das notas técnicas; P-REF-001 planilhas oficiais de referência; P-CROSS-001 integrar o motor por edição ao pipeline de registros do mesmo curso e aos relatórios R1–R7, com testes de cruzamento; P-TOL-001 validar política de tolerância por indicador/edição com documento oficial antes de admitir igualdade aproximada.

A homologação científica do núcleo genérico, e por consequência a especialização por bacharelado, permanecem BLOQUEADAS.
