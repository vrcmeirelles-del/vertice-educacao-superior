-- Verificação contínua do isolamento de dados e-ORBIT/UNITOP.
-- Somente leitura; interrompe a execução se qualquer tabela da família ficar pública.
do $$
declare t record;
begin
  for t in
    select c.oid, c.relname, c.relrowsecurity
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname like 'vertice_eorbit_%'
  loop
    if not t.relrowsecurity then
      raise exception 'RLS desabilitada na tabela %', t.relname;
    end if;
    if has_table_privilege('anon',t.oid,'SELECT')
      or has_table_privilege('anon',t.oid,'INSERT')
      or has_table_privilege('anon',t.oid,'UPDATE')
      or has_table_privilege('anon',t.oid,'DELETE')
    then
      raise exception 'Grant anônimo indevido em %',t.relname;
    end if;
    if has_table_privilege('authenticated',t.oid,'INSERT')
      or has_table_privilege('authenticated',t.oid,'UPDATE')
      or has_table_privilege('authenticated',t.oid,'DELETE')
    then
      raise exception 'Escrita direta indevida no e-ORBIT em %',t.relname;
    end if;
    if exists(select 1 from pg_catalog.pg_policies p
      where p.schemaname='public' and p.tablename=t.relname and p.cmd in ('SELECT','ALL')
        and p.qual='true'
    ) then
      raise exception 'Política ampla de leitura em %',t.relname;
    end if;
  end loop;
  if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='S' and c.relname like 'vertice_eorbit_%'
     and (has_sequence_privilege('anon',c.oid,'USAGE') or has_sequence_privilege('authenticated',c.oid,'USAGE'))
  ) then
    raise exception 'Sequence de e-ORBIT exposta aos perfis públicos';
  end if;
  if has_table_privilege('anon','public.vertice_experience_invites','SELECT')
     or has_table_privilege('authenticated','public.vertice_experience_invites','SELECT')
     or not (select relrowsecurity from pg_class where oid='public.vertice_experience_invites'::regclass)
  then
    raise exception 'Isolamento da Vértice Experience comprometido';
  end if;
end $$;
select 'PASS: isolamento e-ORBIT/UNITOP e Vértice Experience' as validation;