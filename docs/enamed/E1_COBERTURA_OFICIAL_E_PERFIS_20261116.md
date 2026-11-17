# E1 — Passagem seguinte: autenticação INEP, cobertura e validação de acesso (16/11/2026)
**Situação:** E1 ABERTA, sem hash oficial. E2/E3 não homologadas. Nenhum dado de produção alterado.

## 1. Fontes oficiais
- A página INEP [Provas e Gabaritos](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos) está publicada e atualizada em 20/10/2026. Busca textual a encontrou com os seguintes elementos de 2026: aplicação regular, **Cadernos 01 e 02**, gabaritos **preliminares** de ambos; e reaplicação, **Cadernos 01 e 02**, gabaritos **preliminares** de ambos.
- O HTML simplificado da página no navegador de consulta só exibe marcadores 2026/2025, sem links individuais. Em 16/11, quatro downloads de notas (40/19/1PL/42) retornaram 502/timeout; tentativa via ferramenta de arquivos do Caderno 02/2025 também falhou.
- Notícia INEP 15/09/2026 confirma gabaritos preliminares da aplicação, expectativa de definitivos em 04/12/2026; a republicação do Edital 71/2026 e notícia da reaplicação confirmam cronograma.
- Nenhum PDF novo foi obtido integralmente para cálculo SHA-256. As URLs da tabela F&O continuam **declaradas, não autenticadas**. Não inventar hash, gabarito definitivo ou ligação com publicação oficial.

## 2. Cobertura Fato & Ordem confrontada com a listagem oficial
| Conjunto | Página oficial INEP | Registros F&O | Posições distintas F&O | Conclusão |
|---|---|---:|---:|---|
| ENAMED 2026 regular Caderno 01 | listado | 200 | 100 | duplicado 2×; confronto por texto e fonte pendente |
| ENAMED 2026 regular Caderno 02 | listado | 200 | 100 | duplicado 2×; confronto por texto e fonte pendente |
| ENAMED 2026 reaplicação Caderno 01 | listado | 83 | 83 | cobertura parcial **não confirmada**, precisa verificar fonte e numeração |
| ENAMED 2026 reaplicação Caderno 02 | listado | 0 no inventário por URLs do banco | 0 | **lacuna de cobertura candidata**; confirmar se outra tabela/fonte o contém antes de chamar ausente |
| ENAMED 2025 | listado no catálogo INEP | 0 na tabela `fo_enamed_items` inspecionada | 0 | inventário específico de 2025 pendente; procurar outras tabelas/arquivos antes de concluir ausência global |

**Atenção:** páginas listam cadernos distintos. Não usar 83 registros para inferir 17 questões faltantes, nem considerar que todos os cadernos tenham 100 questões textualmente equivalentes, sem PDF original.

## 3. Permissões e QA da PR #168
- `visibleTabs` concede `enade` a Master, Reitor, Diretor Geral, Diretor Pedagógico, Procurador, Gestor e CPA; coordenação e NDE têm `trilhas-enade`, mas não aba institucional `enade`.
- `EnamedEnvironment.test.tsx` adicionou 4 testes de renderização SSR/visibilidade em código. Não equivale a sessão autenticada ou teste de RLS real em cada papel; não habilitar novos perfis apenas alterando menu.
- Workflow GitHub de contratos ENAMED passou 10/10 (6 Node + 4 Python com fixtures sintéticas) na rodada anterior. TypeScript completo do commit `2591fcc5...` aprovado; execução mais recente `43997164461` foi cancelada por novos commits. **Não existe aprovação definitiva de TypeScript / interface para o HEAD desta passagem.**
- Portal Render vinculado à main, PR #168 segue draft e sem merge/deploy.

## 4. Aceite operacional ainda pendente
- [ ] Recuperar binários oficiais e hashes SHA-256 por prova/caderno/gabarito/versão, com cadeia de custódia.
- [ ] Completar leitura e vigência de notas técnicas e atos com validação profissional.
- [ ] Reconciliar cada fonte/caderno, especialmente reaplicação Caderno 02, com o inventário total do F&O.
- [ ] Resolver 200 posições duplicadas de forma não destrutiva e conferir 483/483 questões integralmente.
- [ ] Obter pareceres dual-IA + curador médico, após E1; não executar escritas automáticas.
- [ ] Executar CI atualizado e QA real por perfil, incluindo coordenação/NDE e acesso entre IES em sessões autorizadas.
- [ ] Comprovar dados sintéticos na ponte F&O → Vértice → Sapiens, sem prometer indicadores oficiais antes de fontes aceitas.
