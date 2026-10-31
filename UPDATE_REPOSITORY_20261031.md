# Repositório documental integrado por IES

A área de gestão em `/master` agora inclui a aba **Repositório** dentro de cada instituição. Usa a autenticação e o segundo fator da Vértice. Os documentos ficam em um bucket privado separado do acervo anterior; não há iframe nem compartilhamento da sessão SQLite.

## Uso

1. Vincular as contas dos coordenadores à IES como Equipe, na aba Equipe.
2. Cadastrar uma meta e selecionar a conta do responsável.
3. Em **Documentos da meta**, definir as exigências, o curso, o semestre e o prazo. O responsável da meta é sugerido para a entrega. Há 98 modelos do catálogo original e opção de documento personalizado; conferir a aplicabilidade antes de exigir.
4. O responsável atribuído envia o arquivo. A gestão valida ou devolve com parecer.
5. Reenvios preservam versões anteriores. O painel e os cartões das metas mostram exigências, envios, validações e atrasos; os dados são atualizados a cada 30 segundos ou pelo botão Atualizar.

Postagem não conclui uma meta automaticamente: a evolução do indicador continua sendo registrada em medições. O percentual documental considera somente a última versão validada de cada exigência ativa.

## Acesso e dados

- Metadados e arquivos isolados por `institution_id`, usando as regras atuais de vínculo com a IES e MFA.
- Gestor/master define exigências e analisa. Equipe envia somente quando atribuída. Leitor consulta na própria IES.
- Arquivos privados, até 20 MB: PDF, PNG, JPG, DOCX, XLSX, PPTX, TXT, CSV. Download autenticado; sem link público.
- Não há edição nem exclusão de versões pela tela; exigências podem ser arquivadas.
- O conteúdo existente do bucket `vertice-documentos` não foi importado nem alterado. O repositório SQLite separado também não teve seus usuários, senhas ou dados alterados por esta integração.

## Validação

- TypeScript e compilação estática.
- 50 testes de aplicação, incluindo 4 novos testes de classificação de arquivos e cálculo de acompanhamento documental.
- `supabase/tests/repository_goals.sql`: testes transacionais com rollback de isolamento entre IES, MFA, atribuição, envios, validação, metadados forjados e proibição de sobrescrever arquivos. Fixtures de metadados de Storage são simuladas em transação e não equivalem a um upload HTTP de conteúdo real.
- Migrações aditivas, sem alteração dos cadastros anteriores.

A integração reutiliza o Supabase existente. O serviço Render do repositório separado permanece ativo e sua cobrança não foi cancelada. O plano e as cotas do Supabase não foram alterados.
