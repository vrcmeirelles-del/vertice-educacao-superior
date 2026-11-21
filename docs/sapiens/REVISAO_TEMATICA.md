# Comando de revisão temática do Sapiens

O motor existente `vertice-sapiens-analyze` recebe agora `action: thematic_review`.
O comando revisa um descritor final de tema/subtema com OpenAI e Anthropic,
independentemente, usando as integrações e os modelos já configurados. Não
substitui o fluxo de planejamento ou o diagnóstico institucional.

## Operação e limites

- Exige sessão Supabase válida, MFA `aal2` e cadastro Master em `vertice_admins`.
  Não aceita service role, coordenação ou vínculo institucional como autorização
  para revisar o banco global de questões.
- Um snapshot por requisição, até 24.000 caracteres no conjunto, sem lote,
  agendamento, repetição automática ou fallback entre provedores. Cada requisição
  válida pode consumir duas chamadas pagas. Nenhuma chamada paga foi feita na
  validação desta alteração; os testes usam respostas sintéticas.
- Suporta `oab1`, `oab2`, `carreiras`, `cfc`, `enade`, `enamed`, `residencia`, `enem`.
- As duas IAs recebem o mesmo snapshot e o mesmo descritor final, sem acesso à
  resposta uma da outra. Se o descritor precisa mudar, a revisão deve reprovar.
- Aprovação requer os dois pareceres válidos, confiança >= 0,90, evidência literal,
  alinhamento com o comando, especificidade, respeito ao gabarito e ao contexto
  temporal, sem ressalvas. Temas amplamente genéricos são recusados antes das IAs.
- Anulação, mídia necessária ausente, ausência de gabarito, atividade experimental
  e trava docente bloqueiam a aprovação mesmo quando as IAs concordam.
- Referências médicas e recortes jurídicos temporais exigem data da prova e
  referência identificada pelos dois revisores. Cada referência tem id, URL,
  localizador, excerto, versão e data de recuperação. A função não acessa URLs:
  os excertos são fornecidos pelo solicitante e não são autenticados pela função.
- A resposta inclui versão do comando, hash SHA-256 do snapshot, versão da origem,
  modelos, horários, respostas brutas, pareceres e motivos de bloqueio.
- **Sem gravação no acervo ou no banco institucional.** O recibo é retornado ao
  chamador, que deve arquivá-lo. Não há tabela nova nem histórico persistido por
  esta função. Enunciados, comentários, alternativas, rubricas e gabaritos não são
  atualizados. A origem é um snapshot fornecido, não uma consulta ao Fato & Ordem.
- `dual_review_approved_proposal_only` significa aprovação da proposta para o
  snapshot, nunca publicação, autenticidade comprovada de fonte ou homologação
  de todo o acervo. `publicationAllowed` é sempre `false`.

## Contrato

POST autenticado à função existente:

```json
{
  "action": "thematic_review",
  "question": {
    "module": "carreiras",
    "sourceKey": "identificador-da-questao",
    "sourceVersion": "versao-da-origem",
    "stem": "Enunciado completo recebido da origem autorizada",
    "support": "Texto de suporte, se houver",
    "command": "Comando efetivo da questão",
    "alternatives": {},
    "answer": "E",
    "format": "CERTO_ERRADO",
    "flags": [],
    "references": [],
    "proposed": {
      "discipline": "Direito Administrativo",
      "theme": "Responsabilidade civil das empresas estatais",
      "subtheme": "Distinção entre exploração econômica e serviço público"
    }
  }
}
```

Para recorte temporal: `temporalReferenceRequired: true`, `examDate` e referências
com `id`, `url`, `locator`, `excerpt`, `version`, `retrievedAt`. Para questão com
mídia indispensável, `mediaRequired: true` bloqueia a aprovação: o comando atual é
textual e não faz leitura de imagens. Marcadores e menções explícitas a tirinhas
ou figuras também bloqueiam, mesmo que `mediaComplete` seja declarado verdadeiro.
Um URL não basta.
Não usar o comando textual como homologação multimodal.

## Verificação

`node --test source-overrides/supabase/functions/vertice-sapiens-analyze/thematic.test.ts`
com Node 24. Os testes cobrem ausência de provedor, evidência inventada, decisões
contrárias ao gabarito, anulação, mídia, trava docente, referências temporais e
preservação do snapshot. A execução autenticada com chamadas reais e a interface
de acionamento por usuário não são comprovadas por esses testes.

## Conclusão do acervo

Este comando é o motor de revisão, não um importador ou uma fila de publicação.
Para concluir o acervo: conectar snapshots autorizados do Fato & Ordem com versões
e mídias completas; obter as referências aplicáveis; apresentar o lote e orçamento;
revisar o descritor final com ambos os provedores; arquivar recibos; obter autorização
expressa de aplicação; conferir novamente a versão operacional e respeitar travas.
Nenhuma dessas operações de massa é iniciada pela implantação do comando.

## Registro de implantação inicial

PR #162 integrada em 16/11/2026. A função existente chegou à versão 8, ACTIVE,
com JWT habilitado e os quatro arquivos conferidos contra o código enviado.
O teste HTTP público retornou OPTIONS 204 e POST sem token 401. O portal existente
www.verticesuperior.com.br respondeu HTTP 200. Dez testes locais foram aprovados.
Não houve nova chamada paga nem alteração de questões. Esses checks não comprovam
uma revisão autenticada real com os dois provedores. O recibo usa o modelo retornado
pela API, quando disponível, e preserva o identificador configurado como fallback.

> **21/11/2026:** a IA foi retirada do Sapiens. Este documento descreve o desenho anterior com IA; o comportamento vigente é por regras — ver `UPDATE_POLITICA_IA_20261120.md`.
