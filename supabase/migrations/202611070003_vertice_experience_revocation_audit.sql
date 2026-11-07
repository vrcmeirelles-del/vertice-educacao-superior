-- Registrar o Master responsável pela revogação do convite comercial.
alter table public.vertice_experience_invites add column if not exists revoked_by uuid references auth.users(id);
comment on column public.vertice_experience_invites.revoked_by is 'Master autenticado com AAL2 que revogou o convite.';