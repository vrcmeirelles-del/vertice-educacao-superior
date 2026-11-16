# Identidade visual: regressões locais

```sh
cd scripts/tests/branding-runtime
npm ci --no-audit --no-fund
npm test
```

Node 20.19+; dependências fixadas no lockfile. Os 24 testes não usam rede,
credenciais, documentos reais nem banco remoto.

- 10 testes executam o handler da Biblioteca INEP e o processamento real de ZIP
  com JSZip. Auth, consultas, Storage e auditoria são substituídos por fixtures.
- 6 testes executam a função original `normalizeDocumentLogo` com FileReader do
  JSDOM e codecs/canvas nativos para PNG/JPEG/WebP. Não são testes em navegador
  real e não executam a política CSP publicada.
- 8 testes PostgreSQL/PGlite usam as definições SQL lidas em 16/11/2026,
  registradas em `authorization-functions.snapshot.json`. Claims e vínculo de
  usuário/instituição são sintéticos. O snapshot é uma fixture, não uma
  migração nem fonte de implantação do banco; não comprova o RLS/MFA de uma
  sessão real no Supabase.

Para reproduzir a incompatibilidade com uma cópia da função publicada v21:

```sh
VERTICE_LIBRARY_EDGE_SOURCE=/caminho/vertice-inep-library-v21.ts \
  node --test branding.test.mjs
```

Na cópia v21 inspecionada, cinco dos dez testes do gerador falharam. A proposta
passou nos dez. Os outros 14 testes deste runtime avaliam os componentes e
guardas atuais; não avaliam a implantação desta proposta.

No pacote-base com `source-overrides/` aplicado, executar também os sete testes
de `BrandingPanel.ui.test.tsx` com a configuração `scripts/portal-types.vitest.config.ts`
do repositório, e os doze de `InstitutionTabs.test.tsx` com `vitest.config.ts`.
O primeiro conjunto usa mocks de RPC/decodificação; o segundo renderiza o cartão
no servidor, sem validar visualmente o layout nem disparar o fallback de erro
de carregamento de uma imagem em navegador real.
