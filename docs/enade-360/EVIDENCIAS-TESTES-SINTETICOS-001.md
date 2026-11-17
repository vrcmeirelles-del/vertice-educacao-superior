# Evidência de execução sintética — Motor ENADE 360°
Data: 2026-11-16 | Ambiente: execução JavaScript isolada de ferramentas, não serviço publicado Vértice | Conjunto: 18 cenários M01–M18 e 2 verificações V01–V02.

## Artefatos
- `validator/validator.cjs`: implementação independente de validação contratual, controle de afirmações, elegibilidade mínima, bloqueios de comparabilidade, reconciliação simples, percentuais e versionamento.
- `validator/test-validator.cjs`: suíte reproduzível de 20 cenários; execução sugerida: `node docs/enade-360/validator/test-validator.cjs` a partir da raiz do repositório. Nenhuma dependência de pacote externo declarada.

## Evidência nesta execução
As 20 funções de teste correspondentes ao código gravado foram executadas diretamente no runtime JavaScript isolado, com resultado:

| Cenários | Aprovados | Falhos | Tipo |
|---|---:|---:|---|
| M01–M18 | 18 | 0 | dados e regras sintéticos |
| V01–V02 | 2 | 0 | fixture válida e rejeição de hash inválido |
| **Total** | **20** | **0** | **não é homologação** |

Os resultados foram capturados antes do commit do material. O arquivo `test-validator.cjs` foi salvo para reprodução externa; **não foi possível executar `node` sobre os arquivos efetivamente recuperados do GitHub nesta sessão**. A conferência posterior de presença e integridade textual dos arquivos no GitHub é obrigação adicional. Não há prova de CI, implantação, execução em banco, ZIP ou microdados reais.

## Limitações técnicas (importantes)
1. O código é um protótipo isolado, com semântica simplificada de elegibilidade e comparabilidade; não aplica todas as regras oficiais por edição.
2. `sample_n` e a presença de metadata são checados, mas os formatos completos R1–R7, suas estruturas aninhadas e JSON Schema formal ainda exigem implementação mais rigorosa.
3. Classificação C1/C2 é prototípica e requer tabela documental de metodologias aprovadas; não usar para autorizar comparações reais.
4. O bloqueio de divulgação individual é baseado em flags; integração real precisa de governança/autorização e testes de segurança.
5. `stableSerialize` só garante ordenação estável textual para estes objetos de teste; hash criptográfico de execuções ainda não implementado.
6. A comparação numérica R7 aqui requer igualdade exata; tolerâncias oficiais e arredondamentos dependem das respectivas notas técnicas.

## Pendências e aceite
- P-ZIP-001: receber ZIP(s) oficiais do usuário (aberta).
- P-NT-001: concluir fórmulas e exceções por edição (aberta).
- P-REF-001: obter planilhas de indicadores por curso com versão/hashes (aberta).
- P-VAL-002: executar a suíte com Node/CI do repositório e registrar logs SHA/ambiente (aberta).
- P-SCHEMA-001: criar e executar JSON Schema completo para R0–R7, incluindo validações cruzadas (aberta).

**Portão de homologação:** fechado. Cenários sintéticos aprovados não equivalem a indicadores oficiais reproduzidos.
