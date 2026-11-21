# Avalia 360° — inteligência pedagógica por algoritmo

Documento de continuidade. **Leia antes de iniciar qualquer bloco novo.** Ele registra o que existe,
as decisões tomadas e os contratos de dados que os próximos blocos devem reutilizar,
sem recriar tabela, regra ou tela paralela.

## Princípios (valem para todos os blocos)

1. **Sem IA.** Somente regras explícitas, estatística clássica e algoritmos determinísticos:
   mesmos dados e mesma data de referência produzem o mesmo resultado.
2. **Limiares versionados em um único lugar** (`*_RULES` em cada módulo), revisáveis pelo NDE.
   Toda tela mostra a versão das regras.
3. **Integridade no servidor.** Acerto, nota e evidência são calculados no Supabase.
   O navegador só interpreta números que o servidor entregou.
4. **Acesso** pelo escopo de `teaching_access` (AAL2 + papel na IES + vínculo de curso), via
   `vertice_private.avalia_access(inst, course, 'record' | 'validate')`. Tabelas sem leitura direta; só RPC.
5. **Testes obrigatórios por bloco:** SQL em `supabase/tests/avalia360_*.sql` (PostgreSQL descartável
   com stubs) e specs Vitest em `source-overrides/client/src/lib/avalia360/*.spec.ts`.
   Valores estatísticos são conferidos por cálculo independente.

## O que já está pronto

| Etapa | Migração | RPC / função | Cliente |
|---|---|---|---|
| Persistência | `20261121160000`, `20261121190000` | `vertice_avalia_draft`, `vertice_avalia_bank`, `vertice_avalia_media_prepare`, `vertice_avalia_draft_media`, `vertice_avalia_class_roster`; Edge `vertice-avalia-media` | `draft-api.ts`, `question-bank-api.ts`, `private-image-upload.ts` |
| Checklist técnico | — (e `avalia_blocking_issues` no servidor) | — | `item-checklist.ts`, `ChecklistPanel.tsx` |
| Validação pelo colegiado | `20261121210000` | `vertice_avalia_review` | `review-api.ts`, `CollegiateReviewPanel.tsx` |
| Aplicação e respostas | `20261121230000` | `vertice_avalia_application` | `answer-entry.ts`, `application-api.ts`, `ApplicationPanel.tsx` |
| Análise de itens (TCT) e calibração | `20261122010000` | `vertice_avalia_item_analysis`, `vertice_avalia_bank_calibration` | `item-analysis-rules.ts`, `analysis-api.ts`, `ItemAnalysisPanel.tsx` |
| **Bloco 1 — diagnóstico por competência** | `20261122030000` | `vertice_avalia_competency_evidence` | `competency-mastery.ts`, `competency-api.ts`, `CompetencyDiagnosisPanel.tsx` |
| Importação da Construção Curricular | `20261122050000` | `vertice_avalia_curriculum_import` | `curriculum-import-api.ts`, `curriculum-import.ts` |

### Bloco 1 — decisões

- **Identidade estável da competência** (`vertice_private.avalia_competency_key`):
  `cmp:<código>|<título>` normalizados (minúsculas, espaços colapsados), para competências da
  Construção Curricular **e** declaradas. Motivo (migração `20261122050000`): a Construção
  Curricular apaga e recria as competências a cada salvamento, então o id não é estável.
  Renomear código ou título inicia um novo histórico. É a chave a reutilizar em qualquer
  cruzamento futuro (montagem de prova, recuperação, ENADE/OAB). O cliente tem a mesma regra
  em `competencyKeyOf` (bloco 2).
- **Direção do grafo:** relação `prerequisito` de *origem → destino* significa
  "origem é pré-requisito do destino" (texto explicativo em `PedagogicalParameters.tsx`).
- **Domínio:** média ponderada de nota/valor das questões vinculadas, com decaimento
  `0,5^(idade/180 dias)`; mínimo de 2 questões; faixas 70% (domina) e 40% (em desenvolvimento).
- **Mapa da turma:** "retomar" se ≥ 60% dos alunos avaliados < 50% (mínimo de 5 avaliados).
- **Causa-raiz:** pré-requisito não dominado mais profundo da cadeia; pré-requisito sem evidência
  é "a verificar", nunca causa.
- **Escopos da evidência:** aplicação (aberta ou encerrada; inclui folhas por código),
  disciplina (só aplicações encerradas; só alunos do cadastro), aluno (histórico no curso).
- **Somativa exige competência** em todas as questões (`SOMATIVA_SEM_COMPETENCIA`, no cliente e
  no servidor), para o diagnóstico ser confiável.

### Pendências conhecidas (não bloqueiam os blocos seguintes)

- **Construção Curricular (outro módulo) não grava em produção:** `CurriculumBuilder.tsx` usa
  `supabase.from('curriculum_*')` no schema público, mas as tabelas estão em `vertice_app`, sem
  uso do schema por `authenticated`; em 21/11/2026 havia 0 matrizes. A **leitura** pelo Avalia 360°
  foi corrigida (RPC `vertice_avalia_curriculum_import`, colunas `origin_period`/`period_status`
  criadas, período assumido opcional e sinalizado). A **gravação** pela Construção Curricular
  ainda precisa ser corrigida naquele módulo.
- "Turma" = período corrente do cadastro (`current_semester`); não há campo de turma A/B.
- Discursivas: nota única por questão (sem nota por critério da rubrica).
- O mapa de versões da aplicação deve repetir quantidade e embaralhamento da impressão.
- Specs do Avalia 360° fora das configurações de Vitest do CI.

## Próximos blocos

### Bloco 2 — montagem automática de prova pelo banco calibrado (próximo)
- Entrada: tabela de especificação (competências pela **chave estável** do bloco 1, pesos,
  número de questões, dificuldade-alvo) + disciplina + turma.
- Fonte: `vertice_avalia_bank` + `vertice_avalia_bank_calibration` (dificuldade **observada**;
  declarada só quando não houver aplicação encerrada, e sinalizado).
- Algoritmo guloso determinístico: cobrir competências por peso → aproximar a distribuição de
  dificuldade-alvo → priorizar maior discriminação → desempate por id.
  **Controle de exposição:** excluir itens aplicados à mesma turma nos últimos N meses
  (consultar `vertice_avalia_applications` + `draft_revisions`, `sourceBankId`).
- Saída: questões copiadas para um rascunho comum (com `sourceBankId`), passando por
  checklist → colegiado → aplicação, como hoje. Nada de atalho para aplicar sem validação.
- Testes: mesma entrada ⇒ mesma prova; cobertura; exposição; desempate.

### Bloco 3 — recuperação personalizada + mapa de erros
- Marcação, pelo professor, do erro conceitual de cada alternativa errada (novo campo no item).
- Lista por aluno de itens do banco nas competências *não demonstradas* (bloco 1), com acerto
  esperado entre 50% e 80% (calibração), e agenda de repetição espaçada (1, 3, 7, 15 dias).

### Bloco 4 — justiça e qualidade
- Comparação entre versões A/B/C para alunos de desempenho equivalente (DIF simplificado).
- Rubrica estruturada por critérios e concordância entre corretores (kappa de Cohen ou correlação intraclasse).
- Classificação de Bloom por verbo de comando (dicionário fixo) e alerta de desalinhamento.

### Bloco 5 — prontidão ENADE/OAB e risco
- Domínio por competência (bloco 1) × pesos da matriz do exame ⇒ índice de prontidão.
- Tendência das notas + competências críticas ⇒ sinal para o alerta de evasão existente.
