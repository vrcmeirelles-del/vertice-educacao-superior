# BÍBLIA-MESTRA · VÉRTICE AVALIA 360°
## Adendo técnico cumulativo 002 — Adaptador Curricular Longitudinal
**Data:** 2026-11-19  
**PR:** #207 (rascunho) · **Situação:** código registrado, testes escritos, homologação pendente.

### 1. O que permanece válido (Adendo 001)
Motor determinístico antes de UI, autonomia docente, finalidade diagnóstica/formativa/somativa, integração transversal, exame externo independente, análise sem inferência semântica, estatística com cautela e nenhuma alteração em produção.

### 2. Implementado nesta etapa
- `source-overrides/client/src/lib/avalia360/curriculum-adapter.ts`: adaptador funcional e puro, sem DB, rede, gravações ou mudança de interfaces existentes.
- `source-overrides/client/src/lib/avalia360/curriculum-adapter.spec.ts`: cinco cenários de teste para matriz publicada, isolamento IES, ausência de períodos, validação das relações e integração com o motor.
- Usa as estruturas identificadas no `CurriculumBuilder.tsx`: `curriculum_builds`, `curriculum_competencies`, `curriculum_discipline_links`.
- Introduz contratos **propostos**, sem persistência, para `PeriodAssignment`, `VerifiedCurricularRelation` e `CuratedTopic`.

### 3. Regras de aderência e segurança
1. Conferir instituição, curso, versão e publicação antes de liberar análise curricular; o resultado `ready=false` bloqueia seu uso como referência vigente.
2. Nunca inferir o período de uma competência pela posição na planilha ou pela ordem das disciplinas.
3. Não inferir conteúdo/tema a partir do nome da disciplina ou do documento PPC.
4. Ignorar relações e temas somente propostos; só usar os com `status=validated`.
5. Identificar vínculos com outras versões, registros duplicados e ausência de competência.
6. Toda saída preserva ID e versão da matriz usada.
7. Não alterar a tabela curricular existente nem atribuir nota ou juízo sobre docentes.

### 4. Limites e riscos
- `CurriculumBuilder.tsx` persiste categoria da disciplina e nome em texto; os vínculos com período e tema ainda não estão demonstrados como campos oficiais. O adaptador exige mapeamento validado externo.
- `ready=true` demonstra consistência estrutural dos dados fornecidos, **não** aprovação pedagógica da questão, desempenho da integração em produção ou cumprimento de DCNs.
- A seleção de matriz vigente e as verificações de permissão deverão ocorrer no futuro serviço autorizado que fornecerá os registros; o adaptador puro confere coerência, mas não autentica usuários.
- Campos de documentos e competências precisam ser versionados antes de cálculos longitudinais comparativos.
- GitHub CI ainda não foi confirmado; testes ainda não foram executados neste acompanhamento.
- A biblioteca atual usa Vitest. Falta verificar compilação TS completa no ambiente do repositório.

### 5. Próxima ação
Desenvolver contrato persistente e protegido por RLS para mapeamento de temas/subtemas/períodos/relações, preservando o currículo atual, **somente após inspeção das migrações aplicáveis**. Em paralelo, rodar testes unitários e revisão de integridade do motor e do adaptador.

### 6. Critérios de aceite deste adendo
- [x] Adaptador versionado na branch isolada.
- [x] Testes de isolamento/compatibilidade escritos.
- [x] Integração algorítmica com o motor especificada sem dependência de produção.
- [ ] Execução automatizada dos testes comprovada.
- [ ] Revisão das migrações e RLS existentes.
- [ ] Consulta real autenticada às tabelas (read-only).
- [ ] Homologação curricular e pedagógica humana.
- [ ] Integração/publicação no ambiente Vértice.
