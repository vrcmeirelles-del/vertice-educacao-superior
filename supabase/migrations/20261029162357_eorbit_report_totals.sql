alter table public.vertice_enrollment_snapshots add column reported_total integer check(reported_total >= 0);
