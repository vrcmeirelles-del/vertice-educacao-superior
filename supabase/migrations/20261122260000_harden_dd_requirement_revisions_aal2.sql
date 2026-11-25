-- Hardening de segurança (simulação de pentest, 2026-11-22).
-- A policy read_revisions era `using(true)`: qualquer usuário authenticated, mesmo
-- SEM segundo fator (aal2), lia todo o histórico de versões do template de requisitos
-- de Due Diligence. É um catálogo global (sem matter_id, sem dado de operação ou de
-- aluno), então o impacto é baixo — mas é a única exceção à baseline aal2 do módulo dd_*,
-- onde as tabelas irmãs exigem aal2 via dd_private.can_access(matter_id).
-- Esta migração alinha a leitura à mesma exigência de MFA. Usuários legítimos do módulo
-- já operam com aal2, então não há perda de acesso legítimo.
alter policy read_revisions on public.dd_requirement_revisions
  using (coalesce((select auth.jwt()->>'aal') = 'aal2', false));
