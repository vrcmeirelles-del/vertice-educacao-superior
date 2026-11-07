-- Vértice Experience: dados fictícios por convite comercial, sem vínculo com instituições reais.
-- Administradores operam pela Edge Function autenticada com Master + AAL2.
-- Visitantes usam capacidades aleatórias apenas para o sandbox; nenhuma tabela é acessível no cliente.
begin;

create table public.vertice_experience_invites (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
 target_email text not null check (length(target_email) between 6 and 254 and target_email = lower(btrim(target_email))),
 recipient_name text not null default '' check (length(recipient_name) <= 120),
 institution_type text not null check (institution_type in ('faculdade','centro','universidade')),
 experience_role text not null check (experience_role in ('mantenedor','reitor','coordenador')),
 issued_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 opens integer not null default 0 check (opens between 0 and 500),
 saves integer not null default 0 check (saves between 0 and 1000),
 last_opened_at timestamptz,
 updated_at timestamptz not null default now(),
 demo_state jsonb not null default '{}'::jsonb check (jsonb_typeof(demo_state) = 'object' and pg_column_size(demo_state) <= 32000),
 check (expires_at > created_at and expires_at <= created_at + interval '14 days')
);
create index vertice_experience_invites_expiry_idx on public.vertice_experience_invites(expires_at);
create index vertice_experience_invites_issuer_idx on public.vertice_experience_invites(issued_by,created_at desc);

create table public.vertice_experience_events (
 id bigint generated always as identity primary key,
 invite_id uuid not null references public.vertice_experience_invites(id),
 kind text not null check (kind in ('opened','module','save','report')),
 module text check (module is null or module in ('overview','courses','academic','enade','governance','evidence','library','goals','acquisitions','economics','admissions','report')),
 occurred_at timestamptz not null default now()
);
create index vertice_experience_events_invite_idx on public.vertice_experience_events(invite_id,occurred_at desc);

alter table public.vertice_experience_invites enable row level security;
alter table public.vertice_experience_invites force row level security;
alter table public.vertice_experience_events enable row level security;
alter table public.vertice_experience_events force row level security;
-- Intencionalmente sem políticas: deny-by-default para visitantes e usuários autenticados.
revoke all on table public.vertice_experience_invites, public.vertice_experience_events from public, anon, authenticated;
revoke all on sequence public.vertice_experience_events_id_seq from public, anon, authenticated;
grant select, insert, update on table public.vertice_experience_invites to service_role;
grant select, insert on table public.vertice_experience_events to service_role;
grant usage, select on sequence public.vertice_experience_events_id_seq to service_role;
comment on table public.vertice_experience_invites is 'Isolamento de demonstrações comerciais: somente dados fictícios e acessos temporários, administrados por Edge Function. Link é segredo bearer, não verificação da identidade do visitante.';
comment on table public.vertice_experience_events is 'Telemetria mínima de módulos demonstrativos, sem dados de alunos ou clientes.';

commit;