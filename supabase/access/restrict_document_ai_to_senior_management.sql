create or replace function vertice_private.ai_scope(inst uuid, course uuid, person uuid)
returns boolean language plpgsql stable security definer set search_path to '' as $function$
declare registered boolean; permitted boolean;
begin
 if person is null or not exists(select 1 from public.vertice_institutions where id=inst) then return false;end if;
 if course is not null and not exists(select 1 from public.vertice_courses where id=course and institution_id=inst) then return false;end if;
 if exists(select 1 from public.vertice_admins where user_id=person) then return true;end if;
 if to_regclass('public.vertice_academic_assignments') is not null then
  execute 'select exists(select 1 from public.vertice_academic_assignments where institution_id=$1 and user_id=$2)' into registered using inst,person;
  if registered then
   execute 'select exists(select 1 from public.vertice_academic_assignments where institution_id=$1 and user_id=$2 and active and role in (''reitor'',''diretor_geral'',''pro_reitor_graduacao'',''diretor_pedagogico''))' into permitted using inst,person;
   return coalesce(permitted,false);
  end if;
 end if;
 return exists(select 1 from public.vertice_memberships where institution_id=inst and user_id=person and role='gestor');
end;$function$;