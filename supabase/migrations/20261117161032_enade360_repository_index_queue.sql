-- Existing institutional rights and MFA gate; no policy or role changes.
create function public.vertice_evidence_index_queue(
 p_institution_id uuid,p_course_id uuid default null,p_after_id uuid default null,
 p_limit integer default 30,p_retry_failed boolean default false)
returns table(source_table text,source_id uuid,title text,course_id uuid,extraction_status text)
language sql stable security invoker set search_path='' as $$
 select 'vertice_repository_files'::text,f.id,f.file_name,r.course_id,coalesce(last.extraction_status,'pending')
 from public.vertice_repository_files f
 join public.vertice_repository_requests r on r.id=f.request_id and r.institution_id=f.institution_id
 left join lateral(select p.extraction_status from public.vertice_doc_prevalidation p
  where p.institution_id=f.institution_id and p.repository_file_id=f.id
  order by p.created_at desc,p.id desc limit 1) last on true
 where public.vertice_evidence_can_manage(p_institution_id)
 and f.institution_id=p_institution_id
 and (p_course_id is null or r.course_id=p_course_id)
 and (p_after_id is null or f.id>p_after_id)
 and not exists(select 1 from public.vertice_doc_prevalidation success
  where success.institution_id=f.institution_id and success.repository_file_id=f.id
  and success.extraction_status in ('ready','partial'))
 and (last.extraction_status is null or last.extraction_status='pending'
  or (coalesce(p_retry_failed,false) and last.extraction_status='failed'))
 order by f.id limit greatest(1,least(coalesce(p_limit,30),50));
$$;
revoke all on function public.vertice_evidence_index_queue(uuid,uuid,uuid,integer,boolean) from public,anon;
grant execute on function public.vertice_evidence_index_queue(uuid,uuid,uuid,integer,boolean) to authenticated;
