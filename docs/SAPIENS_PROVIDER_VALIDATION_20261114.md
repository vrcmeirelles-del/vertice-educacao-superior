# Sapiens 360 — correção de provedores e validação local

Base: `cfd879a` (main, incluindo PRs #128 e #129). Data: 14/11/2026.
Estado: alteração local testada; sem merge, implantação ou chamadas reais aos provedores.

## Modelos e comparação com as correções existentes

| Provedor | ID padrão nesta correção | Evidência oficial consultada |
| --- | --- | --- |
| OpenAI | `gpt-4o` | Catálogo da API e página de deprecações; permanece utilizável em 14/11/2026. A família tem desligamento anunciado para 14/01/2027. Preservado o modelo existente; esta correção não migra a API nem a família OpenAI. |
| Anthropic | `claude-sonnet-4-6` | ID oficial da Claude API, ativo/legacy, com retirada não antes de 17/02/2027. Substitui o Sonnet 4 desativado sem adotar mudanças do Sonnet 5.5 nesta correção. |

Referências oficiais:

- https://platform.claude.com/docs/en/about-claude/model-deprecations
- https://platform.claude.com/docs/en/models/sonnet-4-6/overview
- https://platform.claude.com/docs/en/api/errors
- https://developers.openai.com/api/docs/models/gpt-4o
- https://developers.openai.com/api/docs/deprecations
- https://developers.openai.com/api/docs/guides/error-codes

A correção Fato & Ordem `8a06fa5` priorizou OpenAI e acrescentou diagnóstico de falhas. A leitura atual de `server.mjs`, linhas 106–122, confirmou OpenAI/`gpt-4.1-mini` como primário, porém o fallback Anthropic ainda contém Sonnet 4 desativado. Não copiamos esse fallback. Na Vértice, `vertice-base-assistant` já utiliza seleção por ambiente, resposta incompleta explícita e revisão humana nas instruções; esses princípios foram considerados, preservando o desenho dual do Sapiens.

Referências residuais fora do escopo: fallback de `fato-e-ordem/server.mjs` e metadado padrão em `source-overrides/ai-backend/impacto-analysis.ts:95`. Esta alteração não corrige nem homologa esses outros caminhos.

## Comportamento implementado

As duas funções usam `functions/_shared/sapiens-llm.ts`. A OpenAI gera; a Anthropic revisa. O roteamento depende do provedor efetivo, não do prefixo textual do modelo. Há uma segunda passagem pelo mesmo provedor quando necessário, identificada como `same_provider`, com `independent: false`.

| Situação | Diagnóstico | Briefing |
| --- | --- | --- |
| Ambos configurados e disponíveis | Geração OpenAI e revisão Anthropic | Mesmo fluxo |
| Apenas OpenAI | Duas passagens OpenAI; revisão não independente | Mesmo fluxo, seção identificada |
| Apenas Anthropic | Duas passagens Anthropic; revisão não independente | Mesmo fluxo, seção identificada |
| Falha no gerador primário | Tenta o alternativo, incluindo erros de transporte | Mesmo fluxo |
| Revisor indisponível/inválido | Segunda passagem; se falhar, revisão `unavailable`, divergência `unknown` | Mesmo fluxo, com aviso visível |
| Ambos indisponíveis | Registro `fallback-rule`, rascunho, sem intervenção inventada | HTTP 503 `llm_unavailable`, sem salvar briefing |
| Divergência `major` ou recomendação de rejeição | Aviso de revisão humana; permanece `draft` | Aviso e seção de validação humana |

Falhas distinguem chave ausente, modelo retirado, autenticação, 404, limite 429, indisponibilidade 5xx/529, rede, timeout, JSON inválido, resposta incompleta/recusada e metadado de modelo ausente. Não há retry automático contra um provedor com falha de transporte/HTTP no mesmo pedido. Timeout individual: 30 segundos; no máximo três chamadas externas por documento. Diagnósticos de vários módulos compartilham o bloqueio apenas durante a mesma requisição.

O modelo pedido, o modelo retornado, o provedor, o estágio, o status HTTP e o ID da requisição ficam em `attempts`. `llm_model` usa os IDs completos devolvidos pelas respostas válidas; modelos de tentativas malsucedidas não são apresentados como revisores concluídos. Não são gravados segredos, prompts, corpos de erro nem mensagens brutas de exceções na telemetria.

`contradictory_checked` só é verdadeiro com revisão validada. Notas de indisponibilidade não contam como revisão executada. Metadados ficam no JSON existente do diagnóstico, na seção de revisão do briefing e na trilha de auditoria, sem nova migração.

Decisões: diagnósticos continuam `draft`, intervenções continuam `proposed`, sem `reviewed_by` automático, aprovação ou envio ao Fato & Ordem. Diagnósticos gerados e degradados recebem `requires_human_review: true` e `human_review_status: pending`; briefings exigem validação humana antes das decisões. Isso verifica o comportamento destas funções; não constitui homologação de todo o fluxo de aprovação do portal.

## Configuração

- Chaves existentes: `OPENAI_API_KEY` e `ANTHROPIC_API_KEY`, sem alteração ou criação de credenciais.
- Overrides opcionais: `SAPIENS_OPENAI_MODEL` e `SAPIENS_ANTHROPIC_MODEL`.
- Omitir overrides utiliza os padrões acima. IDs retirados conhecidos do Sonnet 4 são rejeitados localmente. Outros overrides passam pela API e pela validação explícita; sua simples configuração não comprova compatibilidade ou acesso pela conta.
- Nenhum parâmetro novo de retenção, região, tier ou armazenamento remoto foi ativado.

## Resultados

| Verificação | Resultado observado |
| --- | --- |
| Testes específicos do motor e handlers reais, com HTTP e Supabase simulados | 101 passaram; zero falhas |
| TypeScript estrito do motor compartilhado | Aprovado |
| TypeScript dos handlers, com alias local do módulo Supabase instalado | Aprovado; não substitui verificação/bundle no Deno |
| TypeScript do portal composto | `npm run check`: aprovado |
| Suíte geral do portal composto | `npm test`: 408 passaram em 50 arquivos |
| Build estático do portal composto | `npm run build:static`: aprovado; aviso de tamanho de chunks |
| Whitespace/diff | `git diff --check`: aprovado |

Comando reproduzível para os testes específicos (Node >=22.18):

```sh
node --experimental-vm-modules --test scripts/tests/sapiens-providers.test.mjs
```

O teste executa os fontes TypeScript das funções através de módulos VM, interceptando apenas os limites externos. Confere os payloads de inserção e a auditoria. Não grava em PostgreSQL real. O workflow novo repete esses testes em Node 22.18 e 24; o resultado remoto deve ser consultado na PR.

Para a suíte geral: extrair `vertice-servidor-source.zip`, sobrepor `supabase/functions/` e depois `source-overrides/`, instalar as dependências do lockfile e executar os três comandos do portal. Na execução local foram reutilizadas dependências já instaladas em outro diretório de validação, incluindo `pdf-lib`.

## Antes de implantar

Não foram executadas chamadas reais à OpenAI/Anthropic, bundle Deno, persistência em banco hospedado ou homologação de aprovação humana. Os testes simulados não comprovam acesso aos modelos pela organização, saldo, latência real, qualidade pedagógica ou implantação atual.

Após autorização específica para homologação/implantação: conferir segredos e overrides do ambiente-alvo; preparar as duas funções junto do arquivo compartilhado; verificar o bundle Deno; usar instituição e dados sintéticos; executar uma geração e revisão reais; conferir IDs dos modelos nos registros; exercitar a aprovação humana com perfis autorizados; somente então liberar o fluxo. Não fundir esta PR nem implantar funções sem a autorização solicitada pelo usuário.
