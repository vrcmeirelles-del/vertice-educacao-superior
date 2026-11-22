-- Faturamento restrito ao master (20261122290000_billing_master_only). Fixtures desfeitas no rollback.
begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-0000000000b1','billing-master@example.invalid'),
('10000000-0000-4000-8000-0000000000b2','billing-gestor@example.invalid');
insert into public.vertice_institutions(id,name) values ('20000000-0000-4000-8000-0000000000b1','Billing test A');
insert into public.vertice_admins(user_id) values ('10000000-0000-4000-8000-0000000000b1');
insert into public.vertice_memberships(user_id,institution_id,role) values ('10000000-0000-4000-8000-0000000000b2','20000000-0000-4000-8000-0000000000b1','gestor');
insert into public.vertice_contracts(id,institution_id,package_code,price_per_student,min_monthly,status,contract_number,starts_at,min_commitment_ends_at)
values ('30000000-0000-4000-8000-0000000000b1','20000000-0000-4000-8000-0000000000b1','essencial',1.5,100,'trial','VRT-TESTE-0001',current_date,current_date + 90);
insert into public.vertice_invoices(id,contract_id,institution_id,invoice_number,invoice_type,subtotal,total,due_date,status,line_items)
values ('40000000-0000-4000-8000-0000000000b1','30000000-0000-4000-8000-0000000000b1','20000000-0000-4000-8000-0000000000b1','TESTE-0001','mensalidade',100,100,current_date,'pending','[]');
set local role authenticated;

-- Gestor da própria instituição: nada lê, nada altera, não executa as funções.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-0000000000b2","aal":"aal2","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.vertice_contracts where contract_number='VRT-TESTE-0001') then raise exception 'FAIL gestor reads contract'; end if;
 if exists(select 1 from public.vertice_invoices where invoice_number='TESTE-0001') then raise exception 'FAIL gestor reads invoice'; end if;
 if exists(select 1 from public.v_billing_dashboard where contract_number='VRT-TESTE-0001') then raise exception 'FAIL gestor reads dashboard'; end if;
 update public.vertice_contracts set custom_monthly=0 where contract_number='VRT-TESTE-0001';
 begin
  perform public.register_payment('40000000-0000-4000-8000-0000000000b1');
  raise exception 'FAIL gestor registers payment';
 exception when insufficient_privilege then null; end;
 begin
  perform public.create_contract('20000000-0000-4000-8000-0000000000b1','essencial',1,1,null,0,0,true);
  raise exception 'FAIL gestor creates contract';
 exception when insufficient_privilege then null; end;
end$$;

-- Master sem MFA: bloqueado.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-0000000000b1","aal":"aal1","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.vertice_contracts where contract_number='VRT-TESTE-0001') then raise exception 'FAIL master aal1 reads'; end if;
 begin
  perform public.register_payment('40000000-0000-4000-8000-0000000000b1');
  raise exception 'FAIL master aal1 registers payment';
 exception when insufficient_privilege then null; end;
end$$;

-- Master com MFA: lê, edita e registra pagamento.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-0000000000b1","aal":"aal2","role":"authenticated"}',true);
do $$begin
 if (select custom_monthly from public.vertice_contracts where contract_number='VRT-TESTE-0001') is not null then raise exception 'FAIL gestor update applied'; end if;
 if not exists(select 1 from public.v_billing_dashboard where contract_number='VRT-TESTE-0001') then raise exception 'FAIL master dashboard'; end if;
 if (select total_contracts from public.v_mrr_summary) < 1 then raise exception 'FAIL master mrr'; end if;
 update public.vertice_contracts set notes='ok' where contract_number='VRT-TESTE-0001';
 if (select notes from public.vertice_contracts where contract_number='VRT-TESTE-0001') <> 'ok' then raise exception 'FAIL master update'; end if;
 if not (public.register_payment('40000000-0000-4000-8000-0000000000b1')->>'success')::boolean then raise exception 'FAIL master payment'; end if;
end$$;
reset role;
rollback;
select 'PASS: gestor sem leitura/escrita/funções, master sem MFA bloqueado, master com MFA lê, edita e registra pagamento; fixtures desfeitas' as validation;
