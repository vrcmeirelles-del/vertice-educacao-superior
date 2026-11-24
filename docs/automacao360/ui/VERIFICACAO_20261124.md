# Verificação do painel Master candidato (Bloco 09)

`MasterAutomationPanel.tsx` fica aqui, **fora de `source-overrides/client`**, porque não está ligado a rota, layout nem fonte real; colocá-lo no cliente o incluiria no build do portal.

Ambiente temporário, isolado do portal: TypeScript 5.9.3 (mesma versão do `source-overrides/package.json`), React 19.2.1, `@types/react` 19.

| Verificação | Resultado |
|---|---|
| `tsc --noEmit --strict --jsx react-jsx` | sem erros |
| Renderização (`react-dom/server`) com modelo real de `loadMasterDashboard`, projeção parcial (1 regra em sombra) | 40 linhas; contadores 0/1/0/0/39; nenhum `<button>` |
| Renderização com fonte indisponível (`readProjection` falha) | contadores "—" (sem zero falso); 40 regras "Não verificada" |

Ajustes recomendados antes de integrar ao layout Master (não aplicados, para preservar o pacote):
1. O UUID da IES é exibido (`Somente leitura · <uuid>`); a Bíblia pede não expor identificadores. Mostrar o nome da IES vindo do seletor autorizado.
2. O status da fonte aparece cru e em inglês (`Fonte: partial`, `unavailable`, `stale`, `invalid_source`). Traduzir: parcial, indisponível, desatualizada, inválida.
3. O componente reimplementa o filtro em vez de usar `filterRules` (que já trata prioridade e `pt-BR`); falta o filtro de prioridade.
4. A tabela não tem `<caption>`; estilos inline não seguem `master-layout.css` do portal.
5. Não há testes de renderização no padrão do portal (`*.ui.test.tsx` com Vitest/jsdom, listados em `scripts/portal-types.vitest.config.ts`).

# Verificação do painel institucional candidato (Bloco 10)

Mesmo ambiente isolado (TypeScript 5.9.3, React 19.2.1). `InstitutionAutomationPanel.tsx` também fica fora do cliente.

| Verificação | Resultado |
|---|---|
| `tsc --noEmit --strict --jsx react-jsx` | sem erros |
| Fonte completa com 1 alerta pendente | "Fonte observada", "Pendências: 1", 1 item; nenhum `<button>`; nenhum UUID na tela |
| Fonte completa sem alertas | "Pendências: 0" (zero legítimo, pois a fonte declara completude) |
| Fonte parcial | "Cobertura parcial", "Pendências: Não verificadas", lista vazia |
| Fonte indisponível | "Fonte não verificada", "Pendências: Não verificadas" |

Corrige, em relação ao painel Master, a exposição do UUID (usa `scopeLabel` da aplicação hospedeira) e o status em inglês.

Ajustes recomendados (não aplicados):
1. A fila mostra o identificador técnico da regra (`repo.overdue`); exibir o nome do módulo e a descrição da regra.
2. A tabela lista só regras presentes na projeção; regras do catálogo sem observação não aparecem como "não verificada", diferentemente do Master. Uniformizar.
3. Sem `<caption>` nem `scope` nos cabeçalhos; estilos inline.
4. Sem testes `*.ui.test.tsx` no padrão do portal.
