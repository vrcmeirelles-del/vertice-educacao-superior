# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 025 — Prova nominal por turma com QR opaco e PDF de demonstração
**Data:** 20/11/2026 | **PR:** #207 (rascunho) | **Produção:** preservada sem alterações.

### Regra-mestra de continuidade
Mantêm-se os requisitos dos adendos 001–024: módulo independente em Acadêmico, motor longitudinal, PPC homologado como fonte futura, avaliação docente, direitos de imagem, rubricas, Sapiens e Fato & Ordem, segurança institucional e separação entre homologação/publicação.

### Entrega em código
- `individualized-pdf.ts`: emissão de um PDF multipágina com uma prova individual por estudante selecionado; título, curso, disciplina, turma, semestre, nome, identificação **declarada** e QR Code distinto por folha. Lote demonstrativo limitado a 120.
- O QR contém somente `VA360:` e token opaco gerado aleatoriamente; NÃO inclui matrícula, CPF, nome ou outros dados pessoais. **Tokens da demonstração não são registrados em backend e não permitem identificação/correção digital posterior.**
- `ClassBatchPublisher.tsx`: seção 5 do Estúdio, seleção da turma, carregamento de turma 2A **fictícia**, inserção opcional de lista textual manual de teste, seleção/exclusão de estudantes e geração de PDF no próprio navegador.
- `individualized-pdf.spec.ts`: teste de emissão nominal PDF com `PDFDocument.load`, conferência de quantidade de páginas, tokens diferentes por aluno e rejeição de duplicação de IDs.
- `class-roster.ts`: cliente de RPC para consulta autorizada por instituição, curso, disciplina e turma, para futuro uso no ambiente autenticado.
- `TURMA_ALUNOS_RPC_STAGING_CANDIDATE.sql`: candidata SQL de leitura limitada de `vertice_roster_entries` associada a `vertice_roster_imports`, com verificação de `auth.uid()`, MFA AAL2, papel/lotação docente e `institution_id/course_id`. Não devolve CPF, hash, telefone, e-mail ou token interno da base de alunos.
- Na prévia pública, `previewMode=true`, NÃO existe integração com alunos reais nem consulta a serviços conectados.

### Fonte institucional confirmada somente por agregados
- Base `public.vertice_roster_entries`: 682 registros, todos com status `matched` no retrato consultado.
- Base `public.vertice_roster_imports`: 53 importações; 42 `done`, 11 `error`.
- `public.vertice_enrollment_snapshots`: registros de matrícula agregada, não equivalem a rol nominal.
- **Importante:** a base roster não possui coluna explícita de matrícula acadêmica. `student_token` não equivale a matrícula verificada. Não inventar matrícula em PDF oficial.
- O código de consulta real está **versionado como candidato**, sem aplicação da SQL em produção ou na branch Supabase pausada.

### Testes, publicação e uso
- GitHub Actions `#44760600070`: **69 testes unitários + 20 testes PGlite** aprovados, incluindo emissão PDF.
- Render serviço `vertice-avalia360-homolog`, deploy `dep-dc06668jo6nc73f4ce10`, commit `408ba68e44ac1cbf04e75bef1e230db443b305ed`, status `live`, finalização em `2026-11-20T15:11:51.718922Z`.
- URL de demonstração: https://vertice-avalia360-homolog.onrender.com
- A demonstração gera arquivo PDF no dispositivo do visitante, sem enviar dados ao banco. **Não usar lista real de alunos nesta demonstração pública.**
- Os nomes de demonstração são fictícios. O cabeçalho definitivo será incorporado após o usuário fornecer o modelo.

### Limites expressos do gerador atual
- PDF da prévia contém texto de enunciados, alternativas e linhas para respostas discursivas. **Ainda não incorpora imagens anexadas à questão**; a interface bloqueia emissão com imagens para evitar perda silenciosa de conteúdo.
- Nomes são normalizados para fonte PDF padrão; a futura versão deverá embutir fonte Unicode/Cambria licenciada para preservar acentuação.
- QR não tem resolução/registro em banco, logo não serve ainda a correção automática.
- Não há matrícula acadêmica oficial, Auth/MFA real ou aplicação da RPC de alunos.
- Não há cabeçalho definitivo, lote ZIP, ficha OMR ou aplicativo móvel de captura/correção.
- A geração automática de nomes reais só pode ocorrer após publicação e homologação da consulta de turma com autorização e conciliação de matrícula.

### Próximo portão de homologação
1. Confirmar visualmente a etapa 5 no navegador e abrir o PDF de uma turma fictícia 2A.
2. Receber modelo de cabeçalho; adaptar diagramação e paginação, incluindo fontes Unicode e imagens.
3. Implantar e testar a RPC de turma em staging com contas docentes MFA e RLS por curso, sem exibir dados reais no preview.
4. Criar lote imutável no backend mapeando `paperId`/QR opaco a aluno e prova/versionamento. Isso exige trilha de auditoria, revogação/reemissão e consentimento institucional.
5. Somente depois liberar emissão nominal oficial e futura leitura OMR/QR, com validação docente.
