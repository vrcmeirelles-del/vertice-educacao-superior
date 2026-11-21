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
| **Bloco 2 — montagem automática de prova** | `20261122070000` | `vertice_avalia_bank` (com descritores de competência), `vertice_avalia_bank_exposure` | `exam-assembly.ts`, `competency-key.ts`, `AssemblyPanel.tsx` |
| **Bloco 3 — mapa de erros e recuperação** | `20261122090000` | `vertice_avalia_error_evidence`, `vertice_avalia_recovery` (tabela `vertice_avalia_recovery_plans`) | `error-map.ts`, `recovery.ts`, `recovery-api.ts`, `ErrorMapPanel.tsx`, `RecoveryPanel.tsx` |

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

### Bloco 2 — montagem automática de prova (PRONTO)
- **Banco guarda descritores** (`id`, `code`, `title`, `period`) das competências citadas pela
  questão; o servidor descarta os não citados e os sem código ou título. Itens antigos sem descritor
  continuam utilizáveis pelo total e pela dificuldade, mas não contam para a especificação.
- **Reaproveitar do banco** (manual ou montagem) religa as competências ao catálogo do caderno
  pela chave estável (`mergeIntoCatalog`); antes, os vínculos se perdiam.
- **Elegibilidade:** tipo permitido → exposição (`vertice_avalia_bank_exposure`: última aplicação
  na disciplina, filtrável pela turma, em qualquer situação) dentro da janela de N meses →
  qualidade (discriminação < 0,20 com n ≥ 30, ou negativa com n ≥ 10, fica fora).
- **Dificuldade:** observada se calibração com n ≥ 10; senão declarada, contada à parte.
- **Seleção gulosa determinística:** cobertura da competência mais escassa para a mais abundante;
  depois complemento; cada escolha minimiza |média − alvo|; empate → maior discriminação
  (desconhecida = 0,20) → menor `bankId`. Caderno ordenado do mais fácil ao mais difícil.
- **Saída:** novo rascunho (sem recibo), questões com `sourceBankId`, competências exigidas
  marcadas; segue checklist → colegiado → aplicação. Falta de itens é informada, nunca preenchida.
- **Reutilizar no bloco 3:** `toAssemblyItems` (nível observado/declarado, exposição),
  `competencyKeyOf`, `mergeIntoCatalog`, `observedLevel`, calibração e exposição por item.

### Bloco 3 — mapa de erros e recuperação (PRONTO)
- **Erro conceitual por alternativa:** `QuestionDraft.distractorNotes` (id da alternativa errada →
  descrição até 200 caracteres), limpo por `cleanDistractorNotes`, gravado no snapshot e no banco,
  editado em "Mapa de erros" no editor. Não aparece no caderno do aluno.
- **Mapa de erros** (`error-map.ts`): soma por descrição normalizada (sem acentos, minúsculas,
  espaços colapsados, sem pontuação final); "recorrente" se ≥ 30% dos alunos (mínimo de 5).
  Erros em alternativas sem descrição são listados como "sem mapeamento".
- **Evidência** (`vertice_avalia_error_evidence`): escopo aplicação ou disciplina (só encerradas e
  só alunos do cadastro); devolve também os itens do banco já respondidos por aluno.
- **Plano de recuperação** (`recovery.ts`): até 5 competências (não demonstrado antes de em
  desenvolvimento, menor nota primeiro); até 3 itens por competência, não respondidos, acerto
  esperado entre 50% e 80% (mais perto de 65%, depois discriminação, depois id); reserva com
  dificuldade declarada 2–3, sinalizada. Distâncias arredondadas a 6 casas para empates exatos.
- **Agenda:** caixas de Leitner 1–3–7–15 dias, recalculada do registro (`scheduleItems`);
  acerto avança, erro volta à primeira caixa, acerto na última consolida.
- **Persistência:** `vertice_avalia_recovery_plans` (itens validados contra o banco da
  disciplina; aluno do cadastro; registro com data a partir do início; plano encerrado bloqueia).
- **Reutilizar no bloco 4:** evidência de erros por alternativa (`chosen_option`), análise de
  itens, `scheduleItems` e o padrão de RPC por escopo.

### Bloco 4 — justiça e qualidade
- Comparação entre versões A/B/C para alunos de desempenho equivalente (DIF simplificado).
- Rubrica estruturada por critérios e concordância entre corretores (kappa de Cohen ou correlação intraclasse).
- Classificação de Bloom por verbo de comando (dicionário fixo) e alerta de desalinhamento.

### Bloco 5 — prontidão ENADE/OAB e risco
- Domínio por competência (bloco 1) × pesos da matriz do exame ⇒ índice de prontidão.
- Tendência das notas + competências críticas ⇒ sinal para o alerta de evasão existente.
