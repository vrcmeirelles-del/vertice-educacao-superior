-- Biblioteca institucional, sem criar entregas ou alterar exigencias.
create table public.vertice_inep_library (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 library_key text not null check (library_key ~ '^[a-f0-9]{24}$'),
 version text not null,
 code text,
 dimension integer not null check (dimension between 0 and 3),
 indicator text not null check (indicator ~ '^[0-3]\.[0-9]+$'),
 file_name text not null,
 title text not null,
 original_path text not null,
 format text not null check (format in ('docx','pdf','xlsx')),
 size_bytes bigint not null check (size_bytes > 0),
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 is_placeholder boolean not null default false,
 object_path text not null unique,
 active boolean not null default false,
 created_at timestamptz not null default now(),
 unique(institution_id,version,library_key),
 check (split_part(object_path,'/',1)=institution_id::text)
);
create index vertice_inep_library_institution_active on public.vertice_inep_library(institution_id,active);
alter table public.vertice_inep_library enable row level security;
revoke all on public.vertice_inep_library from public,anon,authenticated;
grant select on public.vertice_inep_library to authenticated;
grant all on public.vertice_inep_library to service_role;
create policy vertice_inep_library_read on public.vertice_inep_library
 for select to authenticated
 using(active and vertice_private.can_read_institution(institution_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vertice-biblioteca-inep','vertice-biblioteca-inep',false,31457280,
 array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
-- Sem policies de Storage para anon/authenticated neste bucket.
-- Downloads sao autorizados pela API e emitidos por URL assinada de 300 s.
