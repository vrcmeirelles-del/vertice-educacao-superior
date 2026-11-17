# Discursiva 360° × Folha Manuscrita com QR — contrato manuscript-v1

## Fluxo entregue

1. No Fato & Ordem, o estudante gera sua folha normalmente, abre “Conectar esta folha ao Discursiva 360° da Vértice”, carrega seus vínculos já verificados e autoriza aquela folha para instituição/curso específicos. A mesma área aceita QR de uma folha anterior, consulta a devolutiva e revoga novas trocas.
2. Na Vértice, docente/gestão com MFA e acesso ao curso abre Discursiva 360° → Banco de questões → Conectar Folha Manuscrita com QR. Consulta o token de 64 caracteres ou a URL HTTPS /scan/ do Fato & Ordem e importa o enunciado e a rubrica em rascunho.
3. O docente revisa e homologa a questão, monta a prova e registra a resposta. A prova obtém o vínculo pseudonimizado do estudante diretamente da folha; não mistura folhas de estudantes distintos.
4. O texto recebido do F&O é uma sugestão de transcrição, sem imagem original. É obrigatório conferir a folha original antes de registrar ou homologar o texto. Também é possível fotografar a folha na Vértice e usar a transcrição já existente no módulo.
5. Após homologação da nota e devolutiva na Vértice, o botão “Enviar devolutiva homologada ao Fato & Ordem” realiza a troca e só registra sucesso local após acknowledgement válido. Repetir o envio é idempotente; retorno conflitante é rejeitado.
6. O estudante consulta a devolutiva institucional na mesma área do F&O. A avaliação docente fica separada da correção automática e não reescreve o motor adaptativo.

## Autorizações e dados

A ponte usa a chave servidor-servidor VERTICE_BRIDGE_API_KEY já adotada pela integração Sapiens. Nenhuma chave vai ao navegador. SUPABASE Auth.getUser, MFA e autorização por curso são reavaliados antes das chamadas externas; somente o servidor pode gravar registros de importação/recebimento.

O F&O exige simultaneamente: conta dona/destinatária da folha; instituição habilitada; vínculo de curso verificado e não revogado; e autorização explícita daquela folha. Cada exportação e retorno revalida esses controles. O hash de enunciado/rubrica/escala impede trocar silenciosamente a questão após a autorização.

O contrato transfere identificador de folha, vínculo pseudonimizado, módulo, disciplina, enunciado, rubrica, escala de origem e texto disponível. Não inclui nome, CPF ou e-mail. A revogação bloqueia novas trocas; registros acadêmicos já recebidos permanecem no histórico institucional.

A rubrica original é preservada com sourcePoints e sourceMaxPoints. Na Vértice, os pesos são normalizados explicitamente para a escala educacional de dez pontos. A devolutiva também apresenta o valor convertido à escala da folha, sem equivalência a resultado oficial de exame.

Folhas ENAMED/Residência do F&O não são automaticamente declaradas casos clínicos de quatro dimensões: a importação é institucional, preservando a rubrica efetivamente recebida. Os perfis clínicos autorais da Vértice continuam independentes.

## Limite confirmado na fonte existente

O módulo original do F&O guarda scan_ocr_text, mas não persiste a imagem enviada. A ponte não alega ter transferido uma imagem inexistente nem considera o texto OCR verificado. Sua conferência é obrigatória também no PostgreSQL.

## Testes

- Cinco testes F&O com PostgreSQL: posse da folha, consentimento, vínculo, revogação, versão, normalização e retorno idempotente separado da nota automática.
- Vinte testes de contrato/PG Vértice, incluindo ciclo entre DOIS PostgreSQL: compartilhar → importar → homologar → prova com estudante vinculado → conferir texto → homologar resposta → devolver → confirmar recebimento → tentar novamente → revogar.
- Sete testes de interface; TypeScript e build estático.
- Testes não usam alunos reais nem comprovam precisão OCR/IA em manuscritos reais. O teste pareado é executado com FATO_ORDEM_REPO apontando para o checkout oficial correspondente; sem esse checkout ele fica explicitamente skipped.

Migração Vértice: 20261117183540. F&O: db/migrations/956_vertice_manuscript_exchange.sql. Backend Vértice: vertice-discursiva v4. O destino de publicação permanece nos serviços existentes do workspace Virgílio Meirelles | Projetos.

A reimportação da mesma folha atualiza somente o texto de origem que passou a estar disponível após o scan. Não duplica a questão nem altera respostas e notas históricas. Migração complementar: 20261117184010.
