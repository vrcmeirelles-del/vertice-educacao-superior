-- Shared by every institution. Access remains in ai_current_scope and caller RLS.
create or replace function vertice_private.ai_dimension(value text)
returns text language sql immutable set search_path='' as $$
select case
 when (select count(distinct m[1]) from regexp_matches(coalesce(value,''),'(?:^|[^0-9.])([123])\.[0-9]+','g') m)>1 then 'Sem dimensão identificada'
 when value ~* '(^|[^[:alnum:]])(D1|dimensão 1|dimensao 1)([^0-9]|$)' or value ~ '(^|[^0-9.])1\.[0-9]+' or value ilike '%Organização didático-pedagógica%' then 'Organização didático-pedagógica'
 when value ~* '(^|[^[:alnum:]])(D2|dimensão 2|dimensao 2)([^0-9]|$)' or value ~ '(^|[^0-9.])2\.[0-9]+' or value ilike '%Corpo docente e tutorial%' then 'Corpo docente e tutorial'
 when value ~* '(^|[^[:alnum:]])(D3|dimensão 3|dimensao 3)([^0-9]|$)' or value ~ '(^|[^0-9.])3\.[0-9]+' or value ilike '%Infraestrutura%' then 'Infraestrutura'
 when value in ('Gestão e governança','Captação e ingresso','Permanência e êxito','Sustentabilidade financeira','Avaliação e regulação') then value
 else 'Sem dimensão identificada' end;
$$;
revoke all on function vertice_private.ai_dimension(text) from public,anon,authenticated;

create or replace function vertice_private.ai_management_snapshot(inst uuid, course uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with reference as (select (now() at time zone 'America/Sao_Paulo')::date as today),
goals as (
 select g.*,case when vertice_private.ai_dimension(g.indicator)='Sem dimensão identificada'
 then vertice_private.ai_dimension(g.title) else vertice_private.ai_dimension(g.indicator) end as dimension,
 (select jsonb_build_object('valor',m.value,'data',m.measured_on) from public.vertice_goal_measurements m
 where m.institution_id=inst and m.goal_id=g.id and m.value is not null and m.measured_on<=(select today from reference)
 order by m.measured_on desc,m.created_at desc,m.id desc limit 1) as measurement
 from public.vertice_goals g where g.institution_id=inst and g.course_id=course and g.status<>'cancelada'
), latest as (
 select distinct on(f.request_id) f.request_id,f.status,f.document_category
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id
 where f.institution_id=inst and r.institution_id=inst and r.course_id=course and r.active
 order by f.request_id,f.created_at desc,f.id desc
), evidence as (
 select r.id,r.goal_id,r.indicator,r.semester,r.due_date,vertice_private.ai_dimension(r.indicator) as dimension,
 case when r.not_applicable then 'nsa' when l.request_id is null then 'nao_enviado'
 when coalesce(l.document_category,'instrumento')<>'instrumento' then 'reclassificar' else l.status end as state
 from public.vertice_repository_requests r left join latest l on l.request_id=r.id
 where r.institution_id=inst and r.course_id=course and r.active and coalesce(r.repository_section,'instrumento')='instrumento'
), findings as (
 select d.id,d.status,d.priority,vertice_private.ai_dimension(d.dimension) as dimension
 from public.vertice_diagnosis_items d where d.institution_id=inst and d.course_id=course
), actions as (
 select a.*,coalesce(g.dimension,f.dimension,'Sem dimensão identificada') as dimension
 from public.vertice_actions a left join goals g on g.id=a.goal_id left join findings f on f.id=a.finding_id
 where a.institution_id=inst and a.course_id=course and a.status<>'cancelada'
), dimensions as (
 select unnest(array['Organização didático-pedagógica','Corpo docente e tutorial','Infraestrutura','Gestão e governança','Captação e ingresso','Permanência e êxito','Sustentabilidade financeira','Avaliação e regulação','Sem dimensão identificada']) as name
), dimension_rows as (
 select name,jsonb_build_object('dimensao',name,
 'exigencias',(select count(*) from evidence e where e.dimension=name and e.state<>'nsa'),
 'validados',(select count(*) from evidence e where e.dimension=name and e.state='validado'),
 'sem_envio',(select count(*) from evidence e where e.dimension=name and e.state='nao_enviado'),
 'em_revisao',(select count(*) from evidence e where e.dimension=name and e.state in ('enviado','pendente')),
 'devolvidos',(select count(*) from evidence e where e.dimension=name and e.state='devolvido'),
 'reclassificar',(select count(*) from evidence e where e.dimension=name and e.state='reclassificar'),
 'nsa',(select count(*) from evidence e where e.dimension=name and e.state='nsa'),
 'documentos_atrasados',(select count(*) from evidence e where e.dimension=name and e.state not in ('nsa','validado') and e.due_date<(select today from reference)),
 'documentos_sem_meta',(select count(*) from evidence e where e.dimension=name and e.state<>'nsa' and not exists(select 1 from goals g where g.id=e.goal_id)),
 'metas',(select count(*) from goals g where g.dimension=name),
 'metas_sem_medicao',(select count(*) from goals g where g.dimension=name and g.measurement is null),
 'metas_sem_acao',(select count(*) from goals g where g.dimension=name and not exists(select 1 from actions a where a.goal_id=g.id)),
 'acoes',(select count(*) from actions a where a.dimension=name),
 'acoes_atrasadas',(select count(*) from actions a where a.dimension=name and a.status<>'concluida' and a.due_date<(select today from reference)),
 'achados_abertos',(select count(*) from findings f where f.dimension=name and f.status<>'resolvido'),
 'achados_prioritarios',(select count(*) from findings f where f.dimension=name and f.status<>'resolvido' and f.priority='alta')
 ) as item from dimensions
), goal_rows as (
 select g.id,g.dimension,jsonb_build_object('dimensao',g.dimension,
 'meta',left(g.title,300),'indicador_da_meta',left(g.indicator,200),'situacao',g.status,'unidade',left(g.unit,50),
 'direcao',g.direction,'linha_de_base',g.baseline,'alvo',g.target,'prazo',g.due_date,'ultima_medicao',g.measurement,
 'acoes',(select jsonb_build_object('total',count(*),'atrasadas',count(*) filter(where a.due_date<(select today from reference) and a.status<>'concluida'),'concluidas',count(*) filter(where a.status='concluida')) from actions a where a.goal_id=g.id),
 'documentos',(select coalesce(jsonb_object_agg(s.state,s.n),'{}'::jsonb) from (select e.state,count(*) as n from evidence e where e.goal_id=g.id group by e.state)s)
 ) as item from goals g order by g.dimension,g.id limit 50
), indicator_rows as (
 select left(e.indicator,200) as indicador,e.semester,e.state,count(*) as quantidade from evidence e
 group by e.indicator,e.semester,e.state order by e.indicator,e.semester,e.state limit 300
)
select jsonb_build_object('data_referencia',(select today from reference),
 'periodo_documental','Todos os períodos cadastrados; detalhamento separado por semestre.',
 'total_metas',(select count(*) from goals),'limite_metas',50,
 'dimensoes',(select jsonb_agg(item order by name) from dimension_rows),
 'apoio_e_diversos',(select count(*) from public.vertice_repository_requests r where r.institution_id=inst and r.course_id=course and r.active and coalesce(r.repository_section,'instrumento')<>'instrumento'),
 'achados_institucionais',(select count(*) from public.vertice_diagnosis_items d where d.institution_id=inst and d.course_id is null and d.status<>'resolvido'),
 'metas',coalesce((select jsonb_agg(item order by dimension,id) from goal_rows),'[]'::jsonb),
 'indicadores',coalesce((select jsonb_agg(to_jsonb(i) order by indicador,semester,state) from indicator_rows i),'[]'::jsonb),
 'total_grupos_indicadores',(select count(*) from (select 1 from evidence group by indicator,semester,state)s),'limite_grupos_indicadores',300,
 'limites','Panorama cadastral do curso, não avaliação oficial INEP/MEC. Ausência de medição não é zero; medições futuras não contam. NSA declarado exige revisão de aplicabilidade. Conteúdo de PDF, Word e planilhas não foi lido. Apoio e documentos diversos não contam como evidências do instrumento. Achados institucionais são contexto separado. Nomes, contatos, notas regulatórias e observações livres não integram este resumo.'
);
$$;
revoke all on function vertice_private.ai_management_snapshot(uuid,uuid) from public,anon,authenticated;
