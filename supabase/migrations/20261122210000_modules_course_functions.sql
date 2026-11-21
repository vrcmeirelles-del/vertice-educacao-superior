-- Discursiva 360°, Conecta, Mercado e PDI reconhecem a função no curso (coordenação/NDE, 20261122170000).
-- Mesmo modelo do Planejamento: a função vale só no curso indicado, exige MFA e vínculo institucional vigente;
-- as regras anteriores (papel na IES + vertice_learning_staff_scope) ficam intactas.
begin;

-- vertice_conecta.allowed é security invoker: precisa executar as consultas da própria função
-- (retornam apenas a situação do próprio usuário autenticado).
grant execute on function vertice_private.course_function(uuid,uuid) to authenticated;
grant execute on function vertice_private.has_course_function(uuid) to authenticated;

-- Discursiva 360°
create or replace function vertice_discursiva.authorize(inst uuid, course uuid)
 returns boolean language sql stable security definer set search_path to 'pg_catalog' as $function$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal'='aal2',false)
 and exists(select 1 from public.vertice_courses where id=course and institution_id=inst)
 and coalesce(vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
 or vertice_private.course_function(inst,course) in ('coordenador','nde')
 or (vertice_private.member_role(inst) in ('coordenador','nde') and exists(
 select 1 from public.vertice_learning_staff_scope where user_id=auth.uid() and institution_id=inst and course_id=course and active)),false);
$function$;

-- Conecta 360° (egressos): escopo por curso
create or replace function vertice_conecta.allowed(inst uuid, course uuid)
 returns boolean language sql stable set search_path to '' as $function$
 SELECT auth.uid() IS NOT NULL
  AND coalesce(auth.jwt()->>'aal','')='aal2'
  AND (
   vertice_private.member_role(inst) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
   OR (course IS NOT NULL AND coalesce(vertice_private.course_function(inst,course) IN ('coordenador','nde'),false))
   OR (vertice_private.member_role(inst) IN ('coordenador','nde') AND course IS NOT NULL AND EXISTS(
     SELECT 1 FROM public.vertice_learning_staff_scope s
     WHERE s.institution_id=inst AND s.course_id=course AND s.user_id=auth.uid() AND s.active)))
$function$;

-- Conecta 360°: indicadores (porta institucional; o recorte por curso segue em alumni_scope → allowed)
create or replace function vertice_conecta.alumni_indicators(inst uuid, kind text)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
DECLARE r text;result jsonb;BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'Autenticação e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 r:=vertice_private.member_role(inst);
 IF r IS NULL OR (r NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde','cpa')
    AND NOT vertice_private.has_course_function(inst)) THEN RAISE EXCEPTION 'Vínculo institucional obrigatório' USING ERRCODE='42501';END IF;
 IF kind='overview' THEN SELECT jsonb_agg(v) INTO result FROM public.vertice_alumni_overview v WHERE v.institution_id=inst AND (r='cpa' OR vertice_private.alumni_scope(inst,v.course_id));
 ELSIF kind='surveys' THEN SELECT jsonb_agg(v) INTO result FROM public.v_alumni_survey_indicators v JOIN public.vertice_alumni_surveys s ON s.id=v.survey_id WHERE v.institution_id=inst AND (r='cpa' OR vertice_private.alumni_scope(inst,s.course_id));
 ELSIF kind='trajectory' THEN SELECT jsonb_agg(v) INTO result FROM public.v_alumni_trajectory_indicators v WHERE v.institution_id=inst AND (r='cpa' OR vertice_private.alumni_scope(inst,v.course_id));
 ELSE RAISE EXCEPTION 'Indicador inválido';END IF;RETURN coalesce(result,'[]');END $function$;

-- Conecta 360°: API (porta institucional substituída na definição vigente, com verificação)
do $do$
declare d text;
 old_t text := $o$IF r IS NULL OR r NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde','cpa') THEN RAISE EXCEPTION 'Vínculo autorizado e segundo fator obrigatórios'$o$;
 new_t text := $n$IF r IS NULL OR (r NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde','cpa') AND NOT vertice_private.has_course_function(inst)) THEN RAISE EXCEPTION 'Vínculo autorizado e segundo fator obrigatórios'$n$;
begin
 d := pg_get_functiondef('vertice_conecta.api(uuid,text,jsonb)'::regprocedure);
 if (length(d)-length(replace(d,old_t,'')))/length(old_t)<>1 then
  raise exception 'conecta.api: trecho de autorização esperado não encontrado (definição divergente).';
 end if;
 execute replace(d,old_t,new_t);
end $do$;

-- Mercado (perspectiva acadêmica; a comercial segue restrita ao master)
create or replace function vertice_market.allowed(i uuid, c uuid, p text)
 returns boolean language sql stable security definer set search_path to '' as $function$
 SELECT auth.uid() IS NOT NULL AND coalesce((auth.jwt()->>'aal')='aal2',false)
 AND (CASE WHEN p='commercial' THEN vertice_private.is_master()
 ELSE vertice_private.member_role(i) IN ('master','reitor','diretor_geral','diretor_pedagogico','procurador','gestor')
 OR (c IS NOT NULL AND coalesce(vertice_private.course_function(i,c) IN ('coordenador','nde'),false))
 OR (c IS NOT NULL AND vertice_private.member_role(i) IN ('coordenador','nde','equipe') AND EXISTS(
 SELECT 1 FROM public.vertice_learning_staff_scope s WHERE s.institution_id=i AND s.course_id=c AND s.user_id=auth.uid() AND s.active)) END);
$function$;

-- PDI: consulta para quem tem função em algum curso (edição segue com a gestão)
create or replace function vertice_private.pdi_access(inst uuid, edit boolean)
 returns boolean language sql stable security definer set search_path to '' as $function$
 select coalesce(
   (select auth.uid()) is not null and (select auth.jwt()->>'aal')='aal2'
   and exists(select 1 from public.vertice_institutions i where i.id=inst and i.tier='superior')
   and (vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
      or (not edit and vertice_private.has_course_function(inst))
      or (not edit and vertice_private.member_role(inst) in ('coordenador','nde','equipe') and exists(
        select 1 from public.vertice_learning_staff_scope st join public.vertice_courses c on c.id=st.course_id and c.institution_id=st.institution_id
        where st.user_id=(select auth.uid()) and st.institution_id=inst and st.active
      ))),false)
$function$;

notify pgrst, 'reload schema';
commit;
