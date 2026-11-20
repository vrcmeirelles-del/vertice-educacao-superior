# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 024 — Avalia 360° como módulo acadêmico autônomo
**Data:** 20/11/2026 | **PR:** #207 (rascunho) | **Produção:** inalterada.

### Decisão expressa
O usuário determinou separar Avalia 360° da Discursiva 360° e posicionar **Avalia 360° como módulo autônomo no módulo Acadêmico** da Vértice.

### Código alterado
- `source-overrides/client/src/lib/area.ts`: nova aba tipada `avalia360`, habilitada em `TABS_FULL` e `TABS_COURSE`, não concedida aos perfis `cpa`, `equipe` e `leitor`.
- `source-overrides/client/src/components/area/InstitutionTabs.tsx`: `avalia360` registrado exclusivamente sob a macro-aba `academico` (Módulos Acadêmicos).
- `source-overrides/client/src/components/area/Workspace.tsx`: entrada `Avalia 360°` em `TABS` e no grupo Acadêmico (ordenação alfabética existente); componente `Avalia360Studio` renderizado exclusivamente quando `tab === 'avalia360'`. Removido o seletor secundário que alternava entre Avalia e Discursiva dentro de `tab === 'discursiva'`.
- A rota de navegação escolhida é **Módulos Acadêmicos → Avalia 360°**, independente de **Módulos Acadêmicos → Discursiva 360°**.
- `isLocked` considera `avalia360` como módulo de navegação acessível a usuários autorizados na fase de implementação, sem introduzir desbloqueios em outros módulos.
- `InstitutionTabs.test.tsx`: verificação de destino próprio, exclusividade no grupo e permissões por perfil; teste de cobertura de todas as abas continua relevante.

### Evidências técnicas
- GitHub Actions `#44718286311`: **67 testes unitários e 20 testes PostgreSQL isolados**, todos aprovados.
- A validação de `Portal - TypeScript completo e contratos da Reitoria` foi solicitada no mesmo commit, com resultado a acompanhar antes de qualquer decisão de publicação.

### Limites e pendências
- A PR #207 ainda não foi integrada à branch principal. O novo módulo **não está publicado no portal oficial**.
- A demonstração isolada em https://vertice-avalia360-homolog.onrender.com é um site autônomo que já existia; não demonstra navegação acadêmica completa ou autorização por perfil.
- O módulo ainda depende de homologação de autenticação real, Storage e aderência ao PPC antes de publicação de funcionalidade persistente para professores.
- A permissão da interface não substitui RLS, autorização por curso e MFA no backend.
- Os adendos 001–023 são preservados integralmente.

### Próxima entrega
Homologar a macro-aba e o acesso por perfil no build completo; em seguida, testar numa prévia da Vértice que contenha o menu acadêmico e os dados de instituição com autenticação válida. Não fazer merge nem publicar em produção sem comprovação de segurança.
