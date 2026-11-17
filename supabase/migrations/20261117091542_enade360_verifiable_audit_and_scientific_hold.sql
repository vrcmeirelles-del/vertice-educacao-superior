-- Existing events remain unchanged. Version 1 BASELINE has a documented formula;
-- version 1 INSERT/UPDATE lacks the exact timestamp material and is not verifiable.
alter table vertice_enade_audit.record_events
  add column hash_version smallint not null default 1
  check (hash_version in (1,2));

create function vertice_enade_audit.canonical_event(e vertice_enade_audit.record_events)
returns text language sql immutable set search_path = '' as $$
 select pg_catalog.jsonb_build_object(
   'version',e.hash_version,'record_id',e.record_id,
   'institution_id',e.institution_id,'course_id',e.course_id,
   'event_type',e.event_type,'actor_id',e.actor_id,
   'source_kind',e.source_kind,'source_ref_hash',e.source_ref_hash,
   'validation_status',e.validation_status,'row_sha256',e.row_sha256,
   'previous_event_sha256',e.previous_event_sha256,
   'recorded_at_epoch',extract(epoch from e.recorded_at)
 )::text;
$$;
revoke all on function vertice_enade_audit.canonical_event(vertice_enade_audit.record_events)
 from public,anon,authenticated;

create or replace function vertice_enade_audit.capture_record_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare e vertice_enade_audit.record_events%rowtype;
begin
 if tg_op not in ('INSERT','UPDATE') then raise exception 'unsupported audit event'; end if;
 -- The row is already locked by INSERT/UPDATE. Updates to a record serialize,
 -- so selecting its last event here preserves a single chain for that record.
 e.record_id:=new.id; e.institution_id:=new.institution_id; e.course_id:=new.course_id;
 e.event_type:=tg_op; e.actor_id:=(select auth.uid()); e.source_kind:=new.source_kind;
 e.validation_status:=new.validation_status; e.hash_version:=2; e.recorded_at:=clock_timestamp();
 select a.event_sha256 into e.previous_event_sha256
   from vertice_enade_audit.record_events a where a.record_id=new.id order by a.id desc limit 1;
 e.row_sha256:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.to_jsonb(new)::text,'UTF8'),'sha256'),'hex');
 e.source_ref_hash:=case when new.source_ref is null then null else
   pg_catalog.encode(extensions.digest(pg_catalog.convert_to(new.source_ref,'UTF8'),'sha256'),'hex') end;
 e.event_sha256:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(vertice_enade_audit.canonical_event(e),'UTF8'),'sha256'),'hex');
 insert into vertice_enade_audit.record_events
   (record_id,institution_id,course_id,event_type,actor_id,source_kind,source_ref_hash,
    validation_status,row_sha256,previous_event_sha256,event_sha256,recorded_at,hash_version)
 values (e.record_id,e.institution_id,e.course_id,e.event_type,e.actor_id,e.source_kind,
   e.source_ref_hash,e.validation_status,e.row_sha256,e.previous_event_sha256,e.event_sha256,e.recorded_at,e.hash_version);
 return new;
end;
$$;
revoke all on function vertice_enade_audit.capture_record_event() from public,anon,authenticated;

-- This is a hold, not a substitute approval workflow. A separately reviewed
-- migration is required to release official results after scientific acceptance
-- and explicit, auditable human publication authorization.
create function vertice_enade_audit.hold_official_validation()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.kind='resultado_oficial' and new.validation_status='validado' then
   raise exception using errcode='23514',message='ENADE360_SCIENTIFIC_HOLD: homologacao cientifica e autorizacao humana pendentes';
 end if;
 return new;
end;
$$;
revoke all on function vertice_enade_audit.hold_official_validation() from public,anon,authenticated;
create trigger enade360_scientific_hold before insert or update
 on public.vertice_enade360_records for each row
 execute function vertice_enade_audit.hold_official_validation();
