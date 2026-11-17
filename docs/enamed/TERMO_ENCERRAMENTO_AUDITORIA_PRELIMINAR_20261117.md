# TERMO DE ENCERRAMENTO DA AUDITORIA TÉCNICA PRELIMINAR — ENAMED 360°
**Data:** 17/11/2026. **Bíblia-Mestra:** 2.6. **Ato:** encerramento do escopo auditável nesta rodada, SEM aceite final E1 e SEM homologação pedagógica, interface autenticada ou publicação da PR #168.

## Resultado final: o que foi concluído, sem reabrir continuamente
1. **Origem e integridade dos PDFs:** quatro cadernos + quatro gabaritos preliminares ENAMED 2026 recuperados via TLS verificado, com hashes SHA-256 registrados. Cadernos 2 de aplicação regular e reaplicação são permutações de 100 itens dos respectivos Cadernos 1.
2. **Confronto F&O:** 483/483 respostas do acervo coincidem com os gabaritos **preliminares**. 483/483 aberturas textuais com 24 caracteres normalizados coincidem com o início do item oficial após permutação. Esses números não comprovam fidelidade integral das alternativas/enunciados.
3. **Duplicidades e correção de cobertura:** 200 posições regulares duplicadas; reaplicação com 17 questões de conteúdo candidatas a lacuna na tabela e Caderno 2 como outra ordem das mesmas 100. Nenhum ID ou tentativa apagado.
4. **Texto:** de 57 diferenças brutas entre cópias, 22 mantêm diferença alfanumérica após normalização. Foi feita consulta do `stem` completo das duas cópias para esses 22 pares, mas NÃO cotejo integral automático das duas contra cada PDF.
5. **Oito divergências numéricas conferidas contra fonte oficial:** Q12, Q42, Q44, Q49, Q74, Q89, Q90 e Q99 do regular Caderno 2. O registro `ENAMED-2026-REG-C2-QXXX` conserva os marcadores oficiais conferidos nas Q12, 42, 44, 49, 74, 99; o registro `enamed-2026-c2-qXX` conserva os marcadores das Q89 e Q90. **São candidatos documentais, não versões clinicamente homologadas.** Referência `ENCERRAMENTO_8_DIVERGENCIAS_NUMERICAS_VERIFICADAS_20261117.json`.
6. **Imagens:** seis objetos rasterizados extraídos e hashados por evidência de página: Q12, Q68, Q81, Q82, Q89, Q97. Sem upload de mídia para F&O.
7. **Banco e segurança:** `blocks` vazio em 483, hash de fonte nulo em 483, competência vazia em 483 e `source_page` nula em 223. Nenhuma escrita em produção. A política de RLS foi lida, mas não houve sessão real de Master/Reitoria/CPA/Coordenação/NDE.
8. **CI:** testes de contrato ENAMED aprovados no workflow do último artefato auditado; automações de build/TypeScript observadas verdes em revisão anterior, mas execução do último commit deve ser verificada antes de homologação técnica final.

## Portas de aceite: encerradas ou realmente bloqueadas
| Critério | Situação | Impedimento remanescente |
|---|---|---|
| PDFs 2026 preliminares e hashes | CONCLUÍDO | nenhum para os oito arquivos |
| Concordância das 483 letras preliminares | CONCLUÍDO | definitivo futuro deve ser conferido |
| Mapa das permutações C2↔C1 | CONCLUÍDO COMO RASCUNHO DOCUMENTAL | homologação integral do conteúdo/mídias |
| Oito diferenças numéricas | TRIAGEM DOCUMENTAL CONCLUÍDA | conferência clínica e texto integral |
| 22 pares F&O, mídias | INVENTÁRIO CONCLUÍDO | 14 pares sem conclusão sobre versão melhor; mídia ainda não vinculada |
| E1 — aceitação regulatória completa | BLOQUEADA | definitivos/retificações, notas e validação humana |
| E3 — reindexação e duas IAs | NÃO LIBERADA | gate E1 e revisão médica |
| Sessões autenticadas e isolamento multi-IES | NÃO TESTADAS | ambiente isolado com usuários de teste e MFA |
| PR #168 merge/deploy | BLOQUEADO | aceite de segurança, pedagógico e regulatório |

## Decisão de encerramento
**Encerrar a auditoria técnica PRELIMINAR aqui**, sem criar mais rodadas artificiais para repetir provas já obtidas. O próximo trabalho NÃO é repetir triagem: são dois aceites externos objetivos (documentos definitivos/parecer médico e sessões reais de homologação) mais a comparação integral pendente das questões. Se ausentes, registrar BLOQUEIO e não declarar 'concluído' o produto.
**Sem publicação antecipada, nenhum UPDATE/DELETE/UPSERT, sem alteração de gabaritos, classificações, estudantes, respostas ou tentativas históricas.**
