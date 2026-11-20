# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 014 — Homologação isolada do banco e contrato inicial de imagens
**Data:** 2026-11-19 · **PR:** #207, rascunho · **Produção:** inalterada

### O que permanece preservado
Adendos 001–013 completos: algoritmo determinístico por tema e competência, longitudinalidade, PPC/PDI, graus de dificuldade, finalidade diagnóstica/formativa/somativa, matriz estratégica, autonomia docente, formulário, QR/OMR/discursivas futuros, e integração Sapiens 360°/Fato & Ordem. A migração SQL permanece SOMENTE para revisão até homologação de segurança no Supabase.

### Evidências novas
- Workflow **44638117293**: 50/50 testes unitários e 8/8 testes PostgreSQL isolados aprovados.
- Workflow **44638525088**: 59/59 testes unitários e 8/8 testes PostgreSQL isolados, com TypeScript isolado aprovado.
- A suíte PostgreSQL roda em **PGlite**, sem rede, sem dados reais, sem branch cobrada no Supabase.
- URL: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44638525088

### Novos artefatos
- `scripts/tests/avalia360-runtime/fixture.mjs`: cenário de banco em memória com Auth/MFA e docentes sintéticos.
- `scripts/tests/avalia360-runtime/draft-persistence.test.mjs`: criação, listagem, consulta, edição, snapshots imutáveis, conflito de versão, rejeição de falta de MFA, disciplina sem vínculo, outra IES, imagens não confirmadas, bloqueio de acesso direto e PPC não publicado.
- `.github/workflows/avalia360-quality.yml`: job PostgreSQL isolado.
- `source-overrides/client/src/lib/avalia360/image-inspection.ts`: identificação por assinatura de arquivo PNG/JPEG/WebP e hash SHA-256 dos bytes.
- `source-overrides/client/src/lib/avalia360/private-image-upload.ts`: cliente de ticket, envio ao Storage por URL assinada e confirmação da integridade retornada pelo servidor.
- Testes unitários correspondentes para assinatura, ticket, falha e confirmação.

### Decisões de segurança
1. A autorização verdadeira acontece no backend e exige autenticação/MFA, IES, curso e disciplina.
2. Os rascunhos são armazenados com snapshots versionados; transações rejeitam versões defasadas.
3. Arquivos locais são tratados como PENDENTES até que o Storage e um backend confirmem presença, hash e escopo.
4. O contrato de imagem usa `vertice-avalia-media` e bucket privado `avalia360-private` como NOMES PROPOSTOS. Eles não estão implantados.
5. Signed upload URLs exigem curta exposição e não substituem verificação de hash no servidor após upload.
6. O cliente não disponibiliza URL pública permanente.
7. Não há comprovação de integração à UI do portal nem de parecer gerado com PPC real. O acervo `vertice_app.curriculum_builds` tinha 0 registros no estado consultado.

### Limitações pendentes
- [x] SQL de rascunhos exercitado com dados sintéticos em banco isolado (8/8).
- [x] Suite algorítmica e TypeScript aprovados (59/59).
- [x] Contrato de upload privado com verificação inicial de arquivo implementado no cliente.
- [ ] Edge Function `vertice-avalia-media` e bucket privado implementados e testados no Supabase.
- [ ] Registro persistente das imagens, associação a questões e retorno de imagens na reabertura da prova.
- [ ] SQL de rascunhos aplicado no banco de homologação real com usuários/MFA/RLS equivalentes aos da plataforma.
- [ ] Testes de interface, anexos com figuras e recuperação após sair/entrar.
- [ ] Construção Curricular alimentada com PPC e competências reais e validadas.
- [ ] Curadoria de prova real e correção QR/OMR/Discursiva concluídas.
- [ ] Merge/deploy: NÃO realizados.

### Próxima ação
Implementar o servidor de imagens com validação dos bytes já armazenados, hash, vínculos por curso/questão e metadados auditáveis; complementar a RPC para referências a imagens confirmadas; homologar em staging com MFA e perfis reais autorizados. Apenas depois integrar ao portal.
