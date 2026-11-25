-- Automação 360° — leitura das configurações vigentes para o executor (somente service_role).
-- Devolve, por escopo, a maior revisão aprovada, desde que ativada. Revisões pendentes ou
-- desativadas não entram. O fuso vem da UF da IES (padrão America/Sao_Paulo).
begin;
create or replace function public.vertice_automation_due_configs()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'configId', c.id, 'institutionId', c.institution_id, 'courseId', c.course_id, 'revision', c.revision,
      'mode', c.mode, 'ruleIds', to_jsonb(c.rule_ids), 'maxAgeHours', c.max_age_hours,
      'timeZone', case upper(coalesce(i.state, ''))
        when 'TO' then 'America/Araguaina' when 'PA' then 'America/Belem' when 'AP' then 'America/Belem'
        when 'MA' then 'America/Fortaleza' when 'PI' then 'America/Fortaleza' when 'CE' then 'America/Fortaleza'
        when 'RN' then 'America/Fortaleza' when 'PB' then 'America/Fortaleza' when 'PE' then 'America/Recife'
        when 'AL' then 'America/Maceio' when 'SE' then 'America/Maceio' when 'BA' then 'America/Bahia'
        when 'MT' then 'America/Cuiaba' when 'MS' then 'America/Campo_Grande' when 'RO' then 'America/Porto_Velho'
        when 'RR' then 'America/Boa_Vista' when 'AM' then 'America/Manaus' when 'AC' then 'America/Rio_Branco'
        else 'America/Sao_Paulo' end)
    order by c.institution_id, c.course_id nulls first), '[]'::jsonb)
  from (
    select distinct on (x.institution_id, x.course_id) x.*
    from vertice_automation.config_revision x
    where x.approved_by is not null
    order by x.institution_id, x.course_id, x.revision desc
  ) c
  join public.vertice_institutions i on i.id = c.institution_id
  where c.enabled and array_length(c.rule_ids, 1) is not null
$$;
revoke all on function public.vertice_automation_due_configs() from public, anon, authenticated;
grant execute on function public.vertice_automation_due_configs() to service_role;
commit;
