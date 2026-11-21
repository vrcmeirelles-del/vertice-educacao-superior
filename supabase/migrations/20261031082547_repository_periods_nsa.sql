begin;
alter table public.vertice_repository_requests
 add column not_applicable boolean not null default false,
 add column nsa_reason text check(nsa_reason is null or length(nsa_reason)<=4000),
 add column nsa_by uuid references auth.users(id),
 add column nsa_at timestamptz;
create function vertice_private.check_repository_nsa() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.not_applicable then
   if not vertice_private.has_role(new.institution_id,array['gestor']) and not (vertice_private.has_role(new.institution_id,array['equipe']) and coalesce(new.assigned_to=auth.uid(),false)) then raise exception 'sem permissão' using errcode='42501'; end if;
   if length(trim(coalesce(new.nsa_reason,'')))=0 then raise exception 'informe a justificativa de NSA' using errcode='23514'; end if;
   new.nsa_by:=auth.uid();new.nsa_at:=clock_timestamp();
  else new.nsa_reason:=null;new.nsa_by:=null;new.nsa_at:=null; end if;
 elsif new.not_applicable is distinct from old.not_applicable or new.nsa_reason is distinct from old.nsa_reason then
  if not vertice_private.has_role(old.institution_id,array['gestor']) and not (vertice_private.has_role(old.institution_id,array['equipe']) and coalesce(old.assigned_to=auth.uid(),false)) then raise exception 'sem permissão' using errcode='42501'; end if;
  if new.not_applicable and length(trim(coalesce(new.nsa_reason,'')))=0 then raise exception 'informe a justificativa de NSA' using errcode='23514'; end if;
  if not new.not_applicable then new.nsa_reason:=null; end if;
  new.nsa_by:=auth.uid();new.nsa_at:=clock_timestamp();
 else new.nsa_by:=old.nsa_by;new.nsa_at:=old.nsa_at; end if;
 return new;
end;$$;
revoke all on function vertice_private.check_repository_nsa() from public,anon,authenticated;
create trigger vertice_repo_requests_nsa before insert or update on public.vertice_repository_requests for each row execute function vertice_private.check_repository_nsa();

create function vertice_private.repository_set_nsa(target uuid,marked boolean,note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.vertice_repository_requests%rowtype;
begin
 select * into r from public.vertice_repository_requests where id=target for update;
 if auth.uid() is null or r.id is null or not r.active or not (vertice_private.has_role(r.institution_id,array['gestor']) or (vertice_private.has_role(r.institution_id,array['equipe']) and coalesce(r.assigned_to=auth.uid(),false))) then raise exception 'sem permissão' using errcode='42501'; end if;
 if marked is null or (marked and length(trim(coalesce(note,'')))=0) then raise exception 'informe a justificativa de NSA' using errcode='23514'; end if;
 update public.vertice_repository_requests set not_applicable=marked,nsa_reason=case when marked then trim(note) else null end where id=r.id;
 return r.id;
end;$$;
revoke all on function vertice_private.repository_set_nsa(uuid,boolean,text) from public,anon;
grant execute on function vertice_private.repository_set_nsa(uuid,boolean,text) to authenticated;
create function public.vertice_repository_set_nsa(target uuid,marked boolean,note text default null) returns uuid
language sql security invoker set search_path='' as $$select vertice_private.repository_set_nsa(target,marked,note)$$;
revoke all on function public.vertice_repository_set_nsa(uuid,boolean,text) from public,anon;
grant execute on function public.vertice_repository_set_nsa(uuid,boolean,text) to authenticated;

-- Resolve a requirement in the selected semester without moving past files.
-- Team members can only reproduce their own assigned requirement, with its bindings intact.
create function vertice_private.repository_period_target(source_request uuid,target_semester text) returns uuid
language plpgsql security definer set search_path='' as $$
declare src public.vertice_repository_requests%rowtype; dest public.vertice_repository_requests%rowtype; sem text:=replace(target_semester,'/','-'); identity text;
begin
 select * into src from public.vertice_repository_requests where id=source_request;
 if auth.uid() is null or src.id is null or not src.active or not (vertice_private.has_role(src.institution_id,array['gestor']) or (vertice_private.has_role(src.institution_id,array['equipe']) and coalesce(src.assigned_to=auth.uid(),false))) then raise exception 'sem permissão' using errcode='42501'; end if;
 if sem is null or sem !~ '^[0-9]{4}-[12]$' then raise exception 'semestre inválido' using errcode='23514'; end if;
 identity:=coalesce(regexp_replace(src.document_code,'^[^-]+-',''),'custom:'||src.title);
 perform pg_advisory_xact_lock(hashtextextended(src.institution_id::text||coalesce(src.course_id::text,'IES')||coalesce(src.goal_id::text,'')||identity||sem,0));
 select * into dest from public.vertice_repository_requests r where r.institution_id=src.institution_id and r.course_id is not distinct from src.course_id and r.goal_id is not distinct from src.goal_id and r.active and replace(r.semester,'/','-')=sem and coalesce(regexp_replace(r.document_code,'^[^-]+-',''),'custom:'||r.title)=identity order by r.created_at,r.id limit 1;
 if dest.id is not null then
  if dest.not_applicable then raise exception 'documento marcado como NSA neste semestre; torne-o aplicável antes de enviar' using errcode='23514'; end if;
  if not (vertice_private.has_role(dest.institution_id,array['gestor']) or (vertice_private.has_role(dest.institution_id,array['equipe']) and coalesce(dest.assigned_to=auth.uid(),false))) then raise exception 'sem permissão' using errcode='42501'; end if;
  return dest.id;
 end if;
 if src.not_applicable then raise exception 'documento marcado como NSA; torne-o aplicável antes de enviar' using errcode='23514'; end if;
 insert into public.vertice_repository_requests(institution_id,course_id,goal_id,title,document_code,indicator,semester,instructions,assigned_to,due_date)
 values(src.institution_id,src.course_id,src.goal_id,src.title,src.document_code,src.indicator,sem,src.instructions,src.assigned_to,null) returning id into dest.id;
 return dest.id;
end;$$;
revoke all on function vertice_private.repository_period_target(uuid,text) from public,anon;
grant execute on function vertice_private.repository_period_target(uuid,text) to authenticated;
create function public.vertice_repository_period_target(source_request uuid,target_semester text) returns uuid
language sql security invoker set search_path='' as $$select vertice_private.repository_period_target(source_request,target_semester)$$;
revoke all on function public.vertice_repository_period_target(uuid,text) from public,anon;
grant execute on function public.vertice_repository_period_target(uuid,text) to authenticated;
commit;
