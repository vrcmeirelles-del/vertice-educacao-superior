# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 020 — Primeiro Estúdio Docente implementado na navegação acadêmica
**Data local:** 2026-11-19 | **PR:** #207 (rascunho) | **Produção:** inalterada

### Orientação pedagógica e governança preservadas
Permanecem íntegros os adendos 001–019. O Estúdio é uma camada de experiência sobre os contratos de avaliação, não substitui a Construção Curricular, não fabrica competências e não publica automaticamente exames para estudantes. Curadoria pedagógica e autonomia do professor são a regra.

### Entregas em código
1. `source-overrides/client/src/lib/avalia360/Avalia360Studio.tsx`: tela docente de autoria de provas com seleção de curso, disciplina, título, semestre, finalidade predominante, inclusão e exclusão de várias questões, objetivas com alternativas/gabarito, discursivas com rubrica, dificuldade estimada 1–5, pontuação, anexos de imagens e prévia editorial do caderno.
2. A prévia renderiza as imagens locais no lugar adequado: enunciado, alternativa correspondente ou material de apoio, com legenda e descrição. Não é ainda exportação PDF nem prova digital publicada.
3. O botão salvar utiliza `saveAssessmentDraft` e o fluxo autorizado `uploadQuestionImage`, com verificação de assinatura, SHA-256, ticket privado, confirmação e revisão numérica para evitar sobrescrita silenciosa. Se Auth/MFA/Storage não estiverem disponíveis, o formulário mostra falha e não declara sucesso.
4. O professor pode consultar o rascunho salvo informando ID, curso e disciplina; a RPC devolve snapshot em modo consulta, sem inventar acesso direto às URLs privadas. Editar o snapshot recuperado com anexos exige camada de reidratação da mídia, ainda pendente.
5. `source-overrides/client/src/components/area/Workspace.tsx`: o Estúdio foi ligado como subvisão de **Acadêmico → Discursiva 360° → Avalia 360° · Estúdio**, acessível somente aos perfis diferentes de leitor; a Discursiva 360° anterior permanece. A rota independente e o módulo comercial ainda não foram criados.
6. `draft-api.ts`: a RPC passa a incluir `meta:{title,semester,purpose}` no payload, e `RASCUNHOS_RPC_STAGING_V1.sql` versão PR grava esses metadados no snapshot e em eventos de revisão. Código novo da migração NÃO foi aplicado à branch Supabase pausada.
7. `draft-api.spec.ts`: cenário de teste sobre persistência dos metadados preparado.

### Metodologia da primeira avaliação
- Selecionar curso/IES e disciplina a partir de contexto institucional já autenticado.
- Informar título, semestre e finalidade.
- Cadastrar uma questão objetiva ou discursiva e definir pontuação/dificuldade.
- Inserir imagem no enunciado/alternativa/apoio com direito de uso e descrição.
- Visualizar a prova antes de enviá-la.
- Salvar e consultar rascunho versionado.
- Vincular ao PPC/competências **somente quando o catálogo real tiver sido preenchido/validado**.
- Homologação do parecer, emissão de PDF, QR/OMR, correção e devolutivas permanecem etapas posteriores.

### O que está pronto vs. o que depende de homologação
- **Implementado no GitHub (PR #207):** a interface e sua integração em código à área acadêmica.
- **Não publicado:** página ainda não está disponível em `verticesuperior.com.br`; não há merge/deploy.
- **Backend**: a branch isolada `eagkkkclfcedzanuqckj` permanecia `INACTIVE` e com erro agregado `FUNCTIONS_FAILED` ligado à função PDF de 35,78 MB; Auth e Storage HTTP reais não foram homologados.
- **Acervo curricular**: o esquema consultado não possuía construções curriculares publicadas. A interface indica o diagnóstico de aderência como pendente, sem inventar mapeamento.
- **Validação de UI**: renderização real com login, navegação, upload e reabertura no navegador não comprovada.

### Próximos critérios de aceite
- [x] Tela de autoria de avaliação e prévia visual em código.
- [x] Integração de navegação sem substituir a Discursiva 360°.
- [x] Contrato de salvar/consultar preparado.
- [ ] Compilação e testes atualizados com SHA do último commit verificados.
- [ ] Tela homologada visualmente em navegador de staging.
- [ ] Catálogo por competências real com PPC publicado; professor escolhe temas do catálogo.
- [ ] Reabertura editável com imagens privadas e suas URLs autenticadas.
- [ ] Autenticação e upload reais em Supabase de homologação.
- [ ] Exportação diagramada e submissão para curadoria.
- [ ] Aprovação pedagógica, publicação controlada e testes de produção.

**Regra:** código implementado NÃO significa serviço publicado; não atribuir nota ou parecer de aderência antes de fonte curricular validada.

### Evidência após a integração da tela
- GitHub Actions **#44651373137**: **65 testes unitários + 20 testes PostgreSQL (PGlite) aprovados**, com verificação TypeScript isolada do Avalia 360° concluída com sucesso.
- Evidência: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44651373137
- O pipeline TypeScript global/Aprendizagem Conectada da mesma rodada aparece como `cancelled`, não como aprovado; não usar o teste isolado como prova da compilação do portal integral.
- O Estúdio está **integrado em código**, mas não publicado nem homologado em navegador; a branch de homologação Supabase permanece pausada.
