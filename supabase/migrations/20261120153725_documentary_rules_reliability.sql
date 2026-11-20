begin;
alter table public.vertice_doc_prevalidation
 add column if not exists rules_job_key text,
 add column if not exists rules_action text check(rules_action in ('index','analyze')),
 add column if not exists lease_until timestamptz,
 add column if not exists processing_stage text,
 add column if not exists attempt_number integer;
create index if not exists documentary_rules_job_idx on public.vertice_doc_prevalidation(institution_id,rules_job_key,created_at desc);

-- Internal RPCs: invoker rights, service-role only, after Edge checks user RLS/MFA.
-- Storage updated_at changes on overwrite; catalog content is part of the revision.
create function public.vertice_doc_rules_revision(p_institution_id uuid,p_source_table text,p_file_id uuid)
returns text language plpgsql stable security invoker set search_path='' as $$
declare src jsonb; bucket_name text; storage_revision text; catalog_revision text;
begin
 if p_source_table='vertice_documents' then
  select to_jsonb(d) into src from public.vertice_documents d where d.id=p_file_id and d.institution_id=p_institution_id;
  bucket_name:='vertice-documents';
 elsif p_source_table='vertice_repository_files' then
  select to_jsonb(f) into src from public.vertice_repository_files f where f.id=p_file_id and f.institution_id=p_institution_id;
  bucket_name:='vertice-repositorios';
 else raise exception 'invalid_source_table'; end if;
 if src is null then raise exception 'source_not_found'; end if;
 select coalesce(o.updated_at::text,'')||coalesce(o.metadata::text,'') into storage_revision
  from storage.objects o where o.bucket_id=bucket_name and o.name=src->>'storage_path';
 select coalesce(jsonb_agg(jsonb_build_array(c.instrument_code,c.instrument_version,c.source_provenance,o.object_code,o.object_label,o.description) order by c.id,o.object_code)::text,'[]')
  into catalog_revision from public.vertice_instrument_catalog c left join public.vertice_instrument_objects o on o.catalog_id=c.id
  where c.institution_id=p_institution_id and c.is_active;
 return md5(jsonb_build_array(src->>'storage_path',src->>'file_name',src->>'version_number',src->>'category_code',src->'tags',src->>'document_category',src->'instrument_indicators',storage_revision,catalog_revision)::text);
end $$;

create function public.vertice_doc_claim_rules(p_institution_id uuid,p_source_table text,p_file_id uuid,p_actor uuid,p_action text,p_rules_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare job text; pv public.vertice_doc_prevalidation; attempts integer;
begin
 if p_action not in ('index','analyze') or p_actor is null or p_rules_version not like 'regras-%' then raise exception 'invalid_job'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text||p_source_table||p_file_id::text,0));
 job:=md5(public.vertice_doc_rules_revision(p_institution_id,p_source_table,p_file_id)||p_action||p_rules_version);
 select * into pv from public.vertice_doc_prevalidation p where p.institution_id=p_institution_id
  and ((p_source_table='vertice_documents' and p.document_id=p_file_id) or (p_source_table='vertice_repository_files' and p.repository_file_id=p_file_id))
  and p.ai_status='processing' and p.lease_until>clock_timestamp() order by p.created_at desc limit 1;
 if found then return jsonb_build_object('status','processing','prevalidation_id',pv.id); end if;
 update public.vertice_doc_prevalidation p set ai_status='failed',ai_error='processing_timeout',processing_stage='retry_required',updated_at=clock_timestamp()
  where p.institution_id=p_institution_id and ((p_source_table='vertice_documents' and p.document_id=p_file_id) or (p_source_table='vertice_repository_files' and p.repository_file_id=p_file_id))
  and p.ai_status='processing' and p.lease_until<=clock_timestamp();
 select * into pv from public.vertice_doc_prevalidation p where p.institution_id=p_institution_id and p.rules_job_key=job
  and (p.ai_status='completed' or (p.ai_status='pending' and p.rules_action='index')) order by p.created_at desc limit 1;
 if found then return jsonb_build_object('status',case when p_action='index' then 'indexed' else 'completed' end,'prevalidation_id',pv.id,'cached',true,'review_required',true,'provider_transmission',false); end if;
 select count(*) into attempts from public.vertice_doc_prevalidation p where p.institution_id=p_institution_id and p.rules_job_key=job and p.ai_status='failed' and p.created_at>now()-interval '24 hours';
 if attempts>=3 then return jsonb_build_object('status','retry_limit','detail','Três falhas nesta versão em 24 horas. Corrija o arquivo ou aguarde a janela de retomada.'); end if;
 insert into public.vertice_doc_prevalidation(institution_id,source_table,document_id,repository_file_id,ai_status,requested_by,rules_job_key,rules_action,lease_until,processing_stage,attempt_number,ai_model_version)
 values(p_institution_id,p_source_table,case when p_source_table='vertice_documents' then p_file_id end,case when p_source_table='vertice_repository_files' then p_file_id end,'processing',p_actor,job,p_action,clock_timestamp()+interval '5 minutes','received',attempts+1,p_rules_version) returning * into pv;
 insert into public.vertice_mirror_audit_log(institution_id,action,entity_type,entity_id,actor_id,actor_type,details)
 values(p_institution_id,'prevalidation_requested','prevalidation',pv.id,p_actor,'human',jsonb_build_object('rules_version',p_rules_version,'provider_transmission',false,'attempt',attempts+1));
 return jsonb_build_object('status','claimed','prevalidation_id',pv.id);
end $$;

create function public.vertice_doc_finish_rules(p_id uuid,p_result jsonb,p_links jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pv public.vertice_doc_prevalidation; link jsonb; count_links integer:=0; rev text;
begin
 select * into strict pv from public.vertice_doc_prevalidation where id=p_id for update;
 if pv.ai_status<>'processing' or pv.lease_until<=clock_timestamp() then raise exception 'lease_expired'; end if;
 rev:=md5(public.vertice_doc_rules_revision(pv.institution_id,pv.source_table,coalesce(pv.document_id,pv.repository_file_id))||pv.rules_action||pv.ai_model_version);
 if rev<>pv.rules_job_key then raise exception 'source_or_catalog_changed'; end if;
 if pv.source_sha256 is null or pv.extraction_status not in ('ready','partial') then raise exception 'unverified_extraction'; end if;
 for link in select value from jsonb_array_elements(p_links) loop
  if not exists(select 1 from public.vertice_instrument_catalog c join public.vertice_instrument_objects o on o.catalog_id=c.id
   where c.institution_id=pv.institution_id and c.is_active and c.instrument_code=link->>'instrument_code' and c.instrument_version=link->>'instrument_version' and o.object_code=link->>'object_code') then raise exception 'unknown_indicator'; end if;
  if jsonb_array_length(coalesce(link->'evidence_excerpts','[]'))=0 or exists(
   select 1 from jsonb_array_elements(link->'evidence_excerpts') e where length(coalesce(e->>'text',''))<20 or not exists(
    select 1 from jsonb_array_elements(pv.extracted_pages) page where position(e->>'text' in page->>'text')>0
    and (e->>'page' is null or e->>'page'=page->>'page') and (coalesce(e->>'section','')='' or e->>'section'=page->>'section'))) then raise exception 'ungrounded_excerpt'; end if;
  insert into public.vertice_doc_indicator_links(prevalidation_id,institution_id,instrument_code,instrument_version,object_code,dimension,is_primary,compatibility,justification,evidence_excerpts,limitations,status)
  values(pv.id,pv.institution_id,link->>'instrument_code',link->>'instrument_version',link->>'object_code',link->>'dimension',coalesce((link->>'is_primary')::boolean,false),link->>'compatibility',link->>'justification',link->'evidence_excerpts',link->>'limitations','sugerido');
  count_links:=count_links+1;
 end loop;
 update public.vertice_doc_prevalidation set ai_status='completed',ai_summary=left(p_result->>'summary',4000),ai_nature=left(p_result->>'nature',200),ai_institution_detected=left(p_result->>'institution_detected',200),ai_course_detected=left(p_result->>'course_detected',200),ai_period_detected=left(p_result->>'period_detected',100),ai_scope_detected=left(p_result->>'scope_detected',50),ai_analyzed_at=clock_timestamp(),ai_error=null,processing_stage='human_review',lease_until=null,updated_at=clock_timestamp() where id=pv.id;
 insert into public.vertice_mirror_audit_log(institution_id,action,entity_type,entity_id,actor_id,actor_type,ai_model,details)
 values(pv.institution_id,'prevalidation_completed','prevalidation',pv.id,pv.requested_by,'system',pv.ai_model_version,jsonb_build_object('source_sha256',pv.source_sha256,'links_created',count_links,'review_required',true,'provider_transmission',false));
 return jsonb_build_object('status','completed','prevalidation_id',pv.id,'links_created',count_links,'review_required',true,'provider_transmission',false);
end $$;
revoke all on function public.vertice_doc_rules_revision(uuid,text,uuid),public.vertice_doc_claim_rules(uuid,text,uuid,uuid,text,text),public.vertice_doc_finish_rules(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.vertice_doc_rules_revision(uuid,text,uuid),public.vertice_doc_claim_rules(uuid,text,uuid,uuid,text,text),public.vertice_doc_finish_rules(uuid,jsonb,jsonb) to service_role;
commit;
