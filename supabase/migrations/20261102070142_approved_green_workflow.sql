-- Extensão aditiva: não substitui nem remove dados do primeiro portal.
create table dd_private.green_backups(id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.vertice_institutions(id),created_at timestamptz not null default now(),body jsonb not null);
alter table dd_private.green_backups enable row level security;
revoke all on dd_private.green_backups from public,anon,authenticated;
insert into dd_private.green_backups(institution_id,body)
 select i.id,jsonb_build_object('matters',(select coalesce(jsonb_agg(m),'[]') from public.dd_matters m where m.institution_id=i.id),
 'states',(select coalesce(jsonb_agg(s),'[]') from public.dd_requirement_state s where s.institution_id=i.id),
 'documents',(select coalesce(jsonb_agg(s),'[]') from public.dd_documents s where s.institution_id=i.id),
 'links',(select coalesce(jsonb_agg(s),'[]') from public.dd_document_links s where s.institution_id=i.id),
 'findings',(select coalesce(jsonb_agg(s),'[]') from public.dd_findings s where s.institution_id=i.id),
 'workspace',(select coalesce(jsonb_agg(s),'[]') from public.dd_workspace s where s.institution_id=i.id),
 'members',(select coalesce(jsonb_agg(s),'[]') from public.dd_matter_members s where s.institution_id=i.id),
 'actions',(select coalesce(jsonb_agg(s),'[]') from public.dd_actions s where s.institution_id=i.id))
 from public.vertice_institutions i where exists(select 1 from public.dd_matters m where m.institution_id=i.id);
create or replace function dd_private.can_access(m uuid,writing boolean default false,front_code text default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dd_matter_members x where x.matter_id=m and x.user_id=auth.uid()
 and coalesce(auth.jwt()->>'aal','')='aal2' and x.revoked_at is null and x.expires_at>now() and x.role<>'wall_keeper'
 and (not writing or x.role in ('matter_lead','analyst'))
 and (cardinality(x.front_scope)=0 or (not writing and front_code is null) or front_code=any(x.front_scope)));
$$;
create function dd_private.green_lead(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dd_matter_members x where x.matter_id=m and x.user_id=auth.uid() and x.role='matter_lead' and x.revoked_at is null and x.expires_at>now() and coalesce(auth.jwt()->>'aal','')='aal2');$$;
create function public.dd_is_matter_lead(m uuid) returns boolean language sql stable security invoker set search_path='' as $$select dd_private.green_lead(m);$$;
revoke all on function dd_private.can_access(uuid,boolean,text),dd_private.green_lead(uuid),public.dd_is_matter_lead(uuid) from public,anon;
grant execute on function dd_private.can_access(uuid,boolean,text),dd_private.green_lead(uuid),public.dd_is_matter_lead(uuid) to authenticated;
grant select on public.dd_matters,public.dd_requirements,public.dd_instruments,public.dd_requirement_state,public.dd_documents,public.dd_document_links,public.dd_findings,public.dd_matter_members to authenticated;
create policy green_matters on public.dd_matters for select to authenticated using(dd_private.can_access(id));
create policy green_instruments on public.dd_instruments for select to authenticated using(coalesce(auth.jwt()->>'aal','')='aal2');
create policy green_requirements on public.dd_requirements for select to authenticated using(coalesce(auth.jwt()->>'aal','')='aal2');
create policy green_states on public.dd_requirement_state for select to authenticated using(dd_private.can_access(matter_id,false,(select r.front from public.dd_requirements r where r.id=requirement_id)));
create policy green_documents on public.dd_documents for select to authenticated using(purged_at is null and dd_private.can_access(matter_id,false,front) and (classification<>'privileged' or public.dd_is_matter_lead(matter_id)));
create policy green_links on public.dd_document_links for select to authenticated using(exists(select 1 from public.dd_requirement_state s where s.id=state_id and s.matter_id=dd_document_links.matter_id) and exists(select 1 from public.dd_documents d where d.id=document_id and d.matter_id=dd_document_links.matter_id));
create policy green_findings on public.dd_findings for select to authenticated using(dd_private.can_access(matter_id,false,front));
create policy green_members on public.dd_matter_members for select to authenticated using(dd_private.can_access(matter_id));
alter table public.dd_requirement_state add column answered_at timestamptz;
alter table public.dd_requirement_state add column answered_by uuid;
alter table public.dd_document_links add column template_id text;
create function dd_private.green_save_response(m uuid,r uuid,a text,attachments jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare f text;sid uuid;item jsonb;begin
 select q.front,s.id into f,sid from public.dd_requirements q join public.dd_requirement_state s on s.requirement_id=q.id where q.id=r and s.matter_id=m;
 if sid is null or not dd_private.can_access(m,true,f) then raise exception 'Requisito sem acesso autorizado.' using errcode='42501';end if;
 if length(trim(coalesce(a,'')))<1 or length(a)>30000 or jsonb_typeof(attachments)<>'array' or jsonb_array_length(attachments)>50 then raise exception 'Confira a resposta e os anexos.';end if;
 for item in select value from jsonb_array_elements(attachments) loop
  if not exists(select 1 from public.dd_documents d where d.id=(item->>'document_id')::uuid and d.matter_id=m and d.purged_at is null and dd_private.can_access(m,false,d.front) and (d.classification<>'privileged' or dd_private.green_lead(m))) then raise exception 'Anexo fora do acesso autorizado.';end if;
  insert into public.dd_document_links(matter_id,document_id,state_id,template_id,evidence_location) values(m,(item->>'document_id')::uuid,sid,nullif(item->>'template_id',''),left(item->>'location',2000)) on conflict(state_id,document_id) do update set template_id=excluded.template_id,evidence_location=excluded.evidence_location;
 end loop;
 update public.dd_requirement_state set answer=trim(a),answered_at=now(),answered_by=auth.uid(),updated_at=now(),received_at=coalesce(received_at,now()),status=case when status='finding' then status when status in ('compliant','not_applicable','in_review') then 'in_review'::public.dd_requirement_status else 'received'::public.dd_requirement_status end where id=sid;
end;$$;
create function public.dd_green_response(m uuid,r uuid,a text,attachments jsonb) returns void language sql security invoker set search_path='' as $$select dd_private.green_save_response(m,r,a,attachments);$$;
revoke all on function public.dd_green_response(uuid,uuid,text,jsonb),dd_private.green_save_response(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.dd_green_response(uuid,uuid,text,jsonb),dd_private.green_save_response(uuid,uuid,text,jsonb) to authenticated;
create function dd_private.green_create(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare person uuid; result jsonb;begin
 if not dd_private.master() then raise exception 'Somente master abre mandatos.' using errcode='42501';end if;
 if nullif(trim(payload->>'lead_email'),'') is not null then
 select id into person from auth.users where lower(email)=lower(trim(payload->>'lead_email')) and email_confirmed_at is not null;
 if person is null then raise exception 'O responsável precisa ter conta confirmada no portal.';end if;
 payload:=jsonb_set(payload,'{lead_user}',to_jsonb(person));end if;
 result:=public.dd_portal('create',null,payload);
 update public.dd_matters set title=coalesce(nullif(trim(payload->>'title'),''),title) where id=(result->>'id')::uuid;
 return (result->>'id')::uuid;
end;$$;
create function public.dd_green_create(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select dd_private.green_create(payload);$$;
revoke all on function public.dd_green_create(jsonb),dd_private.green_create(jsonb) from public,anon;
grant execute on function public.dd_green_create(jsonb),dd_private.green_create(jsonb) to authenticated;
create table dd_private.green_imports(id uuid primary key,institution_id uuid not null references public.vertice_institutions(id),token_hash text not null,manifest jsonb not null,expires_at timestamptz not null,sealed_at timestamptz,created_at timestamptz not null default now());
alter table dd_private.green_imports enable row level security;
revoke all on dd_private.green_imports from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vertice-aquisicoes-modelos','vertice-aquisicoes-modelos',false,15728640,array['application/json','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;


create table public.dd_case_profiles(matter_id uuid primary key references public.dd_matters(id),body jsonb not null,updated_by uuid,updated_at timestamptz not null default now());
create table public.dd_evidence_checks(id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.dd_matters(id),link_id uuid not null unique references public.dd_document_links(id),body jsonb not null,updated_by uuid,updated_at timestamptz not null default now());
create table public.dd_reviews(id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.dd_matters(id),state_id uuid not null unique references public.dd_requirement_state(id),basis_hash text not null,body jsonb not null,reviewed_by uuid,reviewed_at timestamptz not null default now());
create table public.dd_work_events(id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.dd_matters(id),body jsonb not null,created_by uuid,updated_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.dd_opinions(id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.dd_matters(id),basis_hash text not null,snapshot jsonb not null,report_text text not null,report_hash text not null,created_by uuid,created_at timestamptz not null default now());
create table public.dd_opinion_approvals(id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.dd_matters(id),opinion_id uuid not null unique references public.dd_opinions(id),body jsonb not null,approved_by uuid not null,approved_at timestamptz not null default now());
create table public.dd_workflow_audit(id bigserial primary key,matter_id uuid not null references public.dd_matters(id),entity text not null,entity_id text,operation text not null,old_value jsonb,new_value jsonb,actor_id uuid,created_at timestamptz not null default now());
create table public.dd_requirement_revisions(version text primary key,body jsonb not null,created_at timestamptz not null default now());
alter table public.dd_requirement_state add column structured_rows jsonb not null default '[]'::jsonb;
create function dd_private.workflow_log() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb; o jsonb; m uuid; begin
 if coalesce(current_setting('dd.green_migration',true),'')='on' then return coalesce(new,old);end if;
 if TG_OP<>'DELETE' then n=to_jsonb(new); end if;
 if TG_OP<>'INSERT' then o=to_jsonb(old); end if;
 m=coalesce((n->>'matter_id')::uuid,(o->>'matter_id')::uuid);
 insert into public.dd_workflow_audit(matter_id,entity,entity_id,operation,old_value,new_value,actor_id)
 values(m,TG_TABLE_NAME,coalesce(n->>'id',n->>'matter_id',o->>'id',o->>'matter_id'),TG_OP,o,n,auth.uid());
 return coalesce(new,old);
end; $$;
create function dd_private.workflow_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Registro histórico imutável.'; end; $$;
do $$ declare t text; begin
 foreach t in array array['dd_case_profiles','dd_evidence_checks','dd_reviews','dd_work_events','dd_opinions','dd_opinion_approvals','dd_workflow_audit','dd_requirement_revisions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['dd_requirement_state','dd_documents','dd_document_links','dd_findings','dd_case_profiles','dd_evidence_checks','dd_reviews','dd_work_events','dd_opinions','dd_opinion_approvals'] loop
 execute format('create trigger workflow_audit after insert or update or delete on public.%I for each row execute function dd_private.workflow_log()',t);
 end loop;
 foreach t in array array['dd_opinions','dd_opinion_approvals','dd_workflow_audit','dd_requirement_revisions'] loop
 execute format('create trigger immutable_record before update or delete on public.%I for each row execute function dd_private.workflow_immutable()',t);
 end loop;
end $$;
create policy read_profile on public.dd_case_profiles for select to authenticated using(dd_private.can_access(matter_id));
create policy read_checks on public.dd_evidence_checks for select to authenticated using(exists(select 1 from public.dd_document_links l where l.id=link_id and l.matter_id=dd_evidence_checks.matter_id));
create policy read_reviews on public.dd_reviews for select to authenticated using(exists(select 1 from public.dd_requirement_state s where s.id=state_id and s.matter_id=dd_reviews.matter_id));
create policy read_events on public.dd_work_events for select to authenticated using(dd_private.can_access(matter_id));
create policy read_opinions on public.dd_opinions for select to authenticated using(dd_private.can_access(matter_id) and public.dd_is_matter_lead(matter_id));
create policy read_approvals on public.dd_opinion_approvals for select to authenticated using(dd_private.can_access(matter_id) and public.dd_is_matter_lead(matter_id));
create policy read_audit on public.dd_workflow_audit for select to authenticated using(dd_private.can_access(matter_id) and public.dd_is_matter_lead(matter_id));
create policy read_revisions on public.dd_requirement_revisions for select to authenticated using(true);
revoke all on function dd_private.workflow_log(),dd_private.workflow_immutable() from public,anon,authenticated;

create table public.dd_valuations(matter_id uuid primary key references public.dd_matters(id),body jsonb not null,updated_by uuid,updated_at timestamptz not null default now());
alter table public.dd_valuations enable row level security;
revoke all on public.dd_valuations from public,anon,authenticated;
grant select on public.dd_valuations to authenticated;
create policy read_valuation on public.dd_valuations for select to authenticated using(dd_private.can_access(matter_id) and public.dd_is_matter_lead(matter_id));
create trigger workflow_audit after insert or update or delete on public.dd_valuations for each row execute function dd_private.workflow_log();

create table public.dd_ebitda_calculations(matter_id uuid primary key references public.dd_matters(id),body jsonb not null,updated_by uuid,updated_at timestamptz not null default now());
alter table public.dd_ebitda_calculations enable row level security;
revoke all on public.dd_ebitda_calculations from public,anon,authenticated;
grant select on public.dd_ebitda_calculations to authenticated;
create policy read_ebitda on public.dd_ebitda_calculations for select to authenticated using(dd_private.can_access(matter_id) and public.dd_is_matter_lead(matter_id));
create trigger workflow_audit after insert or update or delete on public.dd_ebitda_calculations for each row execute function dd_private.workflow_log();


-- Isolamento institucional para as tabelas novas do fluxo original.
do $$declare t text;begin
 foreach t in array array['dd_case_profiles','dd_evidence_checks','dd_reviews','dd_work_events','dd_opinions','dd_opinion_approvals','dd_workflow_audit','dd_valuations','dd_ebitda_calculations'] loop
 execute format('alter table public.%I add column institution_id uuid not null references public.vertice_institutions(id)',t);
 execute format('create trigger dd_tenant before insert or update on public.%I for each row execute function dd_private.tenant_guard()',t);
 execute format('create index on public.%I(institution_id,matter_id)',t);
 end loop;
end $$;
alter table public.dd_workflow_audit add column source_local_id bigint unique;
-- Comentários originais não ampliam o acesso de equipes parciais aos eventos.
drop policy read_events on public.dd_work_events;
create policy read_events on public.dd_work_events for select to authenticated using(dd_private.can_access(matter_id) and not exists(select 1 from jsonb_array_elements_text(body->'requirement_ids') q where not exists(select 1 from public.dd_requirement_state s where s.matter_id=dd_work_events.matter_id and s.requirement_id=q.value::uuid)));
notify pgrst,'reload schema';
