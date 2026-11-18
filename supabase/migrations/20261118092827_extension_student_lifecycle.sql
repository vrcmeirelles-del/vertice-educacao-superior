-- Gestão recuperável de uma participação de extensão, sem apagar horas ou evidências.
begin;
alter table public.vertice_extension_students
 add column lifecycle_version integer not null default 0,
 add column lifecycle_previous_status text,
 add column removed_at timestamptz,
 add column deleted_at timestamptz;

create function vertice_private.extension_student_lifecycle_protect()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.vertice_extension_projects;
begin
 if tg_op='DELETE' then raise exception 'Use a exclusão recuperável do cadastro de participação.';end if;
 if tg_op='INSERT' then
  if new.lifecycle_version<>0 or new.lifecycle_previous_status is not null or new.removed_at is not null or new.deleted_at is not null or new.status in ('inativo','retirado','excluido') then
   raise exception 'Crie um vínculo ativo e utilize as ações de gestão.';
  end if;
  return new;
 end if;
 if new.project_id is distinct from old.project_id or new.institution_id is distinct from old.institution_id then raise exception 'Não é permitido transferir um vínculo por edição. Vincule o aluno ao projeto correto.';end if;
 if (to_jsonb(new)-array['lifecycle_version','lifecycle_previous_status','removed_at','deleted_at','status']) is distinct from
    (to_jsonb(old)-array['lifecycle_version','lifecycle_previous_status','removed_at','deleted_at','status'])
    and (old.removed_at is not null or old.deleted_at is not null) then raise exception 'Recupere o vínculo antes de editar o cadastro.';end if;
 if (new.lifecycle_version,new.lifecycle_previous_status,new.removed_at,new.deleted_at) is distinct from
    (old.lifecycle_version,old.lifecycle_previous_status,old.removed_at,old.deleted_at)
    or (new.status is distinct from old.status and (new.status in ('inativo','retirado','excluido') or old.status in ('inativo','retirado','excluido'))) then
  select * into p from public.vertice_extension_projects where id=old.project_id;
  if current_setting('vertice.extension_lifecycle_student',true) is distinct from old.id::text or
    not coalesce(vertice_private.extension_project_manager(p),false) then
   raise exception 'Utilize as ações autorizadas de gestão do aluno.' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function vertice_private.extension_student_lifecycle_protect() from public,anon,authenticated;
create trigger extension_student_lifecycle_protect before insert or update or delete on public.vertice_extension_students
 for each row execute function vertice_private.extension_student_lifecycle_protect();

create function public.vertice_extension_student_lifecycle(p_student uuid,p_project uuid,p_action text,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.vertice_extension_projects; s public.vertice_extension_students; before_row jsonb; previous_context text;
begin
 select * into p from public.vertice_extension_projects where id=p_project for update;
 if not found or p.deleted_at is not null or not coalesce(vertice_private.extension_project_manager(p),false) then raise exception 'Gestão deste projeto não autorizada.' using errcode='42501';end if;
 if not coalesce(p_action in ('desativar','reativar','retirar','reintegrar','excluir','restaurar'),false) then raise exception 'Ação inválida.';end if;
 if length(btrim(coalesce(p_reason,'')))<5 or length(p_reason)>2000 then raise exception 'Informe o motivo com cinco a 2000 caracteres.';end if;
 select * into s from public.vertice_extension_students where id=p_student and project_id=p.id and institution_id=p.institution_id for update;
 if not found then raise exception 'Aluno não pertence a este projeto.' using errcode='42501';end if;
 if s.lifecycle_version is distinct from p_expected_version then raise exception 'Cadastro atualizado em outra sessão. Recarregue antes de continuar.' using errcode='40001';end if;
 if not (case p_action
  when 'desativar' then s.status not in ('inativo','retirado','excluido') and s.removed_at is null and s.deleted_at is null
  when 'reativar' then s.status='inativo' and s.removed_at is null and s.deleted_at is null
  when 'retirar' then s.removed_at is null and s.deleted_at is null
  when 'reintegrar' then s.removed_at is not null and s.deleted_at is null
  when 'excluir' then s.deleted_at is null
  when 'restaurar' then s.deleted_at is not null
  else false end) then raise exception 'Ação indisponível na situação atual do aluno.';end if;
 before_row:=jsonb_build_object('status',s.status,'removed_at',s.removed_at,'deleted_at',s.deleted_at,'version',s.lifecycle_version);
 previous_context:=current_setting('vertice.extension_lifecycle_student',true);
 perform set_config('vertice.extension_lifecycle_student',s.id::text,true);
 update public.vertice_extension_students set
  lifecycle_previous_status=case when status not in ('inativo','retirado','excluido') then status else lifecycle_previous_status end,
  status=case p_action when 'desativar' then 'inativo' when 'retirar' then 'retirado' when 'excluir' then 'excluido'
   when 'reativar' then coalesce(nullif(lifecycle_previous_status,''),'ativo') else 'inativo' end,
  removed_at=case when p_action='retirar' then now() when p_action in ('reintegrar','restaurar') then null else removed_at end,
  deleted_at=case when p_action='excluir' then now() when p_action='restaurar' then null else deleted_at end,
  lifecycle_version=lifecycle_version+1 where id=s.id returning * into s;
 perform set_config('vertice.extension_lifecycle_student',coalesce(previous_context,''),true);
 -- Revoga acesso somente no projeto selecionado. Reativação não ressuscita convites.
 if p_action in ('desativar','retirar','excluir') and nullif(btrim(s.email),'') is not null then
  update vertice_private.extension_student_invites set revoked_at=now(),token_hash=null,revision=revision+1,updated_by=auth.uid(),updated_at=now()
   where project_id=p.id and lower(btrim(email))=lower(btrim(s.email)) and revoked_at is null;
 end if;
 insert into public.vertice_extension_project_history(institution_id,project_id,field_changed,old_value,new_value,reason,changed_by)
 values(p.institution_id,p.id,'student_lifecycle:'||s.id::text,before_row::text,
  jsonb_build_object('action',p_action,'status',s.status,'removed_at',s.removed_at,'deleted_at',s.deleted_at,'version',s.lifecycle_version)::text,btrim(p_reason),auth.uid());
 return jsonb_build_object('id',s.id,'status',s.status,'removed_at',s.removed_at,'deleted_at',s.deleted_at,'lifecycle_version',s.lifecycle_version);
end $$;
revoke all on function public.vertice_extension_student_lifecycle(uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.vertice_extension_student_lifecycle(uuid,uuid,text,integer,text) to authenticated;
comment on function public.vertice_extension_student_lifecycle(uuid,uuid,text,integer,text) is 'Gestão recuperável de uma participação por projeto/IES. Preserva horas/evidências; não exclui conta Auth nem outros projetos. Convites revogados não são reativados.';
commit;
