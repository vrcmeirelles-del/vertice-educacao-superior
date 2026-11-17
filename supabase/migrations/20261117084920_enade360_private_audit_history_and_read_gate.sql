create schema if not exists vertice_enade_audit;
revoke all on schema vertice_enade_audit from public, anon, authenticated;

create table if not exists vertice_enade_audit.record_events (
  id bigint generated always as identity primary key,
  record_id uuid not null references public.vertice_enade360_records(id) on delete restrict,
  institution_id uuid not null,
  course_id uuid not null,
  event_type text not null check (event_type in ('BASELINE','INSERT','UPDATE')),
  actor_id uuid,
  source_kind text,
  source_ref_hash text,
  validation_status text not null,
  row_sha256 text not null check (row_sha256 ~ '^[a-f0-9]{64}$'),
  previous_event_sha256 text,
  event_sha256 text not null check (event_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default clock_timestamp()
);
create index if not exists enade_audit_record_history_idx on vertice_enade_audit.record_events(record_id,id);
create index if not exists enade_audit_scope_idx on vertice_enade_audit.record_events(institution_id,course_id,id);
alter table vertice_enade_audit.record_events enable row level security;
revoke all on vertice_enade_audit.record_events from public, anon, authenticated;
revoke all on all sequences in schema vertice_enade_audit from public, anon, authenticated;

create or replace function vertice_enade_audit.capture_record_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prior text;
  row_hash text;
  src_hash text;
  event_kind text;
  event_hash text;
begin
  if tg_op not in ('INSERT','UPDATE') then
    raise exception 'unsupported audit event';
  end if;
  select e.event_sha256 into prior
    from vertice_enade_audit.record_events e
   where e.record_id = new.id
   order by e.id desc limit 1;
  row_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.to_jsonb(new)::text,'UTF8'),'sha256'),'hex');
  src_hash := case when new.source_ref is null then null
        else pg_catalog.encode(extensions.digest(pg_catalog.convert_to(new.source_ref,'UTF8'),'sha256'),'hex') end;
  event_kind := tg_op;
  event_hash := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(
      new.id::text || ':' || event_kind || ':' || row_hash || ':' || coalesce(prior,'GENESIS') || ':' || clock_timestamp()::text,
      'UTF8'),'sha256'),'hex');
  insert into vertice_enade_audit.record_events
    (record_id,institution_id,course_id,event_type,actor_id,source_kind,
      source_ref_hash,validation_status,row_sha256,previous_event_sha256,event_sha256)
    values (new.id,new.institution_id,new.course_id,event_kind,(select auth.uid()),new.source_kind,
      src_hash,new.validation_status,row_hash,prior,event_hash);
  return new;
end $$;
revoke all on function vertice_enade_audit.capture_record_event() from public, anon, authenticated;
drop trigger if exists vertice_enade360_audit_capture on public.vertice_enade360_records;
create trigger vertice_enade360_audit_capture after insert or update
on public.vertice_enade360_records for each row
execute function vertice_enade_audit.capture_record_event();

insert into vertice_enade_audit.record_events
  (record_id,institution_id,course_id,event_type,actor_id,source_kind,
   source_ref_hash,validation_status,row_sha256,previous_event_sha256,event_sha256)
select r.id,r.institution_id,r.course_id,'BASELINE',null,r.source_kind,
  case when r.source_ref is null then null else pg_catalog.encode(extensions.digest(pg_catalog.convert_to(r.source_ref,'UTF8'),'sha256'),'hex') end,
  r.validation_status,
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.to_jsonb(r)::text,'UTF8'),'sha256'),'hex'),
  null,
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(r.id::text || ':BASELINE:' ||
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.to_jsonb(r)::text,'UTF8'),'sha256'),'hex')
  || ':GENESIS','UTF8'),'sha256'),'hex')
from public.vertice_enade360_records r
where not exists(select 1 from vertice_enade_audit.record_events e where e.record_id=r.id);

create or replace function public.vertice_enade360_audit_history(target_record uuid)
returns table(event_id bigint,event_type text,validation_status text,row_sha256 text,
              previous_event_sha256 text,event_sha256 text,recorded_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare inst uuid; course uuid; permitted boolean:=false;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'') <> 'aal2' then return; end if;
 select r.institution_id,r.course_id into inst,course from public.vertice_enade360_records r where r.id=target_record;
 if inst is null then return; end if;
 permitted := (
   vertice_private.is_master() or
   exists(select 1 from public.vertice_memberships m
     where m.user_id=(select auth.uid()) and m.institution_id=inst and m.role='gestor')
   or exists(select 1 from public.vertice_impacto_roles ir
     where ir.user_id=(select auth.uid()) and ir.institution_id=inst
       and ir.active is true and (ir.expires_at is null or ir.expires_at>now())
       and (ir.role in ('reitor','direcao','pro_reitoria','diretor_pedagogico')
         or (ir.role in ('coordenador_curso','nde') and ir.course_id=course)))
 );
 if not permitted then return; end if;
 return query
  select e.id,e.event_type,e.validation_status,e.row_sha256,
         e.previous_event_sha256,e.event_sha256,e.recorded_at
  from vertice_enade_audit.record_events e where e.record_id=target_record
  order by e.id;
end $$;
revoke all on function public.vertice_enade360_audit_history(uuid) from public, anon;
grant execute on function public.vertice_enade360_audit_history(uuid) to authenticated;
