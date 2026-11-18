-- Encaminha atividade validada à fila de AC, sem decisão, lançamento, crédito ou cópia de arquivo.
begin;

alter table public.vertice_ac_submissions
 add column teaching_activity_id uuid references public.vertice_teaching_activities(id) on delete restrict,
 add column teaching_participant_role text,
 add constraint teaching_ac_origin_pair check (
   (teaching_activity_id is null and teaching_participant_role is null)
    or (teaching_activity_id is not null and teaching_participant_role is not null
        and teaching_participant_role in ('participante','organizador'))
 );
create unique index teaching_ac_submission_once
 on public.vertice_ac_submissions(teaching_activity_id,student_id)
 where teaching_activity_id is not null;

-- Políticas RESTRICTIVE afinam o legado apenas para esta origem; não concedem nova leitura.
create policy teaching_ac_read_guard on public.vertice_ac_submissions as restrictive for select to public
 using (teaching_activity_id is null or exists(
  select 1 from public.vertice_teaching_activities a where a.id=teaching_activity_id
    and a.institution_id=vertice_ac_submissions.institution_id
    and vertice_private.teaching_access(a.institution_id,a.course_id,'validate')
 ));
create policy teaching_ac_insert_guard on public.vertice_ac_submissions as restrictive for insert to public with check (teaching_activity_id is null);
create policy teaching_ac_update_guard on public.vertice_ac_submissions as restrictive for update to public
 using (teaching_activity_id is null) with check (teaching_activity_id is null);
create policy teaching_ac_delete_guard on public.vertice_ac_submissions as restrictive for delete to public using (teaching_activity_id is null);

-- Não deixa o fluxo genérico inserir uma extração, decisão, cálculo, crédito ou duplicidade para a nova origem.
create function vertice_private.teaching_ac_is_legacy(p_submission uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.vertice_ac_submissions s where s.id=p_submission and s.teaching_activity_id is not null)
$$;
revoke all on function vertice_private.teaching_ac_is_legacy(uuid) from public,anon;
grant execute on function vertice_private.teaching_ac_is_legacy(uuid) to authenticated;

do $guard$
declare n text;
begin
 foreach n in array array['vertice_ac_extractions','vertice_ac_calculations','vertice_ac_decisions','vertice_ac_ledger_entries','vertice_ac_duplicate_checks']
 loop
   execute format('create policy teaching_ac_legacy_child_guard on public.%I as restrictive for all to public using (vertice_private.teaching_ac_is_legacy(submission_id)%s) with check (vertice_private.teaching_ac_is_legacy(submission_id)%s)',n,
     case when n='vertice_ac_duplicate_checks' then ' and vertice_private.teaching_ac_is_legacy(matched_submission_id)' else '' end,
     case when n='vertice_ac_duplicate_checks' then ' and vertice_private.teaching_ac_is_legacy(matched_submission_id)' else '' end);
 end loop;
end
$guard$;
create policy teaching_ac_audit_guard on public.vertice_ac_audit as restrictive for select to public
 using (aggregate_type<>'submission' or vertice_private.teaching_ac_is_legacy(aggregate_id));

-- O RPC de leitura não enumera discentes: exige a matrícula exata já conhecida do responsável.
-- A validação é reexecutada dentro da transação de envio; IDs não são aceitos do cliente.
create function vertice_private.teaching_ac_scope(p_institution uuid,p_course uuid,p_activity uuid,p_enrollment text)
returns table(activity_id uuid, student_id uuid, student_name text, rule_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare a public.vertice_teaching_activities; st public.vertice_student_registry; rr uuid; rules_found int;
begin
 if auth.uid() is null or not vertice_private.teaching_access(p_institution,p_course,'validate') then
  raise exception 'Encaminhamento restrito à gestão e à coordenação deste curso.' using errcode='42501';
 end if;
 if p_enrollment is null or length(btrim(p_enrollment)) not between 1 and 100 then
  raise exception 'Informe uma matrícula exata.' using errcode='22023';
 end if;
 select * into a from public.vertice_teaching_activities where id=p_activity and institution_id=p_institution
   and course_id=p_course and status='validada' and activity_date<=current_date;
 if not found or not exists (select 1 from public.vertice_documents d where d.id=a.evidence_doc_id and d.institution_id=p_institution
   and d.course_id=p_course and d.status in ('active','approved') and d.superseded_by is null
   and (d.expiry_date is null or d.expiry_date>=current_date)) then
  raise exception 'A atividade precisa estar realizada, validada e com evidência vigente deste curso.' using errcode='22023';
 end if;
 select * into st from public.vertice_student_registry r where r.institution_id=p_institution and r.course_id=p_course
   and r.enrollment_code=btrim(p_enrollment) and r.academic_status='active' and r.verified;
 if not found or st.curriculum_version is null or length(btrim(st.curriculum_version))=0 then
  raise exception 'Matrícula ativa e verificada com matriz curricular não localizada neste curso.' using errcode='22023';
 end if;
 select (array_agg(r.id))[1], count(*) into rr,rules_found from public.vertice_ac_rules r
 where r.institution_id=p_institution and r.course_id=p_course and r.curriculum_version=st.curriculum_version
  and r.is_active and r.approved_at is not null and r.effective_from<=a.activity_date and
    (r.effective_until is null or r.effective_until>=a.activity_date);
 if rules_found<>1 then
  raise exception 'Não há regulamento aprovado e inequívoco para a matriz nesta data.' using errcode='22023';
 end if;
 return query select a.id,st.id,st.full_name,rr;
end $$;
revoke all on function vertice_private.teaching_ac_scope(uuid,uuid,uuid,text) from public,anon,authenticated;

create function public.vertice_teaching_ac_options(p_institution uuid,p_course uuid,p_activity uuid,p_enrollment text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('student_name',q.student_name,'categories',
  coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'label',c.label) order by c.sort_order,c.label,c.id)
    from public.vertice_ac_categories c where c.institution_id=p_institution and c.rule_id=q.rule_id),'[]'::jsonb))
 from vertice_private.teaching_ac_scope(p_institution,p_course,p_activity,p_enrollment) q
$$;
revoke all on function public.vertice_teaching_ac_options(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.vertice_teaching_ac_options(uuid,uuid,uuid,text) to authenticated;

create function public.vertice_teaching_ac_forward(
 p_institution uuid,p_course uuid,p_activity uuid,p_enrollment text,
 p_category uuid,p_participant_role text,p_minutes integer,p_attested boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.vertice_teaching_activities; q record; target_id uuid;
begin
 if auth.uid() is null or not vertice_private.teaching_access(p_institution,p_course,'validate') then
  raise exception 'Encaminhamento restrito à gestão e à coordenação deste curso.' using errcode='42501';
 end if;
 if p_attested is distinct from true or p_minutes is null or p_minutes not between 1 and 60000
  or p_participant_role is null or p_participant_role not in ('participante','organizador') or p_category is null then
  raise exception 'Confirme a participação na evidência e informe a carga documental e a categoria.' using errcode='22023';
 end if;
 -- Bloqueia alteração do vínculo documental durante a confirmação.
 select * into a from public.vertice_teaching_activities where id=p_activity and institution_id=p_institution and course_id=p_course for share;
 select * into q from vertice_private.teaching_ac_scope(p_institution,p_course,p_activity,p_enrollment);
 perform 1 from public.vertice_documents d where d.id=a.evidence_doc_id and d.institution_id=p_institution and d.course_id=p_course
    and d.status in ('active','approved') and d.superseded_by is null and (d.expiry_date is null or d.expiry_date>=current_date) for share;
 if not found then raise exception 'Evidência indisponível nesta atividade.' using errcode='22023';end if;
 perform 1 from public.vertice_student_registry s where s.id=q.student_id and s.institution_id=p_institution and s.course_id=p_course and s.academic_status='active'
    and s.verified and s.enrollment_code=btrim(p_enrollment) for share;
 if not found then raise exception 'Matrícula indisponível nesta atividade.' using errcode='22023';end if;
 perform 1 from public.vertice_ac_rules r join public.vertice_student_registry s on s.id=q.student_id
   where r.id=q.rule_id and r.institution_id=p_institution and r.course_id=p_course and r.curriculum_version=s.curriculum_version
     and r.is_active and r.approved_at is not null and r.effective_from<=a.activity_date
     and (r.effective_until is null or r.effective_until>=a.activity_date) for share of r;
 if not found then raise exception 'O regulamento mudou; confira os dados novamente.' using errcode='22023';end if;
 perform 1 from public.vertice_ac_categories c where c.id=p_category and c.institution_id=p_institution and c.rule_id=q.rule_id for share;
 if not found then raise exception 'Categoria incompatível com o regulamento deste estudante.' using errcode='22023';end if;
 insert into public.vertice_ac_submissions(
  institution_id, student_id, rule_id, category_id, title, start_date, end_date, documentary_minutes, document_id, status,
  teaching_activity_id, teaching_participant_role
 ) values (
  p_institution,q.student_id,q.rule_id,p_category,a.title,a.activity_date,a.activity_date,p_minutes,a.evidence_doc_id,'submitted',
  p_activity,p_participant_role
 ) on conflict (teaching_activity_id,student_id) where teaching_activity_id is not null do nothing
 returning id into target_id;
 if target_id is null then
   select s.id into strict target_id from public.vertice_ac_submissions s
    where s.teaching_activity_id=p_activity and s.student_id=q.student_id and s.institution_id=p_institution;
   return jsonb_build_object('id',target_id,'already_forwarded',true);
 end if;
 return jsonb_build_object('id',target_id,'already_forwarded',false);
end $$;
revoke all on function public.vertice_teaching_ac_forward(uuid,uuid,uuid,text,uuid,text,integer,boolean) from public,anon;
grant execute on function public.vertice_teaching_ac_forward(uuid,uuid,uuid,text,uuid,text,integer,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
