begin;
create table public.vertice_emec_snapshots (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 revision integer not null check(revision>0),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=2000000),
 fingerprint text not null,
 created_at timestamptz not null default now(), created_by uuid default auth.uid(),
 unique(institution_id,revision), unique(institution_id,fingerprint), unique(institution_id,id)
);
alter table public.vertice_emec_snapshots enable row level security;
revoke all on public.vertice_emec_snapshots from public,anon,authenticated;
grant select on public.vertice_emec_snapshots to authenticated;
create policy emec_read on public.vertice_emec_snapshots for select to authenticated using(vertice_private.can_read_institution(institution_id));
create function public.vertice_emec_import(target uuid,payload jsonb,expected_revision integer default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare current_revision integer; result uuid; code text; item jsonb; digest text;
begin
 if not vertice_private.has_role(target,array['gestor']) or not exists(select 1 from public.vertice_institutions where id=target and status='ativa') then raise exception 'access_denied' using errcode='42501';end if;
 select emec_code into code from public.vertice_institutions where id=target;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>2000000 or payload->>'version' is distinct from '1' or code is null or code='' or payload->>'emec_code' is distinct from code or coalesce(payload->>'coverage','') not in ('partial','complete') or coalesce(payload->>'source_url','') !~ '^https://emec[.]mec[.]gov[.]br/' or coalesce(payload->>'consulted_on','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or jsonb_typeof(payload->'gaps') is distinct from 'array' or jsonb_typeof(payload->'records') is distinct from 'array' then raise exception 'invalid_snapshot_identity_or_source';end if;
 if (payload->>'consulted_on')::date>current_date or jsonb_array_length(payload->'records') not between 1 and 5000 then raise exception 'invalid_snapshot_date_or_size';end if;
 if exists(select 1 from jsonb_array_elements(payload->'gaps') g where jsonb_typeof(g)<>'string') or (payload->>'coverage'='complete' and jsonb_array_length(payload->'gaps')>0) or (payload->>'coverage'='partial' and jsonb_array_length(payload->'gaps')=0) then raise exception 'invalid_coverage';end if;
 for item in select value from jsonb_array_elements(payload->'records') loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'kind','') not in ('institution','course','indicator','act','process','occurrence','address','attachment','alert') or length(coalesce(item->>'key','')) not between 1 and 200 or length(coalesce(item->>'title','')) not between 1 and 500 or jsonb_typeof(item->'data') is distinct from 'object' then raise exception 'invalid_record';end if;
 end loop;
 if (select count(*)<>count(distinct (r->>'kind',r->>'key')) from jsonb_array_elements(payload->'records') r) then raise exception 'duplicate_record_key';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||'emec',0));
 digest:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
 select id into result from public.vertice_emec_snapshots where institution_id=target and fingerprint=digest;
 if result is not null then return result;end if;
 select coalesce(max(revision),0) into current_revision from public.vertice_emec_snapshots where institution_id=target;
 if expected_revision is null or current_revision<>expected_revision then raise exception 'revision_conflict' using errcode='40001';end if;
 insert into public.vertice_emec_snapshots(institution_id,revision,body,fingerprint) values(target,current_revision+1,payload,digest) returning id into result;
 return result;
end;$$;
revoke all on function public.vertice_emec_import(uuid,jsonb,integer) from public,anon;
grant execute on function public.vertice_emec_import(uuid,jsonb,integer) to authenticated;
commit;
