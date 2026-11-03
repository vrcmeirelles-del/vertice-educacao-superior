# Manifesto OPC: reprodução e correção

O código d6cc692 declarava `/vertice/template.json` como `application/json`, mas não criava relacionamento OPC. Reproduzido em fixture sintética: ZIP contém a parte; `python-docx 1.2.0`, percorrendo `Document(path).part.package.parts`, não a encontra. Não foi tratado como falso positivo.

Correção: relacionamento interno no pacote (`_rels/.rels`) com tipo `https://verticesuperior.com.br/relationships/document-template`, Target `vertice/template.json` e ID único, preservando relações existentes. O URI do tipo identifica a relação; não é acessado pela ferramenta. O manifesto permanece JSON e não se apresenta como customXml. Preparação e download exigem relação única interna, ID sem colisão e declaração MIME correta. Templates antigos sem relação devem ser regenerados da fonte revisada; não há reparo silencioso no download.

Referência OPC: https://learn.microsoft.com/en-us/previous-versions/windows/desktop/opc/relationships-overview

## Evidência

- Antes: manifesto presente no ZIP, ausente do grafo OPC.
- Depois: três fixtures (normal, sem logo, texto longo) passaram em `scripts/branding/check-manifest-opc.py`, leitor independente python-docx.
- Comparação ZIP antes/depois das três saídas: somente `_rels/.rels` mudou. Corpo, tabelas/células, fontes e todas as demais partes idênticas.
- Deno check aprovado e 10 conjuntos de testes aprovados, incluindo negativos: manifesto órfão, relação duplicada, alvo externo/incorreto, ID duplicado, MIME incorreto; colisão legítima de ID recebe novo ID sem sobrescrever o anterior.
- LibreOffice 7.4 abriu e renderizou as três variantes. PNGs de todas as páginas antes/depois idênticos por `cmp`; primeira página normal também inspecionada visualmente.
- App/SQL não mudaram neste patch; seus 149 testes e seis cenários ACL anteriormente aprovados não foram repetidos.

Comandos (Deno no PATH, DENO_DIR=/tmp/vertice-deno-cache):

```sh
deno check --frozen --lock=supabase/functions/vertice-inep-library/deno.lock supabase/functions/vertice-inep-library/index.ts
deno test --frozen --lock=supabase/functions/vertice-inep-library/deno.lock scripts/branding/document-template.test.ts
deno run --allow-write=/tmp/vertice-opc-after --lock=supabase/functions/vertice-inep-library/deno.lock scripts/branding/render-fixtures.ts /tmp/vertice-opc-after
python scripts/branding/check-manifest-opc.py /tmp/vertice-opc-after/normal.docx /tmp/vertice-opc-after/absent.docx /tmp/vertice-opc-after/long.docx
```

Limites: esta verificação é do grafo OPC/manifesto e renderização, não validação integral de schemas OOXML. O validador externo usado no desktop não estava disponível aqui. A ata real não foi recebida nem alterada neste teste. A fonte SHA b7aaa2b46590245667c92badfe3bb10ba469131566d03fc8afaf6ce1171e74cb deve ser preparada novamente com o mesmo manifesto revisado em nova pasta exclusiva; o SHA 5605b4ba534c1433a5e131865adff2d224083a76bdc8a6c8082b02ee3b405ef7 será substituído por um novo hash, que precisa de novo registro e validação externa antes de qualquer upload/habilitação.

O patch não foi implantado na Edge, não altera banco e não realiza merge. Edge live permanece v4; smoke hospedado continua pendente separadamente. Solicitar revisão independente do novo commit, então publicar a Edge corrigida antes de habilitar templates.
