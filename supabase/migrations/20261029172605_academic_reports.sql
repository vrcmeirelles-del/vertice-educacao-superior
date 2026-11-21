create table public.vertice_academic_reports(
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 course_id uuid not null references public.vertice_courses(id),
 kind text not null check(kind in ('cohorts','enrollment_continuity')),
 source_label text not null,
 source_url text not null,
 source_report_at timestamptz not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 imported_at timestamptz not null default now(),
 unique(course_id,kind,source_report_at)
);
alter table public.vertice_academic_reports enable row level security;
revoke all on public.vertice_academic_reports from anon,authenticated;
grant select on public.vertice_academic_reports to authenticated;
create policy vertice_academic_report_read on public.vertice_academic_reports for select to authenticated using(vertice_private.can_read_institution(institution_id));
create index vertice_academic_reports_institution_idx on public.vertice_academic_reports(institution_id);
create trigger vertice_audit_academic_reports after insert or update or delete on public.vertice_academic_reports for each row execute function vertice_private.audit_change();
