# Evidência 007 — Estados de resultado, exceções e ausência de evidência
Data: 2026-11-17 | Tipo: testes sintéticos com CI; nenhum indicador oficial reconstruído

## Problema tratado
Um resultado acadêmico ausente não pode ser representado como zero, Sem Conceito (SC), não aplicável ou resultado futuro. Cada estado possui significado distinto e exige documentação.

## Vocabulário operacional proposto para a Vértice (não é taxonomia do INEP)
| Estado | Definição | Metadados exigidos | Uso numérico |
|---|---|---|---|
| AVAILABLE | Valor efetivamente informado ou verificável | valor numérico e versão da fonte | permitido, inclusive zero real |
| SC | Ausência de conceito segundo elegibilidade aplicável | razão, quantidade válida, método verificado da edição | proibido |
| NOT_APPLICABLE | Indicador comprovadamente fora do escopo | motivo e norma/regra de aplicabilidade | proibido |
| MISSING | Dado esperado, porém ausente na base | razão e fonte esperada | proibido |
| PENDING | Dependência operacional ainda aberta | dependência e próxima verificação | proibido |
| NOT_PUBLISHED | Fonte oficial consultada não apresenta publicação | endereço da fonte e data de consulta | proibido |

## Implementação
- `validator/result-state-controls.cjs`: valida os estados, bloqueia valores indevidos e integra especificamente com indicadores R4 e ações R6.
- `validator/test-result-states.cjs`: 29 cenários sintéticos (inclusive SC não convertido em zero, disponível com valor zero, NA sem justificativa, ausência sem origem e intervenção aprovada sobre dado ausente).
- `validator/integrated-gate.cjs`: invoca nova validação além dos módulos R1–R7.
- `validator/test-json-schema.py`: oito cenários adicionais de integração (um positivo SC documentado e sete negativos), pelo mesmo fluxo Draft 2020-12 + Node.
- CI `.github/workflows/enade360-contracts.yml`: adicionada nova suíte sem alterar produção.

## Evidência GitHub Actions
Workflow `ENADE 360 - Contract Tests`, run **44016416528**, commit **94c42399989dd181a37cf459b4ab48c9a8ca4f45**, final **completed/success**. Logs:
- 26/26 contratos semânticos;
- 34/34 políticas por edição;
- 26/26 controles de cruzamento;
- 23/23 controles R2–R6;
- 29/29 estados de resultados;
- 40/40 testes integrados JSON Schema Draft 2020-12 + Node (8 positivos e 32 negativos).
**Total: 178/178 cenários sintéticos aprovados, zero falhas.**
Fonte de execução: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44016416528 .

## Limitações
- A validação de SC está parametrizada somente para conceito Enade de 2022 e 2023 nos limites das políticas já cadastradas; demais indicadores e edições bloqueiam a conclusão sem metodologia verificada.
- As regras de estados são CONTRATOS DE DADOS PROPOSTOS PELA VÉRTICE, não definições oficiais universais do INEP.
- A flag de proteção de dados é um teste de lógica, não prova de segurança/anonimização em produção.
- A coerência entre todos os estados e todas as variantes profundas de R1–R7 ainda não foi exaustivamente demonstrada.
- Os testes não incluem bases de concluintes reais, planilhas oficiais, cálculo de nota de curso nem integração aos serviços.
- As metodologias e as tolerâncias do INEP ainda exigem auditoria documental integral, e a versão de cada fonte ainda não foi fixada com checksum.
- Nenhum sistema em produção foi alterado.

## Pendências continuadas
P-ZIP-001: ZIPs de microdados aguardando fornecimento pelo usuário.
P-NT-001: notas técnicas completas por indicador e edição.
P-REF-001: resultados oficiais, versões e hashes.
P-TOL-001: tolerâncias e arredondamentos documentalmente auditados.
P-CROSS-001: integração real entre os contratos, banco e IES; parcialmente concluída apenas em código isolado.
P-STATE-001: aprofundar estados por indicador, edições e aplicabilidade mediante fonte INEP, e preparar migração/contratos de serviço sem ativação de produção.

**Gate científico e especialização por bacharelado: BLOQUEADOS.**
