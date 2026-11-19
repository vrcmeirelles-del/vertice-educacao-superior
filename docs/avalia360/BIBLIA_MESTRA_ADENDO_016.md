# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 016 — Imagens confirmadas no snapshot da prova e homologação de integração sintética
**Data:** 2026-11-19 · **PR #207** (rascunho) · **Sem deploy ou alteração de produção**

### Decisões preservadas
Adendos 001–015 mantidos integralmente. O Avalia 360° conserva os vínculos entre PDI/PPC/Construção Curricular, finalidade diagnóstica/formativa/somativa, competências transversais e longitudinalidade, dificuldade de itens e psicometria condicionada, Fato & Ordem/Sapiens 360° e autonomia docente.

### Nova integração em código
- `AssessmentDraftWorkspace.tsx`: faz upload de cada imagem pendente por ticket privado, recebe confirmação e somente então tenta salvar o rascunho. Cache em memória por imagem evita repetição quando há retry.
- `draft-api.ts`: serializa apenas recibos confirmados e metadados pedagógicos/visuais (posição, legenda, descrição acessível, direito de uso e ordem), nunca o binário File.
- `RASCUNHOS_RPC_STAGING_V1.sql`: valida existência e confirmação do anexo, integridade referencial entre instituição, curso, disciplina, autor e questão, além de hash, MIME e tamanho; rejeita imagem pendente, vinculada a outra questão, duplicada ou sem metadados obrigatórios.
- Testes SQL sintéticos verificam gravação e reabertura do rascunho com a imagem, tentativa de cruzar questão e uso de ticket pendente.
- Testes unitários do cliente confirmam que imagens já enviadas produzem snapshot serializável.

### Evidência obtida
- GitHub Actions **#44641756252**: **60/60 testes unitários e 17/17 testes PostgreSQL isolados**, com compilação TypeScript específica aprovada.
- https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44641756252
- Descobertas intermediárias corrigidas: montagem incorreta de SQL e expectativa antiga de teste; CI inicial falhou, e o CI acima comprovou a correção.
- Adicionada verificação explícita de direitos de uso; execução da última revisão ainda deve ser comprovada, sem extrapolar os 77 testes anteriores.

### Situação de homologação real
O código de Edge Function e SQL do bucket continua sem execução em Supabase Auth + Storage real. O exercício PGlite não simula integralmente o Supabase Storage, signed upload URL ou runtime Deno. Nenhuma imagem foi enviada ao Storage do projeto da Vértice. Formulário ainda não publicado.

### Custo e autorização
Consulta direta à organização vinculada ao projeto Supabase da Vértice indicou cotação **US$ 0,01344/hora** para uma branch de desenvolvimento. É despesa horária, cuja confirmação financeira explícita é exigida pela ferramenta. **A branch ainda não foi criada**, não foi executada nenhuma migração ou operação cobrada.

### Pendências antes de considerar homologado
- [x] Motor longitudinal e pré-análise em código.
- [x] Contrato de salvamento versionado em banco isolado.
- [x] Verificação de associação imagem-questão/IES/curso no banco sintético.
- [ ] CI aprovado após a última validação de direitos de uso.
- [ ] Branch de Supabase autorizada em custo e criada.
- [ ] Aplicar SQL corrigida e revisar grants, RLS e regras de MFA no staging.
- [ ] Criar bucket e implantar Edge Function na branch.
- [ ] Testar upload real, confirmação SHA-256, download e reabertura no portal.
- [ ] Homologação pedagógica usando matriz curricular publicada (o catálogo consultado estava vazio).
- [ ] Testes de navegação/edição e acessibilidade em navegador, autorização de merge e publicação.

### Próxima decisão
Confirmar expressamente a cotação por hora da branch de Supabase. Não criar nem cobrar sem esse aceite. Prosseguir no código e nos testes sintéticos independentemente da decisão.

### Evidência complementar — revisão de direitos de uso aprovada
- GitHub Actions **#44641929603**: **60/60 testes unitários e 18/18 testes PostgreSQL isolados**, ambos jobs aprovados e TypeScript isolado incluído no job unitário.
- Teste novo confirma que mídia sem declaração de direitos de uso é rejeitada.
- URL: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44641929603
- O checklist de CI após a última validação de direitos passa a **concluído**. Permanecem pendentes integração real com Supabase Storage, Deno, autenticação e homologação pedagógica no portal.
