# Análise documental assistida por IA

A área autenticada da instituição ganhou a aba **Análise documental · IA**. O fluxo escolhe curso e documentos, prepara uma prévia no backend e somente envia à OpenAI os trechos selecionados após confirmação explícita. Resultados são texto, com citações e limitações, sem alterar metas ou validação documental.

O cliente usa a função existente `vertice-ai-review`; a chave `OPENAI_API_KEY` permanece exclusivamente nos segredos do Supabase. Autorização de instituição/curso, MFA, sessão ativa, versão das evidências, quotas e auditoria continuam no backend. Nenhuma chave foi criada, substituída ou incluída no repositório.

Limites desta versão: TXT/CSV UTF-8, até 3 arquivos de 5 MiB, 12 trechos, 4.000 caracteres por trecho e 24.000 no total. Extração de PDF, DOCX e XLSX ainda não está implementada. A aba informa essa limitação; a análise manual dos documentos permanece separada.

Validação: `npm run check`, 99 testes existentes e `npm run build:static` passaram. Teste sintético de conectividade feito diretamente no backend: OpenAI HTTP 200, resposta concluída, modelo `gpt-4.1-mini-2025-04-14`, 14 tokens de entrada e 2 de saída. Nenhum documento institucional foi usado nesse teste. A função temporária de diagnóstico foi substituída por um handler inerte (410), com verificação JWT ativada, e o token temporário foi removido.

Política prevista para UNITOP: `gpt-4.1-mini`, 5 análises por ator/dia, 25 por instituição/dia e até 1.500 tokens de saída. Essa configuração não equivale a orçamento financeiro fixo. Validar a resposta de status na interface após publicar. O teste sintético não comprova análise ponta a ponta de um documento real.

Para reverter a interface, restaurar os dois arquivos de `source-overrides/client/src/components/area/` alterados nesta entrega (`Workspace.tsx` e `DocumentAI.tsx`). Para suspender análises, definir `enabled=false` na política da instituição; preservar auditoria e credencial.
