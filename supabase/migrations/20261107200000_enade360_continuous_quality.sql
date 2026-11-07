-- ENADE 360º: dados institucionais por curso. Nenhum curso recebe nota ou ciclo presumido.
-- A fonte de cursos é vertice_courses (inclui cursos adicionados no futuro).
create unique index if not exists vertice_courses_scope_key
  on public.vertice_courses (id, institution_id);

create table if not exists public.vertice_enade360_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
  course_id uuid not null,
  kind text not null check (kind in ('ciclo','competencia','diagnostico','resultado_oficial','evidencia')),
  title text not null check (char_length(title) between 3 and 250),
  competency text check (competency is null or char_length(competency) <= 250),
  cycle_year integer check (cycle_year is null or cycle_year between 2000 and 2100),
  assessment_date date,
  sample_size integer check (sample_size is null or sample_size >= 1),
  performance_percent numeric(5,2) check (performance_percent is null or performance_percent between 0 and 100),
  source_kind text not null default 'institucional' check (source_kind in ('institucional','oficial','espelho')),
  source_ref text check (source_ref is null or char_length(source_ref) <= 2000),
  evidence text check (evidence is null or char_length(evidence) <= 4000),
  notes text check (notes is null or char_length(notes) <= 4000),
  validation_status text not null default 'pendente'
    check (validation_status in ('pendente','validado','rejeitado')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enade360_course_scope_fk foreign key (course_id,institution_id)
    references public.vertice_courses(id,institution_id) on delete restrict,
  constraint enade360_validated_pair check (
    (validation_status <> 'validado' and validated_by is null and validated_at is null)
    or (validation_status = 'validado' and validated_by is not null and validated_at is not null)
  ),
  constraint enade360_official_evidence check (
    kind <> 'resultado_oficial' or (source_kind = 'oficial' and source_ref is not null and length(trim(source_ref)) > 0)
  ),
  constraint enade360_diagnostic_sample check (
    kind <> 'diagnostico' or (sample_size is not null and performance_percent is not null)
  )
);
create index if not exists vertice_enade360_institution_course_idx
  on public.vertice_enade360_records(institution_id,course_id,assessment_date desc);
create index if not exists vertice_enade360_kind_idx
  on public.vertice_enade360_records(institution_id,kind,validation_status);

alter table public.vertice_enade360_records enable row level security;

create policy enade360_read on public.vertice_enade360_records
 for select to authenticated
 using (vertice_private.can_read_institution(institution_id)
   and vertice_private.has_role(institution_id,array[
     'gestor','equipe','reitor','diretor_geral','diretor_pedagogico','procurador','cpa'
   ]));

-- A alta gestão e a CPA podem registrar insumos; perfis restritos a curso
-- aguardam a vinculação de permissões por curso, sem acesso cruzado.
create policy enade360_create_draft on public.vertice_enade360_records
 for insert to authenticated
 with check (
   vertice_private.can_read_institution(institution_id)
   and vertice_private.has_role(institution_id, array[
     'gestor','equipe','reitor','diretor_geral','diretor_pedagogico',
     'procurador','cpa'
   ])
   and validation_status='pendente'
   and validated_by is null and validated_at is null
   and created_by = (select auth.uid())
 );

-- Alteração, aprovação e rejeição reservadas à alta gestão com MFA.
create policy enade360_management_update on public.vertice_enade360_records
 for update to authenticated
 using (vertice_private.can_read_institution(institution_id)
   and vertice_private.has_role(institution_id,array[
     'gestor','reitor','diretor_geral','diretor_pedagogico','procurador'
   ]))
 with check (
   vertice_private.can_read_institution(institution_id)
   and vertice_private.has_role(institution_id,array[
     'gestor','reitor','diretor_geral','diretor_pedagogico','procurador'
   ])
   and (
      (validation_status in ('pendente','rejeitado') and validated_by is null and validated_at is null)
      or (validation_status='validado' and validated_by=(select auth.uid()) and validated_at is not null)
   )
 );

-- Sem política de DELETE: evidências históricas não são apagadas pela aplicação.
grant select,insert,update on public.vertice_enade360_records to authenticated;
