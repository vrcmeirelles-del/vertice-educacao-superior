# Evidência e contrato — validação Draft 2020-12 (v0.8)
Data: 2026-11-16 | Ambiente-alvo: GitHub Actions em PR #169 | Status: AGUARDANDO CONFIRMAÇÃO DO CI na criação deste registro.

## Arquivos do novo gate
- `validator/report-schema-0.3.json`: nova versão, preservando esquema 0.2 para histórico. Introduz verificações condicionais por modalidade R1–R7, referência de fontes, evidências de afirmações oficiais, fórmula de cálculo reproduzido, revisão humana de relatórios aprovados, autorização de intervenções R6, data de publicação declarada e metadados.
- `validator/test-json-schema.py`: bateria real com `jsonschema.Draft202012Validator.check_schema`, `FormatChecker` e `iter_errors`, sete fixtures positivas R1–R7 e 21 negativas; cada teste verifica aceitação/rejeição esperada.
- `.github/workflows/enade360-contracts.yml`: CI com Node.js 22, Python 3.12, `jsonschema==4.23.0`, teste semântico anterior e novo gate de instâncias.

## Separação obrigatória dos níveis
1. Esquema JSON: estrutura, tipos, enum, requisitos condicionais e metadados.
2. Gate semântico Node: comparabilidade, população, correspondência dos valores, causalidade, publicação/privacidade por flags.
3. Prova oficial (NÃO EXECUTADA): processamento dos arquivos ZIP INEP e conciliação real por curso/área/edição.

## Limitações e testes futuros
- `jsonschema` não avalia todos os vínculos aritméticos/epistêmicos entre campos (ex.: amostra <= denominador, tolerâncias e divergências); exige motor de consistência.
- Formato URI, timestamp e hash são validações de representação, não autenticidade do documento.
- O novo esquema não comprova autorização real nem anonimização; flags de dados pessoais não substituem políticas de acesso.
- Revisar coerência entre schema v0.3 e validador Node, alinhando ambos sem quebrar os casos anteriores.
- CI precisa ser confirmado com ID, commit SHA, conclusão e logs. Não declarar sucesso antes da verificação.

## Pendências
P-ZIP-001 aberto; P-NT-001 aberto; P-REF-001 aberto; P-SCHEMA-001 em execução; P-CI-002 aberto até verificar o novo gate do workflow. Sem deploy, sem homologação e sem especialização.

## Evidência de falha e correção — 2026-11-16
- CI inicial do novo gate: GitHub run `43996758502`, conclusão `failure` no passo `Validate positive and negative Draft 2020-12 instances`; gate semântico Node passou (26/26). No Python, 26/28 passaram, 2 falhas: `bad_datetime` e `bad_method_url` foram erroneamente aceitos.
- Causa provável tecnicamente fundamentada: instalação `jsonschema==4.23.0` sem extras de verificadores de formato opcional; isso pode impedir validação de `date-time` e `uri` mesmo quando o `FormatChecker` está presente. Não remover os testes.
- Correção versionada no workflow: `python -m pip install "jsonschema[format]==4.23.0"`, commit `1f62c2163db65309e40957553abc7272d6b603a2`. Resultado final da repetição ainda sujeito a confirmação do CI.
- Esta falha faz parte do histórico auditável e não deve ser apagada. Não representa prova com microdados INEP.

## Etapa de integração — instância única, dois validadores (2026-11-16)
- **Confirmado** no GitHub Actions após correção dos validadores de formato: run `43996910743`, commit `1f62c2163db65309e40957553abc7272d6b603a2`, `completed/success`; gate Node e gate Python passaram. Evidência de correção do run `43996758502` (26/28, duas falhas de formato) permanece registrada acima.
- Criado `validator/integrated-gate.cjs`: agrega o antigo gate semântico e novos bloqueios para hipóteses/inferências validadas sem pressupostos/limitações, propostas aprovadas sem revisão e contagens impossíveis de participantes.
- Atualizado `validator/test-json-schema.py`: cada instância da suíte passa pelo **JSON Schema Draft 2020-12** e pelo **gate semântico Node**, combinando as respostas; foram adicionadas quatro fixtures negativas, totalizando 32 casos (7 positivos, 25 negativos).
- Estado de prova desta integração: arquivos versionados, aguardando conclusão do GitHub Actions correspondente ao novo código; não afirmar 32/32 aprovados antes do run. Sem bases reais do INEP.
