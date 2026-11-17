begin;

create table vertice_private.extension_student_invites (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.vertice_extension_projects(id),
 email text not null,
 identity_hash bytea not null,
 salt uuid not null,
 token_hash bytea unique,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 activated_at timestamptz,
 failed_attempts int not null default 0,
 user_id uuid references auth.users(id),
 allowed_fields text[] not null,
 execution_open boolean not null default false,
 review_state text not null default 'rascunho' check(review_state in ('rascunho','em_revisao','ajustes','aceito')),
 answers jsonb not null default '{}',
 revision integer not null default 0,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(project_id,email)
);

alter table vertice_private.extension_student_invites enable row level security;
revoke all on table vertice_private.extension_student_invites from public,anon,authenticated;

create function vertice_private.extension_student_fields(p_execution boolean)
returns text[] language sql immutable set search_path='' as $$
 select array['introduction','area_characterization','justification','general_objective','specific_objectives',
  'methodology','program','expected_results','evaluation','references','team','infrastructure','publicity']
  || case when p_execution then array['execution','applied_methodology','results','difficulties','final_evaluation',
  'recommendations','conclusion','acknowledgements','evidence_links'] else '{}'::text[] end;
$$;

create function public.vertice_extension_student_issue(p_project uuid,p_registration text,p_cpf text,p_email text,p_fields text[],p_execution boolean,p_invite uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.vertice_extension_projects; inv vertice_private.extension_student_invites;
 token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 mail text:=lower(btrim(p_email)); registration text:=upper(btrim(p_registration));
 cpf text:=regexp_replace(p_cpf,'[^0-9]','','g'); new_salt uuid:=gen_random_uuid();
begin
 select * into p from public.vertice_extension_projects where id=p_project for update;
 if not found or p.deleted_at is not null or not vertice_private.extension_project_manager(p) then
  raise exception 'Acesso ao projeto não autorizado.' using errcode='42501';
 end if;
 if p_invite is not null then
  update vertice_private.extension_student_invites set token_hash=sha256(convert_to(token,'UTF8')),
   expires_at=now()+interval '72 hours',failed_attempts=0,revoked_at=null,updated_by=auth.uid(),updated_at=now()
   where id=p_invite and project_id=p.id and activated_at is null and revoked_at is null returning * into inv;
  if not found then raise exception 'Somente convites ainda não ativados e não revogados podem ser reenviados.'; end if;
 else
  if not coalesce(p.status='planejamento' and p.review_status='rascunho',false)
   and not coalesce(p.status='em_execucao' or p.review_status in ('em_execucao','aguardando_evidencias'),false) then
   raise exception 'Convites estão disponíveis no rascunho ou durante a execução.';
  end if;
  if not coalesce(length(registration) between 1 and 80 and cpf ~ '^[0-9]{11}$'
   and length(mail)<=254 and mail ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   and cardinality(p_fields)>0 and p_fields<@vertice_private.extension_student_fields(p_execution),false) then
   raise exception 'Confira matrícula, CPF, e-mail e campos liberados.';
  end if;
  insert into vertice_private.extension_student_invites(project_id,email,identity_hash,salt,token_hash,expires_at,allowed_fields,execution_open,updated_by)
  values(p.id,mail,sha256(convert_to(jsonb_build_array(new_salt,registration,cpf,mail)::text,'UTF8')),
   new_salt,sha256(convert_to(token,'UTF8')),now()+interval '72 hours',p_fields,p_execution,auth.uid())
  on conflict(project_id,email) do nothing returning * into inv;
  if not found then raise exception 'Já existe um convite para este e-mail neste projeto.'; end if;
 end if;
 return jsonb_build_object('email',inv.email,'token',token,'title',p.title);
end $$;

create function public.vertice_extension_student_activate(p_token text,p_registration text,p_cpf text,p_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv vertice_private.extension_student_invites; pid uuid;
 mail text:=lower(btrim(p_email)); account_email text;
begin
 if auth.uid() is null or not coalesce(p_token ~ '^[0-9a-f]{64}$',false) then return null; end if;
 select project_id into pid from vertice_private.extension_student_invites where token_hash=sha256(convert_to(p_token,'UTF8'));
 if not found then return null; end if;
 perform 1 from public.vertice_extension_projects where id=pid and deleted_at is null for update;
 if not found then return null; end if;
 select lower(email) into account_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if not found or mail is distinct from account_email then return null; end if;
 select * into inv from vertice_private.extension_student_invites where project_id=pid and token_hash=sha256(convert_to(p_token,'UTF8')) for update;
 if not found or inv.email<>mail or inv.revoked_at is not null or inv.activated_at is not null or inv.expires_at<=now() or inv.failed_attempts>=10 then return null; end if;
 if inv.identity_hash is distinct from sha256(convert_to(jsonb_build_array(inv.salt,upper(btrim(p_registration)),regexp_replace(p_cpf,'[^0-9]','','g'),mail)::text,'UTF8')) then
  update vertice_private.extension_student_invites set failed_attempts=failed_attempts+1 where id=inv.id;
  return null;
 end if;
 update vertice_private.extension_student_invites set token_hash=null,activated_at=now(),user_id=auth.uid(),updated_by=auth.uid(),updated_at=now() where id=inv.id;
 return pid;
end $$;

create function public.vertice_extension_student_projects()
returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'project_id',p.id,'title',p.title,'state',i.review_state,'revision',i.revision,
  'answers',coalesce((select jsonb_object_agg(a.key,a.value) from jsonb_each(i.answers) a where a.key=any(i.allowed_fields)),'{}'::jsonb),'fields',to_jsonb(i.allowed_fields),'execution_open',i.execution_open
    and (p.status='em_execucao' or p.review_status in ('em_execucao','aguardando_evidencias')),
  'proposal_open',p.status='planejamento' and p.review_status in ('rascunho','pendente_ajustes'))
 from vertice_private.extension_student_invites i join public.vertice_extension_projects p on p.id=i.project_id
 where i.user_id=auth.uid() and i.revoked_at is null and i.activated_at is not null and p.deleted_at is null;
$$;

create function public.vertice_extension_student_save(p_id uuid,p_revision int,p_answers jsonb,p_send boolean)
returns void language plpgsql security definer set search_path='' as $$
declare inv vertice_private.extension_student_invites; p public.vertice_extension_projects; pid uuid;
begin
 select project_id into pid from vertice_private.extension_student_invites where id=p_id and user_id=auth.uid();
 select * into p from public.vertice_extension_projects where id=pid and deleted_at is null for update;
 if not found then raise exception 'Projeto indisponível.' using errcode='42501'; end if;
 select * into inv from vertice_private.extension_student_invites where id=p_id and user_id=auth.uid() and revoked_at is null and activated_at is not null for update;
 if not found then raise exception 'Projeto indisponível.' using errcode='42501'; end if;
 if inv.review_state not in ('rascunho','ajustes') or inv.revision<>p_revision then raise exception 'Recarregue a contribuição antes de editar.'; end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>100000 then raise exception 'Contribuição inválida.'; end if;
 if exists(select 1 from jsonb_each(p_answers) a where jsonb_typeof(a.value)<>'string'
  or not a.key=any(inv.allowed_fields)
  or (a.key=any(vertice_private.extension_student_fields(false)) and not coalesce(p.status='planejamento' and p.review_status in ('rascunho','pendente_ajustes'),false))
  or (not a.key=any(vertice_private.extension_student_fields(false)) and not coalesce(inv.execution_open and (p.status='em_execucao' or p.review_status in ('em_execucao','aguardando_evidencias')),false))) then
  raise exception 'Há campos fora da etapa liberada.' using errcode='42501';
 end if;
 if p_send and not exists(select 1 from jsonb_each_text(inv.answers||p_answers) a
  where a.key=any(inv.allowed_fields) and btrim(a.value)<>'') then raise exception 'Preencha ao menos um campo para enviar.'; end if;
 update vertice_private.extension_student_invites set answers=answers||p_answers,review_state=case when p_send then 'em_revisao' else review_state end,
  revision=revision+1,updated_by=auth.uid(),updated_at=now() where id=p_id;
 insert into public.vertice_extension_project_history(institution_id,project_id,field_changed,old_value,new_value,changed_by)
 values(p.institution_id,p.id,'contribuição de aluno',inv.review_state,case when p_send then 'em_revisao' else 'rascunho salvo' end,auth.uid());
end $$;

create function public.vertice_extension_student_review(p_project uuid,p_invite uuid default null,p_action text default null,p_fields text[] default null,p_execution boolean default false)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare p public.vertice_extension_projects;
begin
 select * into p from public.vertice_extension_projects where id=p_project for update;
 if not found or p.deleted_at is not null or not vertice_private.extension_project_manager(p) then
  raise exception 'Acesso ao projeto não autorizado.' using errcode='42501';
 end if;
 if p_invite is not null then
  if not coalesce(p_action in ('revogar','ajustes','aceito','permissoes'),false)
   or (p_action='permissoes' and not coalesce(cardinality(p_fields)>0 and p_fields<@vertice_private.extension_student_fields(p_execution),false)) then
   raise exception 'Ação inválida.';
  end if;
  update vertice_private.extension_student_invites set
   revoked_at=case when p_action='revogar' then now() else revoked_at end,
   token_hash=case when p_action='revogar' then null else token_hash end,
   review_state=case when p_action in ('ajustes','aceito') then p_action
    when p_action='permissoes' and p_execution and not execution_open and review_state='aceito' then 'ajustes'
    else review_state end,
   allowed_fields=case when p_action='permissoes' then p_fields else allowed_fields end,
   execution_open=case when p_action='permissoes' then p_execution else execution_open end,
   revision=revision+1,updated_by=auth.uid(),updated_at=now()
  where id=p_invite and project_id=p.id and revoked_at is null
   and (p_action not in ('ajustes','aceito') or review_state='em_revisao'
    or (p_action='ajustes' and review_state='aceito' and execution_open
      and (p.status='em_execucao' or p.review_status in ('em_execucao','aguardando_evidencias'))));
  if not found then raise exception 'A ação não está disponível para este convite.'; end if;
  insert into public.vertice_extension_project_history(institution_id,project_id,field_changed,new_value,changed_by)
  values(p.institution_id,p.id,'convite de aluno',p_action,auth.uid());
 end if;
 return query select jsonb_build_object('id',i.id,'email',i.email,'expires_at',i.expires_at,'activated_at',i.activated_at,
  'revoked_at',i.revoked_at,'state',i.review_state,'answers',i.answers,'fields',i.allowed_fields,'execution_open',i.execution_open,
  'updated_at',i.updated_at) from vertice_private.extension_student_invites i where i.project_id=p.id order by i.updated_at desc;
end $$;

revoke all on function vertice_private.extension_student_fields(boolean),
 public.vertice_extension_student_issue(uuid,text,text,text,text[],boolean,uuid),
 public.vertice_extension_student_activate(text,text,text,text),public.vertice_extension_student_projects(),
 public.vertice_extension_student_save(uuid,int,jsonb,boolean),
 public.vertice_extension_student_review(uuid,uuid,text,text[],boolean) from public,anon;
grant execute on function public.vertice_extension_student_issue(uuid,text,text,text,text[],boolean,uuid),
 public.vertice_extension_student_activate(text,text,text,text),public.vertice_extension_student_projects(),
 public.vertice_extension_student_save(uuid,int,jsonb,boolean),
 public.vertice_extension_student_review(uuid,uuid,text,text[],boolean) to authenticated;
commit;
