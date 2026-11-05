-- REVIEW PROPOSAL ONLY. Not a migration, not deployed, no activation/grants.
-- Prerequisites: existing auth.users, auth.uid()/jwt(), vertice_private schema,
-- public.vertice_admins and its existing vertice_audit_admins trigger.
-- Run only in an isolated staging database first, as a trusted migration owner.
begin;

create table vertice_private.master_invitation_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  -- 24 hours is a PRODUCT PROPOSAL, not an approved/activated setting.
  lifetime interval not null default interval '24 hours'
    check (lifetime = interval '24 hours')
);
insert into vertice_private.master_invitation_config(singleton) values (true);

create table vertice_private.master_invitations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  target_email text not null,
  token_digest text not null check (token_digest ~ '^[0-9a-f]{64}$'),
  issued_by uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text check (revoked_reason in ('revoked', 'expired_replaced')),
  accepted_at timestamptz,
  accepted_by uuid,
  check (expires_at > created_at),
  check ((revoked_at is null) = (revoked_by is null)),
  check ((revoked_at is null) = (revoked_reason is null)),
  check ((accepted_at is null) = (accepted_by is null)),
  check (revoked_at is null or accepted_at is null),
  check (accepted_by is null or accepted_by <> issued_by)
  -- Deliberately no auth FK: deleting a user must not erase historical evidence
  -- or become impossible. Each operation rechecks current auth/master records.
);
create unique index master_invitation_one_open_email
  on vertice_private.master_invitations(target_email)
  where revoked_at is null and accepted_at is null;
create index master_invitation_page_idx
  on vertice_private.master_invitations(created_at desc, id desc);

create table vertice_private.master_invitation_audit (
  id bigint generated always as identity primary key,
  invitation_id uuid not null,
  event text not null check (event in ('issued','revoked','expired_replaced','accepted')),
  actor_user_id uuid not null,
  issuer_user_id uuid not null,
  target_email text not null,
  recipient_user_id uuid,
  expires_at timestamptz not null,
  occurred_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((event = 'accepted') = (recipient_user_id is not null))
);
-- No token, digest, arbitrary JSON or raw request body enters the audit ledger.
alter table vertice_private.master_invitation_config enable row level security;
alter table vertice_private.master_invitation_config force row level security;
alter table vertice_private.master_invitations enable row level security;
alter table vertice_private.master_invitations force row level security;
alter table vertice_private.master_invitation_audit enable row level security;
alter table vertice_private.master_invitation_audit force row level security;
revoke all on vertice_private.master_invitation_config,
  vertice_private.master_invitations, vertice_private.master_invitation_audit
  from public, anon, authenticated, service_role;
revoke all on sequence vertice_private.master_invitation_audit_id_seq
  from public, anon, authenticated, service_role;
-- No RLS policies: deny all direct client access even if a grant is added later.

create function vertice_private.master_audit_immutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'master_audit_immutable';
end;
$$;
create trigger master_invitation_audit_immutable
before update or delete on vertice_private.master_invitation_audit
for each row execute function vertice_private.master_audit_immutable();
create trigger master_invitation_audit_no_truncate
before truncate on vertice_private.master_invitation_audit
for each statement execute function vertice_private.master_audit_immutable();

create function vertice_private.master_normalize_email(value text) returns text
language plpgsql immutable security invoker set search_path = '' as $$
declare
  email text := pg_catalog.lower(pg_catalog.btrim(value));
  local_part text;
  domain_part text;
  label text;
begin
  if email is null or pg_catalog.octet_length(email) > 254
    or email collate "C" !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'
  then raise exception using errcode = '22023', message = 'invalid_email'; end if;
  local_part := pg_catalog.split_part(email, '@', 1);
  domain_part := pg_catalog.split_part(email, '@', 2);
  if pg_catalog.octet_length(local_part) not between 1 and 64
    or local_part like '.%' or local_part like '%.' or local_part like '%..%'
    or pg_catalog.octet_length(domain_part) > 253
    or domain_part not like '%.%'
  then raise exception using errcode = '22023', message = 'invalid_email'; end if;
  foreach label in array pg_catalog.string_to_array(domain_part, '.') loop
    if pg_catalog.length(label) not between 1 and 63
      or label collate "C" !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    then raise exception using errcode = '22023', message = 'invalid_email'; end if;
  end loop;
  if pg_catalog.length(label) < 2 or label collate "C" ~ '^[0-9]+$'
  then raise exception using errcode = '22023', message = 'invalid_email'; end if;
  return email;
end;
$$;

create function vertice_private.master_request_actor() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); feature_enabled boolean;
begin
  -- Shared config lock means disabling the feature waits for in-flight writes.
  select c.enabled into feature_enabled
    from vertice_private.master_invitation_config c where c.singleton for share;
  if feature_enabled is distinct from true then
    raise exception using errcode = 'P0001', message = 'master_invitations_disabled';
  end if;
  if actor is null or (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception using errcode = '42501', message = 'master_access_denied';
  end if;
  return actor;
end;
$$;

create function vertice_private.master_require_actor() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := vertice_private.master_request_actor();
begin
  -- Locks prevent identity/confirmation or Master authority changing mid-call.
  perform 1 from auth.users u
    where u.id = actor and pg_catalog.btrim(u.email) <> '' and u.email_confirmed_at is not null
    for share;
  if not found then
    raise exception using errcode = '42501', message = 'master_access_denied';
  end if;
  perform 1 from public.vertice_admins a where a.user_id = actor for share;
  if not found then
    raise exception using errcode = '42501', message = 'master_access_denied';
  end if;
  return actor;
end;
$$;

create function vertice_private.master_validate_page(
  page_size integer, before_created_at timestamptz, before_id uuid
) returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if page_size is null or page_size not between 1 and 100
    or ((before_created_at is null) <> (before_id is null))
    or (before_created_at is not null and not pg_catalog.isfinite(before_created_at))
  then raise exception using errcode = '22023', message = 'invalid_pagination'; end if;
end;
$$;

create function public.vertice_list_masters(
  page_size integer default 50, before_created_at timestamptz default null,
  before_user_id uuid default null
) returns table(user_id uuid, email text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform vertice_private.master_require_actor();
  perform vertice_private.master_validate_page(page_size, before_created_at, before_user_id);
  return query select a.user_id, u.email::text, a.created_at
    from public.vertice_admins a join auth.users u on u.id = a.user_id
    where before_created_at is null or (a.created_at, a.user_id) < (before_created_at, before_user_id)
    order by a.created_at desc, a.user_id desc limit page_size;
end;
$$;

create function public.vertice_list_master_invitations(
  page_size integer default 50, before_created_at timestamptz default null,
  before_id uuid default null
) returns table(id uuid, target_email text, created_at timestamptz,
                expires_at timestamptz, revoked_at timestamptz, accepted_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform vertice_private.master_require_actor();
  perform vertice_private.master_validate_page(page_size, before_created_at, before_id);
  return query select i.id, i.target_email, i.created_at, i.expires_at, i.revoked_at, i.accepted_at
    from vertice_private.master_invitations i
    where before_created_at is null or (i.created_at, i.id) < (before_created_at, before_id)
    order by i.created_at desc, i.id desc limit page_size;
end;
$$;

create function public.vertice_issue_master_invitation(target_email text, token_digest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := vertice_private.master_require_actor();
  v_email text := vertice_private.master_normalize_email(target_email);
  candidate vertice_private.master_invitations;
  old_invitation vertice_private.master_invitations;
  lifetime interval;
  issued_time timestamptz;
begin
  if token_digest is null or token_digest collate "C" !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_token_digest';
  end if;
  -- Transaction advisory lock also serializes requests when no row exists yet.
  -- All mutating invitation paths take this exact same email lock first.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vertice-master-invitation:' || v_email, 0));
  if exists(select 1 from auth.users u join public.vertice_admins a on a.user_id = u.id
    where pg_catalog.lower(pg_catalog.btrim(u.email)) = v_email)
  then raise exception using errcode = 'P0001', message = 'master_target_unavailable'; end if;
  select i.* into old_invitation from vertice_private.master_invitations i
    where i.target_email = v_email and i.revoked_at is null and i.accepted_at is null for update;
  issued_time := pg_catalog.clock_timestamp();
  if found then
    if old_invitation.expires_at > issued_time then
      raise exception using errcode = 'P0001', message = 'duplicate_master_invitation';
    end if;
    -- Closing an expired record allows a NEW explicit issue, never auto reissue.
    update vertice_private.master_invitations set revoked_at = issued_time,
      revoked_by = actor, revoked_reason = 'expired_replaced' where id = old_invitation.id;
    insert into vertice_private.master_invitation_audit
      (invitation_id,event,actor_user_id,issuer_user_id,target_email,expires_at)
      values(old_invitation.id,'expired_replaced',actor,old_invitation.issued_by,v_email,old_invitation.expires_at);
  end if;
  select c.lifetime into lifetime from vertice_private.master_invitation_config c where c.singleton;
  insert into vertice_private.master_invitations(target_email,token_digest,issued_by,created_at,expires_at)
    values(v_email,token_digest,actor,issued_time,issued_time + lifetime) returning * into candidate;
  insert into vertice_private.master_invitation_audit
    (invitation_id,event,actor_user_id,issuer_user_id,target_email,expires_at)
    values(candidate.id,'issued',actor,actor,v_email,candidate.expires_at);
  return pg_catalog.jsonb_build_object('id',candidate.id,'email',v_email,'expires_at',candidate.expires_at);
end;
$$;

-- Private shared validation keeps preview and acceptance equally strict.
-- Intentionally locks even for preview; preview performs NO writes/promotion.
create function vertice_private.master_lock_valid_invitation(invitation uuid, raw_token text)
returns vertice_private.master_invitations
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := vertice_private.master_request_actor();
  candidate vertice_private.master_invitations;
  target text;
  email text;
begin
  if invitation is null or raw_token is null
    or raw_token collate "C" !~ '^[A-Za-z0-9_-]{43}$'
  then raise exception using errcode = 'P0001', message = 'invitation_unavailable'; end if;
  select i.target_email into target from vertice_private.master_invitations i where i.id = invitation;
  if not found then raise exception using errcode = 'P0001', message = 'invitation_unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vertice-master-invitation:' || target, 0));
  -- Acquire recipient lock AFTER the email lock, avoiding lock-upgrade cycles.
  select u.email into email from auth.users u
    where u.id = actor and pg_catalog.btrim(u.email) <> '' and u.email_confirmed_at is not null for update;
  if not found then raise exception using errcode = 'P0001', message = 'invitation_unavailable'; end if;
  select i.* into candidate from vertice_private.master_invitations i
    where i.id = invitation and i.target_email = target for update;
  if not found or candidate.revoked_at is not null or candidate.accepted_at is not null
    or candidate.expires_at <= pg_catalog.clock_timestamp()
    or candidate.issued_by = actor
    or candidate.target_email <> pg_catalog.lower(pg_catalog.btrim(email))
    or candidate.token_digest <> pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(raw_token,'UTF8')),'hex')
    or exists(select 1 from public.vertice_admins a where a.user_id = actor)
  then raise exception using errcode = 'P0001', message = 'invitation_unavailable'; end if;
  -- Recheck and lock the issuing user's live identity and current authority.
  perform 1 from auth.users u where u.id = candidate.issued_by
    and pg_catalog.btrim(u.email) <> '' and u.email_confirmed_at is not null for share;
  if not found then raise exception using errcode = 'P0001', message = 'invitation_unavailable'; end if;
  perform 1 from public.vertice_admins a where a.user_id = candidate.issued_by for share;
  if not found then raise exception using errcode = 'P0001', message = 'invitation_unavailable'; end if;
  -- The clock may have advanced while waiting for the issuer lock.
  if candidate.expires_at <= pg_catalog.clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'invitation_unavailable';
  end if;
  return candidate;
end;
$$;

create function public.vertice_preview_master_invitation(invitation uuid, raw_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate vertice_private.master_invitations;
begin
  candidate := vertice_private.master_lock_valid_invitation(invitation,raw_token);
  return pg_catalog.jsonb_build_object('id',candidate.id,'email',candidate.target_email,'expires_at',candidate.expires_at);
end;
$$;

create function public.vertice_accept_master_invitation(invitation uuid, raw_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate vertice_private.master_invitations; actor uuid := auth.uid();
begin
  candidate := vertice_private.master_lock_valid_invitation(invitation,raw_token);
  -- PK conflict is a safe failure if an administrative grant raced acceptance.
  -- No ON CONFLICT/partial success: grant, consumption and both audits roll back.
  insert into public.vertice_admins(user_id) values(actor);
  update vertice_private.master_invitations
    set accepted_at = pg_catalog.clock_timestamp(), accepted_by = actor where id = candidate.id;
  insert into vertice_private.master_invitation_audit
    (invitation_id,event,actor_user_id,issuer_user_id,target_email,recipient_user_id,expires_at)
    values(candidate.id,'accepted',actor,candidate.issued_by,candidate.target_email,actor,candidate.expires_at);
  return pg_catalog.jsonb_build_object('id',candidate.id,'user_id',actor,'accepted',true);
end;
$$;

create function public.vertice_revoke_master_invitation(invitation uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := vertice_private.master_require_actor();
  candidate vertice_private.master_invitations;
  target text;
begin
  select i.target_email into target from vertice_private.master_invitations i where i.id = invitation;
  if not found then raise exception using errcode = 'P0001', message = 'invitation_unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vertice-master-invitation:' || target, 0));
  select i.* into candidate from vertice_private.master_invitations i
    where i.id = invitation and i.target_email = target for update;
  if not found or candidate.accepted_at is not null then
    raise exception using errcode = 'P0001', message = 'invitation_unavailable';
  end if;
  if candidate.revoked_at is null then
    update vertice_private.master_invitations set revoked_at = pg_catalog.clock_timestamp(),
      revoked_by = actor, revoked_reason = 'revoked' where id = candidate.id;
    insert into vertice_private.master_invitation_audit
      (invitation_id,event,actor_user_id,issuer_user_id,target_email,expires_at)
      values(candidate.id,'revoked',actor,candidate.issued_by,candidate.target_email,candidate.expires_at);
  end if;
  return pg_catalog.jsonb_build_object('id',candidate.id,'revoked',true);
end;
$$;

-- Explicit least privilege, including PUBLIC and Supabase default ACLs.
-- service_role can BYPASSRLS: it must have no direct object privileges here.
-- No client/service grants are made by this proposal.
revoke all on function
  vertice_private.master_audit_immutable(),
  vertice_private.master_normalize_email(text),
  vertice_private.master_request_actor(),
  vertice_private.master_require_actor(),
  vertice_private.master_validate_page(integer,timestamptz,uuid),
  vertice_private.master_lock_valid_invitation(uuid,text),
  public.vertice_list_masters(integer,timestamptz,uuid),
  public.vertice_list_master_invitations(integer,timestamptz,uuid),
  public.vertice_issue_master_invitation(text,text),
  public.vertice_preview_master_invitation(uuid,text),
  public.vertice_accept_master_invitation(uuid,text),
  public.vertice_revoke_master_invitation(uuid)
  from public, anon, authenticated, service_role;

comment on table vertice_private.master_invitation_config is
  'Disabled by default. 24-hour lifetime is a proposal requiring product/security approval.';
comment on table vertice_private.master_invitation_audit is
  'Append-only invitation event ledger; no secrets. DB owners can bypass protections; use independent audit retention in production.';
commit;
