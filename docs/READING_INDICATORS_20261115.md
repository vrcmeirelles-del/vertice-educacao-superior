# Indicadores de leituras — receptor Vértice

## Estado desta entrega

Implementação preparada para revisão, sem integração à `main` e sem implantação. Nenhum dado sintético foi inserido em banco hospedado. Não houve chamadas a provedores de IA, envio de mensagens, ativação de instituições ou alteração de vínculos.

Inspeção em 15/11/2026:

- Vértice `main`: `8a4e76f752e13cfdd33bcef8f58d6cf0f564d22c`.
- Fato & Ordem `main`: `9e2138a4db7a5f5b17f81cecd522f88bd26f768d`, posterior às PRs #256/#257.
- Os endpoints de leituras estavam presentes na origem e o receptor continuava ausente na Vértice.
- A função hospedada `vertice-learning-bridge`, versão 23, tinha `verify_jwt=true`. Seu código correspondia à base desta implementação, exceto por uma linha em branco final.
- Os serviços Render `vertice-portal` e `vertice-educacao-superior` acompanham `main`, com publicação automática por commit e previews de PR desativados.

## Contrato e fluxo

O componente compartilhado `ReadingIndicators` invoca a função existente `vertice-learning-bridge`, com o corpo:

```json
{"operation":"reading_indicators","institutionId":"UUID da instituição autorizada"}
```

O servidor valida a sessão, MFA AAL2, Master ou associação institucional com papel autorizado. O segmento vem de `vertice_institutions.tier`, nunca do navegador.

| Segmento salvo | Endpoint interno F&O | Módulos admitidos |
|---|---|---|
| `superior` | `/api/internal/vertice/reading-indicators?institutionId=...` | `oab`, `oab2`, `carreiras`, `cfc`, `enade`, `enamed`, `residencia` |
| `escolas` | `/api/internal/vertice/school-reading-indicators?institutionId=...` | `enem` |

Reutiliza `VERTICE_BRIDGE_API_KEY`, enviada somente pelo servidor no cabeçalho `x-vertice-bridge-key`, e `FATO_ORDEM_BRIDGE_URL`, com a lista existente de origens permitidas. Não depende da chave de identidade para consultar leituras. O JWT do usuário não é encaminhado ao F&O. A consulta de leituras recusa redirecionamentos e usa `no-store`.

O receptor exige `periodDays=90`, lista com até 24 agregados, módulos do segmento correto, ações `displayed`, `opened` ou `declared_read`, totais inteiros seguros não negativos e uma única linha por módulo/ação. Respostas incompatíveis falham antes da apresentação. Só os campos `module`, `action` e `total` atravessam o receptor, acrescidos de instituição, segmento, janela, escopo e horário da consulta. Identidades, temas, textos e avisos arbitrários da origem não são repassados. Erros da nova operação não expõem nem registram corpos da origem.

O F&O mantém a responsabilidade por verificar instituição habilitada e vínculos com curso identificado, verificados, não revogados e anteriores aos eventos. A janela móvel de 90 dias é calculada no banco da origem. O teste entre repositórios executa esse SQL real com dados sintéticos locais.

## Experiência e interpretação

- **Aprendizagem Conectada:** bloco próprio em Superior e no ENEM 360° Escolar. O botão de atualização e a conclusão das operações da ponte solicitam uma nova consulta de leituras.
- **BI Acadêmico:** bloco após os gráficos acadêmicos, somente após a seleção explícita da instituição; o papel efetivo dessa instituição é passado ao componente.
- **Sapiens 360:** nova aba **Leituras e contexto**, carregada ao ser aberta. Serve à análise humana, sem inclusão no motor de diagnósticos, classificação de severidade, eficácia ou propostas automáticas.

Exibição, abertura e leitura autodeclarada aparecem em colunas separadas, com fonte e horário de consulta. O painel informa expressamente que os eventos não comprovam aprendizagem, não são estudantes/publicações únicos e não constituem funil de conversão. Exibições podem incluir o bloco de sugestões e referências.

O contrato não possui curso, competência, turma, semestre ou intervenção. Esses filtros são recusados no receptor; filtros dos demais painéis não se aplicam ao bloco. Por isso os totais institucionais não são expostos a coordenadores/NDE, CPA ou outros perfis sem a permissão institucional já exigida pela ponte. Não foi criada nova permissão.

Consulta vazia é apresentada como ausência de eventos no recorte autorizado, sem conclusão sobre a existência de estudo. Falhas são apresentadas como indisponibilidade, sem transformar erro em zero. Atualização descarta o total anterior; respostas atrasadas após troca de instituição/papel ou desmontagem são ignoradas.

## Impacto técnico

Sem tabela nova, migração, cron, cache persistente, índice acadêmico ou alteração no F&O. Consulta direta ao agregado existente a cada abertura/atualização autorizada. Isso acrescenta uma chamada à ponte e uma consulta agregada na origem por atualização; o custo em produção não foi medido.

Notas, acertos, rankings, domínio de competências, métricas curriculares, diagnósticos e medições de eficácia permanecem fora do caminho de escrita desta operação. Não são executadas RPCs de ingestão/recalculo. Revogação e suspensão são observadas na próxima consulta, sem manter cópia local dos totais; uma tela já aberta é um retrato do horário informado e precisa ser atualizada para refletir mudanças posteriores.

As assinaturas TypeScript da função foram ajustadas de `ReturnType<typeof createClient>` para `SupabaseClient`, e dois parâmetros de identificadores receberam `unknown`. Essas mudanças são apenas de tipos. A checagem estrita local adicional, com o SDK 2.45.4 usado pela função, passou sem diagnósticos.

## Validação local

Portal composto com o ZIP existente e os overlays, seguindo o build configurado no Render. Os 88 pacotes diretos instalados foram comparados ao lockfile, sem divergências de versão.

| Verificação | Resultado |
|---|---|
| TypeScript completo do portal | Aprovado, zero diagnósticos |
| TypeScript estrito adicional da Edge Function, SDK 2.45.4 e declaração local de Deno | Aprovado, zero diagnósticos |
| Suíte geral Vértice | 409 testes aprovados |
| Contratos médicos/escolares e receptor de leituras | 55 testes aprovados, incluindo 35 do novo receptor |
| Contratos/interfaces do portal | 128 testes aprovados, incluindo 15 do novo bloco e um novo cenário Sapiens |
| Build estático completo | Aprovado; aviso do bundler sobre chunks acima de 500 kB |
| Leituras e ponte na origem F&O | 24 testes aprovados |
| Teste entre códigos reais das duas plataformas | 13 verificações aprovadas; PostgreSQL PGlite, dados sintéticos, zero chamadas de rede |

Cobertura: chave interna, sessão ausente/inválida, AAL1, papéis institucionais, Master, tentativa de outra instituição, filtros indevidos, segmento desconhecido, ENEM separado, dados cruzados, envelope inválido, ações/totais inválidos, duplicatas, origem sem credencial, indisponibilidade, autorização vazia, atualização, revogação, suspensão, janela de 90 dias, evento anterior à verificação e vínculo sem curso.

Os testes de interface usam JSDOM. Não equivalem a homologação autenticada em produção. A tentativa de inspeção visual com Chromium local foi impedida pelo ambiente (`socket() failed: Operation not permitted`); não se declara inspeção visual de desktop/celular concluída.

Reprodução, após compor o portal e instalar os runtimes já usados nos workflows:

```bash
npm run check
npm test
./node_modules/.bin/vitest run --config scripts/medical.vitest.config.ts
./node_modules/.bin/vitest run --config scripts/portal-types.vitest.config.ts
npm run build:static
```

O teste entre repositórios é executado a partir da raiz Vértice, com o checkout F&O inspecionado e suas dependências de teste:

```bash
FATO_ORDEM_SOURCE=/caminho/fato-e-ordem \
VERTICE_TEST_RUNTIME=/caminho/portal-composto/package.json \
node scripts/tests/reading-indicators-cross-repo.mjs
```

## Operações propostas — somente após aprovação expressa

1. Reconfirmar que a base, o commit da PR e a função hospedada não divergiram. Se houver mudança, revisar o novo diff antes de continuar.
2. Publicar **somente** `supabase/functions/vertice-learning-bridge/index.ts` desta PR no projeto Supabase Vértice **`qvetbbmviatxxatzzuzc`**, função **`vertice-learning-bridge`**, mantendo **`verify_jwt=true`** e as credenciais existentes. A função já existe; a atualização é aditiva e preserva as operações anteriores.
3. Integrar por **squash** a PR de rascunho em `vrcmeirelles-del/vertice-educacao-superior:main`, conferindo o SHA do head explicitamente apresentado para aprovação. Esse merge aciona os dois serviços existentes no workspace Render `tea-d925voi8qa3s73csvir0`:
   - `vertice-portal`: **`srv-dbm52uhsrm7s73f3ojkg`**.
   - `vertice-educacao-superior`: **`srv-dbbm6q3ncjis7396t7fg`**.
4. Fazer verificações somente de leitura: versão dos serviços, preservação de JWT/MFA, apresentação do bloco e consultas autorizadas nas instituições disponíveis. Não inserir testes sintéticos nos bancos hospedados. Falta de sessão autorizada deve ser informada, sem declarar homologação autenticada concluída.

Não executar `db push`, migrações, deploy no F&O, alterações de chaves, permissões ou cron neste lote. Se forem necessários, apresentar separadamente as operações concretas.

Reversão proposta, se a implantação autorizada falhar: reverter o commit desta PR e republicar o código anterior da função, preservando `verify_jwt=true`. Sem apagamento de dados ou mudanças de banco.
