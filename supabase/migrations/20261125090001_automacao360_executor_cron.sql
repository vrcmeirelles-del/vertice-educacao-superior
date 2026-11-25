-- Automação 360° — rotina diária do executor em modo sombra (05h43 em Brasília, 08h43 UTC).
-- Reutiliza o segredo de rotina existente (vault: espelho_cron_secret, conferido por
-- public.vertice_espelho_cron_ok na função). Sem chave no repositório.
-- Reversão: select cron.unschedule('vertice-automacao360-daily');
begin;
select cron.unschedule(jobid) from cron.job where jobname = 'vertice-automacao360-daily';
select cron.schedule('vertice-automacao360-daily', '43 8 * * *', $cron$
select net.http_post(
  url := 'https://qvetbbmviatxxatzzuzc.supabase.co/functions/v1/vertice-automacao360-run',
  headers := jsonb_build_object('Content-Type','application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'espelho_cron_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 150000);
$cron$);
commit;
