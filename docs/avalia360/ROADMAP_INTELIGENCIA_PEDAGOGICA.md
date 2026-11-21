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
| Persistência | `20261121174942`, `20261121180155` | `vertice_avalia_draft`, `vertice_avalia_bank`, `vertice_avalia_media_prepare`, `vertice_avalia_draft_media`, `vertice_avalia_class_roster`; Edge `vertice-avalia-media` | `draft-api.ts`, `question-bank-api.ts`, `private-image-upload.ts` |
| Checklist técnico | — (e `avalia_blocking_issues` no servidor) | — | `item-checklist.ts`, `ChecklistPanel.tsx` |
| Validação pelo colegiado | `20261121183216` | `vertice_avalia_review` | `review-api.ts`, `CollegiateReviewPanel.tsx` |
| Aplicação e respostas | `20261121184127` | `vertice_avalia_application` | `answer-entry.ts`, `application-api.ts`, `ApplicationPanel.tsx` |
| Análise de itens (TCT) e calibração | `20261121192159` | `vertice_avalia_item_analysis`, `vertice_avalia_bank_calibration` | `item-analysis-rules.ts`, `analysis-api.ts`, `ItemAnalysisPanel.tsx` |
| **Bloco 1 — diagnóstico por competência** | `20261121193958` | `vertice_avalia_competency_evidence` | `competency-mastery.ts`, `competency-api.ts`, `CompetencyDiagnosisPanel.tsx` |
| Importação da Construção Curricular | `20261121194400` | `vertice_avalia_curriculum_import` | `curriculum-import-api.ts`, `curriculum-import.ts` |
| **Bloco 2 — montagem automática de prova** | `20261121194910` | `vertice_avalia_bank` (com descritores de competência), `vertice_avalia_bank_exposure` | `exam-assembly.ts`, `competency-key.ts`, `AssemblyPanel.tsx` |
| **Bloco 3 — mapa de erros e recuperação** | `20261121195657` | `vertice_avalia_error_evidence`, `vertice_avalia_recovery` (tabela `vertice_avalia_recovery_plans`) | `error-map.ts`, `recovery.ts`, `recovery-api.ts`, `ErrorMapPanel.tsx`, `RecoveryPanel.tsx` |
| **Bloco 5 — prontidão e risco** | `20261122130000` | evidência com escopo `course`, `vertice_avalia_exam_matrix`, `vertice_avalia_score_series`, `vertice_avalia_risk_publish`; colunas novas em `v_student_evasion_risk` | `readiness.ts`, `academic-risk.ts`, `readiness-api.ts`, `ReadinessRiskPanel.tsx`, `EvasionRiskPanel.tsx` |
| **Bloco 4 — justiça e qualidade** | `20261121200711` | `vertice_avalia_response_matrix`, `vertice_avalia_double_scoring` (tabela `vertice_avalia_second_scores`); bloqueios de rubrica em `avalia_blocking_issues` | `bloom.ts`, `fairness.ts`, `agreement.ts`, `quality-api.ts`, `QualityPanel.tsx` |

### Bloco 1 — decisões

- **Identidade estável da competência** (`vertice_private.avalia_competency_key`):
  `cmp:<código>|<título>` normalizados (minúsculas, espaços colapsados), para competências da
  Construção Curricular **e** declaradas. Motivo (migração `20261121194400`): a Construção
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

### Bloco 4 — justiça e qualidade (PRONTO)
- **Bloom** (`bloom.ts`): dicionário fixo só de formas verbais de comando (imperativo e
  infinitivo), para não confundir com substantivos jurídicos ("julgamento", "aplicação da lei");
  nível = o mais alto encontrado; `QuestionDraft.bloomLevel` (professor) prevalece. Alerta
  `BLOOM_BAIXO`: somativa a partir do 5º período com ≥ 60% em Lembrar/Compreender.
- **Rubrica estruturada** (`QuestionDraft.rubricCriteria`): critérios com pontos; bloqueios
  `RUBRICA_CRITERIO` e `RUBRICA_SOMA` (soma ≠ pontuação) no cliente e no servidor; a rubrica
  estruturada substitui o texto livre; somativa sem critérios gera alerta.
- **Justiça entre versões** (`fairness.ts`, `vertice_avalia_response_matrix` anonimizada):
  Mantel-Haenszel por questão objetiva, cada versão contra as demais, estratos pela nota
  (cortes nas fronteiras entre notas diferentes); D-DIF = −2,35·ln α; χ² com correção de
  continuidade; categorias A/B/C (|D| < 1, 1–1,5, ≥ 1,5, com significância); mínimo de 10 por
  grupo; "indeterminado" quando o estrato não traz informação. Também d de Cohen por versão.
  Conferido com statsmodels `StratifiedTable`.
- **Dupla correção cega** (`vertice_avalia_double_scoring`): amostra determinística (hash),
  sem a 1ª nota; o 2º corretor não pode ser quem lançou a 1ª; critérios devem somar a nota.
  **Concordância** (`agreement.ts`): ICC(2,1) de Shrout & Fleiss (conferido com o exemplo
  publicado, 0,29), diferença média, viés e % dentro de 10%; mínimo de 5 pares.
- **Reutilizar no bloco 5:** domínio por competência (bloco 1), `effectiveBloom`, matriz
  anonimizada e o padrão de RPC por escopo.

### Bloco 5 — prontidão ENADE/OAB e risco (PRONTO)
- **Aplicada em produção em 21/11/2026**, após confirmação do usuário (a substituição da view
  `v_student_evasion_risk` exige aprovação no Supabase). Conferido: `security_invoker` mantido,
  251 linhas na view (igual ao cadastro), 3 colunas novas no final, RPCs recusam sem sessão.
- **Matriz do exame** (`vertice_avalia_exam_matrices`): áreas com peso e competências (`cmp:`),
  com edição e fonte (edital/portaria) obrigatórias; só o colegiado cadastra; quem cadastrou não
  valida; validar uma nova arquiva a anterior do mesmo exame. ENADE tem modelo editável
  (formação geral 25%, componente específico 75%, a conferir no edital); OAB sem números
  pré-definidos (a distribuição muda por edital).
- **Prontidão** (`readiness.ts`): nota da área = média do domínio (bloco 1) nas competências com
  evidência; índice ponderado pelos pesos; cobertura < 50% ⇒ "evidência insuficiente";
  ≥ 70% pronto, 50–69% em desenvolvimento, < 50% em risco. Não é previsão de nota.
- **Risco acadêmico** (`academic-risk.ts`): tendência por mínimos quadrados (p.p./90 dias,
  3+ provas; conferida com numpy), competências não demonstradas e últimas notas. Alto / Atenção,
  sempre com motivos.
- **Integração com o alerta de evasão:** publicação pelo colegiado em
  `vertice_avalia_risk_signals` (retrato que substitui o anterior; leitura com a mesma regra do
  cadastro de alunos, `can_read_institution`); `v_student_evasion_risk` ganhou 3 colunas no final
  (`academic_risk_level`, `academic_risk_reasons`, `academic_risk_at`) sem mudar `risk_score` nem
  `risk_level`; `EvasionRiskPanel` mostra a coluna "Desempenho (Avalia 360°)".

## Próximos passos possíveis
- Correção por critério também na 1ª correção das discursivas.
- Recuperação respondida pelo aluno no Portal do Aluno (outro módulo; decisão do usuário).
- Corrigir a gravação da Construção Curricular (outro módulo).
- Incluir os specs do Avalia 360° no CI.

## Construção Curricular — gravação corrigida (2026-11)
- RPC `public.vertice_curriculum_build(inst, course, 'get'|'save'|'publish', payload)` (migração `20261122150000`).
- Rascunho atualizado no lugar (ids estáveis); editar matriz publicada abre nova versão; publicar arquiva a anterior.
- Período de origem (1–12) e situação (proposto/homologado) por competência — alimentam a importação do Avalia 360°.
- Cliente: `client/src/lib/curriculum-api.ts`; `CurriculumBuilder.tsx` e a importação de `TrailAnalysis.tsx` usam a RPC.
- Trilhas de Formação (migração `20261122250000`): RPC `vertice_formation_trails` (get, save_trail, delete_trail,
  import_curriculum, add_question, delete_question, save_snapshot, institution_diagnostic). Gravação: gestão ou
  coordenação/NDE do curso; discrepância e ranking do instantâneo calculados no servidor; importação lê a matriz
  publicada vigente. Cliente: `lib/trails-api.ts` (TrailAnalysis, SapiensPanel, Governança 360°).

## Coordenação e NDE por curso (2026-11)
- `vertice_memberships` só admite gestor/equipe/leitor; 106 políticas reconhecem "equipe" sem "coordenador".
  Por isso a função no curso é uma camada própria: `public.vertice_course_staff_functions` (migração `20261122170000`).
- Gestão (master/gestor/reitor/direções/procurador) atribui e encerra por `vertice_course_staff(inst,'list'|'grant'|'revoke')`;
  cada membro lê as próprias com `'mine'`. Encerrar preserva histórico (revoked_by/revoked_at).
- `vertice_private.course_function(inst,course)` (MFA + vínculo institucional) entra em `teaching_access`:
  coordenação = acesso completo (inclui validar); NDE = leitura. Construção Curricular: coordenação e NDE editam.
- Interface: painel "Coordenação e NDE por curso" na aba Equipe; abas Avalia 360° e Construção Curricular liberadas
  para quem tem função; a edição da matriz é decidida pelo servidor (`canWrite`).
- Planejamento (migração `20261122190000`): `course_planning` (gravar/publicar), `can_interpret` (interpretação,
  inteligência competitiva, portfólio, recortes do Sapiens) e a porta institucional de `sapiens` reconhecem a função.
  Abas de planejamento liberadas para quem tem função; edição só no curso da função.
- Discursiva 360°, Conecta, Mercado e PDI (migração `20261122210000`): `vertice_discursiva.authorize`,
  `vertice_conecta.allowed` + portas institucionais de `alumni_indicators` e `api`, `vertice_market.allowed`
  (perspectiva acadêmica; comercial segue só master) e `pdi_access` (consulta) reconhecem a função.
  `course_function`/`has_course_function` só são chamadas por dentro de funções security definer; a execução direta
  por authenticated concedida em `20261122210000` foi retirada em `20261122230000` (desnecessária).
