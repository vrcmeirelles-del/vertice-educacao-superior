begin;
-- Metadados mínimos: nenhum corpo, destinatário em claro, credencial ou token.
create table vertice_private.portal_email_deliveries(
 id uuid primary key, institution_id uuid references public.vertice_institutions(id), course_id uuid references public.vertice_courses(id),
 module text not null check(module ~ '^[a-z][a-z0-9_-]{0,63}$'), actor_id uuid, recipient_digest text not null check(recipient_digest ~ '^[a-f0-9]{64}$'),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'), status text not null check(status in ('processing','accepted','failed','uncertain')),
 code text, provider_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table vertice_private.portal_email_deliveries enable row level security;
revoke all on vertice_private.portal_email_deliveries from public,anon,authenticated;
create index portal_email_deliveries_scope on vertice_private.portal_email_deliveries(institution_id,created_at desc);
create function public.vertice_email_delivery(p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r vertice_private.portal_email_deliveries; v_id uuid:=(p_data->>'id')::uuid; claimed boolean:=false;
begin
 if p_action='claim' then
  if p_data->>'institution_id' is not null and p_data->>'course_id' is not null and not exists(select 1 from public.vertice_courses where id=(p_data->>'course_id')::uuid and institution_id=(p_data->>'institution_id')::uuid) then raise exception 'course_scope_invalid';end if;
  insert into vertice_private.portal_email_deliveries(id,institution_id,course_id,module,actor_id,recipient_digest,fingerprint,status)
   values(v_id,(p_data->>'institution_id')::uuid,(p_data->>'course_id')::uuid,p_data->>'module',(p_data->>'actor_id')::uuid,p_data->>'recipient_digest',p_data->>'fingerprint','processing')
   on conflict(id) do nothing returning * into r;
  claimed:=found;
  if not claimed then
   select * into r from vertice_private.portal_email_deliveries where id=v_id;
   if r.fingerprint is distinct from p_data->>'fingerprint' or r.recipient_digest is distinct from p_data->>'recipient_digest' or r.module is distinct from p_data->>'module'
    or r.institution_id is distinct from (p_data->>'institution_id')::uuid or r.course_id is distinct from (p_data->>'course_id')::uuid or r.actor_id is distinct from (p_data->>'actor_id')::uuid then raise exception 'request_conflict';end if;
  end if;
  return jsonb_build_object('claimed',claimed,'status',r.status,'code',r.code);
 elsif p_action='finish' then
  if p_data->>'status' not in ('accepted','failed','uncertain') or coalesce(p_data->>'code','') !~ '^[a-z0-9_]{0,80}$' then raise exception 'outcome_invalid';end if;
  update vertice_private.portal_email_deliveries set status=p_data->>'status',code=p_data->>'code',provider_id=left(p_data->>'provider_id',120),updated_at=now() where id=v_id and status='processing' returning * into r;
  if not found then raise exception 'outcome_already_recorded';end if;
  return jsonb_build_object('status',r.status);
 end if;
 raise exception 'action_invalid';
end $$;
revoke all on function public.vertice_email_delivery(text,jsonb) from public,anon,authenticated;
grant execute on function public.vertice_email_delivery(text,jsonb) to service_role;
create function public.vertice_portal_email_history(p_institution uuid,p_module text default null,p_course uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(case when p_institution is null then vertice_private.is_master() and auth.jwt()->>'aal'='aal2' else vertice_private.member_role(p_institution) in ('master','gestor') end,false) then raise exception 'email_management_denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select id,module,course_id,status,code,created_at,updated_at from vertice_private.portal_email_deliveries
  where (institution_id=p_institution or (p_institution is null and institution_id is null)) and (p_module is null or module=p_module) and (p_course is null or course_id=p_course) order by created_at desc,id desc limit 100) x),'[]'::jsonb);
end $$;
revoke all on function public.vertice_portal_email_history(uuid,text,uuid) from public,anon;
grant execute on function public.vertice_portal_email_history(uuid,text,uuid) to authenticated;
-- Usa o aceite nativo da instituição: emitir/enviar não cria membership nem senha.
create function public.vertice_portal_prepare_invite(p_institution uuid,p_email text,p_role text,p_course uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text:=vertice_private.member_role(p_institution);mail text:=lower(btrim(p_email)); inv public.vertice_invites;
begin
 if not coalesce(actor='master' or (actor='gestor' and p_role in ('equipe','leitor')),false) or not coalesce(p_role in ('gestor','equipe','leitor'),false) then raise exception 'invitation_denied' using errcode='42501';end if;
 if mail is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'email_invalid';end if;
 if p_course is not null and not exists(select 1 from public.vertice_courses where id=p_course and institution_id=p_institution) then raise exception 'course_scope_invalid';end if;
 -- Não rebaixa nem substitui a permissão de conta já vinculada.
 if exists(select 1 from public.vertice_memberships m join auth.users u on u.id=m.user_id where m.institution_id=p_institution and lower(u.email)=mail) then
  return jsonb_build_object('email',mail,'existing_member',true);
 end if;
 insert into public.vertice_invites(institution_id,email,role,created_by) values(p_institution,mail,p_role,auth.uid())
 on conflict(institution_id,email) do update set role=excluded.role,created_by=excluded.created_by,accepted_at=null
 where vertice_invites.accepted_at is null and (actor='master' or vertice_invites.role in ('equipe','leitor')) returning * into inv;
 if not found then raise exception 'invitation_conflict';end if;
 return jsonb_build_object('email',mail,'invitation_id',inv.id,'existing_member',false);
end $$;
revoke all on function public.vertice_portal_prepare_invite(uuid,text,text,uuid) from public,anon;
grant execute on function public.vertice_portal_prepare_invite(uuid,text,text,uuid) to authenticated;
-- Só encaminha tokens nativos que ainda correspondem ao convite persistido.
create function public.vertice_portal_email_native(p_kind text,p_id uuid,p_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'invitation_denied' using errcode='42501';end if;
 if p_kind='ies' then
  perform vertice_onboarding.actor();
  select * into r from vertice_onboarding.invitations where id=p_id and token_hash=p_digest and status='pending' and expires_at>now();
  if not found then raise exception 'invitation_unavailable';end if;
  if not vertice_onboarding.can_manage(auth.uid(),r.institution_id,r.role) then raise exception 'invitation_denied' using errcode='42501';end if;
  return jsonb_build_object('recipient',r.recipient_email,'institution_id',r.institution_id,'course_id',r.course_id,'module','governanca');
 elsif p_kind='master' then
  if not vertice_private.is_master() then raise exception 'invitation_denied' using errcode='42501';end if;
  select * into r from vertice_private.master_invitations where id=p_id and token_digest=p_digest and revoked_at is null and accepted_at is null and expires_at>now();
  if not found then raise exception 'invitation_unavailable';end if;
  return jsonb_build_object('recipient',r.target_email,'module','master');
 elsif p_kind='experience' then
  if not vertice_private.is_master() then raise exception 'invitation_denied' using errcode='42501';end if;
  select * into r from public.vertice_experience_invites where id=p_id and token_digest=p_digest and revoked_at is null and expires_at>now();
  if not found then raise exception 'invitation_unavailable';end if;
  return jsonb_build_object('recipient',r.target_email,'module','experience');
 end if;
 raise exception 'invitation_kind_invalid';
end $$;
revoke all on function public.vertice_portal_email_native(text,uuid,text) from public,anon;
grant execute on function public.vertice_portal_email_native(text,uuid,text) to authenticated;

commit;
