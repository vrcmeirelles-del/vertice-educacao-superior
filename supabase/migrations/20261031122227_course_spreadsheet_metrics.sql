begin;
-- As fontes agregadas podem informar matrículas sem capacidade/disponibilidade por turma.
alter table public.vertice_enrollment_snapshots alter column capacity drop not null,alter column available drop not null;
alter table public.vertice_academic_reports drop constraint vertice_academic_reports_kind_check;
alter table public.vertice_academic_reports add constraint vertice_academic_reports_kind_check check(kind in ('cohorts','enrollment_continuity','status_series','course_indicators'));
commit;
