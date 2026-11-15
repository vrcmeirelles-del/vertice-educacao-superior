# Memória técnica — não implantar

`vertice-app-de67f5fe.tar.gz` contém os 120 arquivos da última versão independente,
copiados do commit `de67f5fe979e483e082f3ac8cf7c6212cb178a49` de
`vrcmeirelles-del/vertice-app`. O manifesto registra o Git blob e SHA-256 de cada
arquivo e o SHA-256 do pacote completo. Não contém credenciais de produção.

O pacote é histórico, não uma segunda implementação ativa. Não deve ser editado,
extraído para o build, publicado nem sincronizado de volta para outro repositório.
Novas alterações pertencem ao portal neste repositório.

O histórico original permanece preservado no repositório de origem, destinado
ao arquivamento. A lista de commits de origem está no arquivo de proveniência.

## Código ativo consolidado

| Finalidade | Local canônico |
| --- | --- |
| Planejamento do curso e semestral | `source-overrides/client/src/components/area/CoursePlanning.tsx` e `planning/` |
| Acesso com a sessão do portal e auditoria | Migrações `portal_course_planning` e `portal_planning_content_validation` em `supabase/migrations/` |
| Estrutura inicial do módulo, para novo ambiente | `supabase/bootstrap/vertice_app.sql` |
| Testes de acesso, gravação e histórico | `supabase/tests/course_planning.sql` e `CoursePlanning.ui.test.tsx` |

As demais peças da API e da extensão independentes permanecem no pacote histórico
para recuperação e comparação. Não foram declaradas funcionalidades nativas do
portal nem reativadas por esta consolidação.
