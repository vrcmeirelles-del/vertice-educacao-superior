# Extensão 360 — formulários e dossiê de execução

A aba **Formulários e PDF** oferece três estruturas neutras derivadas dos documentos analisados: atividade de ensino (CCG-MDL-01/02), ação social (CCG-MDL-05/06) e extensão (PEX-MDL-55 e relatório de intervenção). Não importa os conteúdos históricos, a marca da antiga instituição ou dados pessoais dos exemplos.

Professor/responsável entra com a conta institucional existente (`equipe`), com MFA exigido pelas funções de edição do portal. Pode criar e editar seus próprios formulários. Gestor/master pode acompanhar os registros da instituição. Leitor consulta. Alterar a natureza do modelo não credita horas nem converte uma atividade de ensino em extensão curricular.

O fluxo é: selecionar modelo e curso, preencher planejamento, salvar rascunho, registrar execução e indicadores, anexar comprovantes, concluir. Rascunhos incompletos são permitidos; a conclusão exige campos definidos, datas coerentes, indicadores não negativos e pelo menos um comprovante. A conclusão não depende de um orçamento diferente de zero. Tipos aceitos: PDF/PNG/JPG, até 5 MB cada, 20 arquivos e 20 MB no conjunto. Dossiê final: até 30 MB.

O PDF real contém os dados do projeto, relatório final, protocolo, revisão, autoria da conta que concluiu, data de emissão, indicadores e anexos com SHA-256 do original. PDFs são reunidos como cópias de páginas; imagens são incorporadas. O original de cada anexo permanece disponível em Gestão Documental. Assinaturas digitais dos anexos devem ser verificadas nos originais; o PDF composto não é uma assinatura institucional.

A mesma geração registra o documento na Gestão Documental e no repositório do curso que alimenta a Mesa Digital (`vertice_repository_requests/files`). A exigência é aberta no primeiro rascunho, atribuída ao responsável. Na conclusão, o arquivo entra como **enviado / não classificado**: um gestor deve conferir e vincular aos indicadores aplicáveis. O PDF e os anexos são enviados ao analisador documental já existente; falhas de IA são exibidas sem apagar o registro concluído.

O espelhamento externo OneDrive permanece sujeito às regras existentes de `vertice-onedrive-documentos`, inclusive restrições por instituição/curso, classificação e validação. Arquivamento no portal não comprova cópia externa concluída, postagem no e-MEC ou aceitação por comissão avaliadora.

## Integridade e concorrência

Tabela com RLS e somente SELECT para o cliente. Escrita por função privada com wrapper público invoker; exige usuário autenticado, instituição autorizada, papel de edição e propriedade ou gestão. Travamento serializa gravações do mesmo formulário e revisão otimista detecta alterações simultâneas. Conclusão transacional registra os documentos, entrega final e estados. Repetição da conclusão retorna o registro existente. Dados concluídos não podem ser reescritos por essa API. As permissões preexistentes de outras tabelas/módulos não foram redesenhadas.

Uploads precedem a transação: falha de rede pode deixar um objeto sem registro. Não se anuncia conclusão antes da confirmação do banco. O rascunho permanece para nova tentativa. A política existente de upload e o trigger `check_repository_file` verificam a estrutura instituição/exigência/arquivo e a conta que enviou o PDF.

## Verificação

- `node --test scripts/tests/extension-runtime/forms.test.mjs`: PostgreSQL embarcado, identidades fictícias, negativas de leitor, MFA, instituição/curso divergentes, edição de outro responsável, revisão obsoleta, anexo ausente, snapshot divergente, campo obrigatório, conclusão, repetição e RLS. Executa também o guard de arquivo do repositório existente no código.
- `vitest run --config scripts/extension.vitest.config.ts`: validação de campos, geração de PDF, anexação e integridade de bytes, preservação de rascunho diante de erro, bloqueio de conclusão incompleta e leitura sem controles de edição.
- `npm run check`, `npm test`, `npm run build:static`: portal composto a partir do ZIP + overrides.
- Conferência visual de PDF sintético com textos em português e anexo fictício.

A preparação também corrige quatro diagnósticos preexistentes que bloqueavam a checagem completa: `courses` opcional na Extensão e três problemas na CPA (tipo opcional `notes`, importação de `createCampaign` e conversão de `PromiseLike` antes de `finally`).

## Homologação no portal

1. Instituição com curso e professor cadastrado: criar rascunho e reabrir.
2. Confirmar que outro professor não edita o formulário; gestor pode acompanhar.
3. Preencher os três tipos de modelo, informando zero quando não houver custo ou participantes de uma categoria.
4. Anexar PDF de presença e foto, concluir e abrir o PDF arquivado.
5. Conferir na Gestão Documental e no repositório do curso: autoria, curso, semestre, arquivo enviado e classificação pendente.
6. Gestor revisa evidência e indicadores. Eventual espelho OneDrive deve ser conferido separadamente.
