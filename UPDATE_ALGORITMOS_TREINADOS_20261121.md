# Algoritmos no lugar da IA externa (21/11/2026)

A IA externa (OpenAI, Anthropic, Gemini) continua bloqueada por padrão desde 19/11/2026 e pode ser religada pelo secret `AI_SUSPENDED=false`. O código de chamada foi mantido, mas fica inativo.

## Análise de documentos (`vertice-doc-analyze`)

Antes, com a IA suspensa, a análise falhava e o documento ficava como `failed`. Agora a análise é feita por regras (`doc-rules.ts`):

- elementos esperados por categoria: PPC, PDI, PPP, Regimento, atas, Relatório CPA (5 eixos), PEI, Política LGPD, laudos e alvarás, além de Estágio, Extensão e TCC;
- citação de normas revogadas: Decreto 5.773/2006, Lei 5.692/1971, Lei 6.494/1977, Portaria Normativa MEC 40/2007, Res. CNE/CES 9/2004 e Res. CNE/CP 1/2002;
- se o fundamento normativo cadastrado para a categoria é citado no texto;
- validade calculada pela data mais recente do texto somada a `renewal_months`.

O índice gravado em `ai_compliance_score` mede completude. Não é parecer de conformidade. O campo `ai_model_version` passa a registrar `regras-doc-v1`. O PDF agora é lido pela camada de texto com pdfjs, como no Impacto; a leitura antiga só funcionava em PDF sem compressão.

## Discursiva: pré-nota por modelo treinado

A pré-nota pode vir de uma regressão ridge (`trained-grade.ts`) treinada com as notas finais que os docentes do próprio curso já homologaram (RPC `vertice_discursiva_training_set`, somente leitura, com a mesma autorização e MFA). O modelo só substitui a regra quando três condições são atendidas:

1. existem pelo menos 30 respostas homologadas no curso;
2. em validação cruzada de 5 partições, com respostas não vistas no ajuste, o erro médio do modelo fica pelo menos 0,25 ponto abaixo do erro da regra;
3. as previsões nessas respostas não vistas acompanham a nota docente (correlação ≥ 0,5).

Se alguma condição falhar, vale a pré-nota por regra, e o motivo é gravado em `ai_assessment.training`. A revisão docente continua obrigatória. O modelo não atribui nota por critério.

Situação em 21/11/2026: o banco tem 0 respostas homologadas, então o modelo ainda não está ativo.

## Sem substituto algorítmico

Na Discursiva, a transcrição de manuscrito (OCR) e a geração de questões continuam dependendo da IA e ficam indisponíveis enquanto ela estiver suspensa.
