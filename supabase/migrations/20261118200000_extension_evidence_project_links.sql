begin;

create table public.vertice_extension_evidence_project_links (
  project_id uuid not null references public.vertice_extension_projects(id),
  evidence_id uuid not null references public.vertice_extension_evidence_registry(id),
  institution_id uuid not null references public.vertice_institutions(id),
  linked_by uuid default auth.uid() references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key (project_id, evidence_id)
);
create index on public.vertice_extension_evidence_project_links(evidence_id);

alter table public.vertice_extension_evidence_project_links enable row level security;
revoke all on public.vertice_extension_evidence_project_links from public, anon, authenticated;
grant select on public.vertice_extension_evidence_project_links to authenticated;
create policy extension_evidence_project_links_read
  on public.vertice_extension_evidence_project_links for select to authenticated
  using (vertice_private.can_read_institution(institution_id));

-- Original project assignments remain valid, including references in older reports.
create view public.vertice_extension_project_evidence with (security_invoker = true) as
  select e.*, e.project_id as target_project_id
  from public.vertice_extension_evidence_registry e
  where e.project_id is not null
  union all
  select e.*, l.project_id as target_project_id
  from public.vertice_extension_evidence_registry e
  join public.vertice_extension_evidence_project_links l
    on l.evidence_id=e.id and l.institution_id=e.institution_id
  where e.project_id is distinct from l.project_id;
revoke all on public.vertice_extension_project_evidence from public, anon, authenticated;
grant select on public.vertice_extension_project_evidence to authenticated;

create function public.vertice_extension_link_evidence(p_project uuid, p_evidence uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  project public.vertice_extension_projects;
  evidence public.vertice_extension_evidence_registry;
begin
  select * into project from public.vertice_extension_projects
    where id=p_project and deleted_at is null for update;
  if not found or not coalesce(vertice_private.extension_project_manager(project),false) then
    raise exception 'Somente o responsável ou gestor pode vincular evidências ao projeto.' using errcode='42501';
  end if;
  select * into evidence from public.vertice_extension_evidence_registry
    where id=p_evidence and institution_id=project.institution_id for share;
  if not found then
    raise exception 'Evidência indisponível nesta instituição.' using errcode='42501';
  end if;
  if evidence.project_id=p_project then return; end if;
  if evidence.is_current is not true or evidence.student_id is not null then
    raise exception 'Esta evidência não está disponível para compartilhamento.' using errcode='42501';
  end if;

  insert into public.vertice_extension_evidence_project_links(project_id,evidence_id,institution_id)
    values(project.id,evidence.id,project.institution_id)
    on conflict (project_id,evidence_id) do nothing;
end $$;
revoke all on function public.vertice_extension_link_evidence(uuid,uuid) from public,anon;
grant execute on function public.vertice_extension_link_evidence(uuid,uuid) to authenticated;

create or replace function vertice_private.extension_form_write(
 p_id uuid,p_institution uuid,p_course uuid,p_template text,p_answers jsonb,
 p_attachments jsonb,p_revision integer,p_pdf jsonb default null
) returns public.vertice_extension_forms
language plpgsql security definer set search_path='' as $$
declare
 f public.vertice_extension_forms; project public.vertice_extension_projects; a jsonb; k text; doc uuid; annexdoc uuid;
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
 select * into project from public.vertice_extension_projects where id=p_id for update;
 if found and (project.institution_id<>p_institution or project.deleted_at is not null) then
  raise exception 'Projeto indisponível.' using errcode='42501';
 end if;
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
 elsif project.id is not null and not vertice_private.extension_project_manager(project) then
  raise exception 'Somente o responsável ou gestor pode vincular o formulário.' using errcode='42501';
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
 if project.id is not null and coalesce(cardinality(project.course_ids),0)>0 and not (p_course=any(project.course_ids)) then
  raise exception 'Selecione um curso vinculado ao projeto.';
 end if;
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
 if exists(
   select 1 from regexp_split_to_table(coalesce(nullif(p_answers->>'evidence_ids',''),''),',') as reference(value)
   where value<>'' and not exists(select 1 from public.vertice_extension_project_evidence e
    where e.id::text=value and e.target_project_id=p_id and e.institution_id=p_institution)
 ) then raise exception 'Evidência fora do projeto.'; end if;
 if nullif(p_answers->>'evidence_links','') is not null and exists(
   select 1 from regexp_split_to_table(p_answers->>'evidence_links',E'\n') as link(value)
   where value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [|] .+ [|] https?://[^[:space:]]+$'
 ) then raise exception 'Cada link de evidência exige data, descrição e endereço HTTP ou HTTPS.'; end if;
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
  if jsonb_array_length(p_attachments)=0
   and coalesce(p_answers->>'evidence_ids','')=''
   and coalesce(p_answers->>'evidence_links','')='' then
   raise exception 'Registre ao menos um comprovante da execução.';
  end if;
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
  update public.vertice_extension_projects set first_submitted_at=coalesce(first_submitted_at,now()),status='concluido',
   review_status=case when status='concluido' then review_status
    when review_status in ('em_execucao','aguardando_evidencias','em_avaliacao') then 'em_avaliacao' else 'pendente' end,
   completed_at=coalesce(completed_at,now()),evidence_pdf_path=coalesce(evidence_pdf_path,p_pdf->>'path'),updated_at=now() where id=f.project_id;
  insert into public.vertice_extension_project_history(institution_id,project_id,field_changed,new_value,changed_by)
  values(p_institution,f.project_id,'relatorio_final','enviado',auth.uid());
  update public.vertice_extension_forms set status='concluido',document_id=doc,repository_file_id=repository_file,completed_by=auth.uid(),completed_at=now(),updated_at=now(),updated_by=auth.uid() where id=p_id returning * into f;
 else
  if f.id is null then
   insert into public.vertice_repository_requests(institution_id,course_id,title,document_code,semester,instructions,assigned_to,created_by,repository_section)
   values(p_institution,p_course,left('Extensão - '||(p_answers->>'title'),500),'EXT-RELATORIO',case when p_answers->>'semester' ~ '^[0-9]{4}[-/][12]$' then p_answers->>'semester' else null end,
    'Dossiê de execução. Conferir anexos e classificar nos indicadores aplicáveis após revisão humana.',auth.uid(),auth.uid(),'nao_classificado') returning id into request_id;
   if project.id is null then
    insert into public.vertice_extension_projects(id,institution_id,title,course_ids,coordinator_name,coordinator_email,status,review_status)
   values(p_id,p_institution,p_answers->>'title',array[p_course],p_answers->>'responsible',p_answers->>'email','planejamento','rascunho');
   end if;
   insert into public.vertice_extension_forms(id,institution_id,project_id,course_id,template,answers,attachments,owner_id,updated_by,repository_request_id)
   values(p_id,p_institution,p_id,p_course,p_template,p_answers,p_attachments,auth.uid(),auth.uid(),request_id) returning * into f;
  else
   update public.vertice_extension_forms set course_id=p_course,template=p_template,answers=p_answers,attachments=p_attachments,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into f;
  end if;
  update public.vertice_repository_requests set title=left('Extensão - '||(p_answers->>'title'),500),course_id=p_course,
   semester=case when p_answers->>'semester' ~ '^[0-9]{4}[-/][12]$' then p_answers->>'semester' else null end
  where id=f.repository_request_id;
  update public.vertice_extension_projects set
   target_audience_count=coalesce(nullif(p_answers->>'community_planned','')::integer,target_audience_count),
   infrastructure_needs=coalesce(p_answers->>'infrastructure',infrastructure_needs),
   partnerships_detail=coalesce(p_answers->>'partnerships',partnerships_detail),
   unit_name=coalesce(p_answers->>'unit',unit_name),
   activity_location=coalesce(p_answers->>'location',activity_location),
   activity_schedule=coalesce(p_answers->>'schedule',activity_schedule),
   modality=coalesce(nullif(p_answers->>'modality',''),modality),
   thematic_area=coalesce(p_answers->>'thematic_area',thematic_area),
   activity_type=coalesce(p_answers->>'activity_type',activity_type),
   detailed_program=coalesce(p_answers->>'program',detailed_program),
   evaluation_method=coalesce(p_answers->>'evaluation',evaluation_method),
   specific_objectives=case when p_answers ? 'specific_objectives' then regexp_split_to_array(p_answers->>'specific_objectives', E'\n') else specific_objectives end,
   expected_results=case when p_answers ? 'expected_results' then regexp_split_to_array(p_answers->>'expected_results', E'\n') else expected_results end,
   title=p_answers->>'title',course_ids=case when p_course=any(coalesce(course_ids,'{}'::uuid[])) then course_ids else array[p_course] end,coordinator_name=coalesce(p_answers->>'responsible',coordinator_name),coordinator_email=coalesce(p_answers->>'email',coordinator_email),semester=coalesce(p_answers->>'semester',semester),
   total_hours=case when p_answers?'hours' then nullif(p_answers->>'hours','')::numeric else total_hours end,budget_estimated=case when p_answers?'budget' then nullif(p_answers->>'budget','')::numeric else budget_estimated end,budget_executed=case when p_answers?'investment_actual' then nullif(p_answers->>'investment_actual','')::numeric else budget_executed end,start_date=case when p_answers?'start_date' then nullif(p_answers->>'start_date','')::date else start_date end,end_date=case when p_answers?'end_date' then nullif(p_answers->>'end_date','')::date else end_date end,
   description=coalesce(p_answers->>'introduction',description),social_problem=coalesce(p_answers->>'justification',social_problem),general_objective=coalesce(p_answers->>'general_objective',general_objective),methodology=coalesce(p_answers->>'methodology',methodology),target_community=coalesce(p_answers->>'audience',target_community),updated_at=now()
  where id=f.project_id;
  insert into public.vertice_extension_project_history(institution_id,project_id,field_changed,old_value,new_value,changed_by)
  values(p_institution,f.project_id,'formulario_extensao',p_revision::text,f.revision::text,auth.uid());
 end if;
 return f;
end $$;

commit;
