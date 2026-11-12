# Master → Instituição: navegação lateral

Estado: implementação parcial para revisão; não homologada nem publicada.
Base: b0ff98d4e590c1dfd2dad67f64fd6632f57cf2dc.

## Diagnóstico e escopo

A rota é resolvida em OwnerDashboard.tsx, que instancia Workspace com key da instituição. O fragmento usa instituicao e aba. Os componentes InstitutionTabs e seu CSS já existiam, mas não eram importados pelo Workspace. A produção foi acessada em sessão Master; confirmou-se o catálogo extenso original na instituição solicitada. Nenhuma operação de escrita foi executada pelo navegador.

## Arquivos

- source-overrides/client/src/components/area/Workspace.tsx: conecta navegação ao Master, filtra o catálogo pela macroárea, conserva cartões, favoritos, pesquisa, ativação e componentes de conteúdo. Atualiza o fragmento com instituição e aba; usa histórico do navegador. Adiciona confirmação conservadora após edição de controles e aviso de saída da página.
- source-overrides/client/src/components/area/InstitutionTabs.tsx: sete destinos, filtragem pelos grupos disponíveis, aplicação opcional somente ao Master, semântica de navegação com aria-current em vez de tabs ARIA incompletas, conteúdo preservado para outros perfis.
- source-overrides/client/src/components/area/institution-tabs.css: melhora contraste dos textos secundários. Mantém grid com lateral direita sticky, largura 248px, adaptação tablet e menu expansível móvel.
- source-overrides/client/src/components/area/InstitutionTabs.test.tsx: quatro testes de mapeamento, renderização e filtragem.
- source-overrides/vitest.config.ts: inclui a nova suíte, conservando a suíte de servidor existente.

## Inventário comparativo e distribuição

Nenhum ramo de renderização dos módulos foi removido; componentes de formulários, handlers de persistência, consultas, licenciamento e autorização permanecem no Workspace. Isso é uma verificação de código, não comprovação de todos os fluxos de escrita em execução.

| Área | Destinos existentes |
|---|---|
| Visão Geral | base, geral, analise |
| Dados da Instituição | cadastro, emec |
| Cursos e Ofertas | visao, eorbit, auditoria, backups, raio-x-direito, resultado-curso, simulador, escola-enem, escola-egressos |
| Gestores e Acessos | equipe, metas, plano, diagnostico, governanca, inclusao, acompanhamento-especial, extensao, aquisicoes, egressos |
| Integrações | sync, integracao-ies, fontes, conexoes, aprendizagem |
| Licenciamento | conta, contrato, billing, modulos, catalogo |
| Histórico e Auditoria | repositorio, validacao, biblioteca, avaliacao, novo_instrumento, enade, documentos, ia, reitor |

A última área reutiliza os módulos disponíveis de regulação/evidências. Um aviso esclarece que não existe histórico consolidado nesta entrega. A distribuição exige revisão de produto: EBITDA e instrumentos não são, por si, auditoria cronológica. Cadastro e cursos continuam no mesmo formulário existente, sem duplicação.

## Validação executada

Ambiente reconstruído a partir do ZIP original com sobreposição de source-overrides, conforme o build de Render.

- npm ci --legacy-peer-deps --no-audit --no-fund: passou.
- npm run build:static: código de saída 0; Vite compilou. Prerender falhou com EPERM no pipe do tsx e foi ignorado pelo script existente. Não considerar prerender validado.
- npm run check: seis diagnósticos TypeScript antes e depois, nos mesmos pontos lógicos: AcompanhamentoEspecial360, DocumentManager, Inclusao360, ProfileSimulator, Workspace (institutionName anulável) e ExperiencePortal. Sem novo diagnóstico observado na comparação anterior à adição da suíte. Não foram corrigidos erros de outros módulos.
- npx vitest run client/src/components/area/InstitutionTabs.test.tsx: 4/4 passaram.
- git diff --check: passou.
- Produção: sessão Master confirmada e layout antigo observado; não contém este patch.

## Segurança

Nenhuma alteração de backend, RLS, banco, contrato de API, integrações ou serviços. visibleTabs(role), os bloqueios de módulo e os controles dos ramos originais continuam no código. O Workspace é remontado por instituição no pai. Isolamento/RLS não foram testados em sessões alternativas nesta entrega.

## Limitações e aceite pendente

- Testar a nova tela renderizada no navegador em desktop e mobile, com evidências visuais. As regras CSS existentes foram reutilizadas, mas não há homologação visual desta versão.
- Testar Salvar/Cancelar e ações dos módulos com contas autorizadas; testar leitor, gestor e troca entre instituições.
- A confirmação é conservadora: mudanças em filtros também podem dispará-la e ela não recebe confirmação de salvamento dos componentes filhos. Não é um mecanismo completo de dirty state.
- Troca para outra instituição por navegação externa ao Workspace não é interceptada por este patch.
- Se todos os módulos de uma macroárea estiverem bloqueados, a seleção não tem destino desbloqueado; revisar esse estado antes da publicação.
- Não há novo feed consolidado de auditoria. Não foram simulados registros.
- Faltam testes interativos de histórico, teclado, layout, carregamento e console da versão alterada.

## Publicação e retorno

Nenhum deploy acionado. Mudanças devem permanecer em branch/PR de rascunho até concluir os itens acima. A main do projeto está configurada para deploy automático; por isso esta entrega não altera main. Retorno, após futura publicação: reverter o commit da refatoração e acompanhar os deploys dos serviços existentes.
