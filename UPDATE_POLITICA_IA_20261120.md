# Política de IA: algoritmo como padrão (20/11/2026)

O algoritmo é o caminho padrão em todo o portal. A IA fica reservada às tarefas em que não há algoritmo viável e o ganho é alto. Mesmo nesses casos, ela só é chamada por ação explícita do usuário.

## Como funciona

Cada função do portal declara quais funções de IA pode usar. Uma chamada a OpenAI, Anthropic ou Gemini só sai se:

1. a chave geral estiver ligada (`AI_SUSPENDED=false`; continua suspensa desde 19/11/2026); **e**
2. a função estiver na lista `AI_FEATURES`.

Se `AI_FEATURES` não estiver definida, valem as quatro funções aprovadas:

| Função (`AI_FEATURES`) | Onde | Por que IA |
|---|---|---|
| `discursiva.transcribe` | Discursiva: transcrição de prova manuscrita | Não há OCR confiável para letra cursiva |
| `discursiva.generate` | Discursiva: geração de questão e rubrica | É trabalho de autoria, sem equivalente algorítmico |
| `discursiva.second_opinion` | Discursiva: segunda opinião na correção | Só a pedido do docente, ao lado da pré-nota do algoritmo |
| `cpa.analysis` | CPA: redação das seções 9, 10 e 12 | O relatório já sai completo pelo algoritmo; a IA só melhora a redação |

Todo o resto roda por algoritmo, **mesmo com a IA religada**: análise de documentos, Impacto, Sapiens, revisão do curso, Base da organização, demonstração comercial, pré-validação, correspondência 2017→2026, leitura de certificados e briefing. Antes desta mudança, religar a IA fazia essas tarefas voltarem a chamá-la.

Para usar IA também numa tarefa rotineira, é preciso incluí-la de forma explícita em `AI_FEATURES` (por exemplo, `doc.analyze`). A configuração fica no Supabase, sem novo deploy.

## Discursiva

- **Correção:** a pré-nota é sempre do algoritmo (modelo treinado, quando aprovado nas travas; senão, regra). O botão passou de "Corrigir com duas IAs" para "Gerar pré-nota (algoritmo)".
- **Segunda opinião:** quando liberada, aparece o botão "Pedir segunda opinião (IA)". As duas IAs corrigem, e o resultado fica ao lado da pré-nota, com a distância entre as duas. A pré-nota não é substituída.
- **Transcrição e geração:** quando desligadas, os botões aparecem desativados e explicam como seguir sem IA.
- **Nova ação `status`:** informa ao portal quais funções de IA estão liberadas.

## Para ativar as funções aprovadas

No Supabase, em Edge Functions > Secrets, defina `AI_SUSPENDED=false`. Para restringir a lista, defina também `AI_FEATURES`, por exemplo `discursiva.transcribe,discursiva.generate`. As chaves `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` precisam estar configuradas.

Situação em 20/11/2026: tudo desligado, por decisão do responsável, até a plataforma gerar receita.
