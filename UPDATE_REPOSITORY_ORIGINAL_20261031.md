# Experiência do repositório original dentro da Vértice

A aba Repositório usa o formato do sistema original: cabeçalho marinho, painel de evidências com indicadores e linhas de cursos, barras de progresso, cursos com pendências primeiro e botão Abrir.

Dentro do curso: Cobertura do semestre, Arquivos enviados, Série histórica e Documentos exigidos. O envio abre uma janela com seleção do documento, clique ou arraste do arquivo, referência, observação e confirmação. O catálogo original conserva seus 98 modelos, códigos, indicadores, periodicidades, dimensões e responsáveis sugeridos. A gestão escolhe as exigências e os vínculos com metas.

Os documentos, responsáveis, metas e validações usam o banco da IES e o login existente da Vértice. O master mantém a visão global. Exigências e documentos já cadastrados são preservados. O exportador CSV trata aspas e fórmulas. A série histórica diferencia período sem configuração de entrega pendente.

A migração repository_file_details adiciona reference e upload_note às versões de arquivo, com limites de tamanho. As permissões existentes de leitura, envio e análise permanecem; os novos metadados não têm permissão de reescrita.

Validação: TypeScript, 58 testes, compilação estática e consulta dos privilégios das novas colunas. A conexão de controle do navegador retornou HTTP 401; o upload real e a comparação visual na sessão do usuário não foram concluídos. O limite integrado permanece em 20 MB e nos formatos já permitidos no bucket.
