-- Additive draft-only workflow. No repository evidence/review/coverage is changed.
begin;
create table public.vertice_minutes_drafts (
 id uuid primary key,
 institution_id uuid not null references public.vertice_institutions(id),
 course_id uuid not null references public.vertice_courses(id),
 source_library_id uuid not null references public.vertice_inep_library(id),
 title text not null check(length(trim(title)) between 1 and 250),
 body jsonb not null,
 version integer not null check(version > 0),
 mutation_id uuid not null,
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vertice_minutes_scope on public.vertice_minutes_drafts(institution_id,updated_at desc);
create table public.vertice_minutes_revisions (
 draft_id uuid not null references public.vertice_minutes_drafts(id),
 institution_id uuid not null references public.vertice_institutions(id),
 version integer not null,
 mutation_id uuid not null,
 snapshot jsonb not null,
 primary key(draft_id,version), unique(draft_id,mutation_id)
);
create index vertice_minutes_history_scope on public.vertice_minutes_revisions(institution_id,draft_id);
alter table public.vertice_minutes_drafts enable row level security;
alter table public.vertice_minutes_revisions enable row level security;
revoke all on public.vertice_minutes_drafts,public.vertice_minutes_revisions from public,anon,authenticated;
grant select on public.vertice_minutes_drafts,public.vertice_minutes_revisions to authenticated;
grant insert on public.vertice_minutes_drafts to authenticated;
grant update(title,body,version,mutation_id) on public.vertice_minutes_drafts to authenticated;
create policy minutes_read on public.vertice_minutes_drafts for select to authenticated using(vertice_private.can_read_institution(institution_id));
create policy minutes_create on public.vertice_minutes_drafts for insert to authenticated with check(vertice_private.has_role(institution_id,array['gestor','equipe']) and created_by=auth.uid());
create policy minutes_edit on public.vertice_minutes_drafts for update to authenticated
 using(vertice_private.has_role(institution_id,array['gestor']) or (created_by=auth.uid() and vertice_private.has_role(institution_id,array['equipe'])))
 with check(vertice_private.has_role(institution_id,array['gestor']) or (created_by=auth.uid() and vertice_private.has_role(institution_id,array['equipe'])));
create policy minutes_history_read on public.vertice_minutes_revisions for select to authenticated using(vertice_private.can_read_institution(institution_id));

-- Trigger runs as invoker: checks are applied even to direct Data API writes.
create function vertice_private.validate_minutes_draft() returns trigger
language plpgsql security invoker set search_path='' as $$
declare k text; lim integer; a jsonb; ids text[] := '{}';
begin
 if auth.uid() is null then raise exception 'authenticated actor required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.version<>1 then raise exception 'initial version must be 1' using errcode='23514'; end if;
  new.created_by:=auth.uid(); new.created_at:=clock_timestamp();
 else
  if new.version<>old.version+1 then raise exception 'version conflict' using errcode='40001'; end if;
  if (new.id,new.institution_id,new.course_id,new.source_library_id,new.created_by,new.created_at)
   is distinct from (old.id,old.institution_id,old.course_id,old.source_library_id,old.created_by,old.created_at)
  then raise exception 'immutable scope' using errcode='23514'; end if;
  if new.mutation_id=old.mutation_id then raise exception 'mutation reused' using errcode='23514'; end if;
 end if;
 new.updated_by:=auth.uid(); new.updated_at:=clock_timestamp();
 if not exists(select 1 from public.vertice_courses where id=new.course_id and institution_id=new.institution_id)
 then raise exception 'invalid course scope' using errcode='23514'; end if;
 if tg_op='INSERT' and not exists(select 1 from public.vertice_inep_library where id=new.source_library_id and institution_id=new.institution_id and active and not is_placeholder and format='docx' and code='D2-2.12-COL-02')
 then raise exception 'invalid library source' using errcode='23514'; end if;
 if jsonb_typeof(new.body) is distinct from 'object' or octet_length(new.body::text)>150000 then raise exception 'invalid body' using errcode='23514'; end if;
 if (select count(*) from jsonb_object_keys(new.body))<>15 or not new.body ?& array['meetingType','number','date','time','location','chair','secretary','quorum','agenda','previousMinutes','discussion','decisions','nextMeeting','participants','actions']
 then raise exception 'invalid fields' using errcode='23514'; end if;
 foreach k in array array['meetingType','number','date','time','location','chair','secretary','quorum','agenda','previousMinutes','discussion','decisions','nextMeeting','participants'] loop
  lim:=case k when 'meetingType' then 20 when 'number' then 80 when 'date' then 10 when 'time' then 5 when 'location' then 250 when 'chair' then 200 when 'secretary' then 200 when 'quorum' then 1000 when 'nextMeeting' then 500 when 'participants' then 4000 else 8000 end;
  if jsonb_typeof(new.body->k) is distinct from 'string' or length(new.body->>k)>lim then raise exception 'invalid text field' using errcode='23514'; end if;
 end loop;
 if new.body->>'meetingType' not in ('ordinaria','extraordinaria') or new.body->>'time' !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'invalid meeting type/time' using errcode='23514'; end if;
 if new.body->>'date'<>'' then
  if new.body->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid date' using errcode='23514'; end if;
  begin perform (new.body->>'date')::date; exception when others then raise exception 'invalid date' using errcode='23514'; end;
 end if;
 if jsonb_typeof(new.body->'actions') is distinct from 'array' then raise exception 'invalid actions' using errcode='23514'; end if;
 if jsonb_array_length(new.body->'actions')>100 then raise exception 'too many actions' using errcode='23514'; end if;
 for a in select value from jsonb_array_elements(new.body->'actions') loop
  if jsonb_typeof(a) is distinct from 'object' then raise exception 'invalid action' using errcode='23514'; end if;
  if (select count(*) from jsonb_object_keys(a))<>8 or not a ?& array['id','description','owner','due','status','evidence','origin','reason'] then raise exception 'invalid action fields' using errcode='23514'; end if;
  foreach k in array array['id','description','owner','due','status','evidence','origin','reason'] loop
   lim:=case k when 'id' then 36 when 'description' then 2000 when 'owner' then 200 when 'due' then 10 when 'status' then 20 when 'origin' then 200 else 1000 end;
   if jsonb_typeof(a->k) is distinct from 'string' or length(a->>k)>lim then raise exception 'invalid action text' using errcode='23514'; end if;
  end loop;
  if a->>'id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or a->>'id'=any(ids) or length(trim(a->>'description'))=0 or a->>'status' not in ('pendente','em_andamento','concluida','reprogramada','cancelada') then raise exception 'invalid action' using errcode='23514'; end if;
  ids:=array_append(ids,a->>'id');
  if a->>'due'<>'' then
   if a->>'due' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid due date' using errcode='23514'; end if;
   begin perform (a->>'due')::date; exception when others then raise exception 'invalid due date' using errcode='23514'; end;
  end if;
  if (a->>'status'='concluida' and length(trim(a->>'evidence'))=0)
   or (a->>'status' in ('cancelada','reprogramada') and length(trim(a->>'reason'))=0)
   or (a->>'status'='reprogramada' and a->>'due'='') then raise exception 'action requires evidence, reason or due date' using errcode='23514'; end if;
 end loop;
 return new;
end; $$;
revoke all on function vertice_private.validate_minutes_draft() from public,anon,authenticated;
create trigger minutes_validate before insert or update on public.vertice_minutes_drafts for each row execute function vertice_private.validate_minutes_draft();

-- Privileged only to append immutable audit/history; not callable via the Data API.
create function vertice_private.record_minutes_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.updated_by<>auth.uid() then raise exception 'actor required' using errcode='42501'; end if;
 insert into public.vertice_minutes_revisions(draft_id,institution_id,version,mutation_id,snapshot)
 values(new.id,new.institution_id,new.version,new.mutation_id,to_jsonb(new));
 insert into public.vertice_audit(actor,table_name,action,record_id) values(auth.uid(),'vertice_minutes_drafts',tg_op,new.id::text);
 return new;
end; $$;
revoke all on function vertice_private.record_minutes_revision() from public,anon,authenticated;
create trigger minutes_history after insert or update on public.vertice_minutes_drafts for each row execute function vertice_private.record_minutes_revision();

-- INVOKER preserves RLS. Advisory lock serializes a document's first creation as
-- well as retries; every update also checks its expected version server-side.
create function public.vertice_save_minutes_draft(p_id uuid,p_institution uuid,p_course uuid,p_source uuid,p_title text,p_body jsonb,p_expected integer,p_mutation uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare current_row public.vertice_minutes_drafts; prior jsonb;
begin
 if auth.uid() is null or not vertice_private.has_role(p_institution,array['gestor','equipe']) then raise exception 'permission denied' using errcode='42501'; end if;
 if p_id is null or p_institution is null or p_course is null or p_source is null or p_title is null or p_body is null or p_mutation is null or p_expected is null or p_expected<0 then raise exception 'invalid request' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into current_row from public.vertice_minutes_drafts where id=p_id and institution_id=p_institution;
 if found and not (vertice_private.has_role(p_institution,array['gestor']) or current_row.created_by=auth.uid()) then raise exception 'permission denied' using errcode='42501'; end if;
 select snapshot into prior from public.vertice_minutes_revisions where draft_id=p_id and institution_id=p_institution and mutation_id=p_mutation;
 if prior is not null then
  if prior->>'updated_by'<>auth.uid()::text or prior->>'title' is distinct from p_title or prior->'body' is distinct from p_body or prior->>'course_id' is distinct from p_course::text or prior->>'source_library_id' is distinct from p_source::text or (prior->>'version')::integer<>p_expected+1 then raise exception 'idempotency payload mismatch' using errcode='22023'; end if;
  return prior;
 end if;
 if current_row.id is null then
  if p_expected<>0 then raise exception 'version conflict' using errcode='40001'; end if;
  insert into public.vertice_minutes_drafts(id,institution_id,course_id,source_library_id,title,body,version,mutation_id,created_by,updated_by)
   values(p_id,p_institution,p_course,p_source,p_title,p_body,1,p_mutation,auth.uid(),auth.uid()) returning * into current_row;
 else
  if current_row.version<>p_expected then raise exception 'version conflict' using errcode='40001'; end if;
  if current_row.course_id is distinct from p_course or current_row.source_library_id is distinct from p_source then raise exception 'immutable scope' using errcode='23514'; end if;
  update public.vertice_minutes_drafts set title=p_title,body=p_body,version=p_expected+1,mutation_id=p_mutation
   where id=p_id and institution_id=p_institution returning * into current_row;
  if not found then raise exception 'permission denied' using errcode='42501'; end if;
 end if;
 return to_jsonb(current_row);
end; $$;
revoke all on function public.vertice_save_minutes_draft(uuid,uuid,uuid,uuid,text,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.vertice_save_minutes_draft(uuid,uuid,uuid,uuid,text,jsonb,integer,uuid) to authenticated;
comment on table public.vertice_minutes_drafts is 'Unsigned unapproved working drafts. Not repository evidence; no effect on academic governance or indicator coverage.';
commit;
