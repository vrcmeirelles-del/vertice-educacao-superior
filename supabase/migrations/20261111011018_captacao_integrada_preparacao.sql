-- Phase 1 only. Local/homologation first; never apply remotely just because this file exists.
-- No credentials, contacts, OAuth, ingestion, messages, or changes to academic connections.
begin;
create function vertice_private.can_manage_captacao(target uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal' = 'aal2',false)
 and vertice_private.has_role(target,array['gestor'])
 and exists(select 1 from public.vertice_institutions where id=target and status='ativa');
$$;
revoke all on function vertice_private.can_manage_captacao(uuid) from public,anon;
grant execute on function vertice_private.can_manage_captacao(uuid) to authenticated;
create function public.vertice_captacao_access(p_institution uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
 select vertice_private.can_manage_captacao(p_institution);
$$;
revoke all on function public.vertice_captacao_access(uuid) from public,anon;
grant execute on function public.vertice_captacao_access(uuid) to authenticated;

create function vertice_private.captacao_public_url(provider text,value text) returns boolean
language sql immutable set search_path = '' as $$
 select coalesce(length(value) between 1 and 500 and case provider
 when 'meta' then value ~ '^https://(www\.)?(instagram\.com|facebook\.com)/[A-Za-z0-9_./-]+$'
 when 'tiktok' then value ~ '^https://(www\.)?tiktok\.com/@?[A-Za-z0-9_./-]+$'
 else false end,false);
$$;
create function vertice_private.captacao_landing_url(value text) returns boolean
language sql immutable set search_path = '' as $$
 select coalesce(length(value) between 1 and 500 and value ~ '^https://([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(/[A-Za-z0-9_./~-]*)?$',false);
$$;
revoke all on function vertice_private.captacao_public_url(text,text),vertice_private.captacao_landing_url(text) from public,anon;
grant execute on function vertice_private.captacao_public_url(text,text),vertice_private.captacao_landing_url(text) to authenticated;

create table public.vertice_captacao_connections (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 provider text not null check(provider in ('meta','tiktok')),
 label text not null check(length(trim(label)) between 1 and 160 and label !~ '[[:cntrl:]]'),
 public_url text not null,
 account_external_id text check(account_external_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
 -- These are facts unavailable in this phase, even to a browser Master.
 status text not null default 'prepared' check(status='prepared'),
 last_test_at timestamptz check(last_test_at is null),
 last_successful_sync_at timestamptz check(last_successful_sync_at is null),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(institution_id,id),
 check(vertice_private.captacao_public_url(provider,public_url))
);
create unique index captacao_account_once on public.vertice_captacao_connections(institution_id,provider,account_external_id) where account_external_id is not null;
create table public.vertice_captacao_assets (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 connection_id uuid not null,
 kind text not null check(kind in ('page','form')),
 external_id text not null check(external_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
 label text not null check(length(trim(label)) between 1 and 160 and label !~ '[[:cntrl:]]'),
 verification text not null default 'unverified' check(verification='unverified'),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(institution_id,connection_id,id),unique(institution_id,connection_id,kind,external_id),
 foreign key(institution_id,connection_id) references public.vertice_captacao_connections(institution_id,id)
);
create table public.vertice_captacao_campaigns (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 connection_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 160 and name !~ '[[:cntrl:]]'),
 external_campaign_id text check(external_campaign_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
 capture_mode text not null check(capture_mode in ('landing','native')),
 public_url text,
 form_asset_id uuid,
 status text not null default 'draft' check(status in ('draft','archived')),
 verification text not null default 'unverified' check(verification='unverified'),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(institution_id,connection_id) references public.vertice_captacao_connections(institution_id,id),
 foreign key(institution_id,connection_id,form_asset_id) references public.vertice_captacao_assets(institution_id,connection_id,id),
 check((capture_mode='landing' and form_asset_id is null and public_url is not null and vertice_private.captacao_landing_url(public_url))
    or (capture_mode='native' and form_asset_id is not null and public_url is null))
);
create unique index captacao_campaign_external_once on public.vertice_captacao_campaigns(institution_id,connection_id,external_campaign_id) where external_campaign_id is not null;
create index captacao_connection_ies on public.vertice_captacao_connections(institution_id,id);
create index captacao_asset_ies on public.vertice_captacao_assets(institution_id,id);
create index captacao_campaign_ies on public.vertice_captacao_campaigns(institution_id,id);
create index captacao_campaign_form on public.vertice_captacao_campaigns(institution_id,connection_id,form_asset_id);

create function vertice_private.captacao_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.institution_id<>old.institution_id or new.created_at<>old.created_at then
   raise exception 'Identidade e instituição imutáveis' using errcode='23514';
  end if;
  if new.version<>old.version+1 then
   raise exception 'Versão desatualizada; atualize e revise' using errcode='40001';
  end if;
  if tg_table_name='vertice_captacao_connections' then
   if new.provider<>old.provider then raise exception 'Provedor imutável' using errcode='23514'; end if;
  end if;
  if tg_table_name='vertice_captacao_assets' then
   if new.connection_id<>old.connection_id or new.kind<>old.kind then raise exception 'Vínculo do ativo imutável' using errcode='23514'; end if;
  end if;
 end if;
 if tg_table_name='vertice_captacao_campaigns' then
 if new.form_asset_id is not null then
  if not exists(select 1 from public.vertice_captacao_assets a where a.institution_id=new.institution_id and a.connection_id=new.connection_id and a.id=new.form_asset_id and a.kind='form') then
   raise exception 'Formulário inválido para esta conexão' using errcode='23514';
  end if;
 end if;
 end if;
 new.updated_at:=now();
 return new;
end; $$;
revoke all on function vertice_private.captacao_guard() from public,anon,authenticated;

-- Private audit has IDs and operations only; no labels, URLs, account IDs, or body.
create table vertice_private.captacao_setup_audit (
 id bigint generated always as identity primary key,
 institution_id uuid not null references public.vertice_institutions(id),
 actor uuid not null,entity text not null,record_id uuid not null,operation text not null,version integer not null,occurred_at timestamptz not null default now()
);
alter table vertice_private.captacao_setup_audit enable row level security;
revoke all on vertice_private.captacao_setup_audit from public,anon,authenticated;
create function vertice_private.captacao_audit_setup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not vertice_private.can_manage_captacao(new.institution_id) then
  raise exception 'Operador não autorizado' using errcode='42501';
 end if;
 insert into vertice_private.captacao_setup_audit(institution_id,actor,entity,record_id,operation,version)
 values(new.institution_id,auth.uid(),tg_table_name,new.id,tg_op,new.version);
 return new;
end; $$;
revoke all on function vertice_private.captacao_audit_setup() from public,anon,authenticated;

do $$declare tab text;
begin
 foreach tab in array array['vertice_captacao_connections','vertice_captacao_assets','vertice_captacao_campaigns'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('create policy captacao_setup_read on public.%I for select to authenticated using(vertice_private.can_manage_captacao(institution_id))',tab);
  execute format('create policy captacao_setup_insert on public.%I for insert to authenticated with check(vertice_private.can_manage_captacao(institution_id))',tab);
  execute format('create policy captacao_setup_update on public.%I for update to authenticated using(vertice_private.can_manage_captacao(institution_id)) with check(vertice_private.can_manage_captacao(institution_id))',tab);
  execute format('create trigger captacao_setup_guard before insert or update on public.%I for each row execute function vertice_private.captacao_guard()',tab);
  execute format('create trigger captacao_setup_audit after insert or update on public.%I for each row execute function vertice_private.captacao_audit_setup()',tab);
 end loop;
end$$;
grant insert(id,institution_id,provider,label,public_url,account_external_id) on public.vertice_captacao_connections to authenticated;
grant update(label,public_url,account_external_id,version) on public.vertice_captacao_connections to authenticated;
grant insert(id,institution_id,connection_id,kind,external_id,label) on public.vertice_captacao_assets to authenticated;
grant update(external_id,label,version) on public.vertice_captacao_assets to authenticated;
grant insert(id,institution_id,connection_id,name,public_url,external_campaign_id,capture_mode,form_asset_id,status) on public.vertice_captacao_campaigns to authenticated;
grant update(connection_id,name,public_url,external_campaign_id,capture_mode,form_asset_id,status,version) on public.vertice_captacao_campaigns to authenticated;
comment on table public.vertice_captacao_connections is 'Preparação manual, múltiplas contas por IES. Nenhuma autorização comprovada ou credencial.';
comment on table public.vertice_captacao_assets is 'Referências informadas, não verificadas no provedor. Nunca usadas para roteamento de webhook nesta fase.';
comment on table public.vertice_captacao_campaigns is 'Rascunhos, sem criar anúncios, coletar leads ou confirmar matrículas.';
commit;
