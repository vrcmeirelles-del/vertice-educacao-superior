-- Estruturas novas: não converte, substitui nem remove respostas e pareceres.
insert into dd_private.green_backups(institution_id,body)
select i.id,jsonb_build_object('stage','before_operation_forms_v3','states',(select coalesce(jsonb_agg(s),'[]') from dd_requirement_state s where s.institution_id=i.id),'reviews',(select coalesce(jsonb_agg(s),'[]') from dd_reviews s where s.institution_id=i.id),'opinions',(select coalesce(jsonb_agg(s),'[]') from dd_opinions s where s.institution_id=i.id))
from vertice_institutions i where exists(select 1 from dd_matters m where m.institution_id=i.id);

alter table public.dd_requirement_state add constraint dd_state_matter_identity unique(id,matter_id);
create table public.dd_form_answers(
 state_id uuid primary key,matter_id uuid not null references public.dd_matters(id),
 institution_id uuid not null references public.vertice_institutions(id),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=1500000),
 version integer not null check(version>0),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 foreign key(state_id,matter_id) references public.dd_requirement_state(id,matter_id)
);
create table public.dd_shared_data(
 matter_id uuid not null references public.dd_matters(id),key text not null,
 institution_id uuid not null references public.vertice_institutions(id),
 front_scope text[] not null check(cardinality(front_scope)>0 and front_scope <@ array['REG','QUA','ACA','FIN','TRIB','TRA','SOC','IMO','CON','DAD']::text[]),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=1500000),
 version integer not null check(version>0),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 primary key(matter_id,key),check(key in ('institution','courses','faculty','students','financial','contracts','disputes','premises','systems','privacy','tax'))
);
create index dd_form_answers_tenant on public.dd_form_answers(institution_id,matter_id);
create index dd_shared_data_tenant on public.dd_shared_data(institution_id,matter_id);
create index dd_forms_updated_by on public.dd_form_answers(updated_by);
create index dd_shared_updated_by on public.dd_shared_data(updated_by);
create function dd_private.shared_visible(m uuid,fronts text[]) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from unnest(fronts) f where dd_private.can_access(m,false,f));
$$;
revoke all on function dd_private.shared_visible(uuid,text[]) from public,anon;
grant execute on function dd_private.shared_visible(uuid,text[]) to authenticated;
alter table public.dd_form_answers enable row level security;
alter table public.dd_shared_data enable row level security;
revoke all on public.dd_form_answers,public.dd_shared_data from public,anon,authenticated;
grant select on public.dd_form_answers,public.dd_shared_data to authenticated;
create policy forms_read on public.dd_form_answers for select to authenticated using(exists(select 1 from public.dd_requirement_state s where s.id=state_id and s.matter_id=dd_form_answers.matter_id));
create policy shared_read on public.dd_shared_data for select to authenticated using(dd_private.shared_visible(matter_id,front_scope));
create trigger dd_tenant before insert or update on public.dd_form_answers for each row execute function dd_private.tenant_guard();
create trigger dd_tenant before insert or update on public.dd_shared_data for each row execute function dd_private.tenant_guard();
create trigger workflow_audit after insert or update or delete on public.dd_form_answers for each row execute function dd_private.workflow_log();
create trigger workflow_audit after insert or update or delete on public.dd_shared_data for each row execute function dd_private.workflow_log();
notify pgrst,'reload schema';
