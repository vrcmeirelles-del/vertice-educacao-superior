-- Testes das Trilhas de Formação (vertice_formation_trails). Requer avalia360_stubs, course_staff_stubs,
-- trails_stubs e as migrações 20261122150000, 20261122170000, 20261122190000, 20261122250000.
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text, aal text default 'aal2') returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal',aal)::text, false) $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin execute sql; raise exception 'esperava erro % em: %', code, sql;
exception when others then if sqlstate<>code then raise exception 'erro % (esperado %): %', sqlstate, code, sqlerrm; end if; end $$;
create or replace function pg_temp.t(a text, p jsonb default '{}') returns jsonb language sql as
$$ select public.vertice_formation_trails('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',a,p) $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
reset role;
delete from vertice_app.formation_trails; delete from vertice_app.trail_analysis_snapshots; delete from public.vertice_course_staff_functions;
delete from public.role_stub where user_id::text like '66666666-%'; delete from public.vertice_memberships where user_id::text like '66666666-%';
insert into auth.users(id,email,email_confirmed_at) values('66666666-0000-0000-0000-000000000001','g@t.test',now()),('66666666-0000-0000-0000-000000000002','c@t.test',now()),('66666666-0000-0000-0000-000000000003','e@t.test',now()) on conflict do nothing;
insert into public.role_stub values('66666666-0000-0000-0000-000000000001',:I::uuid,'gestor'),('66666666-0000-0000-0000-000000000002',:I::uuid,'equipe'),('66666666-0000-0000-0000-000000000003',:I::uuid,'equipe');
insert into public.vertice_memberships select user_id,inst,role from public.role_stub where user_id::text like '66666666-%';
insert into public.vertice_course_staff_functions(institution_id,course_id,user_id,course_role) values(:I::uuid,:C::uuid,'66666666-0000-0000-0000-000000000002','coordenador');
-- matriz publicada para importar
delete from vertice_app.curriculum_builds where course_id=:C::uuid;
insert into vertice_app.institutions(id,slug,name,status) values(:I::uuid,'t','t','active') on conflict do nothing;
insert into vertice_app.courses(id,institution_id,code,name) values(:C::uuid,:I::uuid,'c','c') on conflict do nothing;
with b as (insert into vertice_app.curriculum_builds(institution_id,course_id,version,status) values(:I::uuid,:C::uuid,1,'published') returning id)
insert into vertice_app.curriculum_competencies(build_id,code,title,description,sort_order) select id,x.code,x.title,'d',x.o from b,(values('C1','Interpretar',0),('C2','Argumentar',1)) x(code,title,o);
set role authenticated;

-- Sem MFA / equipe sem função: lê? equipe sem vínculo não lê; não grava
select pg_temp.as_user('66666666-0000-0000-0000-000000000001','aal1');
select pg_temp.expect_error($$select pg_temp.t('get')$$,'42501');
select pg_temp.as_user('66666666-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select pg_temp.t('get')$$,'42501');
select pg_temp.expect_error($$select pg_temp.t('save_trail','{"code":"T1","name":"x"}')$$,'42501');
-- Coordenação por função: grava, valida, importa
select pg_temp.as_user('66666666-0000-0000-0000-000000000002');
do $$ declare r jsonb; tid text; begin
 r := pg_temp.t('get'); if not (r->>'canWrite')::boolean then raise exception 'coordenação deveria gravar'; end if;
 r := pg_temp.t('save_trail','{"code":"T1","name":"Direito Civil","keywords":["civil","contratos","civil"]}');
 if jsonb_array_length(r->'trails')<>1 or jsonb_array_length(r->'trails'->0->'keywords')<>2 then raise exception 'save_trail %', r; end if;
 tid := r->'trails'->0->>'id';
 r := pg_temp.t('save_trail',jsonb_build_object('id',tid,'code','T1','name','Direito Civil e Contratos','keywords','["civil"]'::jsonb));
 if r->'trails'->0->>'name'<>'Direito Civil e Contratos' then raise exception 'update'; end if;
 r := pg_temp.t('add_question',jsonb_build_object('trail_id',tid,'enade_year',2022,'question_number',12,'national_correct_pct',60,'ies_correct_pct','45,5'));
 if (r->'questions'->0->>'discrepancy')::numeric<>-14.5 then raise exception 'discrepância %', r->'questions'; end if;
 if r->'diagnostic'->0->>'status'<>'critico' then raise exception 'diagnóstico %', r->'diagnostic'; end if;
 r := pg_temp.t('import_curriculum');
 if (r->>'imported')::int<>2 or jsonb_array_length(r->'trails')<>3 then raise exception 'import %', r; end if;
 r := pg_temp.t('import_curriculum'); if (r->>'imported')::int<>0 then raise exception 'reimport deveria ser idempotente'; end if;
 r := pg_temp.t('save_snapshot','{"summary":"ok"}');
 r := pg_temp.t('delete_question',jsonb_build_object('id',(pg_temp.t('get')->'questions'->0->>'id')));
 if jsonb_array_length(r->'questions')<>0 then raise exception 'delete_question'; end if;
end $$;
select pg_temp.expect_error($$select pg_temp.t('save_trail','{"code":"t1","name":"dup"}')$$,'23505');
select pg_temp.expect_error($$select pg_temp.t('save_trail','{"code":"","name":"x"}')$$,'22023');
select pg_temp.expect_error($$select pg_temp.t('add_question',jsonb_build_object('trail_id',(pg_temp.t('get')->'trails'->0->>'id'),'ies_correct_pct',120))$$,'22023');
select pg_temp.expect_error($$select pg_temp.t('delete_trail',jsonb_build_object('id',gen_random_uuid()))$$,'42501');
-- Outro curso: recusado
select pg_temp.expect_error($$select public.vertice_formation_trails('aaaaaaaa-0000-0000-0000-000000000001',gen_random_uuid(),'get','{}')$$,'42501');
-- Gestão: visão institucional
select pg_temp.as_user('66666666-0000-0000-0000-000000000001');
do $$ declare r jsonb; begin
 r := public.vertice_formation_trails('aaaaaaaa-0000-0000-0000-000000000001',null,'institution_diagnostic','{}');
 if (r->>'trails')::int<>3 or jsonb_array_length(r->'diagnostic')<>3 then raise exception 'institucional %', r; end if;
end $$;
-- Equipe sem função: visão institucional vazia
select pg_temp.as_user('66666666-0000-0000-0000-000000000003');
do $$ begin if (public.vertice_formation_trails('aaaaaaaa-0000-0000-0000-000000000001',null,'institution_diagnostic','{}')->>'trails')::int<>0 then raise exception 'vazou'; end if; end $$;
-- Snapshot gravado com ranking do servidor; sem acesso direto
reset role;
do $$ begin if (select count(*) from vertice_app.trail_analysis_snapshots where jsonb_array_length(trail_rankings)=3 and summary='ok')<>1 then raise exception 'snapshot'; end if; end $$;
set role authenticated;
select pg_temp.expect_error('select * from vertice_app.formation_trails','42501');
reset role;
\echo FORMATION_TRAILS_TESTS_OK
