# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 033 — Cartão de respostas, impressão em duas colunas, pautas e versões randomizadas
**Data:** 20/11/2026 | **Escopo:** branch `feat/avalia360-motor-longitudinal-v1`, PR #207 ainda em rascunho.
**Situação:** código desenvolvido na branch e sujeito a testes, publicação e homologação. Produção institucional e Supabase não modificados.

### 1. Campos de autoria e curadoria
**Objetiva — `answerJustification`:** texto privado obrigatório em questão completa, elaborado pelo professor, que fundamenta a opção `correctOptionId`. Gabarito sem justificativa dispara alerta do motor determinístico; o texto segue no rascunho e no Banco de Questões demonstrativo e jamais é impresso na prova discente.

**Discursiva — `answerLines`:** número inteiro configurável por questão (3–60; padrão 8). O PDF gera exatamente a quantidade escolhida de linhas de resposta com avanço de **18 pontos por linha** (correspondente a 1,5 sobre base de 12 pontos). `expectedAnswer` e `rubric` continuam necessários e exclusivos do docente. O fluxo de validação mantém controle de imagens, descrição acessível e direitos de uso.

### 2. PDF individualizado
- Formato A4 retrato, **duas colunas** para questões objetivas e discursivas; leitura vertical na primeira coluna, depois na segunda e então na página seguinte.
- Imagens PNG/JPEG/WebP permanecem com a questão/alternativa correspondente e legenda acessível; tamanho proporcional à coluna.
- Linhas da discursiva fluem entre colunas e páginas quando necessário.
- Cada estudante fictício selecionado recebe caderno de prova e **cartão de respostas separado**, com campos de identificação, versão, folha, QR e opções objetivas circulares A/B/C/D/E (ou conforme número de alternativas).
- Não imprimir nem expor justificativas, respostas esperadas, rubricas, gabaritos, questões corrigidas ou chaves de randomização no caderno/cartão.
- Se a avaliação for exclusivamente discursiva, o cartão declara que não há itens objetivos.

### 3. QR e cartão
- O QR do caderno e o do respectivo cartão contêm o **mesmo valor opaco de demonstração** `VA360-DEMO:1:<versão>:<token_aleatório>`.
- Nenhum nome, matrícula, CPF, identificação acadêmica ou gabarito aparece no QR.
- O QR **não lê respostas**: identifica somente uma versão e um token local. A futura captura óptica do cartão requer serviço de registro de emissão, vínculo seguro aluno/folha/token, detecção de marcações, revisão de ambiguidades, MFA/RLS, logs e testes com digitalizações reais.
- O registro e a resolução de tokens no Supabase não foram implantados; nenhuma leitura automática ou atribuição de nota é declarada como operacional.

### 4. Randomização segura e gabarito
- O professor pode gerar de 1 a **12 versões**, escolhendo `questoes`, `alternativas` ou `ambos`.
- Permutações são **determinísticas**, geradas exclusivamente a partir da versão e do identificador estável das questões, sem IA; cada versão recebe rótulo A–L e uma assinatura de ordem diferente.
- Quando a quantidade pedida excede as permutações disponíveis, o sistema bloqueia com explicação. Não vender como versões diferentes cópias idênticas.
- A cada estudante selecionado é designada uma versão alternadamente; caderno e cartão imprimem a versão correspondente.
- Em questões objetivas, o sistema recalcula o **gabarito visível** a partir da posição da opção correta na nova ordenação, preservando o ID da alternativa e o enunciado original.
- O professor pode baixar um **CSV de gabaritos por versão**, com rótulo A–L, número impresso da questão, letra correta, ID original e fundamentação docente. Este arquivo é separado do documento discente. A interface invalida PDFs e gabaritos antigos após alterações de conteúdo, turma ou randomização.

### 5. Implementação
- `question-draft.ts`, `QuestionDraftEditor.tsx`, `Avalia360Studio.tsx`, `draft-api.ts`, `question-bank.ts`, `rule-curation.ts`: campos, validação, curadoria e preservação.
- `exam-variants.ts`: motor de permutações sem repetições, limite combinatório, mapeamento de alternativa e gabarito por versão.
- `individualized-pdf.ts`: duas colunas, imagens, pautas 1,5, QR com versão, cartão final por estudante.
- `ClassBatchPublisher.tsx`: opções de randomização, mensagens de bloqueio e downloads separados do PDF discente e CSV docente.
- `exam-variants.spec.ts`, `individualized-pdf.spec.ts` e testes legados atualizados: versões únicas, gabarito correto, páginas/cartões, limites de linha e preservação do original.

### 6. Critérios de homologação pendentes
- [ ] Suíte de testes unitários do Avalia aprovada no commit final e build Vite verde.
- [ ] Verificar visualmente A4 em 2 colunas, espaçamento das pautas, proporção de imagens e QR em caderno e cartão.
- [ ] Testar lote fictício de 3 alunos, com variantes A/B/C, cartão separado e gabaritos coerentes.
- [ ] Testar caso misto de objetivas/discursivas, inclusive 60 linhas e mais de uma página.
- [ ] Testar randomização e variantes com itens objetivos e figuras vinculadas às alternativas.
- [ ] Verificar que gabarito, justificativas e padrão esperado jamais são incluídos no PDF discente.
- [ ] Validar fluxos com professores e acessibilidade do formulário.
- [ ] Construir registro seguro de versões, emissão, vinculação de tokens e captura óptica do cartão antes de uso real.

**Preservar os adendos 001–032. Nenhuma IA externa foi ativada.**
