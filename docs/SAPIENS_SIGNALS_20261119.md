# Sinais dos alunos (Sapiens · Fato & Ordem) — receptor Vértice

Nova aba **Sinais dos alunos** no Vértice Sapiens. Mostra, por matrícula, a situação de estudo de cada aluno vinculado, os padrões de erro já liberados e as prescrições em curso, produzidos pelo Sapiens no Fato & Ordem.

## Fluxo

1. O componente `SapiensSignals` invoca `vertice-learning-bridge` com `{"operation":"sapiens_signals","institutionId":…}`.
2. A ponte exige a mesma autorização dos indicadores de leitura: sessão, MFA AAL2, e perfil Master ou papel institucional da alta gestão. Nenhuma permissão nova foi criada.
3. A ponte consulta `GET /api/internal/vertice/sapiens-feed` no Fato & Ordem, com a chave de servidor existente. A consulta recusa redirecionamento e não usa cache.
4. O contrato v1 é validado por inteiro antes de qualquer exibição:
   - instituição e segmento;
   - token;
   - curso;
   - situação;
   - contagens;
   - códigos `E-XXX-NN` e `P-NNN`;
   - datas;
   - limites de tamanho.

   Se qualquer item falhar, a resposta inteira falha.
5. O token é traduzido em matrícula e nome do curso pela função `vertice_sapiens_signal_roster`. A função é `SECURITY DEFINER`, só executável por `service_role` e lê `vertice_private.learning_students`. O token nunca chega ao navegador.
6. Vínculos sem matrícula ativa na Vértice são contados (`unmatched`), não exibidos.

## Regras exibidas

- **Sem atividade:** 7 dias ou mais sem resposta, depois de ter estudado.
- **Em queda:** menos de 50% das respostas da semana anterior, que precisa ter pelo menos 10.
- **Nunca iniciou:** sem nenhuma resposta.
- **Padrões de erro:** só chegam à Vértice depois de liberados ao próprio aluno pela revisão docente cega no Fato & Ordem.

## Verificação

- `server/sapiens-signals.medical.spec.ts` (ponte):
  - tradução de token em matrícula;
  - ordenação;
  - token não repassado;
  - filtros recusados;
  - outra instituição ou segmento;
  - campos inválidos;
  - falha da origem;
  - papel não autorizado.
- `client/src/components/bi/SapiensSignals.ui.test.tsx` (tela):
  - resumo, padrões frequentes e lista por matrícula;
  - filtros;
  - falha sem dado antigo;
  - resposta de outra instituição;
  - papel não autorizado.
