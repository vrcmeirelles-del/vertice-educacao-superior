# Central de Homologação no Master

A página inicial `/master` inclui um bloco de acesso à Central de Homologação. O menu administrativo oferece o mesmo destino: `/master#homologacao=1`.

A implementação usa os componentes React do portal, Supabase Auth, MFA e o banco Vértice existente. Não usa iframe, login do ChatGPT, API ou banco do Site de apresentação. O Site anterior foi consultado: a tabela de registros estava vazia, portanto não havia evidências de usuários a migrar. Ele não foi excluído ou alterado.

## Comportamento

- Seis módulos: Conecta, Planejamento, Sapiens, TCC, Atividades Complementares e Estágio.
- Instituições e cursos vêm do cadastro já carregado no Master. O banco valida o vínculo entre eles.
- Versões, branches, perfis exercitados, fluxos, testes, documentos por URL HTTPS, integrações, riscos, pendências, decisões e próximos passos.
- Referências técnicas de 16/11/2026 são identificadas como transversais. Não se tornam aceite institucional ou de curso automaticamente.
- Evidências e observações registram ambiente, natureza dos dados, resultado, perfil, responsável declarado, autor autenticado e data do servidor.
- Cada atualização é um novo registro. O histórico anterior é preservado; revisões concorrentes são recusadas. Repetir a mesma solicitação não cria duplicação.
- Estados atuais são consultados separadamente da paginação do histórico. Exportação informa quando existe histórico anterior ainda não carregado.
- “Homologado” exige confirmação humana explícita, evidência do mesmo módulo/IES/curso com produção, dados reais e teste que passou; checklist concluído. Versão, acesso, jornada e aceite devem estar atendidos; jornada e aceite exigem evidência real em produção.
- O sistema valida a presença e o escopo dos registros, não a autenticidade automática do conteúdo da URL ou da declaração do responsável.
- Não existe atualização automática de GitHub/Render/Supabase e nenhuma escrita aprova documentos, matrículas, pesquisas, pareceres ou resultados acadêmicos.

## Segurança e persistência

A tabela `vertice_private.master_homologation_entries` tem RLS e nenhuma permissão direta para `anon` ou `authenticated`. A função privilegiada fica no schema privado, com `search_path` vazio. A RPC pública `vertice_master_homologation` usa `SECURITY INVOKER`. Ambas têm execução explicitamente restringida; o serviço exige `auth.uid()`, Master real na tabela existente e `aal2` antes de qualquer consulta ou gravação.

O advisor registrou um novo aviso informativo de RLS sem políticas nessa tabela privada. É uma negação intencional de todo acesso direto: não há grants de tabela a `anon`/`authenticated`; somente o gateway privado autorizado usa os registros. Não foi alegada ausência total de novos avisos.

Não foram adicionadas contas, instituições, cursos, provedores, serviços ou chaves. Links de documentos são informados pelo usuário e mantêm os controles de acesso de sua origem.

## Verificação local

- TypeScript completo do portal: aprovado.
- Build estático usado pelo Render: aprovado, com avisos de chunks e anotações de dependências.
- 7 cenários PostgreSQL/PGlite: autorização, MFA, negações de tabela, idempotência, escopo, revisão concorrente, condições de aceite e paginação.
- 8 testes da central (interface/modelo) e 4 de navegação Master: aprovados.
- Verificação da fonte canônica: aprovada.

Os testes usam fixtures sintéticas. Não constituem homologação real dos módulos da Vértice, nem sessão de usuário real em produção. CI remota não alegada.

## Recuperação

A mudança é aditiva. Para recolher a interface, reverter o commit de integração e publicar a versão resultante no serviço existente. Conservar a tabela e o histórico. Se necessário suspender novas gravações, revogar a execução da RPC pública e da função privada para `authenticated`, em alteração revisada. Não apagar a tabela para reverter a interface.

## Registro de implantação

Migração aplicada ao Supabase existente: `20261116084433_master_homologation_center.sql`, SHA-256 `e5d39ff2fba8d5072eee46334cedb0b682bda45c380cd1bebe19345174b82b4c`. O nome do arquivo foi alinhado ao identificador retornado pelo histórico remoto. As negações sem sessão, a gravação sintética idempotente e a leitura foram conferidas em transação revertida no banco publicado, com zero registros persistidos. RLS e negações de leitura direta para anônimo/autenticado confirmadas. A confirmação do commit integrado e dos deploys é registrada na PR desta implementação. Publicação técnica não substitui o aceite institucional dos fluxos.
