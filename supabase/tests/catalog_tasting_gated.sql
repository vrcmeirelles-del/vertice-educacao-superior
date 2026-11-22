-- Catálogo e degustação (20261122370000_catalog_tasting_gated). Fixtures desfeitas no rollback.
begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-0000000000c1','tasting-gestor@example.invalid'),
('10000000-0000-4000-8000-0000000000c2','tasting-equipe@example.invalid'),
('10000000-0000-4000-8000-0000000000c3','tasting-outsider@example.invalid');
insert into public.vertice_institutions(id,name) values
('20000000-0000-4000-8000-0000000000c1','Tasting test A'),
('20000000-0000-4000-8000-0000000000c2','Tasting test B');
insert into public.vertice_memberships(user_id,institution_id,role) values
('10000000-0000-4000-8000-0000000000c1','20000000-0000-4000-8000-0000000000c1','gestor'),
('10000000-0000-4000-8000-0000000000c2','20000000-0000-4000-8000-0000000000c1','equipe');
create temp table _mod on commit drop as
  select code from public.vertice_module_catalog where active order by display_order limit 1;
grant select on _mod to authenticated;
set local role authenticated;

-- Equipe: lê o catálogo, mas não inicia degustação.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-0000000000c2","aal":"aal2","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.vertice_module_catalog) = 0 then raise exception 'FAIL catalog unreadable'; end if;
 begin
  perform public.start_module_tasting('20000000-0000-4000-8000-0000000000c1',(select code from _mod));
  raise exception 'FAIL equipe starts tasting';
 exception when insufficient_privilege then null; end;
end$$;

-- Gestor sem MFA: bloqueado.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-0000000000c1","aal":"aal1","role":"authenticated"}',true);
do $$begin
 begin
  perform public.start_module_tasting('20000000-0000-4000-8000-0000000000c1',(select code from _mod));
  raise exception 'FAIL gestor aal1 starts tasting';
 exception when insufficient_privilege then null; end;
end$$;

-- Gestor com MFA: inicia na própria instituição, sem cobrança automática; não atua em outra.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-0000000000c1","aal":"aal2","role":"authenticated"}',true);
do $$declare r jsonb; begin
 r := public.start_module_tasting('20000000-0000-4000-8000-0000000000c1',(select code from _mod));
 if not coalesce((r->>'success')::boolean,false) then raise exception 'FAIL gestor tasting: %', r; end if;
 if (r->>'auto_activate')::boolean then raise exception 'FAIL auto_activate'; end if;
 if r->>'message' like '%R$%' then raise exception 'FAIL price in message'; end if;
 if (select auto_activate or addon_monthly_fee is not null from public.vertice_module_activations
     where institution_id='20000000-0000-4000-8000-0000000000c1' and module_code=(select code from _mod)) then
   raise exception 'FAIL activation charges'; end if;
 if (public.start_module_tasting('20000000-0000-4000-8000-0000000000c1',(select code from _mod))->>'error') is null then
   raise exception 'FAIL duplicate tasting'; end if;
 if not coalesce((public.cancel_module_tasting('20000000-0000-4000-8000-0000000000c1',(select code from _mod))->>'success')::boolean,false) then
   raise exception 'FAIL cancel'; end if;
 if (public.start_module_tasting('20000000-0000-4000-8000-0000000000c1',(select code from _mod))->>'error') not like '%já foi utilizada%' then
   raise exception 'FAIL second tasting after cancel'; end if;
 begin
  perform public.start_module_tasting('20000000-0000-4000-8000-0000000000c2',(select code from _mod));
  raise exception 'FAIL cross-tenant tasting';
 exception when insufficient_privilege then null; end;
end$$;

-- Usuário sem vínculo: bloqueado.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-0000000000c3","aal":"aal2","role":"authenticated"}',true);
do $$begin
 begin
  perform public.cancel_module_tasting('20000000-0000-4000-8000-0000000000c1',(select code from _mod));
  raise exception 'FAIL outsider cancels';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
rollback;
select 'PASS: catálogo legível; equipe, gestor sem MFA, outra instituição e usuário sem vínculo bloqueados; gestor com MFA degusta sem cobrança automática, uma vez por módulo; fixtures desfeitas' as validation;
