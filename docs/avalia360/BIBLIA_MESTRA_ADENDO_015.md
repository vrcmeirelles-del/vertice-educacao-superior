# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 015 — Serviço de mídia privada e homologação sintética
**Data:** 2026-11-19 | **PR:** #207, rascunho | **Produção:** nenhuma alteração

### Preservação
Os adendos 001–014 permanecem válidos. Mantidos o motor pedagógico determinístico, currículo longitudinal, autonomia docente, imagens no enunciado/alternativas, rubricas, diagnóstico/formativo/somativo, psicometria condicionada e conexões futuras a Fato & Ordem, Sapiens 360° e planejamento.

### Código desenvolvido
- `supabase/functions/vertice-avalia-media/index.ts`: Edge Function candidata (não implantada) para tickets privados de upload e confirmação de integridade.
- `docs/avalia360/sql/IMAGENS_PRIVADAS_STAGING_V1.sql`: tabelas privadas de tickets, ligação a instituição/curso/disciplina/questão, RPC com AAL2, serviço exclusivo de finalização.
- `docs/avalia360/sql/BUCKET_PRIVADO_STAGING_V1.sql`: definição de bucket privado (não aplicado).
- `scripts/tests/avalia360-runtime/media-persistence.test.mjs`: seis novos testes SQL de tickets, isolamento, MFA, hash, permissão de finalização e acesso negado.
- `scripts/tests/avalia360-runtime/fixture.mjs` atualizado para carregar SQL de mídia no banco sintético.

### Evidência de execução
GitHub Actions **#44640648850**: **59/59 testes unitários e 14/14 testes PostgreSQL isolados aprovados**, mais verificação TypeScript isolada concluída com sucesso.
https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44640648850

### Segurança e integridade
1. O usuário precisa de JWT e MFA AAL2; RPC verifica autorização por instituição/curso/disciplina.
2. IDs e caminho de Storage são criados pelo servidor; não aceitar paths fabricados.
3. Bucket projetado é privado, limitado a PNG/JPEG/WebP e 10 MiB por arquivo.
4. A Edge Function baixa o objeto do Storage e compara assinatura binária, tamanho e SHA-256 antes da confirmação.
5. A finalização requer serviço privilegiado e somente mídia registrada, pendente e íntegra pode ser confirmada.
6. Não disponibilizar chave de serviço ao navegador ou conceder acesso direto às tabelas privadas.
7. Recursos pendentes ainda precisam de limite operacional, limpeza de órfãos e revisão de políticas de storage.

### Importante: o que NÃO foi testado
- Execução da Edge Function em runtime Deno/Supabase e comunicação real com Storage.
- Bucket, policies e grants reais no Supabase de homologação.
- Fluxo do formulário enviando e recuperando imagens com posições/legendas e direitos de uso; a RPC de rascunhos ainda recusa imagens pendentes.
- Homologação com matriz curricular e prova reais. O acervo curricular consultado estava vazio.
- Homologação multi-IES com usuários reais; validação psicométrica e aplicação de provas.

### Dependência de custo
Não existe branch Supabase exclusiva de homologação autorizada para Avalia 360°. A ferramenta exige confirmação expressa de custo antes da criação. Nenhum custo foi autorizado nem cobrado nesta etapa. **Não usar produção como staging** e não aproveitar a branch ENAMED sem escopo autorizado.

### Próxima frente
1. Homologação de Edge Function e bucket em projeto/branch Supabase isolados (após aprovação financeira da branch).
2. Integrar o retorno `imageId` confirmado ao snapshot da prova; validar versão, posição, legenda, descrição acessível e direito de uso no backend.
3. Testar recuperação de imagem ao reabrir rascunho e submissão para curadoria.
4. Rodar testes end-to-end com professor/coordenador e cursos distintos, sem alterar produção.
