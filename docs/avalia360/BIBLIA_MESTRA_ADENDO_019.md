# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 019 — Proteção contra abuso de uploads, isolamento de recibos e bloqueio PDF
**Data local:** 2026-11-19 | **PR:** #207 em rascunho | **Produção:** intocada.

### Continuidade
Os adendos 001–018 são preservados integralmente: matriz curricular, avaliação longitudinal e interdisciplinar, tipos diagnóstica/formativa/somativa, autonomia docente, anexos de imagem, QR e manuscrito, rascunhos versionados, direitos de uso, Sapiens 360, Fato & Ordem e avaliação de qualidade. Os resultados desta fase não autorizam declaração de homologação geral.

### Alterações de segurança registradas
1. **Limites agregados de upload:** a função de preparação de tickets da proposta `docs/avalia360/sql/IMAGENS_PRIVADAS_STAGING_V1.sql` recusa um professor/IES/curso com 24 tickets ainda pendentes emitidos nas duas horas anteriores, mesmo quando são usados UUIDs diferentes para questões; impõe teto adicional de 100 tickets por 24 horas. Permanecem o máximo de 12 imagens por questão e 10 MiB por arquivo. Esses limites são regras iniciais revisáveis, não quotas econômicas comprovadas.
2. **Cache de recibos com escopo:** `AssessmentDraftWorkspace.tsx` não reutiliza um recibo cujo `institutionId`, `courseId`, `disciplineId` ou `questionId` seja diferente, ainda que o mesmo arquivo continue selecionado.
3. **Novo teste SQL:** `scripts/tests/avalia360-runtime/media-persistence.test.mjs` inclui geração de 24 tickets pendentes com várias questões sintéticas e verifica o bloqueio da tentativa seguinte.
4. **CI:** GitHub Actions **#44649378335** concluiu com sucesso **60 testes unitários e 20 testes PostgreSQL isolados**, mais verificação TypeScript específica do Avalia 360°. Link: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44649378335

### Limites da evidência
- Os testes confirmam o comportamento de funções e SQL candidatos **em PGlite**, não uma atualização da SQL já aplicada à branch Supabase.
- A branch de staging `eagkkkclfcedzanuqckj` estava **INACTIVE** no início desta execução; não foi reativada nem recebeu migração.
- Não houve novo teste com login Auth emitindo JWT verdadeiro, MFA/AAL2 real ou upload efetivo de bytes para Storage.
- As 226 migrações históricas da Vértice não estão reconstruídas integralmente no staging; o espelho curricular que foi aplicado tem regras default-deny e não reproduz todas as policies de produção.

### Investigação da clonagem de funções — PDF preexistente
- Logs anteriores: `vertice-source-pdf-preview` teve bundle de cerca de **35,78 MB** e falhou ao ser copiada com HTTP 413 durante o branching.
- O arquivo original `supabase/functions/vertice-source-pdf-preview/index.ts` importa dinamicamente `npm:pdfjs-dist@5.4.624/legacy/build/pdf.mjs`, dependência que requer avaliação de empacotamento.
- Documentação oficial do Supabase atualizada em outubro/novembro de 2026: 5 MB para bundle feito no servidor e 20 MB para bundle feito localmente via CLI. A função relatada excede ambos os limites; apenas alternar empacotamento para CLI não é correção suficiente.
  - https://supabase.com/docs/guides/functions/limits
  - https://supabase.com/kb/troubleshooting/edge-function-bundle-size-issues
- A correção deverá reduzir dependências ou segmentar a extração PDF preservando autenticação, confidencialidade, referências de páginas, processamento apenas de texto embarcado e a decisão de não executar OCR sem aprovação. **Não desativar silenciosamente a função no projeto de produção.**

### Portão de conclusão
**Aprovado nesta etapa:** módulo determinístico + contratos PGlite (60/60 unitários e 20/20 Postgres).
**Ainda não aprovado:** funcionamento real Auth/MFA, Edge Function/Storage, interface, PPC publicado, política de acesso curricular com paridade, QR/OMR e publicação.
**Ação seguinte:** implantar o patch de quota somente após reativação autorizada da branch, validar autenticação e Storage real, corrigir clonagem PDF em frente separada, rever SECURITY DEFINER e só então homologar uso docente.
