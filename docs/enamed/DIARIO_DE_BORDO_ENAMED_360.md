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


## 2026-11-16 — E1: primeira rodada do corpus INEP (não encerrada)
- **Versão de entrada:** Bíblia 1.0, Plano 1.0 e Diário E0; Issue #167 e PR #168 consultadas.
- **Preservado:** todos os contratos e decisões E0, sem edição de perguntas, gabaritos, estudantes, instituições ou migrações de produção.
- **Documentos gerados:** `INEP_CATALOGO_FONTES_E1.md`; `INEP_MATRIZ_REGRAS_E1.md`; complementos em Bíblia, Plano e este Diário.
- **Evidências oficiais consultadas:** página normativa ENAMED 2025/2026; Portaria 478/2025 (texto DOU arquivado em domínio acadêmico); Nota Técnica 40/2025 (texto do Inep); Manual ENAMED 2026 (texto do Inep); página de gabaritos 2025/2026; microdados 2025 e planilha Conceito Enade Medicina 2025.
- **Descoberta/correção ADR-ENAMED-007:** não extrapolar a enumeração abreviada de 12 competências para a enumeração literal I–XV da Portaria 478/2025. O art. 6º VI trata de procedimentos; VII, de intervenções coletivas. A ontologia ainda não está importada.
- **Cálculo verificado:** NT40: `PCP=NCP/NC`, ao menos 10 válidos, critérios por TP_INSCRICAO/IN_REGULAR/TP_INSCRICAO_ADM/TP_PRES e faixas 1–5. 11 testes **sintéticos locais** dos limiares PCP/SC passaram. Não foram executados testes no Vértice, banco nem comparação com dado oficial por curso.
- **Limitação documental:** conexão direta do ambiente não resolveu `download.inep.gov.br`; PDFs disponíveis para leitura textual pela ferramenta de consulta, mas arquivos binários oficiais não foram materializados nem hash calculado; leitura integral e vigência pendentes. Status do conjunto **não é ARQUIVO_AUTENTICADO**.
- **Retificações:** 2026 possui editais republicados e publicação de gabaritos preliminares. Pendentes documentos integrais, verificação de cronologia e posição normativa atual.
- **Status real:** documentação E1 registrada na branch da PR #168; nenhum merge, deploy, alteração de produção ou homologação desta etapa comprovado.
- **Próxima entrada necessária:** recuperar corpus íntegro, hashes e regras de todas as notas/retificações e validar contagens oficiais antes de encerrar E1. **E2 não iniciada.**
