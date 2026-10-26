# Acesso do proprietário — implantação pendente

E-mail indicado pelo proprietário: `vrcmeirelles@gmail.com`.

O painel `/master` consulta instituições, cursos e usuários reais do banco. Não altera a publicação estática existente e não cria uma conta fictícia. Não há senha padrão.

## Requisitos de ativação

1. Servidor Node para executar `npm ci --legacy-peer-deps`, `npm run build` e `npm start` (não um Static Site).
2. Banco MySQL compatível com `drizzle/schema.ts`, com migrações das quatro tabelas aplicadas. A migração SQL atualmente incluída cria somente `users`.
3. Provedor OAuth do projeto configurado: `MANUS_PROJECT_ID`, `MANUS_OAUTH_API_URL`, configuração pública do portal e `MANUS_JWT_SECRET` seguro.
4. Login real do proprietário pelo provedor. Configurar no servidor `OWNER_OPEN_ID` com a identidade retornada pelo provedor e `OWNER_EMAIL=vrcmeirelles@gmail.com`. Nunca usar o e-mail como substituto do identificador autenticado.
5. A inicialização promove somente uma conta existente com identidade e e-mail correspondentes. O login também aplica essa correspondência ao criar/sincronizar a conta.
6. Testar `/api/trpc/owner.overview` sem sessão, com conta comum e com proprietário antes de ligar o domínio ao servidor.

O painel é de consulta. Gestão de permissões, diagnósticos compartilhados, documentos e auditoria de alterações ainda precisam de implementação. Não reutilizar bancos de outros produtos.

## Validação

`npm run check`, `npm test` e `npm run build`.

Os testes verificam a recusa de visitantes, de outro administrador, de e-mail sem identidade correspondente, de identidade com outro e-mail e de configuração ausente.

## Área de login

`/entrar` e o botão Entrar no cabeçalho e rodapé estão incluídos na interface. `/gestor` usa a mesma tela, sem validação simulada de senha. O servidor fornece `/api/auth/status` e `/api/auth/logout`; sem configuração a interface informa indisponibilidade e não coleta senhas. A recuperação ocorre no provedor OAuth; não há recuperação local de senha. Após o login, o proprietário encontra seu painel em `/master`.

## Reforço de proteção — 26/10/2026

O código atualizado está em `vertice-servidor-source.zip`; extraia o pacote para compilar e implantar o servidor. O pacote estático contém apenas a interface e o aviso de privacidade; não executa proteções de servidor.

Incluídos: cabeçalhos de segurança/CSP em produção, cookies SameSite=Lax, sessão emitida com oito horas, limite de corpo de 1 MB, limitação de API por processo e verificação de origem em escritas. Configure `PUBLIC_SITE_ORIGIN` com a origem HTTPS exata. A API recusa escritas sem essa configuração. Não habilitar confiança irrestrita em cabeçalhos de proxy; ajustar proxy e limite compartilhado conforme a hospedagem.

Área de acesso: política vinculada e ciência de leitura sem autorização de marketing. O provedor externo controla seu próprio cadastro. Antes de abrir cadastros reais, confirmar razão social/CNPJ do controlador, canal dos titulares, fornecedores, retenção e transferências; essas informações não foram inventadas. MFA, backups/restauração, revogação individual de sessões e segregação multi-institucional completa continuam pendentes. Cabeçalhos do servidor não são aplicados por hospedagem estática.
