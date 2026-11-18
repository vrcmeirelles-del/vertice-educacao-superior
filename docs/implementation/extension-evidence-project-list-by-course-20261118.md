# Evidências: lista de projetos organizada por curso

Solicitação de 18/11/2026: substituir as caixas de seleção por lista e separar os projetos por curso vinculado.

O formulário de envio e a edição dos vínculos usam um seletor de curso, busca por nome (sem diferenciar acentos) e lista suspensa de projetos. O botão Adicionar projeto coloca a escolha em uma lista de selecionados com os cursos correspondentes. Trocar curso ou busca preserva as escolhas anteriores. A lista selecionada tem altura limitada com rolagem; em celular, os controles ficam em uma coluna.

Os grupos usam os course_ids reais de cada projeto e o catálogo institucional já fornecido ao módulo. Um projeto com vários cursos aparece nos grupos correspondentes, mas é selecionado uma única vez. Projetos sem curso ficam em Sem curso vinculado. Um ID de curso ausente do catálogo é identificado como Curso não identificado, sem inferir nome ou vinculação.

Somente os projetos já filtrados por canManage no componente pai são oferecidos. Não muda permissões ou associações entre projeto e curso. Vínculos anteriores da evidência continuam preservados; Remover retira apenas uma seleção nova ainda não salva. O compartilhamento continua usando um único arquivo/cadastro e as RPCs existentes. Não há migração de banco.

Validação local: 39 testes de interface/formulários aprovados, incluindo regressões de upload único, vínculo parcial, preservação de vínculos e três casos da nova lista (troca de curso, agrupamento/busca e 240 projetos em 20 cursos). TypeScript, compilação estática e fonte canônica aprovados. Os testes usam dados e API sintéticos; não comprovam operação com documentos reais.

Publicação pendente de aprovação explícita para integrar esta alteração e publicar nos serviços oficiais existentes. A autorização executada anteriormente cobriu a PR #192. Nenhum vínculo de evidência ou registro de aluno foi alterado por esta tarefa.
