-- Área real (30/10/2026): cadastro de IES e cursos, equipe por instituição,
-- metas e indicadores, plano de ação 5W2H e diagnóstico.
-- Aditiva: não apaga nem altera dados existentes. Toda leitura e escrita exige MFA (aal2).
-- Papéis: master (vertice_admins) > gestor > equipe > leitor (vertice_memberships).
begin;

-- ---------------------------------------------------------------- papéis
create or replace function vertice_private.member_role(target uuid) returns text
language sql stable security definer set search_path = '' as $$
 select case
  when not coalesce((select auth.jwt()->>'aal') = 'aal2', false) then null
  when vertice_private.is_master() then 'master'
  else (select m.role from public.vertice_memberships m
        where m.user_id = (select auth.uid()) and m.institution_id = target)
 end;
$$;
-- Verdadeiro quando o usuário tem um dos papéis informados na instituição (master sempre pode).
create or replace function vertice_private.has_role(target uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(vertice_private.member_role(target) = 'master'
   or vertice_private.member_role(target) = any(roles), false);
$$;
revoke all on function vertice_private.member_role(uuid), vertice_private.has_role(uuid,text[]) from public, anon;
grant execute on function vertice_private.member_role(uuid), vertice_private.has_role(uuid,text[]) to authenticated;

create or replace function vertice_private.touch_updated() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

-- Impede vincular registro a curso/meta/achado de outra instituição.
create or replace function vertice_private.check_same_institution() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(new); inst uuid := (j->>'institution_id')::uuid;
begin
 if j ? 'course_id' and j->>'course_id' is not null and not exists(
   select 1 from public.vertice_courses c where c.id = (j->>'course_id')::uuid and c.institution_id = inst)
 then raise exception 'curso pertence a outra instituição' using errcode = '23514'; end if;
 if j ? 'goal_id' and j->>'goal_id' is not null and not exists(
   select 1 from public.vertice_goals g where g.id = (j->>'goal_id')::uuid and g.institution_id = inst)
 then raise exception 'meta pertence a outra instituição' using errcode = '23514'; end if;
 if j ? 'finding_id' and j->>'finding_id' is not null and not exists(
   select 1 from public.vertice_diagnosis_items d where d.id = (j->>'finding_id')::uuid and d.institution_id = inst)
 then raise exception 'achado pertence a outra instituição' using errcode = '23514'; end if;
 if tg_op = 'UPDATE' and (to_jsonb(old)->>'institution_id') is distinct from (j->>'institution_id') then
  raise exception 'não é permitido mover registro entre instituições' using errcode = '23514'; end if;
 return new;
end; $$;
revoke all on function vertice_private.check_same_institution(), vertice_private.touch_updated() from public, anon, authenticated;

-- ---------------------------------------------------------------- instituições
alter table public.vertice_institutions
 add column if not exists acronym text check (acronym is null or length(acronym) <= 30),
 add column if not exists cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
 add column if not exists maintainer text check (maintainer is null or length(maintainer) <= 250),
 add column if not exists city text check (city is null or length(city) <= 120),
 add column if not exists state text check (state is null or state ~ '^[A-Z]{2}$'),
 add column if not exists emec_code text check (emec_code is null or length(emec_code) <= 20),
 add column if not exists status text not null default 'ativa' check (status in ('ativa','arquivada')),
 add column if not exists notes text check (notes is null or length(notes) <= 4000),
 add column if not exists updated_at timestamptz not null default now();
create trigger vertice_touch_institutions before update on public.vertice_institutions
 for each row execute function vertice_private.touch_updated();
grant insert, update on public.vertice_institutions to authenticated;
create policy vertice_institution_insert on public.vertice_institutions for insert to authenticated
 with check (vertice_private.is_master());
create policy vertice_institution_update on public.vertice_institutions for update to authenticated
 using (vertice_private.has_role(id, array['gestor'])) with check (vertice_private.has_role(id, array['gestor']));

-- ---------------------------------------------------------------- cursos
alter table public.vertice_courses
 add column if not exists degree text check (degree is null or degree in ('bacharelado','licenciatura','tecnologo','especializacao','mestrado','doutorado','outro')),
 add column if not exists status text not null default 'ativo' check (status in ('ativo','em_implantacao','em_extincao','extinto')),
 add column if not exists coordinator text check (coordinator is null or length(coordinator) <= 250),
 add column if not exists vacancies integer check (vacancies is null or vacancies >= 0),
 add column if not exists updated_at timestamptz not null default now();
create trigger vertice_touch_courses before update on public.vertice_courses
 for each row execute function vertice_private.touch_updated();
create trigger vertice_same_inst_courses before update on public.vertice_courses
 for each row execute function vertice_private.check_same_institution();
grant insert, update, delete on public.vertice_courses to authenticated;
create policy vertice_course_insert on public.vertice_courses for insert to authenticated
 with check (vertice_private.has_role(institution_id, array['gestor']));
create policy vertice_course_update on public.vertice_courses for update to authenticated
 using (vertice_private.has_role(institution_id, array['gestor'])) with check (vertice_private.has_role(institution_id, array['gestor']));
create policy vertice_course_delete on public.vertice_courses for delete to authenticated
 using (vertice_private.is_master());

-- ---------------------------------------------------------------- equipe
-- Gestor vê os vínculos da própria instituição; master vê todos; cada um vê o próprio.
drop policy if exists vertice_membership_read on public.vertice_memberships;
create policy vertice_membership_read on public.vertice_memberships for select to authenticated
 using ((select auth.jwt()->>'aal') = 'aal2' and (user_id = (select auth.uid()) or vertice_private.has_role(institution_id, array['gestor'])));
grant insert, update, delete on public.vertice_memberships to authenticated;
-- Master atribui qualquer papel. Gestor só atribui equipe/leitor e nunca altera o próprio vínculo.
create policy vertice_membership_write on public.vertice_memberships for insert to authenticated
 with check (vertice_private.is_master() or (vertice_private.member_role(institution_id) = 'gestor'
   and role in ('equipe','leitor') and user_id <> (select auth.uid())));
create policy vertice_membership_update on public.vertice_memberships for update to authenticated
 using (vertice_private.is_master() or (vertice_private.member_role(institution_id) = 'gestor'
   and role in ('equipe','leitor') and user_id <> (select auth.uid())))
 with check (vertice_private.is_master() or (vertice_private.member_role(institution_id) = 'gestor'
   and role in ('equipe','leitor') and user_id <> (select auth.uid())));
create policy vertice_membership_delete on public.vertice_memberships for delete to authenticated
 using (vertice_private.is_master() or (vertice_private.member_role(institution_id) = 'gestor'
   and role in ('equipe','leitor') and user_id <> (select auth.uid())));

-- Convites: o vínculo é criado quando a pessoa entra com o e-mail confirmado.
create table public.vertice_invites (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
 role text not null check (role in ('gestor','equipe','leitor')),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 accepted_at timestamptz,
 unique (institution_id, email)
);
alter table public.vertice_invites enable row level security;
revoke all on public.vertice_invites from anon, authenticated;
grant select, insert, delete on public.vertice_invites to authenticated;
create policy vertice_invite_read on public.vertice_invites for select to authenticated
 using (vertice_private.has_role(institution_id, array['gestor']));
create policy vertice_invite_insert on public.vertice_invites for insert to authenticated
 with check (vertice_private.is_master() or (vertice_private.member_role(institution_id) = 'gestor' and role in ('equipe','leitor')));
create policy vertice_invite_delete on public.vertice_invites for delete to authenticated
 using (accepted_at is null and (vertice_private.is_master() or (vertice_private.member_role(institution_id) = 'gestor' and role in ('equipe','leitor'))));
create index vertice_invites_email_idx on public.vertice_invites(email) where accepted_at is null;

-- Aceita convites pendentes do usuário atual. O e-mail vem de auth.users e precisa estar confirmado.
create or replace function public.vertice_accept_invites() returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mail text; n integer := 0;
begin
 if uid is null or coalesce(auth.jwt()->>'aal','') <> 'aal2' then return 0; end if;
 select lower(u.email) into mail from auth.users u where u.id = uid and u.email_confirmed_at is not null;
 if mail is null then return 0; end if;
 insert into public.vertice_memberships(user_id, institution_id, role)
  select uid, i.institution_id, i.role from public.vertice_invites i
  where i.email = mail and i.accepted_at is null
 on conflict (user_id, institution_id) do nothing;
 update public.vertice_invites set accepted_at = now() where email = mail and accepted_at is null;
 get diagnostics n = row_count;
 return n;
end; $$;
revoke all on function public.vertice_accept_invites() from public, anon;
grant execute on function public.vertice_accept_invites() to authenticated;

-- Lista a equipe com e-mail (somente master ou gestor da instituição).
create or replace function public.vertice_team(target uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select m.user_id, u.email::text, m.role, m.created_at
 from public.vertice_memberships m join auth.users u on u.id = m.user_id
 where m.institution_id = target and vertice_private.has_role(target, array['gestor'])
 order by m.role, u.email;
$$;
revoke all on function public.vertice_team(uuid) from public, anon;
grant execute on function public.vertice_team(uuid) to authenticated;

-- Vincula conta já existente pelo e-mail (sem expor se a conta existe a quem não pode gerir).
create or replace function public.vertice_add_member(target uuid, member_email text, member_role text) returns text
language plpgsql security definer set search_path = '' as $$
declare actor_role text := vertice_private.member_role(target); uid uuid; mail text := lower(trim(member_email));
begin
 if member_role not in ('gestor','equipe','leitor') then raise exception 'papel inválido' using errcode='22023'; end if;
 if not coalesce(actor_role = 'master' or (actor_role = 'gestor' and member_role in ('equipe','leitor')), false) then
  raise exception 'sem permissão' using errcode = '42501'; end if;
 select u.id into uid from auth.users u where lower(u.email) = mail and u.email_confirmed_at is not null;
 if uid is not null then
  if uid = auth.uid() and actor_role <> 'master' then raise exception 'sem permissão' using errcode = '42501'; end if;
  insert into public.vertice_memberships(user_id, institution_id, role) values (uid, target, member_role)
   on conflict (user_id, institution_id) do update set role = excluded.role;
  return 'vinculado';
 end if;
 insert into public.vertice_invites(institution_id, email, role, created_by) values (target, mail, member_role, auth.uid())
  on conflict (institution_id, email) do update set role = excluded.role, accepted_at = null;
 return 'convite_pendente';
end; $$;
revoke all on function public.vertice_add_member(uuid,text,text) from public, anon;
grant execute on function public.vertice_add_member(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------- diagnóstico
create table public.vertice_diagnosis_items (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 course_id uuid references public.vertice_courses(id) on delete set null,
 dimension text not null check (length(dimension) between 1 and 120),
 criterion text not null check (length(criterion) between 1 and 500),
 reference text check (reference is null or length(reference) <= 120),
 score numeric(2,1) check (score is null or (score >= 1 and score <= 5)),
 finding text check (finding is null or length(finding) <= 4000),
 evidence text check (evidence is null or length(evidence) <= 4000),
 priority text not null default 'media' check (priority in ('alta','media','baixa')),
 status text not null default 'aberto' check (status in ('aberto','em_tratamento','resolvido')),
 assessed_on date,
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vertice_diagnosis_institution_idx on public.vertice_diagnosis_items(institution_id);

-- ---------------------------------------------------------------- metas
create table public.vertice_goals (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 course_id uuid references public.vertice_courses(id) on delete set null,
 title text not null check (length(title) between 1 and 250),
 indicator text not null check (length(indicator) between 1 and 250),
 formula text check (formula is null or length(formula) <= 1000),
 source text check (source is null or length(source) <= 500),
 unit text check (unit is null or length(unit) <= 30),
 direction text not null default 'aumentar' check (direction in ('aumentar','reduzir','manter')),
 baseline numeric,
 baseline_date date,
 target numeric not null,
 due_date date,
 frequency text check (frequency is null or frequency in ('mensal','bimestral','trimestral','semestral','anual')),
 owner_name text check (owner_name is null or length(owner_name) <= 250),
 status text not null default 'ativa' check (status in ('planejada','ativa','concluida','cancelada')),
 notes text check (notes is null or length(notes) <= 4000),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vertice_goals_institution_idx on public.vertice_goals(institution_id);

create table public.vertice_goal_measurements (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 goal_id uuid not null references public.vertice_goals(id) on delete cascade,
 measured_on date not null,
 value numeric not null,
 source text check (source is null or length(source) <= 500),
 note text check (note is null or length(note) <= 2000),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vertice_measurements_goal_idx on public.vertice_goal_measurements(goal_id, measured_on);

-- ---------------------------------------------------------------- plano 5W2H
create table public.vertice_actions (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 course_id uuid references public.vertice_courses(id) on delete set null,
 goal_id uuid references public.vertice_goals(id) on delete set null,
 finding_id uuid references public.vertice_diagnosis_items(id) on delete set null,
 what text not null check (length(what) between 1 and 500),
 why text check (why is null or length(why) <= 2000),
 where_at text check (where_at is null or length(where_at) <= 250),
 who text check (who is null or length(who) <= 250),
 start_date date,
 due_date date,
 how text check (how is null or length(how) <= 4000),
 how_much text check (how_much is null or length(how_much) <= 250),
 status text not null default 'nao_iniciada' check (status in ('nao_iniciada','em_andamento','concluida','bloqueada','cancelada')),
 progress integer not null default 0 check (progress between 0 and 100),
 evidence text check (evidence is null or length(evidence) <= 4000),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (due_date is null or start_date is null or due_date >= start_date)
);
create index vertice_actions_institution_idx on public.vertice_actions(institution_id);

-- ---------------------------------------------------------------- RLS das tabelas de gestão
do $$
declare t text;
begin
 foreach t in array array['vertice_diagnosis_items','vertice_goals','vertice_goal_measurements','vertice_actions'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  execute format('create policy %I on public.%I for select to authenticated using (vertice_private.can_read_institution(institution_id))', t||'_read', t);
  execute format('create policy %I on public.%I for delete to authenticated using (vertice_private.has_role(institution_id, array[''gestor'']))', t||'_delete', t);
  execute format('create trigger %I before update on public.%I for each row execute function vertice_private.touch_updated()', t||'_touch', t);
  execute format('create trigger %I before insert or update on public.%I for each row execute function vertice_private.check_same_institution()', t||'_same_inst', t);
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function vertice_private.audit_change()', t||'_audit', t);
 end loop;
end $$;
-- Metas: gestor define e altera. Equipe registra medições, ações e achados.
create policy vertice_goals_insert on public.vertice_goals for insert to authenticated
 with check (vertice_private.has_role(institution_id, array['gestor']));
create policy vertice_goals_update on public.vertice_goals for update to authenticated
 using (vertice_private.has_role(institution_id, array['gestor'])) with check (vertice_private.has_role(institution_id, array['gestor']));
do $$
declare t text;
begin
 foreach t in array array['vertice_diagnosis_items','vertice_goal_measurements','vertice_actions'] loop
  execute format('create policy %I on public.%I for insert to authenticated with check (vertice_private.has_role(institution_id, array[''gestor'',''equipe'']))', t||'_insert', t);
  execute format('create policy %I on public.%I for update to authenticated using (vertice_private.has_role(institution_id, array[''gestor'',''equipe''])) with check (vertice_private.has_role(institution_id, array[''gestor'',''equipe'']))', t||'_update', t);
 end loop;
end $$;
create trigger vertice_audit_invites after insert or update or delete on public.vertice_invites
 for each row execute function vertice_private.audit_change();

commit;
