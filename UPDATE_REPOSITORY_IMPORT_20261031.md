# Importação de acervos e documentos de até 30 MB

O repositório passa a aceitar documentos de até 30 MB, no banco, bucket e interface. O limite comporta os arquivos do acervo autorizado sem alterar seu conteúdo e sem mudança de plano.

A validação do registro de arquivo reconhece importações feitas pelo backend com service_role, exigindo a atribuição a um administrador cadastrado. Continua verificando a existência do objeto no Storage, caminho, tamanho, instituição e exigência, e força o estado enviado. As regras para usuários autenticados, MFA, equipe atribuída, revisão e isolamento entre IES permanecem.

O teste SQL cobre a importação do serviço e confirma autoria e análise pendente. TypeScript, 69 testes e build estático passaram. Os documentos e os dados particulares do acervo não fazem parte deste repositório de código.
