# Reconciliação das rotinas agendadas — 24/11/2026

Fonte: `cron.job` e `cron.job_run_details` do projeto de produção, consulta somente leitura em 24/11/2026 (janela de 7 dias). "Efeito confirmado" exige verificar o dado produzido, não só o status do job; isso **não** foi feito aqui.

| Job | Agenda (UTC) | Comando | Agendado | Ativo | Iniciado (7d) | Concluído com sucesso | Persistido | Efeito confirmado | Relação com a Automação 360° |
|---|---|---|---|---|---|---|---|---|---|
| vertice-billing-daily | `0 6 * * *` | `billing_daily_cron()` | sim | sim | 7 | 7/7 | não verificado | não verificado | nenhuma regra; não duplicar faturamento |
| vertice-conexoes-sync-semanal | `0 6 * * 1` | Edge `vertice-conexao` | sim | sim | 1 | 1/1 | não verificado | não verificado | nenhuma |
| vertice-integration-observe-hourly | `0 * * * *` | `vertice_private.capture_integration_observations()` | sim | sim | 168 | 168/168 | não verificado | não verificado | fonte de `readIntegrationHealth` (Bloco 07), só leitura |
| vertice-market-public-discovery-daily | `0 6 * * *` | `vertice_market.enqueue_collection()` | sim | sim | 7 | 7/7 | não verificado | não verificado | fonte potencial das regras de mercado (pendentes) |
| vertice-onedrive-docs-unitop-semanal | `30 6 * * 1` | Edge `vertice-onedrive-documentos` | sim | sim | 1 | 1/1 | não verificado | não verificado | alimenta o Repositório (fonte das regras `repo.*`) |
| vertice-onedrive-docs-unicaldas-semanal | `45 6 * * 1` | Edge `vertice-onedrive-documentos` | sim | sim | 1 | 1/1 | não verificado | não verificado | idem, outra IES |
| vertice-onedrive-espelho-semanal | `30 7 * * 1` | Edge `vertice-onedrive-espelho` | sim | sim | 1 | 1/1 | não verificado | não verificado | nenhuma |
| vertice-pei-alerts-daily | `40 5 * * *` | `vertice_private.pei_alerts_daily()` | sim | sim | 4 | 4/4 | não verificado | não verificado | **homônimo**: Plano Educacional Individualizado, não é fonte de `pei.overdue` (Planejamento Estratégico) |
| vertice-security-gate-daily | `17 9 * * *` | `vertice_private.security_gate_run('cron-diario')` | sim | sim | 7 | 7/7 | não verificado | não verificado | nenhuma |

Conclusões:
- Os 9 jobs estão agendados, ativos e sem falha em 7 dias. `vertice-pei-alerts-daily` tem só 4 execuções: [Inferência] foi criado há cerca de 4 dias (migração `20261120200000`).
- A Automação 360° **não criou job** nem worker. Uma execução sombra agendada exigiria um novo job (`record_run` via `service_role`), que só pode ser criado com autorização expressa. Até lá, as execuções sombra são manuais e sintéticas.
- Nenhum job existente é duplicado pelas 40 regras.
