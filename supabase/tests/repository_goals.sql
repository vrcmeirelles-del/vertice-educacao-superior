-- Executar dentro de uma transação; todas as fixtures são revertidas ao final.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('12000000-0000-4000-8000-000000000001','repo-master@example.invalid',now()),
('12000000-0000-4000-8000-000000000002','repo-gestor@example.invalid',now()),
('12000000-0000-4000-8000-000000000003','repo-coord@example.invalid',now()),
('12000000-0000-4000-8000-000000000004','repo-leitor@example.invalid',now()),
('12000000-0000-4000-8000-000000000005','repo-outro@example.invalid',now());
insert into public.vertice_admins(user_id) values('12000000-0000-4000-8000-000000000001');
insert into public.vertice_institutions(id,name) values('22000000-0000-4000-8000-000000000001','Teste Repo IES A'),('22000000-0000-4000-8000-000000000002','Teste Repo IES B');
insert into public.vertice_courses(id,institution_id,name) values('32000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','Curso A'),('32000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','Curso B');
insert into public.vertice_goals(id,institution_id,course_id,title,indicator,target) values('42000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','Meta A','Indicador A',1),('42000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000002','Meta B','Indicador B',1);
insert into public.vertice_memberships(user_id,institution_id,role) values
('12000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','gestor'),
('12000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','equipe'),
('12000000-0000-4000-8000-000000000004','22000000-0000-4000-8000-000000000001','leitor'),
('12000000-0000-4000-8000-000000000005','22000000-0000-4000-8000-000000000002','equipe');
create function pg_temp.repo_user(u text,aal text default 'aal2') returns void language sql as $$select set_config('request.jwt.claims',json_build_object('sub',u,'aal',aal,'role','authenticated')::text,true)$$;
create function pg_temp.repo_denied(q text,label text) returns void language plpgsql as $$declare n integer;begin begin execute q;get diagnostics n=row_count;exception when insufficient_privilege or check_violation then return;end;if n>0 then raise exception 'FAIL %',label;end if;end$$;
grant execute on function pg_temp.repo_user(text,text),pg_temp.repo_denied(text,text) to authenticated;
set local role authenticated;
select pg_temp.repo_user('12000000-0000-4000-8000-000000000002');
update public.vertice_goals set owner_user_id='12000000-0000-4000-8000-000000000003' where id='42000000-0000-4000-8000-000000000001';
select pg_temp.repo_denied($$update public.vertice_goals set owner_user_id='12000000-0000-4000-8000-000000000005' where id='42000000-0000-4000-8000-000000000001'$$,'meta não pode ser atribuída a outra IES');
insert into public.vertice_repository_requests(id,institution_id,course_id,goal_id,title,assigned_to) values('52000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','Ata do NDE','12000000-0000-4000-8000-000000000003');
select pg_temp.repo_denied($$insert into public.vertice_repository_requests(institution_id,course_id,title) values('22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000002','Curso errado')$$,'não permite curso de outra IES');
select pg_temp.repo_denied($$insert into public.vertice_repository_requests(institution_id,goal_id,title) values('22000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000002','Meta errada')$$,'não permite meta de outra IES');
select pg_temp.repo_denied($$update public.vertice_repository_requests set assigned_to='12000000-0000-4000-8000-000000000005' where id='52000000-0000-4000-8000-000000000001'$$,'não atribui responsável de outra IES');
select pg_temp.repo_denied($$update public.vertice_repository_requests set institution_id='22000000-0000-4000-8000-000000000002' where id='52000000-0000-4000-8000-000000000001'$$,'não move entre IES');
-- Coordenador atribuído envia; o arquivo é somente fixture de metadados, sem bytes persistidos.
select pg_temp.repo_user('12000000-0000-4000-8000-000000000003');
select pg_temp.repo_denied($$insert into public.vertice_repository_requests(institution_id,title) values('22000000-0000-4000-8000-000000000001','Equipe cria')$$,'equipe não exige documentos');
insert into storage.objects(bucket_id,name,owner_id,metadata) values('vertice-repositorios','22000000-0000-4000-8000-000000000001/52000000-0000-4000-8000-000000000001/62000000-0000-4000-8000-000000000001.pdf','12000000-0000-4000-8000-000000000003','{"size":10,"mimetype":"application/pdf"}');
insert into public.vertice_repository_files(id,institution_id,request_id,storage_path,file_name,size_bytes,mime_type,status) values('62000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001/52000000-0000-4000-8000-000000000001/62000000-0000-4000-8000-000000000001.pdf','Ata.pdf',10,'application/pdf','validado');
do $$begin if (select status from public.vertice_repository_files where id='62000000-0000-4000-8000-000000000001')<>'enviado' then raise exception 'FAIL equipe forjou validação';end if;end$$;
select pg_temp.repo_denied($$update public.vertice_repository_files set status='validado' where id='62000000-0000-4000-8000-000000000001'$$,'equipe não valida');
select pg_temp.repo_denied($$update storage.objects set name='outro.pdf' where bucket_id='vertice-repositorios'$$,'não sobrescreve arquivo');
select pg_temp.repo_denied($$insert into public.vertice_repository_files(institution_id,request_id,storage_path,file_name,size_bytes,mime_type) values('22000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','arquivo-inexistente','falso.pdf',10,'application/pdf')$$,'não forja registro sem arquivo');
-- Gestor devolve com parecer e valida.
select pg_temp.repo_user('12000000-0000-4000-8000-000000000002');
select pg_temp.repo_denied($$update public.vertice_repository_files set status='devolvido',review_note='' where id='62000000-0000-4000-8000-000000000001'$$,'devolução exige motivo');
update public.vertice_repository_files set status='devolvido',review_note='Falta assinatura' where id='62000000-0000-4000-8000-000000000001';
update public.vertice_repository_files set status='validado',review_note='Conferido' where id='62000000-0000-4000-8000-000000000001';
do $$begin if (select reviewed_by from public.vertice_repository_files where id='62000000-0000-4000-8000-000000000001')<>'12000000-0000-4000-8000-000000000002' then raise exception 'FAIL auditoria do revisor';end if;end$$;
-- Leitor consulta, não envia nem valida.
select pg_temp.repo_user('12000000-0000-4000-8000-000000000004');
do $$begin if (select count(*) from public.vertice_repository_requests where institution_id='22000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL leitura própria IES';end if;end$$;
select pg_temp.repo_denied($$insert into storage.objects(bucket_id,name,owner_id) values('vertice-repositorios','22000000-0000-4000-8000-000000000001/52000000-0000-4000-8000-000000000001/62000000-0000-4000-8000-000000000002.pdf','12000000-0000-4000-8000-000000000004')$$,'leitor não envia');
-- Outra IES não lê metadados nem bytes.
select pg_temp.repo_user('12000000-0000-4000-8000-000000000005');
do $$begin if exists(select 1 from public.vertice_repository_requests where institution_id='22000000-0000-4000-8000-000000000001') or exists(select 1 from public.vertice_repository_files where institution_id='22000000-0000-4000-8000-000000000001') or exists(select 1 from storage.objects where bucket_id='vertice-repositorios') then raise exception 'FAIL isolamento de IES';end if;end$$;
-- Sem MFA nenhuma leitura ou envio.
select pg_temp.repo_user('12000000-0000-4000-8000-000000000003','aal1');
do $$begin if exists(select 1 from public.vertice_repository_requests) or exists(select 1 from public.vertice_repository_files) or exists(select 1 from storage.objects where bucket_id='vertice-repositorios') then raise exception 'FAIL ausência de MFA';end if;end$$;
-- Master consulta e gerencia todas as IES.
select pg_temp.repo_user('12000000-0000-4000-8000-000000000001');
insert into public.vertice_repository_requests(institution_id,title,assigned_to) values('22000000-0000-4000-8000-000000000002','Exigência B','12000000-0000-4000-8000-000000000005');
do $$begin if (select count(*) from public.vertice_repository_requests where institution_id in('22000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000002'))<>2 then raise exception 'FAIL master multi-IES';end if;end$$;
select 'Repositório: isolamento, MFA, atribuição, envio, validação e histórico verificados; fixtures revertidas.' as resultado;
rollback;
