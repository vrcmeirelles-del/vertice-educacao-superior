-- EXECUTAR SOMENTE DEPOIS DA APROVAÇÃO EXPLÍCITA DO PROPRIETÁRIO.
-- Pré-requisito: migração 20261115010939_integration_observations.sql validada e aplicada.
-- Nenhum segredo, Edge Function ou credencial é criado/duplicado.
begin;
do $$begin
 if exists(select 1 from cron.job where jobname='vertice-integration-observe-hourly' and (command<>'select vertice_private.capture_integration_observations();' or schedule<>'0 * * * *')) then
  raise exception 'Já existe rotina homônima com configuração diferente; revisar antes de substituir';
 end if;
end$$;
select cron.schedule('vertice-integration-observe-hourly','0 * * * *',
 'select vertice_private.capture_integration_observations();');
select vertice_private.capture_integration_observations();
commit;
-- Conferir: SELECT jobid,jobname,schedule,active FROM cron.job
-- WHERE jobname='vertice-integration-observe-hourly';
-- Pausar (exige aprovação): SELECT cron.unschedule('vertice-integration-observe-hourly');
-- Não apagar histórico nem reverter dados acadêmicos para pausar a coleta.
