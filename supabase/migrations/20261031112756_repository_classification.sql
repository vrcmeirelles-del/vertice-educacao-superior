begin;
alter table public.vertice_repository_requests add column repository_section text not null default 'instrumento' check(repository_section in ('instrumento','apoio','diversos','nao_classificado'));
alter table public.vertice_repository_files
 add column document_category text not null default 'nao_classificado' check(document_category in ('instrumento','apoio','diversos','nao_classificado')),
 add column instrument_indicators text[] not null default '{}',
 add column classification_note text check(length(classification_note)<=4000),
 add column classified_by uuid references auth.users(id),
 add column classified_at timestamptz;
create function vertice_private.check_repository_classification() returns trigger
language plpgsql set search_path='' as $$
declare code text; d integer; n integer;
begin
 foreach code in array new.instrument_indicators loop
  if code !~ '^[123]\.[1-9][0-9]?$' then raise exception 'indicador inválido' using errcode='23514';end if;
  d:=split_part(code,'.',1)::integer;n:=split_part(code,'.',2)::integer;
  if n>(case d when 1 then 24 when 2 then 16 else 18 end) then raise exception 'indicador fora do instrumento' using errcode='23514';end if;
 end loop;
 if new.document_category='instrumento' and cardinality(new.instrument_indicators)=0 then raise exception 'informe ao menos um indicador' using errcode='23514';end if;
 if new.document_category<>'instrumento' then new.instrument_indicators:='{}';end if;
 if tg_op='INSERT' then
  new.document_category:='nao_classificado';new.instrument_indicators:='{}';new.classified_by:=null;new.classified_at:=null;new.classification_note:=null;
 elsif (new.document_category,new.instrument_indicators,new.classification_note) is distinct from (old.document_category,old.instrument_indicators,old.classification_note) then
  new.classified_by:=auth.uid();new.classified_at:=clock_timestamp();
 else new.classified_by:=old.classified_by;new.classified_at:=old.classified_at;end if;
 return new;
end;$$;
revoke all on function vertice_private.check_repository_classification() from public,anon,authenticated;
create trigger vertice_repo_files_classification before insert or update on public.vertice_repository_files for each row execute function vertice_private.check_repository_classification();
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
  if (to_jsonb(new) - array['status','review_note','reviewed_by','reviewed_at','document_category','instrument_indicators','classification_note','classified_by','classified_at']) is distinct from (to_jsonb(old) - array['status','review_note','reviewed_by','reviewed_at','document_category','instrument_indicators','classification_note','classified_by','classified_at']) then raise exception 'metadados do arquivo são imutáveis' using errcode='23514';end if;
  if new.status=old.status and new.review_note is not distinct from old.review_note and (new.document_category,new.instrument_indicators,new.classification_note) is distinct from (old.document_category,old.instrument_indicators,old.classification_note) then
   new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;return new;
  end if;
  if new.status not in ('validado','devolvido') then raise exception 'situação de análise inválida' using errcode='23514'; end if;
  if new.status='devolvido' and length(trim(coalesce(new.review_note,'')))=0 then raise exception 'informe o motivo da devolução' using errcode='23514'; end if;
  new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();
 end if;
 return new;
end; $$;


create function vertice_private.sync_repository_classification() returns trigger
language plpgsql security invoker set search_path='' as $$
declare section text; codes text;
begin
 if (new.document_category,new.instrument_indicators) is not distinct from (old.document_category,old.instrument_indicators) then return new;end if;
 select case when bool_or(document_category='instrumento') then 'instrumento' when bool_or(document_category='nao_classificado') then 'nao_classificado' when bool_or(document_category='apoio') then 'apoio' else 'diversos' end into section from public.vertice_repository_files where request_id=new.request_id;
 select string_agg(code,', ' order by code) into codes from (select distinct unnest(instrument_indicators) code from public.vertice_repository_files where request_id=new.request_id and document_category='instrumento') q;
 update public.vertice_repository_requests set repository_section=section,indicator=case when section='instrumento' then codes else indicator end where id=new.request_id;
 return new;
end;$$;
revoke all on function vertice_private.sync_repository_classification() from public,anon,authenticated;
create trigger vertice_repo_files_sync_classification after update on public.vertice_repository_files for each row execute function vertice_private.sync_repository_classification();
grant update(document_category,instrument_indicators,classification_note) on public.vertice_repository_files to authenticated;
commit;
