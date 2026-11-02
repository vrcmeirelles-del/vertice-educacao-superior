
create or replace function vertice_private.ai_management_snapshot(inst uuid, course uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with goals as (
 select g.id,g.title,g.indicator,g.status,g.unit,g.direction,g.baseline,g.target,g.due_date
 from public.vertice_goals g where g.institution_id=inst and g.course_id=course and g.status<>'cancelada'
), latest as (
 select distinct on(f.request_id) f.request_id,f.status,f.document_category
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id
 where f.institution_id=inst and r.institution_id=inst and r.course_id=course and r.active
 order by f.request_id,f.created_at desc,f.id desc
), evidence as (
 select r.id,r.goal_id,r.indicator,r.semester,
 case when r.not_applicable then 'NSA declarado: revisar aplicabilidade' when l.request_id is null then 'nao_enviado'
 when coalesce(l.document_category,'instrumento')<>'instrumento' then 'reclassificar' else l.status end as state
 from public.vertice_repository_requests r left join latest l on l.request_id=r.id
 where r.institution_id=inst and r.course_id=course and r.active and coalesce(r.repository_section,'instrumento')='instrumento'
), goal_rows as (
 select g.id,jsonb_build_object(
 'meta',left(g.title,300),'indicador_da_meta',left(g.indicator,200),'situacao',g.status,'unidade',left(g.unit,50),
 'direcao',g.direction,'linha_de_base',g.baseline,'alvo',g.target,'prazo',g.due_date,
 'ultima_medicao',(select jsonb_build_object('valor',m.value,'data',m.measured_on) from public.vertice_goal_measurements m where m.institution_id=inst and m.goal_id=g.id and m.value is not null order by m.measured_on desc,m.created_at desc,m.id desc limit 1),
 'acoes',(select jsonb_build_object('total',count(*),'atrasadas',count(*) filter(where a.due_date<current_date and a.status not in ('concluida','cancelada')),'concluidas',count(*) filter(where a.status='concluida')) from public.vertice_actions a where a.institution_id=inst and a.course_id=course and a.goal_id=g.id and a.status<>'cancelada'),
 'documentos',(select coalesce(jsonb_object_agg(s.state,s.n),'{}'::jsonb) from (select e.state,count(*) as n from evidence e where e.goal_id=g.id group by e.state)s)
 ) as item from goals g order by g.id limit 50
), indicator_rows as (
 select left(e.indicator,200) as indicador,e.semester,e.state,count(*) as quantidade from evidence e group by e.indicator,e.semester,e.state order by e.indicator,e.semester,e.state limit 300
)
select jsonb_build_object(
 'data_referencia',current_date,'periodo_documental','Todos os periodos cadastrados, separados por semestre',
 'total_metas',(select count(*) from goals),'limite_metas',50,
 'metas',coalesce((select jsonb_agg(item order by id) from goal_rows),'[]'::jsonb),
 'indicadores',coalesce((select jsonb_agg(to_jsonb(i) order by indicador,semester,state) from indicator_rows i),'[]'::jsonb),
 'limite_grupos_indicadores',300,
 'limites','Registros administrativos e situacoes documentais nao comprovam atendimento ao INEP/MEC. Ausencia de medicao nao e resultado zero. NSA requer revisao. Nao foram lidos PDFs ou Word. Nomes de responsaveis, emails, observacoes livres e notas regulatórias nao integram este resumo.'
);
$$;
revoke all on function vertice_private.ai_management_snapshot(uuid,uuid) from public,anon,authenticated;
create or replace function public.vertice_ai_management_snapshot(inst uuid, course uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not vertice_private.ai_current_scope(inst,course) then raise exception 'analysis scope denied' using errcode='42501';end if;
 return vertice_private.ai_management_snapshot(inst,course);
end;$$;
revoke all on function public.vertice_ai_management_snapshot(uuid,uuid) from public,anon;
grant execute on function public.vertice_ai_management_snapshot(uuid,uuid) to authenticated;

