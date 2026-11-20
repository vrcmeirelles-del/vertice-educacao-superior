# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 027 — Conclusão pré-teste: proteção PDF e decisões de curadoria versionadas
**Data:** 20/11/2026 | **Branch:** `feat/avalia360-motor-longitudinal-v1` | **PR:** #207.

### Decisão de trabalho
O usuário informou que preparará uma questão-teste e autorizou fechar o que não depende desse insumo. Não interpretar a autorização como aprovação de publicações de dados pessoais em produção ou da ativação de IA externa.

### Entregas em desenvolvimento
1. `individualized-pdf.ts` implementa `validatePrintAssessment()`: valida contexto, questões, pontuação, alternativas, unicidade de texto, gabarito objetivo, rubrica discursiva e a limitação atual de imagens. A própria função de geração de PDF invoca o validador, impedindo emissão por chamadas diretas que ignorem o formulário.
2. `ClassBatchPublisher.tsx` reutiliza o mesmo contrato de validação, evitando divergência de critérios entre interface e PDF.
3. `individualized-pdf.spec.ts` ganhou testes negativos de gabarito ausente, distratores duplicados e bloqueio da emissão.
4. `curation-decision.ts` define decisão com `accepted/rejected/acknowledged`, versão das regras, questão, texto original e eventual proposta, códigos de alerta e instante registrado.
5. `RuleCurationPanel.tsx` permite registrar ciência quando há apenas apontamentos sem proposta, além de aceite/rejeição de ajustes formais. A decisão é emitida à interface superior e exibida como histórico da sessão.
6. `Avalia360Studio.tsx` agrega as decisões (máximo 150 eventos no snapshot) e as envia nos metadados do rascunho quando o professor salva uma revisão. `draft-api.ts` tipa os novos metadados; `SavedPreview` exibe a contagem declarada no snapshot.
7. `curation-decision.spec.ts` testa validação, deduplicação de códigos e preservação do original.

### Limites essenciais
- Os eventos enviados como metadados são **declarações do cliente** e NÃO prova de autoria autenticada, imutabilidade, trilha de auditoria pericial ou homologação pedagógica. Para auditoria institucional real será necessária tabela de eventos append-only vinculada à autenticação/MFA, IES e curso, com verificação no servidor.
- O novo validador impede PDF com imagens porque o renderizador demonstrativo ainda não integra figuras; nenhuma imagem é omitida silenciosamente.
- O QR da demonstração segue sem registro em backend. O roster real exige conciliação e autorização. Não submeter listas reais a site público.
- O PPC real, integrações com Sapiens/Fato & Ordem e transcrição automática de manuscrito permanecem em suas trilhas próprias. Não confundir `curationHistory` de cliente com avaliação técnica substantiva.
- Todo o trabalho permanece na PR em rascunho, sem migrações SQL em produção ou alteração de dados.

### Aceites pendentes
- [ ] Validação da suíte de testes no commit final.
- [ ] Build e deploy da prévia visual do commit final.
- [ ] Homologação pelo professor com questão-teste.
- [ ] Autenticação do usuário, restrições por IES/curso, logs imutáveis e persistência servidor homologados em staging.
- [ ] PDF definitivo com cabeçalho, figuras e código QR registrado de forma segura.
- [ ] Ajustes pedagógicos decididos após teste com a questão do professor.

**Os adendos 001–026 permanecem integralmente vigentes.**
