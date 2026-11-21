-- Central de upload de extrações externas por IES. Somente staging; não altera tabelas acadêmicas.
create table if not exists public.vertice_source_uploads (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 source_kind text not null check(source_kind in ('eorbit','emec','censo','enade','secretaria','site_institucional','outro')),
 source_url text check(source_url is null or length(source_url) <= 1000),
 source_name text not null check(length(source_name) between 2 and 180),
 reference_period text check(reference_period is null or length(reference_period)<=35),
 extracted_on date,
 original_name text not null check(length(original_name) between 1 and 250 and original_name !~ '[/\\\\]'),
 mime_type text not null,
 bytes bigint not null check(bytes > 0 and bytes <= 26214400),
 storage_path text unique not null,
 description text check(description is null or length(description)<=1500),
 upload_status text not null default 'aguardando_arquivo' check(upload_status in ('aguardando_arquivo','recebido','falhou')),
 review_status text not null default 'pendente' check(review_status='pendente'),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 received_at timestamptz
);
create index if not exists vx_uploads_inst_date on public.vertice_source_uploads(institution_id,created_at desc);
alter table public.vertice_source_uploads enable row level security;
revoke all on public.vertice_source_uploads from anon,authenticated;
grant select,insert,update(upload_status,received_at) on public.vertice_source_uploads to authenticated;
create policy vx_uploads_read on public.vertice_source_uploads for select to authenticated
 using (vertice_private.has_role(institution_id,array['gestor']));
create policy vx_uploads_insert on public.vertice_source_uploads for insert to authenticated
 with check (vertice_private.has_role(institution_id,array['gestor']) and created_by=(select auth.uid())
 and review_status='pendente' and upload_status='aguardando_arquivo'
 and storage_path=institution_id::text||'/'||id::text||'/'||original_name);
create policy vx_uploads_update on public.vertice_source_uploads for update to authenticated
 using (vertice_private.has_role(institution_id,array['gestor']) and created_by=(select auth.uid()))
 with check (vertice_private.has_role(institution_id,array['gestor']) and created_by=(select auth.uid()));
create or replace function vertice_private.source_upload_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.created_by is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if new.storage_path<>new.institution_id::text||'/'||new.id::text||'/'||new.original_name then
   raise exception 'invalid_path' using errcode='23514'; end if;
 else
  if new.id is distinct from old.id or new.institution_id is distinct from old.institution_id or
     new.storage_path is distinct from old.storage_path or new.original_name is distinct from old.original_name or
     new.source_kind is distinct from old.source_kind or new.source_url is distinct from old.source_url or
     new.source_name is distinct from old.source_name or new.reference_period is distinct from old.reference_period or
     new.extracted_on is distinct from old.extracted_on or new.mime_type is distinct from old.mime_type or
     new.bytes is distinct from old.bytes or new.description is distinct from old.description or
     new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at or
     new.review_status is distinct from old.review_status or
     (old.upload_status='recebido' and new.upload_status<>'recebido') then
     raise exception 'immutable_record' using errcode='42501';
  end if;
  if old.upload_status='aguardando_arquivo' and new.upload_status not in ('recebido','falhou')
    or old.upload_status='falhou' and new.upload_status not in ('falhou','recebido') then
    raise exception 'invalid_transition' using errcode='23514';
  end if;
  if new.upload_status='recebido' then
    if not exists(select 1 from storage.objects o where o.bucket_id='vertice-fontes-ies' and o.name=new.storage_path) then
      raise exception 'object_not_uploaded' using errcode='23514';
    end if;
    new.received_at=now();
  end if;
 end if;
 return new;
end $$;
drop trigger if exists vx_source_upload_guard on public.vertice_source_uploads;
create trigger vx_source_upload_guard before insert or update on public.vertice_source_uploads
 for each row execute function vertice_private.source_upload_guard();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vertice-fontes-ies','vertice-fontes-ies',false,26214400,
 array['application/pdf','text/csv','application/json','text/plain',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'text/html','application/xml','text/xml'])
on conflict(id) do nothing;
-- Bucket exclusively for reviewed source files. Never overwrite or delete in the browser.
create policy vx_source_storage_insert on storage.objects for insert to authenticated
 with check (
  bucket_id='vertice-fontes-ies'
  and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and vertice_private.has_role(((storage.foldername(name))[1])::uuid,array['gestor'])
  and exists(select 1 from public.vertice_source_uploads u where u.storage_path=name
    and u.institution_id=((storage.foldername(name))[1])::uuid and u.created_by=auth.uid()
    and u.upload_status='aguardando_arquivo')
 );
create policy vx_source_storage_read on storage.objects for select to authenticated
 using (
  bucket_id='vertice-fontes-ies'
  and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and vertice_private.has_role(((storage.foldername(name))[1])::uuid,array['gestor'])
 );
