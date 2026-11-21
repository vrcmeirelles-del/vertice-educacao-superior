-- Tabela de preços dos pacotes: leitura só para o master da plataforma.
--
-- A contratação é intermediada pela equipe Vértice; valores comerciais não ficam
-- visíveis a gestores, equipes ou leitores das instituições.
-- Antes: política de leitura `using (true)` para authenticated, mas sem GRANT SELECT,
-- de modo que ninguém (nem o master, nem o BillingPanel) conseguia ler a tabela.
-- Depois: GRANT SELECT para authenticated, com a RLS restringindo as linhas ao master
-- (vertice_private.is_master(): vertice_admins + sessão aal2).

alter table public.vertice_package_pricing enable row level security;

drop policy if exists package_pricing_read on public.vertice_package_pricing;
create policy package_pricing_read on public.vertice_package_pricing
  for select to authenticated
  using ((select vertice_private.is_master()));

revoke all on public.vertice_package_pricing from anon;
grant select on public.vertice_package_pricing to authenticated;
