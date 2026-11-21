-- Planejamento reconhece a função no curso (coordenação/NDE atribuída pela gestão, 20261122170000).
-- Três portas do Planejamento:
--  1. vertice_planning.course_planning — gravar/publicar planejamento estratégico e semestral do curso;
--  2. vertice_planning.can_interpret — interpretação, inteligência competitiva, portfólio e recortes do Sapiens;
--  3. vertice_planning.sapiens — porta institucional da análise (antes de recortar por curso).
-- course_planning e sapiens são longas e foram evoluindo em produção: o trecho de autorização é
-- substituído na definição vigente, com verificação de que o trecho esperado existe (falha explícita se não).
begin;

-- Membro com MFA que tem ao menos uma função ativa em algum curso da IES.
create function vertice_private.has_course_function(inst uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select vertice_private.member_role(inst) is not null and exists(
  select 1 from public.vertice_course_staff_functions f
  where f.user_id=(select auth.uid()) and f.institution_id=inst and f.active)
$$;
revoke all on function vertice_private.has_course_function(uuid) from public,anon,authenticated;

create or replace function vertice_planning.can_interpret(p_institution uuid, p_course uuid default null::uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
 SELECT auth.uid() IS NOT NULL AND coalesce(
  vertice_private.member_role(p_institution) IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') OR
  (p_course IS NOT NULL AND vertice_private.course_function(p_institution,p_course) IN ('coordenador','nde')) OR
  (p_course IS NOT NULL AND vertice_private.member_role(p_institution) IN ('coordenador','nde') AND EXISTS(
   SELECT 1 FROM public.vertice_learning_staff_scope s JOIN public.vertice_courses c ON c.id=s.course_id AND c.institution_id=s.institution_id
   WHERE s.user_id=auth.uid() AND s.institution_id=p_institution AND s.course_id=p_course AND s.active)),false);
$function$;

do $do$
declare d text;
 old_cp text := $o$ IF v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde') THEN
   RAISE EXCEPTION 'Seu perfil permite apenas consultar o planejamento' USING ERRCODE='42501';$o$;
 new_cp text := $n$ IF NOT (v_role IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde')
     OR coalesce(vertice_private.course_function(p_institution_id,p_course_id) IN ('coordenador','nde'),false)) THEN
   RAISE EXCEPTION 'Seu perfil permite apenas consultar o planejamento' USING ERRCODE='42501';$n$;
 old_sp text := $o$IF NOT coalesce(v_role IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde'),false) THEN$o$;
 new_sp text := $n$IF NOT (coalesce(v_role IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde'),false)
     OR vertice_private.has_course_function(p_institution_id)) THEN$n$;
begin
 d := pg_get_functiondef('vertice_planning.course_planning(uuid,uuid,text,text,jsonb)'::regprocedure);
 if (length(d)-length(replace(d,old_cp,'')))/length(old_cp)<>1 then
  raise exception 'course_planning: trecho de autorização esperado não encontrado (definição divergente).';
 end if;
 execute replace(d,old_cp,new_cp);
 d := pg_get_functiondef('vertice_planning.sapiens(uuid,text,jsonb)'::regprocedure);
 if (length(d)-length(replace(d,old_sp,'')))/length(old_sp)<>1 then
  raise exception 'sapiens: trecho de autorização esperado não encontrado (definição divergente).';
 end if;
 execute replace(d,old_sp,new_sp);
end $do$;

notify pgrst, 'reload schema';
commit;
