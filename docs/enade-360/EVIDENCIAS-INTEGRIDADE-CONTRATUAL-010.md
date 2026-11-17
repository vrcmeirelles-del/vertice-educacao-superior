# Evidência 010 — Correções da auditoria científica R2–R6

2026-11-17 • Escopo: validadores isolados, contratos, regressões e documentação.
Estado: **360 testes sintéticos locais aprovados; CI remoto a confirmar. Sem homologação científica.**

## Operação preparada e impacto

Alterações em `docs/enade-360/validator/`, no workflow específico de contratos e acréscimos cumulativos à Bíblia-Mestra e ao Diário. Nenhum arquivo de aplicação, função Supabase, migração, credencial, serviço ou indicador é alterado por esta proposta. Branch isolada e PR em rascunho, sem merge/deploy.

O gate integrado passa a rejeitar as nove entradas originalmente aceitas na auditoria A-CIENT-20261117-01. O novo schema 0.4 preserva os arquivos 0.2/0.3. A leitura estrutural de rascunhos legados permanece, mas também recebe as checagens semânticas de inconsistência. Aprovação no gate integrado exige contrato 0.4 e verificação externa ligada ao hash do relatório; não se migram relatórios ou dados existentes.

## Casos corrigidos e prova repetível

| Caso da auditoria | Controle aplicado | Evidência |
|---|---|---|
| D01 — `score=999` ignorado | Campo efetivo `value` e rejeição de propriedades desconhecidas em componentes | Fixture original rejeitada pelo gate; nova fixture 0.4 rejeitada no teste combinado |
| D02 — unidade `bananas` | Unidades explícitas `points`/`standardized_points`, coerentes com a medida | Fixture original rejeitada; zero, 100 e padronizada 5 têm casos positivos |
| D03 — n maior que população | Inteiros seguros, limite do universo e declaração de base distinta quando necessária | Fixture original rejeitada e caso adicional de inteiro inseguro |
| D04 — população sem fechamento | Respondentes + faltantes + excluídos + não aplicáveis = denominador; regra exigida para exclusões | Rejeição original; população com exclusões explícitas aceita |
| D05 — classe C9 | Enum interno e consistência com classe do cabeçalho | Fixture original rejeitada |
| D06 — C1 sem equivalência | Identidades do par, fontes resolvidas e verificador externo vinculado ao relatório | Ausência de recibo rejeitada; contexto sintético confirmado e par incompatível testados |
| D07 — intervenção aprovada em relatório pendente | Estado coerente, data válida, fontes identificadas e verificador externo de decisão | Rejeição original; campos `authenticated=true` no JSON não autorizam aprovação |
| D08 — cópias conflitantes de valor/fonte | Igualdade dos campos duplicados e ligação entre resultado, estado, fonte e trace | Rejeição original; trace divergente também rejeitado |
| D09 — IDD OFFICIAL sem prova | Origem explícita de arquivo oficial, fonte resolvida e confirmação externa do resultado exato | Rejeição original; verificador ausente/indisponível ou relatório alterado permanece bloqueado |

As nove fixtures originais foram copiadas sem reinterpretação para `validator/fixtures/audit-20261117/`. Não são questões, estudantes ou indicadores reais. `test-audit-integrity.cjs` inclui suas rejeições. `test-audit-schema.py` valida separadamente instâncias completas do contrato 0.4 com o schema e o gate na mesma entrada.

## Outros controles

- Fonte vazia sem completude e escopo explícitos retorna `PENDING`, não `SC`. Fonte confirmadamente completa, vazia e vinculada a curso/IES/área/edição pode retornar SC no helper. A fixture histórica `zero_valid_SC` foi substituída pela expectativa de pendência desse caso incompleto; o restante da suíte foi preservado.
- Mistura explícita de cursos, instituições, áreas ou edições é rejeitada antes da contagem. Linhas legadas sem identidade ainda exigem verificação do chamador; não foi criada equivalência cadastral automática.
- Estado AVAILABLE de indicador exige escala 0–5/faixa 1–5. IGC tem escopo institucional, com curso/área/grau nulos no novo contrato, e não exige código de curso artificial no trace.
- Aprovação de relatório legado não recebe aceite científico pelo gate integrado. Métodos ainda não auditados, tolerâncias gerais e reprodução de indicadores continuam pendentes.

## Verificadores externos: limite deliberado

`run(report, context)` admite `verifyDecision`, `verifyOfficialResult` e `verifyComparison` **somente no contexto fornecido pelo chamador**, fora do JSON do relatório. Sem essas funções, com erro ou retorno diferente de `true`, a validação correspondente falha. Cada solicitação inclui SHA-256 canônico do relatório para impedir reutilização do mesmo recibo após mudança de conteúdo.

Nenhum adaptador autenticado de banco ou documento oficial foi conectado nesta proposta. Os caminhos positivos dos testes usam verificadores sintéticos explicitamente identificados; não comprovam identidade, MFA, assinatura, fonte autenticada ou parecer humano real. O hash vincula conteúdo, não comprova autoria. O contrato não substitui sessão real, RLS ou trilha persistente de autorização.

## Testes executados

Registro: `evidencias/20261117-contract-integrity/local-tests.json`, com logs por suíte.

| Suíte | Casos locais aprovados |
|---|---:|
| Auditoria de integridade nova | 47 |
| Schema 0.4 + gate novo | 27 |
| Contratos básicos | 26 |
| Políticas de edição | 34 |
| Intercampos | 26 |
| R2–R6 anteriores | 23 |
| Estados | 29 |
| Rastreabilidade | 28 |
| Integração de traces | 6 |
| Governança sintética | 30 |
| Contrato de RLS simulado | 24 |
| Schema 0.3 + gate | 40 |
| Protótipo anterior | 20 |
| **Total** | **360** |

Node 24.22.1, Python 3.12.14, jsonschema[format] 4.23.0. Não se executou PostgreSQL real nem sessão de usuário nesta execução local; a suíte de RLS acima é o contrato simulado. As rotinas SQL e o leitor do espelho não foram modificados. O CI continua com seus jobs próprios, e seu resultado deve ser consultado separadamente após abrir a PR.

Os 141 casos do run histórico 43999596607 continuam preservados como evidência daquele checkout. O total atual é outro conjunto: inclui suites posteriores e 74 novos casos desta correção. Não somar ambos como amostras científicas independentes.

## Homologação e pendências preservadas

Reprodução independente de Conceito Enade, IDD, CPC ou IGC: **não executada**. Conciliação de planilhas nacionais: **não executada**. Aprovação científica humana: **não obtida**. P-ZIP-001, P-REF-001, P-NT-001 e P-TOL-001 permanecem no escopo ainda não comprovado.

A presente correção não habilita políticas de edição por analogia, não escolhe tolerância estatística e não declara validados os cálculos oficiais. Para homologar: fontes originais versionadas e verificadas, parâmetros completos por edição/indicador, implementação independente, relatório de conciliação com zero divergências sem explicação no universo declarado, adaptadores autenticados testados e parecer humano identificado.

## Reversão e autorização para etapas posteriores

Antes do merge, fechar a PR descarta a proposta sem alterar a main. Depois de eventual integração autorizada, reverter **o commit específico desta correção**, preservando histórico e evidências. Não há SQL a desfazer ou dados a restaurar nesta proposta. A reversão também remove os novos bloqueios do validador, portanto não deve ser tratada como homologação da versão anterior.

Merge, eventual publicação e qualquer alteração de produção continuam sujeitos à apresentação dessa operação concreta e autorização expressa do responsável. Esta proposta não altera configurações de deploy nem solicita publicação.
