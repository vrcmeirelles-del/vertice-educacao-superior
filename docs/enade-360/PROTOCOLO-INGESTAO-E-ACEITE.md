# Protocolo de ingestão e aceite — microdados Enade 360°
Versão 0.1 | 2026-11-16 | Documento de especificação, ainda não executado sobre os ZIPs oficiais

## Entrada contratual
Por edição: ZIP oficial de microdados; URL e data da fonte; dicionário/layout; nota técnica da metodologia de cálculo; planilha oficial de Conceito Enade (contínuo/faixa) identificada por código do curso; tabela de áreas e códigos. Receber conjunto parcial sem inventar dados faltantes e indicar lacunas.

## Pipeline determinístico previsto
1. Quarentena lógica de arquivo recebido, sem executar conteúdo contido no ZIP. Registrar nome, tamanho, SHA-256, fonte e hora de extração; listar entradas e tamanhos descompactados, verificar corrupção e riscos de zip-slip/zip-bomb.
2. Identificar separador, encoding, tipos, colunas, valores nulos, códigos e dicionário. Falha de schema produz erro verificável, sem coerção silenciosa.
3. Associar edição, grau, área, código de curso e instituição com chaves oficiais; manter dados individuais fora de relatórios públicos e observar proteção de dados.
4. Aplicar filtros EXATOS documentados na nota técnica da edição (não replicar cegamente filtros de 2023 em outras edições), contar exclusões por motivo, registrar casos SC.
5. Reproduzir médias, desvios, tratamento de extremos, padronização, composição de indicadores, faixas, arredondamentos e regras de ausência conforme nota técnica da edição.
6. Conciliar individualmente com a publicação oficial pela chave (edição, código de curso, indicador); gerar total conferido, divergências, faltantes, duplicatas, tolerância e justificativas.
7. Emitir relatório com trilha de proveniência, transformações, versão de código, arquivos usados, responsáveis e status (conciliado, divergente, não calculável, não comparável).
8. Revisão humana de amostras, falhas, regressões e aprovação formal. Não modificar registros oficiais de origem.

## Testes automatizados definidos (a implementar)
- T01: SHA-256 estável para o mesmo arquivo e registro imutável da entrada.
- T02: ZIP inválido/corrompido é rejeitado; nenhuma extração fora da pasta segura.
- T03: código de grau/área desconhecido não vira bacharelado por aproximação.
- T04: filtros de elegibilidade aplicados por edição com contagens reconciliáveis.
- T05: curso com menos que mínimo de participantes válidos conforme nota técnica recebe SC.
- T06: agrupamento de códigos de curso não mescla IES ou áreas distintas.
- T07: escala e arredondamento replicam metodologia da edição, não heurística genérica.
- T08: divergência numérica produz linha auditável, jamais correção silenciosa do dado oficial.
- T09: comparação C3/C4/CX é bloqueada ou explicitamente restringida pela matriz.
- T10: relatório público contém agregados compatíveis com sigilo; não expõe registros individuais.
- T11: execuções repetidas com mesmas entradas/versão produzem mesmo resultado.
- T12: resultados anteriores e logs de divergências permanecem recuperáveis após nova versão.

## Critérios objetivos de aceite
- Fontes identificadas e hashes verificados.
- Layout validado, filtros e população reproduzidos.
- Confronto por código de curso com tabela oficial selecionada, com divergências explícitas e verificadas; tolerâncias SOMENTE se justificadas por norma e arredondamento.
- Conclusões classificadas como fato oficial, cálculo reproduzido, hipótese ou intervenção proposta.
- Relatório auditável e assinatura de validação humana.
- A homologação do núcleo geral exige evidências de todos os critérios acima, não apenas testes sintéticos.

## Estado real e dependência
P-ZIP-001: aguardando envio posterior do(s) arquivo(s) ZIP pelo usuário; nenhuma ingestão executada. Enquanto isso, só a metodologia, matriz e especificação de testes podem avançar. Prova quantitativa 001 usa tabelas agregadas, NÃO microdados. Nenhuma alteração em produção.
