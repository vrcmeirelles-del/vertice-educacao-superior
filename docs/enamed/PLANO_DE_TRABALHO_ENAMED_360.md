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
