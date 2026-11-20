# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 017 — Branch Supabase autorizada e recuperação de migrações
**Data local:** 2026-11-19 (20/11 UTC) · **PR:** #207, rascunho

### Preservação
Todos os requisitos dos adendos 001–016 permanecem válidos: motor longitudinal curricular, formulário, imagens com hash/legenda/acessibilidade/direitos, rascunhos versionados, autonomias docentes, integrações Fato & Ordem/Sapiens e correções futuras.

### Autorização financeira e criação reais
- O usuário autorizou expressamente o valor **US$ 0,01344 por hora** de branch Supabase.
- A confirmação de custo foi registrada na plataforma e a branch `avalia360-homologacao-20261119` foi criada.
- Branch ID de gerenciamento: `6b667b1c-92a6-44e5-85ee-e239ef24b41e`.
- Projeto branch: `eagkkkclfcedzanuqckj`.
- Projeto de produção, intocado: `qvetbbmviatxxatzzuzc`.
- Branch criada sem cópia de dados de produção (`with_data=false`).

### Estado encontrado na homologação
A branch passou ao estado `MIGRATIONS_FAILED`. Consultas SQL confirmaram que não existem `public.vertice_courses`, `vertice_app.curriculum_builds` nem `public.vertice_learning_staff_scope` e que não havia migrações restauradas na branch. Portanto, a plataforma de origem e seus controles de autorização **não estão reproduzidos nessa branch**.

### Recuperação controlada
A ação `reset_branch` foi executada uma única vez e retornou `success=true`. Na inspeção imediata seguinte, a branch voltou a `CREATING_PROJECT`, ainda com zero migrações e sem as tabelas essenciais. A recuperação não pode ser considerada concluída até inspeção posterior.

### Regras de segurança
- Não executar os scripts Avalia 360° sobre um Supabase desprovido da estrutura de autorização da Vértice.
- Não criar usuários ou dados institucionais artificiais na produção.
- Não fazer merge da branch nem publicar funções sem restauração íntegra, revisão RLS/grants e testes autenticados.
- A criação da branch autorizada iniciou um recurso potencialmente cobrado por hora. Avaliar encerramento se o reset falhar e não houver plano viável de recuperação, evitando custo inútil.

### Evidências anteriores preservadas
GitHub Actions #44641929603: 60 testes unitários e 18 testes PostgreSQL isolados aprovados. São testes sintéticos; não representam execução Auth/Storage real.

### Pendências e próximos passos
- [x] Custo explicitamente autorizado e confirmado.
- [x] Branch criada sem dados de produção.
- [x] Falha de restauração identificada e registrada.
- [x] Um reset controlado solicitado.
- [ ] Confirmar estado final do reset e contar migrações restauradas.
- [ ] Diagnosticar discrepância entre migrações versionadas e banco da origem.
- [ ] Apenas depois aplicar RPC/bucket/Edge Function no ambiente isolado.
- [ ] Upload de imagem real com JWT/MFA por docente e validação multi-IES/curso.
- [ ] Homologação de prova real com PPC e imagens e publicação controlada.
