-- Automação 360°, passo 3 dos instrumentos: seis regras da família "instrumental" e o leitor de banco.
-- Depende de 20261125150000_instrumentos_catalogos (catálogo do Recredenciamento) e de
-- 20261125160000_avaliacao_registros (estrutura versionada da avaliação simulada).
-- Só leitura agregada por escopo, somente service_role, como os demais leitores. Nenhuma regra nasce validada.
--
-- Escopo de curso: Reconhecimento 2017 (seção "instrumento", catálogo reconhecimento_curso/2017).
-- Escopo de IES:   Recredenciamento 2017 (seção "recredenciamento_2017", catálogo recredenciamento_institucional/2017).
-- Sem catálogo no banco para o escopo, as regras que dependem dele chegam incompletas e se abstêm (diretriz 7).
begin;

alter table vertice_automation.rules drop constraint if exists rules_family_check;
alter table vertice_automation.rules add constraint rules_family_check
  check (family in ('documentary','pedagogical','academic','strategic','planning','cpa','schools','instrumental'));

insert into vertice_automation.rules(id, version, module, priority, cadence, family, source_status) values
  ('instrument.evidence', '2026.11-instrument.1', 'Instrumentos de Avaliação', 'P1', 'weekly', 'instrumental', 'identificada'),
  ('instrument.stalled', '2026.11-instrument.1', 'Instrumentos de Avaliação', 'P1', 'weekly', 'instrumental', 'identificada'),
  ('instrument.uncovered', '2026.11-instrument.1', 'Instrumentos de Avaliação', 'P1', 'weekly', 'instrumental', 'identificada'),
  ('instrument.unbacked', '2026.11-instrument.1', 'Instrumentos de Avaliação', 'P1', 'weekly', 'instrumental', 'identificada'),
  ('instrument.unassigned', '2026.11-instrument.1', 'Instrumentos de Avaliação', 'P2', 'weekly', 'instrumental', 'identificada'),
  ('instrument.milestone', '2026.11-instrument.1', 'Instrumentos de Avaliação', 'P1', 'monthly', 'instrumental', 'identificada');

create or replace function public.vertice_automation_source_instrumental(p_institution uuid, p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_now timestamptz := date_trunc('second', now()); v_iso text;
  v_section text := case when p_course is null then 'recredenciamento_2017' else 'instrumento' end;
  v_code text := case when p_course is null then 'recredenciamento_institucional' else 'reconhecimento_curso' end;
  v_cat uuid; v_tz text; v_year int; v_entries jsonb := '[]'::jsonb; v_scope text := coalesce(p_course::text, 'ies');
  v_catalog text[]; v_requested text[]; v_covered text[]; v_validated text[];
  v_stalled int; v_stalled_rev text; v_unbacked int; v_unbacked_rev text; v_unassigned int; v_unassigned_rev text;
  v_overdue int; v_overdue_rev text;
  base jsonb;
begin
  if not (auth.role() = 'service_role') then raise exception 'acesso negado' using errcode = '42501'; end if;
  if p_course is not null and not exists (select 1 from public.vertice_courses c where c.id = p_course and c.institution_id = p_institution) then
    raise exception 'curso fora da instituição' using errcode = '42501';
  end if;
  v_iso := to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  base := jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'observedAt', v_iso, 'status', 'open');

  select c.id into v_cat from public.vertice_instrument_catalog c
   where c.institution_id = p_institution and c.instrument_code = v_code and c.instrument_version = '2017';

  -- Códigos do catálogo e códigos citados nas solicitações ativas do escopo (o campo indicator é uma lista
  -- separada por vírgula; código fora do catálogo é ignorado). Arquivo validado vale para os códigos da sua
  -- solicitação não "não se aplica" e para os códigos com que foi classificado (instrument_indicators).
  if v_cat is not null then
    select coalesce(array_agg(o.object_code order by o.object_code), '{}') into v_catalog from public.vertice_instrument_objects o where o.catalog_id = v_cat;
    with req as (
      select q.id, q.not_applicable, trim(x) code from public.vertice_repository_requests q
      cross join lateral unnest(string_to_array(coalesce(q.indicator, ''), ',')) x
      where q.institution_id = p_institution and q.course_id is not distinct from p_course
        and q.repository_section = v_section and coalesce(q.active, true)
    ), ok as (
      select r.code from req r where not coalesce(r.not_applicable, false)
        and exists (select 1 from public.vertice_repository_files f where f.request_id = r.id and f.institution_id = p_institution and f.status = 'validado')
      union
      select unnest(f.instrument_indicators) from public.vertice_repository_files f
      join public.vertice_repository_requests q on q.id = f.request_id
      where f.institution_id = p_institution and f.status = 'validado' and q.institution_id = p_institution
        and q.course_id is not distinct from p_course and q.repository_section = v_section and coalesce(q.active, true) and not coalesce(q.not_applicable, false)
    )
    select coalesce(array_agg(distinct code order by code) filter (where code = any(v_catalog) and not coalesce(not_applicable, false)), '{}'),
           coalesce(array_agg(distinct code order by code) filter (where code = any(v_catalog)), '{}'),
           coalesce((select array_agg(distinct ok.code order by ok.code) from ok where ok.code = any(v_catalog)), '{}')
      into v_requested, v_covered, v_validated from req;

    v_entries := v_entries
      || (base || jsonb_build_object('module', 'evidence', 'id', 'evidence:' || v_scope, 'complete', true,
           'definitionVersion', 'evidence-validated-v1', 'catalogCode', v_code, 'catalogVersion', '2017',
           'revision', left(md5(array_to_string(v_requested, ',') || '|' || array_to_string(v_validated, ',')), 32),
           'metrics', jsonb_build_object('indicatorsWithoutEvidence',
             (select count(*) from unnest(v_requested) c where not c = any(v_validated)))))
      || (base || jsonb_build_object('module', 'uncovered', 'id', 'uncovered:' || v_scope, 'complete', true,
           'definitionVersion', 'uncovered-v1', 'catalogCode', v_code, 'catalogVersion', '2017',
           'revision', left(md5(array_to_string(v_covered, ',')), 32),
           'metrics', jsonb_build_object('uncoveredIndicators', (select count(*) from unnest(v_catalog) c where not c = any(v_covered)))));
  else
    v_entries := v_entries
      || (base || jsonb_build_object('module', 'evidence', 'id', 'evidence:' || v_scope, 'revision', 'sem-catalogo', 'complete', false, 'reason', 'catalog_missing'))
      || (base || jsonb_build_object('module', 'uncovered', 'id', 'uncovered:' || v_scope, 'revision', 'sem-catalogo', 'complete', false, 'reason', 'catalog_missing'));
  end if;

  -- Arquivos enviados há 15 dias ou mais sem validação, nas solicitações do instrumento no escopo.
  select count(*), left(md5(coalesce(string_agg(f.id::text, ',' order by f.id), '')), 32) into v_stalled, v_stalled_rev
  from public.vertice_repository_files f join public.vertice_repository_requests q on q.id = f.request_id
  where f.institution_id = p_institution and q.institution_id = p_institution and q.course_id is not distinct from p_course
    and q.repository_section = v_section and coalesce(q.active, true) and f.status = 'enviado' and f.created_at <= v_now - interval '15 days';
  v_entries := v_entries || (base || jsonb_build_object('module', 'stalled', 'id', 'stalled:' || v_scope, 'complete', true,
    'definitionVersion', 'stalled-15d-v1', 'revision', v_stalled_rev, 'metrics', jsonb_build_object('stalledFiles', v_stalled)));

  -- Conceito simulado (decisão humana registrada) 3 ou mais sem evidência validada no indicador. Só curso.
  if p_course is null then
    v_entries := v_entries || (base || jsonb_build_object('module', 'unbacked', 'id', 'unbacked:ies', 'revision', 'nao-se-aplica', 'applicable', false));
  elsif v_cat is null then
    v_entries := v_entries || (base || jsonb_build_object('module', 'unbacked', 'id', 'unbacked:' || v_scope, 'revision', 'sem-catalogo', 'complete', false, 'reason', 'catalog_missing'));
  else
    select count(*), left(md5(coalesce(string_agg(s.indicador || ':' || s.conceito_atual, ',' order by s.indicador), '') || '|' || array_to_string(v_validated, ',')), 32)
      into v_unbacked, v_unbacked_rev
    from public.vertice_avaliacao_simulada s
    where s.institution_id = p_institution and s.course_id = p_course and s.conceito_atual >= 3
      and s.indicador = any(v_catalog) and not s.indicador = any(v_validated);
    v_entries := v_entries || (base || jsonb_build_object('module', 'unbacked', 'id', 'unbacked:' || v_scope, 'status', 'validated', 'complete', true,
      'definitionVersion', 'unbacked-v1', 'catalogCode', v_code, 'catalogVersion', '2017', 'revision', v_unbacked_rev,
      'metrics', jsonb_build_object('unbackedConcepts', v_unbacked)));
  end if;

  -- Checklist do Novo Instrumento: itens não conformes ou parciais sem responsável.
  select count(*), left(md5(coalesce(string_agg(c.id::text || ':' || c.status, ',' order by c.id), '')), 32) into v_unassigned, v_unassigned_rev
  from public.vertice_instrumento_checklist c
  where c.institution_id = p_institution and c.course_id is not distinct from p_course
    and c.status in ('nao_conforme', 'parcial') and coalesce(trim(c.responsible), '') = '';
  v_entries := v_entries || (base || jsonb_build_object('module', 'unassigned', 'id', 'unassigned:' || v_scope, 'complete', true,
    'definitionVersion', 'unassigned-v1', 'revision', v_unassigned_rev, 'metrics', jsonb_build_object('unassignedItems', v_unassigned)));

  -- Ciclo avaliativo (só IES): marcos não concluídos com ano-alvo anterior ao ano corrente no fuso da IES.
  if p_course is not null then
    v_entries := v_entries || (base || jsonb_build_object('module', 'milestone', 'id', 'milestone:' || v_scope, 'revision', 'nao-se-aplica', 'applicable', false));
  else
    select case upper(coalesce(i.state, ''))
        when 'TO' then 'America/Araguaina' when 'PA' then 'America/Belem' when 'AP' then 'America/Belem'
        when 'MA' then 'America/Fortaleza' when 'PI' then 'America/Fortaleza' when 'CE' then 'America/Fortaleza'
        when 'RN' then 'America/Fortaleza' when 'PB' then 'America/Fortaleza' when 'PE' then 'America/Recife'
        when 'AL' then 'America/Maceio' when 'SE' then 'America/Maceio' when 'BA' then 'America/Bahia'
        when 'MT' then 'America/Cuiaba' when 'MS' then 'America/Campo_Grande' when 'RO' then 'America/Porto_Velho'
        when 'RR' then 'America/Boa_Vista' when 'AM' then 'America/Manaus' when 'AC' then 'America/Rio_Branco'
        else 'America/Sao_Paulo' end into v_tz
    from public.vertice_institutions i where i.id = p_institution;
    v_year := extract(year from v_now at time zone coalesce(v_tz, 'America/Sao_Paulo'))::int;
    select count(*) filter (where m.status <> 'concluido' and m.target_year < v_year),
           left(md5(coalesce(string_agg(m.id::text || ':' || m.status || ':' || m.target_year, ',' order by m.id), '') || '|' || v_year), 32)
      into v_overdue, v_overdue_rev
    from public.vertice_instrumento_ciclo m where m.institution_id = p_institution;
    v_entries := v_entries || (base || jsonb_build_object('module', 'milestone', 'id', 'milestone:ies', 'complete', true,
      'definitionVersion', 'milestone-year-v1', 'revision', v_overdue_rev, 'metrics', jsonb_build_object('overdueMilestones', v_overdue)));
  end if;

  return jsonb_build_object('institutionId', p_institution, 'courseId', p_course, 'id', 'instrumental-v1', 'observedAt', v_iso, 'complete', true, 'entries', v_entries);
end $$;

revoke all on function public.vertice_automation_source_instrumental(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vertice_automation_source_instrumental(uuid, uuid) to service_role;
commit;
