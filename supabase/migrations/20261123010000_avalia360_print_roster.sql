-- Avalia 360°: seleção nominal pela base ou planilha da aplicação.
begin;

alter table public.vertice_avalia_issued_papers add column student_enrollment text;
alter table public.vertice_avalia_issued_papers add constraint avalia_paper_enrollment_check
 check (student_enrollment is null or length(btrim(student_enrollment)) between 1 and 120);

create function public.vertice_avalia_print_roster(p_institution uuid,p_course uuid,p_discipline text,p_class text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare period smallint;
begin
 if auth.uid() is null or vertice_private.avalia_access(p_institution,p_course,'record') is not true then
  raise exception 'Lista da turma restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if vertice_private.avalia_discipline(p_discipline) is null then raise exception 'Informe a disciplina.' using errcode='22023'; end if;
 period := nullif(substring(coalesce(p_class,'') from '(\d{1,2})'),'')::smallint;
 if period is null or period not between 1 and 20 then
  raise exception 'Informe a turma pelo período (ex.: 3 ou 3º período).' using errcode='22023';
 end if;
 return jsonb_build_object('registrationVerified',false,'students',coalesce((
  select jsonb_agg(jsonb_build_object('id',s.id,'name',s.full_name,'registration',btrim(s.enrollment_code),'verified',s.verified) order by lower(s.full_name),s.id)
  from public.vertice_student_registry s
  where s.institution_id=p_institution and s.course_id=p_course and s.academic_status='active' and nullif(btrim(s.enrollment_code),'') is not null
    and s.current_semester=period),'[]'::jsonb));
end $$;
revoke all on function public.vertice_avalia_print_roster(uuid,uuid,text,text) from public,anon;
grant execute on function public.vertice_avalia_print_roster(uuid,uuid,text,text) to authenticated;

create or replace function vertice_private.avalia_paper_json(p public.vertice_avalia_issued_papers) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('paperId',p.id,'applicationId',p.application_id,'shortCode',p.short_code,'variant',p.variant,
  'studentId',p.student_id,'label',coalesce(st.full_name,p.student_label),'enrollment',coalesce(p.student_enrollment,st.enrollment_code),
  'status',p.status,'issuedAt',p.issued_at,'sheetId',p.sheet_id,
  'sheet',(select jsonb_build_object('total',s.total_score,'max',s.max_score,'updatedAt',s.updated_at,
     'items',(select jsonb_agg(jsonb_build_object('q',i.question_id,'n',i.display_number,'kind',i.kind,'mark',i.chosen_label,
        'outcome',i.outcome,'score',i.score,'max',i.max_score) order by i.display_number)
      from public.vertice_avalia_item_scores i where i.sheet_id=s.id))
   from public.vertice_avalia_sheets s where s.id=p.sheet_id))
 from (select 1) one left join public.vertice_student_registry st on st.id=p.student_id
$$;

create or replace function public.vertice_avalia_papers(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 a public.vertice_avalia_applications; d public.vertice_avalia_drafts; p public.vertice_avalia_issued_papers;
 row_in jsonb; sid uuid; skey text; label text; variant text; token text; code text; out jsonb := '[]'::jsonb;
 sheet uuid; tries integer;
 registration text; official_name text; matching_students uuid[]; seen_keys text[] := '{}';
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Cadernos restritos à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;
 if p_action not in ('issue','list','scan','save','void') then raise exception 'Ação inválida.' using errcode='22023'; end if;

 -- Leitura do QR: o token identifica o caderno; o acesso é conferido pela aplicação.
 if p_action='scan' then
  code := upper(regexp_replace(coalesce(p_payload->>'code',''),'\s',''));
  if code ~ '^VA360:2:[0-9A-F]{64}$' then code := substr(code,9); end if;
  if code ~ '^[0-9A-F]{64}$' then
   select * into p from public.vertice_avalia_issued_papers x where x.token_hash=vertice_private.avalia_token_hash(lower(code));
  elsif code ~ '^[A-HJ-NP-Z2-9]{8}$' and nullif(p_payload->>'applicationId','') is not null then
   select * into p from public.vertice_avalia_issued_papers x where x.short_code=code and x.application_id::text=p_payload->>'applicationId';
  elsif code like 'VA360-DEMO:%' then
   raise exception 'Este QR é de demonstração e não está registrado. Gere os cadernos pela aplicação.' using errcode='22023';
  else
   raise exception 'Código não reconhecido. Leia o QR do caderno ou digite o código de 8 caracteres.' using errcode='22023';
  end if;
  if p.id is null then raise exception 'Caderno não localizado.' using errcode='P0002'; end if;
  a := vertice_private.avalia_application_reader(p.application_id,false);
  if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Caderno não localizado.' using errcode='P0002'; end if;
  if p.status='voided' then raise exception 'Caderno substituído por reimpressão. Use o caderno mais recente deste aluno.' using errcode='23514'; end if;
  return vertice_private.avalia_paper_json(p)||jsonb_build_object('applicationStatus',a.status);
 end if;

 if p_action in ('save','void') then
  select * into p from public.vertice_avalia_issued_papers x where x.id::text=p_payload->>'paperId';
  if p.id is null then raise exception 'Caderno não localizado.' using errcode='P0002'; end if;
  if p_action='save' then
   a := vertice_private.avalia_application_reader(p.application_id,true);
  else
   a := vertice_private.avalia_application_access(p.application_id,true);
  end if;
 elsif p_action='list' then
  a := vertice_private.avalia_application_reader(nullif(p_payload->>'applicationId','')::uuid,false);
 else
  a := vertice_private.avalia_application_access(nullif(p_payload->>'applicationId','')::uuid,true);
 end if;
 if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Aplicação não localizada.' using errcode='P0002'; end if;

 if p_action='list' then
  return coalesce((select jsonb_agg(vertice_private.avalia_paper_json(x) order by lower(coalesce(st.full_name,x.student_label)), x.issued_at)
   from public.vertice_avalia_issued_papers x left join public.vertice_student_registry st on st.id=x.student_id
   where x.application_id=a.id and (x.status='issued' or coalesce((p_payload->>'includeVoided')::boolean,false))),'[]'::jsonb);
 end if;

 if p_action='void' then
  if p.status='voided' then raise exception 'Caderno já anulado.' using errcode='23514'; end if;
  update public.vertice_avalia_issued_papers set status='voided',voided_at=now() where id=p.id returning * into p;
  return vertice_private.avalia_paper_json(p);
 end if;

 if p_action='issue' then
  if jsonb_typeof(p_payload->'papers') is distinct from 'array' or jsonb_array_length(p_payload->'papers') not between 1 and 400 then
   raise exception 'Emita entre 1 e 400 cadernos por vez.' using errcode='22023';
  end if;
  for row_in in select value from jsonb_array_elements(p_payload->'papers') loop
   variant := upper(btrim(coalesce(row_in->>'variant','')));
   if not (a.variant_map ? variant) then raise exception 'Versão "%" não existe nesta aplicação.', variant using errcode='22023'; end if;
   sid := null; official_name := null;
   registration := nullif(btrim(row_in->>'registration'),'');
   label := nullif(btrim(row_in->>'label'),'');
   if nullif(row_in->>'studentId','') is not null then
    select s.id,s.full_name,nullif(btrim(s.enrollment_code),'') into sid,official_name,registration
    from public.vertice_student_registry s
    where s.id::text=row_in->>'studentId' and s.institution_id=a.institution_id and s.course_id=a.course_id;
    if sid is null then raise exception 'Aluno fora do cadastro deste curso.' using errcode='22023'; end if;
   elsif registration is not null then
    if registration !~ '^[A-Za-z0-9][A-Za-z0-9./_-]{0,63}$' or label is null or length(label)>120 then
     raise exception 'Informe nome completo e matrícula válida em cada linha da planilha.' using errcode='22023';
    end if;
    select array_agg(s.id) into matching_students from public.vertice_student_registry s
     where s.institution_id=a.institution_id and s.course_id=a.course_id and s.academic_status='active'
       and lower(btrim(s.enrollment_code))=lower(registration);
    if cardinality(matching_students)>1 then
     raise exception 'A matrícula % está duplicada na base deste curso.',registration using errcode='22023';
    end if;
    sid := matching_students[1];
    if sid is not null then
     select s.full_name,btrim(s.enrollment_code) into official_name,registration from public.vertice_student_registry s where s.id=sid;
     if lower(regexp_replace(btrim(official_name),'\s+',' ','g'))<>lower(regexp_replace(label,'\s+',' ','g')) then
      raise exception 'O nome da matrícula % difere da base. Confira a planilha ou selecione o aluno pela busca.',registration using errcode='22023';
     end if;
    end if;
   end if;
   if sid is not null then
    -- Uma matrícula já emitida pela planilha conserva a identidade desta aplicação.
    if registration is not null and exists (
     select 1 from public.vertice_avalia_issued_papers x
      where x.application_id=a.id and x.student_key='enrollment:'||lower(registration)
    ) then
     sid := null;
     label := left(official_name,120);
    else
     label := null;
    end if;
   end if;
   if sid is not null then
    skey := sid::text;
   elsif registration is not null then
    skey := 'enrollment:'||lower(registration);
   else
    label := left(label,120);
    if label is null then raise exception 'Identifique cada caderno (aluno do cadastro ou código).' using errcode='22023'; end if;
    skey := 'label:'||lower(label);
   end if;
   if skey=any(seen_keys) then raise exception 'Há aluno repetido neste lote.' using errcode='22023'; end if;
   seen_keys := array_append(seen_keys,skey);
   -- Reimpressão: o caderno anterior do mesmo aluno deixa de valer.
   update public.vertice_avalia_issued_papers set status='voided',voided_at=now()
    where application_id=a.id and student_key=skey and status='issued';
   token := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   tries := 0;
   loop
    code := vertice_private.avalia_short_code();
    exit when not exists(select 1 from public.vertice_avalia_issued_papers x where x.application_id=a.id and x.short_code=code);
    tries := tries+1; if tries>20 then raise exception 'Não foi possível gerar código único.' using errcode='P0001'; end if;
   end loop;
   insert into public.vertice_avalia_issued_papers(application_id,token_hash,short_code,variant,student_id,student_label,student_enrollment,student_key,issued_by,sheet_id)
   values(a.id,vertice_private.avalia_token_hash(token),code,variant,sid,label,registration,skey,uid,
    (select s.id from public.vertice_avalia_sheets s where s.application_id=a.id and s.student_key=skey))
   returning * into p;
   -- O token só é devolvido aqui, uma vez, para ir no QR impresso.
   out := out || jsonb_build_array(vertice_private.avalia_paper_json(p)||jsonb_build_object('token',token,'qr','VA360:2:'||upper(token)));
  end loop;
  return out;
 end if;

 -- save: aluno e versão vêm do caderno registrado.
 if p.status='voided' then raise exception 'Caderno substituído por reimpressão.' using errcode='23514'; end if;
 if (jsonb_typeof(coalesce(p_payload->'objective','{}'::jsonb))<>'object') or (jsonb_typeof(coalesce(p_payload->'discursive','{}'::jsonb))<>'object') then
  raise exception 'Respostas em formato inválido.' using errcode='22023';
 end if;
 d.snapshot := (select v.snapshot from public.vertice_avalia_draft_revisions v where v.draft_id=a.draft_id and v.revision=a.revision);
 insert into public.vertice_avalia_sheets(application_id,student_id,student_label,student_key,variant,total_score,max_score,entered_by)
 values(a.id,p.student_id,case when p.student_id is null then p.student_label end,p.student_key,p.variant,0,0,uid)
 on conflict (application_id,student_key) do update set variant=excluded.variant,entered_by=uid,updated_at=now()
 returning id into sheet;
 perform vertice_private.avalia_score_sheet(sheet,a,d.snapshot,p.variant,coalesce(p_payload->'objective','{}'::jsonb),coalesce(p_payload->'discursive','{}'::jsonb));
 update public.vertice_avalia_issued_papers set sheet_id=sheet where id=p.id returning * into p;
 return vertice_private.avalia_paper_json(p);
end $$;

notify pgrst, 'reload schema';
commit;
