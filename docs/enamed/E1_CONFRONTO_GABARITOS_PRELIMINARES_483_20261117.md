# E1 — RECONCILIAÇÃO DOCUMENTAL REAL: ENAMED 2026, oito PDFs e 483 registros
**Data da execução:** 17/11/2026. **Origem:** publicação oficial INEP + binários baixados sob TLS validado + SQL somente leitura no Supabase Fato & Ordem.  
**Status E1:** PARCIAL, não homologado integralmente. **Gabaritos:** PRELIMINARES. **Dados de produção:** preservados.

## 1. Recuperação segura de PDFs
Catálogo oficial: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos.
- A renderização oficial no GitHub Actions (run `43999991024`) localizou 11 URLs.
- Diagnóstico TLS (run `44016652354`) mostrou que o servidor apresentava apenas uma certidão folha; o emissor informado era `RNP ICPEdu GR46 OV TLS CA 2025`, cujo AIA aponta a `secure.globalsign.com`.
- A rota alternativa `scripts/enamed/download_inep_verified_chain.py` obteve a intermediária e validou sua assinatura até as raízes confiáveis existentes no runner. Em seguida, o cliente HTTPS manteve validação de domínio/CA habilitada; foram recuperados **8 PDFs íntegros**, quatro cadernos e quatro gabaritos preliminares.
- O run [44017133303](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44017133303) contém artefato `enamed-e1-verified-chain-pdfs`, ID `14299257407`. Seus oito hashes SHA-256 foram recalculados sobre os bytes do ZIP e conferiram com o relatório do pipeline.
- O inventário permanente de **URLs, tamanhos, páginas e SHA-256** foi versionado em `INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json`. Cada caderno possui 28 páginas; os gabaritos, 2 páginas.
- Não houve desativação de TLS, importação ao banco, atualização de metadados oficiais nem edição de questões.

**Alcance exato da prova:** integridade dos binários + origem por link no DOM oficial e conexão validada criptograficamente. Não se confunde com autoria de cada questão por perito, aprovação de metodologia por edição ou `gabarito definitivo`.

## 2. Confronto dos gabaritos PRELIMINARES com o Fato & Ordem
Procedimento:
1. Extrair por PDF os 100 pares número → alternativa A/B/C/D de cada um dos quatro documentos de gabarito preliminar; confirmar **100 chaves distintas, 1–100 por documento**.
2. No Supabase F&O, efetuar `SELECT` associando `fo_enamed_items.source_url` aos dois cadernos regulares e ao Caderno 1 de reaplicação, e confrontar `upper(trim(answer_key))` por `question_number`.
3. Somar concordâncias sem atualizar `official_answer_status`, `answer_key` ou tentativas.

| Conjunto | Entradas F&O confrontadas | Concordantes com gabarito preliminar | Divergentes |
|---|---:|---:|---:|
| Regular caderno 1 | 200 | 200 | 0 |
| Regular caderno 2 | 200 | 200 | 0 |
| Reaplicação caderno 1 | 83 | 83 | 0 |
| **Total** | **483** | **483** | **0** |

**Observação decisiva:** os 483 registros conservam o status `definitivo` no F&O, mas foram confrontados **apenas com documentos preliminares**. Concordância com a versão preliminar não autoriza tratar respostas como definitivas. Não houve correção no banco.

O quarto gabarito (reaplicação caderno 2) foi integralmente recuperado e possui 100 chaves, mas **não há itens correspondentes na tabela `fo_enamed_items` inspecionada**. Portanto ele não entra na contagem 483.

## 3. Cobertura da reaplicação e versões duplicadas
- Caderno 1 da reaplicação oficial: **100 questões**; tabela F&O: **83 posições**. Ausentes **nessa tabela** os números: `1, 11, 20, 22, 24, 27, 31, 36, 42, 49, 53, 57, 59, 74, 88, 91, 98` (17).
- Caderno 2 da reaplicação oficial: **100 questões**, gabarito preliminar recuperado; tabela `fo_enamed_items`: **0 posições atribuídas a essa origem**. Não inferir ausência de todo o ecossistema sem examinar armazenamento e outros catálogos.
- Regular 1 e 2: cada origem tem 100 posições e 200 IDs históricos, somando 200 duplicações. Há 57 posições com enunciados textualmente distintos e 2 com alternativas serializadas divergentes; estas estão localizadas em **regular Caderno 1, questões 19 e 28**.
- Inspeção da diferença nas alternativas de q19 e q28 revelou pontuação/espaço antes do ponto-final em uma das versões. O texto oficial recuperado mostra, por exemplo, `Borderline.` na alternativa do item 28. **A diferença observada nesses dois casos é editorial/ortográfica, não uma alteração de letra do gabarito**. Não extrapolar esse diagnóstico para outras 57 divergências.
- Os 191 pares com subtemas diferentes e 192 com keywords diferentes continuam pendentes de revisão editorial e clínica.

## 4. Limites da reconciliação (portas ainda fechadas)
- [x] Recuperar e hashear 8 PDFs oficiais 2026 com TLS validado.
- [x] Conferir 100/100 chaves preliminares por documento.
- [x] Confrontar 483/483 respostas F&O com gabaritos preliminares: zero divergências.
- [x] Enumerar lacuna reaplicação C1 (17 números) e C2 (100 posições sem registro nessa tabela).
- [x] Identificar as duas diferenças de alternativas entre duplicatas (19/28).
- [ ] Conferir o texto integral, imagens e alternativas de todos os 483 registros, por caderno, e as 117 posições sem representação na tabela de reaplicação (17 de C1 e 100 de C2), sem assumir que sejam necessariamente importáveis.
- [ ] Obter a **versão definitiva** de gabaritos, retificações, anulações e eventuais republicações na data oficial e registrar novo hash por arquivo.
- [ ] Recuperar as demais notas técnicas e documentos da E1 e validar vigência/cálculo oficial, com especialistas.
- [ ] Emitir parecer das duas IAs com evidência e revisão médica humana antes de gravar tema, subtema, keywords ou competências.
- [ ] Confirmar testes de sessões reais por papel/IES, MFA, RLS e acesso móvel, além da ponte F&O→Vértice→Sapiens com dados sintéticos.

**Decisão:** a E1 avançou materialmente na **autenticidade da origem e integridade de oito binários**, mas seu aceite integral não foi cumprido. A E2/E3 seguem preparatórias; a issue #170 é fila, não homologação médica. Todos os dados de produção e históricos permanecem intocados.
