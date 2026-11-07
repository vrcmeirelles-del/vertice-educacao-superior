-- Novo Instrumento INEP: checklist diagnóstico, evidências, ciclo trienal e prontidão da CPA.
-- Aditiva. Depende de vertice_institutions, vertice_courses, vertice_private.is_master(),
-- vertice_private.can_read_institution() e vertice_private.audit_change().
-- Ao registrar na linha de migrações do Supabase, renomear com o carimbo de data (AAAAMMDDHHMMSS_novo_instrumento.sql).
begin;

-- ------------------------------------------------------------ funções de escrita
-- Leitura segue a regra existente (can_read_institution). Escrita: master, gestor e equipe, com MFA.
create or replace function vertice_private.instrumento_can_record(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select auth.jwt()->>'aal') = 'aal2',false) and
 (vertice_private.is_master() or exists(
   select 1 from public.vertice_memberships
   where user_id=(select auth.uid()) and institution_id=target and role in ('gestor','equipe')));
$$;
create or replace function vertice_private.instrumento_can_remove(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select auth.jwt()->>'aal') = 'aal2',false) and
 (vertice_private.is_master() or exists(
   select 1 from public.vertice_memberships
   where user_id=(select auth.uid()) and institution_id=target and role = 'gestor'));
$$;
revoke all on function vertice_private.instrumento_can_record(uuid), vertice_private.instrumento_can_remove(uuid) from public, anon;
grant execute on function vertice_private.instrumento_can_record(uuid), vertice_private.instrumento_can_remove(uuid) to authenticated;

-- ------------------------------------------------------------ tabelas
create table public.vertice_instrumento_checklist (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 course_id uuid references public.vertice_courses(id), -- nulo = nível institucional
 dimension smallint not null check (dimension between 1 and 4),
 object_code text not null check (object_code ~ '^[1-4]\.[0-9]{1,2}$' and left(object_code,1) = dimension::text),
 status text not null default 'nao_avaliado' check (status in ('conforme','parcial','nao_conforme','nao_avaliado')),
 notes text check (notes is null or length(notes) <= 4000),
 responsible text check (responsible is null or length(responsible) <= 200),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
-- Um registro por objeto em cada escopo (institucional ou curso).
create unique index vertice_instrumento_checklist_scope_uq
 on public.vertice_instrumento_checklist(institution_id, coalesce(course_id,'00000000-0000-0000-0000-000000000000'::uuid), object_code);
create index vertice_instrumento_checklist_course_idx on public.vertice_instrumento_checklist(course_id);

create table public.vertice_instrumento_evidencias (
 id uuid primary key default gen_random_uuid(),
 checklist_id uuid not null references public.vertice_instrumento_checklist(id) on delete cascade,
 institution_id uuid not null references public.vertice_institutions(id),
 file_name text not null check (length(file_name) between 1 and 250),
 file_url text check (file_url is null or (file_url ~ '^https://' and length(file_url) <= 2000)),
 description text check (description is null or length(description) <= 2000),
 uploaded_at timestamptz not null default now(),
 uploaded_by uuid
);
create index vertice_instrumento_evidencias_institution_idx on public.vertice_instrumento_evidencias(institution_id);
create index vertice_instrumento_evidencias_checklist_idx on public.vertice_instrumento_evidencias(checklist_id);

create table public.vertice_instrumento_ciclo (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 cycle_number smallint not null default 1 check (cycle_number between 1 and 9), -- 1 = 2026-2028, 2 = 2029-2031
 milestone text not null check (length(milestone) between 1 and 80),
 target_year smallint not null check (target_year between 2024 and 2100),
 status text not null default 'pendente' check (status in ('pendente','em_andamento','concluido')),
 notes text check (notes is null or length(notes) <= 4000),
 updated_at timestamptz not null default now(),
 unique(institution_id, cycle_number, milestone)
);

create table public.vertice_instrumento_cpa (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 item text not null check (length(item) between 1 and 300),
 status text not null default 'pendente' check (status in ('pendente','em_andamento','concluido')),
 responsible text check (responsible is null or length(responsible) <= 200),
 deadline date,
 notes text check (notes is null or length(notes) <= 4000),
 updated_at timestamptz not null default now(),
 unique(institution_id, item)
);

-- ------------------------------------------------------------ gatilhos
create or replace function vertice_private.instrumento_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
 new.updated_at := now();
 if tg_table_name = 'vertice_instrumento_checklist' then new.updated_by := auth.uid(); end if;
 return new;
end; $$;

-- Impede vínculo entre instituições diferentes (curso e evidência).
create or replace function vertice_private.instrumento_check_scope() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_table_name = 'vertice_instrumento_checklist' and new.course_id is not null then
  if not exists(select 1 from public.vertice_courses where id = new.course_id and institution_id = new.institution_id) then
   raise exception 'O curso pertence a outra instituição' using errcode = '23514';
  end if;
 elsif tg_table_name = 'vertice_instrumento_evidencias' then
  if not exists(select 1 from public.vertice_instrumento_checklist where id = new.checklist_id and institution_id = new.institution_id) then
   raise exception 'O objeto avaliado pertence a outra instituição' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then new.uploaded_by := auth.uid(); end if;
 end if;
 return new;
end; $$;
revoke all on function vertice_private.instrumento_touch(), vertice_private.instrumento_check_scope() from public, anon, authenticated;

create trigger vertice_instrumento_checklist_touch before insert or update on public.vertice_instrumento_checklist for each row execute function vertice_private.instrumento_touch();
create trigger vertice_instrumento_ciclo_touch before insert or update on public.vertice_instrumento_ciclo for each row execute function vertice_private.instrumento_touch();
create trigger vertice_instrumento_cpa_touch before insert or update on public.vertice_instrumento_cpa for each row execute function vertice_private.instrumento_touch();
create trigger vertice_instrumento_checklist_scope before insert or update of institution_id, course_id on public.vertice_instrumento_checklist for each row execute function vertice_private.instrumento_check_scope();
create trigger vertice_instrumento_evidencias_scope before insert or update of institution_id, checklist_id on public.vertice_instrumento_evidencias for each row execute function vertice_private.instrumento_check_scope();

create trigger vertice_audit_instrumento_checklist after insert or update or delete on public.vertice_instrumento_checklist for each row execute function vertice_private.audit_change();
create trigger vertice_audit_instrumento_evidencias after insert or update or delete on public.vertice_instrumento_evidencias for each row execute function vertice_private.audit_change();
create trigger vertice_audit_instrumento_ciclo after insert or update or delete on public.vertice_instrumento_ciclo for each row execute function vertice_private.audit_change();
create trigger vertice_audit_instrumento_cpa after insert or update or delete on public.vertice_instrumento_cpa for each row execute function vertice_private.audit_change();

-- ------------------------------------------------------------ RLS
alter table public.vertice_instrumento_checklist enable row level security;
alter table public.vertice_instrumento_evidencias enable row level security;
alter table public.vertice_instrumento_ciclo enable row level security;
alter table public.vertice_instrumento_cpa enable row level security;
revoke all on public.vertice_instrumento_checklist, public.vertice_instrumento_evidencias, public.vertice_instrumento_ciclo, public.vertice_instrumento_cpa from anon, authenticated;
grant select, insert, update, delete on public.vertice_instrumento_checklist, public.vertice_instrumento_evidencias, public.vertice_instrumento_ciclo, public.vertice_instrumento_cpa to authenticated;

create policy vertice_instrumento_checklist_read on public.vertice_instrumento_checklist for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy vertice_instrumento_checklist_insert on public.vertice_instrumento_checklist for insert to authenticated with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_checklist_update on public.vertice_instrumento_checklist for update to authenticated using(vertice_private.instrumento_can_record(institution_id)) with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_checklist_delete on public.vertice_instrumento_checklist for delete to authenticated using(vertice_private.instrumento_can_remove(institution_id));

create policy vertice_instrumento_evidencias_read on public.vertice_instrumento_evidencias for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy vertice_instrumento_evidencias_insert on public.vertice_instrumento_evidencias for insert to authenticated with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_evidencias_update on public.vertice_instrumento_evidencias for update to authenticated using(vertice_private.instrumento_can_record(institution_id)) with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_evidencias_delete on public.vertice_instrumento_evidencias for delete to authenticated using(vertice_private.instrumento_can_remove(institution_id));

create policy vertice_instrumento_ciclo_read on public.vertice_instrumento_ciclo for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy vertice_instrumento_ciclo_insert on public.vertice_instrumento_ciclo for insert to authenticated with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_ciclo_update on public.vertice_instrumento_ciclo for update to authenticated using(vertice_private.instrumento_can_record(institution_id)) with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_ciclo_delete on public.vertice_instrumento_ciclo for delete to authenticated using(vertice_private.instrumento_can_remove(institution_id));

create policy vertice_instrumento_cpa_read on public.vertice_instrumento_cpa for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy vertice_instrumento_cpa_insert on public.vertice_instrumento_cpa for insert to authenticated with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_cpa_update on public.vertice_instrumento_cpa for update to authenticated using(vertice_private.instrumento_can_record(institution_id)) with check(vertice_private.instrumento_can_record(institution_id));
create policy vertice_instrumento_cpa_delete on public.vertice_instrumento_cpa for delete to authenticated using(vertice_private.instrumento_can_remove(institution_id));

commit;
