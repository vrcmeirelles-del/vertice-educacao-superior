-- Stubs mínimos para 20261122210000 (Discursiva, Conecta, Mercado, PDI).
create schema if not exists vertice_discursiva; create schema if not exists vertice_conecta; create schema if not exists vertice_market;
create or replace function vertice_private.is_master() returns boolean language sql stable as $$ select false $$;
create function vertice_discursiva.authorize(inst uuid, course uuid) returns boolean language sql as $$ select false $$;
create function vertice_conecta.allowed(inst uuid, course uuid) returns boolean language sql as $$ select false $$;
create function vertice_conecta.alumni_indicators(inst uuid, kind text) returns jsonb language sql as $$ select '[]'::jsonb $$;
create function vertice_market.allowed(i uuid, c uuid, p text) returns boolean language sql as $$ select false $$;
create function vertice_private.pdi_access(inst uuid, edit boolean) returns boolean language sql as $$ select false $$;
create function vertice_conecta.api(inst uuid, action text, p jsonb) returns jsonb language plpgsql security definer set search_path to '' as $function$
DECLARE r text;BEGIN
 r:=vertice_private.member_role(inst);
 IF r IS NULL OR r NOT IN ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde','cpa') THEN RAISE EXCEPTION 'Vínculo autorizado e segundo fator obrigatórios' USING ERRCODE='42501';END IF;
 IF r<>'cpa' AND NOT vertice_conecta.allowed(inst,(p->>'course_id')::uuid) THEN RAISE EXCEPTION 'Selecione um curso do vínculo validado' USING ERRCODE='42501';END IF;
 RETURN '{"ok":true}';END $function$;
grant usage on schema vertice_discursiva, vertice_conecta, vertice_market to authenticated;
grant usage on schema auth to authenticated; grant execute on function auth.uid(), auth.jwt() to authenticated;  -- como em produção
grant select on public.vertice_learning_staff_scope to authenticated;  -- como em produção (RLS filtra)
grant select on public.role_stub to authenticated;  -- stub de member_role (em produção é security definer)
