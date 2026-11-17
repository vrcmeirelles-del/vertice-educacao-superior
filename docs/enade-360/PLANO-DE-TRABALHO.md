# Plano de Trabalho — ENADE 360°
Versão 0.1 | 2026-11-16 | Somente documentação; nenhuma homologação implícita.

## Etapas e portas de qualidade
1. **Inventário de fontes oficiais:** identificar edições, áreas, relatórios, microdados, notas técnicas e revisões; aceite: links funcionais, versões, inventário e lacunas.
2. **Leitura e interpretação profunda:** analisar relatórios oficiais, dimensões, questões e estatísticas por edição/área; aceite: fichas de leitura com citações e ressalvas.
3. **Séries históricas por área:** construir mapa de ciclos e rupturas; aceite: matriz explícita de comparabilidade; proibir comparações incompatíveis.
4. **Reprodução quantitativa:** processar microdados com scripts versionados, filtrar população, calcular indicadores elegíveis; aceite: conciliação com tabelas oficiais e registro de divergências.
5. **Motor metodológico geral:** implementar EN-001 a EN-010, rótulos fato/cálculo/inferência/hipótese e trilhas de auditoria; aceite: testes automatizados e revisão independente.
6. **Relatórios auditáveis:** panorama, desempenho, perfil discente, indicadores, benchmark por área e intervenções; aceite: fontes, método, amostra, versões e validação humana em cada relatório.
7. **Homologação do núcleo genérico:** verificar conjuntamente todos os quatro critérios obrigatórios da Bíblia. Sem aceite total, bloqueado avanço.
8. **Especialização:** somente após a etapa 7, parametrizar DCNs, matrizes, itens e contexto de cada curso/IES com pilotos controlados.
9. **Integrações:** Sapiens, CPA, Planejamento e Fato & Ordem por contratos de dados, segregação institucional, consentimento/base legal quando aplicável, testes e rollback.

## Ordem imediata
Concluir inventário e leitura das edições oficiais aplicáveis; escolher indicadores reproduzíveis; documentar filtros e dicionário; produzir relatório de diferenças entre edições e áreas. Não presumir completude do acervo ou validação de indicadores.

## Regra de continuidade
Antes de cada etapa consultar os três documentos. Concluído só com evidência; implementado não é testado; testado com mocks não é homologado com dados reais. Preservar produção; documentar bloqueios.

## Adendo de execução — 2026-11-16 (v0.2, sem substituir o plano anterior)
- Etapa 1: inventário inicial dos índices de resultados, microdados, sinopses e nota técnica 2023 confirmado; falta inventariar arquivo a arquivo, checksums, formatos, revisões e todas as áreas de bacharelado.
- Etapa 2: leitura dirigida da Nota Técnica nº 6/2024 realizada; leitura integral dos relatórios síntese por área permanece pendente.
- Etapa 3: elaborar tabela (edição, área de avaliação, grau bacharelado, instrumento, mudança de metodologia, intervalo válido) antes da comparação histórica.
- Etapa 4: pipeline reprodutível deve (1) obter dicionário da edição; (2) aplicar filtros explícitos de concluintes válidos; (3) agregar por código curso e área; (4) excluir cursos SC; (5) obter média/desvio de cursos por área e aplicar extremos e padronização; (6) calcular conceito contínuo/faixa; (7) conciliar com valores publicados e explicar divergências; (8) gerar trilha de exclusões. **Pendente de implementação e execução em microdados reais.**
- Prova de 2026 para bacharelados: 29/11/2026 prevista; microdados/conceitos previstos a partir de 30/08/2027. Não simular como dados publicados.
- Portão de especialização: permanece bloqueado. Atualizações apenas documentais na branch da PR; nenhuma operação em produção.
