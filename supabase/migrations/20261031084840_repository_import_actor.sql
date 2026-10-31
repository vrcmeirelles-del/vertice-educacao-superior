begin;
-- Backend-only imports retain a real administrator actor, without changing member permissions.
create or replace function vertice_private.check_repository_file() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.vertice_repository_requests%rowtype; o storage.objects%rowtype; actor uuid:=auth.uid(); server_import boolean:=coalesce(auth.jwt()->>'role'='service_role',false);
begin
 if tg_op='INSERT' then
  if server_import then
   actor:=new.uploaded_by;
   if actor is null or not exists(select 1 from public.vertice_admins where user_id=actor) then raise exception 'importação exige atribuição a um administrador' using errcode='42501';end if;
  end if;
  select * into r from public.vertice_repository_requests where id=new.request_id;
  if r.institution_id is distinct from new.institution_id then raise exception 'exigência pertence a outra instituição' using errcode='23514'; end if;
  if new.storage_path not like new.institution_id::text||'/'||new.request_id::text||'/'||new.id::text||'.%' then raise exception 'caminho inválido' using errcode='23514'; end if;
  select * into o from storage.objects where bucket_id='vertice-repositorios' and name=new.storage_path;
  if o.id is null or (o.owner_id is distinct from actor::text and not(server_import and o.owner_id is null)) then raise exception 'arquivo não enviado por esta conta' using errcode='23514'; end if;
  if coalesce((o.metadata->>'size')::bigint,-1) <> new.size_bytes then raise exception 'tamanho do arquivo divergente' using errcode='23514'; end if;
  new.uploaded_by:=actor;
  select email into new.uploaded_email from auth.users where id=actor;
  new.created_at:=clock_timestamp(); new.status:='enviado'; new.reviewed_by:=null; new.reviewed_at:=null; new.review_note:=null;
 else
  if not vertice_private.has_role(new.institution_id,array['gestor']) then raise exception 'sem permissão' using errcode='42501'; end if;
  if new.status not in ('validado','devolvido') then raise exception 'situação de análise inválida' using errcode='23514'; end if;
  if new.status='devolvido' and length(trim(coalesce(new.review_note,'')))=0 then raise exception 'informe o motivo da devolução' using errcode='23514'; end if;
  new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();
 end if;
 return new;
end; $$;
commit;
