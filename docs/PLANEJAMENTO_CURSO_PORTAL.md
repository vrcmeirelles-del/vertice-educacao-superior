# Planejamento estratégico e semestral do curso

O portal principal utiliza as tabelas existentes `vertice_app.strategic_plans` e
`vertice_app.semester_plannings`. O acesso usa Supabase Auth e MFA do próprio portal,
sem iframe, redirecionamento ao aplicativo separado ou uma segunda senha.

## Acesso

- Instituição → Gestão e Acessos → Planejamento do Curso.
- Tela do curso → Planejamento Estratégico e Semestral do Curso.
- Link contextual: `/master#instituicao=ID&aba=planejamento-curso`.

O usuário seleciona um curso cadastrado na IES. A seção Planejamento Semestral
carrega os registros salvos e o histórico por semestre. Rascunhos podem ser editados;
salvar uma versão publicada cria um novo rascunho. A publicação exige uma versão
salva e sem alterações pendentes. Atualizações concorrentes são recusadas.

## Persistência e autorização

A função pública `vertice_course_planning` é uma ponte SECURITY INVOKER para um
helper em schema privado. O helper valida identidade, MFA, papel institucional,
pertencimento do curso e vínculo explícito para coordenador/NDE. Perfis de consulta
não podem escrever. Os mesmos IDs do cadastro principal vinculam as tabelas do
módulo existente; os metadados institucionais são adaptados somente ao salvar.

O banco registra ator do portal, curso, operação e versão na auditoria existente,
sem copiar o conteúdo livre do planejamento para o log. As tabelas privadas não são
expostas pela API de dados. O campo legado de identificação de formulário não é
apresentado nem utilizado pela interface.

## Validação

- TypeScript completo e build estático do portal.
- Testes da interface: seleção explícita, escopo institucional/curso, histórico
  semestral, atualização da versão, troca de curso, leitura e falha de autorização.
- `supabase/tests/course_planning.sql`: gravação, publicação, versionamento,
  conflito concorrente, listas inválidas, isolamento, MFA e usuário sem vínculo.
  O teste usa transação com rollback, sem manter registros de teste.
