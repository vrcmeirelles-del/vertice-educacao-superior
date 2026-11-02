begin;
insert into auth.users(id,email) values
 ('81000000-0000-4000-8000-000000000001','ebitda-gestor-a@example.invalid'),
 ('81000000-0000-4000-8000-000000000002','ebitda-gestor-b@example.invalid'),
 ('81000000-0000-4000-8000-000000000003','ebitda-equipe@example.invalid'),
 ('81000000-0000-4000-8000-000000000004','ebitda-leitor@example.invalid'),
 ('81000000-0000-4000-8000-000000000005','ebitda-master@example.invalid');
insert into public.vertice_institutions(id,name) values
 ('82000000-0000-4000-8000-000000000001','EBITDA fixture A'),
 ('82000000-0000-4000-8000-000000000002','EBITDA fixture B');
insert into public.vertice_memberships(user_id,institution_id,role) values
 ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','gestor'),
 ('81000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','gestor'),
 ('81000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','equipe'),
 ('81000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000001','leitor');
insert into public.vertice_admins(user_id) values('81000000-0000-4000-8000-000000000005');
insert into public.vertice_ebitda_calculations(id,institution_id,request_id,body,result,file_name,object_path,sha256,size_bytes,created_by)
select ('83000000-0000-4000-8000-00000000000'||n)::uuid,
 ('82000000-0000-4000-8000-00000000000'||n)::uuid,
 ('84000000-0000-4000-8000-00000000000'||n)::uuid,
 '{"net_income":100,"income_tax":0,"financial_expenses":0,"financial_income":0,"depreciation":0,"amortization":0,"depletion":0}',
 '{"ebitda":100}','DRE.csv',
 '82000000-0000-4000-8000-00000000000'||n||'/81000000-0000-4000-8000-00000000000'||n||'/84000000-0000-4000-8000-000000000001/DRE.csv',repeat('a',64),1,
 ('81000000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,2) n;
insert into storage.objects(bucket_id,name) select 'vertice-dre',object_path from public.vertice_ebitda_calculations where id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.vertice_ebitda_calculations)<>1 then raise exception 'FAIL tenant';end if;
 if (select count(*) from storage.objects where bucket_id='vertice-dre')<>1 then raise exception 'FAIL Storage tenant';end if;
 if public.vertice_ebitda_access('82000000-0000-4000-8000-000000000002') then raise exception 'FAIL other institution';end if;
 if vertice_private.ebitda_path_allowed('not-a-uuid/path',true) then raise exception 'FAIL malformed path';end if;
 if vertice_private.ebitda_path_allowed('82000000-0000-4000-8000-000000000001/81000000-0000-4000-8000-000000000002/84000000-0000-4000-8000-000000000001/DRE.pdf',true) then raise exception 'FAIL impersonated upload';end if;
 begin update public.vertice_ebitda_calculations set body='{}';raise exception 'FAIL writable results';exception when insufficient_privilege then null;end;
 begin insert into public.vertice_ebitda_calculations(id) values(gen_random_uuid());raise exception 'FAIL forged result insert';exception when insufficient_privilege then null;end;
 insert into storage.objects(bucket_id,name) values('vertice-dre','82000000-0000-4000-8000-000000000001/81000000-0000-4000-8000-000000000001/84000000-0000-4000-8000-000000000002/DRE.pdf');
 begin insert into storage.objects(bucket_id,name) values('vertice-dre','82000000-0000-4000-8000-000000000002/81000000-0000-4000-8000-000000000001/84000000-0000-4000-8000-000000000003/DRE.pdf');raise exception 'FAIL cross institution upload';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.vertice_ebitda_calculations) or exists(select 1 from storage.objects where bucket_id='vertice-dre') then raise exception 'FAIL MFA';end if;end$$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.vertice_ebitda_calculations) or exists(select 1 from storage.objects where bucket_id='vertice-dre') then raise exception 'FAIL equipe';end if;end$$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.vertice_ebitda_calculations) then raise exception 'FAIL leitor';end if;end$$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","aal":"aal2","role":"authenticated"}',true);
do $$begin if (select count(*) from public.vertice_ebitda_calculations where id in ('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002'))<>2 then raise exception 'FAIL master';end if;end$$;
reset role;
update public.vertice_institutions set status='arquivada' where id='82000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.vertice_ebitda_calculations) then raise exception 'FAIL archived';end if;end$$;
reset role;
do $$begin begin update public.vertice_ebitda_calculations set size_bytes=2 where id='83000000-0000-4000-8000-000000000001';raise exception 'FAIL immutable';exception when raise_exception then if sqlerrm='FAIL immutable' then raise;end if;end;end$$;
set local role anon;
do $$begin begin perform 1 from public.vertice_ebitda_calculations;raise exception 'FAIL anonymous';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'PASS: tenant, MFA, gestor/master, equipe/leitor denied, private Storage, guarded upload, immutable results; all fixtures rolled back' as validation;
