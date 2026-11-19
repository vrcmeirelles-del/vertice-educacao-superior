# BÍBLIA-MESTRA · VÉRTICE AVALIA 360°
## Adendo técnico cumulativo 004 — Estado real do Supabase e proposta de persistência
**Data:** 2026-11-19 · **PR:** #207 (rascunho) · **Estado:** proposta SQL versionada, NÃO executada.

### Decisões preservadas
Adendos 001–003 permanecem vigentes: motor determinístico primeiro; catálogo curricular longitudinal em versões; competências, temas e pré-requisitos validados; autonomia docente; nenhuma alteração silenciosa de nota/prova; compatibilidade com Fato & Ordem, Sapiens 360° e Planejamento Estratégico; sem publicação não homologada.

### Evidências diretas no Supabase (consulta de esquema, somente leitura)
Projeto conectado: `vertice-educacao-superior`. As tabelas `curriculum_builds`, `curriculum_competencies`, `curriculum_discipline_links` **existem em `vertice_app`, não em `public`**. Consultas a `information_schema.columns`, `pg_policies`, `pg_constraint` e `pg_class` confirmaram:
1. `vertice_app.curriculum_builds`: ID, institution_id, course_id, version, status, graduate_profile, DCN, referência documental e metadados.
2. `vertice_app.curriculum_competencies`: competência ligada a build_id por chave estrangeira.
3. `vertice_app.curriculum_discipline_links`: vínculo de disciplina ligada a competência por chave estrangeira.
4. RLS habilitado nas três tabelas.
5. A migração de permissões das tabelas curriculares usa `vertice_private.can_read_institution` em policies denominadas *write*, potencialmente mais abrangentes que o escopo docente/coordenação esperado. **É um risco a revisar, não uma exploração demonstrada.**
6. Não foi encontrado `vertice_private.can_read_course` entre os helpers consultados. Não pressupor que permissões de curso estejam aplicadas como planejadas no repositório.
7. `vertice_app.courses` é distinta de `public.vertice_courses`; contratos de ID precisam permanecer ancorados na fonte efetiva.

Correção do Adendo 003: **a ausência das tabelas em public não significava ausência no projeto**. A busca ampliada confirmou sua presença em vertice_app.

### Novo artefato
`docs/avalia360/sql/CATALOGO_PERSISTENCIA_V1_REVISAO.sql`

Trata-se de **SQL para revisão e homologação futura**, não de uma migration incluída na execução automática. Propõe:
- Esquema `vertice_avalia` sem privilégios de leitura/escrita direta para anon/authenticated.
- Versionamento do catálogo vinculado à matriz `vertice_app.curriculum_builds`.
- Referências de temas/subtemas, atribuições de período e grafo de pré-requisitos.
- Integridade de pertença ao mesmo catálogo e à mesma matriz por chaves compostas, FK e trigger de validação.
- Triggers preventivos de alteração de instituição/curso/build/versão no catálogo.
- RLS habilitado sem policies para acesso direto aos usuários; acesso apenas de serviço autorizado.
- Parâmetros de fonte, validação humana, e vínculo à edição correta do currículo.

### Riscos e exigências anteriores à migração
- O desenho RLS é *default deny*, mas uso de service_role em serviços exige autorização rigorosa de chamadas, escopo por instituição e curso, logs e proteção da chave.
- Verificar na configuração real da Data API que `vertice_avalia` não está exposto.
- Validar compatibilidade SQL em staging sem dados pessoais, incluindo CREATE, INSERT, UPDATE, constraints, trigger e rollback.
- Investigar status das policies curriculares existentes; **não expandir acesso de escrita com esta PR**.
- Uma migração oficial deverá ser gerada pelo fluxo da equipe (CLI e revisão de migrações), somente após staging.
- O banco proposto não implementa sozinho detecção de ciclos em grafos; o algoritmo do catálogo deve validar o grafo antes da homologação. Avaliar imposição adicional no backend/banco.
- Semântica do texto, grau real de aprendizagem e qualidade de prova não podem ser inferidos apenas a partir dos metadados.
- Comprovantes de execução/testes automatizados e homologação ainda não existem.

### Checklist do Adendo 004
- [x] Inspeção direta do esquema efetivo, relacionamentos e RLS curricular.
- [x] Identificação de divergência entre código de migração e banco efetivo.
- [x] Proposta de persistência revisável registrada em branch.
- [ ] SQL executado e aprovado em ambiente isolado.
- [ ] Análise de autorização por perfil concluída.
- [ ] CI do motor/adaptador/catálogo executado e aprovado.
- [ ] Integração com dados curriculares reais autorizados.
- [ ] Homologação institucional.
- [ ] Merge ou deploy (não realizado).

### Próxima entrega
Montar ambiente isolado de testes, executar a suíte e preparar a aplicação controlada do catálogo. Depois, implementar um gateway autenticado com autorização por instituição, curso e perfil para conectar o formulário docente às estruturas existentes.
