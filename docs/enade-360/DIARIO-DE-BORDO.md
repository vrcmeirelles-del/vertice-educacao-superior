# Diário de Bordo — ENADE 360°
Registro acumulativo; nunca substituir entradas antigas. Data: 2026-11-16.

## Entrada 001 — Diretriz e escopo
- Decisão: primeiro compreender os resultados oficiais, depois desenvolver a inteligência interpretativa.
- Escopo: núcleo genérico para todos os bacharelados; especialização por curso/IES posteriormente.
- Porta de homologação: reprodução de indicadores oficiais; limitações estatísticas; distinção entre fatos e interpretações; relatórios auditáveis.
- Status: diretrizes aprovadas pelo responsável pelo projeto. Implementação/homologação do novo método: **não comprovadas**.

## Entrada 002 — Diagnóstico documental de repositório
- Consulta constatou `source-overrides/client/src/components/area/Enade360.tsx` e `supabase/migrations/20261107200000_enade360_continuous_quality.sql`.
- Código registra classes de dados e proveniência/validação; não é evidência de homologação de indicadores nacionais ou validação em produção.
- Busca por "Bíblia-Mestra" e "diario de bordo" no repositório não localizou arquivos correspondentes nas buscas efetuadas; isso não prova inexistência em caminhos não indexados.
- Ação: propor documentação inicial em branch separada; nenhuma alteração de aplicação/banco.

## Pendências abertas
- Leitura integral e conferência das fontes do INEP, inclusive relatórios síntese por área.
- Tratamento comparável de edições, mudanças de metodologia e lacunas.
- Processamento reprodutível de microdados, recálculo e conciliação dos indicadores.
- Testes independentes e homologação do núcleo genérico.
- Planejamento de futuras especializações e integrações condicionado à homologação.

## Protocolo das próximas entradas
Data/hora; etapa; fonte/URL/versão; ação executada; resultado e evidências; limitações; decisão; mudanças de critérios; responsável e próximo teste. Jamais transformar uma intenção em status concluído.

## Entrada 003 — 2026-11-16 — Verificação metodológica transversal INEP
- Fontes consultadas: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/resultados ; https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade ; https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/enade ; Nota Técnica nº 6/2024: https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nota_tecnica_6_metodologia_calculo_conceito_enade_2023.pdf ; calendário https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/exame-nacional-de-desempenho-dos-estudantes-enade .
- Fatos conferidos: filtros de elegibilidade 2023 e exigência mínima de 2 concluintes válidos; médias por curso/área, reescalonamento e pesos 25% FG e 75% CE padronizados. Índices de microdados 2021–2023 disponíveis. Aplicação de bacharelados 2026 prevista para 29/11/2026, microdados/conceitos previstos desde 30/08/2027.
- Interpretação: média bruta de estudantes não equivale automaticamente ao Conceito Enade; comparação exige identificação de área, edição e método.
- Limites: nenhuma base de microdados 2021–2023 foi integralmente processada neste registro; nenhum indicador foi reproduzido numericamente ou homologado; sem diagnóstico por IES/curso.
- Decisão: acrescentar regras EN-011 a EN-016; preservar núcleo genérico para bacharelados, adiar qualquer especialização.
- Próximo teste: baixar arquivos e dicionários oficiais, catalogar todas as áreas, testar filtros e confrontar resultados calculados com planilhas oficiais de conceito.

## Entrada 004 — 2026-11-16 — Inventário e primeira conciliação agregada
- Atos: inventariadas as listas oficiais de bacharelados de 2021 (10), 2022 (13), 2023 (22), preservadas em `CATALOGO-BACHARELADOS-2021-2023.md`; criada `PROVA-QUANTITATIVA-001.md` com linhas de entrada e cálculo reconstruível.
- Fonte do teste: https://download.inep.gov.br/educacao_superior/enade/apresentacao/2022/apresentacao_resultados_enade_2022.pdf (slides 6 e 10). Apresentações e documentos usados para a lista: https://download.inep.gov.br/educacao_superior/indicadores/resultados/2021/apresentacao_CPC_IGC_2021.pdf e https://www.gov.br/inep/pt-br/relatorio-anual-de-atividades-e-gestao-do-inep-2023/avaliacoes-e-exames-educacionais/avaliacoes-exames-nacionais/enade .
- Resultado: 447.494 inscritos em bacharelados de 2022 reproduzidos por soma; 25 dos 26 percentuais publicados conciliados por arredondamento; Psicologia 39.135/44.156=88,63% contra 87% na fonte (1 divergência).
- Limite: uso de estatísticas agregadas publicadas, não de registros individuais ZIP. Acesso aos downloads brutos não se concretizou nesta sessão. Sem reprodução de Conceito Enade nem diagnóstico por IES. Área 2023 validada como 22 bacharelados no relatório institucional. Nomes e códigos finais precisam de dicionários e anexos.
- Decisão: EN-017, validação aritmética e relatório de divergências sem alterar a fonte. Portão para especialização fechado.
- Próximo passo: baixar e verificar ZIPs e planilhas oficiais, processar filtros e notas para primeira reconciliação por código de curso.
