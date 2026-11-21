-- Harden the execution/approval boundary without migrating or changing historical rows.
alter table public.vertice_actions add column if not exists responsible_user_id uuid references auth.users(id) on delete set null;

create or replace function vertice_private.prevent_unapproved_completion()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='concluida' and old.status is distinct from 'concluida'
    and exists (
      select 1 from public.vertice_action_governance g where g.action_id=new.id and g.review_status<>'aprovado'
    ) then
   raise exception 'Ação em governança ativa depende de aprovação superior' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists vertice_action_completion_guard on public.vertice_actions;
create trigger vertice_action_completion_guard before update on public.vertice_actions
for each row execute function vertice_private.prevent_unapproved_completion();

create or replace function public.vertice_action_checkin(p_action uuid,p_progress integer,p_note text,p_blocker text default '')
returns public.vertice_action_governance language plpgsql security invoker set search_path='' as $$
declare inst uuid; responsible uuid; result public.vertice_action_governance;
begin
 select institution_id,responsible_user_id into inst,responsible from public.vertice_actions where id=p_action;
 if inst is null or not vertice_private.has_role(inst,array['gestor','equipe']) then raise exception 'Sem permissão' using errcode='42501'; end if;
 if responsible is not null and responsible <> auth.uid() and not vertice_private.has_role(inst,array['gestor']) then
   raise exception 'Check-in reservado ao executor ou à gestão' using errcode='42501';
 end if;
 if p_progress not between 0 and 100 or length(coalesce(p_note,''))>3000 or length(coalesce(p_blocker,''))>2000 then
  raise exception 'Progresso ou texto inválido' using errcode='23514';
 end if;
 insert into public.vertice_action_governance(action_id,institution_id,declared_progress,note,blocker)
 values(p_action,inst,p_progress,coalesce(p_note,''),coalesce(p_blocker,''))
 on conflict(action_id) do update set
  declared_progress=excluded.declared_progress,note=excluded.note,blocker=excluded.blocker,
  review_status=case when public.vertice_action_governance.review_status='devolvido' then 'rascunho' else public.vertice_action_governance.review_status end
 returning * into result;
 update public.vertice_actions set progress=p_progress where id=p_action and institution_id=inst;
 return result;
end $$;

create or replace function public.vertice_action_review(p_action uuid,p_decision text,p_note text default '')
returns public.vertice_action_governance language plpgsql security invoker set search_path='' as $$
declare inst uuid; result public.vertice_action_governance;
begin
 select institution_id into inst from public.vertice_actions where id=p_action;
 if inst is null then raise exception 'Ação não encontrada' using errcode='22023'; end if;
 if p_decision='enviado' then
  if not vertice_private.has_role(inst,array['gestor','equipe']) then raise exception 'Sem permissão' using errcode='42501'; end if;
  update public.vertice_action_governance set review_status='enviado' where action_id=p_action returning * into result;
 elsif p_decision in ('aprovado','devolvido') then
  if not vertice_private.has_role(inst,array['gestor']) then raise exception 'Validação reservada à gestão' using errcode='42501'; end if;
  update public.vertice_action_governance set review_status=p_decision,review_note=coalesce(p_note,'')
  where action_id=p_action returning * into result;
  if result.action_id is not null and p_decision='aprovado' then
   update public.vertice_actions set status='concluida',progress=100
    where id=p_action and institution_id=inst;
  end if;
 else raise exception 'Decisão inválida' using errcode='22023';
 end if;
 if result.action_id is null then raise exception 'Registre check-in antes da validação' using errcode='22023'; end if;
 return result;
end $$;
-- Only managers can assign the bound executor. Old textual `who` fields remain untouched.
create or replace function vertice_private.prevent_executor_forgery()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.responsible_user_id is distinct from old.responsible_user_id then
  if not vertice_private.has_role(new.institution_id,array['gestor']) then
   raise exception 'Atribuição de executor reservada à gestão' using errcode='42501';
  end if;
  if new.responsible_user_id is not null and not exists (
    select 1 from public.vertice_memberships m where m.institution_id=new.institution_id
       and m.user_id=new.responsible_user_id and m.role in ('gestor','equipe')
  ) and not exists (select 1 from public.vertice_admins adm where adm.user_id=new.responsible_user_id) then
   raise exception 'Executor precisa ter vínculo autorizado' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists vertice_action_executor_guard on public.vertice_actions;
create trigger vertice_action_executor_guard before update on public.vertice_actions
for each row execute function vertice_private.prevent_executor_forgery();
