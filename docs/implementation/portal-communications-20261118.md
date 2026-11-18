# Central de convites e e-mail do portal

Implementação em revisão em 18/11/2026. Fonte: repositório oficial existente. Nenhum novo aplicativo, banco, login ou serviço Render.

## Escopo implementado

Um catálogo compartilhado identifica os contextos do portal; uma biblioteca de envio fornece configuração, remetente, classificação segura das falhas, recibo e histórico. Os fluxos conservam suas próprias regras de autenticação e autorização.

| Frente | Integração proposta | Permissão efetiva |
| --- | --- | --- |
| Cursos e demais abas institucionais | Central reutilizável na área da instituição, contexto do módulo e seleção do curso | Colaborador/leitura/gestor são perfis institucionais. Selecionar curso ou módulo não restringe esses perfis. |
| TCC e Extensão: orientadores/professores | Mesmo formulário, sem senhas padrão nem confirmação administrativa de e-mail | Aceite nativo da instituição e MFA; conta vinculada conserva seu papel. |
| Estágio: colaboradores institucionais | Mesmo formulário | Perfil institucional explícito, sem fingir acesso externo restrito à avaliação. |
| Governança: coordenação e NDE | Encaminhamento por e-mail do convite nativo, com hash e validade conferidos no servidor | Permissões e curso do convite nativo; barreira de habilitação, sessão verificada e MFA da governança preservadas. |
| Master e Experience | Encaminhamento do link recém-gerado, sem emitir outro token | Aceite/ativação e validade continuam nos fluxos originais. Encaminhar não concede Master. |
| Alunos da Extensão | Transporte comum após emissão autorizada do convite individual | Identidade, campos, projeto, validade de 72h e aceite próprios. |
| Acesso estudantil AC/estágio | Transporte comum no envio existente | Registro, identidade, tokens, limites e resposta contra enumeração conservados. Conecta mantém seu login próprio. |
| Campanhas de notificação | Transporte comum, gestor/MFA e IES autorizados antes de consultar destinatários | Destinatários da campanha existente; e-mail repetido na mesma campanha usa o mesmo protocolo. Sem envio automático nesta implementação. |
| Confirmação de contrato | Transporte comum no emissor existente | RLS da assinatura, confirmação por posse do e-mail e intervalo de reenvio conservados. |

O botão antigo de supervisor externo apenas inseria um hash, atualizava o nome do supervisor e mostrava parte de um token, sem jornada completa de envio/aceite. Essa emissão enganosa foi retirada. A jornada específica de avaliação externa continua **pendente** e não foi substituída por acesso institucional irrestrito. Não há novo convite estudantil específico de TCC; o formulário comum atende colaboradores. Novos fluxos pessoais precisam definir destinatário, papel, escopo e aceite próprios antes de usar o transporte compartilhado.

Login, recuperação de senha e e-mails do Supabase Auth continuam no SMTP nativo. O serviço de comunicações não intercepta nem confirma essas mensagens. O endpoint antigo de student-magic-link permanece desativado.

## Configuração e causa confirmada

A inspeção do Resend nesta sessão identificou chave de envio do Fato & Ordem usada com o remetente `verticesuperior.com.br`, recusado por restrição de domínio. A nova configuração é global: `VERTICE_RESEND_API_KEY` e `VERTICE_RESEND_FROM`. Não configurar uma chave por módulo. O remetente deve pertencer a `verticesuperior.com.br` e a chave deve permitir esse domínio.

As variáveis genéricas legadas `RESEND_API_KEY` e `RESEND_FROM` continuam como fallback de compatibilidade; as variáveis institucionais prevalecem. Variáveis `EXTENSION_RESEND_*` não são usadas. Presença de configuração não comprova permissão da chave no provedor. Nenhuma credencial foi alterada neste pacote.

## Rastreabilidade e limites

A migração `20261118125840_portal_communications.sql` adiciona histórico privado e RPCs. Usuários não escrevem diretamente no histórico; o servidor registra somente protocolo, hashes de destinatário/conteúdo de referência, módulo, IES, curso, ator e resultado. Corpo, tokens, credenciais e destinatários em claro não ficam nessa tabela. Gestores da IES com MFA consultam metadados dos últimos 100 envios; a interface filtra curso. Registros sem IES são reservados ao Master com MFA pela RPC.

Estados: processamento, aceito pelo provedor, falha e não confirmado. Resposta HTTP de sucesso sem recibo não conta como aceitação. Não há confirmação de entrega ou leitura, webhook de entrega, retentativa automática ou envio em lote novo. Repetir um protocolo aceito não gera token ou mensagem novos; resultado incerto exige conferência antes de iniciar outra tentativa.

Os endpoints antigos `vertice-convite` e `vertice-convite-simples` passam a encaminhar para o handler compartilhado. A implementação anterior de senha padrão, e-mail confirmado à força e membership sem autorização de IES foi substituída. Convite e envio não aprovam documentos, horas, notas ou indicadores.

## Publicação controlada, ainda não executada

1. Registrar aprovação explícita do pacote e conferir a branch/commit revisados.
2. Aplicar exclusivamente a nova migração no projeto autorizado `qvetbbmviatxxatzzuzc`; não executar migrações pendentes em massa.
3. Configurar a credencial institucional correta em campo de segredo. Não imprimir, registrar no Git ou compartilhar o valor no chat.
4. Publicar os sete endpoints canônicos e suas dependências relativas: `vertice-communications`, `vertice-convite`, `vertice-convite-simples`, `vertice-extension-student-invite`, `vertice-student-portal`, `vertice-notify-students`, `send-contract-confirmation`. Respeitar `supabase/config.toml`: apenas student-portal mantém entrada pública com validações próprias.
5. Publicar o frontend nos dois serviços existentes do workspace **Virgílio Meirelles | Projetos**: `srv-dbbm6q3ncjis7396t7fg` e `srv-dbm52uhsrm7s73f3ojkg`. Conferir `www.verticesuperior.com.br` e a versão efetivamente servida.
6. Com destinatário explicitamente autorizado, validar um convite real por jornada existente, aceite, MFA, escopo, recusa de outra IES e protocolo. Separar recibo do provedor de entrega na caixa. Nenhuma mensagem real foi enviada durante os testes locais.

Em falha, bloquear novos envios e preservar o histórico; não restaurar o endpoint de senha padrão. A migração é aditiva e não altera registros acadêmicos existentes.

## Verificação local

- 44 testes PostgreSQL/PGlite e transporte: permissões, MFA, isolamento, histórico, duplicação, falhas e contratos existentes de Extensão/TCC/estágio.
- 45 testes de interface/formulários: contexto, curso, confirmação, bloqueio sem configuração, resposta incerta e encaminhamento nativo, além das regressões existentes.
- TypeScript completo, compilação estática e fonte canônica aprovados. As sete funções também passaram na checagem estática local com tipos do SDK instalado 2.118 e declaração do ambiente Deno; essa checagem não substitui empacotamento e execução no runtime remoto.
- Esquema e assinatura das funções de governança conferidos em produção por leitura, sem mutação.
- Checagem Deno com download de dependências não concluída pela conectividade do ambiente; registrar a checagem estática local separadamente. Revisão visual no navegador e teste autenticado com destinatário real ainda pendentes.

Código implementado e testes locais aprovados não equivalem a publicação ou funcionamento comprovado com dados reais.
