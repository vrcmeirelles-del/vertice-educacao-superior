# Qualidade da pré-análise documental — 27/11/2026

## Comportamento

A pré-validação continua determinística e sem transmissão a provedores. A versão
`regras-bm25@2026-11-27.1` inclui a política `qualidade-documental@2026-11-27.1`.
Nenhuma execução anterior, aprovação humana ou documento original é alterado
retroativamente. Não há migração nem nova tabela ou serviço.

O algoritmo suspende sugestões de indicadores quando a extração é parcial,
há páginas sem texto, alterações controladas ou comentários em DOCX, referência
textual a rasuras/versões divergentes, substituição cadastrada ou hash diferente
da extração anterior do mesmo arquivo. O gestor conserva a classificação manual.
Esses sinais são pendências de conferência, não provas de irregularidade.

O parser registra revisões inseridas/excluídas e comentários; comentários não
entram no corpo usado como evidência. A extração literal de alterações não aplica
nem aceita correções. SHA-256, páginas, sinalizadores e versão da política ficam
no registro de extração existente. A conclusão e os vínculos continuam usando a
transação e auditoria existentes. O painel explica a abstenção.

O algoritmo não detecta rasuras visuais ou manuscritos em PDF/imagens e não
certifica a fidelidade do OCR. Ausência de sinais não significa ausência de
rasuras. Nenhum OCR, modelo ou opção de IA é ativado por esta alteração.
O endpoint de completude `vertice-doc-analyze` não foi modificado; esta política
é aplicada à sugestão de indicadores em `vertice-doc-prevalidate`.

## Avaliação por consequências

`evaluateFields` compara campos contra referências humanas: alterações de número,
data, nome, vigência, código ou célula devem ser rotuladas pela gestão conforme
o impacto. Erros críticos limitam a nota a 50, maiores a 75 e menores a 95.
São pesos técnicos iniciais, não exigências do Inep nem limiares homologados.
Diferenças só de espaços e quebras de linha não geram erro; outras diferenças
benignas precisam ser explicitamente classificadas no gabarito humano.
Sem campos revisados, a nota é `null`, jamais 100 por ausência de informação.

O avaliador reporta precisão/recall de indicadores, abstenção, erros críticos,
concordância exata entre revisores e mediana do tempo de revisão observado.
Os resultados são separados por captura digital, digitalização e fotografia.
`production_validation` permanece falso: execução offline não homologa o fluxo
logado, permissões ou operação completa.

## Corpus real

Consulta agregada em produção em 27/11/2026: 777 arquivos no repositório (772 da
UNITOP), 11 documentos gerais, 5 arquivos com revisor cadastrado, nenhum documento
geral aprovado e 1 vínculo de indicador ainda sem revisão. Uma revisão do arquivo
não substitui duas anotações independentes de indicadores e campos críticos.

`scripts/document-benchmark-sample.sql` seleciona candidatos da instituição
informada, com corte em `2026-11-27T13:18:06.152796Z`, por hashes distintos,
ordenação reproduzível e estratos de método de extração. A consulta é somente
leitura e não exporta nomes, conteúdo ou caminhos de armazenamento. Os métodos
não distinguem, por si, fotografia de digitalização: essa confirmação é humana.
Executar dentro de uma sessão institucional autorizada com UUID em `$1`.
Não versionar no Git os originais, extrações ou rótulos pessoais dos revisores.

Seleção executada em modo somente leitura: 100 candidatos da UNITOP, todos com
hash distinto — 30 com OCR local anterior, 31 com camada textual PDF, 31 com
extração Office e 8 com extração falha. É uma lista de candidatos, não um corpus
rotulado nem uma medição de desempenho. O manifesto privado foi disponibilizado
ao responsável, sem corpo documental ou dados pessoais extraídos.

Para cada candidato, obter o original pela sessão existente, conferir o hash,
classificar o tipo de captura e colher duas revisões independentes, antes de
mostrar ao revisor as sugestões do algoritmo. Divergências exigem adjudicação com
autor, data, justificativa e resultado. Guardar original e versões separadamente;
não sobrescrever a transcrição nem incorporar rasuras automaticamente.

Formato adicional para cada documento do JSON aceito pelo avaliador:

```json
{
  "source_sha256": "64 caracteres hexadecimais do original",
  "kind": "scanned",
  "kind_confirmed_by": "identificador-do-revisor-A",
  "reviewed_by": ["identificador-do-revisor-A", "identificador-do-revisor-B"],
  "reviews": [
    {"reviewer_id":"identificador-do-revisor-A","reviewed_at":"data ISO real","expected":[]},
    {"reviewer_id":"identificador-do-revisor-B","reviewed_at":"data ISO real","expected":[]}
  ],
  "fields": [{"id":"data-ato","severity":"critical","expected":"referência humana","actual":"extração observada"}],
  "review_duration_ms": 1000
}
```

O exemplo é estrutural, não um documento ou medição real. Na raiz, declarar
`provenance: "real_documents"`; preservar também `catalogs`, `objects`, `id`,
`fileName`, `extraction` com hash, texto e páginas, e `expected` com códigos
completos `instrumento/versão/indicador`. Usar tempo observado, não o valor do
exemplo. Quando houver discordância, incluir `adjudication` com `reviewer_id`,
`reviewed_at`, `reason` e `expected` finais.

```sh
node scripts/evaluate-document-rules.mjs /caminho/privado/corpus.json --require-corpus
```

O modo exige ao menos 100 originais de hash distinto, as três modalidades de
captura, confirmação do tipo, duas revisões documentadas, campos críticos e hash
da extração igual ao do original. Identificadores de revisores são declarações
do corpus, não autenticação de identidade pelo avaliador offline.

A medição real permanece pendente: não foram fabricadas revisões, fotografias
ou resultados de acurácia. Os testes automatizados usam fixtures sintéticas.
As associações regulatórias preservam o catálogo e a versão de cada instrumento;
esta política de qualidade não cria exigência MEC/INEP nem promove propostas de
instrumento 2026 à condição de norma vigente.

## Verificação da implementação

- Suíte documental Node: 51 testes passaram; após acrescentar o teste de cache
  e continuidade da advertência entre indexação e análise, os 10 testes afetados
  (qualidade e confiabilidade) passaram. Total final da suíte: 52 casos.
- Interface: 5 testes passaram, incluindo apresentação da abstenção e restrição
  das colunas retornadas ao navegador.
- TypeScript do portal: aprovado após instalar as dependências do lockfile atual.
- Vite e pré-renderização: aprovados, 15 páginas públicas e 20 áreas demonstrativas.
- Deno 2.9.6: verificação de tipos aprovada com mapa local para os módulos e
  declarações instaladas; o acesso direto ao registro npm não concluiu e foi
  interrompido. Parser PDF real: 1 teste passou sem FFI, com fixture sintética.
  Avisos de canvas/fontes referem-se à renderização, não usada pela extração textual.
- Não foi executada homologação autenticada de ponta a ponta nem avaliação
  de acurácia nos 100 documentos reais, que ainda dependem das revisões humanas.
