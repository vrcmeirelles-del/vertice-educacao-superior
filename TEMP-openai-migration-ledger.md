# Registro de escopo — correção Sapiens 360

Implementação autorizada pelo pedido do usuário em 14/11/2026: corrigir as duas funções, preservar dois provedores, tratar falhas, testar degradação/divergência, conferir rastreabilidade e revisão humana. Implantação exige autorização posterior. Etapa única desta alteração: recuperação de compatibilidade e contratos de execução; sem migração de provedor ou API.

Credenciais: nenhuma chave local OpenAI encontrada; nenhum segredo criado, alterado ou usado. O desenho mantém as variáveis existentes da aplicação. Testes exclusivamente simulados; acesso real fica para homologação autorizada.

| Tema avaliado | Aplicabilidade e decisão |
| --- | --- |
| Seleção de modelos | Preservar `gpt-4o` existente, ainda utilizável até a retirada anunciada; Claude passa a `claude-sonnet-4-6`, ativo. Overrides próprios do Sapiens; modelos retornados e pedidos auditados. |
| Arquivos de instruções | Nenhuma alteração. |
| Chat Completions / Responses | Manter Chat Completions nesta correção delimitada. Migração de API não solicitada; sem novo harness ou provedor. |
| Streaming | Não aplicável: geração/revisão dependem de JSON completo antes da persistência. |
| WebSocket | Não aplicável: requisições isoladas, sem ferramentas ou sessão persistente. |
| Privacidade / ZDR / residência | Preservar endpoints, contexto agregado e política atual; requisitos ZDR/região não foram verificados nem alegados. Sem novos dados de aluno ou retenção remota. |
| Tiers Standard/Priority/Flex/Batch/Reserved | Preservar comportamento existente; alteração comercial/de tier não solicitada. Fluxos manuais e de cron mantêm o mesmo transporte. |
| Cache: chaves, retenção estendida, breakpoints e diagnósticos | Não introduzidos: duas chamadas com contextos distintos, sem evidência de prefixo compartilhado que justifique nova política. Sem GPT-5.6+ ou Responses neste escopo. |
| Estado e persistência de instruções | Chamadas isoladas já enviam sistema/contexto completos; sem chaining, histórico ou IDs de resposta persistidos. |
| Reasoning: criptografia, esforço, preservação, resumos e preâmbulos | Sem itens de raciocínio ou histórico no contrato atual. Nenhuma mudança de capacidade/tier de raciocínio. |
| Verbosidade | Preservar limites e estrutura do produto; sem parâmetro novo. |
| Tokens máximos | Mantidos: 3000 diagnóstico, 4000 briefing. Respostas truncadas são recusadas explicitamente. |
| Fases de mensagem | Não aplicável: não há replay de mensagens de assistente ou loop de ferramentas. |
| Compactação | Não aplicável: duas chamadas isoladas e contexto agregado; sem conversa crescente. |
| Saídas estruturadas | JSON object OpenAI preservado; validação local adicionada para ambos os provedores. Notas, enum de divergência e recomendação obrigatórios. |
| Ferramentas: escolha, busca, adicionais, paralelismo, chamada programática e interfaces | Não aplicável: nenhum tool call ou executor no produto; geração precede revisão. |
| Diagnóstico manual / via sync | Mesmo handler; geração, revisão e fallback testados; inserções permanecem rascunho/proposta. |
| Briefing manual / via cron | Mesmo handler; geração, revisão e HTTP 503 sem gravação fictícia testados. |
| Limitações dos provedores | IDs e stops têm formatos distintos; request IDs normalizados; modelo retornado prevalece. Falhas não viram revisão concluída ou consenso. |

Evidências, fontes oficiais, configuração, comandos e limitações: [relatório de validação](docs/SAPIENS_PROVIDER_VALIDATION_20261114.md). Testes específicos: 101 aprovados. Portal: 408 testes, TypeScript e build aprovados. Pendências externas ao escopo: homologação real, bundle Deno, fluxo humano completo, retirada futura de GPT-4o e referências residuais de outros módulos listadas no relatório.
