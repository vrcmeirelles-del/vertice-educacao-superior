-- Acervos documentais isolados do Novo Instrumento (proposta 2026)
-- Institucional e curso usam a mesma disciplina do Reconhecimento, mas buckets privados separados.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select 'vertice-novo-instrumento-2026-institucional','vertice-novo-instrumento-2026-institucional',false,file_size_limit,allowed_mime_types
from storage.buckets where id='vertice-repositorios'
on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select 'vertice-novo-instrumento-2026-cursos','vertice-novo-instrumento-2026-cursos',false,file_size_limit,allowed_mime_types
from storage.buckets where id='vertice-repositorios'
on conflict(id) do nothing;
alter table public.vertice_repository_requests drop constraint if exists vertice_repository_requests_repository_section_check;
alter table public.vertice_repository_requests add constraint vertice_repository_requests_repository_section_check
check(repository_section in('instrumento','apoio','diversos','nao_classificado','recredenciamento_2017','novo_instrumento_2026_institucional','novo_instrumento_2026_curso'));

drop policy if exists vertice_ni26_inst_read on storage.objects;
create policy vertice_ni26_inst_read on storage.objects for select to authenticated
using(bucket_id='vertice-novo-instrumento-2026-institucional'
and vertice_private.repository_path_allowed(name,false)
and exists(select 1 from public.vertice_repository_requests r where r.id::text=split_part(name,'/',2)
and r.institution_id::text=split_part(name,'/',1) and r.course_id is null
and r.repository_section='novo_instrumento_2026_institucional'));

drop policy if exists vertice_ni26_inst_insert on storage.objects;
create policy vertice_ni26_inst_insert on storage.objects for insert to authenticated
with check(bucket_id='vertice-novo-instrumento-2026-institucional'
and vertice_private.repository_path_allowed(name,true)
and exists(select 1 from public.vertice_repository_requests r where r.id::text=split_part(name,'/',2)
and r.institution_id::text=split_part(name,'/',1) and r.course_id is null
and r.repository_section='novo_instrumento_2026_institucional'));

drop policy if exists vertice_ni26_course_read on storage.objects;
create policy vertice_ni26_course_read on storage.objects for select to authenticated
using(bucket_id='vertice-novo-instrumento-2026-cursos'
and vertice_private.repository_path_allowed(name,false)
and exists(select 1 from public.vertice_repository_requests r where r.id::text=split_part(name,'/',2)
and r.institution_id::text=split_part(name,'/',1) and r.course_id is not null
and r.repository_section='novo_instrumento_2026_curso'));

drop policy if exists vertice_ni26_course_insert on storage.objects;
create policy vertice_ni26_course_insert on storage.objects for insert to authenticated
with check(bucket_id='vertice-novo-instrumento-2026-cursos'
and vertice_private.repository_path_allowed(name,true)
and exists(select 1 from public.vertice_repository_requests r where r.id::text=split_part(name,'/',2)
and r.institution_id::text=split_part(name,'/',1) and r.course_id is not null
and r.repository_section='novo_instrumento_2026_curso'));

alter policy vertice_repo_storage_read on storage.objects using(
bucket_id='vertice-repositorios' and vertice_private.repository_path_allowed(name,false)
and exists(select 1 from public.vertice_repository_requests r where r.id::text=split_part(name,'/',2)
and r.institution_id::text=split_part(name,'/',1)
and coalesce(r.repository_section,'instrumento') not in('recredenciamento_2017','novo_instrumento_2026_institucional','novo_instrumento_2026_curso')));

alter policy vertice_repo_storage_insert on storage.objects with check(
bucket_id='vertice-repositorios' and vertice_private.repository_path_allowed(name,true)
and exists(select 1 from public.vertice_repository_requests r where r.id::text=split_part(name,'/',2)
and r.institution_id::text=split_part(name,'/',1)
and coalesce(r.repository_section,'instrumento') not in('recredenciamento_2017','novo_instrumento_2026_institucional','novo_instrumento_2026_curso')));
-- Garante associação institucional correta para os pedidos do Novo Instrumento.
create or replace function vertice_private.validate_ni26_request_scope()
returns trigger language plpgsql security invoker set search_path='' as $
begin
 if new.repository_section='novo_instrumento_2026_institucional' and new.course_id is not null then
  raise exception 'Documentação institucional 2026 não aceita curso' using errcode='23514';
 end if;
 if new.repository_section='novo_instrumento_2026_curso' and
  (new.course_id is null or not exists(
   select 1 from public.vertice_courses c
   where c.id=new.course_id and c.institution_id=new.institution_id))
 then
  raise exception 'Curso não pertence à instituição da documentação 2026' using errcode='23514';
 end if;
 return new;
end $;
drop trigger if exists vertice_ni26_scope_integrity on public.vertice_repository_requests;
create trigger vertice_ni26_scope_integrity
before insert or update of course_id,institution_id,repository_section on public.vertice_repository_requests
for each row execute function vertice_private.validate_ni26_request_scope();
commit;
