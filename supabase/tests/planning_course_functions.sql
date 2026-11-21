-- Testes: Planejamento reconhece a função no curso (20261122190000).
-- Requer avalia360_stubs.sql, course_staff_stubs.sql, 20261122150000, 20261122170000 e
-- stubs mínimos de vertice_planning.course_planning/sapiens com o trecho de autorização de produção
-- (supabase/tests/fixtures/planning_stubs.sql), aplicados ANTES de 20261122190000.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text, aal text default 'aal2') returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal',aal)::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
reset role;
delete from public.vertice_course_staff_functions;
delete from public.role_stub where user_id::text like '99999999-%';
delete from public.vertice_memberships where user_id::text like '99999999-%';
insert into auth.users(id,email,email_confirmed_at) values('99999999-0000-0000-0000-000000000001','g@x.test',now()),
 ('99999999-0000-0000-0000-000000000002','c@x.test',now()),('99999999-0000-0000-0000-000000000003','e@x.test',now()) on conflict do nothing;
insert into public.role_stub values('99999999-0000-0000-0000-000000000001',:I::uuid,'gestor'),('99999999-0000-0000-0000-000000000002',:I::uuid,'equipe'),('99999999-0000-0000-0000-000000000003',:I::uuid,'equipe');
insert into public.vertice_memberships select user_id,inst,role from public.role_stub where user_id::text like '99999999-%';
insert into public.vertice_course_staff_functions(institution_id,course_id,user_id,course_role) values(:I::uuid,:C::uuid,'99999999-0000-0000-0000-000000000002','coordenador');
-- Trechos substituídos
do $$ begin
 if position('course_function(p_institution_id,p_course_id)' in pg_get_functiondef('vertice_planning.course_planning(uuid,uuid,text,text,jsonb)'::regprocedure))=0 then raise exception 'course_planning não atualizada'; end if;
 if position('has_course_function(p_institution_id)' in pg_get_functiondef('vertice_planning.sapiens(uuid,text,jsonb)'::regprocedure))=0 then raise exception 'sapiens não atualizada'; end if;
end $$;
-- Coordenação por função: interpreta e grava o curso; outro curso não; Sapiens passa
select pg_temp.as_user('99999999-0000-0000-0000-000000000002');
do $$ begin
 if not vertice_planning.can_interpret('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001') then raise exception 'coordenação deveria interpretar'; end if;
 if vertice_planning.can_interpret('aaaaaaaa-0000-0000-0000-000000000001',gen_random_uuid()) then raise exception 'outro curso não'; end if;
 if vertice_planning.can_interpret('aaaaaaaa-0000-0000-0000-000000000001',null) then raise exception 'visão institucional não'; end if;
 if vertice_planning.course_planning('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','strategic','save','{}')->>'ok'<>'gravou' then raise exception 'deveria gravar'; end if;
 if vertice_planning.sapiens('aaaaaaaa-0000-0000-0000-000000000001','list','{}')->>'ok'<>'passou' then raise exception 'sapiens deveria passar'; end if;
end $$;
-- Sem MFA a função não vale
select pg_temp.as_user('99999999-0000-0000-0000-000000000002','aal1');
do $$ begin if coalesce(vertice_planning.can_interpret('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001'),false) then raise exception 'sem MFA não'; end if; end $$;
-- Equipe sem função: consulta apenas; Sapiens recusa
select pg_temp.as_user('99999999-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select vertice_planning.course_planning('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','strategic','save','{}')$$,'42501');
select pg_temp.expect_error($$select vertice_planning.sapiens('aaaaaaaa-0000-0000-0000-000000000001','list','{}')$$,'42501');
do $$ begin if vertice_planning.can_interpret('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001') then raise exception 'equipe sem função não interpreta'; end if; end $$;
-- Encerrada: perde
reset role; update public.vertice_course_staff_functions set active=false;
select pg_temp.as_user('99999999-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select vertice_planning.course_planning('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','strategic','save','{}')$$,'42501');
-- Gestão continua
select pg_temp.as_user('99999999-0000-0000-0000-000000000001');
do $$ begin if not vertice_planning.can_interpret('aaaaaaaa-0000-0000-0000-000000000001',null) then raise exception 'gestão deveria interpretar'; end if; end $$;
\echo PLANNING_COURSE_FUNCTION_TESTS_OK
