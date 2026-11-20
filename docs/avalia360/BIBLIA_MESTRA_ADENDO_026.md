# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 026 — Curadoria por regras e autoria orientada sem IA
**Data:** 20/11/2026 | **Escopo:** PR #207, ambiente de desenvolvimento e prévia demonstrativa.

### Decisão do usuário
Priorizar algoritmo determinístico, manter IA desligada/opcional no futuro e corrigir lacunas reais da migração sem declarar funcionalidades sem substituto como homologadas.

### Implementações
- `rule-curation.ts`: análise determinística por questão, com avisos de enunciado vazio/curto, espaços e pontuação, alternativas duplicadas ou em branco, ausência de gabarito, rubrica, pontuação, vínculo declarado de competência/tema e direitos de imagem.
- `RuleCurationPanel.tsx`: botão **Submeter à curadoria**, diagnóstico por regra com providência, comparação original × sugestão tipográfica e decisão do professor. Registro local de decisões por sessão; **não equivale à trilha institucional persistida**.
- As sugestões automáticas se limitam a formatação textual: não elaboram distratores, fundamentação jurídica, nova resposta, novo mérito técnico-científico ou correção semântica.
- `question-construction.ts` + `TeacherQuestionComposer.tsx`: formulário para o professor informar situação/problema e comando avaliativo; compõe estudo de caso, situação-problema ou comparação **exclusivamente a partir de informações fornecidas pelo docente**, sem IA e sem inventar doutrina.
- `Avalia360Studio.tsx`: integra montagem orientada e curadoria junto ao enunciado de cada questão.
- `source-overrides/client/src/components/area/CpaAutoavaliacao.tsx`: elimina cópias de UI que prometiam uso de IA para toda geração de relatório, preservando a proveniência histórica das seções (campos existentes).
- Testes `rule-curation.spec.ts`, `question-construction.spec.ts`: somente correções formais, alertas estruturais, proibição de inferir conteúdo normativo e autoria humana.

### Lacunas que NÃO devem ser mascaradas
1. Transcrição livre de manuscrito não foi substituída por OCR algorítmico confiável; o fluxo manual com conferência existe na Discursiva 360°.
2. Geração substantiva de questões a partir de fontes sem intervenção docente não tem substituto determinístico semanticamente equivalente. Disponibiliza-se autoria humana e casos/estruturas orientadas.
3. Segundo parecer semântico-jurídico por IA não é equivalente ao motor de regras; curadoria técnica aprofundada requer revisão humana e fontes qualificadas.
4. Modelo estatístico treinado para pré-nota Discursiva depende de respostas efetivamente homologadas (limiar documentado de 30); sem amostra suficiente, usa regra e exige homologação docente.
5. Análise de documentos, Sapiens e CPA precisam de homologação funcional por instituição, com dados, versões e desempenho comprovados, independentemente da presença de código.
6. Pareceres e decisões da curadoria do Avalia devem ser persistidos em backend autorizado, com versões, auditoria, MFA e segregação por instituição/curso; o histórico atual é apenas de sessão.
7. O Avalia 360° segue na PR #207 não integrada, sem PPC oficial homologado e sem integração SQL em produção.

### Princípios de homologação
- Sem chamar modelos externos sem autorização explícita.
- Alertas algorítmicos não significam validação substantiva.
- Resultado deve identificar a regra e permitir que o professor aceite/rejeite com rastreabilidade.
- Antes de publicar em produção: testar perfis docentes, integridade de dados, fontes curriculares, desempenho e cada fluxo na interface real.

**Manter os adendos 001–025 vigentes.**
