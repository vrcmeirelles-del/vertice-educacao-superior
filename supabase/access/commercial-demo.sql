-- Public demonstration: capability-scoped sessions; personal data readable by Master + MFA only.
create table public.vertice_demo_sessions (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique check(length(token_hash)=64),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null,
 remember boolean not null default false,
 consent_version text not null default 'demo-2026-11-02',
 profile jsonb not null default '{}'::jsonb,
 events jsonb not null default '[]'::jsonb,
 conversation jsonb not null default '[]'::jsonb,
 visits integer not null default 1,
 contact jsonb,
 confirmed_brief text,
 contact_at timestamptz,
 status text not null default 'novo' check(status in ('novo','em_contato','concluido'))
);
alter table public.vertice_demo_sessions enable row level security;
revoke all on public.vertice_demo_sessions from public, anon, authenticated;
grant all on public.vertice_demo_sessions to service_role;
grant select(id,created_at,updated_at,expires_at,remember,consent_version,profile,events,conversation,visits,contact,confirmed_brief,contact_at,status) on public.vertice_demo_sessions to authenticated;
grant update(status) on public.vertice_demo_sessions to authenticated;
create policy demo_master_read on public.vertice_demo_sessions for select to authenticated
 using (vertice_private.is_master() and expires_at>now() and (remember or contact_at is not null));
create policy demo_master_update on public.vertice_demo_sessions for update to authenticated
 using (vertice_private.is_master() and expires_at>now()) with check (vertice_private.is_master());
create index demo_sessions_expiry on public.vertice_demo_sessions(expires_at);
create index demo_sessions_updated on public.vertice_demo_sessions(updated_at desc);

create table vertice_private.demo_limits (
 day date not null default current_date, bucket text not null, used integer not null default 0,
 primary key(day,bucket)
);
revoke all on vertice_private.demo_limits from public,anon,authenticated;
grant all on vertice_private.demo_limits to service_role;
grant usage on schema vertice_private to service_role;

-- Only the Edge Function service credential can call this atomic boundary.
create function public.vertice_demo_mutate(op text,secret_hash text,p jsonb default '{}'::jsonb,rate_key text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.vertice_demo_sessions; n integer; b text; lim integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'access_denied'; end if;
 if secret_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_token'; end if;
 perform pg_advisory_xact_lock(6261102);
 delete from public.vertice_demo_sessions where expires_at<=now();
 delete from vertice_private.demo_limits where day<current_date-2;
 if op='start' then
  foreach b in array array['start:global','start:'||rate_key] loop
   lim:=case when b='start:global' then 500 else 25 end;
   insert into vertice_private.demo_limits(day,bucket,used) values(current_date,b,1)
    on conflict(day,bucket) do update set used=vertice_private.demo_limits.used+1 returning used into n;
   if n>lim then raise exception 'rate_limited';end if;
  end loop;
  insert into public.vertice_demo_sessions(token_hash,remember,expires_at)
   values(secret_hash,coalesce((p->>'remember')::boolean,false),now()+case when coalesce((p->>'remember')::boolean,false) then interval '90 days' else interval '1 hour' end) returning * into s;
 else
  select * into s from public.vertice_demo_sessions where token_hash=secret_hash for update;
  if s.id is null then raise exception 'session_expired';end if;
  if op='forget' then delete from public.vertice_demo_sessions where id=s.id;return '{"deleted":true}'::jsonb;end if;
  if op='chat_reserve' then
   foreach b in array array['chat:global','chat:session:'||s.id::text] loop
    lim:=case when b='chat:global' then 100 else 12 end;
    insert into vertice_private.demo_limits(day,bucket,used) values(current_date,b,1)
     on conflict(day,bucket) do update set used=vertice_private.demo_limits.used+1 returning used into n;
    if n>lim then raise exception 'rate_limited';end if;
   end loop;
  elsif op='update' then
   update public.vertice_demo_sessions set
    profile=profile||coalesce(p->'profile','{}'::jsonb),
    events=(select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) from jsonb_array_elements(events||coalesce(p->'events','[]'::jsonb)) with ordinality a(value,ord) where ord>greatest(0,jsonb_array_length(events||coalesce(p->'events','[]'::jsonb))-100)),
    conversation=coalesce(p->'conversation',conversation),
    visits=visits+case when p->>'visit'='true' then 1 else 0 end,
    updated_at=now() where id=s.id returning * into s;
  elsif op='contact' then
   update public.vertice_demo_sessions set contact=p->'contact',confirmed_brief=p->>'brief',contact_at=coalesce(contact_at,now()),expires_at=now()+interval '90 days',updated_at=now() where id=s.id returning * into s;
  elsif op<>'read' then raise exception 'invalid_operation';end if;
 end if;
 return to_jsonb(s)-'token_hash';
end;$$;
revoke all on function public.vertice_demo_mutate(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.vertice_demo_mutate(text,text,jsonb,text) to service_role;
