create or replace function public.vertice_base_ai_reserve(target uuid,request uuid,request_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare scoped_target uuid:=vertice_base_ai_reserve.target;
begin
 if not vertice_private.has_role(scoped_target,array['gestor']) or not exists(select 1 from public.vertice_institutions where id=scoped_target and status='ativa') then raise exception 'access_denied' using errcode='42501';end if;
 if request is null or request_hash is null or request_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('base-ai-user:'||auth.uid()::text,0));
 perform pg_advisory_xact_lock(hashtextextended('base-ai-inst:'||scoped_target::text,0));
 if exists(select 1 from public.vertice_base_ai_requests where id=request) then raise exception 'already_requested';end if;
 if (select count(*) from public.vertice_base_ai_requests where actor=auth.uid() and created_at>=date_trunc('day',now()))>=5
 or (select count(*) from public.vertice_base_ai_requests where institution_id=scoped_target and created_at>=date_trunc('day',now()))>=25 then raise exception 'quota_exceeded';end if;
 insert into public.vertice_base_ai_requests(id,institution_id,request_hash) values(request,scoped_target,request_hash);
 return jsonb_build_object('institution_id',scoped_target,'courses',(select count(*) from public.vertice_courses where institution_id=scoped_target),'goals',(select count(*) from public.vertice_goals where institution_id=scoped_target),'actions',(select count(*) from public.vertice_actions where institution_id=scoped_target),'diagnosis',(select count(*) from public.vertice_diagnosis_items where institution_id=scoped_target),'cycles',(select count(*) from public.vertice_base_cycles where institution_id=scoped_target),'base_records',(select count(*) from public.vertice_base_records where institution_id=scoped_target),'observed_at',now());
end;$$;
