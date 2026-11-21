-- Testes: Discursiva, Conecta, Mercado e PDI reconhecem a função no curso (20261122210000).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text, aal text default 'aal2') returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub',u,'aal',aal)::text, false) $$;
\set I '''aaaaaaaa-0000-0000-0000-000000000001'''
\set C '''cccccccc-0000-0000-0000-000000000001'''
reset role;
delete from public.vertice_course_staff_functions;
delete from public.role_stub where user_id::text like '99999999-%';
delete from public.vertice_memberships where user_id::text like '99999999-%';
insert into auth.users(id,email,email_confirmed_at) values('99999999-0000-0000-0000-000000000002','c@x.test',now()),('99999999-0000-0000-0000-000000000003','e@x.test',now()) on conflict do nothing;
insert into public.role_stub values('99999999-0000-0000-0000-000000000002',:I::uuid,'equipe'),('99999999-0000-0000-0000-000000000003',:I::uuid,'equipe');
insert into public.vertice_memberships select user_id,inst,role from public.role_stub where user_id::text like '99999999-%';
insert into public.vertice_course_staff_functions(institution_id,course_id,user_id,course_role) values(:I::uuid,:C::uuid,'99999999-0000-0000-0000-000000000002','nde');
grant execute on function vertice_discursiva.authorize(uuid,uuid), vertice_conecta.allowed(uuid,uuid), vertice_conecta.api(uuid,text,jsonb), vertice_market.allowed(uuid,uuid,text), vertice_private.pdi_access(uuid,boolean) to authenticated;
set role authenticated;
select pg_temp.as_user('99999999-0000-0000-0000-000000000002');
do $$ declare i uuid:='aaaaaaaa-0000-0000-0000-000000000001'; c uuid:='cccccccc-0000-0000-0000-000000000001'; o uuid:=gen_random_uuid(); begin
 if not vertice_discursiva.authorize(i,c) then raise exception 'discursiva deveria autorizar'; end if;
 if vertice_discursiva.authorize(i,o) then raise exception 'discursiva outro curso'; end if;
 if not vertice_conecta.allowed(i,c) then raise exception 'conecta deveria autorizar (invoker)'; end if;
 if vertice_conecta.allowed(i,null) then raise exception 'conecta visão institucional não'; end if;
 if vertice_conecta.api(i,'x',jsonb_build_object('course_id',c))->>'ok'<>'true' then raise exception 'conecta api'; end if;
 if not vertice_market.allowed(i,c,'academic') then raise exception 'mercado acadêmico'; end if;
 if vertice_market.allowed(i,c,'commercial') then raise exception 'mercado comercial não'; end if;
 if vertice_market.allowed(i,o,'academic') then raise exception 'mercado outro curso'; end if;
 if not vertice_private.pdi_access(i,false) then raise exception 'pdi leitura'; end if;
 if vertice_private.pdi_access(i,true) then raise exception 'pdi edição não'; end if;
end $$;
-- Sem MFA nada vale
select pg_temp.as_user('99999999-0000-0000-0000-000000000002','aal1');
do $$ begin if coalesce(vertice_discursiva.authorize('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001'),false) or coalesce(vertice_conecta.allowed('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001'),false) or coalesce(vertice_private.pdi_access('aaaaaaaa-0000-0000-0000-000000000001',false),false) then raise exception 'sem MFA não'; end if; end $$;
-- Equipe sem função: nada; API do Conecta recusa
select pg_temp.as_user('99999999-0000-0000-0000-000000000003');
do $$ declare i uuid:='aaaaaaaa-0000-0000-0000-000000000001'; c uuid:='cccccccc-0000-0000-0000-000000000001'; ok boolean:=false; begin
 if vertice_discursiva.authorize(i,c) or vertice_conecta.allowed(i,c) or vertice_market.allowed(i,c,'academic') or vertice_private.pdi_access(i,false) then raise exception 'equipe sem função não'; end if;
 begin perform vertice_conecta.api(i,'x',jsonb_build_object('course_id',c)); exception when sqlstate '42501' then ok:=true; end;
 if not ok then raise exception 'api deveria recusar'; end if;
end $$;
reset role;
\echo MODULES_COURSE_FUNCTION_TESTS_OK
