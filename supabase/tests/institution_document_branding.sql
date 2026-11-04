-- Run only in a disposable database. Fixtures roll back.
begin;
insert into auth.users(id,email) select ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'synthetic-'||n||'@example.invalid' from generate_series(1,5) n;
insert into public.vertice_institutions(id,name) values ('92000000-0000-4000-8000-000000000001','Synthetic A'),('92000000-0000-4000-8000-000000000002','Synthetic B');
insert into public.vertice_memberships(user_id,institution_id,role) values
 ('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','gestor'),
 ('91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','equipe'),
 ('91000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','leitor');
insert into public.vertice_admins(user_id) values ('91000000-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
do $$ declare v timestamptz; result jsonb; invalid jsonb; begin
 if (select count(*) from public.vertice_institutions)<>1 then raise exception 'FAIL tenant'; end if;
 select updated_at into v from public.vertice_institutions where id='92000000-0000-4000-8000-000000000001';
 result:=public.vertice_save_document_branding('92000000-0000-4000-8000-000000000001',v,'{"header_text":"A","theme_color":"#FF8800","logo_data":null}');
 if (result->>'updated_at')::timestamptz<=v then raise exception 'FAIL version'; end if;
 begin perform public.vertice_save_document_branding('92000000-0000-4000-8000-000000000001',v,null); raise exception 'FAIL stale write'; exception when serialization_failure then null; end;
 begin update public.vertice_institutions set document_branding=null; raise exception 'FAIL direct bypass'; exception when insufficient_privilege then null; end;
 begin perform public.vertice_save_document_branding('92000000-0000-4000-8000-000000000002',v,null); raise exception 'FAIL cross tenant'; exception when insufficient_privilege then null; end;
 foreach invalid in array array['{}'::jsonb,'{"header_text":"x","theme_color":"red","logo_data":null}'::jsonb,'{"header_text":"x","theme_color":null,"logo_data":"data:image/svg+xml,<svg/>"}'::jsonb,jsonb_build_object('header_text',repeat('a',601),'theme_color',null,'logo_data',null)] loop
  begin perform public.vertice_save_document_branding('92000000-0000-4000-8000-000000000001',(result->>'updated_at')::timestamptz,invalid); raise exception 'FAIL invalid branding'; exception when check_violation then null; end;
 end loop;
 update public.vertice_institutions set notes='Existing non-branding edit remains allowed' where id='92000000-0000-4000-8000-000000000001';
end $$;
-- Team, reader, outsider: no write. Team/reader still read their institution.
do $$ declare n int; rows int; begin
 foreach n in array array[2,3,5] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub','91000000-0000-4000-8000-'||lpad(n::text,12,'0'),'aal','aal2')::text,true);
  select count(*) into rows from public.vertice_institutions;
  if rows <> (case when n=5 then 0 else 1 end) then raise exception 'FAIL read role %',n; end if;
  begin perform public.vertice_save_document_branding('92000000-0000-4000-8000-000000000001',now(),null); raise exception 'FAIL role % write',n; exception when insufficient_privilege then null; end;
 end loop;
 -- MFA required even for master and gestor.
 foreach n in array array[1,4] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub','91000000-0000-4000-8000-'||lpad(n::text,12,'0'),'aal','aal1')::text,true);
  if exists(select 1 from public.vertice_institutions) then raise exception 'FAIL MFA read'; end if;
  begin perform public.vertice_save_document_branding('92000000-0000-4000-8000-000000000001',now(),null); raise exception 'FAIL MFA write'; exception when insufficient_privilege then null; end;
 end loop;
end $$;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000004","aal":"aal2"}',true);
do $$ declare v timestamptz; begin
 if (select count(*) from public.vertice_institutions)<>2 then raise exception 'FAIL master read'; end if;
 select updated_at into v from public.vertice_institutions where id='92000000-0000-4000-8000-000000000002';
 perform public.vertice_save_document_branding('92000000-0000-4000-8000-000000000002',v,'{"header_text":"B","theme_color":null,"logo_data":null}');
 insert into public.vertice_institutions(name,document_branding) values ('Synthetic new','{"header_text":"New","theme_color":"#008800","logo_data":null}');
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.vertice_save_document_branding('92000000-0000-4000-8000-000000000001',now(),null); raise exception 'FAIL anon'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.vertice_audit where table_name='vertice_institutions' and action='UPDATE')<3 then raise exception 'FAIL audit'; end if;
 insert into public.vertice_inep_library(institution_id,library_key,version,dimension,indicator,file_name,title,original_path,format,size_bytes,sha256,object_path,active) values
 ('92000000-0000-4000-8000-000000000001',repeat('a',24),'fixture',1,'1.1','A.docx','A','A.docx','docx',1,repeat('a',64),'92000000-0000-4000-8000-000000000001/source.docx',true);
 if exists(select 1 from public.vertice_inep_library where template_object_path is not null) then raise exception 'FAIL automatic activation'; end if;
 begin update public.vertice_inep_library set template_object_path=object_path; raise exception 'FAIL incomplete review'; exception when check_violation then null; end;
 update public.vertice_inep_library set template_object_path=institution_id::text||'/templates/'||repeat('b',64)||'.docx',template_sha256=repeat('b',64),template_source_sha256=sha256,template_review_ref='synthetic';
 begin update public.vertice_inep_library set sha256=repeat('c',64); raise exception 'FAIL source drift'; exception when check_violation then null; end;
 begin update public.vertice_inep_library set format='pdf'; raise exception 'FAIL PDF template'; exception when check_violation then null; end;
end $$;
rollback;
select 'PASS branding: tenant, roles, MFA, CAS, direct-write denial, validation, audit, template gates' as validation;
