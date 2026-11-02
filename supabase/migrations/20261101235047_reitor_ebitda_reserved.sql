-- Additive financial workspace. No existing institution, account or file is changed.
create function public.vertice_ebitda_access(target uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null
 and vertice_private.has_role(target,array['gestor'])
 and exists(select 1 from public.vertice_institutions i where i.id=target and i.status='ativa');
$$;
revoke all on function public.vertice_ebitda_access(uuid) from public,anon;
grant execute on function public.vertice_ebitda_access(uuid) to authenticated,service_role;

create table public.vertice_ebitda_calculations(
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 request_id uuid not null,
 body jsonb not null check(jsonb_typeof(body)='object'),
 result jsonb not null check(jsonb_typeof(result)='object'),
 file_name text not null check(length(file_name) between 1 and 200),
 object_path text not null check(length(object_path)<500),
 sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 size_bytes integer not null check(size_bytes between 1 and 15728640),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(institution_id,request_id),
 check(split_part(object_path,'/',1)=institution_id::text),
 check((result->>'ebitda')::numeric=round(
 (body->>'net_income')::numeric+(body->>'income_tax')::numeric+
 (body->>'financial_expenses')::numeric-(body->>'financial_income')::numeric+
 (body->>'depreciation')::numeric+(body->>'amortization')::numeric+(body->>'depletion')::numeric,2))
);
create index vertice_ebitda_institution_created on public.vertice_ebitda_calculations(institution_id,created_at desc);
alter table public.vertice_ebitda_calculations enable row level security;
revoke all on public.vertice_ebitda_calculations from public,anon,authenticated,service_role;
grant select on public.vertice_ebitda_calculations to authenticated;
grant select,insert on public.vertice_ebitda_calculations to service_role;
create policy vertice_ebitda_read on public.vertice_ebitda_calculations for select to authenticated
 using(public.vertice_ebitda_access(institution_id));
-- User clients cannot insert calculated results; the authenticated function recomputes them.
create function vertice_private.ebitda_immutable() returns trigger language plpgsql set search_path='' as $$
 begin raise exception 'O cálculo registrado é imutável; crie uma nova versão.'; end;
$$;
create trigger vertice_ebitda_immutable before update or delete on public.vertice_ebitda_calculations for each row execute function vertice_private.ebitda_immutable();
create function vertice_private.ebitda_audit() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.vertice_audit(actor,table_name,action,record_id)
 values(new.created_by,'vertice_ebitda_calculations','INSERT',new.id::text);
 return new;
 end;
$$;
create trigger vertice_ebitda_audit after insert on public.vertice_ebitda_calculations for each row execute function vertice_private.ebitda_audit();
revoke all on function vertice_private.ebitda_immutable(),vertice_private.ebitda_audit() from public,anon,authenticated;

create function vertice_private.ebitda_path_allowed(object_name text,writing boolean) returns boolean
language plpgsql stable security invoker set search_path='' as $$
 declare parts text[]:=string_to_array(object_name,'/');begin
 if cardinality(parts)<>4 or length(object_name)>500
 or parts[1]!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or parts[2]!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or parts[3]!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or parts[4]!~*'^[a-z0-9._-]+\.(pdf|xlsx|docx|csv)$' then return false; end if;
 if writing and parts[2] is distinct from auth.uid()::text then return false; end if;
 return public.vertice_ebitda_access(parts[1]::uuid);
 end;
$$;
revoke all on function vertice_private.ebitda_path_allowed(text,boolean) from public,anon;
grant execute on function vertice_private.ebitda_path_allowed(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vertice-dre','vertice-dre',false,15728640,array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv']);
create policy vertice_dre_insert on storage.objects for insert to authenticated
 with check(bucket_id='vertice-dre' and vertice_private.ebitda_path_allowed(name,true));
create policy vertice_dre_read on storage.objects for select to authenticated
 using(bucket_id='vertice-dre' and vertice_private.ebitda_path_allowed(name,false));
-- No anonymous access, object replacement, delete or public bucket.
