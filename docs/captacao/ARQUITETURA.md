# Vértice | Captação integrada por instituição

## Arquitetura e especificação portátil para implementação

**Versão:** 1.0 · 10 de novembro de 2026  
**Destino:** ambiente de desenvolvimento chamado pelo proprietário de “Cloud”, sem presumir fornecedor, produto ou modelo.  
**Produto:** Vértice Educação Superior, integrada ao Fato & Ordem quando houver vínculo institucional validado.  
**Natureza desta entrega:** especificação de implementação e rascunhos técnicos. Não é comprovação de integração operacional, migração de dados, publicação ou autorização de credenciais.

## 1. Resultado desejado

Entregar um módulo dentro da Vértice existente para que cada instituição de ensino superior (IES) configure suas fontes uma vez, vincule suas contas e campanhas autorizadas e acompanhe a jornada do interessado até matrícula e permanência. O gestor continua criando e impulsionando campanhas no gerenciador oficial da rede social. A Vértice recebe dados permitidos, organiza o atendimento e mostra indicadores rastreáveis.

A experiência desejada para o gestor é simples: escolher a IES, conectar a conta, selecionar página/conta de anúncios/formulário, vincular a campanha ou copiar um link de destino e acompanhar o resultado. A complexidade de credenciais, webhooks, tratamento de erros e conciliação fica no backend.

**Limite essencial:** colar o link de uma página não concede acesso aos seus leads, mensagens, investimento ou inscrições. O cadastro do endereço é preparação. A conexão real requer autorização oficial da IES, permissões concedidas ao aplicativo e validação do fluxo. Não solicitar senhas das redes sociais dentro da Vértice.

### Entrega funcional final

1. Configuração guiada por IES, com permissões, fonte e estado verificáveis.
2. Meta/Instagram e TikTok: seleção de ativos autorizados, leitura de campanhas e métricas e recebimento de leads identificados voluntariamente nos formulários.
3. Links de campanha com identificação não pessoal e UTM, sem prometer identificação de todos os visitantes.
4. Atendimento WhatsApp com consentimento, fila, responsável, histórico, estados de entrega e limites do provedor.
5. Funil: lead → atendimento → inscrição → matrícula confirmada → acolhimento/permanência.
6. Conciliação com o sistema acadêmico e ponte existente do Fato & Ordem, sem criar matrícula ou vínculo por mera semelhança de nomes.
7. BI com período, escopo, fonte, denominador, data da fonte, última sincronização e situação de atualização.
8. Autonomia de operação do gestor dentro de permissões expressas, sem precisar de desenvolvedor para cada campanha.

## 2. Estado real conferido

### 2.1 Código e infraestrutura existentes

- Repositório: https://github.com/vrcmeirelles-del/vertice-educacao-superior
- Referência inspecionada: `main`, commit `7105e2a7ae1d99780acb3fd2c1909683b6040359`. Conferir novamente antes de implementar: a produção pode avançar.
- Site: https://www.verticesuperior.com.br
- BI de captação existente: https://www.verticesuperior.com.br/master#captacao=1, protegido pelo acesso do portal. Esta inspeção não homologou a tela autenticada.
- Interface: React/TypeScript, pacote-base ZIP e sobreposição `source-overrides/`.
- Identidade e dados: Supabase Auth/PostgreSQL. Projeto Vértice identificado: `qvetbbmviatxxatzzuzc`.
- Publicação do frontend: serviços existentes no Render. Não criar serviço paralelo por padrão.

### 2.2 Inventário confirmado em leitura em 10/11/2026

| Componente | Evidência | Estado e limite |
|---|---|---|
| BI de Captação | `source-overrides/client/src/components/area/CaptacaoBI.tsx` | Consulta fontes por IES, apresenta vazio/erro, importação CSV e atualização manual. Não contém conector Meta/TikTok. |
| Agregação de captação | `source-overrides/client/src/lib/captacao.ts` | Leads por estágio, origem, custos e snapshots. O estágio corrente não é histórico de transições. |
| Tabelas de captação | `vertice_captacao_leads`, `vertice_captacao_custos`, `vertice_captacao_snapshots` | Consulta retornou **0 registros nas três tabelas**. Não há resultado de campanha comprovado por essas fontes. |
| Modelo de lead atual | Migração `20261104001000_captacao_bi.sql` | Guarda IES, origem, curso textual, etapa, período e datas. Não guarda nome, e-mail, telefone, consentimento ou ID de anúncio. |
| Conexões de dados | `ConexoesDados.tsx`, tabelas `vertice_data_connections`, `vertice_data_connection_runs`, `vertice_connection_records` | Estrutura para API acadêmica/SQL/agente/OneDrive. Consulta retornou **0 conexões cadastradas**. Não reutilizar como conector social genérico sem adaptação. |
| Função de conexão | `supabase/functions/vertice-conexao/index.ts` | Supabase reportou `ACTIVE`, versão 3. Existência/publicação não comprova extração, cobertura ou operação real. |
| Ponte Fato & Ordem | `supabase/functions/vertice-learning-bridge/index.ts` | Supabase reportou `ACTIVE`, versão 5. Há operações para instituição, roster, notas, calendário, correspondência e sincronização. |
| Dados da ponte | `learning_students`, `learning_events`, `learning_sync_runs`, `vertice_learning_course_metrics` | Consulta retornou **0 registros nas quatro fontes**. Não declarar aprendizagem ou matrícula integrada. |
| Segurança existente | `vertice_private.can_read_institution` | Verifica MFA AAL2 e Master ou vínculo com IES. Permissão de leitura não deve ser convertida automaticamente em permissão de envio/gestão. |
| Gestão de conexões | `vertice_connection_authorize` e `vertice_connection_master` | Verificação de MFA e papel gestor/Master. Reavaliar política específica da captação antes de conceder novas capacidades. |

O horário exibido hoje como “Última consulta ao Supabase” é a hora de leitura da tela. Não é a data do último lead recebido nem a prova de atualização de Meta/TikTok.

### 2.3 Frentes anteriores a preservar

- PR #28 permanece aberta, em rascunho e conflitante. Suas correções de vazio/erro e proteção contra respostas antigas aparecem na main consultada. **Não integrar a PR antiga novamente como se fosse a nova captação.** https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/28
- PR #54 trata conexão institucional acadêmica por API e está aberta/conflitante. Não confundir essa frente com OAuth de anúncios, nem sobrescrever seu trabalho. https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/54
- Os arquivos de migração de conexões de 09/11 no repositório são comentários de histórico, não o DDL completo. Antes de alterar essas estruturas, recuperar o histórico autorizado e comparar com o esquema real. **Não reconstruir regras de segurança por suposição.**
- Há divergência documentada de identificador legado do e-ORBIT e cadastro institucional. Nenhuma ligação por nome ou transferência de dados entre IES pode contornar essa pendência. https://github.com/vrcmeirelles-del/vertice-educacao-superior/issues/78

### 2.4 O que não foi feito nesta entrega

Nenhuma credencial criada ou copiada; nenhuma autorização OAuth concedida; nenhum lead real importado; nenhum anúncio ou mensagem disparado; nenhuma alteração no banco de produção; nenhum merge ou deploy desta nova captação. A consulta ao Render foi bloqueada por ausência de workspace selecionado e exigência de confirmação do workspace. Isso não impede a entrega desta arquitetura.

## 3. Decisões de arquitetura

### 3.1 Evoluir o produto existente

Não criar uma Vértice paralela, novo cadastro institucional ou CRM independente. A entrada fica no BI de Captação atual, com abas “Visão geral”, “Campanhas”, “Interessados”, “Atendimento”, “Inscrições e matrículas” e “Conexões”. Reutilizar o padrão visual `BIFrame`, a seleção de instituição, autenticação, MFA e navegação já existentes.

As tabelas de contadores legadas permanecem preservadas. Durante a migração, identificar sua origem como legado/manual e não somar automaticamente aos novos leads nominais, evitando dupla contagem.

### 3.2 Separar os componentes

```text
Gestor autenticado + IES selecionada
        │
        ├─ Configuração guiada e seleção de ativos autorizados
        ├─ Campanhas e links de destino
        └─ Fila de atendimento e BI
                 │ APIs autenticadas / RLS
                 ▼
Conectores oficiais por provedor
  Meta Lead Ads + Insights │ TikTok Leads + Reports │ WhatsApp
                 │
                 ▼
Recepção autenticada → caixa de eventos durável → processamento idempotente
                 │                         │
                 ▼                         ▼
Contatos/consentimentos privados    Métricas agregadas e estado da fonte
                 │
                 ▼
Lead → inscrição → confirmação acadêmica → matrícula
                 │
                 ▼
Ponte institucional validada → permanência e Fato & Ordem
```

O frontend nunca recebe service role, segredo de aplicativo, token de longa duração ou chave de integração. Ele solicita operações ao backend. O backend limita o destino ao provedor previsto; não é um proxy para URLs arbitrárias.

### 3.3 Componentes portáteis

Manter interfaces de conector independentes do executor. O ambiente Cloud precisa executar Git, Node, testes e, para homologação, PostgreSQL isolado e um navegador. A execução pode continuar nos serviços existentes; a troca de ambiente de desenvolvimento não exige migrar hospedagem ou banco.

Fila e agendamento devem usar a infraestrutura disponível e aprovada. Uma implementação inicial pode usar uma tabela durável de trabalhos e um worker existente. Escolher limites após testar capacidade. Não contratar broker, servidor ou serviço pago sem decisão do proprietário.

## 4. Jornada guiada de configuração por IES

### Etapa 1 — Instituição e responsabilidade

Exibir nome e identificador da IES selecionada, usuário autenticado, papel e escopo. Não oferecer escolha livre de `institution_id` sem validação no servidor. Confirmar o responsável operacional e a finalidade do uso. A IES não deve acessar outra instituição por alteração de URL ou payload.

### Etapa 2 — Escolher a fonte

Cartões separados: Meta/Instagram, TikTok, WhatsApp e sistema acadêmico. Cada cartão mostra:

- O que será lido ou enviado.
- Ativos necessários: conta de anúncios, página, formulário, número WhatsApp ou fonte acadêmica.
- Estado real: não configurado, preparação salva, aguardando autorização, autorizado, sincronização pendente, ativo, parcial, atrasado, revogado ou erro.
- Último teste e última sincronização bem-sucedida, separados.
- Botão de reconexão/revogação conforme permissão; nada de “conectado” apenas porque o usuário preencheu um link.

### Etapa 3 — Autorizar no provedor

Fluxo OAuth/Embedded Signup oficial quando aplicável. Mostrar a conta e os ativos retornados pelo provedor e solicitar seleção explícita. Armazenar somente identificadores não secretos no cadastro visível; credenciais ficam no cofre do backend.

Usar `state` aleatório de uso único, expiração curta, sessão e IES vinculadas, callback HTTPS permitido e PKCE quando suportado pelo produto. Validar a identidade/ativos retornados no servidor. Não aceitar `institution_id` do callback como prova de autorização.

O operador da implantação precisa confirmar cada criação de credencial ou concessão de acesso persistente. A autorização geral para construir o produto não substitui essa confirmação. O gestor, no produto final, também deve ver o escopo antes de autorizar sua conta.

### Etapa 4 — Selecionar campanhas e destino

Listar campanhas da conta autorizada ou cadastrar referência externa ainda não verificada. Permitir seleção por ID estável; nomes podem mudar e não são chave. Campanhas sem retorno da API aparecem como “referência informada, não verificada”.

Dois modos:

1. **Formulário nativo da rede:** mapear o formulário à IES/campanha, campos necessários e consentimentos.
2. **Página de destino da IES:** gerar link com UTM e identificador público de campanha; a página precisa incorporar o formulário/evento da Vértice. Copiar o link sem instalar a captura na página não registra conversões.

Um identificador público de campanha pode aparecer no link. Ele não deve autorizar leitura de dados, conter UUID pessoal, e-mail, telefone ou token de acesso. Nunca colocar segredos em UTM.

### Etapa 5 — Testar antes de ativar

Criar evento sintético marcado como teste, na IES de homologação. Conferir recebimento, deduplicação, campo de origem, horário, consentimento e isolamento. Testes não entram em métricas reais. O teste de lead não envia WhatsApp automaticamente.

### Etapa 6 — Operar

O gestor acompanha estado das fontes, leads novos, responsáveis, inscrições e divergências. Pode pausar a coleta e revogar a conexão. A plataforma avisa quando expira autorização ou falta permissão, sem pedir ao gestor que cole tokens em campo de texto.

## 5. Modelo de dados proposto

Nomes abaixo são contratos de implementação, não tabelas já operacionais, salvo as identificadas como existentes. Conservar `institution_id` obrigatório em todas as entidades e chaves compostas nos vínculos.

### 5.1 Configuração e campanhas

- `captacao_connections`: IES, provedor, IDs de conta/página/formulário, escopos concedidos, estado, versão da configuração, responsável, referência opaca ao cofre e datas de autorização/teste/sync. Campos secretos não pertencem à resposta pública. IDs e URLs preenchidos manualmente não definem estado ativo.
- `captacao_campaigns`: IES, conexão, ID externo, nome, curso/oferta de destino, modo de captura, URL de destino validada, UTM, estado do cadastro e estado observado no provedor. **Rascunho na Vértice não cria campanha no provedor.**
- `captacao_sync_runs`: IES/conexão, início/fim, tipo de carga, cursor anterior/posterior, contagens recebidas/novas/duplicadas/rejeitadas, erro sanitizado e cobertura. Somente worker pode declarar sucesso.
- `captacao_ad_daily_metrics`: IES, conta, campanha/adset/ad, dia, fuso do relatório, moeda, gasto, impressões, cliques, métrica original, janela de atribuição e revisão da coleta. Chave natural impede soma duplicada de reprocessamento.

### 5.2 Pessoas, consentimentos e jornada

- `captacao_contacts` em schema privado: ID interno aleatório, IES, nome informado, e-mail/telefone necessários, campos de verificação, origem e datas. Nenhum CPF é necessário para captar um interessado.
- `captacao_lead_sources`: IES, contato, provedor, conta/formulário/campanha e ID externo do lead. `UNIQUE(institution_id, provider, external_account_id, external_lead_id)`.
- `captacao_consents`: IES, contato, canal, finalidade, concedido/retirado, texto/versão apresentados, origem, data e referência de evidência. Separar atendimento solicitado, devolutiva, novidades/ofertas e compartilhamento acadêmico.
- `captacao_journey_events`: eventos imutáveis de mudança, com etapa, instante da ocorrência, recebimento, ator/origem, evidência e chave de idempotência. Corrigir com novo evento, sem apagar o histórico.
- `captacao_assignments`: responsável autorizado, prazo, motivo e estado de atendimento, sem conceder acesso a toda a base por atribuição textual.
- `captacao_applications`: ID da inscrição no sistema de origem, curso/oferta/período, status e última confirmação. “Inscrito” não significa “matriculado”.
- `captacao_enrollment_links`: referência de matrícula, IES, curso, período, fonte, evidência e revisão; status pendente/confirmado/rejeitado/revogado. A confirmação depende de fonte acadêmica autorizada.

### 5.3 Mensageria e eventos técnicos

- `captacao_event_inbox`: evento externo bruto mínimo ou referência criptografada de retenção curta, hash, provedor, ativo, assinatura validada, recepção e processamento. Corpo não deve aparecer nos logs.
- `captacao_outbox`: intenção de mensagem aprovada, destinatário interno, propósito, template/versão, autorização, chave de idempotência e estado. Não armazenar o mesmo envio como novo a cada retry.
- `captacao_message_events`: ID do provedor, status recebido, instante e correlação. Estados aceito/enviado/entregue/lido/falhou são distintos.
- `captacao_audit`: quem consultou/exportou/alterou/autoriza/enviou, IES, operação, entidade e resultado. Sem conteúdo integral da mensagem, telefone, token ou CPF em logs genéricos.

### 5.4 Chaves, deduplicação e concorrência

- Toda FK entre entidades de IES inclui `institution_id`; testar que não é possível ligar campanha da IES A ao contato da IES B.
- Identificador externo é string, não número de ponto flutuante.
- E-mail normalizado pode sugerir duplicidade dentro da mesma IES, mas não funde pessoas automaticamente entre instituições. Telefone pode ser compartilhado/reutilizado. Manter revisão para ambiguidades.
- Não transformar contatos em contas de aluno por recebimento do lead. Não presumir consentimento por existência de telefone.
- Usar controle de versão/CAS em alterações de campanha, consentimento e atribuição. Pedido obsoleto retorna conflito sem sobrescrever dado novo.
- Um evento repetido retorna o resultado anterior; dois workers concorrentes não criam duas pessoas ou duas mensagens.

## 6. Contratos de API e processamento

### 6.1 Operações autenticadas propostas

```text
GET  /captacao/ies/{ies}/overview
GET  /captacao/ies/{ies}/connections
POST /captacao/ies/{ies}/connections/prepare
POST /captacao/ies/{ies}/connections/{id}/authorize/start
POST /captacao/ies/{ies}/connections/{id}/pause
POST /captacao/ies/{ies}/connections/{id}/revoke
GET  /captacao/ies/{ies}/campaigns
POST /captacao/ies/{ies}/campaigns
PATCH /captacao/ies/{ies}/campaigns/{id}  [expected_version]
GET  /captacao/ies/{ies}/leads           [paginação por cursor]
POST /captacao/ies/{ies}/journey-events [idempotency_key]
POST /captacao/ies/{ies}/messages/preview
POST /captacao/ies/{ies}/messages/authorize
POST /captacao/ies/{ies}/messages/dispatch [somente depois das verificações]
GET  /captacao/ies/{ies}/sync-runs
```

Esses nomes não são endpoints publicados. Podem ser implementados como operações em funções Edge existentes ou novas, preservando contratos e autorização. O gateway não deve permitir ao navegador chamar operações de service role.

### 6.2 Envelope canônico de evento

```json
{
  "schema_version": "1",
  "provider": "meta",
  "external_account_id": "ID_SINTETICO_CONTA",
  "external_event_id": "ID_SINTETICO_EVENTO",
  "type": "lead.created",
  "occurred_at": "2026-11-10T12:00:00Z",
  "received_at": "2026-11-10T12:00:03Z",
  "campaign_external_id": "ID_SINTETICO_CAMPANHA",
  "form_external_id": "ID_SINTETICO_FORMULARIO",
  "is_test": true,
  "payload_ref": "REFERENCIA_PRIVADA_NAO_PUBLICA"
}
```

O servidor resolve a IES pela conexão e pelo ativo previamente autorizados. Não confiar em um `institution_id` enviado pelo provedor/cliente como única regra de roteamento. Um ativo não mapeado fica em quarentena, sem atribuição por nome.

### 6.3 Webhooks e worker

1. Validar desafio/assinatura conforme o provedor e a versão vigente, com corpo original e comparação segura.
2. Limitar tamanho, taxa e tipo do evento. Recusar assinatura inválida; não tentar “aproveitar” o conteúdo.
3. Persistir recebimento idempotente antes de confirmar aceitação ao provedor. Responder rapidamente, sem executar toda a importação na requisição.
4. Worker adquire lease, resolve tenant, busca detalhe autorizado se o webhook contiver só ID, normaliza campos mínimos e grava uma transação consistente.
5. Avançar cursor somente após commit. Cursor composto evita perda de eventos com o mesmo horário.
6. Aplicar backoff com jitter, respeitar `Retry-After` e limites por conta/provedor. Diferenciar 401/revogação, 403/escopo, 429/limite e 5xx temporário.
7. Após limite de tentativas, colocar em fila de erro com motivo sanitizado e opção de reprocessar sem duplicação.
8. Reconciliar periodicamente com consultas de intervalo sobreposto. Métricas de anúncios podem ser revisadas retrospectivamente.

Não seguir redirecionamentos arbitrários nem buscar endpoints inventados a partir de entrada do usuário. Definir allowlist de APIs oficiais, timeout, limite de resposta e paginação completa. Nunca truncar silenciosamente a primeira página e informar sucesso total.

## 7. Meta/Instagram e TikTok

### Meta

Separar três capacidades: identificação da página/Instagram, leads de formulários e métricas de anúncios. Cada capacidade exige ativos e permissões próprios; acesso ao perfil Instagram não prova acesso a Lead Ads ou à conta de anúncios.

O aplicativo deve possuir configuração comercial, callback e webhooks válidos, permissões aprovadas quando necessário e autorização dos administradores corretos. A implementação deve validar os escopos atuais na documentação oficial e no painel do aplicativo. Não fixar uma lista de permissões com base em memória nem solicitar escrita de anúncios para uma função apenas de leitura.

Leads de formulário são dados identificados fornecidos pelo interessado. Relatórios de cliques/impressões são agregados e não fornecem uma lista de todos os visitantes. Não fazer fingerprinting para tentar recuperar identidades anônimas.

### TikTok

Usar produto de API comercial apropriado para conta anunciante, relatórios e geração de leads. Login/conta orgânica não equivale à autorização de Marketing API. Implementar seleção de anunciante e formulários, normalização de esquema e renovação/revogação conforme o produto efetivamente habilitado.

Consultar disponibilidade de webhooks/CRM e permissões da conta antes de prometer recepção automática. Se uma capacidade não estiver aprovada, exibir “aguardando habilitação no provedor”, sem simular eventos reais. Exportação manual autorizada pode ser alternativa transitória, claramente identificada e sem aparentar tempo real.

### Link e atribuição

UTM e IDs de campanha servem para rastrear uma visita/cadastro quando preservados no formulário e autorizados. Podem ser copiados ou adulterados: não provam causalidade exclusiva do anúncio.

Guardar primeiro e último contato separadamente, com fonte, timestamp e regra de associação. No relatório, diferenciar “origem informada pelo link”, “lead vinculado por ID do provedor”, “atribuição reportada pelo provedor” e “sem origem identificada”. Não somar conversões reportadas pela rede às matrículas do CRM como se fossem eventos distintos.

## 8. WhatsApp e atendimento

### 8.1 Conectar a conta correta

Associar por IES o Business Account, número habilitado e ativos autorizados. Usar onboarding oficial aplicável ao produto. Não reutilizar automaticamente o número/credenciais do Fato & Ordem em instituições diferentes.

Para cada mensagem, conferir no momento do envio: IES, permissão do operador, telefone fornecido, finalidade, consentimento válido, ausência de retirada/bloqueio, janela de atendimento, template e limites da conta. Consentimento para análise do simulado não autoriza ofertas gerais.

### 8.2 Fila operacional

Estados de atendimento: novo, em fila, atribuído, em atendimento, aguardando interessado, resolvido ou encerrado. Ações do gestor ficam auditadas. Transferência entre atendentes não altera consentimento.

Automação pode sugerir resposta, classificar assunto e organizar fila; não pode aceitar matrícula, contrato, bolsa, preço ou condição comercial em nome da IES sem escopo aprovado. Atendimento humano deve ser acessível.

### 8.3 Envio seguro

- Mensagem livre somente quando permitida pelas regras vigentes e janela aplicável; fora dela, template aprovado e categoria correta.
- Separar atendimento/serviço de marketing. Não classificar promoção como utilidade para evitar regras ou cobrança.
- Prévia mostra quantidade, público, texto/template, finalidade e eventual custo/limite conhecido antes da autorização.
- Durante esta implementação, manter despacho desligado. Teste de interface não deve disparar mensagem real.
- Pedido com resultado incerto fica em `unknown`; verificar o provedor antes de repetir. Não reenviar só porque houve timeout.
- Aplicar opt-out imediatamente e registrar supressão. Reavaliar consentimento ao retirar um item da fila, não apenas na criação do lote.
- Estados de entrega do provedor não são confirmação de matrícula nem resposta do aluno.

## 9. Inscrição, matrícula, permanência e Fato & Ordem

### 9.1 Matrícula não é um rótulo comercial

“Interessado”, “contatado”, “inscrito”, “aprovado” e “matriculado” são eventos distintos. Uma alteração manual de estágio deve informar ator e evidência. Só apresentar matrícula confirmada quando o sistema acadêmico autorizado ou revisão institucional fornecer referência verificável, curso, período e status.

Pagamento, aceite de formulário, matrícula histórica ou clique no aplicativo não bastam isoladamente. Cancelamentos e correções geram eventos próprios; não apagam a origem da captação.

### 9.2 Vínculo institucional

O `institution_id` da Vértice é canônico. Resolver códigos externos por mapa explícito, versionado e revisado. Curso precisa pertencer à IES. Ambiguidade vai para conciliação, sem preenchimento automático por nome parecido.

Não usar dados do e-ORBIT com identificador legado sem resolver a pendência documental existente. O funil comercial pode operar com inscrição pendente enquanto a matrícula aguarda conciliação.

### 9.3 Reutilizar a ponte Fato & Ordem

Preservar `vertice-learning-bridge` e as estruturas privadas existentes. A ponte atual usa identificação específica por IES e controles de escopo. Não criar chave paralela nem expor identificadores pessoais para publicidade.

Antes de ativar a continuidade:

1. Confirmar integração e escopo da IES em ambos os sistemas.
2. Confirmar vínculo de aluno/curso/período por fonte autorizada e correspondência recíproca.
3. Demonstrar um evento sintético de ponta a ponta e depois um teste real autorizado.
4. Preservar consentimentos e regras de acesso por curso/turma/disciplina.
5. Manter agregações com limiar de privacidade e denominador definido. A estrutura atual de métricas possui limiar mínimo de cinco participantes, que deve ser preservado ou revisado formalmente, nunca reduzido por conveniência visual.

### 9.4 Permanência

Ativação do aluno, início das aulas e participação são sinais diferentes. Falta de login não prova evasão. Toda sinalização deve trazer janela temporal, fonte, cobertura e regra. Permitir avaliação humana e plano de acolhimento; não tomar decisão acadêmica de alto impacto apenas por score automático.

Comparar coortes equivalentes por IES, curso e período. Não calcular retenção apenas subtraindo totais de matrículas de semestres diferentes. Registrar transferências, reingressos e perda de cobertura.

## 10. Métricas e atualização

### Definições mínimas

| Indicador | Definição/condição |
|---|---|
| Leads recebidos | IDs únicos de lead da fonte no intervalo; excluir testes e duplicatas. |
| Pessoas identificadas | Contatos conciliados dentro da IES; não assumir equivalência com quantidade de formulários. |
| Atendimento iniciado | Evento de atendimento com timestamp; mensagem apenas aceita não prova conversa. |
| Inscrições | IDs únicos de inscrição confirmados pela fonte no recorte. |
| Matrículas confirmadas | Vínculos acadêmicos confirmados, com critérios e estornos explicitados. |
| Conversão da coorte | Matrículas atribuídas à coorte de leads ÷ leads elegíveis da mesma coorte. Mostrar janela de observação e pendências. |
| Gasto | Valor e moeda informados pela conta de anúncios; sem conversão cambial implícita. |
| CPL | Gasto do recorte compatível ÷ leads do mesmo recorte. Sem denominador: não calculável. |
| Custo por matrícula atribuída | Gasto elegível ÷ matrículas atribuídas pela regra declarada. Não equivale a custo total de aquisição institucional. |
| Tempo de primeira resposta | Primeiro atendimento válido menos recebimento do lead; fuso e horário comercial declarados. |
| Retenção/permanência | Coorte e vínculo acadêmico elegíveis, período de observação e regra explícitos. |

### Estado temporal por fonte

Exibir pelo menos `source_occurred_at`, `received_at`, `last_successful_sync_at`, `last_attempt_at`, `data_through` e `queried_at` quando disponíveis. Falta de informação aparece como “não informada”, nunca como agora.

“Tempo real” é uma meta operacional mensurável, não garantia absoluta. Webhook pode atrasar; relatórios de anúncios podem ser revisados. Definir SLO após piloto, por exemplo tempo entre recebimento e disponibilidade no BI, sem confundir com latência do provedor. O painel deve indicar atual/parcial/atrasado/indisponível e a idade do dado.

Atualização da tela pode usar invalidação após evento, subscrição autorizada ou polling moderado. Parar polling quando a aba estiver oculta; descartar respostas de IES/período anteriores. Trocar IES deve limpar dados e rascunhos da tela antes da nova consulta.

## 11. Segurança, privacidade e permissões

### Papéis propostos, a validar com os existentes

- **Master:** administrar escopos e implantação, sem dispensar MFA ou consentimentos.
- **Gestor da IES:** configurar campanhas/conexões da própria instituição e autorizar operações previstas.
- **Atendente de captação:** consultar somente contatos atribuídos/permitidos, registrar atendimento e enviar dentro das regras.
- **Analista:** indicadores agregados, sem exportação nominal por padrão.
- **Equipe acadêmica:** confirmar inscrição/matrícula e analisar permanência no curso permitido; não recebe credenciais sociais.
- **Worker de integração:** acesso mínimo às operações e IES do trabalho validado, sem endpoint público de administração.

Não criar novos vínculos, papéis ou contas nesta entrega. Alterações de acesso devem passar por confirmação e trilha de auditoria apropriadas.

### Controles obrigatórios

1. RLS e/ou RPC validam IES e papel no servidor; filtro no React é insuficiente.
2. MFA para funções gerenciais. Sessão expirada bloqueia escrita sem perder silenciosamente rascunho.
3. Cofre de segredos, rotação e revogação. Segredos não aparecem em Git, logs, exportações, URLs ou localStorage.
4. URLs e campos livres validados; renderizar texto escapado. Proteção contra XSS, SSRF e injeção de fórmula em CSV.
5. Minimização: captar contato necessário, não documento, histórico médico ou dados acadêmicos para segmentação de anúncios.
6. Dados de menores exigem tratamento e autorizações específicos. Não presumir maioridade nem enviar informação não pública de menores a provedores por padrão.
7. Definir retenção por finalidade e evidência, com revisão jurídica. Não inventar prazo legal universal. Separar retenção de auditoria, consentimento, contato e webhook bruto.
8. Direitos do titular, correção, supressão, exportação autorizada e exclusão propagada aos sistemas pertinentes. Backups e restrições de retenção devem ser documentados.
9. Hash de e-mail/telefone/CPF não torna automaticamente o dado anônimo. Não enviar identificadores, mesmo hash, para redes de anúncios sem base e autorização específicas.
10. Logs sem PII/segredos; auditoria nominal restrita quando necessária. Alertas operacionais usam IDs técnicos e contagens.

## 12. Plano de implementação em fases

### Fase 0 — Reconstituir a versão correta

Conferir main, branches de release, PRs abertas, build real e esquema remoto. Extrair ZIP e aplicar overrides. Recuperar DDL completo das conexões de 09/11. Não mesclar PR antiga só para obter um arquivo já presente.

**Saída:** inventário versionado, baseline de testes e mapa de compatibilidade. Nenhuma mutação de produção.

### Fase 1 — Preparação por IES

Implementar cadastro seguro de metadados sociais e campanhas, estados honestos, UI guiada e validação de URL/IDs. Rascunhos técnicos deste pacote apoiam esta fase, mas não são toda a solução.

**Saída:** gestor organiza ativos e campanhas sem credenciais, envio ou ingestão; testes de isolamento e atualização concorrente aprovados.

### Fase 2 — Primeira integração real, uma IES piloto

Após confirmação da credencial/acesso persistente, configurar um provedor, autorizar ativos, receber webhook sintético, normalizar e reconciliar. Implementar revogação e recuperação de falha antes de ampliar.

**Saída:** um lead de teste percorre origem → recepção → fila → BI com IDs e timestamps verificáveis. Sem mensagem automática.

### Fase 3 — Segundo provedor e relatórios

Aplicar o mesmo contrato ao outro provedor. Integrar gastos, moeda, período, paginação e revisões. Homologar comparação entre plataformas sem duplicar pessoas ou conversões.

### Fase 4 — Atendimento WhatsApp

Conectar conta/número autorizado, templates e consentimento. Implementar preview, autorização de envio, supressão e tratamento de resultado incerto. Piloto com destinatários de teste autorizados antes de qualquer comunicação real.

### Fase 5 — Inscrição e matrícula

Mapear fornecedor acadêmico, cursos e chaves da IES. Receber evidências de matrícula, rejeitar ambiguidade e registrar correções. Não modificar matrícula acadêmica como efeito de um evento comercial.

### Fase 6 — Permanência e aprendizagem

Reutilizar a ponte Fato & Ordem, validar vínculo recíproco e eventos reais autorizados. Comparar fontes equivalentes, respeitar limiar de privacidade e demonstrar segregação entre IES.

### Fase 7 — Operação autônoma

Entregar assistente guiado, runbook de reconexão, fila de erros, monitoramento, exportações permitidas, trilha de auditoria e treinamento. O gestor não precisa de desenvolvedor para cada campanha; aprovação do aplicativo, manutenção de API e incidentes continuam responsabilidades técnicas.

## 13. Testes e critérios de aceite

### Segurança e isolamento

- IES A não lê, altera, exporta ou dispara mensagens da IES B, incluindo acesso direto à API.
- Um mesmo ID externo em contas/IES diferentes não causa colisão.
- Sem MFA, sem papel ou IES inativa: operações gerenciais recusadas.
- Atendente não altera OAuth/credencial; analista não obtém contatos privados.
- URL/ID adulterado no callback/webhook não escolhe o tenant.
- Segredos ausentes nos bundles, respostas, snapshots de teste e logs.

### Ingestão e falhas

- Mesmo webhook repetido 100 vezes resulta em um evento lógico.
- Dois workers concorrentes preservam uma gravação por chave.
- Falha antes/depois de commit, timeout, 429, 401, 403 e 5xx têm estados/retries corretos.
- Última página vazia, cursor repetido, empate de timestamp e evento fora de ordem não perdem nem duplicam dados.
- Revogação interrompe novas consultas/envios e aparece no painel.
- Dados de teste nunca entram em indicadores reais.

### UI

- Desktop e celular, navegação por teclado, labels, foco e mensagens de erro acessíveis.
- Voltar/Avançar, fechar/reabrir, clique repetido e troca de IES durante requisição.
- Erro de consulta não vira zero; falta de dado não vira demonstração fictícia.
- Última consulta e última sincronização aparecem com significados distintos.
- Link copiado aponta para o destino correto e não contém dados pessoais ou segredos.

### Jornada e mensageria

- Sem consentimento/finalidade adequada: envio bloqueado.
- Opt-out após enfileirar e antes de despachar: envio bloqueado.
- Fora da janela: regra/template vigente aplicada.
- Timeout de envio fica incerto e exige consulta, sem retry cego.
- Inscrição, pagamento e estágio manual não produzem matrícula confirmada sem evidência.
- Correspondência acadêmica ambígua fica pendente; nenhuma fusão por nome.

### Critério de liberação

Só declarar “integrado e funcional” depois de identificar versão, ambiente, IES, teste executado, resultado esperado/observado e evidência reproduzível. Build aprovado não é teste autenticado; função ACTIVE não prova dados sincronizados; mensagem aceita não prova entrega; deploy live não prova isolamento.

## 14. Roteiro executável para o ambiente Cloud

### 14.1 Preparação local, sem produção

O pacote não contém credenciais, dados de alunos ou acesso concedido a provedores. Usar a conexão GitHub autorizada do proprietário. Não buscar segredos em histórico, logs ou arquivos de outro ambiente.

```bash
git clone https://github.com/vrcmeirelles-del/vertice-educacao-superior.git
cd vertice-educacao-superior
git fetch origin
git status --short --branch
git rev-parse origin/main
git switch -c feat/captacao-integrada-ies origin/main

# Ler README e instruções atuais antes de executar o projeto.
# Conferir AGENTS.md e .agents/skills quando existirem.
mkdir -p .captacao-build
unzip -qo vertice-servidor-source.zip -d .captacao-build
cp -a source-overrides/. .captacao-build/
cp -a supabase .captacao-build/
cd .captacao-build
npm ci --legacy-peer-deps --no-audit --no-fund --cache ../.npm-cache
npm run check
npm test
npm run build:static
```

Na inspeção desta entrega, a tentativa de instalação local com cache padrão falhou ao criar `/home/agent/.npm`; não foi falha atribuída ao código. Usar cache gravável, como no comando acima. Não alterar o lockfile só para esconder uma falha de ambiente.

O build de produção possui histórico de sobreposições de branch release. O workflow `.github/workflows/verify-enade-cross.yml`, por exemplo, aplica arquivos de `release/novo-instrumento-20261107`. **Consultar a configuração atual do serviço antes de concluir que o build local equivale ao publicado.** Não aplicar essa branch cegamente se a configuração tiver mudado.

### 14.2 Copiar rascunhos de forma controlada

1. Ler o manifesto do pacote e os limites de cada arquivo.
2. Comparar com a main atual antes de copiar.
3. Aplicar rascunhos em branch de trabalho, nunca diretamente na main.
4. Executar testes locais de TypeScript e SQL com dados sintéticos.
5. Revisar RLS, grants, funções e schema privado. Não aplicar o SQL remotamente apenas por estar neste pacote.
6. Produzir PR em rascunho e relatório de validação.

### 14.3 Passagem à produção

Requer decisão explícita de implantação e confirmações específicas para acesso persistente/credenciais. Conferir destino Render e Supabase. Revisar migrações e backups, aplicar em homologação, verificar isolamento e só então executar rollout autorizado.

Antes de merge: commit remoto correto, CI do mesmo commit, testes do build efetivo e lista de limitações. Depois: verificar deploy, assets, tela autenticada e fontes. Não declarar sucesso só por receber resposta de criação do deploy.

## 15. Operação, monitoramento e reversão

- Flags independentes para interface, coleta, métricas, WhatsApp e ponte acadêmica. Despacho externo desligado por padrão durante implantação.
- Dashboards técnicos com idade do último evento/sync, falhas por provedor, tamanho da fila, duplicatas, rejeições e taxa de sucesso. Alertas não incluem contatos.
- Runbook: autorização expirada → informar gestor → reconectar pelo fluxo oficial; não recriar token silenciosamente.
- Pausar coleta sem apagar histórico. Revogar interrompe acesso e remove/invalida a credencial conforme política, preservando auditoria mínima necessária.
- Rollback: desativar feature/worker e reverter versão de código; não apagar leads nem restaurar banco inteiro automaticamente. Migrações aditivas permanecem até revisão de reversão segura.
- Reprocessamento deve ser idempotente, por IES e intervalo explícitos, com prévia de impacto e preservação de evidências.
- Registro de incidente distingue perda, atraso e indisponibilidade. Não prometer recuperação de eventos que o provedor já não disponibiliza.

## 16. Pendências e decisões necessárias

1. Identificar exatamente qual ambiente “Cloud” receberá o pacote e quais ferramentas já existem nele. Não pressupor fornecedor.
2. Confirmar IES piloto e pessoas autorizadas a administrar contas sociais e WhatsApp.
3. Identificar aplicativos Meta/TikTok existentes, titularidade, revisão, capacidades e permissões. Não criar outro aplicativo antes dessa conferência.
4. Confirmar a conta/número WhatsApp e a política de consentimento, templates e custos.
5. Recuperar DDL completo das conexões atuais e definir reaproveitamento de cofre/worker sem duplicar a frente acadêmica.
6. Definir página de destino/formulário, política de privacidade e textos por finalidade.
7. Definir sistema acadêmico piloto, identificadores, cursos/ofertas e evidência de matrícula.
8. Resolver correspondências institucionais pendentes antes de integrar dados legados.
9. Definir janelas de atribuição, fusos, moedas, retenção e SLO após piloto.
10. Confirmar workspace/serviços antes de qualquer publicação. Nenhuma confirmação foi obtida nesta entrega.

As fases sem credenciais podem avançar com cenários sintéticos. Não precisam aguardar todas as decisões comerciais. As ações externas e concessões de acesso permanecem bloqueadas até a autorização pertinente.

## 17. Prompt de continuidade para o executor

> Trabalhe no repositório existente vrcmeirelles-del/vertice-educacao-superior. Leia esta arquitetura, o manifesto e as instruções atuais do checkout. Confira main, PRs abertas, fonte ZIP, overrides, esquema Supabase e configuração real de build antes de alterar. Não crie um projeto paralelo. Priorize a Fase 0 e a Fase 1 com dados sintéticos, mantendo a distinção entre configuração preparada e conexão real. Os rascunhos anexos não foram aplicados nem publicados. Preserve o BI existente, a ponte Fato & Ordem e a segregação por IES. Não use nome/e-mail para unir instituições ou matrículas. Não exponha dados pessoais, não busque segredos, não crie credenciais ou conceda acesso persistente sem confirmação específica. Não envie mensagens, ative campanhas ou altere matrículas. Proponha/aplique apenas as alterações autorizadas para a fase atual. Execute testes de segurança, concorrência, falhas e UI; diferencie teste passado, falho e não executado. Abra PR em rascunho quando autorizado e entregue versão, arquivos, comandos, resultados, bloqueios e o próximo passo exato. Só declare integração real após teste rastreável entre origem e destino.

## 18. Fontes e evidências

- Repositório e README: https://github.com/vrcmeirelles-del/vertice-educacao-superior
- BI existente: https://github.com/vrcmeirelles-del/vertice-educacao-superior/blob/7105e2a7ae1d99780acb3fd2c1909683b6040359/source-overrides/client/src/components/area/CaptacaoBI.tsx
- Modelo de captação: https://github.com/vrcmeirelles-del/vertice-educacao-superior/blob/7105e2a7ae1d99780acb3fd2c1909683b6040359/supabase/migrations/20261104001000_captacao_bi.sql
- Conector existente: https://github.com/vrcmeirelles-del/vertice-educacao-superior/blob/7105e2a7ae1d99780acb3fd2c1909683b6040359/supabase/functions/vertice-conexao/index.ts
- Ponte acadêmica: https://github.com/vrcmeirelles-del/vertice-educacao-superior/blob/7105e2a7ae1d99780acb3fd2c1909683b6040359/supabase/functions/vertice-learning-bridge/index.ts
- Fonte de build/overlay: https://github.com/vrcmeirelles-del/vertice-educacao-superior/blob/7105e2a7ae1d99780acb3fd2c1909683b6040359/.github/workflows/verify-enade-cross.yml
- Verificações de banco: consultas agregadas somente leitura no projeto Vértice em 10/11/2026. As contagens são um retrato da consulta, não previsão do estado futuro. Nenhum contato ou identificador pessoal foi incluído neste documento.

Documentação oficial dos provedores e checklist de revalidação estão no anexo `REQUISITOS_PROVEDORES.md`. APIs e regras podem mudar; confirmar a versão aplicável antes de implementar ou autorizar.

## 19. Rascunhos técnicos anexos e validação executada

Foram preparados cinco arquivos novos de apoio, sem alterar arquivos existentes do produto:

- `source-overrides/client/src/lib/captacao-integrada.ts`
- `source-overrides/client/src/lib/captacao-integrada.test.ts`
- `supabase/migrations/20261110120000_captacao_integrada_draft.sql`
- `supabase/tests/captacao_integrada.sql`
- `supabase/tests/captacao-integrada.test.mjs`

Eles representam somente preparação de metadados de conexão e campanha. Não incluem interface final, OAuth, cofre novo, ingestão, contatos, consentimentos, fila, envio, métricas de anúncios ou vínculo acadêmico. A biblioteca marca essas capacidades como não implementadas.

O rascunho inicial permite uma configuração por IES/provedor, com várias campanhas. Para suportar várias contas/páginas na mesma rede, evoluir o vínculo para `connection_id` e tabela de ativos antes da produção. Ainda faltam controle CAS, idempotência de criação de campanha e migração reproduzível sobre o esquema remoto completo. Não apresentar esse recorte como implementação integral da Fase 1.

**Validação executada em 10/11/2026:**

- 18 testes unitários passaram para validação de URLs e capacidades declaradas, com Vitest 2.1.9.
- Type-check isolado da biblioteca passou com TypeScript 5.6.3 e cliente Supabase substituído por stub; não comprova tipagem completa da aplicação.
- Migração e testes transacionais passaram em PostgreSQL/PGlite 0.5.16 local, incluindo MFA, ACL, perfis, isolamento entre IES, IES arquivada, proibição de falsificar verificação/sincronização e invalidação após edição. O harness usa fundação e helpers do repositório, sem reproduzir toda a infraestrutura Supabase.
- Os testes foram repetidos com sucesso durante a preparação deste pacote. Nenhuma consulta real a provedor foi realizada por eles.
- Build completo, tela autenticada, implantação e testes de produção desta nova frente **não foram executados**. A instalação inicial de dependências do runtime completo falhou no cache padrão, como descrito na seção 14.

O `LEIA-ME.md` do pacote explica a reprodução e os limites. A presença de arquivo SQL não autoriza sua execução em produção.
