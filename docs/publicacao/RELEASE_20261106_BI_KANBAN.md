# Publicação Vértice — 2026-11-06

A integração #36 contém Visão Executiva e Kanban de ações 5W2H.
Os serviços Render utilizam `main`, mas compilam sobreposições da branch `release/avaliacao-institucional-20261105`.
Nesta rodada, as sobreposições de Workspace.tsx e OwnerDashboard.tsx foram atualizadas na branch de release, preservando recursos exclusivos dessa branch.
Este commit solicita um novo build automático da main após a sincronização da release.

Escopo publicado: visão executiva, cartões KPI, comparativo anual, Kanban, edição de ações pela interface existente, calendário de prazos e cronograma básico.
Não implementados nesta rodada: fotografia real de perfis, fluxo separado de validação/aprovação, notificações automáticas, Gantt com dependências.
Nenhuma migração de banco foi aplicada.

Validação obrigatória: log de build Render, estado live e teste manual autenticado das rotas de Reitoria e Plano de Ação.
