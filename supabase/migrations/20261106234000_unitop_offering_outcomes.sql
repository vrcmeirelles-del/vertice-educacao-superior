-- UNITOP: resultados agregados POR OFERTA, disciplina e docente (sem CPFs ou alunos nominativos).
-- Fonte homologável: UNITOP_Gestao_Completa_Reitor (1).xlsx, OneDrive UNITOP/Migração, 04/11/2026.
create table if not exists public.vertice_offering_outcomes (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
  source_name text not null,
  source_row integer not null check (source_row >= 0),
  semester text not null check (semester ~ '^20[0-9]{2}/0[12]$'),
  course_code text not null check (length(course_code) between 1 and 20),
  discipline text not null check (length(discipline) between 1 and 350),
  class_label text not null check (length(class_label) <= 160),
  academic_period text not null check (length(academic_period) <= 60),
  teachers text not null check (length(teachers) between 1 and 400),
  rf integer not null default 0 check (rf>=0),
  rn integer not null default 0 check (rn>=0),
  ra integer not null default 0 check (ra>=0),
  source_failures integer not null default 0 check (source_failures>=0 and source_failures=rf+rn+ra),
  discipline_enrollments integer not null default 0 check (discipline_enrollments>=0),
  passed_direct integer not null default 0 check (passed_direct>=0),
  passed_final integer not null default 0 check (passed_final>=0),
  avg_final numeric(7,3),
  other_status text not null default '' check (length(other_status)<=250),
  imported_at timestamptz not null default now(),
  unique(institution_id,source_name,source_row)
);
create index if not exists vx_offering_ies_course_sem on public.vertice_offering_outcomes (institution_id, course_code, semester);
create index if not exists vx_offering_ies_teacher on public.vertice_offering_outcomes (institution_id, teachers);
create index if not exists vx_offering_ies_discipline on public.vertice_offering_outcomes (institution_id, discipline);
alter table public.vertice_offering_outcomes enable row level security;
revoke all on public.vertice_offering_outcomes from public,anon,authenticated;
grant select on public.vertice_offering_outcomes to authenticated;
create policy vx_offering_high_management_read on public.vertice_offering_outcomes
  for select to authenticated
  using (
    (select vertice_private.is_master())
    or (
      vertice_private.can_read_institution(institution_id)
      and vertice_private.has_role(institution_id,array[
        'gestor','reitor','diretor_geral','diretor_pedagogico','procurador'
      ]::text[])
    )
  );
comment on table public.vertice_offering_outcomes is
  'Base agregada de oferta de disciplina por curso, semestre, turma, docentes. RF/RN/RA são ocorrências de reprovação em disciplinas, não alunos distintos. Sem dados pessoais estudantis.';
