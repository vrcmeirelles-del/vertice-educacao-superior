# BÍBLIA-MESTRA · VÉRTICE AVALIA 360°
## Adendo técnico cumulativo 003 — Catálogo Institucional de Temas e Pré-requisitos
**Data:** 2026-11-19 | **PR:** #207 (rascunho) | **Situação:** código e testes escritos, homologação pendente

### Preservação integral dos adendos 001–002
Motor algorítmico determinístico antes da interface; autonomia docente; separação de dificuldade estimada e observada; progressão interdisciplinar; adaptador estrito para Construção Curricular; nenhum acesso a dados reais, deploy ou mudança em produção.

### Leitura técnica adicional do repositório
- `supabase/migrations/202610300001_area_real.sql`: identidade institucional e de curso, helpers de permissão e proteção por instituição, com MFA/AAL2.
- `supabase/migrations/20261105010000_rbac_11_profiles.sql`: amplia perfis de acesso, restringe coordenador/NDE ao curso e declara `vertice_private.can_read_course`.
- `supabase/migrations/20261107223000_learning_connected_cpf_bridge.sql`: aprendizagem conectada utiliza esquema privado e tokens HMAC institucionais; não reaproveitar dados individuais na nova camada pública.
- `supabase/migrations/20261107231000_learning_mapping_and_calendar.sql`: vinculações de aprendizagem exigem validação documental e credenciais privilegiadas.
Esses arquivos descrevem estruturas de código, **não comprovam quais migrações estão aplicadas na produção**.

### Código criado
- `source-overrides/client/src/lib/avalia360/institutional-catalog.ts`
- `source-overrides/client/src/lib/avalia360/institutional-catalog.spec.ts`

### Contrato de dados proposto
`CatalogContext` (instituição, curso, ID e versão de matriz), `TopicNode` (tema/subtema e tema-pai), `CompetencyPlacement` (competência/período), `CompetencyEdge` (relações de pré-requisito, aprofundamento ou interdisciplinaridade).

Somente registros com estado `validated` são projetados no grafo. As demais relações permanecem fora das inferências. Referências entre instituições, cursos ou matrizes são rejeitadas; períodos inválidos e ciclos de subtema/pré-requisitos são sinalizados.

### Restrições institucionais para a próxima etapa
1. Não assumir que o catálogo já existe no banco; nenhum SQL ou tabela foram implantados.
2. Antes de gerar migração, conferir o estado efetivo do Supabase, políticas RLS, dependências de curso e permissões por docente/NDE.
3. Integridade interinstitucional deve ser garantida no banco por chaves compostas, além das validações em TypeScript.
4. Informações sobre conteúdo, plano de ensino, versão do PPC e exame externo precisam de fonte, responsável pela validação e vigência.
5. Registro de tema não implica competência demonstrada; indicadores só serão produzidos com evidências de avaliação apropriadas.
6. A assinatura `fingerprint` do motor atual é JSON determinístico simples, não hash criptográfico e não é evidência de integridade.
7. Os arquivos de testes ainda precisam ser executados no ambiente do repositório.

### Próxima entrega
Preparar e validar o contrato de persistência multi-IES, com restrições de escopo por curso e matriz e revisão de RLS, em ambiente isolado; depois integrar a leitura ao adaptador e ao motor com fixtures reais autorizadas.

### Critérios de aceite
- [x] Código do catálogo na branch isolada
- [x] Testes escritos para escopo, hierarquia, períodos e ciclos
- [x] Inspeção estática das migrações e helpers existentes
- [ ] Execução comprovada da suíte de testes
- [ ] Validação de estado real do Supabase
- [ ] Migrações e políticas RLS auditadas
- [ ] Homologação pedagógica com PPC, questões e usuários de teste
- [ ] Merge, deploy e homologação operacional

### Estado geral
**Projetado + implementado em código**, não integrado ou homologado. Nenhuma afirmação de funcionamento na plataforma publicada.
