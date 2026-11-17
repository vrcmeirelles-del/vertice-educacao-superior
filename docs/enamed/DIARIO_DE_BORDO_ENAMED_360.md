# DIÁRIO DE BORDO — ENAMED 360° / INEP INTELLIGENCE
**Data-base:** 16/11/2026 · **Versão inicial:** 1.0  
Leia em conjunto com `BIBLIA_MESTRA_ENAMED_360.md` e `PLANO_DE_TRABALHO_ENAMED_360.md`.

## 2026-11-16 — E0: Fundação do projeto
**Foco:** arquitetura transversal, sem dados reais institucionais nesta etapa.

**Entregas verificadas:** revisão de fontes oficiais identificadas em conversa; leitura do código da Vértice, PR #168 e documentação técnica; consulta somente leitura ao Supabase Fato & Ordem; inventário dos acervos; elaboração da Bíblia e do Plano. A publicação desses documentos ocorre na branch da PR #168, não na produção.

**Evidências herdadas:** `docs/implementation/learning-medical-validation-20261113.md` (testes sintéticos da ponte); `docs/sapiens/REVISAO_TEMATICA.md` (revisão por duas IAs apenas propositiva); `docs/enamed/AUDITORIA_TAXONOMIA_20261116.md`; Issue #167; PR #168.

**Fatos:** 483 registros ENAMED 2026; competências vazias nos 483; classificação de área apenas "Medicina"; 483 hashes ausentes; duplicações por caderno+número; status definitivo sem comprovação suficiente; existência dos acervos ENADE e Residência, sem parecer integral de aderência.

**Decisões:**
- ADR-ENAMED-001: fonte de verdade regulatória = arquivo oficial versionado.
- ADR-ENAMED-002: uma ontologia transversal com códigos oficiais por instrumento e edição; sem misturar provas.
- ADR-ENAMED-003: estudante longitudinal unificado somente após conciliação legítima.
- ADR-ENAMED-004: diagnósticos internos ≠ nota/conceito oficial; dados insuficientes não são zero.
- ADR-ENAMED-005: instituição é tenant isolado; fase atual independente de instituição específica.
- ADR-ENAMED-006: evolução cumulativa: ler, herdar, melhorar, testar, atualizar Bíblia e diário.

**Pendências:** download, autenticação e leitura integral das fontes primárias; matriz de competências literal; auditoria 483/483 com cadernos e gabaritos; execução de testes CI/build; confirmação de deploy, RLS e dados institucionais. **Nenhum item alterado no F&O.**

**Status:** E0 — documentação em implementação no código, pendente de revisão e merge; E1–E8 planejadas; E9 futura.

## Modelo de novas entradas
```markdown
## AAAA-MM-DD — E{N}: Título
- Versão da Bíblia lida:
- Evidências recebidas/checadas:
- O que foi preservado:
- O que foi melhorado:
- Fontes e hashes:
- Testes/regressões:
- Decisões ADR:
- Limites e riscos:
- Status real (código / teste / homologação / deploy):
- Versão atualizada da Bíblia:
- Entrada necessária para E{N+1}:
```
