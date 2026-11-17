-- Definitions read from qvetbbmviatxxatzzuzc on 2026-11-17; no identities.
CREATE OR REPLACE FUNCTION vertice_private.is_master()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT exists(
    SELECT 1 FROM public.vertice_admins 
    WHERE user_id = (SELECT auth.uid())
  );
$function$
;
CREATE OR REPLACE FUNCTION vertice_private.member_role(target uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case
  when not coalesce((select auth.jwt()->>'aal') = 'aal2', false) then null
  when vertice_private.is_master() then 'master'
  else (select m.role from public.vertice_memberships m
        where m.user_id = (select auth.uid()) and m.institution_id = target)
 end;
$function$
;
CREATE OR REPLACE FUNCTION vertice_private.can_read_institution(target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    vertice_private.is_master()
    OR
    exists(SELECT 1 FROM public.vertice_memberships WHERE user_id = (SELECT auth.uid()) AND institution_id = target);
$function$
;
CREATE OR REPLACE FUNCTION vertice_private.has_role(target uuid, roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(vertice_private.member_role(target) = 'master'
   or vertice_private.member_role(target) = any(roles), false);
$function$
;
