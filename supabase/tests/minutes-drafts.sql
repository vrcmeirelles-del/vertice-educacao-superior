-- Synthetic fixtures are entirely rolled back. Execute with ON_ERROR_STOP=1.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','minutes-owner@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','minutes-reader@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','minutes-other@example.invalid'),
 ('10000000-0000-4000-8000-000000000004','minutes-manager@example.invalid'),
 ('10000000-0000-4000-8000-000000000005','minutes-colleague@example.invalid');
insert into public.vertice_institutions(id,name) values
 ('20000000-0000-4000-8000-000000000001','Minutes test A'),('20000000-0000-4000-8000-000000000002','Minutes test B');
insert into public.vertice_courses(id,institution_id,name) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Course A'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Course B');
insert into public.vertice_memberships(user_id,institution_id,role) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','equipe'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','leitor'),
 ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','gestor'),
 ('10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','gestor'),
 ('10000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','equipe');
insert into public.vertice_inep_library(id,institution_id,library_key,version,code,dimension,indicator,file_name,title,original_path,format,size_bytes,sha256,object_path,active) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',repeat('a',24),'test','D2-2.12-COL-02',2,'2.12','ata.docx','Ata','ata.docx','docx',1,repeat('a',64),'20000000-0000-4000-8000-000000000001/ata.docx',true),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',repeat('a',24),'test','D2-2.12-COL-02',2,'2.12','ata.docx','Ata','ata.docx','docx',1,repeat('a',64),'20000000-0000-4000-8000-000000000002/ata.docx',true);
create function pg_temp.body() returns jsonb language sql as $$select '{"meetingType":"ordinaria","number":"","date":"","time":"","location":"","chair":"","secretary":"","quorum":"","agenda":"PPC","previousMinutes":"","discussion":"","decisions":"","nextMeeting":"","participants":"","actions":[]}'::jsonb$$;
create function pg_temp.save(v integer,m uuid) returns jsonb language sql security invoker as $$select public.vertice_save_minutes_draft('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Ata',pg_temp.body(),v,m)$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.save(0,'60000000-0000-4000-8000-000000000001');
select pg_temp.save(0,'60000000-0000-4000-8000-000000000001');
do $$begin
 if (select count(*) from public.vertice_minutes_drafts)<>1 or (select count(*) from public.vertice_minutes_revisions)<>1 then raise exception 'FAIL create retry duplicated'; end if;
 if (select body->>'agenda' from public.vertice_minutes_drafts)<>'PPC' then raise exception 'FAIL persistence'; end if;
 begin perform public.vertice_save_minutes_draft('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Ata',pg_temp.body(),0,gen_random_uuid()); raise exception 'FAIL cross course'; exception when check_violation then null; end;
 begin perform public.vertice_save_minutes_draft('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','Ata',pg_temp.body(),0,gen_random_uuid()); raise exception 'FAIL cross source'; exception when check_violation then null; end;
 begin update public.vertice_minutes_drafts set body=body||'{"signed":true}',version=2,mutation_id=gen_random_uuid(); raise exception 'FAIL arbitrary approval'; exception when check_violation then null; end;
 begin update public.vertice_minutes_drafts set body=jsonb_set(body,'{date}','"2026-02-30"'),version=2,mutation_id=gen_random_uuid(); raise exception 'FAIL invalid date'; exception when check_violation then null; end;
 begin update public.vertice_minutes_drafts set version=1,title='stale',mutation_id=gen_random_uuid(); raise exception 'FAIL direct stale'; exception when serialization_failure then null; end;
 begin update public.vertice_minutes_revisions set snapshot='{}'; raise exception 'FAIL history changed'; exception when insufficient_privilege then null; end;
 begin delete from public.vertice_minutes_drafts; raise exception 'FAIL deleted draft'; exception when insufficient_privilege then null; end;
 begin update public.vertice_minutes_drafts set institution_id='20000000-0000-4000-8000-000000000002'; raise exception 'FAIL reassigned institution'; exception when insufficient_privilege then null; end;
end$$;
select pg_temp.save(1,'60000000-0000-4000-8000-000000000002');
select pg_temp.save(1,'60000000-0000-4000-8000-000000000002');
do $$begin
 if (select count(*) from public.vertice_minutes_revisions)<>2 then raise exception 'FAIL update retry duplicated'; end if;
 begin perform pg_temp.save(1,gen_random_uuid()); raise exception 'FAIL RPC stale'; exception when serialization_failure then null; end;
 begin perform public.vertice_save_minutes_draft('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','changed',pg_temp.body(),1,'60000000-0000-4000-8000-000000000002'); raise exception 'FAIL idempotency mutation'; exception when invalid_parameter_value then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin
 if exists(select from public.vertice_minutes_drafts) or exists(select from public.vertice_minutes_revisions) then raise exception 'FAIL MFA read'; end if;
 begin perform pg_temp.save(2,gen_random_uuid()); raise exception 'FAIL MFA write'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
do $$begin
 if exists(select from public.vertice_minutes_drafts) or exists(select from public.vertice_minutes_revisions) then raise exception 'FAIL tenant isolation'; end if;
 begin perform pg_temp.save(2,gen_random_uuid()); raise exception 'FAIL tenant write'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
do $$begin
 if (select count(*) from public.vertice_minutes_drafts)<>1 then raise exception 'FAIL authorized reader'; end if;
 begin perform pg_temp.save(2,gen_random_uuid()); raise exception 'FAIL reader write'; exception when insufficient_privilege then null; end;
 update public.vertice_minutes_drafts set title='reader',version=3,mutation_id=gen_random_uuid();
 if found then raise exception 'FAIL reader direct write'; end if;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","aal":"aal2"}',true);
do $$begin
 begin perform pg_temp.save(2,gen_random_uuid()); raise exception 'FAIL colleague write'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","aal":"aal2"}',true);
select pg_temp.save(2,'60000000-0000-4000-8000-000000000003');
reset role;
do $$begin
 if (select count(*) from public.vertice_minutes_revisions)<>3 then raise exception 'FAIL manager version'; end if;
 if (select count(*) from public.vertice_audit where table_name='vertice_minutes_drafts')<>3 then raise exception 'FAIL audit'; end if;
 if (select snapshot->>'updated_by' from public.vertice_minutes_revisions where version=3)<>'10000000-0000-4000-8000-000000000004' then raise exception 'FAIL actor attribution'; end if;
 if has_function_privilege('anon','public.vertice_save_minutes_draft(uuid,uuid,uuid,uuid,text,jsonb,integer,uuid)','EXECUTE') then raise exception 'FAIL anon RPC'; end if;
 if has_function_privilege('authenticated','vertice_private.record_minutes_revision()','EXECUTE') then raise exception 'FAIL private trigger callable'; end if;
end$$;
rollback;
select 'PASS minutes: create, read, versions, idempotency, CAS, audit, tenant/course/source isolation, MFA, reader/colleague/manager roles, immutable history and scope, validation; fixtures rolled back' as result;
