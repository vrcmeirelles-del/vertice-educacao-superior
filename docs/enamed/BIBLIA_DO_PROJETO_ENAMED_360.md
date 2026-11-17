# BÍBLIA DO PROJETO — ENAMED 360° · Inteligência da Formação Médica
**Vértice Educação Superior × Fato & Ordem × Sapiens 360°**

- **Identificador:** VERTICE-ENAMED-360
- **Versão:** 1.0.0 — arquitetura e plano-mestre
- **Data-base:** 16/11/2026
- **Estado:** planejamento estruturado e protótipo em PR #168; **não homologado em produção**
- **Issue central:** #167
- **Política de atualização:** documento vivo, versionado, incremental, sem reescrever retrospectivamente fatos ou eliminar decisões
- **Escopo deste ciclo:** **infraestrutura genérica multiesinstitucional e taxonomia**. NÃO importar ou avaliar resultados reais identificáveis de IES neste ciclo.

> **Princípio soberano:** o INEP governa as regras oficiais de cada edição; Fato & Ordem governa o banco de itens e a aprendizagem; Vértice governa a instituição, o currículo e as evidências; Sapiens propõe diagnósticos e intervenções, sob validação humana.

## LIVRO I — Visão, propósito e limites

### Capítulo 1 — Problema a resolver
Criar um percurso único, por estudante e por curso, capaz de correlacionar evidências de desempenho em **ENAMED**, **itens históricos pertinentes do ENADE** e **Residência Médica**, sem:
1. confundir provas ou duplamente contar o ENAMED (modalidade específica de avaliação da Medicina no ENADE);
2. tratar simulado interno como nota TRI ou conceito oficial;
3. somar percentuais não equivalentes sem calibragem;
4. inferir conceito da instituição a partir de dados de estudante;
5. transferir dados nominais entre IES ou usar informação restrita sem fundamento e autorização;
6. presumir que todos os registros já possuem validação INEP, competências oficiais ou classificação médica homologada.

**Produto:** observatório documental INEP + matriz normativa versionada + indexador de questões + motor longitudinal + diagnóstico pedagógico Sapiens + planos de ação + trilhas de auditoria e homologação.

### Capítulo 2 — Experiência por ator
- **Master Vértice:** controla versões da matriz, conectores, catálogos oficiais, testes, modelos e auditorias globais, sem acesso indiscriminado a dados nominais além de base jurídica e necessidade funcional.
- **Reitoria/direção:** indicadores agregados, ciclos, risco regulatório fundamentado, metas, comparativos pertinentes, evidências e restrições metodológicas.
- **Coordenação de Medicina/NDE:** diagnóstico por turma/período/competência, currículo e internato, intervenções, relatórios e aprovação.
- **Docente/preceptor:** somente turmas/competências autorizadas, devolutivas com suporte pedagógico.
- **Estudante:** suas respostas, domínio estimado por competência, atividades recomendadas e evolução longitudinal.
- **Analista/editor médico:** comparação com provas, revisão de temas/subtemas/gabarito, pareceres e rastreabilidade de validação.

### Capítulo 3 — Princípios imutáveis
- **INEP-first:** ato legal → instrumento/matriz → prova/gabarito → dicionário/microdados → indicador → intervenção; todos vinculados a edição e versão.
- **Fonte antes do número:** resultados sem documento verificável ficam “não homologados”, não viram zero.
- **Distinção de camadas:** oficial individual/restrito, oficial agregado/público, interno observado, estimado, sintético e sugerido pela IA.
- **Compatibilidade retroativa:** preservação de ENADE 360°, trilhas e dados históricos; evolução por migração aditiva e feature flag.
- **Uma identidade institucional:** reaproveitar cadastros, permissões, matrícula comprovada, vínculo de curso, RLS e logs existentes.
- **Uma origem por item:** banco F&O central. A Vértice guarda IDs e agregados autorizados, não cópias integrais indiscriminadas.
- **Human-in-the-loop:** IA propõe e justifica; pessoa autorizada homologa tema/gabarito e ação de gestão.
- **Sem clínica automatizada:** diagnóstico aqui significa avaliação pedagógica, não diagnóstico médico de paciente.
- **LGPD e finalidade:** segregação por tenant, curso e finalidade; consentimento quando aplicável, transparência, minimização, retenção e auditoria.

## LIVRO II — Hierarquia oficial do INEP e regras

### Capítulo 4 — Biblioteca normativa obrigatória
Registrar **a versão integral, vigência, edição-alvo, natureza, retificações, publicação, autoridade emissora, URL, hash SHA-256, data de coleta e parecer de vigência** de cada documento. Inventário inicial, **sujeito à conferência jurídica e documental completa**:
- Portaria MEC nº 330/2025 (marco de instituição do ENAMED).
- Portarias Inep nº 413/2025 e nº 478/2025 (execução e matriz, conforme escopo publicado).
- Portaria nº 780/2025 e Nota Técnica nº 40/2025 (Conceito Enade Medicina, confirmar versões e faixas).
- Notas técnicas complementares nº 19/2025, 1PL/2025 e 42/2025 (registrar escopo exato após obtenção).
- Medida Provisória nº 1.370/2026, se vigente na data e versão do exame; verificar conversão, alterações e efeitos temporais.
- Editais 49/2026, 71/2026 e 146/2026 e respectivas republicações (confirmar vigência, etapas, reaplicação e cronogramas).
- Manual explicativo do ENAMED, matriz completa, provas, gabaritos preliminares/definitivos, boletins e resultados.
- INEP ENADE histórico: matrizes, provas, gabaritos, microdados e dicionários por curso e edição.
- Residência Médica: edital, organizador, matriz e gabarito de **cada processo seletivo**, com domínio e direitos de uso próprios.

**Fontes de referência a verificar e versionar:**
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed
- https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/notas-tecnicas
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/resultados
- https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enamed
- https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade
- https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior/2025

### Capítulo 5 — Matriz normativa e indexação
Estrutura **a homologar confrontando literalmente os anexos oficiais**, não inferida de nomes de disciplinas:
- perfil médico e atributos;
- 15 competências da matriz, 12 avaliáveis em prova teórica segundo material do INEP consultado anteriormente — conferir texto e numeração exatos por edição;
- sete áreas de formação (Clínica Médica, Cirurgia Geral, Ginecologia e Obstetrícia, Pediatria, Medicina de Família e Comunidade, Saúde Mental, Saúde Coletiva);
- redes e contextos assistenciais, incluindo Urgência/Emergência **como contexto transversal**;
- conteúdos estruturantes e seus códigos;
- operação cognitiva efetivamente exigida pelo **comando**.

**Não codificar números, lista de competências, pesos ou faixas diretamente no frontend.** Guardar as normas em dados versionados, com validade por edição, exame e modalidade.

### Capítulo 6 — Regras de cálculo e separação de estimativas
**Nível 1: item e simulado interno.** Acerto bruto, tentativas, tempo, confiança, dificuldade observada, evolução, erro-padrão/incerteza; análise longitudinal com amostra mínima informada e sem equivalência presumida entre exames.

**Nível 2: proficiência oficial do ENAMED.** Usar exclusivamente a nota e classificação oficial disponibilizada pelo INEP ou reproduções metodológicas validadas com parâmetros suficientes; modelo Rasch/TRI não pode ser reproduzido apenas por contagem de acertos. Angoff, equalização e corte devem ter referência da edição.

**Nível 3: Conceito Enade Medicina.** Aplicar somente fórmula e faixas da nota técnica vigente na edição, respeitando universo válido, critérios de presença/elegibilidade, mínimo de casos, Sem Conceito e possíveis mudanças. A fórmula/proporção e as faixas divulgadas para 2025 **não constituem regra atemporal**.

**Nível 4: capacidade/risco pedagógico.** Índice próprio do Sapiens, apresentado como estimativa interna com método, amostra, grau de confiança, evidências e possibilidade de contestação; **nunca rotulado como proficiência oficial**.

**Proibição explícita:** não produzir, estimar, projetar ou sugerir notas oficiais individuais ou Conceitos Enade a partir de simulados sem requisitos metodológicos e documentação adequados.

## LIVRO III — Taxonomia mestre e banco de questões

### Capítulo 7 — Modelo de indexação obrigatório por item
Cada questão deve poder referenciar:
1. `source_exam` (ENADE histórico / ENAMED / Residência Médica);
2. `exam_year, edition, booklet, reapplication, question_number`, origem, versão, status do gabarito;
3. `source_url, source_file, source_page, source_hash`, direitos e condição de publicação;
4. área INEP oficial (quando aplicável), especialidade/subespecialidade editorial, disciplinas internas;
5. competência normativa primária e secundárias, codificadas por **matrix_version_id**;
6. atributos, contexto assistencial, conteúdo estruturante oficial;
7. tema, subtema, palavras-chave **clínicas controladas**, sinônimos e abreviaturas;
8. operação cognitiva (diagnosticar, interpretar exame, decidir conduta, prevenir, comunicar, etc.);
9. metadados cognitivos internos e eventual calibração (com origem e validade);
10. status de revisão (rascunho, triagem IA, divergência, validado humano, bloqueado, retificado);
11. vínculos curriculares a curso, componente, estágio/internato e período letivo, com validação institucional;
12. recibos de pareceres dual-IA, nomes/versões de modelos, hash do snapshot, revisão humana e trilha de decisão.

**Regra de ouro:** o tema representa o objeto clínico; o subtema representa o recorte de raciocínio/conduta cobrado; palavras-chave servem à recuperação e não substituem matriz/competência. O termo “Medicina” é metadado de módulo; “ENAMED 2026” é metadado de edição, não palavra-chave clínica.

### Capítulo 8 — Fotografia verificada do Fato & Ordem (consulta read-only 16/11/2026)
- `fo_enamed_items`: **483 registros**; 400 regulares (200 posições únicas de caderno/número duplicadas) e 83 reaplicação; não concluir automaticamente que todos sejam itens distintos.
- 483/483 com tema, subtema e keywords preenchidos; **483/483 com `competencies=[]`**; `taxonomy_area` só contém “Medicina”; 27 disciplinas distintas.
- 483/483 com ao menos uma keyword genérica `medicina` ou `enamed 2026`; 112 com alguma keyword curta (<4 caracteres, não erro automático; siglas médicas têm valor).
- 483/483 sem `source_hash`; 483 marcados `official_answer_status=definitivo`, a conferir com publicações oficiais de 2026.
- Outros acervos identificados: `fo_enade_items` **1.934 registros**; `fo_residencia_items` **200 registros**.
- Cinco exemplos analisados preliminarmente: C1 Q2 (epiglotite; tema manter), C1 Q10 (pós-hernioplastia; subtema precisa examinar comando), C2 Q1 (dor torácica; conduta imediata deve estar na indexação), C2 Q10 (hesitação vacinal; TEA pertinente como contexto secundário), C2 Q11 (crise vaso-oclusiva; tema/subtema apropriados). **Pareceres provisórios**, dependentes dos PDFs e revisão médica.
- Os dados consultados não comprovam homologação semântica dos 483 itens; NÃO modificar automaticamente a base.

### Capítulo 9 — Critério de auditoria semântica
Por questão:
- Correspondência com PDF íntegro: caderno, página, enunciado, ilustrações, alternativas, comando e gabarito;
- Revisão do status preliminar/definitivo, anulações e retificações;
- Validação da área/matriz e compatibilidade da competência com o comando;
- Revisão de tema, subtema e keywords com justificativa **e trecho de evidência**;
- Dupla análise independente (OpenAI e Anthropic já previstas no projeto), divergência e checagem humana por avaliador com competência médica;
- Preservação de IDs e tentativas; duplicados reconciliados por chaves documentais e relações existentes, não apagados indiscriminadamente.

**Taxonomia não pode ser inferida somente pela especialidade médica ou frequência de palavras.**

## LIVRO IV — Arquitetura de plataformas

### Capítulo 10 — Responsabilidades
**INEP Intelligence (camada comum da Vértice):** catálogo de normas, importação segura em staging, versionamento/hash, cálculo oficial onde reproduzível, indicadores agregados, histórico de retificação e rastreabilidade.

**Fato & Ordem:** questões, gabaritos, mídia, versões, temas, subtemas, keywords, metadados, simulados, tentativas, revisão editorial. O F&O é a fonte canônica do conteúdo pedagógico.

**Vértice:** vínculo IES/curso/período, Trilhas ENADE existentes, ambiente ENAMED especializado, documentos e indicadores oficiais, planejamento curricular, NDE, metas/ações 5W2H, BI e governança.

**Sapiens 360°:** diagnóstico da aprendizagem por competências, sugestão de intervenções, recepção de evidências, avaliação da evolução e apresentação transparente de incerteza; não modifica o banco automaticamente.

### Capítulo 11 — Integrações existentes a reaproveitar
- `source-overrides/client/src/components/area/Enade360.tsx`, `EnadeCross.tsx`, `TrailAnalysis.tsx`, `SapiensPanel.tsx`;
- `formation_trails`, `trail_question_links`, `v_trail_diagnostic`, construção curricular;
- `supabase/functions/vertice-learning-bridge/index.ts` e migração `20261112230000_learning_bridge_medical_modules.sql`;
- `docs/implementation/learning-medical-validation-20261113.md`, `docs/sapiens/REVISAO_TEMATICA.md`;
- PR #168 (interface inicial ENAMED, **draft**, não publicada); Issue #167 (integração de relatórios INEP).
Verificar contratos reais, migrações aplicadas, acesso em produção e CI, não apenas existência dos arquivos. Há prompt jurídico fixo (“curso de Direito”) em `TrailAnalysis.tsx` que precisa ser parametrizado antes de uso em Medicina.

### Capítulo 12 — Diagrama lógico de dados (proposta, não migração aplicada)
- `inep_documents` (id, url, hash, tipo, edição, publicação, retificação, vigência, status);
- `assessment_matrix_versions` (exam, edition, instrument_ref, effective_dates, hash, status);
- `assessment_competencies`, `assessment_contexts`, `assessment_contents`;
- `question_matrix_links` (fo_question_id, source_exam, matrix_version_id, competency_id, primary, confidence, evidence, reviewer_status);
- `official_course_results` (institution_id, course_inep_code, edition, metric, value, eligible_n, methodology_version, source_document_id, validation_status);
- `student_assessment_evidence` (institution_id, course_id, student_id/proven institutional mapping, source_exam, question_id, attempt_id, timestamp, correctness, status);
- `student_competency_snapshots` (institution_id, course_id, competency_id, period, sample_n, estimate, uncertainty, method_version);
- `pedagogical_intervention_links` (diagnosis_id, action_5w2h_id, reviewer, approval, evidence, post_measurement);
- `import_runs`, `model_review_receipts`, `audit_log`.

**Arquitetura física:** antes de criar novas tabelas, mapear entidades realmente presentes em Vértice e F&O para reutilização. IDs e esquemas acima são especificação lógica, não SQL homologado.

### Capítulo 13 — Segurança e operação
- Permissão Master/Reitoria/Coordenação/Docente/Estudante com RLS no banco, não apenas filtro no frontend;
- CPF e dados de saúde não entram no pipeline pedagógico por padrão;
- IDs de estudante só após conciliação formal e autorização; cuidado com coortes pequenas e reidentificação;
- operações de importação idempotentes e auditadas; hash e validação de schema antes de ingestão;
- segregação total entre IES, incluindo resultados, relatórios privados e ações;
- sincronização por eventos/incrementos, nunca apagar histórico por reimportação;
- atualização das matrizes e gabaritos provoca reprocessamento controlado, com identificação dos indicadores impactados;
- monitoramento de custos de IA, quotas, falhas e dependências de GitHub Actions/Render;
- métricas de confiabilidade: origem completa, gabarito validado, classificação validada, evidência de competência e revisão humana.

## LIVRO V — Formação, estudante e gestão

### Capítulo 14 — Diagnóstico do estudante
O mesmo estudante pode responder questões de ENAMED, ENADE histórico aplicável e Residência Médica. Guardar:
- desempenho **por origem** (nunca somar percentuais heterogêneos sem modelo válido);
- evidências comuns por competências e contexto;
- período do curso, currículo, disciplinas e internato;
- número de itens, dificuldade, tempo, repetição, acertos, incerteza e datas;
- resultados oficiais individuais somente quando autorizados e documentalmente disponíveis;
- metas de estudo sugeridas pelo Sapiens e homologação pelo docente/preceptor.

**Interpretação:** mostrar pontos fortes, lacunas, estabilidade, recomendações e limites de comparabilidade. Não fazer diagnóstico clínico, previsão oficial de proficiência sem lastro nem punição automática.

### Capítulo 15 — Gestão institucional
- Mapear competências ao PPC, DCNs vigentes, planos de ensino e internato;
- relatórios por curso, coorte, período, professor/atividade quando metodologia e permissões permitirem;
- alertas de cobertura curricular, lacunas recorrentes e não participação;
- plano de ação 5W2H para NDE/coordenação e vínculo ao planejamento estratégico do curso e planejamento semestral, separados;
- apresentação da metodologia dos indicadores, versão normativa, amostra, data e fonte;
- acompanhamento de antes/depois da intervenção com ressalva: melhoria temporal não prova causalidade.

### Capítulo 16 — Entrada futura de cada instituição (Fase posterior)
**Não executar agora.** Após plataforma genérica homologada:
1. cadastrar IES/curso pelo código e-MEC/INEP e conciliar identidade;
2. celebrar base de tratamento e autorização dos relatórios restritos;
3. importar resultados reais de UMA IES-piloto com validação em ambiente seguro;
4. confrontar indicadores oficiais e diagnósticos internos, estudar discrepâncias;
5. ajustar apenas regras genéricas justificadas, sem sobreajustar uma única IES;
6. homologar em cada nova IES com testes de segregação e trilhas de auditoria.
Dados reais da primeira faculdade serão apresentados posteriormente pelo responsável; nenhuma IES deve ser fabricada.

## LIVRO VI — Método cumulativo (“Bíblia”)
### Capítulo 17 — Ciclo obrigatório de escrita e implementação
Cada etapa é **capítulo cumulativo e um pacote verificável**:
1. **LER:** revisar Bíblia, changelog, artefatos, pendências, decisões e evidências da etapa anterior;
2. **CONFRONTAR:** verificar normas atuais do INEP, código publicado e dados existentes;
3. **APRIMORAR:** propor alteração motivada, impacto, compatibilidade retroativa e risco;
4. **EXECUTAR:** commit/migração/teste isolados em branch e PR, sem saltar gates;
5. **TESTAR:** unidade → integração → conteúdo → segurança → regressão → validação institucional;
6. **HOMOLOGAR:** parecer médico/editorial e aceite gestor conforme escopo;
7. **CONCATENAR:** atualizar Bíblia, matriz de rastreabilidade, ADR, changelog, pendências e próximo capítulo;
8. **PROSSEGUIR:** iniciar capítulo seguinte apenas com critérios do anterior cumpridos ou exceção documentada.
Nunca declarar “homologado” baseado em commit, teste com mocks ou HTTP 200.

**Contrato de encerramento de cada etapa:** versão, data, objetivo, fonte legal, código alterado, migração, dados afetados, testes/evidência, aprovação, bloqueios, riscos residuais, próximo passo e impacto em todos os módulos.

### Capítulo 18 — Conflitos e precedência
Em caso de divergência: norma vigente e documento oficial íntegro > metodologia/nota técnica > gabarito definitivo > revisão humana com evidência > pareceres IA > heurística por keyword. Para diagnóstico institucional, documento oficial da edição sempre identificado. Preservar divergências como histórico; não sobrescrever silenciosamente.

### Capítulo 19 — Definição de pronto
- Fontes INEP relevantes catalogadas com hashes e vigência verificadas;
- critérios oficiais de elegibilidade e cálculo testados por edição;
- taxonomia com competências e áreas oficiais preenchidas e validadas em todos os itens ENAMED abrangidos;
- itens duplicados reconciliados preservando histórico;
- ENADE e Residência conectados sem dupla contagem;
- Sapiens com evidência por competência e aprovação humana;
- ponta a ponta F&O → Vértice → Sapiens → Plano de Ação homologado;
- acesso por IES/curso comprovado; auditoria e relatórios reproduzíveis;
- testes automatizados, QA móvel/desktop, migrações e deploy verificados;
- Bíblia atualizada com o capítulo final e as evidências.

## LIVRO VII — Registros e links
- Plano cumulativo e gates: [PLANO_DE_TRABALHO.md](./PLANO_DE_TRABALHO.md)
- Auditoria inicial: [AUDITORIA_TAXONOMIA_20261116.md](./AUDITORIA_TAXONOMIA_20261116.md)
- Issue #167: https://github.com/vrcmeirelles-del/vertice-educacao-superior/issues/167
- PR #168: https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/168

## Registro de decisões (ADR simplificado)
- **ADR-001:** INEP é a fonte de verdade regulatória e metodológica; aprovada para a arquitetura, 16/11/2026.
- **ADR-002:** aproveitar Trilhas ENADE; ambiente ENAMED é especialização, não clone; aprovada para desenho, 16/11/2026.
- **ADR-003:** questões residenciais (Residência **Médica**) e ENADE histórico informam diagnóstico, com origem isolada e sem soma ingênua; aprovada para desenho, 16/11/2026.
- **ADR-004:** fase atual sem dados reais institucionais; piloto posterior, 16/11/2026.
- **ADR-005:** nem a revisão dupla das IAs nem a PR #168 constituem homologação médica/produtiva; 16/11/2026.

## Histórico cumulativo
- **v1.0.0 (16/11/2026):** abertura da Bíblia e plano; consolidação de histórico factual de banco F&O, regras, taxonomia, arquitetura e marcos de implantação. Nenhum dado real de IES importado.
