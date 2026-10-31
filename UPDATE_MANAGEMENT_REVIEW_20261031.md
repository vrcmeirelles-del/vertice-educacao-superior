# Análise gerencial — conciliação explicável

Nova aba de conciliação por curso e semestre dos documentos. Cruza apenas vínculos explícitos, separa medição de resultado e cobertura documental, mostra fontes (IDs de exigência, versão e medição), lacunas e providências para revisão humana.

Não usa IA generativa nem envia dados a provedor externo. Não interpreta conteúdo dos arquivos. Não estima conceito INEP: exige validação do instrumento/ato, aplicabilidade, qualidade da evidência e avaliação humana. NSA nunca é inferido; ausência de evidência não recebe zero.

Corrigida seleção de versões no resumo, série histórica, CSV e tela do repositório: uma versão mais recente classificada como apoio/diversos não faz reaparecer a validação de versão antiga. Histórico preservado.

Validação local: TypeScript aprovado; 84 testes aprovados (8 novos); build estático aprovado. Aviso preexistente de chunks acima de 500 kB. QA interativo Chromium bloqueado pelo ambiente: socket() Operation not permitted. Nenhum teste autenticado de produção executado. A alteração não requer migração nem modifica dados institucionais. A publicação segue o auto-deploy do serviço Render a partir de main.

Fonte de trabalho: extrair vertice-servidor-source.zip e aplicar source-overrides por cima; npm ci --legacy-peer-deps; npm run check; npm test; npm run build:static. Os ZIPs de produção não foram sobrescritos nesta entrega.

Pendências separadas: acesso às metas institucionais sem curso na carteira; validação reversa de vínculos quando course_id da meta é alterado; revisão de UX autenticada e confirmação do commit publicado antes de deploy; definição de provedor, segredo server-side e política de tratamento antes de IA generativa.
