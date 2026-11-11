begin;
do $test$ declare a uuid; b uuid; s text; begin
 if has_table_privilege('anon','public.vertice_institution_addresses','UPDATE') then raise exception 'anonymous_write'; end if;
 if has_function_privilege('anon','public.vertice_set_institution_address(uuid,text)','EXECUTE') then raise exception 'anonymous_rpc'; end if;
 if not vertice_private.address_reserved('master') then raise exception 'reserved'; end if;
 if vertice_private.address_slug('Colégio São José')<>'colegio-sao-jose' then raise exception 'accents'; end if;
 insert into public.vertice_institutions(name,acronym,status,tier) values('Teste endereço','master','ativa','escolas') returning id into a;
 insert into public.vertice_institutions(name,acronym,status,tier) values('Teste endereço','master','ativa','superior') returning id into b;
 select slug into s from public.vertice_institution_addresses where institution_id=a;
 if s='master' then raise exception 'reserved_collision'; end if;
 if (select count(distinct slug) from public.vertice_institution_addresses where institution_id in(a,b))<>2 then raise exception 'duplicates'; end if;
 update public.vertice_institutions set status='arquivada' where id=a;
 if (select active from public.vertice_institution_addresses where institution_id=a) then raise exception 'archive'; end if;
 begin perform public.vertice_set_institution_address(b,'changed'); raise exception 'unauthorized_allowed'; exception when others then if sqlerrm<>'access_denied' then raise; end if; end;
end $test$;
set local role anon;
select count(*) as public_addresses from public.vertice_institution_addresses;
reset role;
rollback;
