# Identidade institucional das páginas públicas — correção da PR #163

As rotas `/conecta-parceiros` e `/acesso-estudante` passam a resolver o nome e a logo uma única vez no diretório público de instituições ativas. O cabeçalho, o rodapé e os portais internos usam essa identidade. O código não consulta `vertice_institutions` como visitante nem amplia grants ou RLS.

O contexto descarta respostas de uma instituição anterior, limpa dados ao mudar o UUID e separa link incompleto de erro de rede, com nova tentativa. Parceiros não carrega sessões ou habilita cadastros antes de resolver uma IES ativa. AC, estágio, Conecta e os links pessoais mantêm seus mecanismos de autenticação.

A migração `20261116131733_public_institution_branding.sql` atualiza somente a projeção pública `logo_url`. Copia a imagem já cadastrada em `document_branding.logo_data` quando PNG/JPEG/WebP, limitada a 2 MiB e com assinatura binária compatível; alternativamente aceita URL HTTPS sem credenciais. Não publica o JSON privado, não modifica os registros originais, slugs ou permissões. O trigger existente mantém as próximas alterações sincronizadas. SVG inline e fontes ativas são rejeitados; uma imagem que não abre usa iniciais.

## Validação local

- TypeScript completo: aprovado.
- Suíte base: 409 testes aprovados.
- Contratos do portal: 214 testes aprovados, incluindo 13 regressões novas de identidade, logo, erros, escopo e respostas fora de ordem.
- Formulários eletrônicos: 19 testes aprovados.
- Conecta: 30 testes aprovados; inclusão dessa suíte no workflow de Node 22/24.
- PostgreSQL sintético: três testes novos, cobrindo projeção de logos, formatos recusados, sincronização, RLS e ausência de escrita anônima.
- Build estático completo: aprovado.

As duas falhas de CI originalmente auditadas já foram corrigidas na PR #164, que integra a base desta correção. Seus testes foram preservados.

A aplicação da migração e a confirmação visual no ambiente publicado devem ser registradas após a implantação. Os testes sintéticos não equivalem ao aceite completo das jornadas autenticadas ou a um teste em aparelho físico.
