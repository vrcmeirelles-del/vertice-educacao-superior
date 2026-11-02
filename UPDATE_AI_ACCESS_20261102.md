# IA restrita à alta gestão

A aba e seu conteúdo só são apresentados aos perfis Master e Gestor; acesso direto por `aba=ia` também é bloqueado para Equipe e Leitor. A função privada `ai_scope` foi atualizada no Supabase: removida a autorização decorrente apenas de vínculo com um curso. Quando existirem atribuições acadêmicas, somente reitor, diretor geral, pró-reitor de graduação e diretor pedagógico ativos podem utilizar a IA. Coordenador e NDE não recebem acesso por sua atribuição de curso. MFA, sessão ativa, isolamento por instituição e quotas são preservados.

Testes transacionais com rollback confirmaram acesso para Gestor e bloqueio para Equipe, Leitor, usuário sem vínculo, curso inválido e usuário anônimo. Nenhuma conta de teste persistiu. O SQL em `supabase/access/` registra a definição aplicada pela migração `restrict_document_ai_to_senior_management`.
