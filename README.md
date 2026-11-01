# Vértice Educação Superior

Produção: https://www.verticesuperior.com.br

Biblioteca INEP: em `/master`, abrir a instituição e a aba **Biblioteca INEP**.
Há também um atalho na lista inicial. Usa o mesmo login e MFA do portal.
Documentação da integração: [UPDATE_LIBRARY_INEP_20261101.md](UPDATE_LIBRARY_INEP_20261101.md).

A implantação usa Render Static Sites para a interface e Supabase Auth/PostgreSQL para identidade e acesso aos dados. Veja [OWNER_SETUP.md](OWNER_SETUP.md) para os requisitos, limites e primeiro acesso.

- `vertice-static.zip`: interface compilada publicada pelos serviços existentes.
- `vertice-servidor-source.zip`: fonte editável, lockfile, migração e testes. Extrair para uma pasta e executar `npm ci --legacy-peer-deps`, `npm run check`, `npm test`, `npm run build:static`.
- `supabase/`: migração aditiva e testes transacionais de acesso. A migração deve ser aplicada uma única vez; não a executar novamente sem verificar o histórico e as tabelas existentes.
- `deployment-checksums.sha256`: integridade dos pacotes.

A branch `main` é a referência de produção. `feat/owner-master-access` e `OWNER_CHANGES.patch` são históricos anteriores à integração Supabase. O servidor MySQL/OAuth Manus incluído no pacote é legado e não está ativo nos Static Sites. Não confundir testes do legado com validação do Supabase.

Nenhum banco anterior foi importado ou apagado. A demonstração continua separada dos registros autenticados. Backup do código não é backup do banco.
