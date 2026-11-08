-- Reprodutibilidade: esquema aplicado no Supabase da Vértice em 08/11/2026.
-- Apenas vínculos de metadados com fonte única; não duplica arquivos nem concede conceito regulatório.
begin;
create table if not exists public.vertice_instrumento_correspondencias (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 source_file_id uuid not null references public.vertice_repository_files(id) on delete cascade,
 target_object_code text not null check (target_object_code ~ '^E[1-5][.][0-9]{1,2}$'),
 suggestion_status text not null default 'sugerido' check (suggestion_status in ('sugerido','confirmado','descartado')),
 confidence numeric(4,3) not null check (confidence between 0 and 1),
 method text not null check (method in ('ai_metadata','heuristic_metadata','manual')),
 rationale text not null check (length(rationale) between 5 and 1200),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 unique(source_file_id,target_object_code)
);
create index if not exists vertice_inst_corresp_inst on public.vertice_instrumento_correspondencias(institution_id,suggestion_status);
create or replace function vertice_private.check_instrumento_correspondencia()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_inst uuid; v_course uuid;
begin
 select f.institution_id,r.course_id into v_inst,v_course
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id
 where f.id=new.source_file_id and r.institution_id=f.institution_id;
 if v_inst is null or new.institution_id is distinct from v_inst or v_course is not null then
  raise exception 'Evidencia não institucional ou de outra IES' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
  if new.institution_id is distinct from old.institution_id
   or new.source_file_id is distinct from old.source_file_id
   or new.target_object_code is distinct from old.target_object_code
  then raise exception 'Vínculo imutável' using errcode='23514'; end if;
  if new.suggestion_status is distinct from old.suggestion_status then
   new.reviewed_by=auth.uid();new.reviewed_at=now();
  end if;
 end if;
 new.updated_at=now(); return new;
end $$;
revoke all on function vertice_private.check_instrumento_correspondencia() from public,anon,authenticated;
drop trigger if exists vertice_inst_corresp_check on public.vertice_instrumento_correspondencias;
create trigger vertice_inst_corresp_check before insert or update on public.vertice_instrumento_correspondencias
 for each row execute function vertice_private.check_instrumento_correspondencia();
alter table public.vertice_instrumento_correspondencias enable row level security;
revoke all on public.vertice_instrumento_correspondencias from public,anon,authenticated;
grant select,insert,update(suggestion_status) on public.vertice_instrumento_correspondencias to authenticated;
drop policy if exists inst_corresp_read on public.vertice_instrumento_correspondencias;
drop policy if exists inst_corresp_create on public.vertice_instrumento_correspondencias;
drop policy if exists inst_corresp_review on public.vertice_instrumento_correspondencias;
create policy inst_corresp_read on public.vertice_instrumento_correspondencias for select to authenticated
 using(vertice_private.can_read_institution(institution_id));
create policy inst_corresp_create on public.vertice_instrumento_correspondencias for insert to authenticated
 with check(vertice_private.instrumento_can_record(institution_id) and suggestion_status='sugerido');
create policy inst_corresp_review on public.vertice_instrumento_correspondencias for update to authenticated
 using(vertice_private.instrumento_can_record(institution_id))
 with check(vertice_private.instrumento_can_record(institution_id));
drop trigger if exists vertice_inst_corresp_audit on public.vertice_instrumento_correspondencias;
create trigger vertice_inst_corresp_audit after insert or update or delete on public.vertice_instrumento_correspondencias
 for each row execute function vertice_private.audit_change();
commit;