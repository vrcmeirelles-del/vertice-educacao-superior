-- Vincula uma origem de dados externa ao cadastro da IES e define o destino interno
-- Dados permanecem exclusivamente no banco da Vértice, separados por institution_id.
-- Esta migration não consulta sistemas externos nem importa dados.
alter table vertice_private.api_connections
  add column if not exists technical_email text,
  add column if not exists external_institution_code text;

alter table vertice_private.api_connections
  add constraint api_connections_technical_email_format check
  (technical_email is null or
   (length(technical_email) between 6 and 254 and
    technical_email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')),
  add constraint api_connections_external_code_format check
  (external_institution_code is null or length(external_institution_code) between 1 and 100);

create table if not exists vertice_private.api_sync_batches (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
  connection_id uuid not null references vertice_private.api_connections(id) on delete restrict,
  source_endpoint text,
  dataset text not null check (dataset in ('cursos','grades','matriculas','turmas','alunos','professores','notas','frequencia','outro')),
  reference_period text,
  status text not null default 'recebido' check (status in ('recebido','em_validacao','validado','aprovado','publicado','rejeitado','falhou')),
  received_count integer not null default 0 check(received_count>=0),
  validated_count integer not null default 0 check(validated_count>=0),
  rejected_count integer not null default 0 check(rejected_count>=0),
  source_timestamp timestamptz,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  published_at timestamptz,
  diagnostics jsonb not null default '{}'::jsonb check (jsonb_typeof(diagnostics)='object' and octet_length(diagnostics::text)<=65536),
  constraint source_batch_period_length check (reference_period is null or length(reference_period)<=35),
  constraint source_batch_endpoint_length check (source_endpoint is null or length(source_endpoint)<=1000)
);
create index if not exists api_sync_batches_by_ies on vertice_private.api_sync_batches(institution_id,created_at desc);
alter table vertice_private.api_sync_batches enable row level security;
revoke all on vertice_private.api_sync_batches from public,anon,authenticated;

create table if not exists vertice_private.api_staging_records (
  id bigint generated always as identity primary key,
  batch_id uuid not null references vertice_private.api_sync_batches(id) on delete cascade,
  institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
  dataset text not null,
  source_record_id text not null check(length(source_record_id) between 1 and 250),
  course_code text,
  semester text,
  grade_code text,
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
  received_at timestamptz not null default now(),
  unique(batch_id,dataset,source_record_id)
);
create index if not exists api_staging_records_by_ies on vertice_private.api_staging_records(institution_id,batch_id);
alter table vertice_private.api_staging_records enable row level security;
revoke all on vertice_private.api_staging_records from public,anon,authenticated;

-- Não permite que uma linha de outra faculdade seja colocada no lote errado.
create or replace function vertice_private.api_staging_validate_institution()
returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from vertice_private.api_sync_batches b
    where b.id=new.batch_id and b.institution_id=new.institution_id
    and b.dataset=new.dataset and b.status in ('recebido','em_validacao')) then
    raise exception 'Lote, tipo ou instituição incompatíveis' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists api_staging_validate_institution on vertice_private.api_staging_records;
create trigger api_staging_validate_institution before insert or update
on vertice_private.api_staging_records for each row
execute function vertice_private.api_staging_validate_institution();

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
    return jsonb_build_object('configured',false,'status','nao_configurada',
      'system_url','','api_url','','has_key',false,'technical_email','',
      'external_institution_code','','destination_institution_id',p_institution,
      'destination_name','Supabase Vértice');
  end if;
  return jsonb_build_object('configured',true,'status',v.status,
    'system_url',v.system_url,'api_url',coalesce(v.api_url,''),
    'technical_email',coalesce(v.technical_email,''),
    'external_institution_code',coalesce(v.external_institution_code,''),
    'destination_institution_id',v.institution_id,
    'destination_name','Supabase Vértice',
    'has_key',v.vault_secret_id is not null,'updated_at',v.updated_at);
end;
$$;
revoke all on function public.vertice_api_connection_get(uuid) from public,anon;
grant execute on function public.vertice_api_connection_get(uuid) to authenticated;

-- A chamada antiga permanece apenas como rotina interna usada pela função abaixo.
revoke execute on function public.vertice_api_connection_save(uuid,text,text,text)
  from authenticated;

create or replace function public.vertice_api_connection_bind(
  p_institution uuid, p_system_url text, p_api_url text, p_key text,
  p_technical_email text, p_external_institution_code text
) returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_email text := lower(btrim(coalesce(p_technical_email,'')));
  v_code text := nullif(btrim(coalesce(p_external_institution_code,'')),'');
  v_result jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2'
     or not exists (select 1 from public.vertice_admins where user_id=auth.uid()) then
    raise exception 'Acesso restrito ao Master com MFA' using errcode='42501';
  end if;
  if length(v_email) not between 6 and 254
     or v_email !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' then
     raise exception 'E-mail técnico inválido' using errcode='22023';
  end if;
  if v_code is not null and length(v_code)>100 then
     raise exception 'Código da instituição na origem é muito longo' using errcode='22023';
  end if;
  -- reutiliza a rotina de gravação que faz vault.create_secret/update_secret
  v_result := public.vertice_api_connection_save(p_institution,p_system_url,p_api_url,p_key);
  update vertice_private.api_connections
     set technical_email=v_email, external_institution_code=v_code
   where institution_id=p_institution;
  return public.vertice_api_connection_get(p_institution);
end;
$$;
revoke all on function public.vertice_api_connection_bind(uuid,text,text,text,text,text)
  from public,anon;
grant execute on function public.vertice_api_connection_bind(uuid,text,text,text,text,text)
  to authenticated;

create or replace function public.vertice_api_ingestion_summary(p_institution uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_count bigint; v_last timestamptz; v_status text;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2'
    or not exists (select 1 from public.vertice_admins where user_id=auth.uid()) then
   raise exception 'Acesso restrito ao Master com MFA' using errcode='42501';
 end if;
 if not exists (select 1 from public.vertice_institutions where id=p_institution) then
   raise exception 'Instituição inexistente' using errcode='22023';
 end if;
 select count(*) into v_count from vertice_private.api_sync_batches where institution_id=p_institution;
 select created_at,status into v_last,v_status from vertice_private.api_sync_batches
   where institution_id=p_institution order by created_at desc limit 1;
 return jsonb_build_object('batch_count',v_count,'last_batch_at',v_last,
   'last_batch_status',v_status,'destination_institution_id',p_institution);
end;
$$;
revoke all on function public.vertice_api_ingestion_summary(uuid) from public,anon;
grant execute on function public.vertice_api_ingestion_summary(uuid) to authenticated;
