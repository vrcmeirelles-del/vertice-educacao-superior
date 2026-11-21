begin;
-- Uma exigência pertence à IES e pode comprovar uma meta e um curso.
create table public.vertice_repository_requests (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 course_id uuid references public.vertice_courses(id) on delete restrict,
 goal_id uuid references public.vertice_goals(id) on delete restrict,
 title text not null check(length(title) between 1 and 500),
 document_code text check(document_code is null or length(document_code)<=80),
 indicator text check(indicator is null or length(indicator)<=250),
 semester text check(semester is null or semester ~ '^[0-9]{4}[-/][12]$'),
 instructions text check(instructions is null or length(instructions)<=4000),
 assigned_to uuid references auth.users(id) on delete restrict,
 assignee_email text,
 due_date date,
 active boolean not null default true,
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vertice_repo_requests_inst on public.vertice_repository_requests(institution_id,goal_id);
create index vertice_repo_requests_assigned on public.vertice_repository_requests(assigned_to);
create index vertice_repo_requests_course on public.vertice_repository_requests(course_id);
create table public.vertice_repository_files (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 request_id uuid not null references public.vertice_repository_requests(id) on delete restrict,
 storage_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 250),
 size_bytes bigint not null check(size_bytes between 1 and 20971520),
 mime_type text not null,
 uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 uploaded_email text,
 status text not null default 'enviado' check(status in ('enviado','validado','devolvido')),
 review_note text check(review_note is null or length(review_note)<=4000),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index vertice_repo_files_inst on public.vertice_repository_files(institution_id);
create index vertice_repo_files_request on public.vertice_repository_files(request_id,created_at desc);
create index vertice_repo_files_uploader on public.vertice_repository_files(uploaded_by);
create index vertice_repo_files_reviewer on public.vertice_repository_files(reviewed_by);

-- Validação dos vínculos em trigger privada: não cria permissões nem altera a meta.
create function vertice_private.check_repository_request() returns trigger
language plpgsql security definer set search_path='' as $$
declare g public.vertice_goals%rowtype;
begin
 if new.assigned_to is not null then
  if not exists(select 1 from public.vertice_memberships m where m.user_id=new.assigned_to and m.institution_id=new.institution_id and m.role in ('gestor','equipe'))
   and not exists(select 1 from public.vertice_admins a where a.user_id=new.assigned_to)
  then raise exception 'responsável sem vínculo de envio nesta instituição' using errcode='23514'; end if;
  select email into new.assignee_email from auth.users where id=new.assigned_to;
 else new.assignee_email:=null; end if;
 if new.goal_id is not null then
  select * into g from public.vertice_goals where id=new.goal_id;
  if g.institution_id is distinct from new.institution_id or (g.course_id is not null and g.course_id is distinct from new.course_id)
  then raise exception 'meta ou curso pertence a outra instituição ou curso' using errcode='23514'; end if;
 end if;
 if tg_op='INSERT' then new.created_by:=auth.uid(); new.created_at:=now(); end if;
 return new;
end; $$;
revoke all on function vertice_private.check_repository_request() from public,anon,authenticated;
create trigger vertice_repo_requests_same_inst before insert or update on public.vertice_repository_requests for each row execute function vertice_private.check_same_institution();
create trigger vertice_repo_requests_validate before insert or update on public.vertice_repository_requests for each row execute function vertice_private.check_repository_request();
create trigger vertice_repo_requests_touch before update on public.vertice_repository_requests for each row execute function vertice_private.touch_updated();
create trigger vertice_repo_requests_audit after insert or update or delete on public.vertice_repository_requests for each row execute function vertice_private.audit_change();

alter table public.vertice_repository_requests enable row level security;
alter table public.vertice_repository_files enable row level security;
revoke all on public.vertice_repository_requests,public.vertice_repository_files from anon,authenticated;
grant select,insert,update on public.vertice_repository_requests to authenticated;
grant select,insert on public.vertice_repository_files to authenticated;
grant update(status,review_note) on public.vertice_repository_files to authenticated;
create policy vertice_repo_requests_read on public.vertice_repository_requests for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy vertice_repo_requests_insert on public.vertice_repository_requests for insert to authenticated with check(vertice_private.has_role(institution_id,array['gestor']));
create policy vertice_repo_requests_update on public.vertice_repository_requests for update to authenticated using(vertice_private.has_role(institution_id,array['gestor'])) with check(vertice_private.has_role(institution_id,array['gestor']));
create policy vertice_repo_files_read on public.vertice_repository_files for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy vertice_repo_files_insert on public.vertice_repository_files for insert to authenticated with check(
 uploaded_by=(select auth.uid()) and status='enviado' and exists(select 1 from public.vertice_repository_requests r where r.id=request_id and r.institution_id=vertice_repository_files.institution_id and r.active
 and (vertice_private.has_role(r.institution_id,array['gestor']) or (vertice_private.has_role(r.institution_id,array['equipe']) and r.assigned_to=(select auth.uid())))));
create policy vertice_repo_files_review on public.vertice_repository_files for update to authenticated using(vertice_private.has_role(institution_id,array['gestor'])) with check(vertice_private.has_role(institution_id,array['gestor']));

-- Função invoker: usa as mesmas regras da IES; não contorna RLS.
create function vertice_private.repository_path_allowed(object_name text,writing boolean) returns boolean
language sql stable security invoker set search_path='' as $$
 select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg|docx|xlsx|pptx|txt|csv)$'
 and exists(select 1 from public.vertice_repository_requests r
 where r.institution_id::text=split_part(object_name,'/',1) and r.id::text=split_part(object_name,'/',2)
 and case when writing then r.active and (vertice_private.has_role(r.institution_id,array['gestor']) or (r.assigned_to=(select auth.uid()) and vertice_private.has_role(r.institution_id,array['equipe'])))
 else vertice_private.can_read_institution(r.institution_id) end);
$$;
revoke all on function vertice_private.repository_path_allowed(text,boolean) from public,anon;
grant execute on function vertice_private.repository_path_allowed(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('vertice-repositorios','vertice-repositorios',false,20971520,array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv']);
create policy vertice_repo_storage_read on storage.objects for select to authenticated using(bucket_id='vertice-repositorios' and vertice_private.repository_path_allowed(name,false));
create policy vertice_repo_storage_insert on storage.objects for insert to authenticated with check(bucket_id='vertice-repositorios' and vertice_private.repository_path_allowed(name,true));
-- Sem UPDATE/DELETE: cada reenvio gera uma nova versão e preserva a anterior.

create function vertice_private.check_repository_file() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.vertice_repository_requests%rowtype; o storage.objects%rowtype;
begin
 if tg_op='INSERT' then
  select * into r from public.vertice_repository_requests where id=new.request_id;
  if r.institution_id is distinct from new.institution_id then raise exception 'exigência pertence a outra instituição' using errcode='23514'; end if;
  if new.storage_path not like new.institution_id::text||'/'||new.request_id::text||'/'||new.id::text||'.%' then raise exception 'caminho inválido' using errcode='23514'; end if;
  select * into o from storage.objects where bucket_id='vertice-repositorios' and name=new.storage_path;
  if o.id is null or o.owner_id is distinct from auth.uid()::text then raise exception 'arquivo não enviado por esta conta' using errcode='23514'; end if;
  if coalesce((o.metadata->>'size')::bigint,-1) <> new.size_bytes then raise exception 'tamanho do arquivo divergente' using errcode='23514'; end if;
  new.uploaded_by:=auth.uid();
  select email into new.uploaded_email from auth.users where id=auth.uid();
  new.created_at:=clock_timestamp(); new.status:='enviado'; new.reviewed_by:=null; new.reviewed_at:=null; new.review_note:=null;
 else
  if not vertice_private.has_role(new.institution_id,array['gestor']) then raise exception 'sem permissão' using errcode='42501'; end if;
  if new.status not in ('validado','devolvido') then raise exception 'situação de análise inválida' using errcode='23514'; end if;
  if new.status='devolvido' and length(trim(coalesce(new.review_note,'')))=0 then raise exception 'informe o motivo da devolução' using errcode='23514'; end if;
  new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();
 end if;
 return new;
end; $$;
revoke all on function vertice_private.check_repository_file() from public,anon,authenticated;
create trigger vertice_repo_files_validate before insert or update on public.vertice_repository_files for each row execute function vertice_private.check_repository_file();
create trigger vertice_repo_files_audit after insert or update on public.vertice_repository_files for each row execute function vertice_private.audit_change();
commit;
