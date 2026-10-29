-- Área por instituição no painel /master (aditiva). Aplicada em produção em 29/10/2026.
alter table public.vertice_courses add column if not exists modality text check (modality in ('presencial','semipresencial','ead'));
-- O e-ORBIT informa vagas disponíveis negativas quando a turma passa da capacidade; o valor da origem é preservado.
alter table public.vertice_enrollment_snapshots drop constraint if exists vertice_enrollment_snapshots_available_check;
alter table public.vertice_academic_reports drop constraint if exists vertice_academic_reports_kind_check;
alter table public.vertice_academic_reports add constraint vertice_academic_reports_kind_check check (kind in ('cohorts','enrollment_continuity','status_series'));
