-- Ciência explícita e proporcional: não monitorar tempo online ou páginas visitadas.
create table if not exists public.vertice_action_acknowledgements (
 action_id uuid not null references public.vertice_actions(id) on delete cascade,
 institution_id uuid not null references public.vertice_institutions(id),
 actor uuid not null references auth.users(id),
 acknowledged_day date not null default current_date,
 acknowledged_at timestamptz not null default now(),
 primary key(action_id,actor,acknowledged_day)
);
create index if not exists vx_ack_institution_idx on public.vertice_action_acknowledgements(institution_id,acknowledged_at desc);
alter table public.vertice_action_acknowledgements enable row level security;
revoke all on public.vertice_action_acknowledgements from anon,authenticated;
grant select,insert on public.vertice_action_acknowledgements to authenticated;
create policy vx_ack_select on public.vertice_action_acknowledgements for select to authenticated
using (vertice_private.has_role(institution_id,array['gestor']) or actor=(select auth.uid()));
create policy vx_ack_insert on public.vertice_action_acknowledgements for insert to authenticated
with check (actor=(select auth.uid()) and vertice_private.has_role(institution_id,array['gestor','equipe']));
create or replace function vertice_private.acknowledgement_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare inst uuid;
declare resp uuid;
begin
 select institution_id,responsible_user_id into inst,resp from public.vertice_actions where id=new.action_id;
 if inst is null or inst is distinct from new.institution_id or not vertice_private.has_role(inst,array['gestor','equipe']) then
  raise exception 'Não autorizado a reconhecer esta ação' using errcode='42501';
 end if;
 if resp is not null and resp<>auth.uid() and not vertice_private.has_role(inst,array['gestor']) then
  raise exception 'Ciência reservada ao responsável pela ação' using errcode='42501';
 end if;
 new.actor=auth.uid();new.acknowledged_day=current_date;new.acknowledged_at=now();
 return new;
end $$;
drop trigger if exists vx_ack_guard on public.vertice_action_acknowledgements;
create trigger vx_ack_guard before insert on public.vertice_action_acknowledgements
for each row execute function vertice_private.acknowledgement_guard();
create or replace function public.vertice_action_acknowledge(p_action uuid)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare inst uuid; result timestamptz;
begin
 select institution_id into inst from public.vertice_actions where id=p_action;
 if inst is null or not vertice_private.has_role(inst,array['gestor','equipe']) then
  raise exception 'Sem permissão' using errcode='42501';
 end if;
 insert into public.vertice_action_acknowledgements(action_id,institution_id,actor)
 values(p_action,inst,auth.uid()) on conflict do nothing;
 select acknowledged_at into result from public.vertice_action_acknowledgements
 where action_id=p_action and actor=auth.uid() and acknowledged_day=current_date;
 return result;
end $$;
revoke all on function public.vertice_action_acknowledge(uuid) from public,anon;
grant execute on function public.vertice_action_acknowledge(uuid) to authenticated;
