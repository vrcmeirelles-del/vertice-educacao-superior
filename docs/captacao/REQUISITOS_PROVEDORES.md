# Anexo | Provedores, permissões e limites

Verificação documental: 10/11/2026. Este anexo orienta a implementação, sem comprovar habilitação de contas do proprietário ou das IES. Páginas diretas Meta devolveram HTTP 429 nesta consulta; detalhes por endpoint devem ser revalidados antes da configuração. Nenhuma conexão ou autorização foi executada.

## Meta Lead Ads / Instagram

Fluxo de referência: aplicativo autorizado → assinatura do objeto Page/campo `leadgen` → assinatura da Página → webhook com `leadgen_id` → leitura autorizada do formulário/lead → normalização e gravação na IES correta.

O webhook pode trazer somente identificadores. A API de recuperação e o acesso à página continuam necessários. A documentação oficial exemplifica busca individual e listagem por formulário/anúncio, com paginação e filtro de período.

Permissões a revisar no produto atual: `leads_retrieval`, descoberta/leitura de páginas, `pages_manage_metadata` para a assinatura e permissões adicionais conforme a operação. Acesso de terceiros pode exigir revisão do aplicativo e acesso avançado. Não solicitar permissões de escrita de anúncios apenas para relatórios.

Fonte: https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md

## Meta Insights

Usar conta/campanha/conjunto/anúncio, período, fuso, moeda, dimensões e regra de atribuição. Revalidar escopo de leitura, usualmente `ads_read`, e ativos autorizados. Implementar paginação e relatórios assíncronos quando aplicáveis.

Resultados recentes podem mudar. Salvar período coberto, coleta, versão da API e regra de atribuição. Não somar alcance/usuários únicos indiscriminadamente. Clique reportado pela rede não prova carregamento do site.

Fontes:
- https://github.com/meta/facebook-python-business-sdk
- https://developers.facebook.com/docs/marketing-api/insights/ — página retornou 429 na consulta; não foram confirmados limites numéricos de latência ou janelas por essa página.

## WhatsApp

Embedded Signup/Facebook Login for Business e assinatura de mensagens são fluxos de referência para onboarding comercial. Validar negócio, modo de desenvolvimento versus produção, aplicativo e ativos de cada instituição. A aplicação oficial de exemplo não fornece isolamento multi-IES automaticamente.

Revalidar `whatsapp_business_management`, `whatsapp_business_messaging` e requisitos adicionais do fluxo vigente. Não iniciar OAuth ou gerar token sem a confirmação específica correspondente.

Referência oficial de implementação:
https://github.com/fbsamples/business-messaging-sample-tech-provider-app/blob/main/README.md

Política oficial consultada, atualizada em 23/09/2026:
- destinatário deve fornecer contato e opt-in para mensagens posteriores;
- respeitar retirada de consentimento;
- janela de atendimento de 24 horas a partir da mensagem do usuário;
- template aprovado para iniciar conversa e fora da janela aplicável;
- acesso claro a atendimento humano quando houver automação;
- privacidade, permissões e proteção dos dados.

Fonte: https://whatsappbusiness.com/policy/

Não usar clique no anúncio ou posse do número como autorização genérica. O consentimento deve identificar IES, finalidade e canal. Revalidar classificação e regras vigentes no momento do envio.

### Evolução da plataforma

Comunicados oficiais de 2026 apresentam evolução do modelo WABA para WAAC/PMA e identificadores BSUID para usuários com username. Projetar identidade externa extensível e não usar o telefone como única chave permanente. Conferir disponibilidade por conta e cronograma antes de adotar.

O blog oficial consultado anuncia mudança das mensagens de marketing para API dedicada, com encerramento desse envio pela Cloud API em 13/10/2027. Isso é uma dependência de manutenção futura, não razão para ativar uma API nova nesta entrega.

Fontes oficiais:
- https://developers.meta.com/resources/videos/whatsapp-account-model-evolution/
- https://developers.meta.com/resources/videos/whatsapp-usernames/
- https://developers.meta.com/resources/blog/

## TikTok

Marketing API utiliza autorização do anunciante TikTok for Business. Accounts API/conta orgânica constitui outro produto, com contrato de token diferente. Não transportar validade, renovação ou permissões entre os dois.

A aplicação precisa ter as capacidades e permissões habilitadas. O backend deve trocar código de autorização pelo mecanismo oficial, sem expor segredo ao navegador. Usar expiração/revogação e requisitos documentados para a versão efetiva, sem hardcode baseado em comportamento de outra API.

Leads API oferece fluxos de teste, download/recuperação, assinatura e campos de formulário. Confirmar a assinatura de webhook, esquema e cobertura disponíveis para o anunciante; recuperar/reconciliar com paginação.

Fontes:
- https://business-api.tiktok.com/portal/docs/leads/v1.3
- https://ads.tiktok.com/resources/help/article/access-leads-data-on-instant-forms?lang=en-GB

A ajuda oficial informa retenção de leads de 90 dias no Ads Manager. Isso não autoriza retenção ilimitada na Vértice. Fazer backfill dentro da disponibilidade, com finalidade e retenção próprias definidas.

Reporting possui modos síncrono e assíncrono; a versão 2.0 de Reporting não significa que toda a API seja v2.0.

Fontes:
- https://business-api.tiktok.com/portal/docs?id=1771101030416898
- https://business-api.tiktok.com/portal/docs/create-an-asynchronous-report-task/v2.0

Exportar leads ao CRM e devolver eventos de conversão à plataforma são operações distintas. Um postback pode transmitir identificadores ou dados de conversão e exige autorização/finalidade próprias; permanecer desligado por padrão.

Fonte: https://ads.tiktok.com/help/article/about-one-click-crm-integration

## Checklist de revalidação no início da implementação

1. Versão da API efetivamente escolhida e prazo de suporte.
2. Produto correto, status de revisão do app, permissões e ativos concedidos.
3. URL de callback, state/PKCE aplicável e política de renovação/revogação.
4. Assinatura, desafio, confirmação e regras de repetição de cada webhook.
5. Tamanho máximo, paginação, rate limits, Retry-After e disponibilidade de backfill.
6. Semântica dos status, fuso/moeda e atribuição dos relatórios.
7. Forma de consulta de resultado de envio para evitar duplicação após timeout.
8. Regras vigentes de opt-in, template/categoria e mensagens de marketing.
9. Titularidade dos ativos e autorização da IES piloto.
10. Testes de isolamento, revogação, duplicação, opt-out e recuperação de falha.

## Critério de interpretação

URL/UTM, leads nativos e relatórios de anúncios são capacidades diferentes. Não existe base para prometer identificação nominal de todos os visitantes nem atualização instantânea universal. A Vértice deve mostrar o que foi efetivamente recebido, de qual fonte e quando.
