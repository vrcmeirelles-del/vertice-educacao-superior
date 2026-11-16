# Sapiens — interpretação de planejamentos

A função existente `vertice-sapiens-analyze` aceita `action: planning`. A autenticação do usuário é verificada e o contexto é coletado por RPC com o token do próprio usuário. Na evolução proposta, gestão institucional autorizada e coordenação/NDE com vínculo ativo e explícito de curso acessam somente os recortes permitidos, com segundo fator. O cliente não fornece dados analíticos nem resultados. Educação Superior usa os planejamentos versionados por curso e a consolidação acadêmica; Escolas usa planejamento institucional, metas, ações e ENEM disponível. Rascunhos permanecem identificados e versões arquivadas são excluídas.

O gerador e o revisor usam os provedores já presentes no Sapiens. A revisão usa exclusivamente o outro provedor; indisponibilidade ou formato inválido é registrado como revisão independente não disponível, nunca como aprovação. Resultados persistem em `vertice_sapiens_planning_analyses`, com contexto original, hash SHA-256, modelos, horário, autor e decisão humana. Escrita de resultado é exclusiva da credencial de serviço. O parecer permanece `pending_review` mesmo quando a revisão por IA recomenda prosseguir. Uma revisão humana não publica planos nem cria metas, ações ou intervenções.

A interface aparece nos planejamentos (botão “Análise interpretativa · Sapiens”), nas consolidações e no Sapiens, aba “Planejamentos”. O histórico da evolução proposta filtra instituição, curso e período antes do limite de vinte pareceres. Alterações após a geração exigem nova análise. Recortes acima de 180 mil bytes de contexto ou dos limites de catálogo/resultado exigem escolha de curso, sem truncamento silencioso. Planos não salvos não entram no contexto. Ausência de planos produz mensagem, sem consumo dos provedores.

Validação: testes de formato da IA, autorização antes de chamada externa e ausência de segundo provedor; testes de regressão dos editores e painéis; teste transacional de contexto, bloqueio concorrente, revisão humana e acesso anônimo. Evidência real de provedores deve ser conferida no histórico da instituição: existência de código/deploy não comprova geração bem-sucedida.

## Evolução proposta para revisão

A camada gerencial com vínculos explícitos objetivo–meta, fontes estruturadas, séries longitudinais e acesso por curso está descrita em [INTERPRETACAO_GERENCIAL.md](INTERPRETACAO_GERENCIAL.md). Essa evolução depende de autorização para integração e publicação; sua presença nesta branch não comprova ativação em produção.
