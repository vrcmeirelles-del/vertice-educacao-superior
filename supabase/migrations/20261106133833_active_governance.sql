-- Vértice: governança ativa, aditiva, sem alterar ou apagar ações e metas anteriores.
-- Os percentuais do sistema legado continuam preservados.
create table if not exists public.vertice_action_governance (
 action_id uuid primary key references public.vertice_actions(id) on delete cascade,
 institution_id uuid not null references public.vertice_institutions(id),
 declared_progress integer not null default 0 check (declared_progress between 0 and 100),
 validated_progress integer not null default 0 check (validated_progress between 0 and 100),
 review_status text not null default 'rascunho' check (review_status in ('rascunho','enviado','aprovado','devolvido')),
 note text not null default '' check (length(note)<=3000),
 blocker text not null default '' check (length(blocker)<=2000),
 last_actor uuid,
 checked_at timestamptz,
 submitted_by uuid,
 submitted_at timestamptz,
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text check (review_note is null or length(review_note)<=3000),
 updated_at timestamptz not null default now()
);
create index if not exists vertice_action_governance_institution_idx on public.vertice_action_governance(institution_id,checked_at desc);

create table if not exists public.vertice_action_governance_events (
 id bigint generated always as identity primary key,
 action_id uuid not null references public.vertice_actions(id) on delete cascade,
 institution_id uuid not null references public.vertice_institutions(id),
 actor uuid,
 event_type text not null check (event_type in ('checkin','envio','aprovacao','devolucao')),
 progress_before integer,
 progress_after integer not null,
 event_note text,
 occurred_at timestamptz not null default now()
);
create index if not exists vertice_governance_events_action_idx on public.vertice_action_governance_events(action_id,occurred_at desc);

alter table public.vertice_action_governance enable row level security;
alter table public.vertice_action_governance_events enable row level security;
revoke all on public.vertice_action_governance, public.vertice_action_governance_events from anon,authenticated;
grant select,insert,update on public.vertice_action_governance to authenticated;
grant select on public.vertice_action_governance_events to authenticated;
create policy vx_gov_select on public.vertice_action_governance for select to authenticated using (vertice_private.can_read_institution(institution_id));
create policy vx_gov_insert on public.vertice_action_governance for insert to authenticated with check (vertice_private.has_role(institution_id,array['gestor','equipe']));
create policy vx_gov_update on public.vertice_action_governance for update to authenticated using (vertice_private.has_role(institution_id,array['gestor','equipe'])) with check (vertice_private.has_role(institution_id,array['gestor','equipe']));
create policy vx_gov_events_select on public.vertice_action_governance_events for select to authenticated using (vertice_private.can_read_institution(institution_id));

-- Uma única porta de mudança para cliente; a validação de transições é imposta no banco.
create or replace function vertice_private.governance_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare action_inst uuid;
declare reviewer boolean;
begin
 select a.institution_id into action_inst from public.vertice_actions a where a.id=new.action_id;
 if action_inst is null or new.institution_id is distinct from action_inst then
  raise exception 'Ação não pertence à instituição' using errcode='23514';
 end if;
 if not vertice_private.has_role(new.institution_id,array['gestor','equipe']) then
  raise exception 'Sem autorização para alterar governança' using errcode='42501';
 end if;
 reviewer:=vertice_private.has_role(new.institution_id,array['gestor']);
 if tg_op='INSERT' then
  if new.review_status<>'rascunho' or new.validated_progress<>0 or new.submitted_by is not null or new.reviewed_by is not null
     or new.reviewed_at is not null or new.submitted_at is not null then
   raise exception 'Estado inicial inválido' using errcode='23514';
  end if;
  new.checked_at=now();
  new.last_actor=auth.uid();
 else
  if new.action_id is distinct from old.action_id or new.institution_id is distinct from old.institution_id then
   raise exception 'Vínculo não pode ser alterado' using errcode='23514';
  end if;
  if new.review_status='aprovado' and old.review_status<>'aprovado' then
   if not reviewer or old.review_status<>'enviado' or new.declared_progress<>100 or length(trim(coalesce(new.review_note,'')))<5 or
      old.submitted_by is null or old.submitted_by=auth.uid() then
    raise exception 'Aprovação exige gestor distinto do autor do envio' using errcode='42501';
   end if;
   new.validated_progress=old.declared_progress; new.reviewed_by=auth.uid(); new.reviewed_at=now();
  elsif new.review_status='devolvido' and old.review_status<>'devolvido' then
   if not reviewer or old.review_status<>'enviado' or old.submitted_by=auth.uid()
      or length(trim(coalesce(new.review_note,'')))<5 then
    raise exception 'Devolução exige gestor diferente e justificativa' using errcode='42501';
   end if;
   new.validated_progress=old.validated_progress;new.reviewed_by=auth.uid();new.reviewed_at=now();
  elsif new.review_status='enviado' and old.review_status<>'enviado' then
   if old.review_status not in ('rascunho','devolvido') or new.declared_progress<>100
      or length(trim(new.note))<5 then
    raise exception 'Envio exige 100 por cento e prestação de contas' using errcode='23514';
   end if;
   new.submitted_by=auth.uid();new.submitted_at=now();new.reviewed_by=null;new.reviewed_at=null;new.review_note=null;new.validated_progress=old.validated_progress;
  elsif new.review_status is distinct from old.review_status then
   -- Restauração a rascunho somente após devolução; não altera validação histórica.
   if not (new.review_status='rascunho' and old.review_status='devolvido') then
    raise exception 'Transição de validação inválida' using errcode='23514';
   end if;
   new.reviewed_by=old.reviewed_by;new.reviewed_at=old.reviewed_at;new.validated_progress=old.validated_progress;
  end if;
  if new.review_status=old.review_status then
   if old.review_status in ('enviado','aprovado') and (new.declared_progress is distinct from old.declared_progress or new.note is distinct from old.note or new.blocker is distinct from old.blocker) then
    raise exception 'Envio pendente ou aprovado não pode ser editado' using errcode='23514';
   end if;
   if new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at
      or new.submitted_by is distinct from old.submitted_by or new.submitted_at is distinct from old.submitted_at
      or new.validated_progress is distinct from old.validated_progress or new.review_note is distinct from old.review_note then
    raise exception 'Campos de validação são protegidos' using errcode='42501';
   end if;
  end if;
  new.checked_at=case when new.review_status in ('rascunho','devolvido') then now() else old.checked_at end;
  new.last_actor=auth.uid();
 end if;
 new.updated_at=now();
 return new;
end $$;

create or replace function vertice_private.governance_event() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;
begin
 kind:=case when new.review_status='aprovado' and (tg_op='INSERT' or old.review_status<>'aprovado') then 'aprovacao'
           when new.review_status='devolvido' and (tg_op='INSERT' or old.review_status<>'devolvido') then 'devolucao'
           when new.review_status='enviado' and (tg_op='INSERT' or old.review_status<>'enviado') then 'envio'
           else 'checkin' end;
 insert into public.vertice_action_governance_events(action_id,institution_id,actor,event_type,progress_before,progress_after,event_note)
 values(new.action_id,new.institution_id,auth.uid(),kind,
        case when tg_op='INSERT' then null else old.declared_progress end,new.declared_progress,
        case when kind in ('aprovacao','devolucao') then new.review_note else new.note end);
 return null;
end $$;
revoke all on function vertice_private.governance_event() from public,anon,authenticated;
revoke all on function vertice_private.governance_guard() from public,anon;
grant execute on function vertice_private.governance_guard() to authenticated;
drop trigger if exists vx_governance_guard on public.vertice_action_governance;
create trigger vx_governance_guard before insert or update on public.vertice_action_governance for each row execute function vertice_private.governance_guard();
drop trigger if exists vx_governance_event on public.vertice_action_governance;
create trigger vx_governance_event after insert or update on public.vertice_action_governance for each row execute function vertice_private.governance_event();

create or replace function public.vertice_action_checkin(p_action uuid,p_progress integer,p_note text,p_blocker text default '')
returns public.vertice_action_governance language plpgsql security invoker set search_path='' as $$
declare inst uuid; result public.vertice_action_governance;
begin
 select institution_id into inst from public.vertice_actions where id=p_action;
 if inst is null or not vertice_private.has_role(inst,array['gestor','equipe']) then raise exception 'Sem permissão' using errcode='42501'; end if;
 if p_progress not between 0 and 100 or length(coalesce(p_note,''))>3000 or length(coalesce(p_blocker,''))>2000 then
  raise exception 'Progresso ou texto inválido' using errcode='23514';
 end if;
 insert into public.vertice_action_governance(action_id,institution_id,declared_progress,note,blocker)
 values(p_action,inst,p_progress,coalesce(p_note,''),coalesce(p_blocker,''))
 on conflict(action_id) do update set
  declared_progress=excluded.declared_progress,note=excluded.note,blocker=excluded.blocker,
  review_status=case when public.vertice_action_governance.review_status='devolvido' then 'rascunho' else public.vertice_action_governance.review_status end
 returning * into result;
 update public.vertice_actions set progress=p_progress where id=p_action and institution_id=inst;
 return result;
end $$;

create or replace function public.vertice_action_review(p_action uuid,p_decision text,p_note text default '')
returns public.vertice_action_governance language plpgsql security invoker set search_path='' as $$
declare inst uuid; result public.vertice_action_governance;
begin
 select institution_id into inst from public.vertice_actions where id=p_action;
 if inst is null then raise exception 'Ação não encontrada' using errcode='22023'; end if;
 if p_decision='enviado' then
  if not vertice_private.has_role(inst,array['gestor','equipe']) then raise exception 'Sem permissão' using errcode='42501'; end if;
  update public.vertice_action_governance set review_status='enviado' where action_id=p_action returning * into result;
 elsif p_decision in ('aprovado','devolvido') then
  if not vertice_private.has_role(inst,array['gestor']) then raise exception 'Validação reservada à gestão' using errcode='42501'; end if;
  update public.vertice_action_governance set review_status=p_decision,review_note=coalesce(p_note,'')
  where action_id=p_action returning * into result;
 else raise exception 'Decisão inválida' using errcode='22023';
 end if;
 if result.action_id is null then raise exception 'Registre check-in antes de enviar para validação' using errcode='22023'; end if;
 return result;
end $$;
revoke all on function public.vertice_action_checkin(uuid,integer,text,text),public.vertice_action_review(uuid,text,text) from public,anon;
grant execute on function public.vertice_action_checkin(uuid,integer,text,text),public.vertice_action_review(uuid,text,text) to authenticated;
