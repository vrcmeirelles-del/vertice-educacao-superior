-- Applied 2026-11-10. Public display only after Master confirms both authorizations.
create table if not exists public.vertice_showcase_clients (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 200),
 logo_url text not null check(logo_url ~ '^https://'),
 public_url text not null default '' check(public_url='' or public_url ~ '^https://'),
 sort_order integer not null default 0,
 active boolean not null default false,
 commercial_confirmed boolean not null default false,
 brand_authorized boolean not null default false,
 check(not active or (commercial_confirmed and brand_authorized))
);
alter table public.vertice_showcase_clients enable row level security;
grant select on public.vertice_showcase_clients to anon,authenticated;
grant insert,update,delete on public.vertice_showcase_clients to authenticated;
drop policy if exists showcase_public_read on public.vertice_showcase_clients;
create policy showcase_public_read on public.vertice_showcase_clients for select to anon,authenticated using(active and commercial_confirmed and brand_authorized);
drop policy if exists showcase_master on public.vertice_showcase_clients;
create policy showcase_master on public.vertice_showcase_clients for all to authenticated using((select vertice_private.is_master())) with check((select vertice_private.is_master()));
