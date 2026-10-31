begin;
alter table public.vertice_goals add column owner_user_id uuid references auth.users(id) on delete restrict, add column owner_email text;
create index vertice_goals_owner_idx on public.vertice_goals(owner_user_id);
create function vertice_private.check_goal_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_user_id is null then new.owner_email:=null;
 else
  if not exists(select 1 from public.vertice_memberships m where m.user_id=new.owner_user_id and m.institution_id=new.institution_id and m.role in ('gestor','equipe')) and not exists(select 1 from public.vertice_admins a where a.user_id=new.owner_user_id)
  then raise exception 'responsável sem vínculo nesta instituição' using errcode='23514';end if;
  select email into new.owner_email from auth.users where id=new.owner_user_id;
 end if;
 return new;
end; $$;
revoke all on function vertice_private.check_goal_owner() from public,anon,authenticated;
create trigger vertice_goals_owner_check before insert or update on public.vertice_goals for each row execute function vertice_private.check_goal_owner();
commit;
