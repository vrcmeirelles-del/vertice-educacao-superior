# Automação do acompanhamento — candidata para aprovação

Código preparado na mesma Vértice, em /integracao. Esta candidata não foi implantada: nenhuma migração, configuração de cron ou publicação foi aplicada em produção.

## Funcionamento proposto

- Página visível: consulta da IES selecionada a cada cinco minutos e consulta de versões públicas a cada quinze minutos. Pausa quando a página está oculta.
- Página fechada: coleta SQL nativa por pg_cron, de hora em hora, com uma observação técnica por IES/hora e retenção de 90 dias.
- Reutiliza tabelas existentes da ponte e Sapiens. Não sincroniza a ponte, importa alunos, recalcula notas, aprova intervenções ou altera metas.
- Mostra ausência de eventos, vínculos ou grupos comparáveis; falha ou longa duração de execução; fonte sem atualização; metas vencidas; limite de amostra; e estado real do agendamento.
- Nenhuma observação promove a matriz para integrado, funcional ou homologado. As decisões humanas continuam independentes.

## Escopo e proteção

Somente Master com MFA aal2 lê o contrato, com verificação na interface, na função SQL e na política RLS. Anônimo, usuário comum e Master sem MFA não recebem as observações.

Instituições fictícias, demonstrativas e escolas são excluídas da observação do ensino superior. O contrato não retorna nomes/identificadores de alunos, contatos, documentos ou notas. Contagens abaixo de cinco são mostradas em faixa. A amostra recente cobre sete dias, limitada a 10 mil eventos, sem ser apresentada como total. Participantes de grupos não são somados como alunos únicos.

OAB genérico não confirma a fase; OAB 2ª fase continua com contrato específico não confirmado. Dados operacionais não alimentam cenários fictícios. Registros manuais continuam no navegador/exportação; somente observações técnicas passam a ter histórico no banco após ativação. Esse histórico não é auditoria imutável.

Não há credencial nova, contratação de serviço ou nova Edge Function. O cron executa uma função SQL no banco existente, sem copiar segredos ou depender de conversa aberta. As versões públicas são consultadas com a página aberta; o cron não consulta GitHub/Render em segundo plano.

## Investigação em 14/11/2026

Consultas somente de leitura confirmaram tabelas da ponte/Sapiens, extensões pg_cron/pg_net e funções Sapiens ativas. Indicadores: zero grupos e zero grupos comparáveis. Não foram encontrados jobs com nomes Sapiens, learning ou integração. Isso não exclui rotina de nome diferente ou agendamento em outra plataforma, nem comprova execução das funções ativas.

O sincronizador Sapiens não foi chamado: pode gravar auditoria e disparar análise. Presença de código ou função ativa não foi tratada como integração operacional.

## Validação da candidata

- 11 testes locais em PostgreSQL embutido/PGlite, somente com dados sintéticos: RLS, negativas de acesso, idempotência, filtros, alertas, leitura sem gravação e retenção.
- 25 testes específicos de interface/contrato, incluídos na suíte ampliada de 105 testes que passou.
- TypeScript sem diagnósticos. Build estático e resultados finais de CI devem ser conferidos na PR antes da ativação.
- A RPC e o cron de produção ainda não foram instalados. A primeira execução real após autorização precisa ser verificada.

## Aprovação solicitada

Autorizar estes passos, nesta ordem:

1. Aplicar `20261115010939_integration_observations.sql`: tabela de observações técnicas, índice por data de ingestão e funções protegidas de agregação, leitura e coleta.
2. Executar `ATIVAR_COLETA_APOS_APROVACAO.sql`: registrar `vertice-integration-observe-hourly`, expressão `0 * * * *`, e fazer a primeira coleta. Uma rotina homônima com outro comando ou horário interrompe a ativação para revisão.
3. Integrar a candidata aprovada e publicá-la no mesmo serviço Render, preservando Master/MFA.
4. Conferir primeira observação, agendamento, execução e interface autenticada; registrar pendências sem presumir sucesso.

A retenção exclui apenas observações técnicas com mais de 90 dias. Não exclui alunos, notas, eventos, metas, intervenções ou documentos.

## Pausa e reversão

Após autorização, pausar somente o job específico com cron.unschedule, mantendo o histórico. Reverter a interface pelo commit específico, preservando alterações concorrentes. Não apagar tabela/histórico ou alterar chaves para pausar. Remoções fora da retenção acima exigem decisão própria.

Esta etapa automatiza observação técnica e histórico. Não cria vínculos acadêmicos ausentes nem a linha do tempo individual real. CPA, egressos, TCC, AC, estágio e demais módulos continuam exigindo seus testes específicos.
