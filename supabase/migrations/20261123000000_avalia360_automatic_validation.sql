-- Avalia 360°: validação técnica do caderno pelo servidor.
-- O status validated mantém a compatibilidade com aplicações, emissão e correção.
begin;

create function public.vertice_avalia_automatic_validation(
 p_institution uuid,p_course uuid,p_draft uuid,p_expected_revision integer,p_action text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 d public.vertice_avalia_drafts;
 blocking text[];
begin
 if uid is null or vertice_private.avalia_access(p_institution,p_course,'record') is not true then
  raise exception 'Validação restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('release','resume') then
  raise exception 'Ação de validação inválida.' using errcode='22023';
 end if;

 select * into d from public.vertice_avalia_drafts
  where id=p_draft and institution_id=p_institution and course_id=p_course and created_by=uid
  for update;
 if not found then
  raise exception 'Caderno do autor não localizado neste curso.' using errcode='P0002';
 end if;
 if p_expected_revision is distinct from d.revision then
  raise exception 'O caderno mudou (versão atual %). Reabra antes de prosseguir.', d.revision using errcode='40001';
 end if;

 if p_action='resume' then
  if d.status not in ('draft','submitted') then
   raise exception 'Este caderno não pode voltar à edição.' using errcode='23514';
  end if;
  if d.status='submitted' then
   update public.vertice_avalia_drafts set status='draft',updated_at=now(),updated_by=uid where id=d.id returning * into d;
  end if;
 else
  if d.status not in ('draft','submitted','validated') then
   raise exception 'Este caderno não está disponível para validação.' using errcode='23514';
  end if;
  if d.status<>'validated' then
   if coalesce(jsonb_array_length(d.snapshot->'questions'),0)=0 then
    raise exception 'Inclua ao menos uma questão para validar o caderno.' using errcode='23514';
   end if;
   blocking := vertice_private.avalia_blocking_issues(d.snapshot);
   if cardinality(blocking)>0 then
    raise exception 'Corrija os bloqueios do checklist antes de gerar: %', array_to_string(blocking,', ') using errcode='23514';
   end if;
   insert into public.vertice_avalia_reviews(draft_id,institution_id,course_id,revision,action,actor,justification,checklist)
   values(d.id,d.institution_id,d.course_id,d.revision,'validated',uid,
    'Validação técnica automática do sistema na versão salva do caderno.',
    jsonb_build_object('source','automatic','blocking',0));
   update public.vertice_avalia_drafts set status='validated',updated_at=now(),updated_by=uid where id=d.id returning * into d;
  end if;
 end if;

 return jsonb_build_object('id',d.id,'revision',d.revision,'status',d.status);
end $$;
revoke all on function public.vertice_avalia_automatic_validation(uuid,uuid,uuid,integer,text) from public,anon;
grant execute on function public.vertice_avalia_automatic_validation(uuid,uuid,uuid,integer,text) to authenticated;

notify pgrst, 'reload schema';
commit;
