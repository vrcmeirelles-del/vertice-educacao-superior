begin;
-- Neutral, institution-specific templates; no historical project data are imported.
insert into public.vertice_doc_categories(code,label,tier,linked_module,linked_tab,sort_order)
values ('EXT_RELATORIO','Extensão - Projeto e relatório final','superior','ACAD_EXTENSAO','extensao',109),
       ('EXT_ANEXO','Extensão - Comprovantes e anexos','superior','ACAD_EXTENSAO','extensao',110)
on conflict(code) do nothing;

create table public.vertice_extension_forms (
 id uuid primary key,
 institution_id uuid not null references public.vertice_institutions(id),
 project_id uuid not null unique references public.vertice_extension_projects(id),
 course_id uuid not null references public.vertice_courses(id),
 template text not null check(template in ('ensino','acao_social','extensao')),
 template_version integer not null default 1,
 answers jsonb not null default '{}' check(jsonb_typeof(answers)='object'),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array'),
 revision integer not null default 1,
 owner_id uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 status text not null default 'rascunho' check(status in ('rascunho','concluido')),
 document_id uuid references public.vertice_documents(id),
 repository_file_id uuid references public.vertice_repository_files(id),
 repository_request_id uuid not null references public.vertice_repository_requests(id),
 completed_by uuid references auth.users(id),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status<>'concluido' or (document_id is not null and completed_by is not null and completed_at is not null))
);
alter table public.vertice_extension_forms enable row level security;
create index extension_forms_institution_idx on public.vertice_extension_forms(institution_id);
create policy extension_forms_read on public.vertice_extension_forms for select to authenticated
using(vertice_private.can_read_institution(institution_id));
revoke all on public.vertice_extension_forms from public,anon,authenticated;
grant select on public.vertice_extension_forms to authenticated;

-- The only write entry point. Ownership, tenant, revision and completion are checked
-- inside a row lock; clients cannot mark a form completed with a direct table write.
create function vertice_private.extension_form_write(
 p_id uuid,p_institution uuid,p_course uuid,p_template text,p_answers jsonb,
 p_attachments jsonb,p_revision integer,p_pdf jsonb default null
) returns public.vertice_extension_forms
language plpgsql security definer set search_path='' as $$
declare
 f public.vertice_extension_forms; a jsonb; k text; doc uuid; annexdoc uuid;
 request_id uuid; repository_file uuid;
 size_total bigint:=0; inst_name text; course_name text; path_prefix text;
 required_keys text[]:=array['title','responsible','email','semester','start_date','end_date','hours','location','audience','justification','general_objective','specific_objectives','methodology','program','expected_results','evaluation','attendance','execution','applied_methodology','results','difficulties','final_evaluation','recommendations','conclusion','students_actual','faculty_actual','staff_actual','community_actual','hours_actual','investment_actual'];
 numeric_keys text[]:=array['hours','budget','approved_budget','students_planned','faculty_planned','staff_planned','community_planned','students_actual','faculty_actual','staff_actual','community_actual','entities_actual','services_actual','donations_actual','partners_actual','hours_actual','investment_actual'];
begin
 if auth.uid() is null or not coalesce(vertice_private.can_read_institution(p_institution),false)
 or not coalesce(vertice_private.has_role(p_institution,array['gestor','equipe']),false) then
  raise exception 'Acesso de edição não autorizado. Verifique a instituição e a autenticação de dois fatores.' using errcode='42501';
 end if;
 -- Serializes creation/retries for the same id as well as subsequent saves.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into f from public.vertice_extension_forms where id=p_id for update;
 if found then
  if f.institution_id<>p_institution or (f.owner_id<>auth.uid() and not vertice_private.has_role(p_institution,array['gestor'])) then
   raise exception 'Somente o responsável ou gestor pode editar este formulário.' using errcode='42501';
  end if;
  if f.status='concluido' then
   if p_pdf is not null then return f; end if;
   raise exception 'Projeto concluído: o registro e o PDF foram preservados.';
  end if;
  if f.revision<>p_revision then raise exception 'O formulário foi alterado em outra sessão. Recarregue antes de salvar.' using errcode='40001'; end if;
 elsif p_revision<>0 or p_pdf is not null then
  raise exception 'Salve o rascunho antes de concluir.';
 end if;
 if p_template not in ('ensino','acao_social','extensao') or jsonb_typeof(p_answers)<>'object' or length(trim(coalesce(p_answers->>'title','')))=0
 or jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>20 or octet_length(p_answers::text)>250000 then
  raise exception 'Formulário inválido ou acima do limite.';
 end if;
 select name into inst_name from public.vertice_institutions where id=p_institution;
 select name into course_name from public.vertice_courses where id=p_course and institution_id=p_institution;
 if course_name is null then raise exception 'Selecione um curso desta instituição.'; end if;
 path_prefix:=p_institution::text||'/extensao/'||p_id::text||'/';
 for a in select value from jsonb_array_elements(p_attachments) loop
  if coalesce(a->>'path','') not like path_prefix||'%' or (a->>'path') like '%..%'
   or coalesce(a->>'mime','') not in ('application/pdf','image/png','image/jpeg')
   or coalesce(a->>'sha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(a->>'size','') !~ '^[0-9]+$' then raise exception 'Anexo inválido.'; end if;
  if (a->>'size')::bigint not between 1 and 5242880 or not exists(
   select 1 from storage.objects o where o.bucket_id='vertice-documents' and o.name=a->>'path'
    and (o.metadata->>'size')::bigint=(a->>'size')::bigint
  ) then raise exception 'Anexo não encontrado ou tamanho divergente.'; end if;
  size_total:=size_total+(a->>'size')::bigint;
 end loop;
 if size_total>20971520 then raise exception 'Os anexos devem somar no máximo 20 MB.'; end if;
 for k in select jsonb_object_keys(p_answers) loop
  if jsonb_typeof(p_answers->k)<>'string' then raise exception 'Os campos devem conter texto.'; end if;
 end loop;
 for k in select unnest(numeric_keys) loop
  if coalesce(p_answers->>k,'')<>'' and ((p_answers->>k) !~ '^[0-9]+(\.[0-9]+)?$' or length(p_answers->>k)>12) then
   raise exception 'Número inválido no campo %.',k;
  end if;
 end loop;
 for k in select unnest(array['students_planned','faculty_planned','staff_planned','community_planned','students_actual','faculty_actual','staff_actual','community_actual','entities_actual','services_actual','donations_actual','partners_actual']) loop
  if coalesce(p_answers->>k,'')<>'' and (p_answers->>k)::numeric<>trunc((p_answers->>k)::numeric) then raise exception 'Use um número inteiro no campo %.',k; end if;
 end loop;
 if p_pdf is not null then
  -- Finalize exactly the snapshot used to render the PDF, never unsaved browser state.
  if f.answers<>p_answers or f.attachments<>p_attachments or f.course_id<>p_course or f.template<>p_template then raise exception 'Salve as alterações antes de gerar o PDF.'; end if;
  foreach k in array required_keys loop
   if length(trim(coalesce(p_answers->>k,'')))=0 then raise exception 'Campo obrigatório não preenchido: %.',k; end if;
  end loop;
  if p_template='extensao' and length(trim(coalesce(p_answers->>'area_characterization','')))=0 then raise exception 'Preencha a caracterização da área.'; end if;
  if (p_answers->>'end_date')::date<(p_answers->>'start_date')::date or (p_answers->>'hours')::numeric<=0 then raise exception 'Período ou carga horária inválidos.'; end if;
  if p_answers->>'semester' !~ '^[0-9]{4}[-/][12]$' then raise exception 'Use o semestre no formato AAAA/1 ou AAAA/2.'; end if;
  if p_answers->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido.'; end if;
  if jsonb_array_length(p_attachments)=0 then raise exception 'Anexe ao menos um comprovante da execução.'; end if;
  if coalesce(p_pdf->>'path','') not like path_prefix||'%' or (p_pdf->>'path') like '%..%'
   or coalesce(p_pdf->>'sha256','') !~ '^[0-9a-f]{64}$' or coalesce(p_pdf->>'size','') !~ '^[0-9]+$' then raise exception 'PDF inválido.'; end if;
  if (p_pdf->>'size')::bigint not between 1 and 31457280 or not exists(
   select 1 from storage.objects o where o.bucket_id='vertice-documents' and o.name=p_pdf->>'path'
    and (o.metadata->>'size')::bigint=(p_pdf->>'size')::bigint and o.metadata->>'mimetype'='application/pdf'
  ) then raise exception 'PDF não localizado no armazenamento.'; end if;
  repository_file:=(p_pdf->>'repository_file_id')::uuid;
  request_id:=f.repository_request_id;
  if repository_file is null or coalesce(p_pdf->>'repository_path','')<>p_institution::text||'/'||request_id::text||'/'||repository_file::text||'.pdf' or not exists(
   select 1 from storage.objects o where o.bucket_id='vertice-repositorios' and o.name=p_pdf->>'repository_path'
    and o.owner_id=auth.uid()::text and (o.metadata->>'size')::bigint=(p_pdf->>'size')::bigint and o.metadata->>'mimetype'='application/pdf'
  ) then raise exception 'PDF não localizado no repositório da Mesa Digital.'; end if;
  insert into public.vertice_repository_files(id,institution_id,request_id,storage_path,file_name,size_bytes,mime_type,uploaded_by,status,document_category,upload_note)
  values(repository_file,p_institution,request_id,p_pdf->>'repository_path','extensao-'||p_id||'.pdf',(p_pdf->>'size')::bigint,'application/pdf',auth.uid(),'enviado','nao_classificado',
   'Protocolo '||p_id||' | SHA-256 '||(p_pdf->>'sha256')||' | Validação institucional pendente.');
  insert into public.vertice_documents(institution_id,category_code,title,description,storage_path,file_name,file_size,mime_type,sha256,course_id,tags,linked_module,linked_entity_type,linked_entity_id,uploaded_by,ai_status)
  values(p_institution,'EXT_RELATORIO',p_answers->>'title',
   'Mesa Digital / Extensão / '||course_name||' | Protocolo '||p_id||' | Revisão '||f.revision||' | Validação institucional pendente.',
   p_pdf->>'path','extensao-'||p_id||'.pdf',(p_pdf->>'size')::bigint,'application/pdf',p_pdf->>'sha256',p_course,
   array['Extensão','Relatório final',p_answers->>'semester'],'ACAD_EXTENSAO','extension_project',f.project_id,auth.uid(),'pending') returning id into doc;
  for a in select value from jsonb_array_elements(p_attachments) loop
   insert into public.vertice_documents(institution_id,category_code,title,description,storage_path,file_name,file_size,mime_type,sha256,course_id,linked_module,linked_entity_type,linked_entity_id,uploaded_by,ai_status)
   values(p_institution,'EXT_ANEXO',a->>'name','Original de anexo | Protocolo '||p_id||' | '||(a->>'kind'),a->>'path',a->>'name',(a->>'size')::bigint,a->>'mime',a->>'sha256',p_course,'ACAD_EXTENSAO','extension_project',f.project_id,auth.uid(),'pending') returning id into annexdoc;
  end loop;
  insert into public.vertice_extension_deliverables(institution_id,project_id,title,deliverable_type,document_id,delivered_at)
  values(p_institution,f.project_id,'Projeto e relatório final - formulário eletrônico','relatorio_final',doc,current_date);
  update public.vertice_extension_projects set status='concluido',review_status='pendente',completed_at=now(),evidence_pdf_path=p_pdf->>'path',updated_at=now() where id=f.project_id;
  update public.vertice_extension_forms set status='concluido',document_id=doc,repository_file_id=repository_file,completed_by=auth.uid(),completed_at=now(),updated_at=now(),updated_by=auth.uid() where id=p_id returning * into f;
 else
  if f.id is null then
   insert into public.vertice_repository_requests(institution_id,course_id,title,document_code,semester,instructions,assigned_to,created_by,repository_section)
   values(p_institution,p_course,left('Extensão - '||(p_answers->>'title'),500),'EXT-RELATORIO',case when p_answers->>'semester' ~ '^[0-9]{4}[-/][12]$' then p_answers->>'semester' else null end,
    'Dossiê de execução. Conferir anexos e classificar nos indicadores aplicáveis após revisão humana.',auth.uid(),auth.uid(),'nao_classificado') returning id into request_id;
   insert into public.vertice_extension_projects(id,institution_id,title,course_ids,coordinator_name,coordinator_email,status,review_status)
   values(p_id,p_institution,p_answers->>'title',array[p_course],p_answers->>'responsible',p_answers->>'email','planejamento','rascunho');
   insert into public.vertice_extension_forms(id,institution_id,project_id,course_id,template,answers,attachments,owner_id,updated_by,repository_request_id)
   values(p_id,p_institution,p_id,p_course,p_template,p_answers,p_attachments,auth.uid(),auth.uid(),request_id) returning * into f;
  else
   update public.vertice_extension_forms set course_id=p_course,template=p_template,answers=p_answers,attachments=p_attachments,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into f;
  end if;
  update public.vertice_repository_requests set title=left('Extensão - '||(p_answers->>'title'),500),course_id=p_course,
   semester=case when p_answers->>'semester' ~ '^[0-9]{4}[-/][12]$' then p_answers->>'semester' else null end
  where id=f.repository_request_id;
  update public.vertice_extension_projects set title=p_answers->>'title',course_ids=array[p_course],coordinator_name=p_answers->>'responsible',coordinator_email=p_answers->>'email',semester=p_answers->>'semester',
   total_hours=nullif(p_answers->>'hours','')::numeric,budget_estimated=nullif(p_answers->>'budget','')::numeric,budget_executed=nullif(p_answers->>'investment_actual','')::numeric,start_date=nullif(p_answers->>'start_date','')::date,end_date=nullif(p_answers->>'end_date','')::date,
   description=p_answers->>'introduction',social_problem=p_answers->>'justification',general_objective=p_answers->>'general_objective',methodology=p_answers->>'methodology',target_community=p_answers->>'audience',updated_at=now()
  where id=f.project_id;
 end if;
 return f;
end $$;
revoke all on function vertice_private.extension_form_write(uuid,uuid,uuid,text,jsonb,jsonb,integer,jsonb) from public,anon;
grant execute on function vertice_private.extension_form_write(uuid,uuid,uuid,text,jsonb,jsonb,integer,jsonb) to authenticated;
create function public.vertice_extension_form_save(p_id uuid,p_institution uuid,p_course uuid,p_template text,p_answers jsonb,p_attachments jsonb,p_revision integer,p_pdf jsonb default null)
returns public.vertice_extension_forms language sql security invoker set search_path='' as $$
 select vertice_private.extension_form_write(p_id,p_institution,p_course,p_template,p_answers,p_attachments,p_revision,p_pdf);
$$;
revoke all on function public.vertice_extension_form_save(uuid,uuid,uuid,text,jsonb,jsonb,integer,jsonb) from public,anon;
grant execute on function public.vertice_extension_form_save(uuid,uuid,uuid,text,jsonb,jsonb,integer,jsonb) to authenticated;
commit;
