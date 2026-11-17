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


## 2026-11-16 — Passagem de execução: CI validado, fontes pendentes e fila médica #170
- **Entrada:** Bíblia v1.6, Plano e Diário; PR #168; scripts e testes existentes.
- **Automação:** GitHub Actions run `43997164508` completo success: 2 testes do dicionário + 4 de integração Node, 4 testes Python de arquivo sintético, todos sem falhas. Teste TypeScript/SSR de interface na execução da última branch ainda depende do workflow `43997164461`.
- **PDFs INEP:** consulta ao edital oficial republicado 71/2026 e ao catálogo Inep. Tentativa de download binário no ambiente falhou; nenhum SHA-256 real. Os três source URLs cadastrados no F&O foram inventariados com status `não autenticado`, sem alegar identidade documental.
- **Curadoria:** issue #170 criada com 200 posições duplicadas, duas diferenças de alternativas e as demais divergências estruturais; nenhum revisor médico individual designado e nenhuma revisão paga por duas IAs disparada.
- **Regressão e perfil:** testes SSR/visibilidade adicionados; coordenador/NDE não têm acesso direto a ENADE institucional na navegação atual, apesar de possuírem Trilhas ENADE. Exige mudança deliberada e RLS por curso, não simples habilitação visual.
- **Evidências:** `CONFLITOS_DUPLICATAS_ENAMED_2026.csv`, `FONTES_FO_PENDENTES_AUTENTICACAO_20261116.json`, `E1_CADEIA_CUSTODIA_E_REGRAS_20261116.md`, issue #170 e Actions #43997164508.
- **Estado final:** E1 não homologada; E2/E3 preparatórias; PR #168 draft, sem publicação; bancos e históricos intactos.


## 2026-11-16 — E1: cobertura por caderno e perfil, sem autenticação de binários
- **Herança:** Bíblia v1.7, Plano, Diário e catálogo E1 conferidos; decisões e preservação de produção mantidas.
- **Fontes oficiais:** o portal Inep lista aplicação regular com Cadernos 01/02 e reaplicação com Cadernos 01/02; gabaritos disponibilizados no catálogo são preliminares na data verificada. HTML simplificado sem URLs; notas 40/19/1PL/42 retornaram timeout/502; tentativa de baixar Caderno 02 de 2025 falhou.
- **Banco F&O:** 3 URLs declaradas para ENAMED 2026: C1 regular (200 linhas/100 posições), C2 regular (200/100), C1 reaplicação (83/83), C2 reaplicação sem registros identificados nessa tabela. Potencial lacuna de cobertura, não ausência global comprovada.
- **Perfis:** nav `enade` a Master/Reitoria/CPA, não a Coordenador/NDE; sem teste de sessão autenticada nem escopo de RLS. Os quatro testes SSR adicionados anteriormente ainda não comprovam essas sessões.
- **Código/documentação:** `E1_COBERTURA_OFICIAL_E_PERFIS_20261116.md` criado; nenhuma migração, merge, deploy ou alteração de questão/estudante executada.
- **Aceite:** E1 bloqueada por PDFs/arquivos integrais e hashes; E2/E3 preparatórias; PR #168 draft. Próximo foco: origem oficial íntegra e perfis em homologação controlada.


## 2026-11-16 — E1: recuperação pela rede CI, bloqueio de URLs e QA de perfis
- **Leituras herdadas:** Bíblia v1.8, Plano, Diário, catálogo de fontes, PR #168 e trilha de auditoria 483/283/200.
- **CI confirmado:** em commit `ae19a884...`, 8 workflows aprovados, TypeScript completo Node 22/24 e 415 testes principais aprovados. Os 4 testes SSR ENAMED estavam ausentes do `vitest.config`; inclusão realizada no commit `ce996872...`; aguarda execução da revisão final.
- **Recuperação:** container sem DNS, web 502/timeout para URLs declaradas no F&O. Run `43999397676` do GitHub acessou HTML do catálogo do INEP e encontrou 0 links diretos / 0 PDFs. Segunda execução `43999518665` também zerou candidatos, HTML sem marcador esperado. Sem SHA-256 oficial.
- **Tentativa JS:** criado script com Playwright para renderização. Run `43999660361` falhou no preparo do navegador por incompatibilidade de SO. Corrigido runner Ubuntu 24.04; execução subsequente foi cancelada por commits novos; resultado final ainda pendente.
- **RLS:** examinada a política `learning_metrics_read`, com condições de IES/papel, MFA `aal2` e escopo staff. Ausência de navegador conectado impede testar sessões reais. Não proclamar homologação por perfil.
- **F&O:** duas tabelas ENAMED nomeadas, `fo_enamed_items` registra 83 posições de reaplicação C1 e nenhuma de C2; lacuna candidata, sem modificação.
- **Artefato:** `E1_COLETA_BINARIOS_E_QA_PERFIS_20261116.md` com URLs, relatórios Actions e aceite pendente.
- **Estado:** E1 aberta, E2/E3 preparatórias, PR #168 draft, produção preservada; pendências explicitamente mantidas.


## 2026-11-16 — E1: 11 URLs oficiais descobertas com browser; certificados de PDF bloqueados
- **Entrada:** Bíblia v1.9, Plano e Diário; tentou-se primeiro HTML estático, sem URLs.
- **Browser:** run `43999991024` em Ubuntu 24.04 instalou Chromium, renderizou `www.gov.br/inep` com JavaScript e extraiu 11 URLs de PDFs, 837 âncoras. JSON oficial versionado com metadados de aplicação, caderno, tipo e `sha256:null`.
- **Transferência:** urllib não concluiu nenhum dos 11 documentos (TLS issuer/reset); `curl` no run `44000426717` tentou oito documentos principais, 0 êxitos, sete `curl 60` e um `curl 35`. Não foi usado bypass de TLS, não houve SHA-256 de PDF.
- **Acurácia:** URL dos três cadernos já declarados no F&O coincide com URL publicada pelo INEP; Caderno 2 da reaplicação e dois gabaritos da reaplicação agora têm links oficiais identificados. Isso não valida conteúdo nem gabarito definitivo, ainda previsto para 04/12/2026.
- **Código:** `discover_public_inep_pdfs.py`, `render_inep_public_catalog.py`, `download_verified_links_curl.py`, workflow `enamed-inep-public-corpus.yml` e `INEP_2026_LINKS_OFICIAIS_CONFIRMADOS.json`. Nenhuma migração ou escrita em banco.
- **Permissões:** testes estáticos / SSR adicionados à suíte; logins reais com MFA e escopo de cursos ainda não executados. A aprovação do TypeScript em commit anterior não é aceite de sessão real.
- **Próxima barreira:** obter binários com cadeia de certificados verificável ou canal oficial alternativo; após isso homologar provas, 483 itens, duplicatas, competências e gabaritos. E1 aberta, E2/E3 preparatórias, PR #168 draft.


## 2026-11-16 — Resultado final do CI: 419 testes principais aprovados
- **GitHub Actions:** run `44000644637` terminou success em Node 22/24. Em Node 22, `tsc --noEmit` passou; 52 arquivos e **419 testes principais** aprovados, entre eles os **4 testes EnamedEnvironment.test.tsx** recentemente incluídos. Grupos complementares 214+19+30 aprovações; Vite `built in 9.74s`.
- **Limite da evidência:** simulação SSR/visibilidade não substitui testes RLS autenticados por perfil ou dispositivo, que permanecem em aberto.
- **E1:** 11 URLs PDF diretamente publicadas no DOM Inep (run `43999991024`), mas 0 PDF obtido com confiança TLS: 8 transferências `curl` em `44000426717` falharam por erro de certificado/reset. Não declarar documentos autenticados.
- **Decisão:** documentação cumulativa v2.1; E1 não homologada, E2/E3 somente preparatórias; PR #168 draft, sem merge ou deploy; F&O, gabaritos e históricos preservados.


## 2026-11-17 — E1: oito PDFs recuperados sob TLS validado, 483 gabaritos preliminares conciliados
- **Entrada:** Bíblia v2.1, Plano, Diário; issue #167, issue #170 e PR #168.
- **Cadeia TLS:** diagnóstico `download.inep.gov.br` detectou intermediária ausente no handshake, emissor `RNP ICPEdu GR46 OV TLS CA 2025`. Nova ferramenta `download_inep_verified_chain.py` baixou a intermediária e a verificou criptograficamente até raiz do sistema antes de fazer HTTPS com verificação ativa. Sem `curl -k` ou desligamento TLS.
- **Fonte/artefato:** run `44017133303` (success), artefato `14299257407`, **8 PDFs recuperados**; todos SHA-256 recomputados do ZIP e iguais aos metadados da execução. URLs, hashes, tamanhos e páginas preservados no novo JSON; PDFs de prova: 28 páginas cada, gabaritos preliminares: 2 páginas cada.
- **Confronto SQL somente leitura:** quatro gabaritos preliminares com 100 chaves cada. Regular C1: 200/200 registros F&O coincidentes; regular C2: 200/200; reaplicação C1: 83/83; **483/483 coincidências**, nenhuma divergência de letra. O status `definitivo` do banco segue sem validação pela publicação preliminar e não foi alterado.
- **Cobertura:** reaplicação C1 tem 17 posições sem registro na tabela; reaplicação C2 tem 100 posições oficiais com zero registros encontrados em `fo_enamed_items`; sem comprovar inventário global ou aprovar importação.
- **Duplicatas:** q19 e q28 regular C1, duas diferenças em alternativas, exibem variação de pontuação/whitespace, não troca de resposta; demais 57 variações de enunciado, 191 subtema e 192 keywords não homologadas.
- **CI e portal:** recuperação, contratos ENAMED e TS completo concluíram success no commit `ccda5e4...`. Sem sessão autenticada por perfil (Master/Reitoria/CPA/Coordenação/NDE/outra IES) e sem deploy Render desta PR.
- **Documentos criados:** `INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json` e `E1_CONFRONTO_GABARITOS_PRELIMINARES_483_20261117.md`; registro cumulativo v2.2.
- **Decisão:** E1 **ainda aberta** até validade das versões definitivas, notas metodológicas, identidade textual dos itens e aceite regulatório; E2/E3 preparatórias, E9 institucional futura. **Nenhum registro de questões, gabaritos ou estudante foi alterado.**


## 2026-11-17 — Auditoria textual de aberturas e permutação oficial C1/C2
- **Herança:** Bíblia v2.2, Plano, Diário, PDFs oficiais do artefato 14299257407, catálogo de hashes, relatórios de 483 gabaritos preliminares concordantes, issue #170.
- **PDFs:** PyMuPDF com páginas de questões (excluindo questionário de percepção) identificou 100/100 questões por caderno. Verificação de página renderizada confirmou layout de duas colunas e questão de reaplicação 78 C2.
- **Permutações:** regular C2→C1: 100/100 aberturas normalizadas e 100/100 letras preliminares concordantes; reaplicação C2→C1: 100/100 e 100/100; um prefixo com marcador gráfico adicional foi associado com similaridade ~98,2%. Mapas são bijetivos, em rascunho até checagem integral de conteúdo e mídia.
- **F&O somente leitura:** 483 registros consultados em lotes e comparados com os 24 caracteres iniciais normalizados dos enunciados oficiais remapeados: regular C1 200/200, regular C2 200/200, reaplicação C1 83/83. **Triagem inicial, não homologação integral.** Nenhuma alteração de banco.
- **Correção de hipótese anterior:** reaplicação C2 representa os mesmos 100 casos em outra ordem; a lacuna candidata de *conteúdo* permanece 17 questões da reaplicação C1, e não 117 questões inéditas. As 100 posições C2 ausentes da tabela ainda exigem mapeamento de apresentação.
- **Artefatos:** `ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json`, `ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json`, `ENAMED_2026_REAPLICACAO_17_POSICOES_EQUIVALENTES.json`, `E1_AUDITORIA_TEXTUAL_483_E_MAPA_CADERNOS_20261117.md`, `scripts/tests/enamed-booklet-maps.test.mjs`; workflow ENAMED atualizado.
- **QA:** execução anterior de TypeScript/419 testes comprovada em commits anteriores; verificar execução final do novo workflow. Sessões reais autenticadas por perfis continuam não executadas; PR #168 draft, sem deploy.
- **Estado:** E1 não aceita integralmente; revisão clínica e duas IAs não disparadas; nenhuma questão, gabarito ou tentativa de estudante modificada.


### 2026-11-17 — Adendo: divergências normalizadas por campo
- Consulta somente leitura em `fo_enamed_items`: 200 posições duplicadas; 57 enunciados brutos distintos, 31 após ignorar espaços, 22 após ignorar espaços/pontuação; todas as 22 posições no regular Caderno 2. Alternativas: 2 diferenças brutas e 0 após ignorar espaços.
- Novos artefatos: `ENAMED_2026_22_DIVERGENCIAS_TEXTUAIS_PERSISTENTES_C2.json` e adendo `E1_AUDITORIA_TEXTUAL_483_E_MAPA_CADERNOS_20261117.md`.
- Nenhuma alteração em gabaritos, itens, históricos, banco ou RLS. Divergências alfanuméricas não equivalem automaticamente a erro semântico. A análise clínica integral e autenticação por perfil continuam pendentes.


### 2026-11-17 — Roteiro de QA institucional
- Novo artefato `ENAMED_2026_ROTEIRO_HOMOLOGACAO_PERFIS.md`: 16 cenários sintéticos de login/MFA/RLS por perfil, instituições e cursos, e responsividade; execução não realizada por falta de navegador autenticado contextual.
- Nenhuma permissão, token, dado real ou tabela foi alterado. E1 sem aceite integral; homologação de perfis ainda bloqueia merge/deploy.


## 2026-11-17 — Triagem direta de 22 variantes do Caderno 2 e mídias
- **Leituras herdadas:** Bíblia v2.3, Plano, Diário, PDF oficial regular C2 com SHA-256, 22 conflitos identificados e mapa de permutações/páginas.
- **SQL read-only:** 22 pares de versões: primeira região textual divergente inspecionada; campos `blocks`, `source_page`, `source_hash`, `competencies` inventariados. 483/483 `blocks=[]`, 223 `source_page=NULL`, 483 `source_hash=NULL`, 483 `competencies=[]`.
- **Achados PDF:** Q12 C2 utiliza diagrama e tabela Lund–Browder; Q81 C2, imagem dermatológica; Q82 C2, radiografia. Os campos `blocks` dessas questões estão vazios; outras fontes possíveis de mídia no portal não foram inspecionadas.
- **Classificação de triagem (não clínica):** variações em tabelas laboratoriais e valores (Q40,42,44,45,49,51,74,90), contextos de paciente/ética/urgência e grafia técnica; a equivalência integral das questões não foi atestada.
- **Criado:** `ENAMED_2026_TRIAGEM_22_VARIANTES_TEXTUAIS_C2.json`; `E1_AUDITORIA_22_VARIANTES_E_MIDIAS_20261117.md`; `scripts/tests/enamed-text-variants.test.mjs` incluído no workflow da PR #168.
- **QA:** CI da revisão anterior aprovado; reexecução nova pendente de conclusão. Nenhuma sessão autenticada Master/Reitoria/CPA/Coordenação/NDE ou teste RLS com dados sintéticos executado.
- **Preservação:** nenhum UPDATE, DELETE ou importação de questões/gabaritos/imagens, nenhuma mudança de notas, respostas ou vínculos estudantis, PR #168 draft, sem deploy Render.
- **Status:** E1 aberta até cotejo integral e gabaritos definitivos; E2/E3 apenas preparação, E9 futura.


### 2026-11-17 — Evidência de CI da triagem de 22 variantes
- Workflow GitHub Actions `ENAMED 360 - validar contratos e dicionário`, run **44047302738**, referente ao commit `ae76798f2f6a242e51c39c7ca7ab9d85010303a9`: **success**. Log confirmou 2 testes Node do dicionário, 4 de integração, 2 de mapas, 2 dos 22 itens/páginas e 4+3 testes Python, sem falhas. A finalidade é integridade/contrato, **não homologação clínica**.
- Workflows de build ENADE e cruzamentos do mesmo commit concluíram `success`; TypeScript completo ainda estava em execução na consulta realizada, portanto **não declarar o HEAD integralmente homologado**.


## 2026-11-17 — Três ações em sequência: 22 pares integrais de base, seis imagens PDF e testes
- **Entrada:** Bíblia v2.4, Plano, Diário e oito PDFs oficiais com hashes verificados; preservados ADRs e fila da Issue #170.
- **1 — Banco somente leitura:** recuperados `stem` completos e JSON de alternativas dos dois IDs das 22 posições REG-C2. Oito pares apresentaram diferenças de tokens numéricos: Q12,42,44,49,74,89,90,99. As 22 duplas mantiveram alternativas idênticas após normalizar whitespace. **Sem comparação integral automatizada PDF×cada versão; sem juízo médico**.
- **2 — Mídia:** inspeção de layout PDF PyMuPDF e renderização de páginas C2 REG. Seis imagens com XREF/posicionamento dentro de questões Q12 (Lund–Browder), 68 (radiografia de pelve), 81 (foto dermatológica), 82 (contraste radiológico), 89 (tomografia abdominal), 97 (USG transvaginal); bytes e SHA-256 registrados em manifesto, sem publicar imagens no GitHub ou Storage.
- **3 — Contratos:** novo teste Node cobrindo os 22 registros, 8 diferenças numéricas e 6 fontes rasterizadas, com bloqueio de `approval`; integração ao workflow `verify-enamed-contracts.yml`.
- **Governança:** relatório `E1_TRES_ACOES_TEXTOS_MIDIAS_CONTRATOS_20261117.md`, manifestos de comparação e mídia, Biblia-Mestra v2.5, Plano atualizado; evidências geradas exclusivamente em branch draft. Nenhum UPDATE/DELETE/importação, nenhuma tentativa/histórico/gabarito alterado.
- **Acesso:** 16 cenários autenticados por Master/Reitoria/CPA/Coordenação/NDE/multi-IES continuam **não executados**; CI não equivale a sessão real.
- **Estado:** E1 parcial sem aceite integral; E2/E3 apenas preparação; PR #168 draft, não publicada.
