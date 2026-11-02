begin;
create function vertice_private.validate_base_cnpj() returns trigger language plpgsql set search_path='' as $$
declare normalized text; digits text; total integer; remainder integer; pos integer; n integer; weights integer[];
begin
 if tg_op='UPDATE' and new.cnpj is not distinct from old.cnpj then return new;end if;
 if new.cnpj is null or trim(new.cnpj)='' then return new;end if;
 normalized:=upper(regexp_replace(new.cnpj,'[./[:space:]-]','','g'));
 if normalized !~ '^[A-Z0-9]{12}[0-9]{2}$' or normalized ~ '^([0-9])\1{13}$' then raise exception 'CNPJ completo inválido';end if;
 digits:=substr(normalized,1,12);
 for n in 1..2 loop
  weights:=case when n=1 then array[5,4,3,2,9,8,7,6,5,4,3,2] else array[6,5,4,3,2,9,8,7,6,5,4,3,2] end;
  total:=0;
  for pos in 1..length(digits) loop total:=total+(ascii(substr(digits,pos,1))-48)*weights[pos];end loop;
  remainder:=total%11;digits:=digits||case when remainder<2 then '0' else (11-remainder)::text end;
 end loop;
 if digits<>normalized then raise exception 'Dígitos verificadores do CNPJ inválidos';end if;
 new.cnpj:=normalized;return new;
end;$$;
revoke all on function vertice_private.validate_base_cnpj() from public,anon,authenticated;
create trigger validate_organization_cnpj before insert or update of cnpj on public.vertice_institutions for each row execute function vertice_private.validate_base_cnpj();
-- Additive tenant-scoped workspace. No changes to legacy evidence or mandates.
create table public.vertice_base_modules (
 institution_id uuid not null references public.vertice_institutions(id),
 module text not null check(module in ('base','biblioteca','documentos','aquisicoes','ebitda','valuation','governanca','assistente')),
 created_at timestamptz not null default now(), primary key(institution_id,module)
);
create table public.vertice_base_cycles (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.vertice_institutions(id),
 year integer not null check(year between 2000 and 2200), created_at timestamptz not null default now(),
 created_by uuid default auth.uid(), unique(institution_id,year), unique(institution_id,id)
);
create table public.vertice_base_records (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.vertice_institutions(id),
 cycle_id uuid not null, kind text not null check(kind in ('base','obrigacao','decisao','documento','valuation','revisao')),
 series_id uuid not null, revision integer not null check(revision>0), title text not null check(length(title) between 3 and 180),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=50000),
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
 foreign key(institution_id,cycle_id) references public.vertice_base_cycles(institution_id,id),
 unique(institution_id,series_id,revision)
);
create table public.vertice_base_ai_requests (
 id uuid primary key, institution_id uuid not null references public.vertice_institutions(id),
 actor uuid not null default auth.uid(), request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
alter table public.vertice_base_modules enable row level security;
alter table public.vertice_base_cycles enable row level security;
alter table public.vertice_base_records enable row level security;
alter table public.vertice_base_ai_requests enable row level security;
revoke all on public.vertice_base_modules,public.vertice_base_cycles,public.vertice_base_records,public.vertice_base_ai_requests from public,anon,authenticated;
grant select on public.vertice_base_modules,public.vertice_base_cycles,public.vertice_base_records to authenticated;
create policy base_modules_read on public.vertice_base_modules for select to authenticated using(vertice_private.has_role(institution_id,array['gestor']));
create policy base_cycles_read on public.vertice_base_cycles for select to authenticated using(vertice_private.has_role(institution_id,array['gestor']));
create policy base_records_read on public.vertice_base_records for select to authenticated using(vertice_private.has_role(institution_id,array['gestor']));

create function vertice_private.provision_base() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.vertice_base_modules(institution_id,module)
 select new.id,m from unnest(array['base','biblioteca','documentos','aquisicoes','ebitda','valuation','governanca','assistente']) m
 on conflict do nothing;
 insert into public.vertice_base_cycles(institution_id,year) values(new.id,extract(year from current_date)::int) on conflict do nothing;
 return new;
end;$$;
revoke all on function vertice_private.provision_base() from public,anon,authenticated;
create trigger provision_organization_base after insert on public.vertice_institutions for each row execute function vertice_private.provision_base();
insert into public.vertice_base_modules(institution_id,module)
 select i.id,m from public.vertice_institutions i cross join unnest(array['base','biblioteca','documentos','aquisicoes','ebitda','valuation','governanca','assistente']) m on conflict do nothing;
insert into public.vertice_base_cycles(institution_id,year)
 select id,extract(year from current_date)::int from public.vertice_institutions on conflict do nothing;

create function public.vertice_base_cycle(target uuid,exercise integer) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not vertice_private.has_role(target,array['gestor']) or not exists(select 1 from public.vertice_institutions where id=target and status='ativa') then raise exception 'access_denied' using errcode='42501';end if;
 if exercise<2000 or exercise>2200 or exercise is null then raise exception 'invalid_year';end if;
 insert into public.vertice_base_cycles(institution_id,year) values(target,exercise) on conflict do nothing;
 select id into result from public.vertice_base_cycles where institution_id=target and year=exercise;return result;
end;$$;

create function public.vertice_base_save(target uuid,cycle uuid,record_kind text,record_title text,payload jsonb,series uuid default null,expected_revision integer default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; current_revision integer; previous_kind text; previous_cycle uuid; sequence_id uuid:=coalesce(series,gen_random_uuid());
begin
 if not vertice_private.has_role(target,array['gestor']) or not exists(select 1 from public.vertice_institutions where id=target and status='ativa') then raise exception 'access_denied' using errcode='42501';end if;
 if not exists(select 1 from public.vertice_base_cycles where institution_id=target and id=cycle) then raise exception 'cycle_denied' using errcode='42501';end if;
 if record_kind is null or record_kind not in ('base','obrigacao','decisao','documento','valuation','revisao') or length(trim(record_title)) not between 3 and 180 or record_title is null or payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>50000 then raise exception 'invalid_record';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||sequence_id::text,0));
 select revision,kind,cycle_id into current_revision,previous_kind,previous_cycle from public.vertice_base_records where institution_id=target and series_id=sequence_id order by revision desc limit 1;
 if expected_revision is null or coalesce(current_revision,0)<>expected_revision or (current_revision is not null and (previous_kind<>record_kind or previous_cycle<>cycle)) then raise exception 'revision_conflict' using errcode='40001';end if;
 if exists(select 1 from public.vertice_base_records where institution_id=target and cycle_id=cycle and kind='revisao') then raise exception 'cycle_closed';end if;
 if record_kind='revisao' then
   payload:=jsonb_build_object('notice','Revisão interna, sem assinatura contratual ou certificação.','snapshot',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision) order by r.created_at,r.id) from public.vertice_base_records r where r.institution_id=target and r.cycle_id=cycle),'[]'::jsonb),'review_note',left(coalesce(payload->>'text',''),5000));
 end if;
 insert into public.vertice_base_records(institution_id,cycle_id,kind,series_id,revision,title,body)
 values(target,cycle,record_kind,sequence_id,coalesce(current_revision,0)+1,trim(record_title),payload) returning id into result;return result;
end;$$;

create function public.vertice_base_ai_reserve(target uuid,request uuid,request_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not vertice_private.has_role(target,array['gestor']) or not exists(select 1 from public.vertice_institutions where id=target and status='ativa') then raise exception 'access_denied' using errcode='42501';end if;
 if request is null or request_hash is null or request_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('base-ai-user:'||auth.uid()::text,0));
 perform pg_advisory_xact_lock(hashtextextended('base-ai-inst:'||target::text,0));
 if exists(select 1 from public.vertice_base_ai_requests where id=request) then raise exception 'already_requested';end if;
 if (select count(*) from public.vertice_base_ai_requests where actor=auth.uid() and created_at>=date_trunc('day',now()))>=5
 or (select count(*) from public.vertice_base_ai_requests where institution_id=target and created_at>=date_trunc('day',now()))>=25 then raise exception 'quota_exceeded';end if;
 insert into public.vertice_base_ai_requests(id,institution_id,request_hash) values(request,target,request_hash);
 return jsonb_build_object('institution_id',target,'courses',(select count(*) from public.vertice_courses where institution_id=target),'goals',(select count(*) from public.vertice_goals where institution_id=target),'actions',(select count(*) from public.vertice_actions where institution_id=target),'diagnosis',(select count(*) from public.vertice_diagnosis_items where institution_id=target),'cycles',(select count(*) from public.vertice_base_cycles where institution_id=target),'base_records',(select count(*) from public.vertice_base_records where institution_id=target),'observed_at',now());
end;$$;
revoke all on function public.vertice_base_cycle(uuid,integer), public.vertice_base_save(uuid,uuid,text,text,jsonb,uuid,integer), public.vertice_base_ai_reserve(uuid,uuid,text) from public,anon;
grant execute on function public.vertice_base_cycle(uuid,integer), public.vertice_base_save(uuid,uuid,text,text,jsonb,uuid,integer), public.vertice_base_ai_reserve(uuid,uuid,text) to authenticated;
commit;
