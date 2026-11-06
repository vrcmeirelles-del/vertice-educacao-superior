-- RBAC: expansão de 3 para 11 perfis de acesso
-- Alinhamento com source-overrides/client/src/lib/area.ts
-- Hierarquia:
--   FULL_ACCESS: master (via vertice_admins), reitor, diretor_geral, diretor_pedagogico, procurador, gestor (legado)
--   INSTITUTIONAL_LIMITED: cpa
--   COURSE_SCOPED: coordenador, nde
--   BASIC: equipe, leitor
--
-- IMPORTANTE: executar em transação. Testar em staging antes de produção.
-- O master não é um role de membership — é determinado por vertice_admins.
-- Os roles de membership são os 10 restantes.

begin;

-- ============================================================
-- 1. Constantes de perfis (array reutilizável)
-- ============================================================
-- Perfis com visão completa da instituição (equivalente ao antigo "gestor" puro)
create or replace function vertice_private.full_access_roles() returns text[]
language sql immutable as $$
  select array['reitor','diretor_geral','diretor_pedagogico','procurador','gestor']::text[];
$$;

-- Todos os perfis válidos para membership
create or replace function vertice_private.all_roles() returns text[]
language sql immutable as $$
  select array['reitor','diretor_geral','diretor_pedagogico','procurador','cpa',
               'coordenador','nde','gestor','equipe','leitor']::text[];
$$;

revoke all on function vertice_private.full_access_roles() from public, anon;
revoke all on function vertice_private.all_roles() from public, anon;
grant execute on function vertice_private.full_access_roles(), vertice_private.all_roles() to authenticated;

-- ============================================================
-- 2. Expandir CHECK constraints
-- ============================================================

-- vertice_memberships: role check
alter table public.vertice_memberships
  drop constraint if exists vertice_memberships_role_check;
alter table public.vertice_memberships
  add constraint vertice_memberships_role_check
  check (role = any(vertice_private.all_roles()));

-- vertice_invites: role check
alter table public.vertice_invites
  drop constraint if exists vertice_invites_role_check;
alter table public.vertice_invites
  add constraint vertice_invites_role_check
  check (role = any(vertice_private.all_roles()));

-- ============================================================
-- 3. Coluna course_id para perfis com escopo de curso
-- ============================================================
-- coordenador e nde veem apenas o(s) curso(s) vinculado(s)
alter table public.vertice_memberships
  add column if not exists course_id uuid references public.vertice_courses(id) on delete set null;

comment on column public.vertice_memberships.course_id is
  'Vinculação a curso específico. Obrigatório para coordenador/nde; nulo para perfis institucionais.';

-- Constraint: course_id obrigatório para coordenador/nde, proibido para os demais
alter table public.vertice_memberships
  drop constraint if exists membership_course_scope;
alter table public.vertice_memberships
  add constraint membership_course_scope
  check (
    (role in ('coordenador','nde') and course_id is not null)
    or (role not in ('coordenador','nde') and course_id is null)
  );

create index if not exists vertice_memberships_course_idx
  on public.vertice_memberships(course_id) where course_id is not null;

-- ============================================================
-- 4. Helper: is_full_access (inclui master via admins + perfis full_access)
-- ============================================================
create or replace function vertice_private.is_full_access(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    vertice_private.is_master()
    or vertice_private.member_role(target) = any(vertice_private.full_access_roles()),
    false
  );
$$;

revoke all on function vertice_private.is_full_access(uuid) from public, anon;
grant execute on function vertice_private.is_full_access(uuid) to authenticated;

-- ============================================================
-- 5. Helper: can_record — perfis que podem registrar documentos
--    (full_access + cpa + coordenador + nde + equipe)
-- ============================================================
create or replace function vertice_private.can_record(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    vertice_private.member_role(target) in (
      'reitor','diretor_geral','diretor_pedagogico','procurador','gestor',
      'cpa','coordenador','nde','equipe','master'
    ),
    false
  );
$$;

revoke all on function vertice_private.can_record(uuid) from public, anon;
grant execute on function vertice_private.can_record(uuid) to authenticated;

-- ============================================================
-- 6. Atualizar vertice_add_member para hierarquia completa
-- ============================================================
create or replace function public.vertice_add_member(
  target uuid, member_email text, member_role text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  actor_role text := vertice_private.member_role(target);
  uid uuid;
  mail text := lower(trim(member_email));
  is_actor_full boolean;
begin
  -- Validar role
  if member_role != any(vertice_private.all_roles()) then
    raise exception 'papel inválido: %', member_role using errcode='22023';
  end if;

  is_actor_full := (actor_role = 'master' or actor_role = any(vertice_private.full_access_roles()));

  -- Hierarquia de convite:
  --   master: pode convidar qualquer perfil
  --   full_access (reitor, diretor_geral, etc.): pode convidar cpa, coordenador, nde, equipe, leitor
  --   coordenador: pode convidar nde do mesmo curso
  --   cpa: pode convidar membros da CPA (equipe/leitor)
  --   demais: não podem convidar
  if actor_role = 'master' then
    null; -- pode tudo
  elsif actor_role = any(vertice_private.full_access_roles()) then
    if member_role = any(vertice_private.full_access_roles()) and member_role != actor_role then
      raise exception 'somente master pode convidar perfis de acesso pleno' using errcode='42501';
    end if;
  elsif actor_role = 'coordenador' then
    if member_role not in ('nde') then
      raise exception 'coordenador só pode convidar membros do NDE' using errcode='42501';
    end if;
  elsif actor_role = 'cpa' then
    if member_role not in ('equipe','leitor') then
      raise exception 'CPA só pode convidar equipe ou leitor' using errcode='42501';
    end if;
  else
    raise exception 'sem permissão para convidar' using errcode='42501';
  end if;

  -- Buscar usuário
  select u.id into uid from auth.users u
    where lower(u.email) = mail and u.email_confirmed_at is not null;

  if uid is not null then
    -- Não pode se autopromover (exceto master)
    if uid = auth.uid() and actor_role <> 'master' then
      raise exception 'sem permissão' using errcode='42501';
    end if;

    insert into public.vertice_memberships(user_id, institution_id, role)
      values (uid, target, member_role)
      on conflict (user_id, institution_id) do update set role = excluded.role
      where actor_role = 'master'
        or vertice_memberships.role not in (
          select unnest(vertice_private.full_access_roles())
        );
    if not found then
      raise exception 'somente o master pode alterar vínculo de perfil de acesso pleno'
        using errcode='42501';
    end if;
    return 'vinculado';
  end if;

  -- Convite pendente
  insert into public.vertice_invites(institution_id, email, role, created_by)
    values (target, mail, member_role, auth.uid())
    on conflict (institution_id, email) do update set role = excluded.role, accepted_at = null
    where actor_role = 'master'
      or vertice_invites.role not in (
        select unnest(vertice_private.full_access_roles())
      );
  if not found then
    raise exception 'somente o master pode alterar convite de perfil de acesso pleno'
      using errcode='42501';
  end if;
  return 'convite_pendente';
end; $$;

-- ============================================================
-- 7. Atualizar policies que usam array['gestor'] hardcoded
--    Estratégia: substituir por vertice_private.is_full_access()
--    onde o contexto é "acesso de gestão" (não "equipe operacional")
-- ============================================================

-- 7a. vertice_area_data (tabela principal de dados por IES)
drop policy if exists vertice_area_rw on public.vertice_area_data;
create policy vertice_area_rw on public.vertice_area_data
  for all to authenticated
  using (vertice_private.is_full_access(id))
  with check (vertice_private.is_full_access(id));

-- 7b. vertice_area_courses
drop policy if exists vertice_area_course_read on public.vertice_area_courses;
create policy vertice_area_course_read on public.vertice_area_courses
  for select to authenticated
  using (vertice_private.can_read_institution(institution_id));

drop policy if exists vertice_area_course_write on public.vertice_area_courses;
create policy vertice_area_course_write on public.vertice_area_courses
  for all to authenticated
  using (vertice_private.is_full_access(institution_id))
  with check (vertice_private.is_full_access(institution_id));

-- 7c. vertice_area_goals
drop policy if exists vertice_area_goal_rw on public.vertice_area_goals;
create policy vertice_area_goal_rw on public.vertice_area_goals
  for all to authenticated
  using (vertice_private.is_full_access(institution_id))
  with check (vertice_private.is_full_access(institution_id));

-- 7d. vertice_memberships: leitura expandida
--     Quem pode ver memberships: o próprio usuário, master, ou full_access da IES
drop policy if exists vertice_membership_read on public.vertice_memberships;
create policy vertice_membership_read on public.vertice_memberships
  for select to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2'
    and (
      user_id = (select auth.uid())
      or vertice_private.is_full_access(institution_id)
    )
  );

-- 7e. vertice_contacts
drop policy if exists vertice_contacts_manage on public.vertice_contacts;
create policy vertice_contacts_manage on public.vertice_contacts
  for all to authenticated
  using (vertice_private.is_full_access(institution_id))
  with check (vertice_private.is_full_access(institution_id));

drop policy if exists vertice_contacts_read on public.vertice_contacts;
create policy vertice_contacts_read on public.vertice_contacts
  for select to authenticated
  using (
    user_id = auth.uid()
    and vertice_private.member_role(institution_id) is not null
  );

-- 7f. vertice_base_modules, vertice_base_cycles, vertice_base_records
drop policy if exists base_modules_read on public.vertice_base_modules;
create policy base_modules_read on public.vertice_base_modules
  for select to authenticated
  using (vertice_private.is_full_access(institution_id));

drop policy if exists base_cycles_read on public.vertice_base_cycles;
create policy base_cycles_read on public.vertice_base_cycles
  for select to authenticated
  using (vertice_private.is_full_access(institution_id));

drop policy if exists base_records_read on public.vertice_base_records;
create policy base_records_read on public.vertice_base_records
  for select to authenticated
  using (vertice_private.is_full_access(institution_id));

-- 7g. vertice_repository_requests
drop policy if exists vertice_repo_requests_insert on public.vertice_repository_requests;
create policy vertice_repo_requests_insert on public.vertice_repository_requests
  for insert to authenticated
  with check (vertice_private.is_full_access(institution_id));

drop policy if exists vertice_repo_requests_update on public.vertice_repository_requests;
create policy vertice_repo_requests_update on public.vertice_repository_requests
  for update to authenticated
  using (vertice_private.is_full_access(institution_id))
  with check (vertice_private.is_full_access(institution_id));

-- 7h. vertice_repository_files — review por full_access
drop policy if exists vertice_repo_files_review on public.vertice_repository_files;
create policy vertice_repo_files_review on public.vertice_repository_files
  for update to authenticated
  using (vertice_private.is_full_access(institution_id))
  with check (vertice_private.is_full_access(institution_id));

-- ============================================================
-- 8. Leitura expandida para perfis intermediários
--    CPA, coordenador, nde podem ler dados da instituição
-- ============================================================

-- Permitir leitura de dados da IES para cpa/coordenador/nde
-- (já coberto por can_read_institution que verifica membership genérica)
-- Mas dados de curso para coordenador/nde devem ser filtrados pelo course_id

-- Função auxiliar: o usuário pode ver este curso?
create or replace function vertice_private.can_read_course(target_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select auth.jwt()->>'aal') = 'aal2'
    and (
      vertice_private.is_master()
      or exists(
        select 1 from public.vertice_memberships m
        join public.vertice_courses c on c.institution_id = m.institution_id
        where m.user_id = (select auth.uid())
          and c.id = target_course
          and (
            -- perfis institucionais veem todos os cursos
            m.course_id is null
            -- perfis de curso veem só o seu
            or m.course_id = target_course
          )
      )
    ),
    false
  );
$$;

revoke all on function vertice_private.can_read_course(uuid) from public, anon;
grant execute on function vertice_private.can_read_course(uuid) to authenticated;

-- ============================================================
-- 9. Validação de documentos: perfis que precisam de aprovação
-- ============================================================
-- Coordenador, NDE e CPA postam documentos que precisam de validação
-- por perfis de acesso completo (reitor, diretor, procurador, gestor, master)

-- Flag needs_validation na tabela de arquivos do repositório (se existir)
do $$
begin
  if exists(select 1 from information_schema.tables where table_name='vertice_repository_files') then
    execute 'alter table public.vertice_repository_files add column if not exists needs_validation boolean not null default false';
    execute 'alter table public.vertice_repository_files add column if not exists validated_by uuid references auth.users(id)';
    execute 'alter table public.vertice_repository_files add column if not exists validated_at timestamptz';
  end if;
end $$;

-- ============================================================
-- 10. Registro de auditoria para mudanças de perfil
-- ============================================================
-- Já coberto pelo trigger vertice_audit_memberships existente

-- ============================================================
-- 11. Conceder permissões para novas funções
-- ============================================================
grant execute on function vertice_private.is_full_access(uuid) to authenticated;
grant execute on function vertice_private.can_record(uuid) to authenticated;
grant execute on function vertice_private.can_read_course(uuid) to authenticated;
grant execute on function vertice_private.full_access_roles() to authenticated;
grant execute on function vertice_private.all_roles() to authenticated;

commit;
