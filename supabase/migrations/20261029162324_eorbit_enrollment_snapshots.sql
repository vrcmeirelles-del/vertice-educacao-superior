create table public.vertice_enrollment_snapshots (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 course_id uuid not null references public.vertice_courses(id),
 semester text not null check (semester ~ '^[0-9]{4}/0[12]$'),
 student_status text not null,
 class_label text not null,
 enrolled integer not null check(enrolled >= 0),
 capacity integer not null check(capacity >= 0),
 available integer not null check(available >= 0),
 source_url text not null,
 source_report_at timestamptz not null,
 imported_at timestamptz not null default now(),
 unique(course_id,semester,student_status,class_label,source_report_at)
);
alter table public.vertice_enrollment_snapshots enable row level security;
revoke all on public.vertice_enrollment_snapshots from anon,authenticated;
grant select on public.vertice_enrollment_snapshots to authenticated;
create policy vertice_enrollment_read on public.vertice_enrollment_snapshots for select to authenticated
 using(vertice_private.can_read_institution(institution_id));
create index vertice_enrollment_institution_idx on public.vertice_enrollment_snapshots(institution_id);
create trigger vertice_audit_enrollment after insert or update or delete on public.vertice_enrollment_snapshots
 for each row execute function vertice_private.audit_change();
alter function vertice_app.audit_log_immutable() set search_path = '';
alter function vertice_app.document_access_log_immutable() set search_path = '';
create or replace function vertice_app.evidence_document_requires_clean_document()
 returns trigger language plpgsql set search_path = '' as $$
declare doc_status vertice_app.document_scan_status; doc_institution uuid;
begin
 select scan_status,institution_id into doc_status,doc_institution from vertice_app.documents where id=new.document_id;
 if doc_institution is distinct from new.institution_id then raise exception 'documento pertence a outra instituição'; end if;
 if doc_status <> 'clean' then raise exception 'documento % não está aprovado (status=%)',new.document_id,doc_status; end if;
 return new;
end; $$;
