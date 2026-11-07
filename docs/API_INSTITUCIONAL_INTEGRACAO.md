# Vértice — Integração institucional por chave de API

Atualização: 06/11/2026. Escopo desta etapa: **provisionamento seguro da conexão**, sem extração de dados.

## O que está preparado

A área de gestão institucional possui, no código da branch `feature/vertice-api-institucional-20261106`, um cartão em **Importar dados de sites** para o perfil Master com MFA:

1. Endereço HTTPS do sistema acadêmico.
2. Chave de API institucional (não recuperável em tela depois de salva).
3. Opcional: URL-base da API quando diferente do endereço do sistema.
4. Status claro: aguardando chave, chave recebida sem validação ou revogada.
5. Revogação da chave por comando explícito.

O banco tem tabelas privadas, auditoria e RPCs autenticados `vertice_api_connection_get`, `vertice_api_connection_save` e `vertice_api_connection_revoke`. Os segredos são criados e atualizados no Supabase Vault; banco público e frontend nunca expõem o valor. A função exige usuário Master cadastrado e MFA `aal2`. Não há autenticação por senha do fornecedor e não é solicitada senha do operador da IES.

## O que a IES deve fornecer junto com a chave

- Base URL **real da API** (diferente da tela de login quando aplicável).
- Manual/OpenAPI ou exemplos oficiais de endpoints, parâmetros, método de autenticação (Bearer, x-api-key ou outro), expiração/renovação.
- Escopos **somente leitura**, autorização contratual e confirmação de que a chave pode ser usada pelo integrador terceirizado.
- Limites de requisições, paginação, filtros por alteração/data, identificadores de curso/turma/semestre/grade e eventual allowlist de IP.
- Formatos e dicionário dos relatórios (matrícula, cursos/grades, notas/frequências, turmas, professores) e regra para distinguir alunos de vínculos.
- Procedimento de revogação, contato técnico, janelas de manutenção e requisitos de proteção de dados pessoais.

**Não presume que o e-ORBIT disponibiliza API pública/documentada.** A chave isolada não garante acesso nem descreve os endpoints.

## Próxima etapa técnica — somente após receber a documentação

1. Implementar adaptador **server-side** para o provedor verificado. Permitir exclusivamente hosts HTTPS configurados e aprovados, bloquear IPs internos/metadata e redirecionamentos, definir timeout/limites/rate limiting. Não executar requisições arbitrárias a URLs fornecidas por usuário.
2. Testar `/health` ou endpoint equivalente documentado, autenticação e permissão real sem registrar cabeçalhos com segredo.
3. Importar primeiro para área de **staging isolada por IES**, com origem, data/hora, paginação, contagem, hashes, idempotência e checkpoint. Não sobrescrever a fonte.
4. Mapear e reconciliar tabelas com a Vértice: curso × semestre × grade; contagem de pessoas vs vínculos; reprovações por nota/falta; cargas de diários e matrículas.
5. Mostrar prévia de diferenças e evidência de amostragem. Somente após aprovação promover dados ao BI com `upsert` controlado e relatório de divergências.
6. Após homologação, programar sincronização diária fora do computador do operador (Supabase cron/Edge Function ou serviço Render já existente, sujeito a limites de execução e sem contratar novos serviços).
7. Monitorar erros, expiração, volume, última sincronização, reprocessamento, auditoria e retenção conforme o contrato e a LGPD.

## Segurança, permissões e publicação

- Nenhuma chave deve ir em GitHub, chat, logs ou variáveis do frontend.
- O cadastro de uma chave no Vault **não** ativa sincronização nem altera alunos, cursos, notas ou indicadores.
- As RPCs exigem Master + MFA. O formulário não aparece para outros perfis.
- A migração `institutional_api_connection_vault` foi aplicada no projeto Supabase Vértice em 06/11/2026. **Não reaplicar**.
- Validado em transação revertida: cadastro de URL/chave fictícia, consulta e revogação, com zero registros ou segredos persistidos após rollback. Acesso anônimo/sem sessão foi negado.
- O frontend está apenas na PR #54. Ainda precisa de typecheck, build estático, testes de sessão real e deploy no Render antes de aceitar chave em produção.
- Como os serviços Render apontam para `main`, mesclar sem QA pode iniciar publicação automática. Evitar isso até confirmar o build.


## Destino dos dados — contrato da ponte institucional (06/11/2026)

A conexão é mapeada pelo `institution_id` do cadastro já existente na Vértice, não apenas pelo endereço do portal nem pelo e-mail. Para a UNITOP, por exemplo, o destino é **a área própria da UNITOP no projeto Supabase da Vértice**, e não o banco da faculdade. Outras IES possuem destino próprio no mesmo banco, com o identificador da IES.

O cadastro associa:
- **Origem:** endereço HTTPS do sistema acadêmico; URL-base da API quando diferente; chave secreta fornecida pela instituição, armazenada no Vault.
- **Responsável:** e-mail técnico institucional para identificação e tratativas de suporte (não é fator de autenticação).
- **Correspondência institucional:** código da IES no sistema de origem (opcional até o fornecedor fornecer); `institution_id` interno imutável da Vértice.
- **Destino:** Supabase Vértice, em staging privado, identificado por `institution_id`. Após conferência e aprovação, os dados poderão alimentar as tabelas e o BI da IES.

Duas tabelas privadas foram adicionadas para recebimento:
- `vertice_private.api_sync_batches`: lote, origem, dataset, competência, contagens, estado de conferência, autorização e publicação.
- `vertice_private.api_staging_records`: registros JSON recebidos por lote, tipo, identificador externo, curso, semestre e grade.

RLS ativo, nenhuma permissão para usuários públicos/autenticados sobre essas tabelas. Uma chave estrangeira composta impede vincular um lote da UNICALDAS, por exemplo, à conexão da UNITOP. O gatilho dos registros rejeita misturas de lote/IES/dataset. A rotina de autenticação e armazenamento de credencial foi preservada.

A interface da PR #54 agora solicita **e-mail técnico, URL HTTPS do sistema, chave (quando chegar), código externo opcional e URL específica da API opcional**, além de mostrar claramente **Origem → Destino**. O salvamento chama a nova RPC `vertice_api_connection_bind`, que grava a correspondência institucional e registra o histórico. A RPC de gravação anterior foi retirada das permissões dos usuários autenticados, ficando somente como rotina interna.

**Limite operacional atual:** criar uma área de staging não equivale a acessar automaticamente um banco externo. A futura função conectora (worker server-side) só poderá iniciar transferências quando houver o contrato real da API, endereços permitidos, esquema de autenticação, autorização de acesso e campos disponíveis. Não existe sincronização ativa nesta etapa.

Validações em transações revertidas: criação/vinculação com e-mail, código externo e chave fictícia; escrita fictícia de lote/registro com leitura de resumo; rejeição de conexão de uma IES usada em lote de outra. Nenhum teste permaneceu gravado.
