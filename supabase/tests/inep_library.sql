-- Fixtures transacionais: nenhum cadastro ou arquivo real e alterado.
begin;
insert into auth.users(id,email) values
 ('91000000-0000-4000-8000-000000000001','inep-rls-member@example.invalid'),
 ('91000000-0000-4000-8000-000000000002','inep-rls-outsider@example.invalid');
insert into public.vertice_institutions(id,name) values
 ('92000000-0000-4000-8000-000000000001','INEP fixture A'),
 ('92000000-0000-4000-8000-000000000002','INEP fixture B');
insert into public.vertice_memberships(user_id,institution_id,role) values
 ('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','equipe');
insert into public.vertice_inep_library(institution_id,library_key,version,dimension,indicator,file_name,title,original_path,format,size_bytes,sha256,object_path,active) values
 ('92000000-0000-4000-8000-000000000001',repeat('a',24),'fixture',1,'1.1','A.docx','A','D1/1.1/A.docx','docx',1,repeat('a',64),'92000000-0000-4000-8000-000000000001/fixture/a.docx',true),
 ('92000000-0000-4000-8000-000000000002',repeat('b',24),'fixture',1,'1.1','B.docx','B','D1/1.1/B.docx','docx',1,repeat('b',64),'92000000-0000-4000-8000-000000000002/fixture/b.docx',true),
 ('92000000-0000-4000-8000-000000000001',repeat('c',24),'fixture',1,'1.1','C.docx','C','D1/1.1/C.docx','docx',1,repeat('c',64),'92000000-0000-4000-8000-000000000001/fixture/c.docx',false);
insert into storage.objects(id,bucket_id,name) values
 ('93000000-0000-4000-8000-000000000001','vertice-biblioteca-inep','92000000-0000-4000-8000-000000000001/fixture/a.docx');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.vertice_inep_library where version='fixture')<>1 then raise exception 'FAIL tenant or inactive rows'; end if;
 if exists(select 1 from storage.objects where id='93000000-0000-4000-8000-000000000001') then raise exception 'FAIL direct storage read'; end if;
 begin
  update public.vertice_inep_library set title='forged' where version='fixture';
  raise exception 'FAIL catalog writable';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.vertice_inep_library where version='fixture') then raise exception 'FAIL MFA'; end if;
end$$;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.vertice_inep_library where version='fixture') then raise exception 'FAIL outsider'; end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin
  perform 1 from public.vertice_inep_library;
  raise exception 'FAIL anonymous catalog';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
rollback;
select 'PASS: tenant, inactive rows, MFA, outsider, anonymous, direct Storage and catalog write restrictions; fixtures rolled back' as validation;
