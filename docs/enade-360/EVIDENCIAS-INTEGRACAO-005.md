# Evidência 005 — Integridade intercampos R1–R7 e conciliação R7
Registro: 2026-11-16 (timezone America/Araguaina). GitHub logs: 2026-11-17 UTC.

## Implementação isolada
- `validator/cross-report-controls.cjs` controla identidade por instituição, código de curso, área, grau e edição; exige referência versionada nas linhas de conciliação R7; bloqueia SC com valor numérico, falso MATCH, arredondamento de exibição não autorizado, metodologia não reconhecida, resultado CPC sem política de indicador verificada, e aprovação de referência substituída.
- `validator/integrated-gate.cjs` agora chama `validateCrossReport` após validações básicas e pedagógicas sobre a mesma instância.
- `validator/test-cross-report.cjs` acrescenta 26 fixtures sintéticas; CI executa a nova suíte com as anteriores.
- Política de tolerância: NÃO inferida para cálculo do Conceito Enade. Exatidão é MATCH; mesma representação arredondada pode gerar ROUNDING_REVIEW se regra de EXIBIÇÃO for explicitamente justificada/aprovada; não vira MATCH nem homologação.
- Restrição: a conciliação R7 de Conceito Enade aceita apenas a metodologia de 2022/2023 registrada no protótipo, sem cálculo real de indicadores. Não presume regras para outros anos ou indicadores.

## Evidência real GitHub Actions
Run `43999088145`, job `133758363398`, commit `7cad9ec20abc0405d30221d42bf585e233aa31de`. Job `completed/success`; todos os passos de teste concluíram `success`.
Logs:
- 26/26 testes semânticos;
- 34/34 testes de elegibilidade e metodologia;
- 26/26 novos testes intercampos;
- 32/32 testes combinados JSON Schema + Node.
**Total: 118 testes sintéticos aprovados; zero falhas.**
Fonte: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/43999088145 .

## Limitações
- O código aceita fixtures sintéticas que transportam IDs; não representa prova de correspondência com e-MEC, CINE ou códigos reais, nem isolamento institucional no banco.
- O controle de versão referencia labels informados pelas fixtures, não efetua download nem hash de planilhas oficiais.
- A classe de divergência distingue diferença aritmética, fonte/metodologia incompatível e hipótese pedagógica; não identifica causalidade de baixo desempenho.
- A verificação de comparabilidade histórica por notas técnicas e a reconciliação de todas as edições permanecem pendentes.
- CI verde não comprova implantação na Vértice, cálculo oficial ou segurança institucional completa.

## Pendências
P-CROSS-001: **parcial** — gate e testes sintéticos R1/R7 concluídos; integração completa de payloads R2–R6, dicionários oficiais e dados reais pendente.
P-TOL-001: **aberta** — consultar metodologia de cada edição e documentação do arredondamento oficial antes de admitir tolerância de cálculo.
P-ZIP-001: **aguardando envio pelo usuário**.
P-NT-001: auditoria das notas técnicas ainda pendente.
P-REF-001: versões e hashes das planilhas oficiais de referência por curso pendentes.
Núcleo genérico: NÃO HOMOLOGADO. Especialização por curso: BLOQUEADA.
