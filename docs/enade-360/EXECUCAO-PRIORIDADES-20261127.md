# Pré-análise documental — execução real em 27/11/2026

Verificação do Supabase Vértice às 10h49min50s (UTC−3), na sessão Master autenticada pelo usuário. Fontes: repositório oficial (PRs #175, #182, #250, #251 e sucessoras pertinentes), projeto qvetbbmviatxxatzzuzc, serviços existentes no Render e relatório de autorização de 17/11, relido na versão atual. IA generativa permaneceu desativada; nenhum original, classificação humana, vínculo aprovado ou política de acesso foi alterado.

## Operação comprovada

- Os 10 originais UNITOP ainda sem índice foram baixados pela interface autenticada. Os 10 SHA-256 conferiram com os registros de origem. OCR local produziu 10 novas versões `partial`, todas com revisão humana exigida e novos eventos de auditoria. Os sete alvos ausentes registrados na reconciliação de 20/11 receberam novas versões; os eventos e IDs antigos foram preservados. A causa da ausência dos alvos antigos continua sem comprovação.
- Os 33 parciais do lote original foram baixados e seus hashes conferidos. Nova extração local sem o corte de 100 mil caracteres foi incorporada: 20 versões `ready` e 13 `partial`; 9.865.785 caracteres no total. O extrator percorreu todas as páginas/partes suportadas. OCR, páginas sem texto, manuscritos e conteúdo visual continuam sujeitos a conferência; `ready` indica extração textual técnica, não suficiência acadêmica. Extrações anteriores permanecem no histórico; em um documento com texto novo menor, o texto anterior também foi preservado na nova versão para conferência.
- Foram inseridas 43 versões de texto com 43 eventos de importação, e os 43 vetores de busca foram confirmados. Não houve aprovação de evidências.
- Os três HORÁRIO DE AULA 2026-2.docx foram reprocessados pela interface autenticada com `regras-bm25@2026-11-27.1`: três resultados `completed`, etapa `human_review`, sem erro, e três sugestões para o indicador 1.6. Todos os vínculos continuam `sugerido`, com `reviewed_at` nulo. O hash é d10e87edaeb2c38d8717aa8d1907856e03f16d57763b461c5c959fc2d04ad007. As três falhas Anthropic 404 foram preservadas; a causa do 404 e o funcionamento do provedor não foram demonstrados. Não houve nova ativação do provedor.
- IDs das novas análises: `f9a672b0-382a-4c57-b56d-662f3362efbd`, `77b2600a-d55b-4602-b259-452adc56f436`, `0e6c1da6-e130-4945-b8f9-af08c65d8fd6`. Houve três eventos `prevalidation_requested` e três `prevalidation_completed`.

## Recuperação funcional e limites

A pesquisa pelo conteúdo `recolhimento IPSEMG` recuperou o arquivo `de8a8c60-ebce-5f62-b887-e490559e1ff6` no ENADE 360°, Sapiens e Planejamento Estratégico do curso de Direito UNITOP, com a mesma solicitação `6ed7797b-24ab-5a90-88a6-5ffd61efc4bd`, hash `3e7272e06c84c8133a539a4841482765f55222ce7298b65c0acde3caa277527c`, indicador cadastrado 2.7 e aviso de OCR parcial. Trata-se de recuperação em consulta, sem criar cópias documentais ou aprovar vínculos entre módulos. Também foi recuperado nas três áreas o trecho final do PDI DOCX/PDF por `FORPROEX domicílios`: o texto completo atual do DOCX corresponde à consulta, enquanto a versão anterior, cortada em 100 mil caracteres, não corresponde (checagem SQL). IDs: `6554be94-5a4e-5a8a-a12a-36f66ad50382` e `716d2fa2-272a-53ae-9f43-772d22ce11d8`. São testes de amostra; não representam validação humana dos 43 textos.

O artigo `3c891097-1ec8-5749-ae6a-16c449adf354`, cuja extração antiga apresentou HTTP 546/CPUTime, foi recuperado no ENADE por `reprodutivos autonomia`, também no Sapiens e no Planejamento Estratégico do curso de Direito, com 44.756 caracteres, 18 páginas e hash `847836fecab4be8303ea0c4a53f4a3e48e34e419e3d758e6340513428888a918`. A recuperação alternativa por OCR existe desde 17/11; isso não transforma o registro antigo `pending/processing` em sucesso nem comprova correção do parser de PDF na Edge Function.

O arquivo `376e6b9e-e9fe-5481-8583-4269178abd3b` é fotografia de uma capa. A correção de perspectiva permitiu OCR do título e de parte dos nomes, mas não comprova capítulo, autoria do capítulo ou publicação completa. Solicitar o conteúdo correspondente e manter a pendência acadêmica aberta.

## Quantitativos atuais

| Recorte | Arquivos | ready | partial | Sem texto |
|---|---:|---:|---:|---:|
| UNITOP | 772 | 690 | 82 | 0 |
| UNICALDAS | 3 | 3 | 0 | 0 |
| Demonstração (fora dos lotes UNITOP) | 2 | 0 | 0 | 2 |
| Total consultado | 777 | 693 | 82 | 2 |

Em relação à consulta imediatamente anterior à execução: 10 arquivos ganharam texto e 20 dos 33 parciais passaram a `ready`. Em relação à reconciliação verificável de 20/11: os sete alvos ausentes foram recuperados por novas versões. A linha de base de 17/11 registrava 776 arquivos e 706 indexados; o arquivo adicional impede comparar os totais brutos sem separar a coorte. Nos 776 originais, agora há 774 indexados, ante 706 naquela linha de base. Os 82 parciais atuais exigem avaliação; ausência de arquivo sem texto não significa ausência de falhas.

## Correção preparada, sem publicação

A fila exibiu documentos como “Documento desconhecido”. O código ignorava erros de consulta de nomes/vínculos e enviava todos os IDs em uma única busca. A proposta consulta lotes de até 50 IDs, pagina as tentativas e os vínculos, mantém filtro institucional explícito, usa `title` para Gestão Documental, apresenta erros em vez de resultados vazios silenciosos e adiciona busca por nome/ID e identificação de origem. Não foi comprovado que limite de URL seja a causa específica do problema observado.

Validação local: cinco testes de consultas com 1.051 tentativas, 772 nomes, 1.275 vínculos, falhas de consulta e isolamento institucional; sete testes de interface/colunas, incluindo identificação da origem, ausência de aprovação automática e erro explícito. Os 12 testes diretos foram aprovados, assim como seis testes de regressão da política de qualidade documental da PR #299. `npm run check`, `npm run build:static` (3.341 módulos; 15 páginas públicas e 20 áreas demonstrativas geradas), compilação sintática do componente e `git diff --check` aprovados. O ambiente de teste de interface usa jsdom 26.1.0; nenhuma dependência de produção foi alterada nesta proposta. A correção de interface ainda não foi homologada/publicada e não deve ser descrita como funcionamento comprovado em produção.

A base foi atualizada para `5aca528` (PR #299), preservando o bloqueio de sugestões para extrações parciais/ambíguas. Nos 13 DOCXs reais do lote, a inspeção dos marcadores XML de inserção, exclusão, movimentação, alterações de formatação e comentários não encontrou esses marcadores; isso não certifica ausência de alterações visuais ou de outras limitações. A avaliação do corpus real por dois revisores permanece pendente, conforme a PR #299.

## Prioridades que permanecem abertas

1. Conferir fidelidade dos 68 textos recuperados desde a linha de base de 17/11 e conteúdo das páginas sinalizadas; revisão humana de nomes, números, manuscritos, imagens e suficiência regulatória. A maioria permanece `partial` por desenho.
2. Completar/verificar os 13 parciais remanescentes do lote original de 33, sem ignorar páginas sem texto ou tratar fotografias como documentos completos.
3. Decidir sobre o envio do capítulo correspondente à fotografia da capa; a capa não comprova o capítulo.
4. Revisar as três sugestões algorítmicas dos horários, sem aprovação automática. O caminho por regras funciona; o erro histórico do provedor não foi diagnosticado nem “corrigido”.
5. Revisar e autorizar a publicação da correção da fila; homologar a identificação das origens e os contadores após a publicação.
6. Preservar os testes de recuperação por curso/instituição e ampliar a amostra conforme a conferência. O funcionamento geral do parser Edge sob CPU limitada não foi homologado nesta execução.

Nenhuma conclusão integral do acompanhamento é declarada. Encerrar um item, após comprovação, não encerra os demais módulos ou o acompanhamento semanal.
