# Casos de teste do motor interpretativo geral — ENADE 360°
Versão 0.1 | 2026-11-16 | Testes DEFINIDOS; não implementados nem executados no ambiente da Vértice

## Cenários sintéticos com oráculo esperado
| ID | Dado de teste (sintético) | Resultado esperado |
|---|---|---|
| M01 | Resultado com fonte ausente e rótulo OFFICIAL_FACT | rejeitar afirmação |
| M02 | Curso com 1 participante válido, regra de conceito 2022 | SC; não inventar conceito numérico |
| M03 | Curso com 2 participantes válidos, filtros de edição presentes | encaminhar cálculo; não homologar sem tabela oficial |
| M04 | Uma inscrição irregular agregada por engano aos válidos | excluir, contar motivo, manter trilha |
| M05 | Duas áreas diferentes com notas brutas de CE | bloquear comparação ordinal absoluta |
| M06 | Mesma área 2022 e 2023, com mudança documentada de composição da prova | marcar C2 ou CX até comprovar equivalência |
| M07 | Bacharelado e licenciatura com nome de área igual | bloquear agregação por grau diferente |
| M08 | Resultado ausente de 2026 apresentado como publicado | rejeitar; data/edição não publicada |
| M09 | Valores oficiais e calculados discordantes | preservar ambos e gerar divergência auditável |
| M10 | Percentual 39.135/44.156, referência publicada 87% | assinalar 88,63%, arredondado 89%, divergência de 2 p.p. frente ao publicado arredondado |
| M11 | Nota de 2023 calculada com ponderações antigas de itens | rejeitar versão incorreta da metodologia |
| M12 | Hipótese 'docente causa baixo conceito' apoiada só em correlação | bloquear rótulo causal; transformar em hipótese a investigar |
| M13 | Relatório sem denominador ou missing | recusar aceite por falta de metadados |
| M14 | Mesma entrada e mesmo motor executados duas vezes | resultados idênticos e hashes reproduzíveis |
| M15 | Resultado de curso com SC divulgado como nota zero | falhar: SC não é nota 0 |
| M16 | Documento versão antiga substituído por arquivo atualizado | registrar ambas versões e marcar reconciliação anterior como requer nova verificação |
| M17 | Proposta de intervenção sem revisão humana | permitir rascunho, bloquear aprovação/publicação como decisão da IES |
| M18 | Pedido de exibição de desempenho individual protegido | bloquear publicação ou inferência identificável |

## Modelo de evidência por execução (não preenchido)
run_id, test_id, run_at, engine_version, fixture_hash, expected, observed, pass_fail, reviewer, environment, related_commit, evidence_url, limitations.

## Critério de aceite
A implementação deverá executar estes cenários por testes de unidade e contrato, além de T01–T12 do protocolo de ingestão. Testes sintéticos aprovados NÃO são substitutos de prova com microdados oficiais, e nenhum teste acima foi executado na aplicação da Vértice neste registro.
