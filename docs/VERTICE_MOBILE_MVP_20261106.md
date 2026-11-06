# Vértice Mobile — MVP BI 06/11/2026

## Arquitetura
Nova interface mobile-first (rota /mobile) integrada a React, Render e Supabase existentes. Sem criar novo serviço, banco, instância, workspace ou cobrança.

## Entregas
- Nova rota /mobile e atalho na área institucional.
- Filtros por instituição e semestre; indicadores de matrículas, metas e prazos.
- Comparação anual de semestres equivalentes (2025/01 × 2026/01 ou 2025/02 × 2026/02).
- Gráficos por curso, aprofundamento e links para a gestão completa.
- Alertas de queda anual comparável, ausência de fonte e metas vencidas.
- Supabase Auth, MFA AAL2, RLS existente; somente SELECT. Não incorpora dados simulados.
- Manifesto PWA, ícone vetorial e service worker sem cache de dados protegidos.
- Login com retorno ao aplicativo.

## Verificações obrigatórias de homologação
1. Extraia vertice-servidor-source.zip, aplique source-overrides desta branch e execute npm ci --legacy-peer-deps, npm run check, npm test e npm run build:static.
2. Confirme inclusão dos arquivos da branch no build Render. O comando atual injeta arquivos da branch release/avaliacao-institucional-20261105 após sobrepor source-overrides; nenhum arquivo de OwnerDashboard foi modificado nesta entrega.
3. Sem sessão ou MFA AAL2, /mobile não pode revelar dados. Validar redirecionamento do login.
4. Em cada perfil (Master, Gestor e conta sem vínculo), confira isolamento por instituição, autorização RLS e o logout.
5. Compare contagens do móvel com o portal no mesmo semestre. Em períodos ausentes, apresente 'Sem dados', jamais zero. O comparativo anual deve incluir apenas cursos presentes nos dois períodos.
6. Teste Android em 320, 360, 390 e 412 px, gráficos e botões com o dedo, orientação vertical e fonte ampliada.
7. Teste adicionar à tela inicial no Chrome Android. Confirme suporte do ícone SVG; se necessário, adicionar PNG 192 e 512 px antes de declarar instalação homologada.
8. Sem internet, indicadores institucionais não podem ser servidos em cache. Verifique Cache Storage.
9. Teste CSP, título, noindex, links e regressão de /master e /reitor/reservado.
10. Antes da publicação, verificar se ambos os serviços Render com autoDeploy=commit estão configurados para implantar automaticamente na main.

## Restrições
- Não há dados individuais validados para estimar evasão, matrícula grátis sem AV1/AV2 ou reprovações por falta/nota no aplicativo.
- Os quantitativos não identificam necessariamente alunos únicos; recorte com cobertura parcial é sinalizado.
- O painel é leitura de dados persistidos; não comprova integração em tempo real.
- Os Render Static Sites atuais não têm previews de PR ativos. Nenhuma publicação ou teste em homologação foi executado.
- Não executar merge até build, validação de acesso e conferência dos números com fonte oficial.

## Arquivos
Novos: components/bi/VerticeMobileBI.tsx, components/bi/vertice-mobile.css, public/vertice-mobile.webmanifest, public/mobile-sw.js, public/mobile-icon.svg.
Alterados: App.tsx, Login.tsx e client/index.html.

## Condição de publicação
Build e testes aprovados; conferência da fonte e RLS; teste visual e de instalação no Android; autorização explícita para publicar.
