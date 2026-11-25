# Metas e indicadores — diagnóstico e plano (25/11/2026)

## Diagnóstico (produção, só leitura)

- **UNITOP:** 901 metas, todas por curso e em "planejada".
  - Cada meta corresponde a uma solicitação documental do Reconhecimento, com a fórmula de checklist ("100 × itens aplicáveis concluídos e conferidos ÷ total").
  - Indicador, fórmula, fonte, alvo, prazo e responsável estão preenchidos.
  - Não há linha de base, vínculo com o PDI, medição nem ação 5W2H.
- **Vínculos:**
  - oito tabelas apontam para a meta com chave estrangeira;
  - na UNITOP só o Repositório está em uso (901);
  - três chaves estavam sem índice: ações 5W2H, propostas do Conecta e objetivos do planejamento;
  - três campos de meta estavam sem chave: planos do Sapiens, trilhas e planos de extensão.
- **Algoritmo:** o progresso é calculado no portal (`goalProgress`, em `lib/area.ts`), mas só a partir de medição lançada por pessoa. Nenhuma rotina media as metas.

## Plano

| Item | Situação |
|---|---|
| 1. Medição automática das metas de checklist (`meta-checklist-v1`), rotina diária `vertice-metas-medicao-diaria` às 06h37 UTC | **Em produção** (25/11/2026). Migração `20261125190000` aplicada; primeira medição: 901 metas, todas 0% |
| 2. Três índices e chaves estrangeiras nos campos de meta soltos (gatilho para a lista de metas dos planos de extensão) | **Em produção**, na mesma migração |
| 3. Metas institucionais ligadas ao PDI e ações 5W2H ligadas às metas | Decisão da gestão: cadastro de metas institucionais e do programa do PDI |
| 4. Regra na Automação 360°: meta sem medição no período da sua frequência | Regra `goal.unmeasured` (`2026.11-goals.1`), lida pelo leitor de planejamento: metas abertas com medição atrasada para a própria frequência, fora as de checklist. **Em produção** (25/11/2026): migração `20261125200000` aplicada; executor `2026.11-executor.6` publicado |
