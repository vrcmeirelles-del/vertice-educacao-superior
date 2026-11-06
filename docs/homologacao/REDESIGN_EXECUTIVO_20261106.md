# Vértice — Redesign executivo (homologação)

Data: 2026-11-06
Status: proposta técnica inicial, sem deploy e sem merge
Referência solicitada: https://chatgpt.com/share/6aedca09-d940-83e8-8331-f227060ecd06
Limitação: o link público não expôs o conteúdo visual da conversa para auditoria; NÃO atribuir a ele escolhas específicas de design.

## Restrições invariantes
- Não alterar a branch main nem implantar no Render.
- Não modificar Supabase, autenticação/MFA, políticas de acesso, dados, banco ou migrações.
- Preservar rotas, perfil de usuário e contratos de dados. Não retirar funcionalidades.
- Código fonte atual é distribuído entre ZIP base e source-overrides; README diz que source-overrides é sobreposto ao ZIP antes do build. Antes de escrever alterações visuais funcionais, montar o fonte completo em ambiente isolado e executar testes.
- Trabalhar com IES/curso/semestre/ano; nunca misturar recortes incompatíveis. Mostrar proveniência, data da atualização e avisos sobre divergência.

## Diagnóstico preliminar a partir do repositório
- README: Render Static Sites, Supabase Auth/PostgreSQL, /master, /reitor e /reitor/reservado.
- Componentes existentes: source-overrides/client/src/pages/OwnerDashboard.tsx, components/area/GoalsDashboard.tsx, components/area/ManagementCharts.tsx, components/bi/ModoTV.tsx.
- Há estilos dedicados por componente e cores inline em OwnerDashboard.tsx; recomendável padronizar tokens visuais e hierarquia sem reescrever regras.
- O conteúdo do site autenticado e da referência compartilhada não foi inspecionado visualmente nesta etapa: observações são hipóteses de UX, não achados comprovados por screenshot.

## Arquitetura visual proposta
- Navegação lateral: Visão Executiva | Acadêmico | Captação | Permanência | Regulação | Metas | Financeiro | Aquisições | Biblioteca INEP | Mesa Digital.
- Barra superior: IES, curso, período, comparação, status de atualização e conta.
- Primeira dobra: 4 a 6 KPIs com rótulos explícitos, variação anual, fonte e link para detalhe.
- Segunda dobra: comparativo ano-a-ano e semestre-a-semestre, com séries separadas para reprovação por nota, por falta, evasão e matrículas.
- Terceira dobra: alertas de prazos, metas e ações sugeridas; tabelas detalhadas sob demanda.
- Não utilizar números simulados em produção; mock data identificado exclusivamente na homologação.
- Estados de interface: carregando, sem dados, dado não validado, erro, parcial, atualizado.
- Acessibilidade: navegação por teclado, foco visível, contraste, não depender apenas de cor, responsividade, tabelas acessíveis.

## Design tokens iniciais (proposta, sujeitos à referência visual)
- Primária #17365D; destaque #2563EB; sucesso #087F5B; alerta #B45309; crítico #B42318.
- Superfície #FFFFFF; fundo #F6F8FC; texto #182230; texto secundário #526071; borda #E3E9F1.
- Tipografia Inter / fonte do sistema; espaçamento modular 4/8px; bordas 12px; gráficos legíveis.

## Plano de implementação
1. Montar ZIP fonte + source-overrides em ambiente separado, mapear scripts e entradas.
2. Inventariar rotas, componentes, testes, integração e baseline visual com capturas autorizadas.
3. Criar camada aditiva de tokens/novos componentes, sem sobrescrever módulos de dados.
4. Aplicar inicialmente somente à Visão Executiva com feature flag desligada por padrão.
5. Fazer testes de regressão: autenticação/MFA, acesso por papéis, rotas, filtros, agregações, comparativos, responsividade, build.
6. Capturar comparação antes/depois, apresentar para aprovação e só então decidir sobre PR/merge.
7. Deploy de homologação apenas em ambiente isolado que não compartilhe gravações, rotas ou dados mutáveis com produção; exige validação de configuração e aprovação se gerar custo.

## Critérios de aceite
- Todas as rotas existentes preservadas; testes anteriores passando.
- Nenhum write no Supabase e nenhuma mudança de segredo, permissão ou esquema.
- Números reconciliados contra fonte por grão e período, com exceções explicitadas.
- Comparação anual com seleção de anos e cálculo consistente.
- Acessibilidade AA onde aplicável, layout desktop/tablet/mobile sem overflow indevido.
- Main, Render produção e domínio público sem alterações.

## Pendências para implementação integrada
- Inspecionar visualmente a referência compartilhada (imagem ou conteúdo do chat).
- Montar pacote fonte do ZIP e verificar árvore completa antes de alterar rotas/componentes.
- Confirmar base de testes real e ambiente de pré-visualização não produtivo.
