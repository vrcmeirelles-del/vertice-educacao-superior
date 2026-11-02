# Correções de segurança e clareza institucional

A função de equipe passou a proteger o papel atual do destinatário e do convite. O upsert não pode mais ser usado por um gestor para rebaixar outro gestor; a condição é verificada atomicamente no conflito. MFA e regras por instituição permanecem vigentes.

A hospedagem foi configurada com CSP `frame-ancestors 'self'`, X-Frame-Options SAMEORIGIN e HSTS de um ano sem includeSubDomains/preload. Os cabeçalhos são mantidos no serviço Render, registrados em `deployment-security-headers.json`; não dependem apenas do meta HTML.

Cadastros históricos de curso iguais recebem rótulos de Base 1/Base 2 e contagens de exigências/metas, preservando IDs, nomes persistidos, registros e evidências. Uma regra nova impede futuras colisões de código/modalidade na mesma instituição, preservando os cadastros antigos e suas atualizações normais. A consolidação física exige conciliação própria: os históricos não foram somados nem descartados.

Títulos e descrições das páginas reservadas identificam a área institucional; cenários demonstrativos continuam identificados como demonstração.

Validação: 122 testes institucionais aprovados, verificação de tipos e build estático; reprodução isolada da falha de equipe e validação da correção em ambos os upserts; teste de preservação dos cadastros históricos e de rejeição de novas colisões.

Pendências fora deste deploy: o usuário solicitou proposta e custo antes da contratação do scanner privado; nenhum serviço de antivírus foi contratado ou afirmado como ativo. A proteção nativa contra senhas vazadas está disponível somente em Supabase Pro ou superior; o projeto permanece no plano Free, sem cobrança nova.
