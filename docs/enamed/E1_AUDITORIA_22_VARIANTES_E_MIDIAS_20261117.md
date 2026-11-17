# ENAMED 360° — CONFRONTO TEXTUAL PRIORITÁRIO DE 22 VARIANTES E AUDITORIA DE MÍDIA
**Data:** 17/11/2026. **Status:** inspeção editorial/documental preliminar, não parecer médico. Sem DML/DDL nem alteração de gabaritos. E1 continua aberta.

## Evidências usadas
- PDF original do ENAMED 2026 regular Caderno 02, baixado sob TLS validado e SHA-256 registrado em `INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json`.
- Consulta `SELECT` em `public.fo_enamed_items`, comparando `enamed-2026-c2-qXX` e `ENAMED-2026-REG-C2-QXXX` dentro de `source_url+question_number`, por `stem`, `alternatives`, `blocks`, `source_page`, `source_hash`.
- Mapa de equivalência C2→C1 e 400 páginas em `ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json` e `ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json`.
- `ENAMED_2026_TRIAGEM_22_VARIANTES_TEXTUAIS_C2.json`: 22 posições com categoria editorial, página oficial, IDs de ambos os registros, necessidade de revisão e bloqueio de aplicação.

## Achados por tipo (sem juízo de correção clínica)
- **Q12:** a prova apresenta um diagrama de Lund–Browder e tabela de percentuais de superfície corporal queimada; uma cópia da base reduz/omite essa referência no enunciado. **Risco de perda de evidência essencial** para o cálculo de reposição volêmica. Exige imagem e dados tabulares associados ao item, não apenas metadado do gabarito.
- **Q40, Q42, Q44, Q45, Q49, Q51, Q74, Q90:** tabelas ou dados diagnósticos e valores de referência aparecem narrados, resumidos ou reorganizados diferentemente entre IDs. Conferir **cada número e unidade** contra PDF, antes de recomendar correção; normalização ingênua pode esconder erro.
- **Q81 e Q82:** a prova contém referência a uma imagem clínica e a uma radiografia, respectivamente; as duas versões cadastradas não possuem `blocks` de mídia. O PDF original possui objetos de imagem nas páginas de Q81 e Q82. Esses itens **não podem ser homologados apenas por enunciado/gabarito**.
- **Q18 e Q29:** diferença inicial observada em sobrescrito de `mm³` e tipo de aspas, mas conferir o restante do enunciado; diferenças de unidade podem ter impacto técnico.
- **Q48, Q55, Q63, Q68, Q80, Q84, Q89, Q97, Q99:** detalhes adicionais ou suprimidos de epidemiologia, condição clínica, privacidade, trauma, vigilância, medicamentos, exames e referência de fonte. Não os classificar como equivalentes sem comparação integral da frase e do contexto clínico.

## Inventário completo da tabela F&O por fonte (somente leitura)
| Origem | Registros | `blocks` vazios | `source_page` ausente | `source_hash` ausente | `competencies` vazias |
|---|---:|---:|---:|---:|---:|
| Regular Caderno 01 | 200 | 200 | 100 | 200 | 200 |
| Regular Caderno 02 | 200 | 200 | 123 | 200 | 200 |
| Reaplicação Caderno 01 | 83 | 83 | 0 | 83 | 83 |
| **Total** | **483** | **483** | **223** | **483** | **483** |

**Interpretação:** a coluna `blocks` vazia comprova que **nenhum bloco estruturado de mídia está cadastrado nessa coluna**; não comprova inexistência de toda mídia em quaisquer outras tabelas/armazenamentos. As imagens em PDF devem ser extraídas e vinculadas com autorização e proveniência antes da liberação dos itens que delas dependem. `source_page` nulo é ausência de rastreio no item; as páginas do catálogo de 400 questões estão apenas em artefato de desenvolvimento.

## Triagem quantitativa herdada
As 200 posições regulares com duas cópias têm 57 diferenças de `stem` brutas, 31 após ignorar espaços e 22 persistentes depois de remover pontuação. Das duas diferenças de alternativas serializadas, ambas desaparecem ao ignorar whitespace. **Essas normalizações não são equivalência clínica.**

## Gate por item na fila médico-pedagógica
Campos necessários na futura homologação:
1. `id` e alias de cada versão sem perda de tentativas.
2. PDF fonte autenticado, hash, caderno, edição, página inicial/final, mídia, tabela e gabarito versionado.
3. Extração textual integral com comparação de números/unidades, alternativas e comando cognitivo.
4. Proposta de tema, subtema, keywords e área/competência da Portaria 478/2025, com justificativa.
5. Pareceres independentes das duas IAs disponíveis, divergências e recibos por versão.
6. Aceite do curador médico e trilha de auditoria/rollback, antes de qualquer escrita.
7. Status específico de versão preliminar/definitiva; não usar `definitivo` no relatório enquanto só há evidência preliminar.

## Testes e responsabilidades
- Teste Node novo `scripts/tests/enamed-text-variants.test.mjs` verifica os 22 IDs, posição C2/C1, página de origem e bloqueio de aplicação automática. Incluído no CI da PR #168. Não executa revisão clínica.
- Sessões reais de Master/Reitoria/CPA/Coordenação/NDE e isolamento inter-IES permanecem não executadas: roteiro de 16 casos `ENAMED_2026_ROTEIRO_HOMOLOGACAO_PERFIS.md`, com dados sintéticos e MFA.
- O corpus oficial de gabaritos 2026 já recuperado e confrontado é **preliminar**; aguardar os definitivos e retificações.

**Status:** E1 parcialmente validada, porém sem aceite integral; E2/E3 apenas preparatórias, PR #168 draft sem merge/deploy, produção F&O e Vértice preservada. **Próximo incremento:** confronto integral de termos/números/tabelas e vinculação editorial de mídia com validação humana, priorizando Q12, Q81/Q82 e tabelas clínicas.
