# ENAMED E1 — Rodada de três ações: texto integral entre cópias, mídia PDF e contratos
**Data:** 17/11/2026. **Origem:** PDF oficial REG-C2 2026 obtido por HTTPS de cadeia validada, hash no manifesto E1, e SQL apenas de leitura no Fato & Ordem. **Status:** investigação documental parcial; não há homologação clínica ou alteração de produção.

## Ação 1 — Comparação integral dos enunciados das duas versões armazenadas
Foram examinados `stem` e `alternatives` **inteiros** das duas versões F&O de cada uma das **22 posições** do Caderno 2 regular. A investigação compara **F&O vs F&O**, usando como apoio PDF oficial e suas páginas; **não atesta comparação integral automatizada F&O vs PDF oficial**. Os resultados individuais estão em `E1_22_VARIANTES_COMPARACAO_INTEGRAL_ENTRE_COPIAS.json`.

- **22/22 pares** possuem diferença textual persistente depois de normalização de pontuação/espaço.
- **22/22 alternativas** das duas versões se tornam idênticas após a normalização dos espaços no JSON; isto não comprova fidelidade integral ao gabarito enunciado oficial.
- **8/22 pares** têm diferença no conjunto de tokens numéricos do enunciado: Q12, Q42, Q44, Q49, Q74, Q89, Q90 e Q99. Em algumas versões faltam números e intervalos que constam da outra. **A ausência ou diferença exige confronto de tabela e unidades; não equivale a erro clínico comprovado**.
- Diferenças mais relevantes para a curadoria incluem a presença/ausência de áreas percentuais do Lund–Browder (Q12), indicadores epidemiológicos (Q42, Q49, Q99), parâmetros laboratoriais (Q44, Q74, Q90) e exames/valores relacionados ao quadro abdominal (Q89).
- O roteiro anterior de 57 diferenças brutas → 31 sem espaços → 22 persistentes continua válido. **Não deve ser usado para apagar versões históricas**.

## Ação 2 — Imagens rasterizadas ancoradas aos 22 itens prioritários
A partir do PDF com SHA-256 já registrado, utilizou-se PyMuPDF `get_image_info(xrefs=True)` e `extract_image(xref)`, identificando objetos e seus retângulos dentro da região geométrica de cada questão. A página, a coluna e o contexto foram confirmados em páginas renderizadas para seis ocorrências. Metadados por imagem estão em `E1_ENAMED_22_MIDIAS_PDF_HASH_E_PAGINA.json`.

| Caderno 2 regular | Página física PDF | Evidência gráfica | Consequência |
|---|---:|---|---|
| Q12 | 5 | Diagrama Lund–Browder | Vincular imagem + tabela percentual no item |
| Q68 | 18 | Radiografia da pelve | Preservar a imagem no raciocínio de trauma |
| Q81 | 21 | Fotografia dermatológica | Diagnóstico depende de imagem |
| Q82 | 22 | Exame radiológico contrastado | Conferir a imagem e a pergunta associada |
| Q89 | 24 | Tomografia do abdome superior | Imagem relevante à decisão cirúrgica |
| Q97 | 25 | Ultrassonografia transvaginal | Imagem e Doppler importantes à hipótese |

**Seis imagens rasterizadas** (objetos PDF xref 18, 52, 60, 64, 70, 74, respectivamente) receberam SHA-256 do objeto extraído, página, retângulo PDF e tamanho. Não foi criada uma cópia pública de imagens do Inep nem houve upload para Storage F&O. É necessário revisar os direitos de uso, a adequação do recorte e o vínculo de cada arquivo ao seu item antes da publicação.

**Limitação importante:** a ausência de imagem rasterizada na região inicial de uma questão não exclui tabela vetorial, gráfico desenhado, mídia em página seguinte ou outro elemento visual. O inventário de seis imagens **não representa auditoria integral de mídias dos 483 registros**.

## Ação 3 — Testes e governança
- Criado `scripts/tests/enamed-e1-content-media-contract.test.mjs`, incluído em `.github/workflows/verify-enamed-contracts.yml`; verifica os 22 pares, as 8 diferenças numéricas, os seis objetos rasterizados por SHA-256/página e bloqueio de aprovação automática.
- CI é prova de consistência dos artefatos, não de decisão pedagógica nem autorização real de perfis. Checar `success` da execução **exata** do HEAD da PR.
- As sessões de Master/Reitoria/CPA/Coordenação/NDE ainda não foram executadas com MFA e IES sintéticas; permanece roteiro de 16 casos.
- E1 ainda requer versão de gabarito definitiva, notas técnicas e validação integral de enunciados/alternativas/mídias; não entregar competência oficial ao Sapiens antes da curadoria.

## Gates antes de qualquer alteração
- [ ] Confronto completo de enunciados e alternativas F&O × PDF por posição e versão, com validação de números/unidades e tabelas.
- [ ] Inspeção humana de seis imagens localizadas, vínculos de direitos de uso, recortes e mídia obrigatória por questão.
- [ ] Gabaritos definitivos, retificações/anulações e homologação normativa/medicina.
- [ ] Pareceres independentes das duas IAs e aprovação médica com trilha, sem atualização automática.
- [ ] Testes reais de 16 cenários autenticados de perfis e isolamento IES/curso; ponte Sapiens com dados sintéticos.

**Aceite:** E1 parcialmente demonstrada, **não homologada integralmente**. E2/E3 preparatórias, E9 de IES real futura. PR #168 draft, sem merge/deploy; F&O, gabaritos, respostas e históricos inalterados.
