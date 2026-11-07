-- Correção de segurança: dados e-ORBIT pertencem à UNITOP, não aos ambientes de demonstração.
-- Dados legados com UUID institucional não cadastrado NÃO são remapeados automaticamente.
-- Política: leitura somente com JWT AAL2 e vínculo institucional válido; Master AAL2 conserva leitura
-- para permitir curadoria documental do identificador legado.
-- Importações administrativas via service_role continuam possíveis; clientes não escrevem direto.
begin;

do $$
declare
  t record;
  p record;
  tenant_col text;
  policy_expression text;
  new_policy text;
begin
  -- Falha de forma fechada se surgir tabela nova com política diferente da auditada.
  for t in
    select c.relname as name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'vertice_eorbit_%'
    order by c.relname
  loop
    for p in select policyname, cmd, qual from pg_catalog.pg_policies
      where schemaname='public' and tablename=t.name and cmd in ('SELECT','ALL')
    loop
      if p.qual is distinct from 'true'
         and t.name <> 'vertice_eorbit_enade'
      then
        raise exception 'Nontrivial e-ORBIT policy requires individual review: %.%', t.name, p.policyname;
      end if;
    end loop;

    execute pg_catalog.format('alter table public.%I enable row level security',t.name);
    execute pg_catalog.format('revoke all on table public.%I from public, anon, authenticated',t.name);

    -- Não permitir leitura individual de alunos via API até aprovação específica de escopo.
    if t.name <> 'vertice_eorbit_alunos' then
      execute pg_catalog.format('grant select on table public.%I to authenticated',t.name);
    end if;

    for p in select policyname from pg_catalog.pg_policies
      where schemaname='public' and tablename=t.name
        and cmd in ('SELECT','ALL') and qual='true'
    loop
      execute pg_catalog.format('drop policy %I on public.%I',p.policyname,t.name);
    end loop;

    -- Manter o ENADE sob sua política pré-existente mais restritiva.
    -- Manter ALUNOS sem políticas de leitura.
    if t.name in ('vertice_eorbit_enade','vertice_eorbit_alunos') then
      continue;
    end if;

    tenant_col := case when t.name='vertice_eorbit_direito_raio_x'
      then 'institution_id' else 'instituicao_id' end;

    if t.name='vertice_eorbit_grades' then
      policy_expression :=
        'exists (select 1 from public.vertice_eorbit_cursos p where p.id = curso_id and vertice_private.can_read_institution(p.instituicao_id))';
    elsif t.name='vertice_eorbit_turmas' then
      policy_expression :=
        'exists (select 1 from public.vertice_eorbit_quantitativo p where p.id = quantitativo_id and vertice_private.can_read_institution(p.instituicao_id))';
    else
      policy_expression := pg_catalog.format('vertice_private.can_read_institution(%I)',tenant_col);
    end if;

    -- Lista de habilitados a exame pede perfis pedagógicos/gestão além da autorização institucional.
    if t.name='vertice_eorbit_enade_habilitados' then
      policy_expression := policy_expression ||
        ' and vertice_private.has_role(instituicao_id, array[''gestor'',''equipe'',''reitor'',''diretor_geral'',''diretor_pedagogico'',''procurador'',''cpa''])';
    end if;

    new_policy := pg_catalog.left('vx_secure_' || t.name, 63);
    execute pg_catalog.format(
       'create policy %I on public.%I for select to authenticated using (%s)',
       new_policy,t.name,policy_expression);
  end loop;

  -- Impedir consumo de sequências por perfis públicos (RLS não se aplica a sequências).
  for t in select c.relname as name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='S' and c.relname like 'vertice_eorbit_%'
  loop
    execute pg_catalog.format('revoke all on sequence public.%I from public, anon, authenticated',t.name);
  end loop;
end;
$$;

comment on table public.vertice_eorbit_direito_raio_x is
 'Fonte e-ORBIT da UNITOP; 10 registros mantidos com UUID de origem legado não reconciliado. Acesso exige autorização institucional verificada ou Master AAL2; proibido usar na demonstração comercial ou em outra IES.';

commit;
