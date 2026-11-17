# Sapiens: privacidade das devolutivas — 17/11/2026

A função publicada e a RPC marcavam resultados como insuficientes, mas preservavam médias de grupos pequenos e deltas. A correção aplica a supressão no handler e, independentemente dele, na RPC que grava a medição.

- Baseline e amostra atual têm médias ocultadas individualmente quando menores que cinco.
- Deltas são ocultados se a fonte declara insuficiência, o grupo/pareamento fica abaixo de cinco, não há tentativas novas ou há reinício de contador.
- Contagens, escopo, identidade da medição e auditoria são preservados. Aprovação Master/AAL2, envio após aprovação, recibo e idempotência não mudam.
- A RPC continua SECURITY INVOKER, com EXECUTE somente para postgres/service_role. Nenhum novo grant, tabela, serviço ou credencial.

## Validação executada

10 testes locais aprovados: sete regressões do ciclo existente e três cenários novos de privacidade. Incluem PostgreSQL/PGlite nos dois lados, HTTP real local, gravação direta na RPC sem o filtro Edge, amostras 4/5, delta insuficiente com grupos grandes, nenhuma tentativa nova, contadores reiniciados e retirada de consentimento 5→4. Autenticação Supabase é simulada; não se alega homologação de login ou intervenção real hospedada. TypeScript 5.9.3 do handler aprovado.

Reprodução (checkout F&O com fontes reais):

```sh
npm ci --prefix scripts/tests/sapiens-runtime --no-audit --no-fund
FATO_ORDEM_REPO=/caminho/fato-e-ordem node --test scripts/tests/sapiens-runtime/feedback-privacy.test.mjs
```

## Publicação e verificação

- Migração aplicada no projeto existente qvetbbmviatxxatzzuzc: 20261117111205_sapiens_feedback_privacy.
- Guard de concorrência confere o MD5 do corpo revisado antes de substituir a RPC. Corpo anterior cdf2bff2a761825e5522f0c509c3f78e; corpo aplicado 46c007464937bd86c665a0a0dbd8ee8a.
- Edge existente vertice-sapiens-bridge v2 ACTIVE, verify_jwt=true. index.ts e handler.ts implantados foram relidos e são idênticos à fonte local validada.
- POST sem autenticação recusado com HTTP 401.
- ACL, SECURITY INVOKER e search_path vazio da RPC conferidos após publicação.
- Zero intervenções e zero medições na Vértice antes/depois. Não foram criados participantes, aprovadas intervenções ou enviados contatos neste trabalho.
- A PR ENAMED #168 continua independente, sem integração por esta correção. Esta entrega extrai somente a proteção da ponte e acrescenta defesa no banco.

O funcionamento completo com Master real, aprovação e recebimento por estudantes continua dependendo de evidência operacional real. Os testes acima não substituem essa homologação.
