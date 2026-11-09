-- Recredenciamento institucional (instrumento de 2017)
-- Acervo físico privado distinto do bucket de Reconhecimento de Curso.
-- Aplicado no projeto Supabase da Vértice; versão idempotente.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
select 'vertice-recredenciamento-2017','vertice-recredenciamento-2017',false,file_size_limit,allowed_mime_types
from storage.buckets where id='vertice-repositorios'
on conflict(id) do nothing;
alter table public.vertice_repository_requests
 drop constraint if exists vertice_repository_requests_repository_section_check;
alter table public.vertice_repository_requests
 add constraint vertice_repository_requests_repository_section_check
 check(repository_section in ('instrumento','apoio','diversos','nao_classificado','recredenciamento_2017'));
drop policy if exists vertice_recred2017_storage_read on storage.objects;
create policy vertice_recred2017_storage_read on storage.objects
 for select to authenticated using (
 bucket_id='vertice-recredenciamento-2017'
 and vertice_private.repository_path_allowed(name,false)
 and exists(select 1 from public.vertice_repository_requests r
 where r.institution_id::text=split_part(name,'/',1)
 and r.id::text=split_part(name,'/',2)
 and r.repository_section='recredenciamento_2017')
);
drop policy if exists vertice_recred2017_storage_insert on storage.objects;
create policy vertice_recred2017_storage_insert on storage.objects
 for insert to authenticated with check (
 bucket_id='vertice-recredenciamento-2017'
 and vertice_private.repository_path_allowed(name,true)
 and exists(select 1 from public.vertice_repository_requests r
 where r.institution_id::text=split_part(name,'/',1)
 and r.id::text=split_part(name,'/',2)
 and r.repository_section='recredenciamento_2017')
);
-- Assegura que evidências do Recredenciamento 2017 não sejam inseridas no bucket de Reconhecimento.
alter policy vertice_repo_storage_read on storage.objects
 using (
  bucket_id='vertice-repositorios'
  and vertice_private.repository_path_allowed(name,false)
  and exists(select 1 from public.vertice_repository_requests r
    where r.id::text=split_part(name,'/',2)
    and r.institution_id::text=split_part(name,'/',1)
    and coalesce(r.repository_section,'instrumento')<>'recredenciamento_2017')
 );
alter policy vertice_repo_storage_insert on storage.objects
 with check (
  bucket_id='vertice-repositorios'
  and vertice_private.repository_path_allowed(name,true)
  and exists(select 1 from public.vertice_repository_requests r
    where r.id::text=split_part(name,'/',2)
    and r.institution_id::text=split_part(name,'/',1)
    and coalesce(r.repository_section,'instrumento')<>'recredenciamento_2017')
 );
commit;
