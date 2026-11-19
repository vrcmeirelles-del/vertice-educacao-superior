# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 013 — Integração do salvamento e divergência entre cadastros
**Data:** 2026-11-19 · **PR:** #207 (rascunho) · **Estado:** conexão implementada no código; RPC ainda não aplicada ao banco.

### Preservação
Mantidos todos os requisitos anteriores (adendos 001–012): motor por competências, longitudinalidade, autonomia docente, dificuldade e finalidade, imagens, correção objetiva/discursiva, análise TCT/TRI condicionada à adequação, integração futura Sapiens/Fato & Ordem/Planejamento Estratégico e documentação cumulativa.

### Diagnóstico direto do Supabase — somente leitura
- `public.vertice_courses`: 196 linhas.
- `vertice_app.courses`: 4 linhas.
- `vertice_app.curriculum_builds`: **0 linhas**.
- `vertice_app.curriculum_competencies`: **0 linhas**.
- Correspondência simultânea de curso+instituição por identificador entre `public.vertice_courses` e `vertice_app.courses`: **1**.
Essa diferença exige correspondência curricular explícita; não assumir que os 196 cursos tenham currículos construídos ou que IDs entre os esquemas sejam intercambiáveis.

### Artefatos desenvolvidos
1. `source-overrides/client/src/lib/avalia360/draft-api.ts`: cliente tipado da RPC `public.vertice_avalia_draft`, envia questões sem objeto File, requer recibo do servidor, envia a versão esperada na atualização.
2. `source-overrides/client/src/lib/avalia360/AssessmentDraftWorkspace.tsx`: formulário conectado ao cliente RPC em código, mostra sucesso/erro e não declara salvamento sem recibo.
3. `source-overrides/client/src/lib/avalia360/draft-api.spec.ts`: quatro testes de contrato, erro, mídia não enviada e concorrência por versão.
4. `docs/avalia360/sql/RASCUNHOS_RPC_STAGING_V1.sql`: proposta SQL em staging, ainda NÃO aplicada, define tabelas privadas de rascunho, eventos e RPC, MFA/AAL2, vínculo por disciplina/curso, bloqueio de imagens sem upload validado, atualização com controle de versão e autoria.

### Regra de segurança
- Client NÃO é fonte de autorização: disciplina, IES e curso devem ser conferidos na RPC pela sessão real.
- Aprovação curricular não é presumida: sem `buildId` validado, rascunho fica com `curriculumStatus='unmapped'` e não pode receber parecer de aderência ao PPC.
- Mídia local não pode ser descartada silenciosamente; até o upload privado existir, salvar questão com anexos retorna erro `IMAGE_UPLOAD_REQUIRED`.
- A RPC proposta salva rascunhos; NÃO implementa publicação, homologação de prova, vínculo ao Fato & Ordem ou nota de aluno.
- A SQL cria novo schema/tabelas; não executar na produção sem revisão de segurança e teste isolado.

### Bloqueio operacional: staging
A branch Supabase de desenvolvimento dedicada ao Avalia 360° não existe. Há branch prévia destinada ao ENAMED, que não deve ser reutilizada sem decisão própria. A ferramenta de criação de branch exige confirmação explícita de custo; não foi criada branch nem houve cobrança neste acompanhamento.

### Evidência e pendências
- [x] Cliente de integração implementado em código.
- [x] Formulário ligado ao cliente em componente ainda não montado no portal.
- [x] SQL/RPC proposta no repositório; leitura do estado efetivo confirmada.
- [x] Testes de contrato escritos.
- [ ] Suíte atualizada executada e aprovada para estes novos arquivos.
- [ ] SQL revisada e aplicada com segurança em ambiente isolado.
- [ ] Autenticação/RLS/MFA testados com contas de diferentes cursos.
- [ ] Upload privado e versionamento de imagens.
- [ ] Currículo real validado e disponível para análise algorítmica.
- [ ] Integração ao menu acadêmico, homologação e publicação.

### Próxima ação
Concluir testes TypeScript/Vitest, abrir ambiente isolado de validação autorizado em custo, aplicar SQL ali, testar isolamento com usuários/curso distintos e corrigir falhas. Só então completar gateway de imagens e vincular o formulário ao portal.

### Atualização de testes e revisão (mesma frente)
- CI #44635509309: 50 testes unitários aprovados, mas compilação isolada falhou inicialmente com TS2307 pela ausência de alias `@/lib/supabase` no `tsconfig.json` dedicado.
- Corrigido `source-overrides/client/src/lib/avalia360/tsconfig.json` (baseUrl e paths).
- CI #44635725337: execução Vitest 50/50 e TypeScript isolado **aprovados**. Evidência: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44635725337
- Ajustado o `AssessmentDraftWorkspace.tsx` para usar o recibo (`id` + `revision`) nos salvamentos posteriores, evitando criar novo rascunho a cada alteração. **Essa alteração posterior precisa de nova execução de CI.**
- Nenhum SQL foi aplicado em produção; integração permanece preparada em código, **não operacional no ambiente publicado**.

### Fechamento parcial de integração (evidência posterior)
- O `AssessmentDraftWorkspace` foi conectado ao cliente RPC e passou a fornecer `draftId` e `expectedRevision` a cada atualização; não implica conexão com banco enquanto a RPC não for aplicada.
- SQL de staging revisada para registrar snapshot integral de cada revisão em `vertice_avalia.assessment_draft_events` e preservar histórico de conteúdo.
- GitHub Actions #44635902864: **50 testes Vitest aprovados e verificação TypeScript isolada aprovada** após alterações de formulário e API.
- Evidência: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44635902864
- Última alteração da proposta SQL ainda NÃO foi testada contra PostgreSQL; não executar diretamente em produção.
- Para testar em branch Supabase própria é exigida confirmação de custo pela plataforma; criação não autorizada financeiramente nesta conversa. A branch de ENAMED existente não foi reutilizada.
