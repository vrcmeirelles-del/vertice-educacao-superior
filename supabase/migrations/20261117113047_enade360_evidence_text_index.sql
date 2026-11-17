-- Additive persistence. Existing files, manual classifications, RLS and grants preserved.
alter table public.vertice_doc_prevalidation
 add column extracted_text text,
 add column extracted_pages jsonb not null default '[]'::jsonb,
 add column source_sha256 text check(source_sha256 is null or source_sha256 ~ '^[a-f0-9]{64}$'),
 add column extraction_method text,
 add column extraction_status text not null default 'pending' check(extraction_status in ('pending','ready','partial','failed')),
 add column extracted_at timestamptz,
 add column keyword_suggestions text[] not null default '{}',
 add column extraction_metadata jsonb not null default '{}';
create index enade360_evidence_text_idx on public.vertice_doc_prevalidation using gin(to_tsvector('portuguese',coalesce(extracted_text,'')));
create index enade360_evidence_file_version_idx on public.vertice_doc_prevalidation(institution_id,repository_file_id,extracted_at desc) where extraction_status in ('ready','partial');
create function public.vertice_evidence_can_manage(p_institution_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and coalesce((select auth.jwt()->>'aal'),'')='aal2'
 and vertice_private.can_read_institution(p_institution_id)
 and (vertice_private.is_master() or vertice_private.has_role(p_institution_id,array['gestor','reitor','diretor_geral','diretor_pedagogico','procurador']));
$$;
revoke all on function public.vertice_evidence_can_manage(uuid) from public,anon;
grant execute on function public.vertice_evidence_can_manage(uuid) to authenticated;
create function public.vertice_evidence_search(p_institution_id uuid,p_course_id uuid default null,p_query text default '',p_include_institution boolean default false,p_limit integer default 30)
returns table(source_table text,source_id uuid,course_id uuid,title text,category text,indicators text[],request_id uuid,goal_id uuid,text_status text,source_sha256 text,excerpt text,keyword_suggestions text[],approved_links jsonb)
language sql stable security invoker set search_path='' as $$
 with sources as (
 select 'vertice_repository_files'::text as source_table,f.id as source_id,r.course_id,f.file_name as title,f.document_category as category,
 coalesce(f.instrument_indicators,'{}') as indicators,r.id as request_id,r.goal_id,
 coalesce(pv.extraction_status,'pending') as text_status,pv.source_sha256,pv.extracted_text,
 coalesce(pv.keyword_suggestions,'{}') as keyword_suggestions,
 coalesce((select jsonb_agg(jsonb_build_object('instrument',l.instrument_code,'version',l.instrument_version,'indicator',l.object_code,'excerpts',l.evidence_excerpts))
 from public.vertice_doc_indicator_links l join public.vertice_doc_prevalidation old on old.id=l.prevalidation_id
 where old.repository_file_id=f.id and old.institution_id=f.institution_id and l.institution_id=f.institution_id and l.status='aprovado'
 and old.source_sha256=pv.source_sha256),'[]'::jsonb) as approved_links
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id and r.institution_id=f.institution_id
 left join lateral(select p.* from public.vertice_doc_prevalidation p where p.repository_file_id=f.id and p.institution_id=f.institution_id and p.extraction_status in ('ready','partial') order by p.extracted_at desc,p.id desc limit 1) pv on true
 where f.institution_id=p_institution_id
 union all
 select 'vertice_documents',d.id,d.course_id,d.title,d.category_code,coalesce(d.tags,'{}'),null::uuid,null::uuid,
 case when nullif(d.extracted_text,'') is null then 'pending' else 'ready' end,d.sha256,d.extracted_text,'{}'::text[],'[]'::jsonb
 from public.vertice_documents d where d.institution_id=p_institution_id
 union all
 select 'vertice_inep_library',l.id,null::uuid,l.title,l.library_key,array_remove(array[l.indicator],null),null::uuid,null::uuid,
 'catalog_only',l.sha256,null::text,'{}'::text[],'[]'::jsonb from public.vertice_inep_library l where l.institution_id=p_institution_id and l.active
 )
 select s.source_table,s.source_id,s.course_id,s.title,s.category,s.indicators,s.request_id,s.goal_id,s.text_status,s.source_sha256,
 case when nullif(s.extracted_text,'') is null then 'Somente metadados; conteúdo ainda não indexado.' else
 ts_headline('portuguese',s.extracted_text,plainto_tsquery('portuguese',left(coalesce(p_query,''),300)),'MaxWords=45,MinWords=15,StartSel="",StopSel=""') end,
 s.keyword_suggestions,s.approved_links from sources s
 where public.vertice_evidence_can_manage(p_institution_id)
 and ((p_course_id is null and p_include_institution) or (p_course_id is not null and (s.course_id=p_course_id or (p_include_institution and s.course_id is null))))
 and (btrim(coalesce(p_query,''))='' or to_tsvector('portuguese',coalesce(s.title,'')||' '||coalesce(s.category,'')||' '||array_to_string(s.indicators,' ')||' '||coalesce(s.extracted_text,'')) @@ plainto_tsquery('portuguese',left(p_query,300)))
 order by s.title,s.source_id limit greatest(1,least(coalesce(p_limit,30),50));
$$;
revoke all on function public.vertice_evidence_search(uuid,uuid,text,boolean,integer) from public,anon;
grant execute on function public.vertice_evidence_search(uuid,uuid,text,boolean,integer) to authenticated;
