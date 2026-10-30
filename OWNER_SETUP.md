# Implantação Vértice — 26/10/2026

## Arquitetura atual
- Render Static Site: site público e demonstração, sem dados institucionais reais na demonstração.
- Supabase: projeto `qvetbbmviatxxatzzuzc`, PostgreSQL e Auth, região East US (Ohio).
- Login: `/entrar`, e-mail/senha, recuperação e segundo fator TOTP.
- Área autenticada: `/master` (também `/gestor` e `/admin-ies`, unificadas no mesmo painel). A demonstração não tem mais links de cadastro ou acesso real. A autorização é aplicada por RLS no banco, não pelo caminho da página.
- Chave do navegador: somente publishable. Nenhuma secret/service_role pertence ao frontend.
- Sessão: localStorage do navegador (login único para todas as abas desde 30/10/2026). Não é cookie HttpOnly; XSS continua sendo um risco a tratar com CSP, revisão de dependências e ausência de HTML não confiável.

## Banco
Migração: `supabase/migrations/202610260001_access_foundation.sql`.
Tabelas: vertice_institutions, vertice_courses, vertice_memberships, vertice_admins, vertice_audit.
As tabelas têm RLS, leitura exige MFA nível aal2 e vínculo ou perfil master. O próprio usuário só pode ver sua existência na lista de administradores; não pode criar privilégios. Não há concessões de escrita pela API do navegador nesta versão.
O cadastro de instituições, vínculos e administradores é feito por operação administrativa no banco, com identificação verificada. Nenhuma conta é promovida por e-mail ou por metadados editáveis do usuário.
Auditoria registra operação, tabela, ator autenticado (quando disponível), referência e horário. Alterações diretas pelo administrador no painel podem aparecer com ator nulo; isso não substitui os logs administrativos do provedor.

## Primeiro acesso do proprietário
E-mail solicitado: vrcmeirelles@gmail.com. Criar convite somente após confirmação da operação de acesso. Após a confirmação do e-mail e validação da identidade/UUID, atribuir o UUID exato em vertice_admins por conexão administrativa. Nunca usar e-mail sozinho como autorização no frontend. O titular define sua senha e cadastra o autenticador; não há senha padrão.

## Limites
- Cadastro público fechado. Confirmar controlador jurídico, CNPJ, canal dos titulares e retenção antes de abri-lo.
- Documentos, diagnósticos e metas compartilhados ainda não estão implementados: a demonstração permanece separada.
- Backup gerenciado e restauração não foram habilitados nem atestados. Os pacotes Git são cópias do código, não do banco.
- O servidor MySQL/OAuth Manus permanece no pacote como código legado não implantado. Seus testes não comprovam o funcionamento do Supabase.
- Não foi migrado nem apagado banco anterior. Não foi contratado serviço pago.

## Validação
`npm ci --legacy-peer-deps`, `npm run check`, `npm test`, `npm run build:static`.
`supabase/tests/access.sql` testa isolamento, bloqueio de autopromoção e de autovínculo, MFA e visão master com fixtures transacionais revertidas por rollback. Não executar testes de fixtures sem manter o rollback.

## Pacotes
`vertice-servidor-source.zip`: fonte editável, com lockfile, migração e testes.
`vertice-static.zip`: site compilado, usado pelos dois Static Sites existentes.
`deployment-checksums.sha256`: integridade dos pacotes.
