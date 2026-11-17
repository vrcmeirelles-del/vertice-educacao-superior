# Bíblia-Mestra — ENADE 360°
Versão: 0.1 (proposta documental) | 2026-11-16 | Situação: não homologado

## Princípio imutável
**Primeiro compreender profundamente os resultados oficiais; depois construir a inteligência capaz de transformá-los em decisões acadêmicas fundamentadas.**
Manter o passado recuperável e mirar no futuro: nenhuma nova versão poderá apagar decisões, evidências, limitações ou hipóteses anteriores. Toda correção deverá identificar a versão substituída e o motivo. Git conserva o histórico; o Diário de Bordo registra o significado das mudanças.

## Escopo e precedência
1. Núcleo genérico para **todos os bacharelados**, independente de curso, IES ou rede.
2. Especialização por área e por curso **somente após homologação do núcleo genérico**.
3. Integração futura com Sapiens 360°, planejamento estratégico, CPA e Fato & Ordem, com delimitação de permissões e fontes.
4. Não misturar ciclos, modalidades, instrumentos nem metodologias sem justificativa documentada. Não presumir nota, edição ou ciclo.

## Fontes primárias
- Página INEP Enade bacharelados e cursos superiores de tecnologia: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade-bacharelado-e-superiores-de-tecnologia
- Resultados: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/resultados
- Microdados: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade
- Indicadores: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-de-qualidade-da-educacao-superior
Todo dado importado exige URL, edição, data de extração, versão do arquivo, identificador de área, dicionário de variáveis e trilha de transformação.

## Método científico transversal
Leitura integral de relatórios/notas técnicas -> dicionário de dados e critérios de elegibilidade -> reprodução de indicadores -> comparação histórica somente entre bases comparáveis -> interpretação pedagógica com ressalvas -> hipóteses explícitas -> recomendações revisadas por humanos -> avaliação de resultados das intervenções.
Distinguir Conceito Enade, IDD, CPC e IGC; não tomar faixas como escala intervalar nem correlação como causalidade; preservar medidas contínuas e denominadores quando disponíveis.

## Regras do motor interpretativo (especificação, não normas do INEP)
- EN-001: fonte rastreável e indicador metodologicamente identificado.
- EN-002: comparar mesma área/instrumento e recorte compatível.
- EN-003: detectar quebras de comparabilidade temporal.
- EN-004: exibir universo, amostra, faltantes, filtros e incerteza.
- EN-005: não atribuir causalidade sem método apropriado.
- EN-006: ligar competências e habilidades apenas a evidência documental.
- EN-007: diferenciar fato verificado, cálculo reproduzido, inferência e hipótese; recomendações apontam evidências.
- EN-008: revisão humana da conclusão e da ação proposta, com justificativa.
- EN-009: reproduzir resultados oficiais com rotina automatizada, tolerância justificada e relatório de divergências.
- EN-010: registrar versão do modelo, prompt, dados, autor, parecer e alterações.

## Critério de aceite inegociável do núcleo genérico
**NÃO HOMOLOGAR** até (a) reproduzir corretamente indicadores oficiais selecionados e documentar divergências; (b) explicar limitações estatísticas; (c) distinguir fatos, cálculos e interpretações; (d) emitir relatórios auditáveis com fontes, métodos, versões e aprovação humana. Para cada requisito, produzir evidência independente e teste repetível. Só então iniciar personalização por curso/IES.

## Estado técnico preexistente (consulta ao repositório em 2026-11-16)
Existem interface `source-overrides/client/src/components/area/Enade360.tsx` e migração `supabase/migrations/20261107200000_enade360_continuous_quality.sql` com registros por curso, procedência e validação. Presença em código **não comprova publicação, integridade dos dados ou homologação científica**. Não modificar produção nesta fase documental.

## Evolução sem amnésia
A cada etapa: reler esta Bíblia, o Plano e o Diário; manter decisões anteriores; anexar fontes e resultados; explicitar mudança, impacto, regressões e pendências. Alterações metodológicas recebem novo número de versão. O passado é evidência; o futuro é hipótese/teste, nunca fato consumado.

## Limites desta versão
A análise de relatórios e microdados de 2021–2023 e a reconstrução histórica por curso ainda não foram concluídas nem reprocessadas neste registro. As regras acima são diretrizes de projeto sujeitas a validação.
