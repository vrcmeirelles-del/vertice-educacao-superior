# Prova quantitativa 001 — conciliação agregada Enade 2022
Data: 2026-11-16 | Estatuto: EXECUTADA sobre números agregados publicados; não é recálculo do Conceito Enade nem validação de microdados individuais.

## Fonte
INEP, Resultados Enade 2022 e perspectivas a partir de 2024, apresentação de outubro/2023, slide 10: https://download.inep.gov.br/educacao_superior/enade/apresentacao/2022/apresentacao_resultados_enade_2022.pdf

## Método
Para cada uma das 13 áreas de bacharelado: percentual recalculado = quantidade (participantes ou respondentes do QE) / inscritos × 100. Comparar com percentuais inteiros exibidos pelo INEP mediante arredondamento ao inteiro mais próximo. Somente os campos publicados na tabela foram utilizados; números não vieram de download de microdados. Procedimento não depende de hipóteses sobre nota de curso ou média de participantes.

| Área | Inscritos | Presentes | Respondentes QE | Presença INEP | Presença recalculada | QE INEP | QE recalculado | Teste |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Administração | 119053 | 82636 | 95285 | 69% | 69.41% | 80% | 80.04% | OK |
| Administração Pública | 4141 | 2597 | 3147 | 63% | 62.71% | 76% | 76.00% | OK |
| Ciências Contábeis | 67642 | 46264 | 54204 | 68% | 68.40% | 80% | 80.13% | OK |
| Ciências Econômicas | 12435 | 8765 | 10130 | 70% | 70.49% | 81% | 81.46% | OK |
| Comunicação Social (Jornalismo) | 9766 | 7449 | 8262 | 76% | 76.27% | 85% | 84.60% | OK |
| Comunicação Social (Publicidade e Propaganda) | 12759 | 9426 | 10482 | 74% | 73.88% | 82% | 82.15% | OK |
| Direito | 136145 | 105267 | 118009 | 77% | 77.32% | 87% | 86.68% | OK |
| Psicologia | 44156 | 39135 | 41474 | 87% | 88.63% | 94% | 93.93% | DIVERGÊNCIA |
| Relações Internacionais | 6905 | 5065 | 5748 | 73% | 73.35% | 83% | 83.24% | OK |
| Secretariado Executivo | 889 | 651 | 743 | 73% | 73.23% | 84% | 83.58% | OK |
| Serviço Social | 22441 | 16044 | 18627 | 71% | 71.49% | 83% | 83.00% | OK |
| Teologia | 8455 | 5389 | 6550 | 64% | 63.74% | 77% | 77.47% | OK |
| Turismo | 2707 | 1922 | 2184 | 71% | 71.00% | 81% | 80.68% | OK |

## Resultado verificável
- 13 áreas × 2 taxas = 26 verificações; 25 coincidem quando arredondadas à unidade; 1 diverge.
- Psicologia: 39.135 / 44.156 × 100 = 88.6290%, arredondando para 89%, enquanto a apresentação informa 87%.
- Soma de inscritos nos 13 bacharelados: 447.494; coincide com o agregado de bacharelados no slide 6 da mesma apresentação (447.494).
- Somatório de presentes: 330.610; respondentes QE: 374.845. São totais dos 13 bacharelados no slide 10, NÃO totais nacionais do exame incluindo tecnólogos.

## Divergência e interpretação
O percentual de Psicologia não se reconcilia com os absolutos mostrados; não corrigir unilateralmente o documento fonte. Hipóteses: erro de apresentação ou denominador/regra diferente não explicitado na tabela. Exigir conferência na sinopse oficial e/ou nos microdados; marcar como pendente, sem inferir causa.

## Restrições da prova
- PDFs foram consultados via fonte pública; sem arquivo ZIP oficial integral em ambiente local. O teste confirma consistência aritmética agregada, NÃO reproduz Conceito Enade 2022, IDD, CPC ou IGC.
- Sem leitura integral de dicionários de microdados, sem aplicação de elegibilidade do indicador, sem recálculo de notas padronizadas, sem conciliação curso a curso.
- Gate de homologação: BLOQUEADO.

## Próxima prova
Obter ZIP oficial do Enade 2023/2022, registrar hash SHA-256, validar layout e filtros por edição, agregar por código de curso e área e reproduzir conceitos contra tabela oficial usando os detalhes de normalização da nota técnica correspondente.
