-- Synthetic, local only. The transaction is rolled back.
begin;
insert into auth.users(id,email) values
('aa000000-0000-4000-8000-000000000001','manager@example.invalid'),
('aa000000-0000-4000-8000-000000000002','reader@example.invalid'),
('aa000000-0000-4000-8000-000000000003','master@example.invalid');
insert into public.vertice_institutions(id,name,status) values
('bb000000-0000-4000-8000-000000000001','Synthetic A','ativa'),
('bb000000-0000-4000-8000-000000000002','Synthetic B','ativa'),
('bb000000-0000-4000-8000-000000000003','Archived','arquivada');
insert into public.vertice_memberships(user_id,institution_id,role) values
('aa000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','gestor'),
('aa000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000001','leitor');
insert into public.vertice_admins values('aa000000-0000-4000-8000-000000000003',now());
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
 end;
 raise exception 'Expected error % for %',expected,command;
end; $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
insert into public.vertice_captacao_connections(id,institution_id,provider,label,public_url,account_external_id) values
('cc000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','meta','Account A1','https://instagram.com/synthetic','111'),
('cc000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000001','meta','Account A2','https://instagram.com/synthetic2','222');
-- Many accounts on the same provider. A shared external ID in another IES is not a collision.
select pg_temp.expect_error($$insert into public.vertice_captacao_connections(institution_id,provider,label,public_url) values ('bb000000-0000-4000-8000-000000000002','meta','Forbidden','https://instagram.com/other')$$,'42501');
select pg_temp.expect_error($$insert into public.vertice_captacao_connections(institution_id,provider,label,public_url,status) values ('bb000000-0000-4000-8000-000000000001','meta','Fake','https://instagram.com/other','prepared')$$,'42501');
select pg_temp.expect_error($$update public.vertice_captacao_connections set last_successful_sync_at=now()$$,'42501');
select pg_temp.expect_error($$update public.vertice_captacao_connections set status='active'$$,'42501');
select pg_temp.expect_error($$update public.vertice_captacao_connections set institution_id='bb000000-0000-4000-8000-000000000002'$$,'42501');
select pg_temp.expect_error($$delete from public.vertice_captacao_connections$$,'42501');
select pg_temp.expect_error($$update public.vertice_captacao_connections set label='Missing CAS'$$,'40001');
update public.vertice_captacao_connections set label='Version two',version=2 where id='cc000000-0000-4000-8000-000000000001' and version=1;
-- A competing edit with an old version cannot overwrite the winner, even without a filter.
select pg_temp.expect_error($$update public.vertice_captacao_connections set label='Stale overwrite',version=2 where id='cc000000-0000-4000-8000-000000000001'$$,'40001');
do $$begin if not exists(select 1 from public.vertice_captacao_connections where label='Version two' and version=2) then raise exception 'CAS winner lost'; end if; end$$;
select pg_temp.expect_error($$update public.vertice_captacao_connections set public_url='https://instagram.com/x?access_token=secret',version=3 where id='cc000000-0000-4000-8000-000000000001'$$,'23514');
insert into public.vertice_captacao_assets(id,institution_id,connection_id,kind,external_id,label) values
('dd000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','form','form1','Form A1'),
('dd000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000002','form','form1','Form A2'),
('dd000000-0000-4000-8000-000000000003','bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','page','page1','Page A1');
insert into public.vertice_captacao_campaigns(id,institution_id,connection_id,name,capture_mode,public_url) values
('ee000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','Landing','landing','https://ies.example.invalid/vestibular');
insert into public.vertice_captacao_campaigns(institution_id,connection_id,name,capture_mode,form_asset_id) values
('bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','Native','native','dd000000-0000-4000-8000-000000000001');
select pg_temp.expect_error($$insert into public.vertice_captacao_campaigns(institution_id,connection_id,name,capture_mode,form_asset_id) values ('bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','Wrong connection','native','dd000000-0000-4000-8000-000000000002')$$,'23514');
select pg_temp.expect_error($$insert into public.vertice_captacao_campaigns(institution_id,connection_id,name,capture_mode,form_asset_id) values ('bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','Page is not form','native','dd000000-0000-4000-8000-000000000003')$$,'23514');
select pg_temp.expect_error($$update public.vertice_captacao_assets set verification='verified',version=2$$,'42501');
select pg_temp.expect_error($$update public.vertice_captacao_campaigns set public_url='https://127.0.0.1/secret',version=2 where capture_mode='landing'$$,'23514');
-- 100 replays of one creation ID cannot insert a second campaign or another audit event.
do $$begin for i in 1..100 loop
 perform pg_temp.expect_error($q$insert into public.vertice_captacao_campaigns(id,institution_id,connection_id,name,capture_mode,public_url) values ('ee000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','Landing','landing','https://ies.example.invalid/vestibular')$q$,'23505');
end loop; end$$;
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
do $$begin if exists(select 1 from public.vertice_captacao_connections) or public.vertice_captacao_access('bb000000-0000-4000-8000-000000000001') then raise exception 'Reader access'; end if; end$$;
select pg_temp.expect_error($$select * from vertice_private.captacao_setup_audit$$,'42501');
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
do $$begin if exists(select 1 from public.vertice_captacao_connections) then raise exception 'MFA bypass'; end if; end$$;
select pg_temp.expect_error($$insert into public.vertice_captacao_connections(institution_id,provider,label,public_url) values ('bb000000-0000-4000-8000-000000000001','tiktok','No MFA','https://tiktok.com/@synthetic')$$,'42501');
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select pg_temp.expect_error($$insert into public.vertice_captacao_connections(institution_id,provider,label,public_url) values ('bb000000-0000-4000-8000-000000000003','tiktok','Archived','https://tiktok.com/@synthetic')$$,'42501');
insert into public.vertice_captacao_connections(id,institution_id,provider,label,public_url,account_external_id) values
('cc000000-0000-4000-8000-000000000003','bb000000-0000-4000-8000-000000000002','meta','Account B1','https://instagram.com/synthetic','111');
select pg_temp.expect_error($$insert into public.vertice_captacao_assets(institution_id,connection_id,kind,external_id,label) values ('bb000000-0000-4000-8000-000000000002','cc000000-0000-4000-8000-000000000001','page','bad','Cross IES')$$,'23503');
select pg_temp.expect_error($$insert into public.vertice_captacao_campaigns(institution_id,connection_id,name,capture_mode,public_url) values ('bb000000-0000-4000-8000-000000000002','cc000000-0000-4000-8000-000000000001','Cross IES','landing','https://ies.example.invalid/')$$,'23503');
select pg_temp.expect_error($$update public.vertice_captacao_campaigns set verification='verified',version=2$$,'42501');
reset role;
do $$declare candidate text; expected boolean;
begin
 foreach candidate in array array['gestor','reitor','diretor_geral','diretor_pedagogico','procurador','cpa','coordenador','nde','equipe','leitor'] loop
  begin
   update public.vertice_memberships set role=candidate where user_id='aa000000-0000-4000-8000-000000000001';
  exception when check_violation then
   -- Unsupported roles must be rejected by the REAL foundation constraint.
   -- Do not loosen that constraint to make a synthetic profile possible.
   if candidate in ('gestor','equipe','leitor') then raise; end if;
   continue;
  end;
  perform set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
  expected:=candidate='gestor';
  set local role authenticated;
  if public.vertice_captacao_access('bb000000-0000-4000-8000-000000000001') is distinct from expected then raise exception 'Wrong role: %',candidate; end if;
  if exists(select 1 from public.vertice_captacao_connections where institution_id='bb000000-0000-4000-8000-000000000002') then raise exception 'Cross IES read: %',candidate; end if;
  reset role;
 end loop;
 if (select count(*) from vertice_private.captacao_setup_audit where record_id='ee000000-0000-4000-8000-000000000001')<>1 then raise exception 'Replay audit duplicates'; end if;
 if exists(select 1 from vertice_private.captacao_setup_audit where actor is null or institution_id is null) then raise exception 'Audit missing scope'; end if;
end$$;
set local role anon;
select pg_temp.expect_error($$select * from public.vertice_captacao_connections$$,'42501');
select pg_temp.expect_error($$select * from public.vertice_captacao_assets$$,'42501');
select pg_temp.expect_error($$select * from public.vertice_captacao_campaigns$$,'42501');
select pg_temp.expect_error($$select public.vertice_captacao_access('bb000000-0000-4000-8000-000000000001')$$,'42501');
reset role;
rollback;
