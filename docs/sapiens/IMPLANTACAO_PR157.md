# Implantação autorizada da PR #157

Em 16/11/2026, o usuário autorizou integrar a PR, aplicar a migração ao Supabase existente e publicar a atualização do Sapiens nos serviços atuais. A referência funcional corrigida é o commit 4eb9b1d052c7967959b67c8b2247221f96cc2933.

## Verificações concluídas

- 57 testes locais aprovados: 47 de lógica/interface/regressões e dez PostgreSQL/PGlite.
- TypeScript e build estático aprovados, inclusive na composição com a main 3831ddb0c6a185f2f2816e0a6ce72c218407ef8b.
- SQL aplicado com sucesso: migração planning_interpretation_traceability, versão 20261116074720.
- SHA-256 do SQL: d975f6750ca56bc6405297fe2df1d802f9d5b619d8ddfb86f7b39412217e0f0a.
- O nome do arquivo SQL foi conciliado com a versão efetivamente registrada pelo executor. Nenhuma migração antiga foi reaplicada ou teve seu histórico artificialmente marcado.
- Contagens antes/depois preservadas: um planejamento estratégico, zero semestrais, 908 metas, 12 medições e sete ações. Nenhum vínculo objetivo-meta foi criado por esta implantação.
- RLS ativa na tabela nova; sem leitura direta pelo navegador e sem execução anônima da RPC. Solicitações sem sessão e sem vínculo foram recusadas em transação com rollback no banco existente.
- Contexto operacional escolar preservado na função instalada.
- Função existente vertice-sapiens-analyze atualizada da versão 6 para a 7, ACTIVE, preservando verify_jwt=true. index.ts coincide com a versão anterior; planning.ts e interpretation.ts contêm a evolução revisada.
- Definições/ACLs anteriores e pacote Edge anterior capturados para recuperação. Baseline dos portais: dep-dbtb1nuq1p3s73fmv62g e dep-dbtb1nuq1p3s73fmv5v0, ambos no commit 3831ddb.

## Publicação dos portais

Integração e acompanhamento dos deploys em andamento. Os serviços existentes vertice-portal e vertice-educacao-superior acompanham a main e mantêm sua política de publicação automática. Banco e Edge foram preparados antes do merge para evitar disponibilizar uma interface dependente de objetos ausentes. Nenhum serviço, banco ou repositório paralelo foi criado.

## Limites de homologação

As sondagens de autorização exercitam funções reais do banco com claims controladas e rollback; não são homologação de sessões reais de todos os perfis. Provedores reais, latência, volumes institucionais e revisão completa pelo usuário ainda precisam de evidência. O acesso continua manual, por solicitação de usuário autorizado e MFA; esta entrega não acrescenta chave de ativação por IES/curso nem execução agendada de pareceres.

Não há publicação automática de decisões gerenciais, aprovação automática de evidências, PDI estruturado ou deliberação automática. A captura da baseline prepara a recuperação, mas não é apresentada como ensaio completo de rollback dos serviços em produção.
