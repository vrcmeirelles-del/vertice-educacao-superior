# Classificação do acervo e navegação por dimensões

O repositório distingue evidências vinculadas aos indicadores do IACG/INEP de modelos e materiais de preparação, documentos diversos e arquivos ainda não classificados. Somente exigências da área instrumento e arquivos classificados como evidência participam dos indicadores de envio/validação; uma classificação nunca valida automaticamente o documento nem aplica NSA.

A cobertura abre em três dimensões recolhidas, com indicadores identificados pelo número e nome. Os arquivos usam busca, filtros e paginação de 20 itens. Justificativas e notas extensas ficam em detalhes. A aba Outros documentos reúne as categorias auxiliares. Uploads novos entram como não classificados até a conferência da gestão.

Gestores/master podem reclassificar o arquivo, registrar a justificativa e associar múltiplos indicadores válidos. O banco mantém autoria e data, sincroniza a área da exigência, preserva conteúdo/objeto, semestre, status e histórico de análise. Equipe/leitores e usuários de outra IES não ganham permissão de classificação. Dados privados do acervo e a auditoria individual não fazem parte deste repositório de código.

Validação: TypeScript, 71 testes, build estático e fixtures SQL com rollback, incluindo isolamento por IES, MFA, classificação sem validação automática, indicadores inválidos e imutabilidade de metadados de arquivo.
