# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 010 — Primeira evidência real de testes e portão TypeScript
**Data:** 2026-11-19 | **PR:** #207 (rascunho) | **Escopo:** apenas qualidade do código, sem alteração de produção.

### Preservação
Adendos 001–009 permanecem vigentes. O algoritmo longitudinal e as relações curriculares continuam sendo a referência central; formulário com figuras, correção objetiva e discursiva, Sapiens 360°, Fato & Ordem, psicometria e Planejamento Estratégico continuam no escopo da Bíblia.

### Evidência confirmada
GitHub Actions `44632882097`, workflow **Avalia 360 - Núcleo algorítmico**, executado com Node.js 22 / Vitest 2.1.9:
- 6 arquivos de teste concluídos com sucesso.
- 36 testes unitários concluídos com sucesso, zero falhas.
- Abrangência: catálogo curricular (6), adaptador curricular (5), pré-análise de escopo (7), motor longitudinal (4), formulário de questão/dados (8), mídia (6).
- Link: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44632882097
Isso NÃO significa homologação de navegador, persistência, segurança real de usuário, correção QR ou integração entre sistemas.

### Novo portão de qualidade registrado
- `source-overrides/client/src/lib/avalia360/tsconfig.json`: compilação TypeScript estrita limitada aos arquivos Avalia 360.
- `.github/workflows/avalia360-quality.yml`: acrescentada execução `npx tsc -p client/src/lib/avalia360/tsconfig.json --noEmit` depois do Vitest.
- O TypeScript isolado evita mascarar problemas do novo módulo por falhas gerais de outros componentes. Todavia, o projeto completo continuará exigindo verificação de regressão antes do merge.

### Riscos em aberto
- Logs anteriores identificaram TS2304 sobre `institutionId` em `StudentAccessPortal.tsx`; é outra frente do portal, e não constitui falha comprovada do Avalia.
- O novo portão de TypeScript foi escrito, mas sua execução/aprovação ainda deve ser comprovada em workflow posterior.
- O formulário React ainda não foi renderizado/homologado no portal.
- A proposta SQL não foi aplicada em staging ou produção.
- Os uploads de imagem ainda são somente locais, sem armazenamento persistente.
- A autenticação, MFA/RBAC, QR/OMR e correção discursiva aguardam testes reais.

### Checklist
- [x] CI específico aprovado, execução 44632882097, 36/36.
- [x] Compilação TS isolada adicionada ao workflow.
- [ ] CI do TypeScript isolado executado e aprovado.
- [ ] Teste visual e de acessibilidade do formulário.
- [ ] Gateway autenticado, storage privado e RLS homologados.
- [ ] End-to-end de elaboração e análise de prova real.
- [ ] Correção e intervenções longitudinais operacionais.

### Próximo desenvolvimento
Aguardar evidência verificável do portão TypeScript; corrigir os erros caso apareçam. Só então integrar armazenamento privado e formulário ao portal em branch controlada.