-- Testes da área real. Todas as fixtures são revertidas (rollback).
begin;
insert into auth.users(id,email,email_confirmed_at) values
('11000000-0000-4000-8000-000000000001','t-master@example.invalid',now()),
('11000000-0000-4000-8000-000000000002','t-gestor@example.invalid',now()),
('11000000-0000-4000-8000-000000000003','t-equipe@example.invalid',now()),
('11000000-0000-4000-8000-000000000004','t-leitor@example.invalid',now()),
('11000000-0000-4000-8000-000000000005','t-fora@example.invalid',now()),
('11000000-0000-4000-8000-000000000006','t-convidado@example.invalid',now());
insert into public.vertice_admins(user_id) values ('11000000-0000-4000-8000-000000000001');
insert into public.vertice_institutions(id,name) values
('21000000-0000-4000-8000-00000000000a','IES A'),('21000000-0000-4000-8000-00000000000b','IES B');
insert into public.vertice_courses(id,institution_id,name) values
('31000000-0000-4000-8000-00000000000a','21000000-0000-4000-8000-00000000000a','Direito A'),
('31000000-0000-4000-8000-00000000000b','21000000-0000-4000-8000-00000000000b','Direito B');
insert into public.vertice_memberships(user_id,institution_id,role) values
('11000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-00000000000a','gestor'),
('11000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-00000000000a','equipe'),
('11000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-00000000000a','leitor');

create function pg_temp.as_user(u text, aal text default 'aal2') returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub',u,'aal',aal,'role','authenticated')::text, true) $$;
create function pg_temp.expect_denied(sql text, label text) returns void language plpgsql as $$
declare n integer;
begin
 begin execute sql; get diagnostics n = row_count;
 exception when insufficient_privilege or check_violation then return; end;
 if n > 0 then raise exception 'FAIL %: operação permitida', label; end if;
end $$;
grant execute on function pg_temp.as_user(text,text), pg_temp.expect_denied(text,text) to authenticated;

set local role authenticated;

-- MASTER
select pg_temp.as_user('11000000-0000-4000-8000-000000000001');
insert into public.vertice_institutions(id,name,acronym,cnpj,state) values ('21000000-0000-4000-8000-00000000000c','IES C','IESC','12345678000199','TO');
update public.vertice_institutions set city='Palmas' where id='21000000-0000-4000-8000-00000000000c';
insert into public.vertice_goals(id,institution_id,course_id,title,indicator,target) values
 ('41000000-0000-4000-8000-00000000000b','21000000-0000-4000-8000-00000000000b','31000000-0000-4000-8000-00000000000b','Meta B','Taxa',90);
do $$begin if (select count(*) from public.vertice_institutions where name in ('IES A','IES B','IES C'))<>3 then raise exception 'FAIL master vê todas'; end if; end$$;
select pg_temp.expect_denied($$insert into public.vertice_goals(institution_id,course_id,title,indicator,target) values ('21000000-0000-4000-8000-00000000000a','31000000-0000-4000-8000-00000000000b','x','y',1)$$,'curso de outra IES');

-- MASTER sem MFA
select pg_temp.as_user('11000000-0000-4000-8000-000000000001','aal1');
select pg_temp.expect_denied($$insert into public.vertice_institutions(name) values ('Sem MFA')$$,'master sem MFA cria IES');

-- GESTOR da IES A
select pg_temp.as_user('11000000-0000-4000-8000-000000000002');
select pg_temp.expect_denied($$insert into public.vertice_institutions(name) values ('Gestor cria')$$,'gestor cria IES');
update public.vertice_institutions set city='Gurupi' where id='21000000-0000-4000-8000-00000000000a';
do $$begin if (select city from public.vertice_institutions where id='21000000-0000-4000-8000-00000000000a') is distinct from 'Gurupi' then raise exception 'FAIL gestor edita própria IES'; end if; end$$;
select pg_temp.expect_denied($$update public.vertice_institutions set city='x' where id='21000000-0000-4000-8000-00000000000b'$$,'gestor edita outra IES');
insert into public.vertice_courses(institution_id,name,degree) values ('21000000-0000-4000-8000-00000000000a','Psicologia','bacharelado');
select pg_temp.expect_denied($$insert into public.vertice_courses(institution_id,name) values ('21000000-0000-4000-8000-00000000000b','Invasão')$$,'gestor cria curso em outra IES');
select pg_temp.expect_denied($$delete from public.vertice_courses where name='Psicologia'$$,'gestor apaga curso');
insert into public.vertice_goals(id,institution_id,course_id,title,indicator,target,unit) values
 ('41000000-0000-4000-8000-00000000000a','21000000-0000-4000-8000-00000000000a','31000000-0000-4000-8000-00000000000a','Reduzir evasão','Evasão anual',10,'%');
insert into public.vertice_diagnosis_items(id,institution_id,dimension,criterion,score) values
 ('51000000-0000-4000-8000-00000000000a','21000000-0000-4000-8000-00000000000a','Organização didático-pedagógica','PPC atualizado',3);
insert into public.vertice_actions(institution_id,goal_id,finding_id,what,who,due_date) values
 ('21000000-0000-4000-8000-00000000000a','41000000-0000-4000-8000-00000000000a','51000000-0000-4000-8000-00000000000a','Revisar PPC','NDE','2026-12-15');
select pg_temp.expect_denied($$insert into public.vertice_actions(institution_id,goal_id,what) values ('21000000-0000-4000-8000-00000000000a','41000000-0000-4000-8000-00000000000b','x')$$,'ação ligada a meta de outra IES');
do $$begin if (select count(*) from public.vertice_goals where institution_id in ('21000000-0000-4000-8000-00000000000a','21000000-0000-4000-8000-00000000000b'))<>1 then raise exception 'FAIL gestor isolamento de metas'; end if; end$$;
-- equipe: gestor adiciona equipe/leitor, não gestor
do $$begin if public.vertice_add_member('21000000-0000-4000-8000-00000000000a','T-Convidado@example.invalid','equipe')<>'vinculado' then raise exception 'FAIL gestor vincula conta existente'; end if; end$$;
do $$begin if public.vertice_add_member('21000000-0000-4000-8000-00000000000a','nova@example.invalid','leitor')<>'convite_pendente' then raise exception 'FAIL convite pendente'; end if; end$$;
do $$begin
 begin perform public.vertice_add_member('21000000-0000-4000-8000-00000000000a','outra@example.invalid','gestor'); raise exception 'FAIL gestor cria gestor';
 exception when insufficient_privilege then null; end;
 begin perform public.vertice_add_member('21000000-0000-4000-8000-00000000000b','outra@example.invalid','equipe'); raise exception 'FAIL gestor convida em outra IES';
 exception when insufficient_privilege then null; end;
end$$;
select pg_temp.expect_denied($$insert into public.vertice_memberships(user_id,institution_id,role) values ('11000000-0000-4000-8000-000000000005','21000000-0000-4000-8000-00000000000a','gestor')$$,'gestor insere gestor');
select pg_temp.expect_denied($$update public.vertice_memberships set role='leitor' where user_id='11000000-0000-4000-8000-000000000002'$$,'gestor rebaixa a si mesmo');
do $$begin if (select count(*) from public.vertice_team('21000000-0000-4000-8000-00000000000a'))<>4 then raise exception 'FAIL equipe visível ao gestor'; end if;
 if (select count(*) from public.vertice_team('21000000-0000-4000-8000-00000000000b'))<>0 then raise exception 'FAIL equipe de outra IES'; end if; end$$;

-- EQUIPE da IES A
select pg_temp.as_user('11000000-0000-4000-8000-000000000003');
insert into public.vertice_goal_measurements(institution_id,goal_id,measured_on,value) values ('21000000-0000-4000-8000-00000000000a','41000000-0000-4000-8000-00000000000a','2026-10-30',14.5);
update public.vertice_actions set status='em_andamento', progress=30, evidence='Ata NDE 12/10' where what='Revisar PPC';
select pg_temp.expect_denied($$update public.vertice_goals set target=1$$,'equipe altera meta');
select pg_temp.expect_denied($$delete from public.vertice_actions$$,'equipe apaga ação');
select pg_temp.expect_denied($$insert into public.vertice_courses(institution_id,name) values ('21000000-0000-4000-8000-00000000000a','x')$$,'equipe cria curso');
do $$begin if (select count(*) from public.vertice_team('21000000-0000-4000-8000-00000000000a'))<>0 then raise exception 'FAIL equipe lista e-mails'; end if; end$$;
do $$begin
 begin perform public.vertice_add_member('21000000-0000-4000-8000-00000000000a','x@example.invalid','leitor'); raise exception 'FAIL equipe convida';
 exception when insufficient_privilege then null; end; end$$;

-- LEITOR
select pg_temp.as_user('11000000-0000-4000-8000-000000000004');
do $$begin if (select count(*) from public.vertice_actions)<>1 then raise exception 'FAIL leitor lê'; end if; end$$;
select pg_temp.expect_denied($$insert into public.vertice_actions(institution_id,what) values ('21000000-0000-4000-8000-00000000000a','x')$$,'leitor cria ação');
select pg_temp.expect_denied($$update public.vertice_actions set progress=100$$,'leitor atualiza ação');

-- EQUIPE sem MFA
select pg_temp.as_user('11000000-0000-4000-8000-000000000003','aal1');
do $$begin if (select count(*) from public.vertice_goals)>0 then raise exception 'FAIL leitura sem MFA'; end if; end$$;
select pg_temp.expect_denied($$insert into public.vertice_goal_measurements(institution_id,goal_id,measured_on,value) values ('21000000-0000-4000-8000-00000000000a','41000000-0000-4000-8000-00000000000a','2026-10-30',1)$$,'escrita sem MFA');

-- FORA de qualquer IES
select pg_temp.as_user('11000000-0000-4000-8000-000000000005');
do $$begin if (select count(*) from public.vertice_goals)+(select count(*) from public.vertice_actions)+(select count(*) from public.vertice_diagnosis_items)+(select count(*) from public.vertice_invites)>0 then raise exception 'FAIL isolamento externo'; end if; end$$;
select pg_temp.expect_denied($$insert into public.vertice_memberships(user_id,institution_id,role) values (auth.uid(),'21000000-0000-4000-8000-00000000000a','gestor')$$,'autovínculo');

-- Convite aceito no primeiro acesso com e-mail confirmado
reset role;
insert into auth.users(id,email,email_confirmed_at) values ('11000000-0000-4000-8000-000000000007','nova@example.invalid',now());
set local role authenticated;
select pg_temp.as_user('11000000-0000-4000-8000-000000000007','aal1');
do $$begin if public.vertice_accept_invites()<>0 then raise exception 'FAIL aceita convite sem MFA'; end if; end$$;
select pg_temp.as_user('11000000-0000-4000-8000-000000000007');
do $$begin if public.vertice_accept_invites()<>1 then raise exception 'FAIL aceite de convite'; end if;
 if (select role from public.vertice_memberships where user_id=auth.uid())<>'leitor' then raise exception 'FAIL papel do convite'; end if; end$$;

-- Gestor apaga ação; auditoria registrou operações
select pg_temp.as_user('11000000-0000-4000-8000-000000000002');
delete from public.vertice_actions where what='Revisar PPC';
reset role;
do $$begin if (select count(*) from public.vertice_audit where occurred_at >= now() and table_name in ('vertice_actions','vertice_goals','vertice_goal_measurements','vertice_diagnosis_items','vertice_invites'))<6 then raise exception 'FAIL auditoria'; end if; end$$;
rollback;
select 'PASS área real: papéis master/gestor/equipe/leitor, MFA, isolamento entre IES, convites, auditoria; fixtures revertidas' as validation;
