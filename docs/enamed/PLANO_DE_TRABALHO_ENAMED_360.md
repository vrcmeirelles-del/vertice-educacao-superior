# PLANO DE TRABALHO — ENAMED 360° E INEP INTELLIGENCE
**Versão 1.0 | Data-base 16/11/2026 | Escopo estrutural multi-IES; sem piloto real nesta fase.**
**Documento vinculante:** `BIBLIA_MESTRA_ENAMED_360.md`. **Trilha de evidências:** `DIARIO_DE_BORDO_ENAMED_360.md`.

## Ritual cumulativo obrigatório
Cada etapa inicia por leitura da Bíblia + plano + diário + PRs anteriores, atualiza inventário de herança e abre checklist de regressão. Cada etapa fecha por demonstração, evidências, decisões ADR, atualização dos três documentos e aceite. Se um bloqueio existir, manter etapa aberta. Sem implementação paralela que ignore as decisões anteriores.

## Macrocronograma orientado por dependências (sem prazo artificial)
| Fase | Entrega acumulada | Dependências | Critérios de passagem | Estado em 16/11 |
|---|---|---|---|---|
| E0 — Fundação | Bíblia, plano, diário, issue e escopo, baseline de código | Nenhuma | Documentos versionados e links cruzados | IMPLEMENTADO NO CÓDIGO (documentação), publicação pendente |
| E1 — Corpus oficial | Inventário normativo, editais, retificações, matriz, metodologia, fontes, PDF/XLSX/ZIP originais e SHA-256 | E0 | Documentos autenticamente recuperados; 100% dos campos essenciais e versões identificados; pendências explícitas | PLANEJADO |
| E2 — Ontologia | Dicionário versionado 5 dimensões da matriz, 7 áreas, competências, contextos, conteúdos; regras interexames | E1 | Mapeamentos e conflitos fundamentados; revisão clínica e regulatória; testes de integridade | PLANEJADO |
| E3 — Auditoria F&O | Confronto enunciado, comando, alternativa, gabarito, tema, subtema, keywords e competência de 483 registros ENAMED | E1–E2 | Relatório por item; aliases para duplicatas, hashes e versões; 100% revisados ou explicitamente bloqueados, sem sobrescrever históricos | PLANEJADO |
| E4 — Motor oficial | Importador staging, indicadores e método oficial versionado, status preliminar/definitivo e SC | E1–E3 | Lote público íntegro; teste de reconciliação e metodologia, ausência não vira zero, retificação reprocessa | PLANEJADO |
| E5 — F&O multiacervo | Ligação ENAMED + ENADE histórico de Medicina + Residência Médica pela ontologia | E2–E4 | Identidade estável, pesos não arbitrários, gabaritos corretos, testes de separação de exame | PLANEJADO |
| E6 — Diagnóstico | Respostas do aluno → mapa longitudinal de competências → Sapiens → recomendação | E4–E5 | Perfis sintéticos, denominadores e incerteza explícitos, separação oficial/interno; avaliação clínica dos exemplos | PLANEJADO |
| E7 — Vértice integrada | ENAMED 360° no ENADE 360°, trilhas, currículo, 5W2H, painéis e ajuda | E1–E6 | Regressão ENADE, validação segurança/MFA/RLS, UX mobile, compilação, CI, deploy comprovado | PLANEJADO (esqueleto PR #168) |
| E8 — Homologação estrutural | Testes end-to-end, documentação de uso, runbooks, acessibilidade e auditoria | E1–E7 | Todas as portas de qualidade cumpridas, simulação multi-IES segregada, no regressions | PLANEJADO |
| E9 — Validação por instituição | Importar dados reais da primeira IES somente após autorização e contratos | E8 + IES | Conciliação documental, LGPD, aprovação institucional, análise de divergências, ajustes versionados | FUTURO — FORA DO ESCOPO ATUAL |

**Nota:** E7 pode ter implementação incremental de UI antes de E6, mas *homologação operacional* da área depende da integração. A PR #168 é um protótipo de interface e não encerra E7.

## Roteiro operacional por etapa

### E0 — Fundação e baseline
- [x] Definir fonte única e evolução cumulativa.
- [x] Preservar histórico existente ENADE 360° e ponte médica.
- [x] Registrar etapa E0 em documentos GitHub na PR #168.
- [ ] Inspecionar CI atual, Render, Supabase e estado de publicação sem inferir pelo merge.
- [ ] Revisão humana do escopo e governança.

### E1 — Corpus oficial e metodologia
- [ ] Inventariar cada portaria, edital, nota técnica, manual, retificação e matriz — órgão, número, vigência, aplicação, substituição.
- [ ] Recuperar PDFs íntegros e bases oficiais; SHA-256, metadados, versão, armazenamento imutável e logs.
- [ ] Construir tabela de correspondência norma → requisito → cálculo → teste.
- [ ] Registrar versões de gabarito preliminar/definitivo e anulações.
- [ ] Verificar cronograma 2026/2027 e regras distintas para 4º e 6º anos.
- [ ] Revisar critérios de amostra, presença, proficiência, escalonamento e "Sem Conceito" no documento literal aplicável.
- [ ] Preparar fixtures de origem com direitos e minimização.
**Saída:** `INEP_CATALOGO_FONTES`, `MATRIZ_NORMAS_REGRAS`, artefatos autenticados, ADR de temporalidade.
**Gatilho:** nenhuma questão será chamada de oficial sem fonte verificável.

### E2 — Ontologia acadêmica
- [ ] Formalizar códigos oficiais da matriz ENAMED versionada, sem inventar códigos.
- [ ] Preservar 7 áreas e contextos; separar especialidade editorial de área oficial.
- [ ] Padronizar competências principais/secundárias, temas/subtemas/keywords e operação cognitiva.
- [ ] Criar mapeamento explícito ENADE histórico e Residência para conceito pedagógico compartilhado (não igualar instrumentos oficiais).
- [ ] Submeter amostra clínica a dois revisores técnicos independentes e mediação de divergência.
- [ ] Documentar esquema de dados e migração retrocompatível (sem escrita em produção nesta fase).
**Saída:** `DICIONARIO_COMPETENCIAS`, `MAPEAMENTO_INTEREXAMES`, ADR de taxonomia.

### E3 — Auditoria completa de questões
- [ ] Registrar 483 itens existentes, 200 posições regulares duplicadas e 83 reaplicação; investigar exames de 2025.
- [ ] Comparar cada item com caderno oficial, mídia, comando, alternativa, gabarito e retificação.
- [ ] Revisar classificação: manter, ajustar, revisar manualmente, bloquear; anexar justificativa, citação e confiança.
- [ ] Reconciliar aliases e tentativas antes de eventual deduplicação lógica.
- [ ] Executar motor `thematic_review` sob autorização Master com duas IAs quando houver snapshot e fontes verificadas; custo e limites registrados; não aplicar parecer sem controle humano.
- [ ] Criar fila de curadoria médica e relatórios de cobertura, divergência, acurácia dos descritores.
**Saída:** planilha/consulta auditável por item, histórico, recibos de revisão e classificação revisada aprovada.
**Gatilho:** toda questão ativa apresenta provenance + status correto; exceções em bloqueio explícito.

### E4 — Motor oficial
- [ ] Desenvolver parser segregado por versão/layout com pré-visualização e sandbox.
- [ ] Conciliar código IES/curso com fontes oficiais, sem matrícula inventada.
- [ ] Implementar conceito ENADE conforme edição, proporção proficiente, SC e exclusões.
- [ ] Validar contra números divulgados pelo próprio Inep; documentar desvios.
- [ ] Restringir dados individuais; resultados nominais apenas em contexto autorizado.
**Saída:** pipeline reproduzível e testes de regressão por edição.

### E5 — F&O multiacervo
- [ ] Auditar ENADE histórico pertinente a Medicina e Residência Médica com seus normativos de origem.
- [ ] Criar índice central por identidade de item/competência/edição preservando origem.
- [ ] Vincular tentativas de aluno com consentimento, curso e trilha; evitar equivalência espúria.
- [ ] Implementar dedupe e controle de repetição para diagnóstico.
**Saída:** stream único de evidências com `source_exam` e `source_version`.

### E6 — Sapiens e diagnóstico
- [ ] Definir indicadores por competência, denominador, incerteza e critério de "dados insuficientes".
- [ ] Distinguir métricas por ENAMED, ENADE histórico e Residência; síntese só quando comparável.
- [ ] Validar exemplo longitudinal com estudantes sintéticos e casos-clínicos aprovados por médico.
- [ ] Adaptar prompts do `TrailAnalysis.tsx` (texto "curso de Direito" é inadequado em Medicina).
- [ ] Produzir intervenções, exercícios recomendados e retroalimentação com validação humana.
**Saída:** diagnóstico rastreável, explicável e com recomendações testáveis.

### E7 — Vértice ENAMED 360°
- [x] Esqueleto de interface em branch da PR #168, sem deploy.
- [ ] Implementar ingestão real e versionada no ambiente.
- [ ] Vincular à construção curricular e planejamento por curso/IES.
- [ ] Melhorar UX clara e responsiva; ajuda explicativa por campo.
- [ ] Integrar planos do Sapiens e 5W2H com aprovação; evidência, prazo, responsável e avaliação.
- [ ] Testar contra todo o ENADE 360° legado, RLS e perfis.
**Saída:** interface funcional, observatório e controles de qualidade documental.

### E8 — Homologação estrutural e publicação
- [ ] Testes unitários, DB, RLS, CI, integrações F&O/Render/Supabase, regressão.
- [ ] Teste end-to-end com dois tenants fictícios isolados, alunos sintéticos e eventos idempotentes.
- [ ] Teste retificação oficial, anulação, falta de dados, falha de API, consentimento e rollback.
- [ ] Acessibilidade, mobile, performance, monitoração de custos de IA.
- [ ] Aprovar checklist de segurança e pedagogia; criar versão publicada com runbook.
**Saída:** estrutura pronta para **piloto futuro** sem declarar validação com dados reais.

### E9 — Confronto institucional futuro
- [ ] Receber autorização e relatórios verdadeiros da instituição.
- [ ] Confrontar Conceito Enade/ENAMED, indicadores, dados curriculares e simulados, conforme comparabilidade.
- [ ] Gerar relatório de discrepâncias e hipóteses, nunca resultados inventados.
- [ ] Aprovar ajustes globais após evidência multicaso; ajustes locais ficam na IES.
**Saída:** laudo de aderência por instituição, com tratamento individual e isolamento.

## Responsabilidades funcionais (papéis, sem presumir pessoas)
- **Coordenação do projeto:** aprova escopo, prioridades, aceite de fase.
- **Especialista regulatório INEP/MEC:** verifica vigência e equivalência normativa.
- **Curadoria médica:** homologa sentido clínico e classificação de questão.
- **Engenharia de dados:** fonte, hashes, staging, conciliação e governança.
- **Engenharia F&O:** itens, gabaritos, respostas, compatibilidade e API.
- **Engenharia Vértice:** ambiente ENAMED, cursos, currículo, 5W2H, RBAC/RLS.
- **Sapiens/IA:** análises duais, recibos, explicabilidade, custos e bloqueios.
- **Qualidade e privacidade:** regressão, controles, dados sensíveis, logs.

## Prioridades e riscos
**P0:** inconsistência dos 483 status de gabarito, ausência de hash e competências, duplicatas; corpus oficial não reconciliado; possível vazamento/escopo multi-IES.  
**P1:** falta de matriz de competências e curva de aprendizagem; integração e prompt jurídico fixo; regras de cálculo e edição.  
**P2:** comparativos institucionais, relatórios e expansão para outros cursos.

## Formulário de passagem (preencher no diário ao encerrar cada etapa)
```text
ETAPA:
VERSÃO DE ENTRADA DA BÍBLIA:
ARTEFATOS HERDADOS:
ARTEFATOS CRIADOS/ALTERADOS:
EVIDÊNCIA (link, hash, captura, teste):
DECISÕES E ADR:
REGRESSÕES EXECUTADAS:
BLOQUEIOS/LIMITAÇÕES:
STATUS DE HOMOLOGAÇÃO:
VERSÃO DE SAÍDA:
RECOMENDAÇÃO PARA A ETAPA SEGUINTE:
```


## Status cumulativo da E1 — atualização em 16/11/2026
**Estado de saída:** `EM IMPLEMENTAÇÃO (PARCIAL)`; não superar critérios de aceite de E1. E2 continua bloqueada como etapa dependente.

### Executado
- [x] Releitura de Bíblia, Plano e Diário da E0.
- [x] Catálogo inicial de atos 2025/2026, resultados, provas e microdados, com estado de evidência por fonte — `INEP_CATALOGO_FONTES_E1.md`.
- [x] Conferência textual da NT40/2025 e regras PCP, SC e filtro de participantes por edição.
- [x] Conferência textual da Portaria 478/2025 e correção da numeração das competências VI e VII frente ao resumo anterior.
- [x] Matriz de rastreabilidade regra → implementação → teste — `INEP_MATRIZ_REGRAS_E1.md`.
- [x] 11 testes sintéticos locais da conversão PCP→Conceito, passando; sem conexão com produção.

### Bloqueado / não executado
- [ ] Obter binários e SHA-256 e catalogar retificações de cada documento essencial.
- [ ] Confirmar vigência integral e classificação dos atos normativos, inclusive situação atual da MP 1.370/2026.
- [ ] Transcrever e revisar literalmente as 15 competências, 7 atributos, 6 contextos e 21 conteúdos da matriz.
- [ ] Ler integralmente NTs 19/2025, 1PL/2025 e 42/2025.
- [ ] Conferir provas/gabaritos e status de reaplicação 2026 em PDFs integrais.
- [ ] Rodar reconciliação de microdados 2025 e planilha pública com resultados oficiais.
- [ ] Homologação regulatória/pedagógica e aceite E1.

**Passagem E1→E2:** proibida até comprovar o conjunto documental e requisitos verificáveis; a PR #168 continua de rascunho e sem publicação validada.


## Atualização transversal E7 (sem encerrar E1) — 16/11/2026
- [x] Adicionar aba Fato & Ordem ao protótipo ENAMED da PR #168, preservando o ENADE 360°.
- [x] Consulta read-only dos indicadores institucionais na tabela já existente `vertice_learning_course_metrics`; exames segregados, escopo por IES/curso, estados vazios e privacidade por grupo.
- [x] Conferir colunas existentes e RLS habilitada no banco Vértice, em leitura; nenhuma migração executada.
- [x] Criar script estático de contrato e realizar 10 verificações estáticas do código.
- [ ] Executar script via Node no checkout do repositório e efetuar compilação TypeScript completa.
- [ ] Testar permissões efetivas por perfil, RLS e UI/mobile em ambiente de homologação.
- [ ] Confirmar que a ponte F&O alimenta dados de uma IES autorizada; no momento zero grupos desses três módulos foram encontrados na tabela de métricas.
- [ ] Integrar os relatórios oficiais somente após os gates E1/E4; não confundir simulados com conceito.
- [ ] Comprovar CI, merge, deploy, funcionalidade ponta a ponta e homologação.

**Regra:** este avanço é de código paralelo que não depende da classificação oficial para consulta de **dados internos**; não altera o estado de E1 nem autoriza passar para E2.


## Rodada de verificação adicional — 16/11/2026
- [x] Localizar logs GitHub Actions da PR #168, identificar build:static aprovado e TS2345 de trilhas no workflow completo.
- [x] Corrigir tipagem `Table` na branch sem DDL nem alteração de dados.
- [ ] Aguardar e inspecionar o novo workflow TypeScript completo do commit `bdf79937c581b4386d7484f0c79d5ffb573c6d11`. Não marcar como aprovado antes da conclusão.
- [ ] Executar testes de interface navegáveis (seleção do curso, abas, estados vazio/erro, acessibilidade, mobile) autenticados. Nenhuma sessão de browser com perfil foi realizada.
- [x] Inspecionar texto da política RLS da tabela de métricas, `can_read_institution` e `has_role`.
- [ ] Ensaiar acesso Master, Reitoria, Coordenação, docente vinculado/não vinculado e usuário de outra IES em sessões reais autorizadas; testar MFA e vazamento cruzado.
- [x] Comparar contagens somente-leitura nas origens F&O e no destino da Vértice: 12/11/9 tentativas, 3.235 vínculos F&O, **0 métricas Vértice**.
- [ ] Validar conciliação legítima de matrículas, consentimento, mapeamento por competência e sincronização de eventos ponta a ponta com perfil autorizado e dados sintéticos; **não copiar produção** por conta própria.
- [x] Localizar portal Render ativo e verificar que faz deploy somente da `main`; PR não publicada.
- [x] Inspecionar PDF oficial NT40/2025 e identificação SEI da página 1.
- [ ] Obter arquivos íntegros das demais NTs, matrizes, bases, gabaritos e hashes; não encerrar E1.

**Bloqueios de saída:** PR não homologada/publicada, testes de perfis e UI ausentes, métricas de destino inexistentes, fontes INEP não autenticadas integralmente.

## E1 e preparação não dependente de E2/E3 — rodada 16/11/2026
- [x] Consultar artigos 3º a 8º da Portaria 478/2025 e criar versão preliminar do dicionário (7 áreas, 15 competências, 6 contextos, 21 conteúdos) sem aplicação no banco.
- [x] Catalogar 483 registros do F&O via SQL somente leitura, cada ID e flags de auditoria, 200 posições de prova duplicadas.
- [x] Criar fila de curadoria `FILA_REVISAO_483_ENAMED_2026.csv` com 343 candidatos de área **não homologados** e 140 sem área sugerida.
- [x] Consolidar `AUDITORIA_CONCOMITANTE_483_20261116.md` e script de invariantes.
- [x] Executar 11 verificações de integridade sobre artefatos GitHub; 11 aprovações, sem alteração de produção.
- [ ] Rodar script Node pelo pipeline oficial e testar na interface/compilação.
- [ ] Completar autenticação de provas, gabaritos, arquivos, SHA-256 e vigência E1.
- [ ] Conferir 483/483 enunciados/comandos/alternativas/gabaritos, e homologar com dupla IA e revisão médica.
- [ ] Resolver duplicidades e correções com preservação de IDs, tentativas e histórico, após aceite técnico.

**Porta de qualidade:** E1 continua aberta; início formal da E2/E3 permanece dependente da homologação E1. Os arquivos desta rodada são preparação reversível e sem DDL/DML.


## Verificações E1 e QA da PR #168 — rodada adicional em 16/11/2026
- [x] Inspecionar publicação/reprodução da Portaria 478/2025 e página oficial de notas técnicas, com limitações de arquivo e versão registradas.
- [x] Comparar grupos duplicados no F&O sem escritas: 283 posições, 200 duplicadas, 57 diferenças de enunciado, 2 de alternativas, 6 de tema, 191 de subtema, 192 de keywords, zero de gabarito entre cópias.
- [x] Registrar divergências em `E1_CONFRONTO_DOCUMENTAL_483_20261116.md` e criar plano de correção preservando tentativas.
- [x] Identificar o teste de navegação institucional da PR que falhou na rodada anterior e ajustar duas abas faltantes no macro acadêmico.
- [x] Criar workflow CI dedicado ao ENAMED; **6 testes Node aprovados**, run `43994963032`.
- [ ] Aprovação de TypeScript completo e testes de interface após alteração da navegação; verificar execução mais recente e logs.
- [ ] Teste visual/autenticado da interface por perfil e largura de tela.
- [ ] Baixar/hashear prova, gabaritos, todas as notas e atos essenciais; autenticar vigência e versões; E1 continua sem aceite.
- [ ] Executar confronto semântico 483/483 por caderno, comando, alternativa, gabarito e matriz; curadoria clínica dupla.
**Porta:** preparação em branch permitida; E2/E3 dependem do corpus E1 autenticado. Não efetuar merge nem deploy enquanto gates de produção estiverem abertos.


## E1 e QA — rodada de autenticação e perfis (16/11/2026)
- [x] Inspecionar Edital 71/2026 republicado e registrar itens 1.1.1–1.1.2, 1.3, 3.1.1.1, 3.1.1.2.1.
- [x] Catalogar três URLs de cadernos declaradas pelo F&O, **ainda não autenticadas**.
- [x] Enumerar 200 posições duplicadas com flags por campo no CSV restrito a metadados.
- [x] Implementar verificador offline de hash/assinatura básica PDF com falha fechada e 4 testes sintéticos.
- [x] Adicionar testes de renderização estática/visibilidade por perfil; manter permissões intactas.
- [x] Atualizar workflow ENAMED para invocar testes Node e Python.
- [ ] Comprovar aprovação do último CI com novos testes, TypeScript, renderização e build.
- [ ] Executar testes reais autenticados por Master, Reitoria, CPA, coordenador, NDE e docente com autorização; conferir RLS por curso/IES.
- [ ] Baixar PDFs/gabaritos diretamente de URLs primárias e comparar SHA-256, edição, comandos e alternativas.
- [ ] Conferir notas técnicas e todo o acervo E1; completar parecer regulatório.
- [ ] Enviar 483 propostas à dupla-IA e revisão clínica apenas depois de documentação verificável; **sem escrita na produção**.
**Aceite E1 não alcançado.**


## Atualização da E1 e testes automáticos — 16/11/2026
- [x] Confirmar no GitHub Actions run `43997164508` 6/6 contratos Node e 4/4 testes sintéticos Python do verificador local.
- [x] Manter fila de 200 posições duplicadas com divergências de campos e sem alterações de registro.
- [x] Criar Issue #170 de revisão clínica/editorial com critérios e bloqueio por fonte oficial.
- [x] Ler edital republicado 71/2026 (texto) e registrar marco normativo 03/07/2026 e gabarito final previsto 04/12/2026.
- [ ] Confirmar resultado final do workflow TypeScript completo `43997164461` com os quatro testes SSR/visibilidade incluídos.
- [ ] Executar testes reais de interface em browser autenticado, incluindo perfil coordenador/NDE e isolamento RLS por curso; sem ampliar permissão com base apenas no menu.
- [ ] Recuperar e autenticar PDFs/gabaritos originais com hash, provedor e versão; depois conferir 483 registros por caderno/questão.
- [ ] Obter pareceres independentes das duas IAs e validação médica, sem aplicar mudanças ao F&O nesta etapa.

**Porta E1:** continua fechada. O sucesso dos testes de contrato não libera cálculo TRI oficial, conceito institucional ou correção automática.


## Passagem E1 — conferência da cobertura e dos perfis (16/11/2026)
- [x] Reconferir páginas oficiais INEP de provas/gabaritos e notas técnicas; documentar indisponibilidade de binários.
- [x] Confrontar listagem de **regular C1/C2 e reaplicação C1/C2** com as três fontes declaradas no F&O.
- [x] Documentar lacuna candidata do **Caderno 2 da reaplicação 2026** e revisão separada do ENAMED 2025.
- [x] Conferir matriz de navegação no código para Master, Reitoria, CPA, Coordenação e NDE; testes SSR existentes, sem login real.
- [ ] Autenticar binários oficiais com hash e validar cada versão documental.
- [ ] Executar TypeScript/CI e testes de interface/RLS **na revisão mais recente**, sem inferir que sucesso de commit anterior homologa o HEAD.
- [ ] Verificar se cadernos da reaplicação e 2025 estão em outras fontes F&O antes de registrar ausência definitiva.
- [ ] Encerrar o aceite E1 somente após revisão normativa, testes e documentos íntegros.
**E1 não concluída; E2/E3 só preparação, sem atualização dos itens.**


## E1/QA — execução de recuperação pública e testes (16/11/2026)
- [x] Reconferir no GitHub os 8 workflows aprovados do commit `ae19a8847c9ea4b0fe2935634be24ac7d34523e9`, inclusive TypeScript, 415 testes de suíte principal e build.
- [x] Corrigir inclusão dos 4 testes SSR/visibilidade ENAMED na configuração principal do Vitest.
- [x] Conferir RLS de `vertice_learning_course_metrics` e a exigência de MFA `aal2`; perfis ainda não testados com login.
- [x] Criar coleta estática com evidência por GitHub Actions: HTML público recuperado, 0 PDFs expostos em run `43999397676`; segunda rodada confirmou 0 links.
- [x] Criar tentativa browser/JavaScript em workflow isolado e corrigir runner para Ubuntu 24.04 após incompatibilidade Ubuntu 26.04.
- [x] Catalogar cobertura da reaplicação C1 e ausência de C2 **nessa tabela**, sem generalizar ausência global.
- [ ] Obter e autenticar PDFs originais INEP, hashes, gabaritos e retificações.
- [ ] Confirmar resultado do navegador automatizado em uma execução não cancelada, com anexos e hashes se existirem.
- [ ] Confirmar 4 testes SSR adicionais no CI e validar autenticação RLS efetiva por Master, Reitoria, CPA, Coordenação/NDE e outra IES.
- [ ] Confrontar as 483 questões com provas e gabaritos oficiais, concluir revisão médica antes de atualizar F&O/Sapiens.
**E1 não aceita; não avançar a etapas dependentes.**


## E1 — Recuperação com JavaScript e validação TLS (16/11/2026)
- [x] Resolver descoberta de URLs oficiais pelo navegador Playwright em CI, **11 links PDF confirmados diretamente na página do INEP**, manifestados em JSON com proveniência e estado separado.
- [x] Reconhecer Caderno 2 da reaplicação e seus gabaritos como documentos oficialmente listados, sem inferir a existência deles no banco F&O.
- [x] Implementar e executar segunda rota `curl` com TLS ativo: 8 tentativas, 0 arquivos; erros de certificado e reset documentados.
- [x] Atualizar catálogo E1, Bíblia, Plano e Diário preservando histórico e gates.
- [ ] Obter PDFs íntegros via canal com cadeia TLS válida ou transferência documental oficial autorizada; registrar SHA-256, tamanho, versão e gabarito.
- [ ] Confrontar 483 registros e 200 pares duplicados com as provas originais, antes de liberar duas IAs e curadoria médica.
- [ ] Confirmar CI completo do HEAD incluindo testes SSR ENAMED e executar sessões autenticadas reais para cada perfil/IES.
**Aceite:** E1 bloqueada por transferência/autenticação de binários; não confundir URL publicada com prova autenticada.


## QA consolidado após a rodada v2.0 — 16/11/2026
- [x] Confirmar TypeScript completo no GitHub Actions run `44000644637`, com Node 22 e 24 aprovados.
- [x] Executar os quatro testes SSR de ENAMED incorporados à suíte principal, **419/419 testes aprovados** em 52 arquivos, mais suítes complementares.
- [x] Confirmar build estático na mesma revisão e CI de contratos ENAMED aprovado.
- [ ] Testar interface em navegador autenticado e responsivo com perfis reais e isolamento multi-IES/MFA/RLS; não houve sessão autenticada.
- [ ] Baixar todos os PDFs de fontes e gabaritos por TLS válido, verificar SHA-256 e revisão de documentos; oito transferências curl falharam.
- [ ] Homologar 483 questões por fonte e gabarito antes de qualquer reindexação e diagnóstico Sapiens.
**Status:** código passou pela regressão automatizada; E1 ainda sem aceite e PR #168 ainda não pronta para merge/deploy.


## Passagem com autenticidade de binários e reconciliação preliminar — 17/11/2026
- [x] Diagnosticar cadeia TLS incompleta no endpoint download.inep.gov.br e recuperar intermediária validada pela raiz confiável, sem desabilitar TLS.
- [x] Baixar **8 documentos PDF oficiais 2026** (regular C1/C2, reaplicação C1/C2, quatro gabaritos preliminares), conferir 8 SHA-256 com os bytes do artefato Actions `14299257407`.
- [x] Persistir manifesto de hashes `INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json` e documento de confronto `E1_CONFRONTO_GABARITOS_PRELIMINARES_483_20261117.md`.
- [x] Extrair **100 chaves preliminares por caderno** e confrontar `fo_enamed_items` em leitura: 483 concordantes, 0 divergentes.
- [x] Listar **17 números de reaplicação C1** sem representação em `fo_enamed_items` e confirmar zero posições da reaplicação C2 nessa tabela.
- [x] Identificar q19 e q28 da aplicação regular C1 como duas divergências de alternativas por espaçamento/pontuação entre cópias, sem efetuar UPDATE.
- [x] Verificar CI do commit `ccda5e4...`: contrato, recuperação de documentos e TypeScript completos com `success`.
- [ ] Confrontar os **483 enunciados, comandos, alternativas e mídias**, incluindo diferenças não triviais; não atribuir equivalência textual apenas por acerto do gabarito.
- [ ] Recuperar e autenticar edição **definitiva** dos quatro gabaritos e retificações assim que publicada, incluindo anulações; diferenciar versionamento por data.
- [ ] Concluir leitura das demais notas técnicas e regras metodológicas e obter aprovação regulatória.
- [ ] Executar testes navegáveis/autenticados de Master, Reitoria, CPA, Coordenação, NDE e outra IES com MFA/RLS; testar privacidade por curso/IES.
- [ ] Homologar ponte e diagnóstico Sapiens apenas com dados sintéticos, curadoria médica e dual-IA após gates documentais.
**Status:** E1 ainda sem aceite integral, apesar de comprovação positiva de oito binários e 483 gabaritos preliminares. PR #168 permanece draft; preservar produção.


## E1 — triagem textual por item e cadernos equivalentes, 17/11/2026
- [x] Extrair os quatro cadernos PDF por PyMuPDF e localizar as **400 posições oficiais** nas páginas físicas, sem inferir mídias.
- [x] Reconhecer e registrar as duas permutações C2→C1 (regular e reaplicação), 100/100 correspondências em cada caso por abertura de enunciado e gabarito preliminar.
- [x] Triar via SQL somente leitura 483 registros F&O contra os **24 primeiros caracteres normalizados** da abertura correspondente: 483 compatíveis, 0 divergências de prefixo. **Não tratar como conferência integral.**
- [x] Mapear 17 posições C1 de reaplicação não presentes na tabela para seus números equivalentes no C2.
- [x] Corrigir a hipótese anterior de '117 questões inéditas ausentes': são 17 conteúdos candidatos e 100 referências de outra ordenação do mesmo caderno.
- [x] Criar `ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json`, `ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json`, `ENAMED_2026_REAPLICACAO_17_POSICOES_EQUIVALENTES.json`, `E1_AUDITORIA_TEXTUAL_483_E_MAPA_CADERNOS_20261117.md`.
- [x] Criar contrato de teste para mapas e localizadores e adicioná-lo ao workflow `verify-enamed-contracts.yml`.
- [ ] Confirmar execução verde do workflow após o último commit que altera os novos contratos.
- [ ] Confrontar 483/483 **enunciados completos, comandos e alternativas**, especialmente 57 versões divergentes; revisar imagens/tabelas manualmente.
- [ ] Homologar aliases sob curadoria médica, mantendo histórico; preparar correções como propostas, sem SQL de produção.
- [ ] Conferir gabaritos DEFINITIVOS e notas técnicas para fechar E1, após publicação, e sessões reais de Master/Reitoria/CPA/Coordenação/NDE com MFA e isolamento.
**Porta E1: ainda sem aceite.**


### Priorização da curadoria após normalização de duplicatas (17/11/2026)
- [x] Apurar por SQL de leitura 57 divergências brutas de enunciado, 31 após remoção de whitespace, 22 alfanuméricas persistentes.
- [x] Catalogar as 22 posições do Caderno 2 regular por ID e correspondente Caderno 1, sem avaliar automaticamente efeito clínico.
- [x] Constatar que as 2 diferenças brutas de alternativas desaparecem após normalização de whitespace.
- [ ] Conferir 22 divergências persistentes com PDF e alternativas, classificando como mudança material, ortográfica ou de extração por revisor competente.
- [ ] Conferir demais 35 divergências brutas, mídias e perguntas não incluídas na triagem curta, com revisão humana.
- [ ] Confirmar todos os gates E1 e a homologação por perfil antes de publicação.


- [x] Preparar `ENAMED_2026_ROTEIRO_HOMOLOGACAO_PERFIS.md` com 16 casos e massa sintética multi-IES; nenhuma sessão real foi executada.
- [ ] Executar os 16 casos em ambiente autenticado de homologação e registrar respostas positivas/negativas RLS, MFA e evidências de tela; publicação permanece bloqueada.


## E1 e curadoria preparatória — triagem de 22 variantes e mídias (17/11/2026)
- [x] Confrontar primeiras regiões divergentes de 22 pares Caderno 2 com o PDF oficial e classificar necessidades de revisão, sem decisão clínica automática.
- [x] Gerar `ENAMED_2026_TRIAGEM_22_VARIANTES_TEXTUAIS_C2.json` com identificadores, página PDF, C1 equivalente e bloqueio de publicação.
- [x] Identificar Q12 (Lund–Browder), Q81 (imagem dermatológica), Q82 (radiografia) como dependentes de imagem, a conferir antes de uso.
- [x] Inspecionar tabela F&O: `blocks` vazio 483/483, `source_hash` nulo 483/483, `competencies` vazio 483/483 e `source_page` ausente em 223/483.
- [x] Criar `E1_AUDITORIA_22_VARIANTES_E_MIDIAS_20261117.md` e teste Node de rastreabilidade no CI.
- [ ] Confirmar resultado CI da última revisão com o teste novo de 22 variantes.
- [ ] Cotejar integralmente comando/alternativas/tabelas/valores/imagens das 22 variações persistentes e demais itens, e atribuir parecer de especialista por item.
- [ ] Inspecionar outras possíveis fontes de mídia em armazenamento, sem concluir ausência global só pelo `blocks=[]`.
- [ ] Preparar homologação autenticada dos 16 cenários com massa sintética, AAL2 e duas IES, sem modificar o ambiente produtivo.
- [ ] Recuperar gabaritos definitivos e notas metodológicas, revisar retificações, e finalizar E1 antes da reindexação no F&O.
**Status:** triagem documental ampliada; nenhum aceite clínico, E1 ainda aberta.


## Rodada de três ações — textos completos entre cópias, imagens e testes (17/11/2026)
- [x] Consultar apenas em leitura 22 pares de `stem` e `alternatives` completos do F&O; registrar diferenças por ID e página.
- [x] Identificar **8/22 pares** com diferenças de tokens numéricos (12,42,44,49,74,89,90,99) que exigem conferência de valores/unidades com a prova.
- [x] Extrair metadados de **6 imagens rasterizadas** das páginas do PDF Caderno 2 regular (12,68,81,82,89,97): `xref`, bbox, bytes, SHA-256 e associação geométrica por questão.
- [x] Criar `E1_22_VARIANTES_COMPARACAO_INTEGRAL_ENTRE_COPIAS.json`, `E1_ENAMED_22_MIDIAS_PDF_HASH_E_PAGINA.json`, `E1_TRES_ACOES_TEXTOS_MIDIAS_CONTRATOS_20261117.md`.
- [x] Criar `scripts/tests/enamed-e1-content-media-contract.test.mjs` e integrá-lo à CI da PR.
- [ ] Conferir resultado CI do último HEAD que inclui os novos arquivos, sem contar execuções canceladas.
- [ ] Cotejar integralmente cada versão com o PDF oficial (não só F&O vs F&O), incluindo todas as alternativas, números, unidades, figuras e tabelas.
- [ ] Validar recorte e direito de uso de cada uma das seis imagens antes de qualquer vínculo ao portal.
- [ ] Recuperar gabaritos definitivos e retificações, homologar notas técnicas e matrizes, somente então iniciar curadoria clínica formal e dupla IA.
- [ ] Executar os 16 cenários em ambiente autenticado de homologação com massa sintética, MFA/RLS, escopos curso e duas instituições.
**Gate:** E1 ainda aberta; sem atualização de produção ou publicação da PR.


## Fechamento da auditoria técnica preliminar — 17/11/2026
- [x] Entregar termo final `TERMO_ENCERRAMENTO_AUDITORIA_PRELIMINAR_20261117.md`, distinguindo evidência conclusiva e gates externos.
- [x] Validar em `SELECT` oito diferenças numéricas com marcadores encontrados no PDF oficial, gerando `ENCERRAMENTO_8_DIVERGENCIAS_NUMERICAS_VERIFICADAS_20261117.json`.
- [x] Encerrar as verificações repetitivas de hashes, gabaritos preliminares, permutações de cadernos e diferenças numéricas já evidenciadas.
- [ ] Aceite E1: versões DEFINITIVAS/retificações, notas metodológicas, texto integral/mídias e curadoria profissional.
- [ ] Homologação autenticação: 16 cenários reais de MFA/RLS/isolamento IES e ponte sintética.
- [ ] Homologação final, merge/deploy somente após os dois aceites. **Não considerar produto concluído.**


## Fechamento desta solicitação — 17/11/2026
- [x] Confirmar os **9 workflows verdes** da revisão técnica de referência `a34dfcf814cf4680f768213fd6db8f7edfb8a46c`.
- [x] Confirmar ausência de sessões reais autenticadas nesta conversa e ausência de métricas institucionais publicadas no destino.
- [x] Formalizar `ENAMED_360_REGISTRO_GATES_PUBLICACAO.json`, seis gates `approved=false`, sem confundir auditoria encerrada com homologação regulatória ou release.
- [x] Adicionar teste de integridade dos gates ao CI da PR.
- [ ] Obter gabaritos definitivos/retificações e parecer documental-médico.
- [ ] Executar os 16 testes reais por perfil em homologação isolada e demonstrar ponte sintética F&O→Vértice→Sapiens.
- [ ] Aprovar explicitamente o release, revisar PR, fundir/publicar e validar operação publicada somente após os gates.
**Regra:** sem mais reabertura artificial da auditoria; estado atual terminal da solicitação = BLOQUEADO COM EVIDÊNCIA. Produção intacta.


## Execução cumulativa v2.8
- **CONCLUÍDA:** confronto automatizado de 483 IDs × cinco campos; 414 equivalentes em tokens extraídos, 69 diferenças; 22 variantes e 17 posições da reaplicação com relatórios completos. Sem parecer clínico.
- **CONCLUÍDA:** 30 ocorrências de imagens inventariadas; vínculos preparados, seis hashes herdados preservados; sem upload nem liberação de direitos.
- **CONCLUÍDA:** cinco PDFs normativos adicionais recuperados e hashados no Actions 44054849030; revisão por edição em PARECER_DOCUMENTAL_EXECUCAO_20261117.md.
- **CONCLUÍDA:** atualização da branch com main, conflito/menu duplicado corrigidos, prompt por curso, teste sintético ENAMED na ponte, proteção de médias/deltas com amostra insuficiente. Oito cenários nativos e regressões aprovados; evidência em REGISTRO_EVIDENCIAS_EXECUCAO_20261117.json.
- **CONCLUÍDA:** dez workflows success no código 92b5f649d805df3f4ab1ecfaa6313777089a77c6, incluindo TS22/24 e contratos. Não é deploy.
- **BLOQUEADA:** 16 cenários autenticados por ausência de ambiente isolado e contas por perfil/MFA; browser disponível, chegou à tela /entrar. Matriz individual atualizada.
- **BLOQUEADA:** dual-IA real sem sessão Master AAL2; curador médico e aceite por item ausentes; mídia não pode ser homologada pelo comando textual.
- **BLOQUEADA:** definitivos previstos em 04/12/2026, retificações e aceites; migração/reindexação/merge/deploy NÃO EXECUTADOS.
- Histórico preservado; nenhuma operação em dados produtivos. Bíblia v2.8.


## 17/11/2026 — frente de incorporações ENAMED, Bíblia v2.9
- **CONCLUÍDA:** branch `feat/enamed-incorporacoes-20261117` baseada na PR168, sem novo serviço/banco/login.
- **CONCLUÍDA NO CÓDIGO:** acervo e incorporações com 69 diferenças filtráveis, 17 candidatas com páginas e correspondência C2 e documentação verificada; correção dos avisos obsoletos de recuperação documental.
- **CONCLUÍDA LOCALMENTE:** TypeScript, 423 testes (quatro novos DOM), build e contratos ENAMED. Resumo de interface conferido contra fontes versionadas por comando --check.
- **NÃO EXECUTADA:** importação, alteração de gabaritos, classificação clínica, aprovação médica/dual-IA, merge e deploy. Nenhuma operação produtiva. CI remoto e link da PR registrados no GitHub da nova frente.
- Permanecem os seis gates não aprovados e as dependências de sessão real, médico e fontes definitivas.

### Correção do CI desta frente
O workflow BI acadêmico falhou ao carregar os quatro testes DOM por ausência de jsdom, enquanto o workflow completo do portal passou em Node22/24. Corrigido o preparo do runtime de testes nos workflows BI acadêmico e mobile com o lockfile já existente em scripts/tests/types-runtime e o mesmo vínculo de jsdom usado no workflow do portal. Nenhuma dependência produtiva adicionada e nenhum teste desabilitado. Ver reexecução e evidências da PR172.


## 17/11/2026 — execução real de acesso e preparação isolada, v2.10
1. **CONCLUÍDA:** navegador Work abriu /entrar; solicitação segura não produziu autenticação confirmada. Em nova aba, /master mostrou “Entre para acessar sua conta.” É teste negativo anônimo do portal publicado, não aceite dos 16 cenários autenticados. Git merge-tree confirmou main ancestral e árvore sem conflito; GitHub ainda indicou dirty. Nenhum merge forçado.
2. **CONCLUÍDA PARCIALMENTE:** branch Supabase `enamed360-homologacao-20261117`, ref `rnmkmnrfhvjihsuqziwf`, criada com `with_data=false`. Aplicadas bases originais do repositório; corrigidos metadados legados estritamente conforme o preflight original, preservando suas guardas. Replay avançou a 66 migrações/70 tabelas públicas, sem usuários, IES ou cursos. **REPROVADA:** restauração integral parou na FK de parâmetros de custo vinculados a IES ausente. Não criada instituição fictícia com ID produtivo nem removida FK; ambiente completo ainda não está pronto.
3. **CONCLUÍDA NO CÓDIGO:** destino Supabase por configuração de build; homologação recusa destino produtivo, chave privilegiada ou configuração incompleta. Experiência, demonstração, branding e biblioteca usam o mesmo destino. Pós-build da homologação mantém CSP restritiva, troca somente a origem Supabase e bloqueia o F&O produtivo; 72 HTMLs conferidos e noindex. TypeScript, 427 testes e builds padrão/isolado passaram. Não comprova sessões, chamadas dual-IA ou integração remota.
**Evidência:** `evidencias/20261117_WORK_HOMOLOGACAO.json`. PR172 já integrada somente na branch de desenvolvimento por `782257d116b5db0fe2fd8bb4e42c106f8a7b8fcf`; PR168 continua draft. Dados/serviços produtivos preservados. Seis gates continuam não aprovados; definitivos, parecer médico e contas reais permanecem indispensáveis.


### Resultado efetivo da preparação de homologação — 17/11/2026
- **CONCLUÍDA:** código de isolamento em `36842091e00aed8eced8e2f056bf0b902c054aad`; CI de branch em `dcd8a1ebab5636c88c6cba07b57fcd4be4d36813`, Actions [44116468460](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44116468460) success. TypeScript, 427 testes principais e builds padrão/isolado aprovados. O push agora também valida a branch quando o GitHub informa dirty na PR; nenhuma tentativa de forçar merge.
- **CONCLUÍDA:** frontend de homologação publicado no Render, serviço `srv-dbu771mc6qcc73fbog0g`, deploy `dep-dbu771uc6qcc73fbogf0`, commit `3684209`, auto-deploy desligado. Navegador verificou [login isolado](https://vertice-enamed-homologacao.onrender.com/entrar) e CSP com destino Supabase `rnmkmnrfhvjihsuqziwf`; F&O produtivo não está na política de conexão. Não é release em produção nem homologação dos perfis.
- **CONCLUÍDA PARCIALMENTE:** estrutura isolada avançou a **85 registros de migração e 103 tabelas públicas/103 com RLS**, sem usuários Auth, IES, cursos ou objetos Storage. Réplica completa NÃO comprovada. A carga de custo destinada a uma IES real foi omitida apenas na variante de homologação; histórico da branch registra SQL realmente aplicado, preservando o original produtivo. Estruturas e-ORBIT copiadas somente como DDL, sem linhas ou estados de sequência produtivos. Preservados FKs e controles. A branch Supabase de preparação **não deve ser integrada em produção**.
- **BLOQUEADA:** migração de lockdown da restauração exigiu confirmação do Supabase; a solicitação expirou sem aplicação. SQL concreto revisável em `evidencias/20261117_HOMOLOGACAO_LOCKDOWN_PENDENTE.sql`, com preflight exclusivo da base isolada vazia. Não usado execute_sql para contornar a confirmação. Estado da restauração ainda MIGRATIONS_FAILED; zero contas de teste. Não solicitar credenciais pessoais para um banco de teste vazio.
- **NÃO EXECUTADOS:** 16 cenários autenticados, chamadas dual-IA, parecer médico, reindexação, integração remota ponta a ponta e release produtivo. Advisors registram 81 INFO de RLS sem policy e 49 WARN de funções definer executáveis; não foram rotulados como aprovação de segurança. Ver evidência JSON com links de remediação.
- **PRODUÇÃO:** sem alteração de questões, tentativas, gabaritos, históricos ou migrações no banco produtivo. PR168 draft; sem merge em main ou deploy produtivo. Seis gates não aprovados. Próxima providência externa: confirmação Supabase para a migração isolada e contas de teste com MFA/AAL2; parecer médico e definitivos continuam pendentes para o release.


## 17/11/2026 — execução da confirmação Supabase e restauração cumulativa, v2.11
1. **CONCLUÍDA:** confirmação recebida e migração `enamed_staging_lockdown_with_private_empty_map` aplicada somente em `rnmkmnrfhvjihsuqziwf` (versão 20261117162115). SHA-256 do SQL autorizado: `9ba6466ba1f61e5ef5e365d8ae770b6683050ef779c3cf58161fcb7bfc56d19d`. A pendência anterior de confirmação desse lockdown está resolvida. Preflight e guardas originais preservados; não foi usado SQL alternativo para contornar confirmação.
2. **CONCLUÍDA PARCIALMENTE:** recuperadas definições históricas ausentes da criação do ambiente vazio. Fontes: migrações originais do repositório e metadados PostgreSQL somente leitura da produção, sem linhas de alunos, contratos, consentimentos ou resultados. Participantes/livro-razão de Extensão têm estrutura vazia e trigger de imutabilidade; restauração avançou por TCC, AC e Estágio. Cinco operações históricas destinadas a contas/vínculos reais foram omitidas exclusivamente na homologação vazia, com SQL efetivamente executado registrado no histórico. Não reproduzidas credenciais, sessões ou IDs de pessoas reais. A branch de banco de homologação não pode ser integrada à produção. Definições e hashes no arquivo de evidência, sem confundir variante com reprodução exata do original.
3. **CONCLUÍDA:** recibos e evolução documentados cumulativamente. **NÃO EXECUTADOS:** os 16 cenários autenticados, dual-IA real, parecer médico, reindexação e integração remota ponta a ponta. Zero contas Auth de teste na última consulta; permissões de catálogo/ACL não equivalem a sessão real. Os seis gates permanecem sem aceite. Produção e PR168 preservadas, sem merge em main ou deploy produtivo.
**Evidências:** `evidencias/20261117_LOCKDOWN_APLICADO_APOS_CONFIRMACAO.json` e `evidencias/20261117_RESTAURACAO_DEFINICOES_APLICADAS.json`. O estado terminal da restauração deve ser lido no snapshot final anexado, não inferido da aplicação de uma migração intermediária.


### Resultado verificado da restauração — 17/11/2026, v2.11
- **CONCLUÍDA:** restauração do esquema isolado até `20261117175935`: 213 versões/nomes do projeto de origem representados, nenhuma versão ausente na comparação, 250 registros totais na branch. Inclui variantes explícitas de homologação; não significa igualdade integral dos SQLs nem homologação. Há 325 tabelas públicas, todas com RLS. Contagens verificadas: zero usuários Auth, instituições, cursos, estudantes, métricas de aprendizagem e objetos Storage.
- **CONCLUÍDA:** 24 definições adicionais arquivadas com SHA-256; cron externo de coleta desativado exclusivamente na homologação, cron interno de segurança e event trigger preservados. As variantes de identidade e carga específica de IES não importaram pessoas nem contas produtivas. Recuperação adicional de Conecta feita com migração original do repositório, sem dados.
- **CONCLUÍDA:** `vertice-sapiens-bridge` v4 e `vertice-learning-bridge` v26 publicadas manualmente somente na base isolada, `verify_jwt=true`. Leitura de retorno confirmou igualdade exata dos arquivos. Origem do preview aceita apenas pelo projeto isolado; destino F&O produtivo bloqueado no servidor isolado. Quatro verificações de origem/destino e oito ciclos nativos sintéticos passaram; 15 contratos ENAMED também passaram. Esses testes locais não equivalem a chamada remota autenticada nem sessão real por perfil.
- **REPROVADA:** etapa automática geral de funções do provedor terminou `FUNCTIONS_FAILED`; o painel confirmou HTTP 413 (`request entity too large`) na cópia automática de `vertice-doc-prevalidate`, pacote de 38,48 MB. Não declarar a pipeline completa aprovada. As duas funções necessárias acima têm recibos individuais `ACTIVE`; outras funções não foram invocadas. Advisors: 117 ocorrências INFO de RLS sem policy, 8 WARN de search_path, 1 extensão pública, 5 funções definer anônimas e 91 autenticadas. São achados para conferência de acesso, sem presunção de vulnerabilidade ou aprovação automática.
- **BLOQUEADA:** homologação real por perfil e E2E sem contas autorizadas de teste e MFA/AAL2; os 16 casos permanecem não executados. Parecer médico, dupla avaliação real e fontes definitivas permanecem requisitos separados. Seis gates não aprovados; PR168 draft; sem reindexação ou publicação produtiva.
**Evidência terminal:** `evidencias/20261117_RESTAURACAO_SNAPSHOT_FINAL.json`. A confirmação do lockdown deixou de ser um recurso externo pendente; não solicitá-la novamente.

**CI do código v2.11:** commit `0855054b170130572c1c7b3d309d146fcb9c942b`, [Actions 44149342910](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44149342910) concluído `success`: TypeScript completo, suíte existente e build em Node22/24; quatro novos testes de origem/destino em Node24. Permanecem seis gates sem aprovação e 16 casos reais não executados. Atualização documental posterior não é novo teste do código.


## 17/11/2026 — conciliação com main e recuperação exata de função, v2.12
1. **CONCLUÍDA NO CÓDIGO:** conciliação com main `8a40f880bb81e75c1d02f5f18bdff5bb3eb4ae41` na branch de desenvolvimento, preservando as duas linhas de histórico. Resolvidos quatro conflitos em ENADE/ENAMED, navegação acadêmica, fixture nativa e sanitização do feedback. Mantidos os avisos de homologação científica, Discursiva e controles de privacidade/origem/destino. Nenhum merge em main.
2. **CONCLUÍDA:** recuperadas via API as três fontes EXATAS da pré-validação v3 ativa na homologação. Republicação direta gerou v4 ACTIVE, JWT obrigatório, arquivos idênticos e mesmo hash de bundle `176d814865ac3d34abae9871628949ac8a534dc3bca1bd5e29ec157d451c20d9`. Assim, a falha 413 da cópia automática recebeu compensação manual verificada sem substituir o conteúdo. A pipeline automática histórica continua FUNCTIONS_FAILED; não foi marcada como sucesso. Sapiens isolado atualizado para v5 após conciliar a sanitização mais restritiva da main; Learning permanece v26. Produção preservada.
3. **CONCLUÍDA LOCALMENTE:** TypeScript recomposto, 15 contratos ENAMED e resumo editorial passaram. O runner nativo executou 23 testes sem falhas; oito são repetidos pelo import da fixture, correspondendo a 15 casos distintos incluindo origem/destino e privacidade. CI completo da árvore conciliada deve ser registrado após executar; CI 44149342910 comprova apenas o código anterior 0855054.
**PENDÊNCIAS REAIS:** contas de teste autorizadas por perfil e MFA/AAL2 no banco isolado (zero Auth), 16 cenários reais/E2E e dupla IA não executados, parecer médico/visual e gabaritos definitivos ainda sem aceite. Não há reindexação, alteração de gabaritos ou publicação produtiva. Seis gates não aprovados.
**Evidência:** `evidencias/20261117_CONCILIACAO_MAIN_E_FUNCOES.json`, com fontes originais da pré-validação e hashes para rastreabilidade; não contém credenciais.
