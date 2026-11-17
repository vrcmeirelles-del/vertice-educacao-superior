# BÍBLIA-MESTRA DO PROJETO — ENAMED 360° / INEP INTELLIGENCE
**Projeto:** Vértice Educação Superior × Fato & Ordem × Sapiens 360°  
**Versão:** 1.7 — E1 parcial + CI de integridade e fila formal de curadoria  
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
