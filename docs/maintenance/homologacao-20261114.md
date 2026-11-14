# Correções após homologação funcional — 14/11/2026

Branch: `maintenance/homologacao-modulos-20261114`.
Base: `385a81158b62c381de01a2179551fa29993441d3`.

## Problema e comportamento proposto

Na instituição fictícia FV-DEMO, a homologação autenticada criou e avançou um TCC, mas o BI continuou exibindo o total anterior. AC e Estágio tiveram gravações bloqueadas pelo erro HTTP 503 / PGRST002; o comprovante de AC chegou ao Storage sem sua solicitação. A Vitrine consultava campos e RPCs ausentes. O Raio-X podia permanecer em carregamento quando a consulta falhava.

Esta manutenção preserva os módulos, as rotas e os controles de acesso. Não contém migração, alteração de RLS ou de permissões, nem modifica a PR #119. A integração/publicação desta nova manutenção depende de revisão e aprovação.

- **TCC:** recarregar carteira e resumo do BI juntos após criar trabalho ou avançar etapa; manter a versão otimista da transição. Propagar erros nas consultas principais e informar quando a gravação ocorreu, mas o resumo não pôde ser atualizado.
- **Vitrine:** usar `payload` e `source_report_at` de `vertice_academic_reports`. Substituir RPCs inexistentes pelas tabelas reais `governance_bodies`, `governance_meetings` e `governance_deliberations`, com vínculo ao curso e instituição e estados `ativo`, `realizada` e `concluida`. Consultar a contagem exata dos diagnósticos com nota ≥ 3, em lugar da estimativa anterior. Contar AC com estado `credited` por regulamento/curso, pois a view não tem coluna `credited`.
- **Raio-X e Vitrine:** verificar também o campo `error` das respostas resolvidas do Supabase; mostrar falha e botão para repetir em vez de zeros silenciosos. Limitar o carregamento a 20 segundos e ignorar respostas de seleções anteriores. Distinguir resumo ausente de carregamento no Raio-X. Consolidar consultas secundárias do Raio-X na mesma rodada e limpar dados opcionais sem resultado.
- **AC:** dar ID conhecido à solicitação antes do envio; se a escrita falhar, consultar esse ID antes de remover seu comprovante. Resposta perdida após COMMIT não autoriza apagar o arquivo: se a solicitação for localizada, retornar o sucesso já persistido. Se a confirmação ou a limpeza falhar, preservar o arquivo e bloquear reenvio naquele formulário até conferência. Remoção utiliza a API de Storage, nunca DELETE de metadados por SQL.
- **Compilação da base atual:** quatro erros que surgiram em CPA/Extensão após a manutenção anterior: importar `createCampaign`, tipar `notes` opcional, assimilar o builder antes de `.finally()` e tratar `courses` opcional no PDF de extensão. Nenhuma funcionalidade foi removida para obter compilação sem erros.

## Resultados efetivos locais

Composição: ZIP de fonte + `source-overrides/`, com instalações separadas de dependências previamente preparadas nas duas versões. Suíte DOM utiliza `jsdom` 27.2.0 do lockfile de `scripts/tests/types-runtime`.

| Verificação final | Node 22.23.4 | Node 24.22.1 |
|---|---:|---:|
| TypeScript completo, incremental desativado | 0 erros, saída 0 | 0 erros, saída 0 |
| Suíte principal | 419/419 | 419/419 |
| Contratos e interface do portal | 87/87 | 87/87 |
| Build estático | saída 0 | saída 0 |

Os 11 novos testes da suíte principal cobrem confirmação de gravação, falha de upload, compensação restrita ao próprio arquivo, preservação após resposta perdida, confirmação indisponível, falha de limpeza e limite de tempo de consultas. Os novos testes DOM cobrem criação/transição de TCC com atualização do BI, falhas HTTP/transporte com recuperação e consultas reais da Vitrine, inclusive exclusão de governança de outro curso e contagem não estimada.

Logs completos compactados e códigos de saída: [evidências](homologacao-20261114/). O build apresenta aviso de chunks grandes; testes legados emitem avisos de `act` e OAuth Manus não configurado. Esses avisos não são evidência de homologação do Supabase remoto. Os dois primeiros problemas de execução dos testes DOM foram corrigidos no próprio teste (seleção do formulário errado e fixture incompleta); a execução final passou integralmente.

Reproduzir após compor a fonte e instalar pelo lockfile:

```sh
npm run check -- --incremental false --pretty false
npm test
./node_modules/.bin/vitest run --config scripts/portal-types.vitest.config.ts
npm run build:static
```

Copiar a configuração DOM de `scripts/portal-types.vitest.config.ts` para `scripts/` da composição e disponibilizar `jsdom`, como no workflow `verify-portal-types.yml`.

## Bloqueios operacionais ainda existentes

A última chamada de controle (2026-11-14T12:25:53Z), `GET vertice_courses?select=id&limit=0`, respondeu **503 / PGRST002**. A evidência está em `homologacao-20261114/api-control.json`. A conexão SQL administrativa funciona. Os logs do PostgREST registram PGRST003, falha ao adquirir conexão do pool, inclusive ao reconstruir o cache. O advisor de saúde observou 100% de falha em 280 requisições na consulta inicial. Isso identifica o sintoma do pool; não comprova a causa-raiz.

A recarga de schema executada na rodada anterior não recuperou o serviço. O conector disponível não oferece reinício do PostgREST nem remoção de arquivos pelo Storage. O acesso ao painel administrativo ficou bloqueado na autenticação Google, que informou alteração recente da senha. **Não foram reiniciados serviços, alteradas credenciais, enfraquecidas permissões ou aplicadas migrações.**

Permanece um PDF estritamente sintético de 1.934 bytes no bucket `vertice-documents`, sem solicitação vinculada:

`ac/a0d3b0de-0000-4000-8000-000000000001/e3af4ebf-1897-494d-951c-952fef31d322/1794655656533.pdf`

Remover apenas esse objeto pela API/UI de Storage após confirmar o acesso administrativo, e verificar sua ausência. Não apagar linhas de `storage.objects` por SQL. O TCC sintético da homologação anterior já foi arquivado, com histórico mantido.

## Antes da homologação integral

1. Concluir login administrativo no Supabase e recuperar o PostgREST/pool pelo controle operacional suportado; verificar leitura e escrita autenticadas na instituição fictícia.
2. Limpar o objeto sintético exato acima.
3. Revisar e aprovar a PR antes de integrar/publicar; registrar a versão estável candidata.
4. Repetir os ciclos reais em FV-DEMO: TCC/BI, AC com comprovante/crédito/extrato, Estágio com concedente/vínculo/relatórios, Vitrine e Raio-X. Confirmar perfis inferiores e isolamento entre instituições. Não certificar esses fluxos com base apenas nos testes simulados.
