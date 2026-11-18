# Extensão: alunos e evidências por projetos — proposta para publicação

Solicitação do proprietário em 18/11/2026: comandos para excluir alunos, retirar do projeto e desativar.

A interface de **Extensão 360° → Alunos** recebe ações separadas na participação
selecionada: Desativar aluno, Reativar aluno, Retirar do projeto, Reintegrar ao
projeto, Excluir cadastro e Restaurar cadastro. A confirmação informa o aluno,
o projeto, as consequências e exige motivo.

## Alcance

O modelo atual tem registros de participação por projeto. Portanto, as ações
atuam **somente no vínculo escolhido**, não na conta Supabase Auth, nem nos
outros projetos ou no cadastro acadêmico da instituição. Não é feita associação
por nome, nem exclusão global por e-mail, CPF ou matrícula.

- **Desativar:** mantém o cadastro visível, marca como inativo e revoga o convite
  somente no projeto escolhido.
- **Retirar do projeto:** retira da lista padrão e permite reintegração.
- **Excluir cadastro:** move a participação para a lixeira recuperável.
- **Reintegrar/restaurar:** devolve como inativo; reativação é ação separada.
- Reativação recupera a situação anterior do vínculo. Convites revogados **não**
  voltam a funcionar automaticamente; a gestão dos convites é um fluxo separado.
- Horas, presenças, avaliações, documentos e histórico não são apagados.
  Relatórios históricos mantêm o status da participação e as horas já cumpridas.
- A tabela de alunos ganha filtro de vinculados, retirados, lixeira e todos.

## Banco e segurança

Migração gerada pelo CLI: `20261118092827_extension_student_lifecycle.sql`.
Adiciona versão de concorrência e marcadores recuperáveis, um trigger de proteção
e a RPC `vertice_extension_student_lifecycle`.

A RPC usa a autorização existente do gestor/responsável pelo projeto e MFA
conforme `extension_project_manager`. Valida o par aluno/projeto/IES, motivo e
versão esperada. Recusa mudança de projeto por edição, alteração direta de estado
de ciclo de vida e exclusão física. Registra autor/data e antes/depois na trilha
existente do projeto, sem incluir CPF ou e-mail no histórico adicional.

A migração **não foi aplicada em produção**. Nenhum aluno real foi desativado,
retirado ou excluído por esta tarefa. A autorização anterior referia-se à PR #190
do painel ENADE; a publicação desta alteração de Extensão requer aprovação própria.

## Evidências vinculadas a um ou mais projetos

Correção solicitada pelo proprietário em 18/11/2026: o formulário de envio e o
ajuste dos vínculos agora mostram o campo **Projetos vinculados — selecione um
ou mais**, com caixas de seleção e busca quando há mais de cinco projetos.
O envio exige ao menos um projeto permitido e usa um único arquivo e cadastro,
preservando o cálculo SHA-256. Dentro de um projeto, ele vem pré-selecionado.
O arquivo só é enviado após clicar em Salvar evidência.

A edição permite acrescentar vários projetos de uma vez; os vínculos anteriores
aparecem marcados e não podem ser removidos por este formulário. São exibidos
somente os projetos fornecidos pelo escopo de autorização existente. Evidências
individuais de aluno continuam fora do compartilhamento entre projetos.

São reutilizadas a view e a RPC de vínculo existentes, sem nova migração para
este campo. Falhas parciais exibem os projetos pendentes e permitem repetir apenas
os vínculos que falharam, sem novo upload ou cadastro. Falha no cadastro tenta
remover o arquivo recém-enviado e informa se a limpeza não foi confirmada.
Nenhum envio aprova automaticamente a evidência.

Os sete testes sintéticos cobrem seleção obrigatória, upload único para dois
projetos, preservação de vínculos, pré-seleção do projeto atual, falha parcial e
repetição sem duplicação, limpeza após erro e bloqueio por sessão/limite do arquivo.
O digest da API de criptografia é simulado nos testes de interface: eles não são
prova de extração, indexação ou funcionamento com documentos reais em produção.

## Validação

- Seis testes novos de banco isolado (PGlite 0.5.8, identidades fictícias).
- Seis testes novos de interface de alunos e sete de evidências com API simulada.
- Suíte de banco de Extensão e regressões: 32 testes passaram.
- Formulários de Extensão, TCC e Estágio: 36 testes passaram.
- TypeScript sem erros e compilação estática do portal aprovada.
- Verificador de fonte canônica aprovado.

## Próximo passo autorizado somente após aprovação

Aplicar a migração no Supabase existente da Vértice, integrar a PR desta proposta,
acompanhar a publicação nos serviços Render existentes e verificar os controles
na interface autenticada. Não utilizar registros reais para testar exclusão ou
desativação sem identificar o alvo e receber instrução expressa para essa ação.
