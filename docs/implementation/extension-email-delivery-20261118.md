# Falha de e-mail da Extensão — diagnóstico e correção preparada

Consulta em 18/11/2026 ao Supabase oficial qvetbbmviatxxatzzuzc. A chamada de vertice-extension-student-invite às 12:13:23 UTC (09h13, Brasília) retornou HTTP 502. Há falhas 502 anteriores no mesmo fluxo. Não há registro da resposta HTTP do Resend nos logs atuais da função. A causa específica (credencial, remetente/domínio, cota, recusa de dados ou conexão) permanece não confirmada.

A função publicada, versão 2, descarta o corpo e o status original do provedor. A proposta usa a configuração já prevista no repositório EXTENSION_RESEND_API_KEY com fallback RESEND_API_KEY, mantém os remetentes existentes e acrescenta classificação fechada dos erros do provedor. Os logs incluem somente evento, status e categoria. Corpo bruto, credenciais, destinatários, dados de aluno e link/token não são registrados ou retornados.

A aceitação pelo provedor exige HTTP de sucesso e recibo. Isso não confirma entrega na caixa do destinatário. A tela passa a expressar essa diferença. Falha de rede é tratada como resultado não confirmado, sem repetição automática. Não há mudança de banco, permissões, MFA, prazo ou regras de ativação.

Também foi constatado um problema separado no convite simplificado de professores: a função não contém chamada de envio de e-mail e a tela ignora erros retornados. Um registro Auth às 06h40 (Brasília) mostra rejeição por política de senha. Esse fluxo legado requer correção própria com preservação de autorização institucional; não é usado como alternativa de envio neste ajuste. Nenhuma senha padrão foi aplicada ou política de senha reduzida por esta tarefa.

Referência técnica consultada: https://resend.com/docs/api-reference/errors.

Validação local: 38 testes de banco/serviço aprovados, incluindo seis casos de entrega com fetch simulado (classificação, recibo, privacidade, erro não JSON e falha de rede). Suíte de interface/formulários e compilação registradas na PR. Não houve envio de e-mail real, reemissão de convite ou mudança de conta.

Publicação pendente de autorização explícita. A etapa necessária é publicar esta versão da função existente e do frontend, obter a categoria numa tentativa autorizada e corrigir a configuração correspondente se necessário. A causa original e a entrega real continuam não confirmadas. Não declarar o problema resolvido apenas por integrar este diagnóstico.
