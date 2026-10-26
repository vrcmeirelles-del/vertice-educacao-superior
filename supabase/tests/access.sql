-- All fixtures are rolled back. No live identities or institutions are modified.
begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000001','rls-master@example.invalid'),
('10000000-0000-4000-8000-000000000002','rls-member@example.invalid'),
('10000000-0000-4000-8000-000000000003','rls-outsider@example.invalid');
insert into public.vertice_institutions(id,name) values
('20000000-0000-4000-8000-000000000001','RLS test A'),
('20000000-0000-4000-8000-000000000002','RLS test B');
insert into public.vertice_admins(user_id) values ('10000000-0000-4000-8000-000000000001');
insert into public.vertice_memberships(user_id,institution_id,role) values ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','gestor');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}',true);
do $$begin if (select count(*) from public.vertice_institutions)>0 then raise exception 'FAIL outsider isolation'; end if; end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.vertice_institutions)!=1 then raise exception 'FAIL membership isolation'; end if;
 if exists(select 1 from public.vertice_institutions where name='RLS test B') then raise exception 'FAIL cross tenant'; end if;
 begin
  insert into public.vertice_admins(user_id) values(auth.uid());
  raise exception 'FAIL self promotion allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.vertice_memberships(user_id,institution_id,role) values(auth.uid(),'20000000-0000-4000-8000-000000000002','gestor');
  raise exception 'FAIL self membership allowed';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}',true);
do $$begin if (select count(*) from public.vertice_institutions)>0 then raise exception 'FAIL MFA required'; end if; end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',true);
do $$begin if (select count(*) from public.vertice_institutions)>0 then raise exception 'FAIL master MFA required'; end if; end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
do $$begin if (select count(*) from public.vertice_institutions)!=2 then raise exception 'FAIL master overview'; end if; end$$;
reset role;
rollback;
select 'PASS: outsider, member isolation, self promotion, self membership, MFA, master MFA, master overview; fixtures rolled back' as validation;
