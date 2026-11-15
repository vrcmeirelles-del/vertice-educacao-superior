# Área de acompanhamento da integração — publicação na Vértice

Destino autorizado nesta conversa: /integracao no serviço existente vertice-portal, workspace Virgílio Meirelles | Projetos. Base de implementação: Sites, Painel de Projetos versão 4 (d9f7ee4d8bf17d3668c26512ac346357c5fb0159). Base Vértice: cfd879ab7fd7e0930c7f37c8e7b39311d5d0e3bd.

O conteúdo existente foi incorporado à aplicação React da Vértice. Não há novo serviço, iframe, proxy ou credencial. O acesso usa o cliente Supabase já existente: usuário confirmado, MFA aal2 e consulta do próprio papel na tabela vertice_admins. Falha de verificação mantém o painel fechado; logout, troca de sessão e pagehide invalidam a montagem, com controle de respostas atrasadas. Dados locais são separados por usuário e pelo domínio; registros anteriores do Sites podem ser exportados e importados manualmente. Não há cópia automática entre origens.

A navegação Master passa a mostrar Integração F&O. /entrar?destino=integracao retorna a /integracao após o login. Prerender cria integracao.html e integracao/index.html com noindex e exclusão no robots.txt. O nome da rota deixa de cair no tratamento de slug institucional. A política connect-src inclui apenas api.github.com como nova origem para metadados públicos; a função de consulta usa credentials: omit. Nenhuma chave de GitHub é enviada.

Preservados: 19 módulos, metadados e histórico, modelo longitudinal/vertical, alertas sintéticos, recomendação e 5W2H, revisão de metas, decisões, checklists e importação/exportação. Textos foram ajustados ao contexto de área publicada; futuras publicações e ações continuam sujeitas a autorização explícita. Não há botões de merge, migração, banco, convite, configuração ou deploy.

Não foram realizadas migrações, alterações de dados acadêmicos, escritas no banco, convites ou configurações de credenciais. O acesso autenticado real do proprietário depende da sessão existente e não é criado em teste. Os testes usam somente mocks e valores sintéticos.

Verificação: TypeScript sem diagnósticos; 13 testes específicos passaram, incluindo negativas de acesso, MFA, ausência de papel, indisponibilidade, resposta atrasada após logout, pagehide e validação do pacote. Build estático concluído; HTML próprio de /integracao, CSP, noindex e robots.txt conferidos. Os 13 testes passam a integrar a suíte de contratos já executada no CI. Implantação deve ser conferida antes da entrega. A integração acadêmica ponta a ponta, persistência central e agendamento continuam pendentes de procedimentos próprios.

Reversão do código: reverter somente o commit desta publicação e aguardar o auto-deploy, preservando mudanças posteriores. Nenhuma migração ou dado exige reversão nesta entrega. Não restaurar uma versão antiga global sem considerar alterações concorrentes.
