-- Preserve consistency between old 5W2H progress and the new audit trail.
-- Existing actions without governance records remain fully compatible.
create or replace function vertice_private.enforce_governed_progress()
returns trigger language plpgsql security invoker set search_path='' as $$
declare declared integer;
begin
 if new.progress is distinct from old.progress then
  select g.declared_progress into declared from public.vertice_action_governance g where g.action_id=new.id;
  if found and new.progress is distinct from declared then
   raise exception 'Atualize o progresso pela governança ativa para registrar a prestação de contas' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists vertice_governed_progress_guard on public.vertice_actions;
create trigger vertice_governed_progress_guard before update on public.vertice_actions
for each row execute function vertice_private.enforce_governed_progress();
