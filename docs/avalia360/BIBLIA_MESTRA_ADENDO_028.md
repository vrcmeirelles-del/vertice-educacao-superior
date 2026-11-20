# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 028 — Construção Curricular como fonte única de competências
**Data:** 20/11/2026 | **PR:** #207 (em desenvolvimento)

### Decisão do professor
Os campos **Competências esperadas e períodos de origem** pertencem à **Construção Curricular**, não precisam ser recadastrados individualmente no Avalia 360°. O Estúdio deve importar competências do curso/disciplina selecionado e preservar a origem e a versão da matriz.

### Evidência da base e lacuna
- A base oficial usa `vertice_app.curriculum_builds`, `vertice_app.curriculum_competencies` e `vertice_app.curriculum_discipline_links`.
- A tabela de competências possui código, título, descrição e vínculos por disciplina, **mas ainda não possui período de origem nem status de validação do período**.
- O cadastro de período deve ocorrer na Construção Curricular e ser validado por responsável pedagógico autorizado, sem inferi-lo da posição da competência ou da série da disciplina.

### Implementação em código (não publicada no portal oficial)
1. `CurriculumBuilder.tsx`: campo **Período de origem** em cada competência; períodos recém-informados entram como **propostos**. A rotina de salvamento foi adaptada para preservar IDs de competências existentes, em vez de apagar e recriar todos os registros a cada edição. Essa mudança exige homologação de RLS, concorrência e versionamento de matrizes publicadas antes de produção.
2. `curriculum-import.ts`: importa apenas competências vinculadas ao curso, disciplina e versão de matriz publicada; confere escopo da IES, códigos duplicados, títulos, períodos ausentes e status de validação. Não inventa período ou competência.
3. `curriculum-import-api.ts`: leitura autenticada das tabelas institucionais, sem editar registros, dependente das permissões do servidor e das novas colunas do banco.
4. `Avalia360Studio.tsx`: botão **Importar competências da Construção Curricular**; na demonstração pública, o botão usa **dados inteiramente fictícios**, sem acesso à base real. A importação preserva a versão da matriz, substitui a lista de competências da avaliação e limpa vínculos incompatíveis de questões anteriores.
5. `PedagogicalParameters.tsx`: competências importadas ficam somente leitura no Avalia; edição de código, descrição e período deve ser feita na Construção Curricular. Os vínculos de cada questão continuam selecionáveis.
6. `draft-api.ts`: a origem e a versão da matriz podem acompanhar os metadados do rascunho, sem apresentar períodos propostos como homologados.
7. `curriculum-import.spec.ts`: casos de matriz de outra IES/curso, período ausente, status proposto, disciplina sem vínculo e período validado.
8. `CURRICULUM_ORIGIN_PERIOD_STAGING_CANDIDATE.sql`: **migração candidata**, ainda não aplicada a qualquer banco. Adiciona `origin_period` e `period_status`, sem preencher dados retroativamente.

### Critérios pendentes antes de produção
- [ ] Revisar, testar e aplicar migração somente em staging autorizado.
- [ ] Implementar validação institucional dos períodos (AAL2, papéis, trilha de aprovação e imutabilidade de versões publicadas).
- [ ] Testar RLS, edição concorrente, versões e preservação de IDs em Construção Curricular.
- [ ] Homologar a consulta autenticada por docente de curso/disciplina.
- [ ] Integração de matrizes oficiais e catálogos de temas/subtemas validados, sem uso de dados fictícios.
- [ ] Validar experiência do professor na prévia e depois publicar o fluxo no site oficial.
- [ ] Não apresentar PPC como homologado apenas porque uma matriz consta como publicada.

**Os adendos 001–027 permanecem integralmente vigentes.**
