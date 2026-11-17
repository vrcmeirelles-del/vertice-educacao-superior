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

## Entrada 005 — 2026-11-16 — Autorização para prosseguir e registro da dependência
- Solicitação do responsável: 'Prossiga para próxima depois te mando o zíp anote na Bíblia a pendências'. Interpretação operacional: desenvolver documentação independente, sem declarar testes de microdados concluídos.
- Consulta anterior aos três documentos realizada antes da mudança. Histórico 0.1 a 0.3 preservado.
- Criados `MATRIZ-COMPARABILIDADE-HISTORICA.md` e `PROTOCOLO-INGESTAO-E-ACEITE.md` com classes de comparabilidade, schema mínimo, doze testes especificados e critérios de aceite.
- **Pendência externa P-ZIP-001:** entrega posterior do(s) ZIP(s) oficial(is) pelo usuário; estado AGUARDANDO RECEBIMENTO, prazo não definido. Dependências: ingestão/validação do arquivo, recálculo de indicadores e conciliação contra tabelas INEP.
- Evidência desta execução: alterações apenas na branch documental da PR #169, sem leitura de registros individuais, sem testes reais e sem modificações de aplicação ou produção.
- Próxima ação independente: verificação adicional de notas técnicas e contratos de saída dos relatórios, preservando a matriz; retomar processamento quando o ZIP chegar. Núcleo ainda NÃO HOMOLOGADO.

## Entrada 006 — 2026-11-16 — Auditoria documental e contratos interpretativos
- Consultadas fontes públicas oficiais do INEP: NT nº 7/2022 (2021), NT nº 2/2023 (2022), NT nº 6/2024 (2023), NT nº 12/2024 (cálculo da nota individual de 2023), página de planilhas 2022, documentação geral dos indicadores.
- Resultado: localizado conjunto de quatro notas técnicas com finalidade distinguida; identificada mudança na composição da prova em 2023 e existência de revisão posterior de planilha de conceitos de 2022. Ressalva: consulta dirigida, NÃO auditoria integral de todos os cálculos e versões.
- Entregues especificações `NOTAS-TECNICAS-POR-EDICAO.md`, `CONTRATOS-RELATORIOS-ENADE360.md` e `CASOS-TESTE-MOTOR-GENERICO.md` (18 cenários). Nenhum cenário foi executado contra motor em produção nem usado para homologação.
- Pendências: P-ZIP-001 (fornecimento ZIP pelo usuário); P-NT-001 (análise completa/itens das NTs por edição, inclusive nota individual 2021/2022); P-REF-001 (planilhas oficiais versionadas por código de curso); validador automático ainda não implementado.
- Decisão: continuar documentando sem perder adendos anteriores, preservar código e produção, não especializar por curso; próximo marco é implementar um validador e executar testes sintéticos independentes do ZIP, identificando claramente que isso não reproduz indicadores oficiais.

## Entrada 007 — 2026-11-16 — Protótipo e testes sintéticos
- Consultadas Bíblia, Plano e Diário cumulativos antes da implementação.
- Código criado: `docs/enade-360/validator/validator.cjs` (validador contratual básico, comparabilidade, elegibilidade sintética, percentuais e conciliação), `docs/enade-360/validator/test-validator.cjs` (20 cenários).
- Execução efetiva: no runtime JavaScript isolado, M01–M18 e V01–V02 executados com resultado 20 PASS / 0 FAIL; registro em `EVIDENCIAS-TESTES-SINTETICOS-001.md`.
- Limitação: código não está integrado nem publicado; suite Node/CI do repositório não executada nesta sessão; resultado sintético não é conferência oficial por curso, nem homologação científica.
- Pendências: P-ZIP-001, P-NT-001, P-REF-001; abertas P-VAL-002 (executar versionados via Node/CI) e P-SCHEMA-001 (JSON Schema integral).
- Decisão: preservar a PR documental, não alterar sistemas em produção, manter portão de especialização fechado.

## Entrada 008 — 2026-11-16 — Contratos JSON Schema e execução sintética Node
- Consultados os três documentos de governança, preservadas entradas 001–007.
- Criados na branch documental arquivos `validator/report-schema-0.2.json`, `validator/schema-validator.cjs`, `validator/test-contracts.cjs` e `.github/workflows/enade360-contracts.yml`. Nenhuma integração de aplicação ou banco.
- Execução observada: Node.js v22.16.0 no ambiente local de desenvolvimento, 26 testes, 26 PASS, 0 FAIL. JSON Schema verificado com Python Draft202012Validator.check_schema em cópia local.
- Limites expressos: acesso HTTP direto à branch GitHub indisponível; código local não conferido byte a byte com o versionado. Nenhum GitHub Actions confirmado verde, nenhuma reprodução de indicador com microdados reais.
- Evidência principal: `EVIDENCIAS-CONTRATOS-002.md`; pendências P-VAL-002 (parcial), P-SCHEMA-001 (parcial), P-CI-001 (aberta), P-ZIP-001/P-NT-001/P-REF-001 (abertas). Homologação bloqueada.

## Entrada 009 — 2026-11-16 — Confirmação GitHub CI
- Consulta dos workflow runs do commit `3ee01fd808e10fc2a62dd3b749cad528cf4b3e66` e dos jobs do run `43996319804`.
- Resultado final: workflow `ENADE 360 - Contract Tests` `completed/success`; passo de execução sintética Node 22 `success`; passo de sintaxe JSON `success`.
- Escopo do resultado: arquivos efetivamente versionados executados no checkout GitHub e parse do JSON; NÃO prova validação das instâncias contra todos os requisitos do Schema, nem reprodução de nota ou conceito oficiais.
- Evolução das pendências: P-VAL-002 e P-CI-001 atendidas nesse commit; P-SCHEMA-001 parcial; P-ZIP-001/P-NT-001/P-REF-001 permanecem. Não houve alteração de produção; portão de homologação permanece fechado.

## Entrada 010 — 2026-11-16 — CI com validação real de instâncias Draft 2020-12
- Prévia: consultados documentos cumulativos e código versionado anterior; não reescrever histórico.
- Criados `validator/report-schema-0.3.json`, `validator/test-json-schema.py`, `EVIDENCIAS-SCHEMA-003.md`; workflow atualizado com Python 3.12/jsonschema 4.23.0 para validar instâncias válidas e inválidas, mantendo gate semântico Node.
- Cobertura desenhada: 7 positivas R1–R7 e 21 negativas. O número demonstra o conteúdo da suíte, não sua aprovação até a confirmação do CI.
- Registro do estado técnico: nenhum ZIP oficial recebido; nenhum indicador INEP recalculado; não houve alteração em aplicação/bancos/produção; aguardando resultado final do CI do novo workflow.
- Pendências: P-CI-002 (novo workflow), P-SCHEMA-001 (consistência e aprofundamento), P-ZIP-001, P-NT-001, P-REF-001. Homologação bloqueada.

## Entrada 011 — 2026-11-16 — Falha do novo gate e correção
## Evidência de falha e correção — 2026-11-16
- CI inicial do novo gate: GitHub run `43996758502`, conclusão `failure` no passo `Validate positive and negative Draft 2020-12 instances`; gate semântico Node passou (26/26). No Python, 26/28 passaram, 2 falhas: `bad_datetime` e `bad_method_url` foram erroneamente aceitos.
- Causa provável tecnicamente fundamentada: instalação `jsonschema==4.23.0` sem extras de verificadores de formato opcional; isso pode impedir validação de `date-time` e `uri` mesmo quando o `FormatChecker` está presente. Não remover os testes.
- Correção versionada no workflow: `python -m pip install "jsonschema[format]==4.23.0"`, commit `1f62c2163db65309e40957553abc7272d6b603a2`. Resultado final da repetição ainda sujeito a confirmação do CI.
- Esta falha faz parte do histórico auditável e não deve ser apagada. Não representa prova com microdados INEP.

## Entrada 012 — 2026-11-16 — Correção validada e integração interpretativa
- Consulta ao GitHub Actions confirmou run `43996910743` concluído com success, corrigindo as duas rejeições indevidas de formato identificadas no run anterior. Passos Node e Python tiveram conclusão success.
- Criado `validator/integrated-gate.cjs` e atualizada suíte `test-json-schema.py`; o mesmo relatório passa por validação Draft 2020-12 e consistência/pedagogia em Node. Adicionados 4 casos negativos, 32 ao todo.
- Limite: resultado CI das 32 fixtures ainda requer consulta; não confundir prova sintética, execução CI, uso de dados reais e homologação institucional.
- Pendências P-ZIP-001/P-NT-001/P-REF-001 abertas e núcleo genérico bloqueado para especialização.

## Entrada 013 — 2026-11-16 — Gate combinado homologado apenas quanto aos testes sintéticos
- GitHub run 43997052017 e job 133751571394: `completed/success`, após correção de formatos registrada na entrada 011.
- Logs: 26/26 testes semânticos Node 22, 32/32 instâncias Draft 2020-12 + Node (7 positivas aceitas, 25 negativas rejeitadas), nenhuma falha.
- Referência do commit efetivamente executado: a9cc729dcef66e34adbe9a0ad2d5011f60d94ecc. As atualizações documentais posteriores não estão implicitamente cobertas por esse CI.
- Limitações: fontes sintéticas; sem microdados; sem reprodução de conceito por curso/área; privacidade e metodologia do INEP não homologadas em uso real.
- Gate de especialização continua fechado. P-ZIP-001, P-NT-001, P-REF-001 permanecem.

## Entrada 014 — 2026-11-16 — SC, elegibilidade e tipologia de divergências
- Leitura dos três documentos preexistentes antes da implementação; histórico mantido sem substituição.
- Fonte consultada: NT nº 2/2023 (2022) e NT nº 6/2024 (2023) do INEP, para min. dois estudantes regulares válidos e seus filtros, além dos limiares do Conceito 2023.
- Novos arquivos: `validator/edition-controls.cjs`, `validator/test-edition-controls.cjs`; workflow CI com etapa dedicada, sem deploy.
- Execução confirmada GitHub Actions run 43997964988, job 133754617740, commit 2ab634f48ade5dbb22ec40e7e8eb295f319c3258, conclusion success. Logs: 34/34 novos, 26/26 semânticos e 32/32 JSON Schema+Node; total 92/92 sintéticos.
- Diferenciações demonstradas nas fixtures: SC vs zero; elegível vs conceito calculado; divergência numérica vs divergência de metodologia; hipótese pedagógica com revisão humana; limites de arredondamento apenas para exibição aprovada.
- Ressalvas: nenhum microdado ZIP recebido, nenhum Conceito Enade recalcado de ponta a ponta; ainda não há integração real com R1–R7 e códigos de cursos. P-CROSS-001/P-TOL-001 novas, P-ZIP-001/P-NT-001/P-REF-001 abertas.
- Decisão: manter portão de especialização bloqueado, preservar PR documental e serviços em produção.

## Entrada 015 — 2026-11-16 — Execução das pendências intercampos sem ZIP
- Leitura prévia de Bíblia-Mestra, Plano, Diário e código CI; preservação de todas as entradas anteriores.
- Novos arquivos: `validator/cross-report-controls.cjs`, `validator/test-cross-report.cjs`; integração em `validator/integrated-gate.cjs` e atualização do workflow de testes.
- GitHub Actions run 43999088145, job 133758363398, commit 7cad9ec20abc0405d30221d42bf585e233aa31de: completed/success. 26/26 básicos, 34/34 edição, 26/26 intercampos, 32/32 schema+interpretação; total 118/118 testes sintéticos, zero falhas.
- Resultado: bloqueios sintéticos de mistura de identidades, SC com valor, falso MATCH, política incompatível e referência substituída; diferença de arredondamento apenas para revisão, não homologação.
- Limites: não foi obtido ZIP nem planilhas oficiais por curso; políticas integrais de tolerância INEP não comprovadas; códigos testados são sintéticos. P-CROSS-001 parcial, P-TOL-001/P-NT-001/P-REF-001 abertas, P-ZIP-001 aguardando usuário.
- Decisão: continuar com estrutura transversal, sem alteração de produção, sem especialização por curso e sem homologar indicadores oficiais.

## Entrada 016 — 2026-11-16 — Contratos R2–R6 e matriz documental aprofundados
- Leitura prévia da Bíblia, Plano, Diário e código de validação; preservado histórico 001–015 e adendos anteriores.
- Fontes oficiais conferidas: notas do Conceito 2021–2023; páginas INEP do IDD, CPC, IGC e indicadores em geral; portaria 500/2024; nota IGC 2022 e portal de planilhas revisadas de 2022.
- Artefatos criados: `validator/r2-r6-controls.cjs`, `validator/test-r2-r6.cjs`, `MATRIZ-METODOLOGIAS-E-TOLERANCIAS.md`, `EVIDENCIAS-R2-R6-006.md`; `integrated-gate.cjs` e workflow CI atualizados.
- Resultado GitHub Actions: run 43999596607, job 133760060627, commit 265afdf8fed2a80d06eee3d12ae14dad7c106c57, success. Suítes: 26/26, 34/34, 26/26, 23/23, 32/32. Total 141/141 sintéticos, zero falhas.
- Conclusão limitada: estrutura/verificações simuladas passaram; matriz metodológica parcialmente concluída; **nenhum** indicador oficial reproduzido com microdados. Ainda não há dados de IES reais, nem validação de segurança/permissões em produção.
- Pendências mantidas: P-CROSS-001 parcial; P-TOL-001, P-NT-001, P-REF-001 abertas; P-ZIP-001 aguardando fornecimento pelo usuário. Portão científico e especialização bloqueados.

## Entrada 017 — 2026-11-17 — Taxonomia de estados e novos testes
- Consultados Bíblia, Plano, Diário e código previamente versionado antes da execução; nenhuma entrada anterior foi suprimida.
- Arquivos implementados: `validator/result-state-controls.cjs` e `validator/test-result-states.cjs`; adaptados `validator/integrated-gate.cjs`, `validator/test-json-schema.py` e workflow CI.
- Execução verificada GitHub Actions run 44016416528, commit 94c42399989dd181a37cf459b4ab48c9a8ca4f45: completed/success; logs registram 26/26, 34/34, 26/26, 23/23, 29/29 e 40/40, total **178/178 sintéticos**.
- Resultado verificável: rejeição de SC numérico, classificação de valor zero legítimo como AVAILABLE, falta de justificativa para NOT_APPLICABLE, origem ausente em MISSING, dependência não acompanhada em PENDING, publicação sem comprovação de consulta em NOT_PUBLISHED.
- Regra editorial: os seis estados são proposta de contrato da Vértice, não taxonomia universal oficial INEP; política de SC comprovada no protótipo apenas para Conceito Enade 2022–2023.
- Sem microdados reais, planilhas oficiais ou deploy. Pendências P-ZIP-001/P-NT-001/P-REF-001/P-TOL-001 abertas, P-CROSS-001 parcial; criada P-STATE-001. Homologação científica e especialização bloqueadas.

## Entrada 018 — 2026-11-17 — Contrato de rastreabilidade e prova sintética
- Consultados Bíblia, Plano, Diário e motor integrado na branch `docs/enade360-biblia-mestra-20261116`, preservadas entradas 001–017.
- Criados módulo `traceability-controls.cjs`, testes `test-traceability.cjs` e `test-trace-integration.cjs`, além do contrato `CONTRATO-RASTREABILIDADE-RESULTADOS.md`. Módulo registrado no gate de relatórios, sem deploy.
- GitHub Actions run 44044766932, job 133907618976, commit e55e2ac5c60276c63c2d2030e65d7eda03f233d4, completed/success. Logs: 26+34+26+23+29+28+6+40=212 testes sintéticos aprovados.
- Resultado: bloqueios de fonte/método sem metadados, inconsistência de curso/IES, aprovação sem revisor, fonte substituída e publicação antecipada. Contrato ainda opt-in, sem autenticação de documento/hashes, assinatura, persistência de eventos nem segregação real.
- Pendências P-TRACE-001 nova, P-CROSS-001 parcial, P-ZIP-001 aguardando usuário; P-NT-001/P-REF-001/P-TOL-001 abertas. Nenhum indicador oficial reproduzido, nenhum serviço em produção alterado. Gate científico e especialização fechados.

## Entrada 019 — 2026-11-17 — Marco de governança e leitura segregada
- Lidos Bíblia, Plano e Diário anteriores, além do contrato de rastreabilidade. Consultadas referências oficiais atuais de RLS e changelog Supabase.
- Projeto documentado em `ARQUITETURA-AUDITORIA-PERSISTENTE.md`: streams, eventos append-only, fontes, decisões, grants, contrato GET-only e matriz de permissões por perfil. Código isolado `audit-event-prototype.cjs` e 28 testes sintéticos adicionais, sem alterações no banco.
- Execução CI confirmada: GitHub Actions run 44046339541, commit f09ad17a49c1f1d1f2a94222928d56973d829bfb, completed/success; 240/240 testes sintéticos totais, zero falhas.
- Limites: hash chain em memória não equivale a imutabilidade persistente; nenhuma RLS real, sessão autenticada, migração, API implantada ou assinatura validada. Proposta de papéis sujeita ao cadastro real.
- Novas pendências P-ACCESS-001 e P-API-001, P-TRACE-001 aberta; P-CROSS-001 parcial, P-ZIP-001 aguardando o usuário, P-NT-001/P-REF-001/P-TOL-001 abertas. Nenhuma publicação antecipada e nenhum indicador INEP reproduzido.

## Entrada 020 — 2026-11-17 — Ciclo 01 de três ações
- Procedimento solicitado: executar em grupos de três ações, com revisão das evidências ao final.
- Ação 1: comparação das migrações versionadas `20261107200000_enade360_continuous_quality.sql`, `20261107203000_enade360_mirror_read.sql` e `202610300001_area_real.sql`. Identificado predicado institucional de RLS e ausência, nesses arquivos, de predicado comprovado por curso para Coordenação/NDE. Estado do banco vivo não consultado.
- Ação 2: criado `CICLO-01-TRES-ACOES.md`, com contrato de extensão aditiva/reversão, sem geração de migração SQL executável nem aplicação de DDL.
- Ação 3: protótipo `audit-event-prototype.cjs` passou a exigir MFA aal2; suíte `test-audit-governance.cjs` incluiu dois casos de ausência/insuficiência de MFA.
- CI verificado: run 44046955001, commit d339a13dca41fd834a3095b8edaab828ac3f18a0, completed/success; 242/242 testes sintéticos, zero falhas.
- Limites: autorização e log testados em memória, não RLS/SQL/autenticação em produção. Schema vivo, correspondência de perfis e segregação real continuam pendentes.
- P-SCHEMA-REAL-001 aberta, demais P-TRACE-001/P-ACCESS-001/P-API-001/P-CROSS-001/P-ZIP-001/P-NT-001/P-REF-001/P-TOL-001 preservadas. Sem publicação, homologação ou especialização.

## Entrada 021 — 2026-11-17 — Ciclo 02 concluído nos limites de leitura/simulação
- Ação 1: queries SELECT em catálogos PostgreSQL do Supabase `vertice-educacao-superior`, sem registros de usuários e sem writes. Confirmado RLS ligado em tabelas ENADE, cursos, memberships, config, impacto roles e learning staff scope; RLS ENADE vista não tem predicado específico por curso.
- Ação 2: confrontadas estruturas reais de papéis e chaves; papéis de negócio não coincidem automaticamente com membership básico; existem vínculos adicionais por curso. Documento `CICLO-02-TRES-ACOES.md` e evidências `EVIDENCIAS-CICLO-02.md`.
- Ação 3: `rls-policy-contract.cjs` e 24 testes novos no CI. GitHub run 44047694892, commit ad82b1c7d743a5934a93c340ab45ae403878a02d, success; 266/266 testes sintéticos em todas as suítes.
- Ressalva: não executado RLS em PostgreSQL descartável; nenhum schema, policy, função ou dado de produção modificado. P-RLS-SQL-001 e P-ACCESS-001 permanecem abertos. P-SCHEMA-REAL-001 parcial; P-TRACE-001/P-API-001/P-CROSS-001 e P-ZIP-001/P-NT-001/P-REF-001/P-TOL-001 preservados.
- Gate científico, especialização e publicação antecipada bloqueados.

## Entrada 022 — 2026-11-17 — Ciclo 03, consulta real e ensaio SQL descartável
- Em leitura ao banco Supabase Vértice: `vertice_eorbit_enade` 289 linhas (241 curso_id bigint, 48 sem), 62 pares IES/curso distintos, `vertice_enade_course_config` 0, `vertice_courses` 196, `vertice_enade360_records` 10. Não foram acessados dados pessoais de estudantes e não foi feita conciliação automática.
- Preparado arquivo `validator/test-rls-postgres-disposable.sql`, com RLS sintética de inst/curso/perfil/MFA e teste de rollback; adicionado serviço PostgreSQL 17 descartável ao CI. Nenhum SQL aplicado ao Supabase.
- GitHub Actions run 44048407509, commit 7a3672384565bd078b30e137e06248d7a5582b96: completed/success em dois jobs. 266/266 testes sintéticos, além do ensaio SQL `PASS: disposable PostgreSQL RLS cases and transaction rollback`.
- Alcance: RLS testada no PostgreSQL temporário com policy do projeto de testes, não as policies reais da Vértice. Persistem P-RLS-REAL-001 e P-MAP-001. P-RLS-SQL-001 atendida em escopo sintético, e as demais pendências anteriores continuam abertas.
- Nenhum deploy, migração ou edição do banco de produção; núcleo científico não homologado, especialização bloqueada. Registro cumulativo preservado.

## Entrada 023 — 2026-11-17 — Encerramento deliberado de prototipação
- Por solicitação do responsável, encerrada a sequência de novos ciclos. Entregue o termo final, com uma única distinção de status: protótipo técnico/contratos/CI concluídos versus homologação científica e integração de produção bloqueadas por evidências materiais.
- Confirmada em leitura consulta de 62 pares distintos IES/curso e-ORBIT, configuração de equivalências vazia e nenhum candidato direto pelo critério código exato ou nome normalizado; sem atribuição automática.
- Mantida evidência run 44048407509 com 266/266 testes sintéticos e RLS/rollback PostgreSQL descartável aprovados; isso não é RLS das sessões reais da Vértice.
- Nenhum dado de produção alterado; nenhum índice INEP calculado com microdados; documentos cumulativos preservados. Retomada somente mediante ZIP/planilhas oficiais, equivalências validadas ou ambiente clonado de testes.

## Entrada 024 — 2026-11-17 — Auditoria implantada, barreira científica explícita
- Migração real `20261117084920_enade360_private_audit_history_and_read_gate` aplicada ao Supabase `vertice-educacao-superior`; schema privado, evento baseline em dez registros, captura automática e RPC autenticada para histórico. Verificações SQL: 10 registros auditados, RLS habilitada, privilégios diretos de leitura para anon/authenticated negados, RPC EXECUTE negado a anon; zero divergências de curso/IES na linha base. Segurança com sessões reais de perfil ainda não homologada.
- PR #171 criada para consultar a trilha no componente ENADE 360; andamento condicionado a CI e merge, não declarar deploy antes da confirmação.
- INEP: microdados 2023 identificados em portal oficial, tentativa de transferência falhou; Library e Drive sem microdados ZIP localizados. Zero `resultado_oficial` e zero registros validados na tabela ENADE 360. Motor científico não reproduzido; proibido dizer concluído.
- Documentação cumulativa preservada; fase de integração operacional avançou efetivamente; homologação científica permanece bloqueada por fonte.

## Entrada 025 — 2026-11-17 — Integração operacional publicada no Render
- Banco: migração `20261117084920_enade360_private_audit_history_and_read_gate` aplicada e verificações de RLS/privileges/baseline concluídas (10/10 registros auditados).
- GitHub: PR #171 integrada, commit `f0f7e6c75e2dc1662ef5c340838aca483022b5f4`; TypeScript Node 22/24 e validação ENADE no CI concluídos com êxito após correções de navegação e tipos.
- Render: serviço ativo `vertice-portal`, deploy `dep-dbu1er5g1s2s73eoudv0` status live. Não declarar teste de navegação autenticada por todos os perfis (ainda não executado).
- Ciência: ZIP oficial 2023 não baixado neste ambiente; fontes 2021–2023 localizadas no Inep; base não contém resultados oficiais validados. Homologação científica não ocorreu; bloqueio mantido.

## Entrada 026 — 2026-11-17 — Execução Work e provas materiais
- Estado inicial confirmado: PR #171 merged, main f0f7e6c; Render vertice-portal dep-dbu1er5g1s2s73eoudv0 live. PR #169 em draft continha os documentos e validadores fora da main. Histórico recuperado sem exclusão.
- Banco somente leitura: 289/241/48 linhas do espelho, 62 pares, 196 cursos, 0 equivalências, 10 registros/eventos demonstrativos, 0 resultados oficiais/validados. Hashes BASELINE e linhas atuais 10/10 consistentes; privilégios diretos privados e EXECUTE anon negados. Consulta role authenticated sem auth.uid: zero registros e zero eventos.
- Login real: portal recusou e-mail/senha; MFA e perfis reais não testados. Não alterar senha nem fabricar sessões. Logs Render confirmaram build anterior live; logs Supabase consultados por fontes, sem atribuir ausência global de erros.
- Fontes: catálogos oficiais de microdados/indicadores 2021–2023 recebidos, SHA-256 nos recibos. 18 downloads retornaram HTTP 503; tentativa de navegador 2023 encerrou por timeout. Nenhum pacote, planilha ou PDF desses recebido; nenhum hash de binário ausente inventado.
- Detectadas/corrigidas localmente: consulta do espelho pelo UUID incorreto; hash de INSERT/UPDATE usando timestamp não preservado; possibilidade de validar oficial sem homologação; CI usando overlays históricos diferentes do Render. Migração real inicial recuperada do histórico Supabase para o Git. Nova migração aditiva testada sem ampliar privilégios.
- Conciliação institucional utiliza tabela existente para a UNITOP; 49 candidatos por texto não aprovados, 43 colisões entre códigos de namespaces diferentes e 90 cursos da IES sem grau. Nenhuma equivalência/cadastro alterado.
- Testes locais: 24 asserts SQL com funções/migrações reais em PGlite (Auth sintético, digest com SHA-256 nativo), 6 testes do leitor, TypeScript e build passaram. CI remoto/aplicação da nova migração/merge/deploy ainda devem ser confirmados, não presumidos.
- Decisão: proteger publicação e persistir achados. Zero indicadores reproduzidos, zero conciliações científicas, nenhuma homologação nem especialização autorizada.

## Entrada 027 — 2026-11-17 — CI e detalhe de rastreabilidade
- GitHub Actions 44054965128, commit 8e9166e1b166d0396ecdc27b5591b37e3d52eb9a: contract-tests e disposable-postgres-rls completed/success. Produção SQL de auditoria ensaiada em PostgreSQL 17/pgcrypto, com identidades sintéticas.
- Antes de aplicar ao banco, incluída correção para serialização de linha sempre em UTC na função de captura, sem alterar timezone global; novo ensaio local 25/25 asserts passou. Nova revisão requer CI próprio.
- Inventário pendente de 62 pares salvo. Snapshot e-MEC UNITOP revisão 3 não é evidência de cursos: partial, um registro institucional com texto de modelo. Não há fundamento para vincular cursos por ele.

## Entrada 028 — 2026-11-17 — Migração aplicada e teste real revertido
- Supabase confirmou migração enade360_verifiable_audit_and_scientific_hold, versão 20261117092634. Nome do arquivo Git alinhado ao registro remoto para evitar duplicação futura. Nunca reaplicar a migração inicial de 20261117084920.
- Teste no banco real em transação: UPDATE sem mudança de conteúdo gerou evento v2 temporário; event_hash_match, row_hash_match e chain_match=true, inclusive após escritor em America/Sao_Paulo. Rollback confirmado: dez registros, dez BASELINE, zero eventos novos persistidos/oficiais.
- Disponibilidade de perfis: impacto roles ativos=0, learning staff scope=0, fatores MFA verificados=2. Não são sessões autenticadas dos cinco perfis. Nenhum grant ampliado.
- Recuperados dois PDFs do Drive intitulados Curso/IES; bytes e SHA-256 idênticos. Ambos contêm relatório de curso Direito/Faculdade de Olímpia/2022, código impresso 5000876, 25 concluintes. Origem imediata Drive, sem confronto do binário no INEP. Não importar nem vincular à UNITOP, não declarar reprodução científica.

## Entrada 029 — 2026-11-17 — Publicação comprovada e encerramento da execução
- CI revisão d504c454: sete workflows success; contratos/PostgreSQL run 44056013177 e portal TypeScript Node 22/24 run 44056012516. 25 asserts SQL e seis testes do espelho aprovados além dos 266 contratuais preservados.
- Merge PR #169: ff0963dcfd2fd356a82ff29ae3a5c74cc479076c. Portal live dep-dbu1um0ae00c73a5fd4g (09:33:52 UTC); institucional live dep-dbu1um0ae00c73a5fd10 (09:33:54 UTC). Marcadores novos confirmados nos JS servidos nos dois domínios; SHA-256 registrado.
- Banco real: rejeição do aceite oficial testada e revertida; teste de captura/cadeia também revertido. Estado final preservado: dez registros/dez BASELINE; zero oficiais/validados/equivalências; hashes de linhas sem divergência. RLS privada e negação anon mantidas.
- Relatório executivo único emitido com estados A–H e limites. Indicadores oficiais reproduzidos=0; conciliações INEP=0; sessões reais não homologadas. Nenhuma aprovação humana científica inventada. Especialização e publicação de resultados permanecem bloqueadas.


## Entrada 030 — Sessão real Master e recuperação adicional — 17/11/2026

A sessão autenticada Master no Chrome conectado foi utilizada efetivamente. Na instituição FV-DEMO, curso Direito, criou-se uma evidência explicitamente operacional, sem resultado acadêmico, e rejeitou-se o registro pelo portal. A RPC exibiu os eventos INSERT e UPDATE; os dois hashes canônicos v2 foram recalculados no Supabase e coincidem. Registro: `52df267f-1067-4f8d-bf06-8d4db969b7cd`. Os dez baselines anteriores permanecem preservados; após o teste existem 11 registros e 12 eventos. Não houve concessão de privilégios nem publicação de indicador.

A afirmação anterior de ausência de sessão real fica superada para Master. Reitoria, Coordenação, NDE e CPA continuam sem teste de sessão real; não houve novo desafio MFA. O Master é global: sua leitura de UNITOP e FV-DEMO não comprova isolamento dos perfis restritos.

Foi confirmado um defeito de atualização: o histórico aberto não refletia imediatamente a rejeição. A correção invalida o painel após escrita; teste de regressão UI aprovado (1/1) e TypeScript aprovado. Sua integração/publicação deve ser comprovada pela PR e deploy, sem presumir sucesso antecipado.

Foi acrescentada execução no GitHub Actions para receber diretamente os 18 binários oficiais anteriormente indisponíveis, registrar SHA-256 e verificar estrutura/CRC. Neste registro a execução ainda não está concluída; não contar arquivos, reproduções ou conciliações sem recibo real. A homologação científica continua bloqueada.

Evidência: [sessão Master](evidencias/20261117-work/master-real-session.json). O comprovante anterior de testes transacionais permanece intacto, como histórico.


## Entrada 031 — Encerramento da execução conectada — 17/11/2026

PR [#173](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/173) integrada pelo commit `f116cddc83766be5a79f5c16ccc2ae8f39b5fcde`. Seis workflows técnicos concluíram com sucesso, incluindo TypeScript Node 22/24, regressão UI do histórico e builds. Deploys live: portal `dep-dbu2k6lbedkc73eutlfg` (07:19:44, Brasília) e institucional `dep-dbu2k6lbedkc73eutlk0` (07:19:47). `version.json` e chunks efetivamente servidos confirmam o commit, a invalidação do histórico após escrita e a mensagem de homologação pendente.

Teste HTTP real adicional, sem token de usuário: leitura retornou HTTP 200/lista vazia e RPC de auditoria retornou HTTP 401/permission denied. Nos logs reais da sessão Master: criação 201, rejeição 204 e RPC 200. Esses resultados não comprovam os perfis Reitoria/Coordenação/NDE/CPA nem um novo desafio MFA.

A execução de aquisição no GitHub [44063161236](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44063161236) terminou: 18 alvos, zero recebidos. HTTPS apresentou falha TLS; o diagnóstico direto não recebeu certificado do par e registrou reset de conexão. A tentativa alternativa HTTP no mesmo host oficial terminou em timeout para os 18 alvos. A verificação TLS não foi desativada. Sucesso da execução do workflow significa geração dos recibos, NÃO recuperação ou validação dos dados.

Os catálogos oficiais de IDD/CPC/IGC e de notas 2021–2023 foram recebidos e preservados com SHA-256. Quinze notas técnicas e os três pacotes públicos de microdados IDD foram tentados diretamente e retornaram HTTP 503. O catálogo oficial confirma que a NT 29/2023 substitui a NT 3/2023 do IDD 2022 e referencia a NT 5/2024 para a transição do IGC 2022. Foram localizadas referências, não lidos integralmente os PDFs indisponíveis. Não se deve afirmar que o IDD é genericamente impossível por ausência de ligação pública: existe pacote IDD oficial; seus bytes ainda não foram recebidos nesta execução.

Contagem reconfirmada: espelho 289/241/48, 62 pares IES/curso, cadastro 196, equivalências 0. Nenhum vínculo por nome ou código de namespace incompatível foi gravado. Núcleo científico: zero indicadores reproduzidos, zero conciliações com planilhas oficiais, zero aprovações científicas humanas. Homologação e publicação acadêmica continuam bloqueadas; a integração técnica não autoriza especialização por bacharelado.

Evidências adicionais: [sessão Master](evidencias/20261117-work/master-real-session.json), [negação HTTP real](evidencias/20261117-work/anonymous-http-access.json), [artefatos publicados](evidencias/20261117-work/published-audit-refresh.json), [recibos GitHub](evidencias/20261117-work/github-official-receipts.json), [catálogos metodológicos](evidencias/20261117-work/methodology-catalog-receipts.json). Permanecem intactas as entradas anteriores, inclusive tentativas de login e testes transacionais anteriores.


## Camada de evidências: classificação, extração e vínculos — 17/11/2026

O recorte correto é o repositório de ensino superior: 776 arquivos no conjunto, 771 da UNITOP com objetos presentes no Storage; 515 classificações existentes no conjunto, 511 na UNITOP. Os 11 registros de vertice_documents são da Escola Vértice — Demonstração, sem objetos originais; não representam a ausência de documentos do ensino superior e não foram artificialmente preenchidos.

Foi aplicada a migração 20261117113047_enade360_evidence_text_index: texto e páginas extraídas, SHA-256, método, cobertura parcial e sugestões de palavras-chave na pré-validação existente; busca compartilhada por arquivo/curso/indicador/solicitação/meta. RPC usa security invoker, MFA e perfil de gestão já autorizado, além das RLS existentes. As 14 políticas consultadas, 776 arquivos e 515 classificações permanecem preservados. Contexto sem identidade: autorização false e zero resultados.

O código substitui leitura binária de PDF/ZIP por parsers PDF/DOCX/XLSX/PPTX, com limites e rejeição de imagens sem OCR; preserva páginas/células/partes XML e não envia conteúdo à IA na ação index. Citações sugeridas precisam existir no texto da página indicada; os vínculos permanecem sugeridos até revisão humana. O catálogo institucional estava vazio: não se utilizam códigos e versões regulatórias inventados. A busca foi preparada para ENADE, Sapiens e planejamentos, com origens institucionais separadas dos vínculos do curso.

Validação local: 8 testes de motor/banco e 2 de UI, TypeScript aprovado. Um PDF existente foi realmente extraído: 46 páginas físicas, 69.619 caracteres, SHA-256 8ac0753e25be12d34349ee6d26a9b97e53bdcdd387963b538cfd619c04812c9a. É cópia do Drive do relatório de Direito/Faculdade de Olímpia/2022; não é original autenticado INEP nem UNITOP. Esse teste não é reprodução de indicador. Páginas sem texto exigem conferência e a cobertura parcial é explicitada.

Publicação da função e interface: pendente neste registro. Nenhum dos arquivos privados foi declarado processado em lote. O navegador em nuvem abriu o login do Supabase, sem sessão; o conector retornou erro interno ao recuperar a fonte implantada da função. Não foram emitidas credenciais, ampliadas permissões ou publicadas notas oficiais para contornar a dependência. Evidência: evidencias/20261117-work/evidence-layer-status.json.


## Publicação comprovada da camada documental — 17/11/2026

A PR [#175](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/175) foi integrada no commit `c266140afcb9c81d612a5c7917d476329e3aff6a`, após nove workflows aprovados no head `27d60d8a99c0a3183b64c58ad5fbde9050e51744`. A função existente vertice-doc-prevalidate foi publicada na versão 3, com verify_jwt=true; os três arquivos recuperados da implantação conferem byte a byte com a fonte preparada. O erro de recuperação da versão anterior não impediu a verificação da versão nova.

Render: institucional `dep-dbu6n0ijnfac73e5ceig` e portal `dep-dbu6n0ijnfac73e5cem0`, ambos live em 17/11 às 11:58:52 (Brasília). A busca compartilhada e as ações de indexação estão integradas à interface. As requisições HTTP reais sem sessão para indexação e busca foram negadas com 401. A migração mantém as políticas e os dados existentes.

Contagem final: 776 arquivos/515 classificações existentes preservados; zero fontes privadas indexadas nesta execução e zero vínculos IA criados. Na UNITOP, 768 dos 771 arquivos já possuem vínculo de curso, três são institucionais e nenhum possui vínculo de meta. A busca recupera relações existentes e não cria associações a metas por suposição.

A autenticação segura no navegador expirou sem confirmação; em uma aba nova, /master exibiu “Entre para acessar sua conta”. Portanto a etapa de processamento do acervo privado permanece pendente de sessão real com MFA. O catálogo institucional de instrumentos continua sem registros configurados: a classificação por códigos e versões requer fonte/catalogação verificável, enquanto os indicadores já cadastrados nos arquivos permanecem preservados. O lote não foi dado como processado, e esta publicação técnica não homologa indicadores oficiais.

Evidências: [estado final](evidencias/20261117-work/evidence-layer-status.json), [função publicada](evidencias/20261117-work/evidence-function-deployment.json), [negação HTTP](evidencias/20261117-work/evidence-anonymous-http.json), [arquivos servidos](evidencias/20261117-work/evidence-published-assets.json).

A inspeção dos JavaScripts efetivamente servidos localizou a RPC vertice_evidence_search e o controle de extração dos resultados no chunk compartilhado PlanningManagement, em ambos os domínios. As verificações em chunks individuais que não contêm o módulo foram mantidas no recibo; o scan de dependências identifica os arquivos corretos e seus SHA-256. Isso comprova presença do código publicado, sem substituir teste autenticado do processamento privado.


## Catálogo de referência aplicado e origem preservada — 17/11/2026

Aplicada no Supabase a migração `20261117153003_enade360_official_reference_catalog`. A UNITOP passou de zero para um catálogo ativo, IACG de reconhecimento/renovação de reconhecimento, edição outubro/2017, com 58 objetos. Foram conferidos todos os títulos, 35 textos de aplicabilidade e respectivas páginas físicas em uma cópia da publicação INEP redistribuída no repositório oficial da UFAL: 908.787 bytes, 54 páginas, SHA-256 `bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768`. O catálogo registra as URLs canônica e de obtenção, data, hash e limitações. A igualdade binária com o servidor INEP não foi comprovada; a rota direta respondeu 503. O original recebido foi preservado no [pacote de fonte](https://chatgpt.com/library?file_id=libfile_5860a77abee08191a7e61ec06bcc1cf5&account_id=personal).

O catálogo permite sugerir códigos de uma referência rastreável; não contém critérios para calcular conceitos, não aprova vínculos e não aplica automaticamente indicadores a cursos. Dois títulos existentes abreviados (2.15 e 3.15) foram completados somente no novo catálogo, sem reescrever classificações históricas. Não foi ativado instrumento proposto de 2026 como norma vigente.

Verificação posterior no banco: um catálogo, 58 objetos e correspondência exata com o arquivo de referência; 776 arquivos, 515 classificações, 771 arquivos UNITOP, zero pré-validações e zero vínculos IA. Políticas de acesso dos catálogos idênticas antes/depois. Nove testes locais de extração/banco aprovados, incluindo execução e repetição idempotente da migração em PostgreSQL isolado; a autenticação desses testes é sintética e não substitui sessão real. As 58 verificações do PDF usaram bytes reais e não constituem reprodução científica de indicador.

A nova conferência do navegador em nuvem abriu /master e recebeu “Entre para acessar sua conta”. O controle da sessão anterior pela extensão não está disponível nesta execução. Nenhuma credencial foi fabricada nem proteção removida: o lote privado permanece em zero processados. A reprodução e conciliação científica de Conceito Enade, IDD, CPC e IGC seguem sem comprovação; publicação de resultados oficiais bloqueada.

Evidências: [catálogo](fontes/iacg2017-reconhecimento-catalog.json), [verificação do PDF](evidencias/20261117-work/reference-catalog-extraction.json), [conferência do banco](evidencias/20261117-work/reference-catalog-database.json). Integração GitHub/CI deste bloco: a confirmar após publicação da branch.
