# Pré-análise documental por algoritmo — 20/11/2026

Pedido: corrigir rastreabilidade, avaliação e fila sem ativar IA.

## Alterações

- Os endpoints documentais `vertice-doc-prevalidate` e `vertice-doc-analyze` não têm caminho para provedores generativos, mesmo se a política geral for alterada. Nenhum segredo ou chave geral foi ativado.
- Pré-validação: claim serializado por instituição/arquivo; processamento concorrente retorna a execução existente. Conclusões são reutilizadas por revisão do objeto de storage, metadados de classificação, catálogo e versão das regras. Sobrescrita no storage ou mudança de catálogo invalida o cache.
- Lease de cinco minutos, retomada explícita e até três falhas na mesma revisão em 24 horas. Histórico anterior preservado. Sem worker, serviço ou agendamento novo.
- Resultado, vínculos sugeridos e auditoria da classificação são persistidos em uma transação. Falha de gravação não retorna sucesso. Citações precisam corresponder ao texto e à página/seção armazenados; códigos devem existir no catálogo da mesma IES.
- Trecho BM25 preservado integralmente, inclusive termos após o caractere 500.
- Painel: versão do instrumento, proposta de 2026 identificada como experimental, estado de revisão humana, atualização periódica e retomada. A fila conta cada arquivo uma vez e registra o autor da aprovação manual em lote.
- Extração secundária: remoção do fallback que procurava texto em bytes PDF e verificação dos erros de gravação. Documento sem camada textual permanece pendente de OCR/conferência, sem leitura inventada.

## Avaliação sem IA

`node scripts/evaluate-document-rules.mjs /caminho/privado/amostra.json`

A entrada contém catálogos/objetos e documentos extraídos com `expected` (códigos completos), `kind` (digital/scanned/photographed) e dois revisores distintos em `reviewed_by`. A ferramenta calcula TP, FP, FN, precisão, recuperação e abstenções por tipo; não envia dados, escreve no banco nem aprova vínculos.

A amostra proposta de 100 documentos reais ainda exige seleção e revisão por dois avaliadores. Testes sintéticos e métricas externas não substituem essa medição. Custo por página e tempo de conferência exigem observação operacional; não foram inventados resultados para a Vértice.

## Validação

- 33 testes Node da suíte de evidências aprovados, incluindo PostgreSQL/PGlite: rollback de vínculo inválido, cache, concorrência lógica/claim ocupado, expiração, três falhas, mudança de revisão, permissões e ausência de caminhos de IA.
- Teste de comparação com gold revisado: precisão e recuperação calculadas com falso positivo, falso negativo e abstenção; entrada sem dois revisores é recusada.
- Não houve aprovação automática ou alteração de documentos existentes.

## Limites

A extração de imagem via OCR local existente permanece um procedimento controlado; esta correção não habilita serviços generativos nem instala um worker de OCR. A fila distingue falha de extração da conclusão da classificação. A ligação final e o espelhamento continuam dependendo da revisão humana existente.
