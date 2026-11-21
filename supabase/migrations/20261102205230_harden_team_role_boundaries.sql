-- Protege vínculos e convites de gestores contra alteração indevida por outro gestor.
CREATE OR REPLACE FUNCTION public.vertice_add_member(target uuid, member_email text, member_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor_role text := vertice_private.member_role(target); uid uuid; mail text := lower(trim(member_email));
begin
 if member_role not in ('gestor','equipe','leitor') then raise exception 'papel inválido' using errcode='22023'; end if;
 if not coalesce(actor_role = 'master' or (actor_role = 'gestor' and member_role in ('equipe','leitor')), false) then
  raise exception 'sem permissão' using errcode = '42501'; end if;
 select u.id into uid from auth.users u where lower(u.email) = mail and u.email_confirmed_at is not null;
 if uid is not null then
  if uid = auth.uid() and actor_role <> 'master' then raise exception 'sem permissão' using errcode = '42501'; end if;
  insert into public.vertice_memberships(user_id, institution_id, role) values (uid, target, member_role)
   on conflict (user_id, institution_id) do update set role = excluded.role
   where actor_role = 'master' or vertice_memberships.role in ('equipe','leitor');
  if not found then raise exception 'somente o master pode alterar o vínculo de um gestor' using errcode='42501'; end if;
  return 'vinculado';
 end if;
 insert into public.vertice_invites(institution_id, email, role, created_by) values (target, mail, member_role, auth.uid())
  on conflict (institution_id, email) do update set role = excluded.role, accepted_at = null
  where actor_role = 'master' or vertice_invites.role in ('equipe','leitor');
 if not found then raise exception 'somente o master pode alterar convite de gestor' using errcode='42501'; end if;
 return 'convite_pendente';
end; $function$;
