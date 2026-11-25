-- Metas e indicadores: medição automática das metas de checklist e integridade dos vínculos com metas.
--
-- 1. Medição por algoritmo (regra meta-checklist-v1), sem IA.
--    Vale só para metas cuja fórmula é a do checklist de instrumento:
--      "100 × itens aplicáveis concluídos e conferidos ÷ total de itens aplicáveis".
--    Itens aplicáveis = solicitações documentais ativas da meta, fora as marcadas "não se aplica".
--    Concluído e conferido = solicitação com ao menos um arquivo validado pela gestão.
--    Sem item aplicável a meta não é medida (ausência não vira zero). Grava medição nova só quando o
--    valor muda; medição lançada por pessoa nunca é alterada; na mesma data, a medição do algoritmo é
--    atualizada em vez de duplicada. Linha de base e alvo continuam decisão humana.
--    Rotina diária vertice-metas-medicao-diaria (pg_cron), só o banco executa.
-- 2. Índices nas três chaves de meta sem índice e chave estrangeira nos campos de meta que não tinham.
--    Em 25/11/2026 nenhum desses campos tem valor órfão; os planos de extensão (lista de metas) passam a
--    ser conferidos por gatilho, inclusive a instituição.
begin;

-- ------------------------------------------------------------------ 1
create or replace function vertice_private.goal_measure_checklist(p_institution uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r record; v_tz text; v_day date; v_last record; v_today_id uuid; v_source text;
  v_medidas int := 0; v_atualizadas int := 0; v_iguais int := 0; v_sem_itens int := 0;
begin
  for r in
    select g.id, g.institution_id, i.state,
      count(q.id) filter (where coalesce(q.active, true) and not coalesce(q.not_applicable, false)) aplicaveis,
      count(q.id) filter (where coalesce(q.active, true) and not coalesce(q.not_applicable, false)
        and exists (select 1 from public.vertice_repository_files f where f.request_id = q.id and f.institution_id = g.institution_id and f.status = 'validado')) concluidos
    from public.vertice_goals g
    join public.vertice_institutions i on i.id = g.institution_id
    left join public.vertice_repository_requests q on q.goal_id = g.id and q.institution_id = g.institution_id
    where g.formula like '100 × itens aplicáveis concluídos e conferidos%'
      and coalesce(g.status, '') not in ('concluida', 'cancelada')
      and (p_institution is null or g.institution_id = p_institution)
    group by g.id, g.institution_id, i.state
  loop
    if r.aplicaveis = 0 then v_sem_itens := v_sem_itens + 1; continue; end if;
    v_tz := case upper(coalesce(r.state, ''))
        when 'TO' then 'America/Araguaina' when 'PA' then 'America/Belem' when 'AP' then 'America/Belem'
        when 'MA' then 'America/Fortaleza' when 'PI' then 'America/Fortaleza' when 'CE' then 'America/Fortaleza'
        when 'RN' then 'America/Fortaleza' when 'PB' then 'America/Fortaleza' when 'PE' then 'America/Recife'
        when 'AL' then 'America/Maceio' when 'SE' then 'America/Maceio' when 'BA' then 'America/Bahia'
        when 'MT' then 'America/Cuiaba' when 'MS' then 'America/Campo_Grande' when 'RO' then 'America/Porto_Velho'
        when 'RR' then 'America/Boa_Vista' when 'AM' then 'America/Manaus' when 'AC' then 'America/Rio_Branco'
        else 'America/Sao_Paulo' end;
    v_day := (now() at time zone v_tz)::date;
    v_source := format('algoritmo meta-checklist-v1: %s de %s itens aplicáveis com documento validado', r.concluidos, r.aplicaveis);
    select m.value into v_last from public.vertice_goal_measurements m where m.goal_id = r.id order by m.measured_on desc, m.created_at desc limit 1;
    if found and v_last.value = round(100.0 * r.concluidos / r.aplicaveis, 2) then v_iguais := v_iguais + 1; continue; end if;
    select m.id into v_today_id from public.vertice_goal_measurements m
     where m.goal_id = r.id and m.measured_on = v_day and m.created_by is null and m.source like 'algoritmo meta-checklist-v1:%' limit 1;
    if v_today_id is not null then
      update public.vertice_goal_measurements set value = round(100.0 * r.concluidos / r.aplicaveis, 2), source = v_source where id = v_today_id;
      v_atualizadas := v_atualizadas + 1;
    else
      insert into public.vertice_goal_measurements(institution_id, goal_id, measured_on, value, source, created_by)
      values (r.institution_id, r.id, v_day, round(100.0 * r.concluidos / r.aplicaveis, 2), v_source, null);
      v_medidas := v_medidas + 1;
    end if;
    v_today_id := null;
  end loop;
  return jsonb_build_object('regra', 'meta-checklist-v1', 'novas', v_medidas, 'atualizadas', v_atualizadas, 'sem_mudanca', v_iguais, 'sem_itens_aplicaveis', v_sem_itens);
end $$;
revoke all on function vertice_private.goal_measure_checklist(uuid) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'vertice-metas-medicao-diaria') then
    perform cron.unschedule('vertice-metas-medicao-diaria');
  end if;
  perform cron.schedule('vertice-metas-medicao-diaria', '37 6 * * *', 'select vertice_private.goal_measure_checklist()');
end $cron$;

-- ------------------------------------------------------------------ 2
create index if not exists vertice_actions_goal_id_idx on public.vertice_actions(goal_id);
create index if not exists partner_proposals_goal_id_idx on vertice_conecta.partner_proposals(goal_id);
create index if not exists objective_goal_links_goal_id_idx on vertice_planning.objective_goal_links(goal_id);

do $fk$ begin
  if not exists (select 1 from pg_constraint where conname = 'vertice_sapiens_action_plans_goal_id_fkey') then
    alter table public.vertice_sapiens_action_plans
      add constraint vertice_sapiens_action_plans_goal_id_fkey foreign key (goal_id) references public.vertice_goals(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trail_actions_goal_id_fkey') then
    alter table vertice_app.trail_actions
      add constraint trail_actions_goal_id_fkey foreign key (goal_id) references public.vertice_goals(id) on delete set null;
  end if;
end $fk$;
create index if not exists vertice_sapiens_action_plans_goal_id_idx on public.vertice_sapiens_action_plans(goal_id);
create index if not exists trail_actions_goal_id_idx on vertice_app.trail_actions(goal_id);

create or replace function vertice_private.check_extension_plan_goals() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from unnest(coalesce(new.goal_ids, '{}'::uuid[])) gid
    where not exists (select 1 from public.vertice_goals g where g.id = gid and g.institution_id = new.institution_id)) then
    raise exception 'meta inexistente ou de outra instituição' using errcode = '23503';
  end if;
  return new;
end $$;
revoke all on function vertice_private.check_extension_plan_goals() from public, anon;
drop trigger if exists vertice_extension_plans_goals on public.vertice_extension_plans;
create trigger vertice_extension_plans_goals before insert or update of goal_ids, institution_id on public.vertice_extension_plans
  for each row execute function vertice_private.check_extension_plan_goals();

commit;
