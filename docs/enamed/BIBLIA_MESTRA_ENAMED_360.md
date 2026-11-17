# BÍBLIA-MESTRA DO PROJETO — ENAMED 360° / INEP INTELLIGENCE
**Projeto:** Vértice Educação Superior × Fato & Ordem × Sapiens 360°  
**Versão:** 2.6 — encerramento da auditoria preliminar; aceites E1 e acesso autenticado pendentes  
**Data-base:** 16 de novembro de 2026  
**Status:** documento-mestre de projeto; NÃO corresponde à implantação ou homologação da solução.  
**Governança:** evolução cumulativa por etapas, com revisão retrospectiva obrigatória.  
**Issue de execução:** #167 | **PR inicial de interface:** #168 (rascunho).

> **Regra de ouro:** esta Bíblia é a fonte única de decisões, interfaces, critérios e histórico. Nenhuma etapa começa ignorando as entregas e pendências das anteriores. Não sobrescrever fatos, dados oficiais nem decisões sem registrar motivo, fonte, aprovador e impacto.

## 1. Missão e limites do projeto

Criar um sistema de inteligência contínua que reconcilie (a) os documentos normativos, provas, gabaritos, resultados agregados e microdados oficiais do Inep; (b) os bancos de questões e respostas do Fato & Ordem; (c) as matrizes curriculares, turmas, períodos, estágio/internato e planejamento institucional da Vértice; e (d) as interpretações e intervenções do Sapiens 360°.

**Fase presente:** construir, documentar, testar e homologar **arquitetura reutilizável e transinstitucional**, sem resultados reais de uma IES específica e sem simular resultados de alunos. **Fase futura:** validar pontualmente com dados reais enviados e autorizados por uma IES, em ambiente institucional segregado e com termo de origem, autorização e finalidade.

**Produto:** ENAMED 360° dentro da área já existente ENADE 360°, apoiado por INEP Intelligence compartilhado. Para Medicina, não contar ENADE e ENAMED como dois resultados oficiais independentes para a mesma edição. O ENADE histórico de Medicina é uma fonte pedagógica separada; ENAMED é a modalidade específica atual do ENADE, conforme norma vigente. Residência **Médica** é aprofundamento pedagógico complementar — não confundir com Residência Jurídica e não atribuir a essa trilha peso regulatório no Conceito Enade.

**Não objetivos agora:** produção de nota TRI oficial, certificação ou parecer do Inep, matrícula inventada, tratamento de dados identificáveis sem base legal, rankings punitivos, atualização automática não homologada de gabaritos, importação de dados reais de IES piloto sem autorização.

## 2. Hierarquia das fontes de verdade

1. **Normas e documentos oficiais vigentes do Inep/MEC** — portarias, editais, retificações, matriz, manual técnico, notas técnicas, gabaritos, microdados, dicionários e resultados. Cada informação recebe fonte, publicação, edição, versão, situação preliminar/definitiva, data de coleta e hash de arquivo.
2. **Registros oficiais da IES autorizada** — somente na fase de implantação por instituição; conciliar por código e-MEC/INEP de curso e IES, matrícula e período, sem presunção por nome.
3. **Dados do Fato & Ordem** — questões, tentativas, respostas, perfis e revisões; são observações pedagógicas e não equivalem automaticamente ao exame oficial.
4. **Inferências do Sapiens e das duas IAs** — diagnósticos e sugestões com evidências, nível de confiança e necessidade de aprovação humana.
5. **Ações institucionais** — planejamento estratégico, metas 5W2H, decisões do NDE e respectivos comprovantes.

**Invariantes:** sem fonte não há rótulo "oficial"; sem dados suficientes não há resultado estimado; sem homologação não há publicação; ausência de dado não é zero; "aprovado" na tabela não prova correspondência documental; arquivos públicos e restritos têm controles diferentes.

## 3. Inventário e documentos normativos (registro de verificação, não lista exaustiva)

### 3.1 Normas de partida
| Documento | Papel na arquitetura | Controle antes de implementação |
|---|---|---|
| Portaria MEC nº 330/2025 | Instituição/organização original do ENAMED | Conferir texto, alterações e vigência |
| Portaria Inep nº 413/2025 | Procedimentos operacionais | Identificar edição e retificações |
| Portaria Inep nº 478/2025 | Matriz de referência comum | Extrair códigos e hierarquia literalmente |
| Portaria nº 780/2025 e Nota Técnica nº 40/2025 | Conceito Enade Medicina | Implementar versão de cálculo aplicável a cada edição |
| MP nº 1.370/2026 | Marco legal de 2026 | Confirmar estado legislativo/vigência a cada edição |
| Editais ENAMED 2026 e de reaplicação, incluindo retificações | Inscrição, participação, cronograma, cadernos, regularidade | Conferir edições e datas antes de usar |
| Manual técnico do ENAMED | Prova, Angoff, Rasch/TRI, interpretação | Não confundir método de escala com acerto bruto |
| Normativos e matrizes ENADE por área | Histórico de Medicina e demais cursos | Não aplicar uma matriz médica a todos os cursos |
| Normativos ENARE/seleções de Residência Médica, por certame | Finalidade de treino e preparação | Não presumir equivalência psicométrica com ENAMED |

A lista acima é **fila de verificação documental**: checar no texto oficial todos os números, títulos, alterações e vigência, mantendo o registro das retificações. Não inferir que a lista seja completa.

### 3.2 Catálogo de fontes (endereços-base)
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/resultados
- https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enamed
- https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior/2025
- https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed

**Esquema de documento:** `document_id, issuer, title, kind, exam, edition, official_url, published_at, retrieved_at, valid_from, valid_until, replaces_id, status, hash_sha256, bytes, format, legal_scope, method_version, extraction_version, validation_status, validated_by, notes`. Manter versões antigas; retificação cria uma nova versão e invalida derivados sujeitos a revisão.

## 4. Matriz multidimensional — a "língua comum" dos três sistemas

Cada questão recebe:
- `exam_family`: `enade`, `enamed`, `residencia`;
- `exam_year/edition/booklet/question_number/answer_version` e identificador estável da fonte;
- `matrix_version` e `official_area_code`, com tabela de equivalência versionada;
- `official_competency_primary` e competências secundárias justificadas;
- `profile_attribute`, `care_context` (quando cabível) e `structuring_content_code`;
- `discipline/specialty`, `theme`, `subtheme`, `keywords` normalizadas, sinônimos e conceitos de negação/diferencial;
- `cognitive_operation` (identificar, interpretar, diagnosticar, selecionar exame, priorizar conduta, planejar, educar, avaliar evidência etc.);
- `evidence_locator`: URL, hash, página, trecho do comando, alternativas e resposta;
- `confidence`, `reviewer_status`, `review_receipt`, `editorial_version`, `curriculum_mapping_version`.

**Regras:** tema = problema ou saber central; subtema = decisão ou habilidade realmente solicitada; keyword = termo clínico discriminante para busca; exame/ano/curso não devem ser palavras-chave clínicas. Uma mesma questão pode associar competências transversais, mas só uma principal deve orientar a análise de desempenho por questão, salvo modelo que justifique contribuição fracionada. O mapeamento não pode ser decidido apenas por similaridade lexical.

**Referência matriz ENAMED:** codificar separadamente as cinco dimensões da matriz (perfil/atributos, competências, áreas, contextos, conteúdos) e a distinção entre 15 competências gerais e 12 avaliáveis na prova teórica, mediante transcrição e verificação literal da edição aplicável. Não inventar subcódigos não publicados.

**Áreas formais a catalogar:** Clínica Médica; Cirurgia Geral; Ginecologia e Obstetrícia; Pediatria; Medicina de Família e Comunidade; Saúde Mental; Saúde Coletiva. Urgência e Emergência funciona como contexto transversal nos termos da matriz, não como especialidade oficial adicionada.

**Compatibilidade:** históricos ENADE Medicina e provas de Residência Médica são mapeados à mesma *ontologia pedagógica transversal* quando há equivalência semântica; preservar os códigos oficiais próprios das diferentes avaliações. Não atribuir códigos ENAMED a outra prova como se ela tivesse sido originalmente classificada pelo Inep.

## 5. Cálculos: três camadas rigorosamente separadas

### 5.1 Exame individual oficial
A avaliação usa TRI/Rasch e procedimentos oficiais de escala, cortes e equalização. O modelo Rasch tem `P_i(theta)=1/(1+exp(-(theta-b_i)))`, porém isso não permite reproduzir a nota oficial sem os parâmetros, o procedimento de calibração/equalização e a documentação da edição. **Não fazer nota oficial = acertos/100.** Guardar nota individual apenas com autorização e documentação de sua origem. Para 2025, o ponto de referência de proficiência de 60 pontos na escala do Inep deve ser tratado como regra versionada, não como percentual bruto de acertos.

### 5.2 Resultado institucional oficial
Para a edição à qual se aplica a Nota Técnica nº 40/2025, `PCP = concluintes proficientes / concluintes válidos`, com elegibilidade, critérios de presença, população e mínimo amostral oficiais; as faixas de conversão 1–5 devem vir da nota técnica autenticada, sem extrapolar automaticamente para outras edições. Em insuficiência de alunos válidos: Sem Conceito, não zero. Reprocessar ao receber retificações. Conceito institucional é distinto de simulado e distinto de desempenho individual.

### 5.3 Desempenho interno e diagnóstico longitudinal
Guardar taxa de acerto, denominador, dificuldade/calibração interna, versão do item, período, tentativas, confiança da estimativa, efeito de repetição e origem. Não comparar bruscamente porcentagens de bancos de dificuldade diferente. O índice agregado por competência deve:
1. deduplicar questão-fonte e controlar reapresentações;
2. separar exame, turma e período;
3. ponderar pelo desempenho e qualidade/calibração disponíveis, sempre com incerteza;
4. mostrar resultados por origem antes de qualquer síntese;
5. recusar estimativas com amostra insuficiente;
6. registrar mudanças de matriz e exposição aos itens.

A eventual calibração psicométrica interna e benchmarking exigem revisão de especialista e amostra suficiente; não equivalem à TRI oficial.

## 6. Arquitetura compartilhada sem duplicações

**INEP Intelligence (Vértice):** registry de atos e relatórios oficiais → importador staging/auditoria → reconciliador IES/curso/edição → dados oficiais versionados e painéis. Não armazenar PDF duplicado sem necessidade; usar armazenamento com checksums e referências.

**Fato & Ordem:** origem única das questões (ENAMED, ENADE, Residência Médica), versões de enunciado/gabarito, tentativas, recibos editoriais, correlações curriculares. Nunca deduplicar por `question_number` isolado. Relação: `exam/edition/booklet/question_number/source_version` com aliases de IDs antigos e proteção de tentativas.

**Vértice ENADE 360° + ENAMED 360°:** reutilizar `Enade360`, `TrailAnalysis`, `EnadeCross`, `LearningConnected`, `formation_trails`, `trail_question_links`, `v_trail_diagnostic`, `vertice-learning-bridge`, `vertice_goals`, planos 5W2H e o cadastro de cursos já existentes. Compatibilizar currículo com matriz de competências, NDE, internato e planos pedagógicos. Não inventar cursos.

**Sapiens 360°:** receber somente dados autorizados e necessários; confrontar evidências com matrizes; propor hipóteses/diagnósticos, planos de intervenção e indicadores de acompanhamento. Revisão temática dual-IA existente é proposta sem escrita, sem aprovação automática; regras documentadas em `docs/sapiens/REVISAO_TEMATICA.md`.

**Segurança:** instituições segregadas por `institution_id` e curso, acesso por papel/MFA, RLS verificada, LGPD, observabilidade, logs sem dados sensíveis, idempotência de sincronização, reconciliação expressa de matrículas. No piloto futuro, credenciais e documentos restritos somente em canais autorizados, fora do repositório público.

**Interface:** clara, responsiva, contextual, compatível com design atual da Vértice, textos de ajuda por campo, etiquetas de proveniência ("oficial", "simulado", "inferido", "pendente"), linhas do tempo, estados vazios sem ficção.

## 7. Fatos confirmados em inspeções de 16/11/2026

- F&O Supabase `public.fo_enamed_items`: **483 registros** de 2026; 400 dos cadernos regulares (200 posições únicas por caderno/número repetidas em IDs distintos) e 83 da reaplicação.
- 483 com tema/subtema/keywords presentes; **483 com `competencies` como lista JSON vazia**; `taxonomy_area` = "Medicina" para os 483; 27 denominações distintas de `discipline`.
- 483 sem `source_hash`; 483 com palavra-chave genérica `medicina` ou `enamed 2026`; 112 contêm ao menos uma palavra-chave de 1–3 caracteres (siglas clínicas podem ser legítimas).
- 483 com `official_answer_status=definitivo` apesar de documentação pública consultada sobre gabaritos preliminares de 2026 e previsão de definitivos em 04/12/2026. Marcação carece de prova documental de oficialidade.
- F&O `fo_enade_items`: 1.934 registros (33/2023, 1.078/2024, 823/2025). `fo_residencia_items`: 200 registros. Contagens são de registros, não de cobertura de provas verificadas.
- Exemplos de revisão preliminar: C1 Q2 Epiglotite (tema conservar; competência de diagnóstico); C1 Q10 Pós-hernioplastia (subtema de conduta); C2 Q1 Dor torácica (priorizar decisão imediata); C2 Q10 Imunização e hesitação vacinal (TEA é contexto válido, não necessariamente ruído); C2 Q11 Crise falciforme (manter e enriquecer).
- Existe ponte de aprendizagem médica, Sapiens `thematic_review`, Trilhas ENADE e Enade360; testes sintéticos/documentais não substituem homologação real.
- A PR #168 é interface em **rascunho**, sem merge/deploy comprovado; a Issue #167 define o contrato de integração.

**Limitação crítica:** PDFs oficiais integrais não foram conciliados questão a questão. O parecer semântico dos 483 itens **não está homologado**. Não tratar amostra como auditoria integral.

## 8. Mecanismo de continuidade — método "Bíblia de Livro"

**Cada etapa N+1 deve executar obrigatoriamente:**
1. Ler esta Bíblia, o plano de trabalho, os ADRs, o diário e os artefatos da etapa N.
2. Verificar evidências em GitHub, Supabase, Render e fontes oficiais; não herdar como fato um status escrito sem prova.
3. Produzir a **matriz de herança**: o que permanece / melhora / precisa migrar / é bloqueado.
4. Planejar o incremento mínimo e critérios de teste; respeitar limites de produção.
5. Implementar em branch/PR com mudanças pequenas, testes e rollback explícito.
6. Validar regressão da etapa anterior e novas funcionalidades; registrar resultados negativos.
7. Atualizar Bíblia (versão), diário, plano, riscos, decisões e inventário; somente então recomendar início da etapa seguinte.

**Convenção de status:** `PLANEJADO` → `EM IMPLEMENTAÇÃO` → `IMPLEMENTADO NO CÓDIGO` → `TESTADO LOCALMENTE` → `HOMOLOGADO` → `PUBLICADO` → `VALIDADO COM DADOS REAIS`. Não pular estados nem confundir merge com funcionamento.

**Contrato de saída por etapa:** artefatos, evidências verificáveis, decisões, migrações, riscos, regressões, pendências, próximos comandos e gatilho de passagem. Se etapa bloqueada, registrar bloqueio e nunca "concluir por descrição".

**Controle de mudanças:** ADR com código (ADR-ENAMED-001 etc.), motivo, fontes, alternativa descartada, impacto pedagógico/regulatório/LGPD, aprovações e referências às PRs.

## 9. Pacote institucional futuro (não ativar agora)

Quando uma IES aderir:
- criar contexto e acesso institucional sob autorização;
- coletar código e-MEC/INEP, curso, edição, matriz curricular, critérios e dados de participação, indicadores, registros oficiais/documentos e fontes de origem;
- termo de finalidade, minimização, retenção e autorização para dados individuais quando legalmente permitidos;
- importar em staging, conciliar com curso/edição, apresentar divergências à IES e homologar;
- confrontar estimativas de simulado e resultados reais sem atribuir causalidade automaticamente;
- gerar diagnóstico institucional, currículo, plano de intervenção e trilha de auditoria;
- revisar metodologias *globais* apenas quando evidência comparável indicar problema reproduzível e após testes; evitar que o ajuste específico de uma IES contamine as outras.

**Produto multi-IES:** código e motor compartilhados; dados e decisões separados por instituição. Comparação nacional usa apenas agregados publicamente divulgados e metodologias compatíveis. Painéis nominais não fazem parte do observatório público.

## 10. Critérios gerais de conclusão do projeto estrutural

A fase estruturante só está completa quando:
- fontes e normas oficiais foram inventariadas, versionadas e verificadas quanto à vigência;
- importador staging reproduziu um lote real público com hash, dicionário e contagem conferidos;
- dicionário de competência e mapeador ENADE/ENAMED/Residência foram homologados pedagogicamente;
- itens F&O têm aliases de duplicatas, gabaritos versionados, tema/subtema/keywords revisados e competências justificadas, sem perda de tentativas;
- métodos oficiais e diagnósticos internos são técnica e visualmente segregados;
- ponte F&O → Vértice → Sapiens → Plano 5W2H foi testada ponta a ponta com **dados sintéticos** sob acesso institucional;
- segurança RLS/MFA, LGPD, logs, recuperação e responsividade testadas;
- CI, migrações, deploy e testes em produção foram comprovados separadamente;
- não há dependência de uma IES específica para o funcionamento da estrutura.

Concluir a estrutura **não significa** validar o modelo preditivo em resultados institucionais reais: isso será a etapa posterior de avaliação por IES.

## 11. Índice de artefatos vivos
- `docs/enamed/BIBLIA_MESTRA_ENAMED_360.md` — este documento, único contrato narrativo.
- `docs/enamed/PLANO_DE_TRABALHO_ENAMED_360.md` — fases, portas de qualidade, responsáveis funcionais.
- `docs/enamed/DIARIO_DE_BORDO_ENAMED_360.md` — evidências e decisões acumuladas por data.
- `docs/enamed/AUDITORIA_TAXONOMIA_20261116.md` — fotografia da inspeção inicial.
- `docs/implementation/learning-medical-validation-20261113.md` — contrato médico já existente.
- `docs/sapiens/REVISAO_TEMATICA.md` — revisão por duas IAs, sem aplicação automática.
- Issue #167 e PR #168 (GitHub Vértice).

**Próxima revisão:** antes da etapa seguinte, reler todos estes artefatos, validar as fontes primárias e atualizar o diário. 


## 12. Atualização cumulativa 1.1 — Etapa E1 (16/11/2026)
**Estado:** E1 em execução, **não aceita** e **não homologada**. O escopo E0 e as decisões ADR-001–006 permanecem preservados.

### Herança e melhorias verificadas
- Preservados: arquitetura multi-IES, ENADE 360° legado, F&O como acervo central, Sapiens como diagnóstico propositivo, cálculo oficial separado dos simulados, E9 de validação real futura.
- Acrescentados: `INEP_CATALOGO_FONTES_E1.md` (catálogo normativo rastreável) e `INEP_MATRIZ_REGRAS_E1.md` (transcrição de regras e testes).
- Confirmado no texto da NT40/2025: filtro `TP_INSCRICAO=1`, `IN_REGULAR=1`, `TP_INSCRICAO_ADM∈{0,2}`, `TP_PRES=555`; pelo menos 10 concluintes válidos, `PCP=NCP/NC`, cinco faixas; os requisitos dependem de edição.
- Confirmado no Manual 2026: 100 itens, Rasch/TRI e distinção entre 4º ano diagnóstico e 6º ano para conceito, condicionada a editais e validade da edição.
- **Correção de numeração normativa:** Portaria Inep 478/2025, art. 6º, competência VI = indicar/realizar procedimentos médicos; competência VII = intervenção coletiva. Qualquer lista simplificada anterior com VI=intervenção coletiva **não é uma reprodução literal e não deve alimentar códigos automáticos**. Cadastro de I–XV pendente de transcrição completa.
- Portarias/MP/editais em catálogo não equivalem a confirmação exaustiva de vigência. Estado legislativo da MP 1.370/2026 precisa de revisão.

### Porta de qualidade E1 — bloqueios
Não foi possível recuperar os binários oficiais via ambiente de execução para aferir SHA-256; portanto, **nenhum arquivo foi autenticado por hash**. Estão pendentes download integral, revisão da matriz, notas 19/1PL/42, retificações, gabaritos, dicionários, confrontação de 2025 e validação regulatória. **Não iniciar E2 como implementada nem abrir publicação de dados oficiais com estas lacunas.**

### Próxima ação vinculante
Continuar E1 conforme catálogo e matriz; atualizar documentação e diário com evidência literal, depois testar cálculo com microdados oficiais 2025 em staging. Referência: [Catálogo E1](INEP_CATALOGO_FONTES_E1.md) e [Matriz de regras E1](INEP_MATRIZ_REGRAS_E1.md).


## 13. Atualização cumulativa 1.2 — implementação paralela segura (16/11/2026)
**E1 permanece bloqueada:** não mudou o gate normativo ou a necessidade de arquivos INEP íntegros. Uma atividade incremental independente criou **somente uma consulta institucional de resultados internos do Fato & Ordem** no ambiente ENAMED, sem publicar qualquer resultado oficial.

### Implementação incremental na PR #168
- Novo `EnamedFatoOrdemMetrics.tsx`: usa `vertice_learning_course_metrics` já existente, por Supabase autenticado, filtrado por `institution_id` + `course_id` + módulos `enade/enamed/residencia`. Não conecta diretamente ao banco F&O ou usa segredos no frontend.
- `EnamedEnvironment.tsx`: aba de indicadores do F&O com escolha de curso de Medicina. Não altera o ENADE legado, apenas acresce a visualização.
- Grupos de menos de 5 estudantes são excluídos da visualização e da agregação no cliente; este mecanismo complementa, **não substitui**, políticas RLS/privacidade no banco.
- Respostas avaliadas e percentuais são contagens de **vínculos acadêmicos**, não de tentativas únicas ou notas TRI. Dados oficiais INEP permanecem pendentes de E1/E4.
- Tratamento de carregamento, erro, desatualização de requisição, estados vazios, limite de 1.000 linhas e fontes separadas.
- O esquema real da tabela `vertice_learning_course_metrics` foi conferido em leitura no Supabase Vértice; RLS habilitada, uma política detectada; verificação de efetividade por perfil ainda pendente.
- Consulta agregada do banco não retornou grupos ENAMED/ENADE/Residência nesta inspeção; não criar amostra fictícia nem afirmar sincronização ponta a ponta.
- `scripts/tests/enamed-integration-contract.test.mjs` criado. Dez verificações estáticas do código feitas nesta execução; **não equivalem à execução do script por Node, ao TypeScript completo ou a testes de browser**.

### Status e guardrails
Código implementado na **branch da PR #168**; não há merge/deploy comprovado. A E7 permanece parcialmente implementada e bloqueada para aceite, pois depende de E1–E6. E9 continua reservada à IES real.


## 14. Revisão cumulativa v1.3 — testes de compilação, RLS, ponte e origem INEP (16/11/2026)
**E1 permanece aberta, E2 bloqueada, E7 em implementação técnica.** Sem dados reais institucionais nesta rodada.

### Evidências (consultadas diretamente)
1. GitHub Actions, commit `0a5cf238338e72dabdbdf37c365918521d28bc89`: workflow `ENADE 360 - validar integracao real no Render` #43989469247 concluiu com success e **build:static passou**, porém isso é compilação do artefato da PR, não publicação Render. `Portal - TypeScript completo e contratos da Reitoria` #43989469122 falhou com exatamente dois TS2345 em `Governanca360Auditoria.tsx` nas tabelas `formation_trails` e `trail_question_links`; 17 testes de regressão TypeScript e 20 testes de runtime de planejamento passaram antes da falha. Em commit posterior `bdf79937c581b4386d7484f0c79d5ffb573c6d11`, o tipo `Table` foi estendido para incluir esses nomes, sem criar tabelas; nova verificação TypeScript **em execução**, não considerar aprovada até nova conclusão.
2. Supabase Vértice (read-only): `vertice_learning_course_metrics` tem **0 registros**; política `learning_metrics_read` existe com RLS habilitada. `vertice_private.can_read_institution` inclui Master por `is_master()`, mas `has_role` usa `member_role`; verificar efetividade de Master em sessão real (possível ausência de associação), docentes precisam `aal2` e escopo ativo por curso/disciplina. Não foi realizado teste autenticado por perfil.
3. Supabase F&O (read-only): 12 registros `fo_enade_attempts`, 11 `fo_enamed_attempts`, 9 `fo_residencia_attempts`, 3.235 registros de vínculos `fo_vertice_student_links` em duas instituições. NÃO inferir estudantes elegíveis nem tentativas sincronizáveis desses totais; sem diagnósticos agregados publicados na Vértice.
4. Render: serviço ativo `vertice-portal`, workspace Projetos, vinculado à branch `main` do repositório Vértice; último deploy consultado `23d625c5ae9b2fd7aacaf94371e6fb840eb71106` (status live). A PR #168 não foi integrada nem publicada. Outros serviços Vértice listados como suspensos são distintos; não confundir instâncias.
5. Fontes INEP: a NT 40/2025 foi aberta em domínio oficial, texto e página 1 inspecionados; identificação SEI 1844476, CRC AD834C1B aparecem no PDF. Trata-se de verificação de origem/documento em PDF oficial, **não de checksum do arquivo** ou validação da assinatura via sistema SEI. A página pública apresenta notas 19/2025, 1PL/2025, 42/2025; downloads dessas três falharam (timeouts/502), por isso leitura integral e SHA-256 permanecem pendentes. A página de microdados 2025 mostra atualização 14/05/2026 no cabeçalho mas rótulo do ZIP informa 14/05/2025; verificar metadados, sem presumir versão.

### Decisões novas
- ADR-ENAMED-008: não ativar importação/cálculo oficial sem corpus autenticado, validade e hash verificáveis; doc SEI indica autenticidade verificável, mas não equivale a arquivo hashado.
- ADR-ENAMED-009: zero métricas no destino é estado de ausência **comprovado**, não sucesso da ponte nem taxa zero; implantação necessita vínculos acadêmicos e mapeamentos válidos, com população mínima.
- ADR-ENAMED-010: teste estático/build não substitui QA navegador, execução por papel e serviço publicado; falhas de TS deixam a PR bloqueada.

Nenhum dado de produção modificado. E9 com documentos reais de IES permanece futura e independente.

## 15. Atualização cumulativa 1.4 — dicionário preliminar e auditoria concomitante (16/11/2026)
**Status:** E1 permanece em andamento, sem aceite formal; E2 e E3 receberam somente *artefatos preparatórios em branch*, não aprovação nem execução formal dependente.

### Herança e entregas
- Relidas a Bíblia, Plano e Diário. Mantidas ADRs anteriores, matriz INEP como fonte normativa, ENADE 360 legado, segregação multi-IES e piloto futuro E9.
- Portaria Inep nº 478/2025 conferida em reprodução da publicação do DOU (4 páginas; art. 3º, art. 6º, art. 7º e art. 8º; páginas visuais 3 e 4 inspecionadas); não há autenticação de hash binário nem validação de todas as alterações legais.
- Criado `docs/enamed/DICIONARIO_COMPETENCIAS_478_2025_DRAFT.json`: 7 áreas, 15 competências I–XV, 6 contextos e 21 conteúdos. Resumos são editoriais, não redação integral; referência literal à Portaria. A numeração VI (procedimentos) e VII (intervenções coletivas) foi confirmada.
- Criada `docs/enamed/FILA_REVISAO_483_ENAMED_2026.csv`, contendo os 483 IDs atuais do F&O, audit flags e candidatos de área baseados apenas em disciplina editorial — **343 candidatos preenchidos e 140 não inferidos**. Qualquer candidatura exige revisão do comando e do PDF. Não são classificações aplicadas.
- Criado `docs/enamed/AUDITORIA_CONCOMITANTE_483_20261116.md` com baseline e critérios de curadoria, preservando `AUDITORIA_TAXONOMIA_20261116.md`.
- Script `scripts/tests/enamed-dictionary-contract.test.mjs` versionado; 11 verificações de invariantes executadas sobre arquivos recuperados do GitHub, 11 aprovadas. **Execução do script Node/CI ainda não comprovada**.
- Confirmado em SQL somente leitura: 483/483 sem competências, hash e área oficial específica; 483 com keyword de edição `enamed 2026`; 433 com keyword exatamente `medicina`; 200 posições duplicadas por fonte/número. 27 especialidades editoriais distintas. Gabaritos declarados definitivos requerem fonte documental válida.

### ADR-ENAMED-011
Separar **ontologia normativa em versão e códigos oficiais**, **taxonomia editorial**, **fila de propostas**, **histórico imutável de origem** e **aplicação homologada futura**. Proibido aplicar automaticamente candidatos de área apenas pela disciplina, converter palavras-chave de edição em competência, ou suprimir duplicatas com histórico associado.

### Gate E1
Prosseguir conferindo as fontes INEP e originais de cada caderno; E1 não pode ser encerrada sem hash, vigência, retificações e validação. E2/E3 não recebem status de concluídas por existir dicionário rascunho e fila.


## 16. Atualização v1.5 — verificações de corpus e divergências internas (16/11/2026)
**Preservada a continuidade E0–E1:** os artefatos preparatórios E2/E3 não foram homologados; E1 continua aberta. Fonte e cálculos oficiais não foram ativados.

### Achados cumulativos
- Referência oficial Portaria 478/2025 examinada na reprodução DOU hospedada pela UFBA (4 páginas, página 2 inspecionada visualmente), complementada pelo portal do Inep. Confirma 7 áreas, 15 competências, 6 contextos, 21 conteúdos; não há hash binário autenticado.
- Consultas de leitura aos 483 registros F&O: **283 posições** únicas por `source_url+question_number`, 200 posições duplicadas. Nas repetidas, diferenças em 57 enunciados, 2 conjuntos de alternativas, 6 temas, 191 subtemas e 192 listas de palavras-chave; zero diferenças de `answer_key` entre cópias. Isso **não comprova** concordância com o gabarito Inep.
- Novo relatório `docs/enamed/E1_CONFRONTO_DOCUMENTAL_483_20261116.md` documenta método SQL e limites. Não remover duplicatas nem substituir versões sem proteger tentativas históricas.
- **Falha de autenticação documental:** downloads `download.inep.gov.br` falharam no ambiente por DNS/502, e screenshot do manual oficial não pôde ser recuperado. Nenhum SHA-256 oficial foi produzido; E1 não ultrapassa o gate.
- **QA PR #168:** workflow de 415 testes no commit de documentação v1.4 falhou 1 teste em `InstitutionTabs.test.tsx` por duas abas `construcao-curricular` e `trilhas-enade` ausentes de `MACRO_TABS`; alinhadas ao macro acadêmico na branch, commit `7b3f5064d3c79b24716b21bb83c5d75317856317`. Reexecução de TypeScript/UI completa ainda exige resultado final comprovado.
- Novo workflow `verify-enamed-contracts.yml` executou **6 testes Node (2 do dicionário + 4 de integração)** com sucesso no run `43994963032` (commit `e9f2bbf46ca2d32ca5a54839342829ae132ce769`). Esses são testes de contratos e integridade da fila, não de semântica médica nem end-to-end.
- ADR-ENAMED-012: manter E1 bloqueada quando PDF não autenticável; usar evidência web apenas para inventário e interpretação preliminar. RLS, sincronização e dados reais por IES mantêm aceite separado.

**Dependências:** E2/E3 não são encerradas; produção F&O e Vértice intocada; a PR #168 permanece em rascunho.


## 17. Atualização cumulativa v1.6 — autenticação, regressão e perfil (16/11/2026)
**Situação:** E1 EM ABERTO. E2 e E3 continuam somente com artefatos preparatórios, sem homologação clínica ou gravação F&O. Código ENAMED permanece em PR #168 draft.

### Regras confirmadas e procedência
- Catálogo `E1_CADEIA_CUSTODIA_E_REGRAS_20261116.md`: texto do Edital nº 71/2026 republicado no DOU (21/08/2026, seção 3, p.53), domínio `download.inep.gov.br`. Distingue 8º semestre/4º ano e 12º semestre/concluinte (itens 1.1.1 e 1.1.2); 100 itens com 4 alternativas (3.1.1.1); marco temporal normativo/bibliográfico **03/07/2026** (3.1.1.2.1); gabarito definitivo previsto para 04/12/2026 (1.3).
- O HTML da página do Inep de provas/gabaritos não revelou links de PDF; a recuperação por HTTP dos arquivos do F&O e NT 40 falhou (502/timeout/DNS). Nenhum hash de documento oficial foi registrado. A conferência textual do edital não equivale à autenticação do binário.
- Manifesto `FONTES_FO_PENDENTES_AUTENTICACAO_20261116.json` diferencia três URLs de PDFs declaradas no banco F&O de documentos efetivamente autenticados. **Nenhuma dessas URLs foi homologada**.
- CSV `CONFLITOS_DUPLICATAS_ENAMED_2026.csv` discrimina as **200 posições duplicadas por fonte/número**, preserva seus IDs e flags para 57 divergências de enunciado, 2 de alternativas, 6 de tema, 191 de subtema e 192 de keywords. Dados internos, não veredicto clínico.

### Implementação de verificação e QA
- `scripts/enamed/verify_inep_artifacts.py`: verificador offline e fechado por padrão para PDFs/ZIP já recuperados, URL de domínio permitido, caminho seguro, integridade binária e SHA-256. **Não atesta autenticidade ou validade oficial sozinho.**
- `scripts/tests/test_verify_inep_artifacts.py`: 4 testes com fixture sintética: hash, rejeição de domínio indevido, caminho inseguro e PDF inválido.
- `source-overrides/client/src/components/area/EnamedEnvironment.test.tsx`: 4 testes de renderização e matriz de navegação de perfis, ainda sem sessões reais. Constatação: coordenação e NDE recebem Trilhas ENADE, mas não `enade` institucional, ao contrário de Master, Reitoria e CPA. **Não ampliar automaticamente** porque é necessária validação de escopo curso/IES e RLS.
- Workflow `verify-enamed-contracts.yml` atualizado para executar contratos Node e testes offline Python; teste de TypeScript completo já havia passado no commit `2591fcc59fc4f268d43d8f06ad34773ac6306484`, mas novas mudanças exigem regressão atualizada.
- ADR-ENAMED-013: hash local ≠ autenticação de autoria/edição; exigir cadeia de fonte oficial e inspeção humana.
- ADR-ENAMED-014: perfil de coordenação exige uma visualização institucional restrita por curso antes de ser habilitado no ENAMED/ENADE 360; não presumir autorização somente pelo menu.

**Porta E1:** fechada até haver arquivos oficiais integrais, versões, hashes e revisão normativa. Futura validação por IES continua E9.


## 18. Atualização v1.7 — execução formal de testes e encaminhamento à curadoria (16/11/2026)
**Herdeiro de v1.6:** E1 aberta, E2/E3 preparatórias, E9 institucional futura. Nenhuma modificação de produção.

### Evidências novas
- Run GitHub Actions `43997164508`, workflow `ENAMED 360 - validar contratos e dicionário`: **6 testes Node aprovados (2 de dicionário + 4 de integração)** e **4 testes Python aprovados**, usando fixtures sintéticas. Isso comprova os contratos versionados e o verificador offline, **não a autenticidade de PDFs oficiais**.
- Componentes `EnamedEnvironment.test.tsx` foram adicionados ao suíte Vitest, com quatro testes SSR e de matriz de navegação (Master/Reitoria/CPA versus coordenador/NDE/equipe/leitor). Resultado da execução TypeScript completa após as mudanças ainda depende da conclusão do workflow `43997164461`; execução local em navegador e RLS autenticada não ocorreram.
- Extraídas das tabelas F&O três URLs por edição: aplicação regular cadernos 1 e 2 (100 posições por caderno, 200 registros cada) e reaplicação caderno 1 (83 posições). Todas registradas em `FONTES_FO_PENDENTES_AUTENTICACAO_20261116.json`, com `sha256: null`, origem declarada no banco, sem certificação da publicação original.
- `CONFLITOS_DUPLICATAS_ENAMED_2026.csv` enumera individualmente 200 posições duplicadas e flags; nenhum conteúdo clínico completo de paciente ou dados nominais foi adicionado.
- Issue **#170** criada como fila formal de curadoria: 483 registros, 200 posições duplicadas e revisão temática/competências das duas IAs **somente após** PDF/gabarito autenticados e curadoria médica.
- Edital republicado nº 71/2026, DOU 21/08/2026, validado textualmente via documento hospedado no domínio Inep: 8º/12º semestres, 100 itens, 4 alternativas, marco 03/07/2026, definitivo previsto 04/12/2026. Captura visual do PDF e SHA-256 dos binários não foram obtidos; **não fechar E1**.
- Repetida tentativa de download dos binários via ambiente de arquivos: falha de domínio/transferência. Sem falsear checksum.

### ADR-ENAMED-015
Pode-se **encaminhar a fila de revisão** antes da autenticação da fonte (issue de trabalho), mas não executar homologação clínica, atualização F&O ou publicação de índices oficiais até os critérios de E1. Distinguir issue aberta de parecer médico ou de IA concluído.

**Portal:** PR #168 draft, sem merge ou deploy nesta execução. Não afirmar acesso de coordenação ao ENADE 360: acesso escopado pendente de revisão e teste.


## 19. Atualização cumulativa v1.8 — cobertura por caderno e limites de homologação (16/11/2026)
**Etapa E1 ainda não aceita.** O ambiente de consulta confirmou no catálogo do Inep a listagem dos **dois cadernos regulares e dois da reaplicação 2026**, com gabaritos preliminares. A tabela F&O tem 200+200 registros de cadernos regulares, mas apenas 83 da reaplicação Caderno 1; não foi localizado registro do Caderno 2 da reaplicação na tabela inspecionada. Isso identifica lacuna **candidata** de cobertura, não comprova ausência de outras tabelas/acervos. Registro detalhado em `E1_COBERTURA_OFICIAL_E_PERFIS_20261116.md`.

**Proveniência:** portal oficial lista provas/gabaritos, mas conteúdo HTML simplificado não expôs URLs diretas e downloads binários (4 notas e caderno de 2025) falharam. **SHA-256 oficial: nenhum novo**. Documentação de edição, gabaritos e questões segue pendente. Restrições e decisões ADR-001–015 preservadas.

**QA:** matriz de navegação `visibleTabs` e testes SSR identificam que coordenador/NDE têm Trilhas ENADE, mas não aba `enade` institucional; ainda sem testes reais autenticados/RLS por perfil. CI específico ENAMED anterior 10/10; workflow completo no HEAD de documentação anterior foi cancelado por commits concorrentes, então a última versão não é homologada. **PR #168 segue em rascunho, sem merge/deploy.**

**ADR-ENAMED-016:** cobertura documental é aferida por **edição, aplicação/reaplicação, caderno e versão de gabarito**; não inferir equivalência de questões por numeração nem declarar ausência global a partir de uma tabela apenas. A E2/E3 seguem com preparativos e E9 de dados reais IES permanece futura.


## 20. Atualização cumulativa v1.9 — E1: tentativa de recuperação real de PDFs e QA por perfil (16/11/2026)
**E1 continua sem aceite. E2/E3 preparatórias; E9 futura.** Relatório de evidências: `docs/enamed/E1_COLETA_BINARIOS_E_QA_PERFIS_20261116.md`.

### Realizado em código e testes
- GitHub Actions run `43998145208` e demais 7 workflows associados ao commit `ae19a8847c9ea4b0fe2935634be24ac7d34523e9`: **8/8 concluídos success**, TypeScript Node 22/24, build estático e contratos. Em log de `portal (22)`, `tsc --noEmit` passou e 415 testes do grupo principal passaram.
- A auditoria revelou que `EnamedEnvironment.test.tsx` não estava incluído no `vitest.config.ts`; foi adicionado explicitamente (commit `ce99687268ebb4440e7e5c3393306c8c1e5438c7`). Esses 4 testes SSR/visibilidade de navegação devem ser comprovados pelo CI **após** esse commit; não equiparar SSR à autenticação real.
- SQL read-only confirmou política `learning_metrics_read` com RLS e escopo IES/papel ou MFA+vínculo de curso/disciplinas. `vertice_private.member_role` exige `aal2`, inclusive Master. Navegação coordenador/NDE mantém acesso a Trilhas ENADE, não ENADE institucional; sem ampliação automática.
- O navegador conectado não estava disponível no contexto desta conversa, então **nenhum login real por perfil nem teste mobile autenticado ocorreu**.

### Recuperação de PDFs oficiais — evidência negativa verificável
- Tentativa direta `requests` no container: DNS indisponível para `gov.br` e `download.inep.gov.br`.
- GitHub Actions `43999397676`: HTML público do catálogo INEP recuperado, **zero links PDF diretos** e **zero PDFs binários**; pacote de evidências do Actions contendo diagnóstico, sem arquivo de prova.
- Segunda rodada `43999518665`: confirmação de HTML sem a expressão esperada `Prova Objetiva` no material entregue ao coletor estático; zero URLs e zero arquivos.
- Adicionado `scripts/enamed/discover_public_inep_pdfs.py` e workflow `enamed-inep-public-corpus.yml` para coleta isolada de documentos públicos e hashes, sem gravações no banco. Adicionado `scripts/enamed/render_inep_public_catalog.py` para tentar resolver carregamento por JavaScript.
- Primeira tentativa Playwright (run `43999660361`) falhou no setup: Ubuntu 26.04 não suportado pela versão do Chromium. Workflow corrigido para Ubuntu 24.04 (commit `4feb641631a0e0ea27042c66b4e1ee465180519f`). A nova execução browser foi cancelada durante commits posteriores; **não afirmar recuperação ou falha documental com base nesse cancelamento**, verificar execução da revisão final.
- Nenhuma fonte documentada com PDF integral obtido e comparado a original nesta passagem. **Todos os hashes de documentos oficiais no registro E1 seguem nulos**, sem autenticação ou homologação.

### Aprofundamento da cobertura
No banco F&O (leitura) só foram encontrados `fo_enamed_items` e `fo_enamed_attempts` com esse nome; na `fo_enamed_items`, reaplicação Caderno 1 = 83 posições, reaplicação Caderno 2 = 0, comparados à listagem oficial de ambos os cadernos. Não inferir ausência em arquivos/storage/outros nomes sem varredura autorizada.

### ADR-ENAMED-017
**Critérios de aceite devem provar cada elo**: fonte oficial autenticada e vigente, binário integral + hash, reconciliação da prova/gabarito, competência revisada por duas IAs independentes + médico, UI e RLS por sessão autenticada, e finalmente deploy comprovado. Um CI verde para TypeScript não autoriza liberar índices oficiais nem modificar dados de estudante. Não fundir a PR #168 antes dessas verificações.


## 21. Atualização cumulativa v2.0 — URLs oficiais comprovadas, TLS bloqueia autenticação (16/11/2026)
**Regra mantida:** E1 permanece EM ABERTO; E2/E3 só artefatos preparatórios, E9 futura. Produção e históricos preservados.

### Avanço de procedência E1
- GitHub Actions run `43999991024`, renderização da página oficial INEP com Playwright/Chromium e JavaScript: **837 âncoras no DOM; 11 hyperlinks de PDFs do ENAMED 2026 extraídos diretamente do catálogo oficial**. A lista e seus metadados foram versionados em `docs/enamed/INEP_2026_LINKS_OFICIAIS_CONFIRMADOS.json`, com `sha256:null` e `binary_status:NOT_RECOVERED`.
- Confirmados links do catálogo para as provas regulares C1/C2, três versões acessíveis de C1, gabaritos preliminares C1/C2, reaplicação C1/C2 e gabaritos preliminares correspondentes. Os três `source_url` previamente cadastrados no F&O aparecem na listagem oficial — **proveniência dos links confirmada, identidade dos arquivos ainda não**.
- Downloads com urllib de 11 arquivos falharam (cadeia certificadora não validada ou conexão encerrada). Workflow `enamed-inep-public-corpus.yml` ampliado com rota `curl` usando TLS ativo, sem `-k`. Run `44000426717`: **8 tentativas / 0 binários íntegros**; sete erros curl 60 (emissor do certificado desconhecido) e um curl 35 (conexão reset). Não diminuir segurança TLS para produzir hash enganoso.
- A E1 **não autentica quaisquer PDFs nem gabaritos**, logo nenhuma questão é homologada e nenhuma correção em F&O pode ser aplicada. O catálogo de fontes atualizado distingue claramente URL oficialmente publicada de hash de arquivo autêntico.

### Estado da interface/perfil
- Em commit anterior `ae19a8847c9ea4b0fe2935634be24ac7d34523e9`, TypeScript completo Node 22 e 24 e demais 8 workflows foram concluídos com sucesso (415 testes da suite principal).
- Os quatro testes SSR ENAMED foram incluídos posteriormente no `source-overrides/vitest.config.ts` para executar pelo pipeline, e o resultado completo do **HEAD atual** deve ser verificado separadamente; nenhum acesso real por perfil, MFA ou RLS foi executado em sessão autenticada. Navegador conectado não disponível no contexto.
- ADR-ENAMED-018: **proveniência do link, autenticação TLS e identidade do arquivo são três gates separados.** Links oficiais podem alimentar o manifesto de recuperação, mas não podem se converter em prova homologada sem binário completo + SHA-256 + revisão de caderno/edição/retificação.

### Evidências principais
- Catálogo oficial: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos
- Browser e relatório: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/43999991024
- `curl` TLS: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44000426717
- `docs/enamed/E1_COLETA_BINARIOS_E_QA_PERFIS_20261116.md` (limitações e protocolo).


## 22. Atualização cumulativa v2.1 — regressão do portal comprovada (16/11/2026)
**E1 permanece aberta** porque os arquivos PDF e gabaritos oficiais ainda não foram recuperados com TLS válido e SHA-256. E2/E3 não homologadas; nenhuma atualização F&O.

### Evidência de qualidade da PR #168
- GitHub Actions `Portal - TypeScript completo e contratos da Reitoria`, run **44000644637**, no commit `fba170085e5a4038455e188d16207725dc5581ae`: jobs **portal (22) e portal (24) concluídos com sucesso**.
- Log job `133763568309` (Node 22): `tsc --noEmit` executado sem erro; a suíte principal passou de 415 para **419 testes** com **52 arquivos de teste aprovados**, incluindo `client/src/components/area/EnamedEnvironment.test.tsx` com **quatro testes aprovados**. Suítes complementares: 214, 19 e 30 testes aprovados; build Vite concluído.
- A execução automatizada demonstra renderização SSR e contrato de visibilidade por perfil simulado, **não sessão autenticada por usuário real**. Testes de login Master, Reitoria, CPA, Coordenador, NDE e outro tenant, políticas RLS efetivas e navegabilidade mobile continuam pendentes.
- O pipeline de contratos do ENAMED `44000644528` concluiu success. Sucesso de CI não significa aprovação da curadoria médica nem deploy.

### Fontes de prova
- [Run portal TypeScript/SSR 44000644637](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44000644637)
- [Run de recuperação oficial 44000426717](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44000426717) — 11 URLs oficiais identificadas na coleta original `43999991024`, mas sem PDF íntegro por falhas TLS.
- ADR-ENAMED-019: **distinguir regressão automatizada 419/419 de homologação autenticada e funcional do portal**. A E1 e a revisão pedagógica continuam bloqueadas sem PDFs oficiais verificados.


## 21. Atualização cumulativa v2.2 — corpus 2026 recuperado e 483 gabaritos preliminares reconciliados (17/11/2026)
**E1 avançou substancialmente, mas continua SEM ACEITE integral.** E2/E3 preparatórias; nenhum resultado do Inep foi apresentado como definitivo e nenhum registro do Fato & Ordem foi editado.

### Fontes e autenticação dos binários
- O certificado apresentado por `download.inep.gov.br` não continha o intermediário. A cadeia foi diagnosticada via OpenSSL: `RNP ICPEdu GR46 OV TLS CA 2025`, AIA GlobalSign.
- Ferramenta `scripts/enamed/download_inep_verified_chain.py`, sem `verify=False` ou `curl -k`, recuperou a intermediária e **verificou a assinatura até raízes do sistema** antes de formar a cadeia de confiança e realizar transferências HTTPS com validação de domínio.
- GitHub Actions run **[44017133303](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44017133303)**, artefato `enamed-e1-verified-chain-pdfs` ID `14299257407`: **oito PDFs oficiais** (quatro cadernos e quatro gabaritos preliminares) obtidos sem ignorar TLS. Os oito hashes SHA-256 foram recalculados a partir dos bytes arquivados e coincidiram com o relatório.
- `docs/enamed/INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json` guarda os oito hashes, tamanhos, páginas, URLs, origem e estado. `docs/enamed/E1_CONFRONTO_GABARITOS_PRELIMINARES_483_20261117.md` guarda o método e as contagens.
- **Gabaritos de 2026 são PRELIMINARES;** autoria/regra oficial e versão definitiva exigem revisão da data de divulgação e de retificações futuras. A cadeia TLS e o hash não substituem a homologação pedagógica.

### Auditoria ao vivo, somente leitura
- Cada um dos quatro PDFs preliminares contém as 100 chaves A–D numeradas 1–100; o confronto via `SELECT` em `fo_enamed_items` verificou **483/483 registros concordantes, zero divergências de resposta**: regular C1 200/200; regular C2 200/200; reaplicação C1 83/83.
- As **483 linhas ainda ostentam `official_answer_status=definitivo`**, o que permanece sem respaldo no gabarito preliminar. Nenhum UPDATE foi aplicado. Não confundir igualdade de letras com autenticação de enunciado/alternativas.
- Reaplicação C1: caderno oficial de 100 questões, banco com 83 posições; **17 números faltantes na tabela**: `1,11,20,22,24,27,31,36,42,49,53,57,59,74,88,91,98`.
- Reaplicação C2: caderno oficial com 100 questões e gabarito preliminar de 100 respostas, **zero posições da origem na tabela F&O `fo_enamed_items`**. Falta em outras fontes ainda não comprovada.
- Nas duas posições com alternativas diferentes entre IDs duplicados (`REG-C1-Q019` e `Q028`), as diferenças observadas são de espaçamento/pontuação, sem alteração de letra/alternativa escolhida. As outras divergências de texto, temas e subtemas seguem à revisão.
- **Não foi concluída a revisão textual 483/483**, nem a classificação por competências, e não foi executado parecer de duas IAs ou médico.

### Engenharia, CI e segurança
- Execuções GitHub Actions no commit `ccda5e4c2af06382be46cb7c25db34b289aa525e`: `ENAMED E1 - recuperar documentos`, `ENAMED 360 - contratos` e `Portal - TypeScript completo` **concluíram success**. Os quatro testes de renderização ENAMED passaram na suíte principal em execução anterior (419 testes), sem equivaler à homologação por usuário real.
- Tabela `vertice_learning_course_metrics`: nenhum indicador publicado na consulta desta passagem, RLS com escopo por IES/papel e MFA/permissão docente. Sessões reais de Master/Reitoria/CPA/Coordenação/NDE e controle de outra IES **não executados** por indisponibilidade de sessão autorizada; NÃO afirmar homologação do portal.
- Render continua sem publicação da PR #168; nenhum banco/gabarito/estudante foi modificado.

### Decisões vinculantes
**ADR-ENAMED-020:** a conclusão de um gate deve ser granular: (a) origem por portal oficial, (b) integridade TLS/SHA, (c) versão de caderno, (d) gabarito preliminar ou definitivo, (e) equivalência textual de cada questão, (f) competência/taxonomia homologada e (g) acesso/autorização comprovados. Nesta passagem (a), (b) e a correspondência das **letras preliminares** foram demonstradas; (d definitivo), (e), (f), (g) permanecem pendentes.
**ADR-ENAMED-021:** lacunas de reaplicação são catalogadas para importação futura apenas após curadoria e rastreio por ID, sem supor que ausência em `fo_enamed_items` signifique ausência em todo o F&O.

**Próximo compromisso:** verificar enunciados e alternativas contra os cadernos autenticados, priorizando 57 diferenças de enunciado, os 17 números da reaplicação e as 100 posições de reaplicação C2 sem registro; aguardar documento definitivo e manter as revisões clínicas sob gate regulatório E1. Segurança multi-IES deve ser provada em sessões reais antes de merge/deploy.


## 22. Atualização cumulativa v2.3 — auditoria textual inicial e equivalência real entre cadernos (17/11/2026)
**Estado:** E1 permanece aberta até validação normativa, gabaritos definitivos, mídia e correspondência integral. E2/E3 preparatórias; E9 de dados reais por IES futura. Preserve todas as decisões anteriores.

### Achado central: cadernos diferentes não implicam questões diferentes
- Extração dos quatro cadernos oficiais ENAMED 2026 recuperados por HTTPS válido: **400 posições numeradas** (100 por caderno) com localizadores de página física em `ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json`.
- `ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json`: no regular, Caderno 2 corresponde a **100/100** questões do Caderno 1 em ordem permutada; na reaplicação, também **100/100**. Os 200 pares foram conferidos por abertura textual normalizada e por 200 concordâncias das **letras preliminares**, não por revisão integral de mídia.
- **Correção da avaliação anterior:** as 100 posições sem linha da reaplicação C2 em `fo_enamed_items` não são 100 conteúdos clínicos inéditos. São **100 referências de caderno não presentes nessa tabela**, remapeáveis aos 100 conteúdos do C1, sujeitos a homologação. A lacuna candidata de **conteúdo distinto** é de 17 questões do C1, preservada em `ENAMED_2026_REAPLICACAO_17_POSICOES_EQUIVALENTES.json`. Não apagar nem importar automaticamente.
- Na consulta somente leitura, **483/483 registros** do F&O têm seus **24 primeiros caracteres alfanuméricos normalizados** compatíveis com a abertura do enunciado oficial correspondente, após a permutação. Isso confirma identidade inicial da questão, **não equivalência textual completa** nem revisão de alternativas/comando.
- O relatório `E1_AUDITORIA_TEXTUAL_483_E_MAPA_CADERNOS_20261117.md` distingue rigorosamente o teste de abertura, o mapa de cadernos, o gabarito preliminar e o que ainda requer revisão clínica. As 57 diferenças de enunciado entre cópias, 191 subtemas e 192 keywords continuam na fila; nenhuma mudança no acervo.

### Novos contratos
- `scripts/tests/enamed-booklet-maps.test.mjs` e workflow `verify-enamed-contracts.yml` verificam a integridade das duas permutações 1–100 e dos quatro localizadores de páginas. Não substituem RLS, UI autenticada ou curadoria médica.
- ADR-ENAMED-022: identificar unicamente o item clínico por conteúdo homologado e preservar separadamente **edição, aplicação, caderno, número e alternativa**; mapear aliases de caderno apenas após aprovação humana, mantendo tentativas ligadas ao ID original.
- ADR-ENAMED-023: a auditoria de prefixo normalizado é **triagem automatizada de identidade**, nunca um certificado de equivalência integral ou correção médica. Não transformar resultado 483/483 de prefixos em 483 questões homologadas.

**Status da publicação:** PR #168 permanece draft, sem merge/deploy; as áreas em código não representam publicação em produção. A matriz de acessos reais Master/Reitoria/CPA/Coordenação/NDE ainda não foi homologada em sessões autenticadas; o controle RLS permanece sujeito a prova efetiva.


### Adendo v2.3 — refinamento da triagem textual (17/11/2026)
Revisada a comparação entre as duas cópias das 200 posições regulares usando níveis sucessivos de normalização: **57 enunciados brutos diferentes**, **31 após retirar whitespace**, **22 após também retirar pontuação**. As 22 diferenças alfanuméricas persistentes estão no Caderno 2 regular e foram registradas por ID, posição e caderno equivalente em `ENAMED_2026_22_DIVERGENCIAS_TEXTUAIS_PERSISTENTES_C2.json`. Duas divergências brutas de alternativas desapareceram ao retirar whitespace. **Esta triagem não detecta por si só mudança semântica ou efeito clínico, e remoção de pontuação poderia ocultar alterações relevantes em valores/unidades.** Nenhum registro modificado; permanece revisão integral por fonte e curadoria humana.


### Adendo v2.3 — homologação por perfil preparada, não executada
O roteiro `docs/enamed/ENAMED_2026_ROTEIRO_HOMOLOGACAO_PERFIS.md` enumera **16 cenários verificáveis**, positivos e negativos, com duas IES sintéticas, Master/Reitoria/CPA/Coordenação/NDE/docentes, MFA AAL2, RLS por instituição/curso/disciplina, prevenção de exposição cruzada, responsividade e sessão expirada. **Nenhuma sessão autenticada real foi executada nesta conversa**, e zero linhas em métricas não prova isolamento. Não habilitar a aba ENADE institucional para coordenadores apenas por menu; preservar o escopo de curso e a decisão formal sobre permissões.


## 23. Atualização cumulativa v2.4 — 22 divergências textuais e risco de mídia não indexada (17/11/2026)
**Condição herdada:** E1 parcialmente verificada, ainda sem aceite completo; E2/E3 apenas preparação; E9 de IES real permanece futura. Sem escritas no F&O nem na Vértice.

### Auditoria efetivamente executada nesta passagem
- Usados os binários do Caderno 2 regular ENAMED 2026 já recuperados via HTTPS autenticado e os 22 pares divergentes da tabela `fo_enamed_items` (SQL somente leitura). Para cada um, foi inspecionada a primeira região textual divergente e comparado o contexto com o PDF recuperado. **Isso não equivale a cotejo integral da questão**.
- Novo catálogo por questão: `ENAMED_2026_TRIAGEM_22_VARIANTES_TEXTUAIS_C2.json` contém IDs duplicados, posição C2, posição C1 equivalente, página física, evidência clínica e exigência de revisão humana; novo relatório `E1_AUDITORIA_22_VARIANTES_E_MIDIAS_20261117.md`.
- **Q12 C2:** PDF tem diagrama de Lund–Browder e tabela de área queimada; uma cópia do F&O encurta referência essencial à imagem. **Q81/Q82:** PDF referencia imagem clínica dermatológica e radiografia; ambos os registros de cada item têm `blocks=[]`. Exigir vinculação documentada de mídia, sem liberação automática.
- **Q40/Q42/Q44/Q45/Q49/Q51/Q74/Q90:** tabelas e resultados numéricos referidos no PDF aparecem com reestruturação narrativa e/ou omissão relativa em cópias. **Q18/Q29:** grafia técnica/aspas; demais variações incluem informações clínicas/contextuais. Não presumir que uma versão esteja correta sem confronto total.
- Auditoria do esquema F&O: **483/483 `blocks` vazios, 483/483 `source_hash` nulos, 483/483 `competencies` vazias, 223/483 `source_page` nulos**. Por fonte: regular C1 100 páginas ausentes, regular C2 123, reaplicação C1 zero. Não afirmar que mídia inexiste em toda a plataforma a partir da coluna `blocks`.
- Comparação SQL adicional confirmou: 57 diferenças brutas em enunciado de 200 posições duplicadas, 31 após remoção de espaços, **22 após remoção adicional de pontuação**. As 2 variações brutas de alternativas desaparecem ao retirar espaços; isso **não** comprova revisão integral das alternativas contra PDFs.
- Criado `scripts/tests/enamed-text-variants.test.mjs`, incluído no workflow `verify-enamed-contracts.yml`. Teste valida a rastreabilidade de 22 IDs e o bloqueio de aplicação, não qualidade clínica. Resultado do CI deve ser interpretado por commit/HEAD.
- A execução anterior do HEAD `af46a4f...` concluiu workflows TypeScript, ENADE e ENAMED com `success`; a revisão atual tem novos commits e exige revalidação.
- **Homologação por perfil:** roteiro dos 16 cenários sintéticos preparado anteriormente, mas nenhuma sessão autenticada real de Master/Reitoria/CPA/Coordenação/NDE ou outro tenant foi executada. Não ampliar acesso por menu; manter exigência de MFA e RLS.

### Decisão ADR-ENAMED-024
Quando a questão utiliza imagem/tabela para fornecer informação necessária à resolução, a equivalência das letras preliminares e do prefixo não basta para publicá-la como íntegra. A indexação longitudinal do Sapiens só pode usar uma versão do item com mídia, evidência, gabarito e competência aprovados por curadoria e rastreados. Preservar simultaneamente IDs e tentativas de versões históricas.

**Porta E1:** seguem pendentes cotejo integral 483/483, gabaritos definitivos e retificações, notas metodológicas e aceite normativo; E2/E3 não homologadas.


## 24. Atualização cumulativa v2.5 — rodada de três ações: 22 textos, 6 imagens e contratos (17/11/2026)
**Continuidade:** mantidas decisões E0/E1 e ADR-001 a ADR-024, a fila de curadoria da Issue #170, o corpus oficial dos oito PDFs 2026 e o bloqueio de gabarito definitivo. E1 segue sem homologação integral; E2/E3 preparatórias; E9 institucional futura.

### Ação 1 — Texto inteiro das cópias F&O e números
- SQL `SELECT` buscou `stem` e `alternatives` inteiros dos dois IDs para cada uma das **22 posições** divergentes do Caderno 2 regular. Relatório de dados individuais em `E1_22_VARIANTES_COMPARACAO_INTEGRAL_ENTRE_COPIAS.json`.
- **22/22 pares** preservam divergência no texto; **8/22** apresentam tokens numéricos presentes em uma cópia e ausentes na outra (**Q12, Q42, Q44, Q49, Q74, Q89, Q90 e Q99**). As alternativas das 22 duplas coincidem depois de normalização de espaços.
- A comparação integral é **entre duas versões cadastradas no F&O**; não foi realizado cotejo integral automatizado de cada versão com o PDF oficial nem julgamento da validade clínica dos números. A coincidência de gabaritos preliminares permanece uma verificação separada, não torna os itens homologados.

### Ação 2 — Identificação de mídias no PDF original
- Examinado PDF oficial REG-C2 (cópia SHA-256 já verificada) em páginas renderizadas. Para as 22 posições prioritárias, seis objetos de imagem rasterizada foram associados a regiões de questão, com página, coordenadas, `xref`, bytes e SHA-256 no arquivo `E1_ENAMED_22_MIDIAS_PDF_HASH_E_PAGINA.json`.
- **Q12** (Lund–Browder), **Q68** (radiografia de pelve), **Q81** (fotografia dermatológica), **Q82** (radiografia contrastada), **Q89** (tomografia abdominal) e **Q97** (ultrassonografia transvaginal). Estas seis exigem conferência e vinculação de imagem à questão antes de eventual uso pedagógico.
- Não concluímos que outras questões prescindem de mídias: tabelas vetoriais, desenhos, continuação em outras páginas e materiais de apoio não são detectados só por `xref`.
- Todas as 483 linhas F&O continuam com `blocks=[]`; isso não comprova ausência de mídia em outros storages do portal. Não houve importação de imagem ou alteração de Storage.

### Ação 3 — Novos testes e proteção operacional
- Novo `scripts/tests/enamed-e1-content-media-contract.test.mjs`, integrado ao workflow `verify-enamed-contracts.yml`, verifica 22 pares, 8 diferenças numéricas, seis mídias com hash/página e a manutenção do bloqueio de aprovação.
- Relatório integrador `E1_TRES_ACOES_TEXTOS_MIDIAS_CONTRATOS_20261117.md` acrescentado. Execução/resultado de CI deve ser verificada pelo SHA exato do commit; passar em contratos não significa homologar texto ou perfis.
- **ADR-ENAMED-025:** vinculação de mídia, grafia de números, unidades e intervalos é requisito documental por item para diagnóstico longitudinal. Mesmo quando alternativas/gabarito coincidem entre versões, um enunciado truncado ou uma imagem não vinculada impede a homologação de competência clínica. IDs, versões, histórico de tentativas e dados pessoais permanecem intocados.
- **Acesso por perfil:** matriz autenticada de 16 testes continua preparada, mas **não executada com sessões reais autorizadas**. Não confundir RLS inspecionada e testes SSR com garantia de isolamento.

**Status:** E1 parcialmente demonstrada, sem aceite integral, E2/E3 preparatórias, PR #168 draft, sem merge ou deploy. Nenhum DML, gabarito, aluno ou competência modificado em produção.


## 25. Encerramento objetivo v2.6 — auditoria técnica preliminar (17/11/2026)
A auditoria preliminar foi **ENCERRADA** com entrega de `TERMO_ENCERRAMENTO_AUDITORIA_PRELIMINAR_20261117.md` e `ENCERRAMENTO_8_DIVERGENCIAS_NUMERICAS_VERIFICADAS_20261117.json`. **Isso NÃO conclui E1, não homologa as questões nem publica PR #168**.
- Evidências encerradas: oito PDFs oficiais preliminares autenticados/hashados; 483/483 letras de gabarito PRELIMINAR concordantes; 200 posições regulares duplicadas; 17 questões candidatas a lacuna na reaplicação; 22 variantes textuais catalogadas, seis imagens hashadas.
- Conclusão desta rodada: **oito diferenças numéricas cotejadas com tokens observados no PDF oficial REG-C2**. Cópia `ENAMED-2026-REG-C2-QXXX` preserva os números observados para Q12,42,44,49,74,99; `enamed-2026-c2-qXX` para Q89,90. Isso identifica **candidato documental** somente; não determina a versão clinicamente aprovada.
- Permanecem efetivamente **BLOQUEADOS**, sem novas rodadas de triagem como substituto do aceite: cotejo integral de cada enunciado/alternativa/mídia com PDF, parecer médico/duas IAs, gabaritos DEFINITIVOS e notas metodológicas, sessões autorizadas reais de Master/Reitoria/CPA/Coordenação/NDE com MFA/RLS e isolamento multi-IES, ponte Sapiens e publicação.
**ADR-ENAMED-026:** quando o escopo auditável termina, registrar terminalmente CONCLUÍDO/PENDENTE/BLOQUEADO. Não chamar de concluído o produto, não inventar validações clínicas ou sessões reais, não abrir ciclos repetitivos. PR draft, nenhum banco de produção alterado.
