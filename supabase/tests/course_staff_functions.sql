-- Testes de coordenação/NDE por curso (vertice_course_staff, course_function, teaching_access, curriculum).
-- Requer supabase/tests/fixtures/avalia360_stubs.sql, 20261122150000 e 20261122170000.
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
delete from public.role_stub where user_id::text like '88888888-%';
insert into auth.users(id,email,email_confirmed_at) values
 ('88888888-0000-0000-0000-000000000001','gestora@ies.test',now()),
 ('88888888-0000-0000-0000-000000000002','coord@ies.test',now()),
 ('88888888-0000-0000-0000-000000000003','nde@ies.test',now()),
 ('88888888-0000-0000-0000-000000000004','fora@ies.test',now()) on conflict do nothing;
insert into public.role_stub values('88888888-0000-0000-0000-000000000001',:I::uuid,'gestor'),
 ('88888888-0000-0000-0000-000000000002',:I::uuid,'equipe'),('88888888-0000-0000-0000-000000000003',:I::uuid,'equipe');
delete from public.vertice_memberships where user_id::text like '88888888-%';
insert into public.vertice_memberships select user_id,inst,role from public.role_stub where user_id::text like '88888888-%';
set role authenticated;

-- Sem MFA: recusado. Equipe não atribui funções.
select pg_temp.as_user('88888888-0000-0000-0000-000000000001','aal1');
select pg_temp.expect_error(format('select public.vertice_course_staff(%L,%L,%L)',:I,'list','{}'),'42501');
select pg_temp.as_user('88888888-0000-0000-0000-000000000002');
select pg_temp.expect_error(format('select public.vertice_course_staff(%L,%L,%L)',:I,'grant',json_build_object('email','coord@ies.test','course_id',:C,'function','coordenador')),'42501');
-- Antes da função: equipe sem vínculo não edita a matriz nem acessa o Avalia
do $$ begin if vertice_private.teaching_access('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','record') then raise exception 'equipe sem função não deveria acessar'; end if; end $$;
do $$ begin if (public.vertice_curriculum_build('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','get','{}')->>'canWrite')::boolean then raise exception 'equipe não deveria escrever'; end if; end $$;

-- Gestora atribui; pessoa sem vínculo institucional é recusada; função/curso inválidos recusados
select pg_temp.as_user('88888888-0000-0000-0000-000000000001');
select pg_temp.expect_error(format('select public.vertice_course_staff(%L,%L,%L)',:I,'grant',json_build_object('email','fora@ies.test','course_id',:C,'function','coordenador')),'23514');
select pg_temp.expect_error(format('select public.vertice_course_staff(%L,%L,%L)',:I,'grant',json_build_object('email','coord@ies.test','course_id',:C,'function','reitor')),'22023');
select pg_temp.expect_error(format('select public.vertice_course_staff(%L,%L,%L)',:I,'grant',json_build_object('email','coord@ies.test','course_id',gen_random_uuid(),'function','nde')),'42501');
select jsonb_array_length(public.vertice_course_staff(:I,'grant',json_build_object('email','COORD@ies.test ','course_id',:C,'function','coordenador')::jsonb)) = 1 as granted1 \gset
select jsonb_array_length(public.vertice_course_staff(:I,'grant',json_build_object('email','nde@ies.test','course_id',:C,'function','nde')::jsonb)) = 2 as granted2 \gset
\if :granted1 \else \echo FALHA granted1 \quit \endif
\if :granted2 \else \echo FALHA granted2 \quit \endif

-- Coordenadora: Avalia (validate) e matriz (escrita); vê a própria função em 'mine'; não lista as demais
select pg_temp.as_user('88888888-0000-0000-0000-000000000002');
do $$ begin
 if not vertice_private.teaching_access('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','validate') then raise exception 'coordenação deveria validar'; end if;
 if not (public.vertice_curriculum_build('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','get','{}')->>'canWrite')::boolean then raise exception 'coordenação deveria escrever'; end if;
 if public.vertice_course_staff('aaaaaaaa-0000-0000-0000-000000000001','mine','{}')->0->>'function'<>'coordenador' then raise exception 'mine incorreto'; end if;
end $$;
select pg_temp.expect_error(format('select public.vertice_course_staff(%L,%L,%L)',:I,'list','{}'),'42501');
-- Sem MFA a função não vale
select pg_temp.as_user('88888888-0000-0000-0000-000000000002','aal1');
do $$ begin if coalesce(vertice_private.teaching_access('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','read'),false) then raise exception 'sem MFA não deveria acessar'; end if; end $$;

-- NDE: lê o Avalia, não registra; edita a matriz
select pg_temp.as_user('88888888-0000-0000-0000-000000000003');
do $$ begin
 if not vertice_private.teaching_access('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','read') then raise exception 'NDE deveria ler'; end if;
 if vertice_private.teaching_access('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','record') then raise exception 'NDE não deveria registrar'; end if;
 if not (public.vertice_curriculum_build('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','get','{}')->>'canWrite')::boolean then raise exception 'NDE deveria editar a matriz'; end if;
end $$;

-- Encerramento: perde o acesso; histórico preservado; reatribuição reativa
select pg_temp.as_user('88888888-0000-0000-0000-000000000001');
select public.vertice_course_staff(:I,'revoke',json_build_object('user_id','88888888-0000-0000-0000-000000000002','course_id',:C,'function','coordenador')::jsonb) is not null as ok \gset
select pg_temp.expect_error(format('select public.vertice_course_staff(%L,%L,%L)',:I,'revoke',json_build_object('user_id','88888888-0000-0000-0000-000000000002','course_id',:C,'function','coordenador')),'23514');
select pg_temp.as_user('88888888-0000-0000-0000-000000000002');
do $$ begin if vertice_private.teaching_access('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','read') then raise exception 'encerrada não deveria acessar'; end if; end $$;
select pg_temp.as_user('88888888-0000-0000-0000-000000000001');
select (select count(*) from jsonb_array_elements(public.vertice_course_staff(:I,'list','{}')) e where e->>'active'='false' and e->>'revoked_at' is not null)=1 as hist \gset
\if :hist \else \echo FALHA historico \quit \endif

-- Sem acesso direto à tabela
select pg_temp.expect_error('select * from public.vertice_course_staff_functions','42501');
select pg_temp.expect_error('select vertice_private.course_function(gen_random_uuid(),gen_random_uuid())','42501');
reset role;
\echo COURSE_STAFF_TESTS_OK
