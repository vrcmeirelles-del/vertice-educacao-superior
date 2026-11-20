# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 009 — Verificação real do CI e execução isolada da suíte
**Data:** 2026-11-19 | **PR:** #207, rascunho | **Estado:** CI específico criado, execução ainda não comprovada.

### Preservação
Adendos 001–008 permanecem íntegros. O motor, catálogo, adaptador, preflight e formulário com imagens são código sob desenvolvimento, sem migração aplicada ou publicação.

### Evidências obtidas do GitHub Actions
Run do commit `1f05c319cafa00e4cea052371a25516151927b3e`:
- `Fonte única da Vértice`: success.
- `Verificar BI público da Vértice`: success.
- `Portal - TypeScript completo e contratos da Reitoria`: failure.
- `Validar BI permanência e reprovações`: failure.
- Logs dos dois jobs com falha mostram **TS2304: Cannot find name 'institutionId'** em `client/src/components/area/StudentAccessPortal.tsx(324,91)`. Esse arquivo não integra as alterações da PR #207; investigar em frente própria, sem ocultar a regressão.
- Os logs também demonstram testes aprovados em suites de planejamento e discursiva, mas **NÃO demonstram aprovação dos testes específicos do Avalia 360°**.
- Ausência de status combinados não equivale a aprovação de CI.

### Correção criada
`.github/workflows/avalia360-quality.yml` — workflow isolado executável por pull_request (mudanças no motor/configuração) e manualmente por workflow_dispatch. Instala dependências pelo `package-lock.json` de `source-overrides`, usando Node 22, e executa `npx vitest run client/src/lib/avalia360`.

### Critérios pendentes e próximos passos
- [x] Diagnóstico do CI geral baseado em logs reais.
- [x] Workflow específico do Avalia 360° versionado em branch.
- [ ] Execução e aprovação dos testes de motor, adaptadores, catálogo, formulários e mídia.
- [ ] Validação TypeScript e React/TSX dos arquivos novos.
- [ ] Corrigir regressão `StudentAccessPortal.tsx` em intervenção controlada, sem confundi-la com homologação do Avalia.
- [ ] Homologar SQL em ambiente isolado (não aplicar em produção).
- [ ] Implementar gateway de rascunhos com MFA, RBAC, armazenamento privado e versionamento.
- [ ] Testar ponta a ponta com prova interdisciplinar e imagens.

**Regra:** demonstrar aprovação com ID de execução, logs e SHA; não inferir a partir do arquivo de testes nem da existência de workflow.