# Evidências — contrato JSON Schema e testes Node (2026-11-16)

## Entregas da etapa 0.7
- `validator/report-schema-0.2.json`: contrato JSON Schema Draft 2020-12, 23 campos base obrigatórios, seleção de estrutura R1–R7; tipagem das fontes e afirmações.
- `validator/schema-validator.cjs`: validador prototípico da estrutura e de regras semânticas de segurança científica (não calcula indicadores do INEP).
- `validator/test-contracts.cjs`: 26 cenários sintéticos versionados para Node 22; sete fixtures válidas e 19 casos de rejeição/integridade.
- `.github/workflows/enade360-contracts.yml`: workflow CI específico, sem deploy, para executar a suíte e verificar sintaxe do JSON.

## Evidência local
Ambiente de trabalho: Node.js v22.16.0; execução local de uma cópia equivalente do validador e cenários sintéticos. Resultado observado: **26 testes executados, 26 aprovados e 0 falhas**. Validação do desenho do JSON Schema com biblioteca Python `jsonschema.Draft202012Validator.check_schema` concluída na cópia local antes da publicação.

**Limitação crítica de proveniência:** o download direto da branch do GitHub não estava acessível no ambiente local. Assim, os testes Node.js foram executados sobre a cópia local de desenvolvimento; **não foi executada uma suíte obtida por checkout do commit do GitHub**. O conteúdo versionado foi conferido pela API do GitHub, mas a equivalência byte a byte entre o código local e o versionado não foi provada. Não declarar CI verde, suite versionada executada ou homologação de produção com base nesta etapa. O workflow é proposto e necessita confirmação de execução na plataforma GitHub Actions.

## Cobertura observada
- Aceitação sintética dos formatos R1–R7: 7 casos.
- Ausência de metadados/campos obrigatórios: 7 casos.
- Rejeição e checagens adicionais de integridade/causalidade/governança/privacidade: 12 casos.
- Nenhum ZIP ou planilha oficial processado. Nenhum Conceito Enade calculado.

## Atenção técnica
O JSON Schema 0.2 é um contrato parcial: ainda precisa de validação independente do conteúdo publicado (e.g. payloads profundos, semântica da ponderação, SC, arredondamentos e inconsistências entre claims). O gate JS complementa apenas algumas regras. Não presumir equivalência entre a validação de estrutura JSON Schema e os bloqueios semânticos. Falhas simuladas com flags de proteção não comprovam política de segurança de produção.

## Portões
P-ZIP-001 aberto (ZIP fornecido futuramente pelo usuário). P-NT-001 aberto (auditoria por edição). P-REF-001 aberto (planilhas oficiais). P-VAL-002 permanece **parcial**: executado Node local, pendente checkout e CI GitHub. P-SCHEMA-001 permanece **parcial**: contrato JSON Schema 0.2 existe, testes profundos de todas as regras ainda não completos. P-CI-001 aberto: confirmar resultado workflow, logs e SHA do commit.

## Próxima execução permitida
Obter checkout do commit versionado, executar `node docs/enade-360/validator/test-contracts.cjs`, executar verificação Draft 2020-12 contra fixtures, corrigir qualquer divergência e anexar logs completos. Não integrar ao aplicativo ou habilitar publicação sem aceite independente.
