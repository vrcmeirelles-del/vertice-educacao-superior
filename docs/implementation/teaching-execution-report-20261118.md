# Atividades de Ensino — relato da execução

Implementação no módulo nativo da Vértice, sem outro projeto, serviço ou cadastro de alunos.

## Campos

| Solicitação | Registro |
| --- | --- |
| Nome do evento | Campo próprio no relato |
| Nome da atividade | Título existente, com rótulo ajustado |
| Apresentação | Texto de até 30.000 caracteres; projeto executado, justificativa e objetivos alcançados |
| Resultados alcançados | Texto próprio, incluindo envolvimento e desenvolvimento sócio cidadão |
| Ata com assinaturas | Documento da Mesa Digital da mesma instituição e curso, vinculado separadamente da evidência geral |
| Agradecimentos | Campo próprio para os apoiadores |
| Coordenador do projeto | Nome/função, sem contatos ou documentos pessoais |
| Docentes envolvidos | Campo próprio |
| Técnicos envolvidos | Campo próprio |
| Alunos envolvidos | Lista nativa de estudantes, papéis e minutos por pessoa preservada |
| Parceiros e forma de apoio | Campo próprio |
| Programação | Campo próprio |
| Valor investido | Número em reais com até duas casas decimais; zero é diferente de não informado |
| Pessoal | Descrição dos recursos humanos e despesas |
| Materiais | Descrição dos materiais e despesas |
| Divulgação | Descrição dos meios e despesas |

## Rascunho e validação

Rascunhos podem ser incompletos. Para validar, todos os campos do relato, valor e ata devem estar preenchidos. Itens sem aplicação podem conter a justificativa dessa condição. A coordenação ou gestão precisa confirmar expressamente a revisão da apresentação formatada com no mínimo uma folha, dos resultados e da ata com assinaturas.

Contagem de caracteres não comprova uma folha; presença de um arquivo não comprova assinaturas. Não há OCR, reconhecimento de assinaturas ou aprovação documental automática. A confirmação é uma declaração humana, registrada no relatório junto aos campos nativos de autoria e data de validação.

O relatório fica em lista expansível nos registros existentes. Texto é renderizado como texto, sem HTML. Não há envio por e-mail, cópia de arquivos, publicação pública, crédito de horas, lançamento financeiro ou medição automática de indicadores.

## Persistência e acesso

Migração: `20261118194013_teaching_execution_report.sql`.

- Duas colunas na tabela existente: `execution_report` e `minutes_doc_id`.
- RPC existente grava relatório e alunos na mesma transação. Clientes anteriores que omitem as novas colunas preservam o relatório já salvo.
- Trigger recusa tipos inválidos, valores monetários negativos ou com precisão excedente, ata fora do curso e validação incompleta ou sem conferência humana.
- Permissões por instituição/curso, MFA e autoria dos rascunhos são preservadas. Nenhum novo papel, usuário, política de acesso ou endpoint público.
- A ata referenciada não pode sofrer exclusão física enquanto vinculada. O vínculo não revela URL ou caminho de Storage.
- Atividades já validadas antes da migração permanecem como estavam; não são preenchidas ou revalidadas automaticamente.
- Depois de validado, relatório e ata ficam imutáveis no fluxo de edição.

## Validação da implementação

Testes de interface incluem salvar todos os campos com investimento zero, editar no curso original, bloquear relatório incompleto, exigir confirmação humana e manter erro de gravação quando há conflito/permissão insuficiente.

PostgreSQL embarcado, apenas com dados sintéticos: aplicação da migração, preservação dos validados anteriores, gravação e edição, compatibilidade de cliente anterior, validação humana, integridade da ata, MFA e segregação por curso/IES. Isso não comprova operação com dados reais de produção.

TypeScript completo, build estático e fonte canônica também verificados. Resultados finais de CI ficam na PR.

## Publicação pendente de autorização

Não aplicada no Supabase nem publicada no portal. O usuário exigiu aprovação explícita antes de migração, alteração de banco, merge ou publicação. A aprovação solicitada cobre aplicar esta migração apenas no projeto existente `vertice-educacao-superior` (`qvetbbmviatxxatzzuzc`) e, após verificação, integrar/publicar a interface pelos serviços existentes no workspace “Virgílio Meirelles | Projetos”.

Ordem: migração aditiva autorizada, inspeção de estrutura/permissões sem dados pessoais, merge da versão testada e verificação visual autenticada. Nenhuma atividade real deve ser cadastrada, validada ou alterada para a conferência técnica.
