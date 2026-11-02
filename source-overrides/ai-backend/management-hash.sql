CREATE OR REPLACE FUNCTION vertice_private.ai_evidence_hash(inst uuid, course uuid, ids uuid[])
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;fingerprint text;valid_pointer boolean;
begin
 if ids is not null and cardinality(ids)=0 then
  if course is null or not exists(select 1 from public.vertice_courses where id=course and institution_id=inst) then raise exception 'course scope denied' using errcode='42501';end if;
  return encode(sha256(convert_to(vertice_private.ai_management_snapshot(inst,course)::text,'UTF8')),'hex');
 end if;
 if ids is null or cardinality(ids) not between 1 and 3 or array_position(ids,null) is not null or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'invalid evidence selection' using errcode='22023';end if;
 select count(*),encode(sha256(convert_to(string_agg(to_jsonb(f)::text||to_jsonb(r)::text,'|' order by f.id),'UTF8')),'hex') into n,fingerprint
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id
 where f.id=any(ids) and f.institution_id=inst and r.institution_id=inst and r.course_id is not distinct from course and r.active and not r.not_applicable and f.status='validado'
 and (to_regclass('public.vertice_effective_repository_files') is not null or not exists(select 1 from public.vertice_repository_files newer where newer.request_id=f.request_id and (newer.created_at,newer.id)>(f.created_at,f.id)));
 if n<>cardinality(ids) then raise exception 'evidence scope denied' using errcode='42501';end if;
 if to_regclass('public.vertice_effective_repository_files') is not null then
  execute 'select count(*)=$2 from public.vertice_effective_repository_files where file_id=any($1)' into valid_pointer using ids,cardinality(ids);
  if not coalesce(valid_pointer,false) then raise exception 'evidence not effective' using errcode='42501';end if;
 end if;
 return encode(sha256(convert_to(fingerprint||vertice_private.ai_management_snapshot(inst,course)::text,'UTF8')),'hex');
end;$function$

