# Semestre do documento e NSA

A janela de envio inclui o semestre de criação, com opções 2027/1, 2026/2, 2026/1, 2025/2, 2025/1, 2024/2 e 2024/1. O registro usa o período escolhido. Ao reutilizar uma exigência de outro semestre, uma função validada resolve ou reproduz a exigência no período desejado, preservando os arquivos anteriores e os vínculos com curso, responsável e meta. Repetir a operação reaproveita o registro existente.

NSA — Não se aplica pode ser registrado sem arquivo, com justificativa, pela gestão ou pela equipe atribuída à entrega. Os itens NSA ficam no catálogo e no histórico, mas saem das pendências, atrasos e do denominador de cobertura. A ação Tornar aplicável reverte a decisão sem apagar as versões. O CSV inclui a justificativa.

A migração adiciona not_applicable, nsa_reason, nsa_by e nsa_at às exigências. As operações especializadas usam funções privadas com verificação de MFA, IES e atribuição; os wrappers públicos são security invoker. Não se amplia a permissão geral de UPDATE da equipe. A autoria e o instante são definidos no servidor e as alterações seguem a auditoria existente.

Validação: TypeScript, 69 testes e build estático. O teste SQL com rollback verificou NSA, justificativa obrigatória, atribuição, bloqueio de leitores e outras IES, MFA, resolução de período idempotente e preservação dos arquivos. Os advisors de segurança não apontaram novas ocorrências. A conferência visual e um envio real pelo navegador não foram realizados nesta revisão.
