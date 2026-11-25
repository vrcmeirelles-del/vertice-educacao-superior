# Sapiens: fonte revisada para sapiens.low — 25/11/2026

Autorização: solicitação do usuário «Execute e ative», após o diagnóstico da ausência de adaptador e de separação de pré-notas.

## Entrega
- A fonte original `vertice_learning_course_metrics` permanece intacta.
- Revisão humana de um subconjunto definitivo: respostas, acertos, estudantes, evidência e justificativa. A pessoa atesta a exclusão das pré-notas. O sistema não infere quais respostas são definitivas nem homologa contagens automaticamente.
- RPC autenticada com MFA, gestão ou coordenação do curso. O autor vem de `auth.uid()`. Nenhum grant é criado para uma pessoa.
- Revisões imutáveis, revogação por novo evento, controle de concorrência e hash do snapshot completo. Fonte alterada exige nova revisão.
- Amostra mínima: 30 respostas definitivas e 5 estudantes; acertos/erros/estudantes precisam caber nos contadores da fonte.
- Leitor exclusivo de `service_role`, no par exato instituição/curso. Ausência de dados, revisão ou amostra elegível produz pendência, nunca um resultado zero validado.
- Executor 2026.11-executor.6 compõe a fonte Sapiens com os demais leitores pedagógicos. Sem mudança no motor de diagnóstico ou no contrato da bridge F&O.
- A Central de Automação permite registrar e revogar a revisão dos agregados do curso. Sem IA ou novo agendamento.

## Limite de ativação
O adaptador pode ser publicado e disponibilizado. A execução por IES/curso continua exigindo uma configuração proposta e aprovada por outra pessoa autorizada com MFA. Não há personificação de usuários pelo serviço nem autoaprovação. A publicação não cria aprovações de configuração ou de intervenções.

Na inspeção anterior à mudança: zero agregados, zero atribuições de coordenação/NDE, zero intervenções/entregas na Vértice. Não foram criados alunos ou agregados de exemplo no banco hospedado. Sem agregados reais revisados e configuração aprovada, não se declara regra em operação nem homologação ponta a ponta em produção.

## Verificação
Dados exclusivamente sintéticos em PostgreSQL PGlite: autorização/MFA, curso e IES cruzados, amostra, rejeição de pré-notas, autoria, CAS, imutabilidade, revogação, mudança da fonte e executor real em modo sombra com aprovação por duas pessoas. Suíte do motor também executada. Evidência completa na execução do CI da PR.

## Implantação e reversão
A migração candidata só contém objetos novos; não altera indicadores, notas, permissões existentes ou intervenções. Aplicar e registrar a versão efetiva conforme `supabase/MIGRACOES.md`, publicar o executor e o portal canônicos e conferir versão, ACL/RLS e inventário. Não reaplicar migrações históricas.

Reversão: retirar `sapiens.low` de `SUPPORTED`/republicar a versão anterior do executor, preservando tabela e decisões de revisão. Revogar uma revisão pela RPC ou pausar a configuração pelo fluxo nativo. Não apagar histórico e não reverter notas ou registros acadêmicos.

Situação inicial desta entrega: em teste; banco e executor ainda não alterados.
