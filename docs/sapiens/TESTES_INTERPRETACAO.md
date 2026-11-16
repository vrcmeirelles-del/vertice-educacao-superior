# Testes da camada interpretativa

**Atualização da implantação autorizada:** consulte [IMPLANTACAO_PR157.md](IMPLANTACAO_PR157.md). O registro abaixo preserva o estado da preparação/revisão.

Validação local com dados fictícios. Nenhuma escrita de negócio nem geração de parecer com provedores reais foi feita em produção. As consultas remotas da preparação/revisão limitaram-se a metadados de esquema, definições de funções, histórico e serviços. As correções foram executadas e testadas somente localmente.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Testes de regras, referências e motor de planejamento | 15 aprovados |
| Interface da análise interpretativa | 7 aprovados |
| Regressões do planejamento de curso, consolidação, modelo, ReitorBI, SapiensPanel e planejamento escolar | 25 aprovados |
| PostgreSQL/PGlite: autorização, contexto, vínculos, histórico, datas futuras e documentos | 10 aprovados |
| Total | 57 testes aprovados |
| TypeScript do portal completo | Sem erros |
| TypeScript estrito dos módulos novos da função Edge | Sem erros |
| Build estático do portal | Aprovado; aviso existente de tamanho dos chunks |
| Conferência visual da preparação inicial | Componente real com dados fictícios em desktop e contêiner de 390 px. As correções desta revisão foram verificadas por testes de interface; não houve nova conferência visual |

O mock legado do ReitorBI emite aviso de método `maybeSingle` ausente. Os oito testes desse componente passaram; o aviso não é evidência de falha no serviço real. A conferência a 390 px foi feita reduzindo a largura do contêiner no exemplo local, sem alegação de teste em aparelho físico.

## Regressões da revisão técnica de 16/11/2026

Os seis achados da revisão foram transformados em verificações do repositório:

- **R1:** executar o bloco real de integração das operações escolares da migração anterior; comparar o contexto antes e depois da nova migração. Somente os dados operacionais da fixture são sintéticos.
- **R2:** curso com estratégia salva, sem semestre observado e com carga somente futura mantém histórico observado vazio.
- **R3:** alteração do indicador/unidade/direção ou de fórmula/população cadastradas invalida o vínculo. Confirmação com revisão ou definição desatualizada é recusada; encerrar e confirmar novamente preserva o vínculo anterior. Mudança de título/alvo não invalida por si só a associação.
- **R4:** meta vencida com valor antigo no alvo produz lacuna de aferição; a existência de medição posterior remove essa lacuna.
- **R5:** SWOT, riscos, objetivos operacionais e visão aparecem em fontes próprias, com valor, campo, versão e data congelados.
- **R6:** um achado de tendência exige `metric_field`, `comparability` e valores numéricos elegíveis em três períodos distintos. Valores nulos, fonte ausente, data duplicada/futura, código de curso ambíguo e mistura de grupos são recusados; zero observado continua válido.

A interface tem testes da confirmação da revisão do indicador e da apresentação do campo numérico/comparabilidade. O workflow existente executa os dez testes PostgreSQL uma vez, no Node 24, e considera alterações nas funções Edge, migrações de planejamento e testes de banco. A execução remota deste commit pode ser omitida com `[skip ci]`; resultados locais não são descritos como CI remota.

## Casos de banco

- MFA insuficiente, usuário sem sessão/vínculo e CPA recusados.
- Coordenação não consulta outra IES, outro curso ou consolidação institucional; tabela privada não fica diretamente disponível ao navegador.
- Parecer de curso não recebe o inventário institucional; contexto devolvido é exatamente o contexto persistido pelo trigger.
- Normalização de semestre mantém duplicidade como ambiguidade; não soma nem transforma ausência em zero.
- Medições e cargas futuras são excluídas; período futuro explicitamente selecionado não apresenta estoque futuro como resultado observado.
- Fonte de risco ausente permanece indisponível; grupos menores que cinco são suprimidos.
- Associação exige curso, objetivo e versão exatos, definição congelada do indicador, justificativa e revisão otimista tanto do plano quanto da meta. Alteração do rascunho invalida a associação; nova versão não a herda.
- Histórico filtra escopo antes de limitar a vinte, inclusive com 25 pareceres mais recentes de outro curso.
- Revisão humana só pela gestão autorizada, com instituição e transição verificadas; planos existentes permanecem iguais.
- Upload ativo sem aprovação, documento vencido e documento de outra instituição não contam como documento aprovado do curso. Arquivo novo devolvido prevalece sobre arquivo antigo validado.

## Casos de interpretação e interface

- Referência inexistente, saída inválida, tendência sem base temporal e recomendação sem achado são recusadas.
- Zero observado é preservado. Datas futuras, última data duplicada, medição anterior ao vencimento e meta cancelada não geram comparação indevida.
- Tendência usa três medições; vínculo textual não substitui associação explícita.
- Parecer permanece pendente de revisão humana mesmo com recomendação `proceed` do outro provedor. Falta de revisão independente é apresentada.
- Falha do primeiro provedor pode usar o outro; recorte excessivo é recusado antes de consumi-los.
- Troca de instituição elimina o parecer anterior da tela; fontes legadas ficam identificadas como texto livre, sem links fabricados.
- A coordenação acessa a análise pelo planejamento, sem receber o botão da consolidação institucional ou comandos de revisão gerencial.

## Reprodução

Compor a fonte como nos serviços existentes: extrair `vertice-servidor-source.zip` em pasta temporária, sobrepor `source-overrides/`, copiar `scripts/portal-types.vitest.config.ts` para `scripts/` dessa composição e instalar com `npm ci --legacy-peer-deps --no-audit --no-fund`.

Para os testes de interface, instalar `scripts/tests/types-runtime` com `npm ci` e disponibilizar seu `jsdom` na composição, como no workflow existente `verify-portal-types.yml`.

Na pasta composta:

```sh
node node_modules/vitest/vitest.mjs run --config scripts/portal-types.vitest.config.ts supabase/functions/vertice-sapiens-analyze/planning.test.ts client/src/components/area/SapiensPlanning.ui.test.tsx client/src/components/area/CoursePlanning.ui.test.tsx client/src/components/bi/PlanningManagement.ui.test.tsx client/src/components/bi/planning/model.test.ts client/src/components/bi/ReitorBI.ui.test.ts client/src/components/area/SapiensPanel.ui.test.tsx client/src/components/area/SchoolPlanning.ui.test.tsx
npm run check
npm run build:static
```

Na raiz do repositório:

```sh
npm ci --prefix scripts/tests/planning-runtime --no-audit --no-fund
node --test scripts/tests/planning-runtime/context.test.mjs
```

O teste de banco aplica as funções, o bloco real de integração escolar anterior, o trigger anterior e a migração proposta a um PostgreSQL isolado em memória, com papéis reais de banco e a função institucional `member_role` do repositório. Não recebe URL, credencial nem dados de produção.

O exemplo visual está em `scripts/tests/planning-ui/`, usando o componente real e um mock local. Não é incluído na interface de produção. Instalar as dependências da composição e iniciar o Vite com sua configuração para conferência visual; o texto do cabeçalho identifica dados fictícios.

## Verificações pendentes após autorização

Geração real, latência, comportamento dos dois provedores, disponibilidade das fontes e homologação com sessões reais de coordenação, direção e alta gestão. Aplicação da migração, publicação Edge e integração/publicação no ambiente existente dependem da autorização do usuário. Não houve alteração dos serviços ou dos planejamentos durante esta preparação.
