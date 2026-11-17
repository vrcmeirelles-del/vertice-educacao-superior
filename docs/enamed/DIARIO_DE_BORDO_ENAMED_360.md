# DIÁRIO DE BORDO — ENAMED 360° / INEP INTELLIGENCE
**Data-base:** 16/11/2026 · **Versão inicial:** 1.0  
Leia em conjunto com `BIBLIA_MESTRA_ENAMED_360.md` e `PLANO_DE_TRABALHO_ENAMED_360.md`.

## 2026-11-16 — E0: Fundação do projeto
**Foco:** arquitetura transversal, sem dados reais institucionais nesta etapa.

**Entregas verificadas:** revisão de fontes oficiais identificadas em conversa; leitura do código da Vértice, PR #168 e documentação técnica; consulta somente leitura ao Supabase Fato & Ordem; inventário dos acervos; elaboração da Bíblia e do Plano. A publicação desses documentos ocorre na branch da PR #168, não na produção.

**Evidências herdadas:** `docs/implementation/learning-medical-validation-20261113.md` (testes sintéticos da ponte); `docs/sapiens/REVISAO_TEMATICA.md` (revisão por duas IAs apenas propositiva); `docs/enamed/AUDITORIA_TAXONOMIA_20261116.md`; Issue #167; PR #168.

**Fatos:** 483 registros ENAMED 2026; competências vazias nos 483; classificação de área apenas "Medicina"; 483 hashes ausentes; duplicações por caderno+número; status definitivo sem comprovação suficiente; existência dos acervos ENADE e Residência, sem parecer integral de aderência.

**Decisões:**
- ADR-ENAMED-001: fonte de verdade regulatória = arquivo oficial versionado.
- ADR-ENAMED-002: uma ontologia transversal com códigos oficiais por instrumento e edição; sem misturar provas.
- ADR-ENAMED-003: estudante longitudinal unificado somente após conciliação legítima.
- ADR-ENAMED-004: diagnósticos internos ≠ nota/conceito oficial; dados insuficientes não são zero.
- ADR-ENAMED-005: instituição é tenant isolado; fase atual independente de instituição específica.
- ADR-ENAMED-006: evolução cumulativa: ler, herdar, melhorar, testar, atualizar Bíblia e diário.

**Pendências:** download, autenticação e leitura integral das fontes primárias; matriz de competências literal; auditoria 483/483 com cadernos e gabaritos; execução de testes CI/build; confirmação de deploy, RLS e dados institucionais. **Nenhum item alterado no F&O.**

**Status:** E0 — documentação em implementação no código, pendente de revisão e merge; E1–E8 planejadas; E9 futura.

## Modelo de novas entradas
```markdown
## AAAA-MM-DD — E{N}: Título
- Versão da Bíblia lida:
- Evidências recebidas/checadas:
- O que foi preservado:
- O que foi melhorado:
- Fontes e hashes:
- Testes/regressões:
- Decisões ADR:
- Limites e riscos:
- Status real (código / teste / homologação / deploy):
- Versão atualizada da Bíblia:
- Entrada necessária para E{N+1}:
```


## 2026-11-16 — E1: primeira rodada do corpus INEP (não encerrada)
- **Versão de entrada:** Bíblia 1.0, Plano 1.0 e Diário E0; Issue #167 e PR #168 consultadas.
- **Preservado:** todos os contratos e decisões E0, sem edição de perguntas, gabaritos, estudantes, instituições ou migrações de produção.
- **Documentos gerados:** `INEP_CATALOGO_FONTES_E1.md`; `INEP_MATRIZ_REGRAS_E1.md`; complementos em Bíblia, Plano e este Diário.
- **Evidências oficiais consultadas:** página normativa ENAMED 2025/2026; Portaria 478/2025 (texto DOU arquivado em domínio acadêmico); Nota Técnica 40/2025 (texto do Inep); Manual ENAMED 2026 (texto do Inep); página de gabaritos 2025/2026; microdados 2025 e planilha Conceito Enade Medicina 2025.
- **Descoberta/correção ADR-ENAMED-007:** não extrapolar a enumeração abreviada de 12 competências para a enumeração literal I–XV da Portaria 478/2025. O art. 6º VI trata de procedimentos; VII, de intervenções coletivas. A ontologia ainda não está importada.
- **Cálculo verificado:** NT40: `PCP=NCP/NC`, ao menos 10 válidos, critérios por TP_INSCRICAO/IN_REGULAR/TP_INSCRICAO_ADM/TP_PRES e faixas 1–5. 11 testes **sintéticos locais** dos limiares PCP/SC passaram. Não foram executados testes no Vértice, banco nem comparação com dado oficial por curso.
- **Limitação documental:** conexão direta do ambiente não resolveu `download.inep.gov.br`; PDFs disponíveis para leitura textual pela ferramenta de consulta, mas arquivos binários oficiais não foram materializados nem hash calculado; leitura integral e vigência pendentes. Status do conjunto **não é ARQUIVO_AUTENTICADO**.
- **Retificações:** 2026 possui editais republicados e publicação de gabaritos preliminares. Pendentes documentos integrais, verificação de cronologia e posição normativa atual.
- **Status real:** documentação E1 registrada na branch da PR #168; nenhum merge, deploy, alteração de produção ou homologação desta etapa comprovado.
- **Próxima entrada necessária:** recuperar corpus íntegro, hashes e regras de todas as notas/retificações e validar contagens oficiais antes de encerrar E1. **E2 não iniciada.**


## 2026-11-16 — E1 ainda aberta; incremento de interface E7 sem efeitos em produção
- **Leitura prévia:** Bíblia 1.1, Plano, Diário e código de `LearningConnected.tsx`, `EnamedEnvironment.tsx`, `Enade360.tsx` na branch da PR #168.
- **Preservado:** contrato E1 e bloqueios; ENADE 360°; F&O como repositório; resultados INEP nunca simulados; isolamento de IES; E9 com dados reais reservada à fase futura.
- **Novo código:** `source-overrides/client/src/components/area/EnamedFatoOrdemMetrics.tsx`; aba correspondente em `EnamedEnvironment.tsx`.
- **Ponte aproveitada:** tabela real da Vértice `public.vertice_learning_course_metrics` com colunas `institution_id, course_id, semester, subject_code, module, competency, participants, attempts, graded, correct, paired_students, external_accuracy, curricular_average, updated_at`.
- **Read-only DB:** estrutura da tabela verificada, RLS habilitada (1 política detectada). Consulta `group by module` para os módulos enade/enamed/residencia retornou **nenhuma linha**, não se inferindo dados ou falha de sincronização por essa ausência.
- **Testes:** 10 verificações de contrato feitas sobre código recuperado do GitHub, todas passaram (arquivos, legado, aba, filtros de IES e curso, limite de grupos, leitura apenas, segregação de módulos, rótulo de origem e teste criado). Foi criado `scripts/tests/enamed-integration-contract.test.mjs`, mas **não foi executado em checkout Node**. Ainda pendentes build/TS, testes de navegação, contrato autenticado, RLS por papel e CI.
- **Estado de produção:** nenhum banco modificado, nenhuma PR integrada, nenhum deploy constatado. Status: `IMPLEMENTADO NO CÓDIGO` para aba/consulta, `NÃO HOMOLOGADO` para integração.
- **Recomendação:** continuar o corpus E1 e fazer CI/QA do incremento em ambiente seguro; só ativar índices INEP após autenticação dos documentos.


## 2026-11-16 — Verificação de compilação, acesso, sincronização e fontes INEP
- **Entrada:** Bíblia 1.2; E1 aberta; E7 UI com consultas agregadas na PR #168.
- **Build:** Actions #43989469247 (ENADE 360 integração no Render) concluiu success para compilação estática; não prova deploy. Workflow #43989469122 falhou no TypeScript completo por 2 TS2345 nas tabelas da Governança, embora 17 testes TS e 20 de planejamento tenham passado. Ajuste do tipo `Table` commit `bdf79937c581b4386d7484f0c79d5ffb573c6d11`, reexecução CI em andamento; resultado ainda pendente. Nenhum teste de interface autenticada/browser realizado.
- **Acesso:** política RLS `learning_metrics_read` encontrada. Leitura institucionais com papel ou MFA+escopo docente; `can_read_institution` e `has_role` examinadas em leitura; Master necessita teste autenticado para verificar correspondência das funções. Testes efetivos por papéis pendentes.
- **Ponte:** no F&O 12 ENADE, 11 ENAMED, 9 Residência (registros de tentativas), 3235 vínculos/2 instituições; no destino `vertice_learning_course_metrics` = 0 grupos. Falha de alimentação não atribuída a causa única; pode haver requisitos acadêmicos de conciliação e mapeamento não satisfeitos.
- **Portal:** Render `vertice-portal` ativo, deploy `23d625c5ae9b2fd7aacaf94371e6fb840eb71106` status live. A PR #168 ainda não está na main nem publicada.
- **INEP:** PDF NT40/2025 visto em domínio oficial, página 1 conferida com SEI nº 1844476 e CRC AD834C1B; demais NTs 19, 1PL, 42 não baixadas por timeout/502; microdados 2025 têm metadado de atualização textual divergente. Hash integral pendente.
- **Preservado:** não houve escrita em bancos, ativação de sincronização, importação institucional, merge, deploy ou modificações de gabaritos.
- **Status:** E1 aberta; E2 bloqueada; E7 código em evolução, testes/homologação pendentes; E9 futura.

## 2026-11-16 — Dicionário oficial preliminar e auditoria concomitante (sem produção)
- **Leitura de entrada:** Bíblia v1.3, Plano e Diário; sem reinício de projeto.
- **Fonte examinada:** Portaria Inep 478 de 18/07/2025, reprodução DOU de quatro páginas; artigos 3º, 6º, 7º e 8º. PDF foi inspecionado visualmente via ferramenta de consulta; hash binário e validade completa ainda pendentes.
- **SQL read-only F&O:** 483 registros ENAMED; 483 competências vazias; 483 hashes ausentes; 483 áreas genéricas; 483 com palavra-chave de edição; 433 com keyword exata `medicina`; 200 pares fonte/número repetidos.
- **Artefatos criados:** `DICIONARIO_COMPETENCIAS_478_2025_DRAFT.json`, `FILA_REVISAO_483_ENAMED_2026.csv`, `AUDITORIA_CONCOMITANTE_483_20261116.md`, `scripts/tests/enamed-dictionary-contract.test.mjs`.
- **Resultados da fila:** todos os 483 IDs preservados; 343 áreas candidatas por disciplina e 140 ausentes, sem inferência clínica nem aprovação.
- **Testes executados:** 11 invariantes sobre os quatro arquivos obtidos do GitHub, todas aprovadas. Script Node versionado, mas execução Node/CI ainda não verificada.
- **Evidência:** dados SQL do Supabase F&O nesta sessão e SHAs/links da branch PR #168; nenhuma questão, gabarito, resposta ou vínculo de estudante modificado.
- **Decisão ADR-011:** separar sugestão editorial/área, norma versionada e classificação aprovada; duas IAs independentes e médico revisor antes de publicar.
- **Status real:** E1 não encerrada, E2/E3 com preparativos somente, sem homologação nem aplicação no banco. E9 institucional permanece futura.


## 2026-11-16 — Retomada da E1, auditoria interna aprofundada e CI
- **Leitura inicial:** Bíblia-Mestra, Plano e Diário na PR #168, junto com Catálogo E1 e Matriz de Regras.
- **Fonte INEP:** página de provas e gabaritos (marcadores de 2026 e 2025), notas técnicas 40/19/1PL/42; Portaria 478/2025 em reprodução do DOU de 4 páginas, visualmente inspecionada. Tentativas de download dos binários INEP falharam por resolução DNS/HTTP 502; manual PDF também sem screenshot. Não há hash SHA-256 oficial.
- **SQL F&O somente leitura:** 483 registros, 283 posições distintas, 200 duplicadas; 57 enunciados, 2 alternativas, 6 temas, 191 subtemas, 192 keywords diferentes entre cópias; zero divergência interna de gabarito. Método e ressalvas no relatório `E1_CONFRONTO_DOCUMENTAL_483_20261116.md`.
- **CI:** no commit anterior a PR teve 414 de 415 testes passando, com falha na lista de `InstitutionTabs`. A branch passou a incluir `construcao-curricular` e `trilhas-enade` no macro acadêmico, sem alterar permissões RLS. Workflow `verify-enamed-contracts.yml` criado e passou **6 de 6 testes Node** no run `43994963032`; não equivale a testes de navegador nem homologação médica.
- **Preservação:** nenhuma escrita em produção, nenhuma modificação de questão ou resposta, e nenhuma alteração de gabarito. PR permanece draft. E1 aberta; E2/E3 preparatórias.
- **Próxima decisão:** recuperar fontes oficiais binárias, confrontar matrizes e PDFs, efetuar regressão de navegação e iniciar curadoria médica independente quando documentos autenticados estiverem disponíveis.


## 2026-11-16 — Passagem E1: origem, hashes futuros e testes de interface
- **Entrada conferida:** Bíblia v1.5, Plano, Diário, Catálogo, Matriz de Regras e PR #168.
- **Fonte verificada:** Edital 71/2026 republicado (texto PDF do DOU em domínio Inep, publicação 21/08/2026, seção 3 p.53). 8º e 12º semestres, prova 100×4, corte bibliográfico 03/07/2026, gabarito definitivo previsto em 04/12/2026. Screenshot do PDF não disponível, binário não materializado/hashada.
- **Fronteira de origem:** página Inep lista cadernos e gabaritos preliminares, mas não expôs URLs nos resultados HTML; os três URLs já armazenados em F&O foram catalogados como **não autenticados** no novo JSON.
- **Erro técnico de recuperação:** `download.inep.gov.br` por container retornou NameResolutionError; consulta web de PDFs retornou 502/timeout. Nenhum SHA-256 de PDF real.
- **Revisão F&O:** CSV individual de 200 posições duplicadas e divergências de campo; metadados somente, sem apagar IDs.
- **Engenharia:** arquivo Python offline de verificação de integridade e quatro testes sintéticos, e quatro testes Vitest SSR/visibilidade de perfil. Workflows atualizados em PR; aprovação do pipeline da última edição deve ser inspecionada.
- **Constatação de navegação:** `enade` disponível para Master/Reitoria/CPA, mas não para coordenador/NDE; estes veem `trilhas-enade`. Não mudar autorização sem validação do escopo.
- **Status:** E1 parcial, E2/E3 preparatórias, nenhuma alteração em banco, gabarito, aluno, migração ou Render; PR #168 permanece draft.
