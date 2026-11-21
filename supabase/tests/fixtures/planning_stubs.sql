-- Stubs mínimos de vertice_planning com o trecho de autorização idêntico ao de produção (para 20261122190000).
create schema if not exists vertice_planning;
create function vertice_planning.can_interpret(p_institution uuid, p_course uuid default null::uuid) returns boolean language sql as $$ select false $$;
create function vertice_planning.course_planning(p_institution_id uuid, p_course_id uuid, p_kind text, p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
DECLARE v_role text;
BEGIN
 v_role := vertice_private.member_role(p_institution_id);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Acesso institucional ou verificação de segurança pendente' USING ERRCODE='42501'; END IF;
 IF v_role NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde') THEN
   RAISE EXCEPTION 'Seu perfil permite apenas consultar o planejamento' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('ok','gravou');
END;
$function$;
create function vertice_planning.sapiens(p_institution_id uuid, p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
DECLARE v_role text;
BEGIN
 v_role:=vertice_private.member_role(p_institution_id);
 IF NOT coalesce(v_role IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde'),false) THEN RAISE EXCEPTION 'Análise exige vínculo autorizado e segundo fator' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok','passou');
END;
$function$;
