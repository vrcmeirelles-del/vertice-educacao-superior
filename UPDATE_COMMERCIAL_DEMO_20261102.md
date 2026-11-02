# Experimente a Vértice

O endereço `/demonstracao` passa a apresentar uma experiência comercial guiada, com cenários fictícios de regulação e gestão, aquisições de instituições e captação/permanência. O painel demonstrativo anterior continua em `/painel` e demais rotas de gestão demonstrativa. Aquisições de IES e captação de alunos são percursos distintos.

O visitante explora sem cadastro. Pode ativar um percurso temporário de uma hora ou escolher memória de até 90 dias no mesmo navegador e domínio. A ativação da conversa OpenAI é separada; utiliza o modelo já adotado pela implantação (`gpt-4.1-mini`, substituível pela variável de servidor `VERTICE_DEMO_MODEL`), sem expor chave. O modelo recebe o cenário aberto, contexto declarado e interações permitidas, sem acesso a documentos ou instituições autenticadas. A aplicação solicita `store:false`. Respostas não são diagnósticos nem compromissos de contratação.

O serviço `vertice-demo` valida origem, limita corpo, usa capacidades aleatórias de 256 bits, armazena somente o hash do segredo e limita chamadas a 12 por percurso/dia e 100 conversas/dia no conjunto da demonstração. Inícios são limitados por hash diário de origem de rede e no conjunto. A projeção de páginas e eventos é fechada; não são capturados parâmetros, telas privadas, teclas ou conteúdo de outros formulários. O registro mantém as últimas 100 interações e até dez mensagens. Expiração bloqueia leitura; limpeza física ocorre na próxima operação da demonstração.

Antes do contato, o visitante revisa um briefing que separa declarações de navegação e confirma o compartilhamento. O registro de contato fica disponível por 90 dias. Há opção de abrir uma mensagem no aplicativo de e-mail para o endereço institucional previamente informado, sem envio automático pelo sistema. Não foi configurado número de WhatsApp.

Em Master → Demonstração · inteligência comercial, o responsável com MFA consulta até 200 percursos ativos autorizados, módulos explorados, solicitações e briefing revisado. Pode acompanhar atendimento como Novo, Em contato ou Concluído. As políticas do banco não permitem a leitura por visitantes ou contas sem perfil Master. O hash da capacidade não é concedido nem ao cliente Master. O recurso de apagar o percurso remove o contato vinculado e o segredo local.

Verificação: TypeScript, build estático com pré-renderização, testes de comportamento da demonstração e regressão de login, proprietário e IA documental. A integração pública é verificada separadamente com dados fictícios e remoção dos registros de teste.
