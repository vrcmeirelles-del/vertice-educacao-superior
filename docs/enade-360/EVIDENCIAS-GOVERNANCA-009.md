# Evidência 009 — Projeto de persistência, acesso por perfil e consulta das evidências
Data: 2026-11-17 | Natureza: documentação + protótipo em memória, sem integração ao Supabase.

## Entregas
- `ARQUITETURA-AUDITORIA-PERSISTENTE.md`: projeto lógico de streams, eventos append-only, fontes, decisões e grants, além de contrato de consulta somente leitura, segregação de instituições/cursos, publicação DRAFT_ONLY e portas de qualidade.
- `validator/audit-event-prototype.cjs`: algoritmo sintético de canonicalização, SHA-256 encadeado e leitura com autorização in-memory por perfis e escopos; sem SQL, rede, API implantada ou autenticação real.
- `validator/test-audit-governance.cjs`: 28 cenários de chain tamper/reordenação, idempotência, tenant e IES, permissões Master/Reitoria/Coordenação/NDE/CPA, paginação e rejeição de publicação.
- `.github/workflows/enade360-contracts.yml` ampliado para executar a suíte Node.

## Evidência CI
GitHub Actions run **44046339541**, commit **f09ad17a49c1f1d1f2a94222928d56973d829bfb**, completed/success; logs Node v22.23.4:
- básicos 26/26
- edição 34/34
- intercampos 26/26
- R2–R6 23/23
- estados 29/29
- rastreabilidade 28/28
- integração da trilha 6/6
- governança em memória 28/28
- Draft 2020-12 + Node 40/40
**Total 240/240 testes sintéticos aprovados; zero falhas.**
URL: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44046339541

## Escopo e limites essenciais
1. Não há tabelas criadas no Supabase, RLS implantada, autenticação com sessões reais, consultas de API reais, assinatura digital, ancoragem externa de hashes ou prova de imutabilidade em banco.
2. O encadeamento hash é puramente em memória; detecta alterações nas fixtures, não protege contra controle administrativo do armazenamento nem substitui registro externo inviolável.
3. A lógica de papéis não reflete necessariamente o cadastro de usuários efetivo; Master só acessa tenants formalmente concedidos no teste; CPA somente agregados. Autorizações institucionais reais precisam homologação.
4. Os GETs são especificação, não endpoints implementados; sem capacidade de publicação externa.
5. Nenhum ZIP do INEP foi processado e nenhum conceito oficial reproduzido. A fase de homologação científica permanece bloqueada.
6. Documentação da Supabase verificada quanto à RLS e separação entre grants e políticas; consulta ao changelog constatou mudanças recentes na CLI, motivo adicional para não presumir implantação de migração.

## Pendências
P-TRACE-001: persistência real, migração reversível, replay e ancoragem; aberta.
P-ACCESS-001: resolver papéis/escopos contra autorizações reais e RLS; aberta.
P-API-001: APIs somente leitura com autenticação, limite e audit logging; aberta.
P-CROSS-001: integração real; parcial.
P-ZIP-001: arquivos oficiais aguardados.
P-NT-001, P-REF-001, P-TOL-001: abertas.
Nenhum serviço de produção foi modificado, nenhum schema do banco foi migrado.
