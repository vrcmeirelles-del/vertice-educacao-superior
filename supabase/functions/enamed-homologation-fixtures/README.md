# Contas sintéticas ENAMED — operação exclusiva da homologação

Destino permitido: `rnmkmnrfhvjihsuqziwf`. A função recusa outro SUPABASE_URL antes de criar clientes ou usuários. Não implantar/usar em produção.

A autorização do usuário em 17/11/2026 abrange nove perfis de teste. Foram criados pela API Auth Admin, sem INSERT em auth.users. O fluxo de validação faz login por senha, TOTP real e consulta AAL2/getUser; encerra as sessões pelo Auth. Não forja JWT ou sessão.

Senhas aleatórias e segredos TOTP ficam no Supabase Vault, em `enamed360_qa_<perfil>_20261117`. Somente operadores autorizados do projeto devem acessá-los, em canal seguro. Não exportar valores para código, relatórios, comentários ou logs. Os e-mails são endereços reservados de exemplo; não correspondem a pessoas e não foi usado convite por e-mail.

O acionamento inicial exigiu uma capability aleatória no Vault e o RPC restrito a service_role. Cada rodada consumiu/revogou a capability; tentativa posterior recebeu HTTP 403, sem novos usuários. O provisionador final está com verify_jwt=true. Não reativar automaticamente.

Há duas IES e três cursos marcados SINTÉTICO/HOMOLOGAÇÃO. Não há estudantes, respostas ou notas. Coordenação/NDE têm course_id; docente usa equipe com vínculo de disciplina em vertice_learning_staff_scope; outro usuário só pertence à IES B; o usuário sem autorização não recebe membership. Master é cadastrado em vertice_admins, não em um papel fictício de membership.

Evidência: docs/enamed/evidencias/20261117_CONTAS_MFA_API_VERIFICADAS.json. São verificações reais de Auth/Data API; não substituem os 16 cenários completos no navegador, revisão médico/visual ou E2E com F&O.

A correção de leitura de cursos foi aplicada somente no isolado, após reprodução real da exposição de outro curso. A migração registra rollback revisável não executado. Não integrar toda a branch de banco na produção; variantes de restauração e credenciais de teste devem permanecer isoladas.

Para retirada futura, revogar sessões/desativar as contas pelo Auth Admin e retirar apenas vínculos da fixture após revisão de dependências. Preservar evidências; não excluir dados acadêmicos ou usuários de terceiros. Esta execução não realizou exclusões.
