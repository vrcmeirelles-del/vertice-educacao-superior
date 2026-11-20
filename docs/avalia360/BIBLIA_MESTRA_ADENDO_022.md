# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 022 — Painel dos parâmetros do algoritmo publicado na prévia
**Data local:** 2026-11-19, após 23h | **Escopo:** prévia demonstrativa separada da produção.

### Lacuna identificada pelo professor
A primeira prévia mostrava autoria de questões, imagens e caderno, porém não disponibilizava os campos do contrato `longitudinal-engine.ts`: período atual, dificuldade-alvo, competências exigidas, temas exigidos, relações longitudinais e mapeamento por questão. Esta ausência prejudicava a inspeção pedagógica do Avalia 360°.

### Implementação
- `PedagogicalParameters.tsx`: painel com período do curso, dificuldade-alvo, foco externo (OAB, ENADE, ENAM, ENAMED, residência, ENEM, CFC, carreiras), cadastro **declarado** de competências com código/título/período, temas/subtemas e período, seleção de requisitos de cobertura, relações explícitas de pré-requisito/aprofundamento/interdisciplinar e vinculação individual às questões.
- `declared-analysis.ts`: adaptador entre metadados docentes declarados e o motor determinístico `analyzeAssessment`, com todos os itens marcados `evidence='declarada'`. Não analisa semântica do enunciado, não atribui nota e **não considera os dados homologados pelo PPC**.
- `Avalia360Studio.tsx`: seção 3 **Parâmetros para análise longitudinal**, botão **Analisar metadados declarados**, devolutiva sobre número de questões, pontuação, dificuldade estimada, cobertura e alertas. A seção de revisão/salvamento passa a ser a 4.
- O mock da prévia armazena `declaredPedagogy` no metadata do rascunho local, junto ao título e semestre. Não há publicação nem importação para a produção.
- `declared-analysis.spec.ts`: testes de cobertura e lacunas sem alegação de verificação curricular.

### Evidências de publicação
- GitHub Actions `#44660127689`: **67 testes unitários e 20 PostgreSQL (PGlite)** aprovados.
- Render serviço `vertice-avalia360-homolog`, build/deploy **`dep-dbvqtgrm8hqs738nldcg`** apontando ao commit **`fd5fffbb87b412ae5b18983a925b649334ad56b8`**; status **`live`** em **2026-11-20T02:22:22.298114Z**.
- URL: https://vertice-avalia360-homolog.onrender.com
- Auto deploy desativado, produção Vértice intocada.

### Limites
- Esta é uma análise **estrutural e preliminar de dados docentes**. O cadastro de exemplos na prévia não é uma matriz de PPC institucional verificada. Relações não são evidência de efetividade da aprendizagem.
- A análise real com referências institucionais requer publicar/conectar o PPC aprovado, recuperá-lo por API autorizada e aplicar a cadeia de validação de período, tema e competência.
- Os gráficos/indicadores de desempenho com respostas efetivas, psicometria, exportação de prova, QR e correção final permanecem pendentes.
- O mock usa apenas `localStorage` do navegador e não se comunica com Supabase, WhatsApp, Fato & Ordem ou Render DB.
