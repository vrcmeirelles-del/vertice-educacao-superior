-- Preparação de conectores institucionais sem acesso automático às APIs externas.
-- A chave é armazenada somente no Supabase Vault. Nenhum dado acadêmico é importado por esta migração.
create table if not exists vertice_private.api_connections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null unique references public.vertice_institutions(id) on delete cascade,
  provider text not null default 'eorbit' check (provider in ('eorbit','outro')),
  system_url text not null,
  api_url text,
  vault_secret_id uuid unique,
  status text not null default 'aguardando_chave' check (status in ('aguardando_chave','credencial_recebida','revogada')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_connections_url_size check (length(system_url) between 12 and 1000 and (api_url is null or length(api_url) between 12 and 1000))
);
alter table vertice_private.api_connections enable row level security;
revoke all on table vertice_private.api_connections from public, anon, authenticated;

create table if not exists vertice_private.api_connection_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
  connection_id uuid not null references vertice_private.api_connections(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event text not null check (event in ('configuracao_salva','chave_recebida','chave_revogada')),
  occurred_at timestamptz not null default now()
);
alter table vertice_private.api_connection_events enable row level security;
revoke all on table vertice_private.api_connection_events from public, anon, authenticated;

create or replace function public.vertice_api_connection_get(p_institution uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v vertice_private.api_connections%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2'
     or not exists (select 1 from public.vertice_admins where user_id=auth.uid()) then
    raise exception 'Acesso restrito ao Master com MFA' using errcode='42501';
  end if;
  if not exists (select 1 from public.vertice_institutions where id=p_institution) then
    raise exception 'Instituição inexistente' using errcode='22023';
  end if;
  select * into v from vertice_private.api_connections where institution_id=p_institution;
  if not found then
    return jsonb_build_object('configured',false,'status','nao_configurada','system_url','','api_url','','has_key',false);
  end if;
  return jsonb_build_object('configured',true,'status',v.status,
    'system_url',v.system_url,'api_url',coalesce(v.api_url,''),
    'has_key',v.vault_secret_id is not null,'updated_at',v.updated_at);
end;
$$;
revoke all on function public.vertice_api_connection_get(uuid) from public,anon;
grant execute on function public.vertice_api_connection_get(uuid) to authenticated;

create or replace function public.vertice_api_connection_save(
  p_institution uuid, p_system_url text, p_api_url text, p_key text
) returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_url text := btrim(coalesce(p_system_url,''));
  v_api text := nullif(btrim(coalesce(p_api_url,'')),'');
  v_key text := nullif(btrim(coalesce(p_key,'')),'');
  v vertice_private.api_connections%rowtype;
  v_secret_id uuid;
  v_status text;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2'
     or not exists (select 1 from public.vertice_admins where user_id=auth.uid()) then
    raise exception 'Acesso restrito ao Master com MFA' using errcode='42501';
  end if;
  if not exists (select 1 from public.vertice_institutions where id=p_institution) then
    raise exception 'Instituição inexistente' using errcode='22023';
  end if;
  -- Somente configuração; o futuro adaptador de rede terá lista de hosts permitidos e proteção SSRF própria.
  if length(v_url)>1000 or v_url !~ '^https://[[:alnum:]][[:alnum:].-]*(:443)?(/[^[:space:]?#]*)?$'
     or v_url ~ '[?#@]' then
    raise exception 'Endereço do sistema inválido: use HTTPS, sem credenciais nem parâmetros' using errcode='22023';
  end if;
  if v_api is not null and
    (length(v_api)>1000 or v_api !~ '^https://[[:alnum:]][[:alnum:].-]*(:443)?(/[^[:space:]?#]*)?$'
     or v_api ~ '[?#@]') then
    raise exception 'Endereço da API inválido' using errcode='22023';
  end if;
  if v_key is not null and (length(v_key)<8 or length(v_key)>4096 or v_key ~ '[[:cntrl:]]') then
    raise exception 'Formato de chave inválido' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_institution::text)::bigint);
  select * into v from vertice_private.api_connections where institution_id=p_institution for update;
  v_secret_id := v.vault_secret_id;
  if v_key is not null then
    if v_secret_id is null then
      v_secret_id := vault.create_secret(v_key, 'vertice_externa_' || p_institution::text, 'Chave da API institucional - Vértice');
    else
      perform vault.update_secret(v_secret_id,v_key);
    end if;
  end if;
  v_status := case when v_secret_id is not null then 'credencial_recebida' else 'aguardando_chave' end;
  insert into vertice_private.api_connections
    (institution_id,system_url,api_url,vault_secret_id,status,created_by,updated_by)
  values (p_institution,v_url,v_api,v_secret_id,v_status,auth.uid(),auth.uid())
  on conflict (institution_id) do update
  set system_url=excluded.system_url,api_url=excluded.api_url,
      vault_secret_id=excluded.vault_secret_id,status=excluded.status,
      updated_by=excluded.updated_by,updated_at=now()
  returning * into v;
  insert into vertice_private.api_connection_events
    (institution_id,connection_id,actor_user_id,event)
  values (p_institution,v.id,auth.uid(),
    case when v_key is not null then 'chave_recebida' else 'configuracao_salva' end);
  return jsonb_build_object('configured',true,'status',v.status,
    'system_url',v.system_url,'api_url',coalesce(v.api_url,''),
    'has_key',v.vault_secret_id is not null,'updated_at',v.updated_at);
end;
$$;
revoke all on function public.vertice_api_connection_save(uuid,text,text,text) from public,anon;
grant execute on function public.vertice_api_connection_save(uuid,text,text,text) to authenticated;

create or replace function public.vertice_api_connection_revoke(p_institution uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare v vertice_private.api_connections%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2'
     or not exists (select 1 from public.vertice_admins where user_id=auth.uid()) then
    raise exception 'Acesso restrito ao Master com MFA' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_institution::text)::bigint);
  select * into v from vertice_private.api_connections where institution_id=p_institution for update;
  if not found then raise exception 'Conexão não cadastrada' using errcode='22023'; end if;
  if v.vault_secret_id is not null then delete from vault.secrets where id=v.vault_secret_id; end if;
  update vertice_private.api_connections set vault_secret_id=null,status='revogada',
    updated_by=auth.uid(),updated_at=now() where id=v.id;
  insert into vertice_private.api_connection_events
    (institution_id,connection_id,actor_user_id,event)
    values (p_institution,v.id,auth.uid(),'chave_revogada');
  return jsonb_build_object('configured',true,'status','revogada',
    'system_url',v.system_url,'api_url',coalesce(v.api_url,''),
    'has_key',false,'updated_at',now());
end;
$$;
revoke all on function public.vertice_api_connection_revoke(uuid) from public,anon;
grant execute on function public.vertice_api_connection_revoke(uuid) to authenticated;
