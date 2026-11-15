# Consolidação da Vértice

Fonte ativa: `vrcmeirelles-del/vertice-educacao-superior`, branch `main`.
Portal: https://www.verticesuperior.com.br.

O planejamento foi incorporado ao portal, com o mesmo login e Supabase. A
interface não depende da API nem do endereço do aplicativo independente.
As tabelas existentes e seus registros permanecem no mesmo projeto Supabase.

## Preservação

- Os 120 arquivos da última versão independente estão preservados em `archives/`,
  com manifesto de integridade e proveniência dos commits.
- A estrutura das seis migrações originais passou a constar neste repositório em
  `supabase/bootstrap/vertice_app.sql`. Esse bootstrap destina-se a ambiente novo,
  antes das migrações de integração do portal; não substitui a sequência normal
  de migrações nem recria tabelas já presentes.
- Não são apagados registros, documentos, usuários ou histórico de planejamento.
- O repositório excedente é retirado do desenvolvimento ativo, com preservação
  do histórico. O serviço correspondente deve ficar suspenso e o Blueprint pausado.

## Referências operacionais

| Item | Identificador |
| --- | --- |
| Serviço principal | `vertice-portal` / `srv-dbm52uhsrm7s73f3ojkg` |
| Serviço independente retirado | `vertice-app` / `srv-dbspe28ae00c738n3clg` |
| Blueprint independente | `exs-dbspdm61egvs73egervg` |
| Projeto Supabase preservado | `qvetbbmviatxxatzzuzc` |

O banco temporário do Render não faz parte da conexão do portal. Nenhuma exclusão
de banco é necessária para consolidar o código.
