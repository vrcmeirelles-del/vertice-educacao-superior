-- Instrumentos, passo 4: acervos do Recredenciamento 2017 e do Novo Instrumento 2026 no fluxo documental.
-- Depende de 20261125150000_instrumentos_catalogos (catálogos recredenciamento_institucional/2017,
-- novo_instrumento_2026_institucional/2026-proposta e novo_instrumento_2026_curso/2026-proposta).
--
-- Uma função decide, pela seção da solicitação, o acervo (bucket) e o catálogo do arquivo:
--   recredenciamento_2017                → vertice-recredenciamento-2017, recredenciamento_institucional/2017
--   novo_instrumento_2026_institucional  → vertice-novo-instrumento-2026-institucional, catálogo NI institucional
--   novo_instrumento_2026_curso          → vertice-novo-instrumento-2026-cursos, catálogo NI de curso
--   qualquer outra (instrumento, apoio…) → vertice-repositorios e os catálogos ativos — exatamente como hoje.
--
-- Corrige dois defeitos que impediam o uso desses acervos (0 arquivos em produção em 25/11/2026):
--   1. check_repository_file procurava o arquivo sempre em vertice-repositorios, então todo registro de
--      envio do Recredenciamento e do Novo Instrumento era recusado ("arquivo não enviado por esta conta");
--   2. sync_repository_classification reescrevia a seção da solicitação ao classificar o arquivo, tirando-a
--      do acervo do instrumento.
-- As funções abaixo partem do texto vigente em produção (pg_get_functiondef, 25/11/2026) e mudam só o
-- necessário. Para arquivos do Reconhecimento e para vertice_documents o resultado é idêntico ao atual.
begin;

create or replace function vertice_private.repository_section_scope(p_section text) returns jsonb
language sql immutable set search_path = '' as $$
 select case p_section
  when 'recredenciamento_2017' then jsonb_build_object('bucket','vertice-recredenciamento-2017','catalog_code','recredenciamento_institucional','catalog_version','2017')
  when 'novo_instrumento_2026_institucional' then jsonb_build_object('bucket','vertice-novo-instrumento-2026-institucional','catalog_code','novo_instrumento_2026_institucional','catalog_version','2026-proposta')
  when 'novo_instrumento_2026_curso' then jsonb_build_object('bucket','vertice-novo-instrumento-2026-cursos','catalog_code','novo_instrumento_2026_curso','catalog_version','2026-proposta')
  else jsonb_build_object('bucket','vertice-repositorios','catalog_code',null,'catalog_version',null) end
$$;
revoke all on function vertice_private.repository_section_scope(text) from public, anon;
grant execute on function vertice_private.repository_section_scope(text) to authenticated, service_role;

-- Leitura pela função de pré-validação (service_role): acervo e catálogo do arquivo.
create or replace function public.vertice_doc_source_scope(p_institution_id uuid, p_source_table text, p_file_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_section text;
begin
 if p_source_table = 'vertice_documents' then
  return jsonb_build_object('bucket','vertice-documents','catalog_code',null,'catalog_version',null);
 elsif p_source_table <> 'vertice_repository_files' then raise exception 'invalid_source_table'; end if;
 select q.repository_section into v_section from public.vertice_repository_files f
  join public.vertice_repository_requests q on q.id = f.request_id
  where f.id = p_file_id and f.institution_id = p_institution_id and q.institution_id = p_institution_id;
 if not found then raise exception 'source_not_found'; end if;
 return vertice_private.repository_section_scope(v_section);
end $$;
revoke all on function public.vertice_doc_source_scope(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.vertice_doc_source_scope(uuid, text, uuid) to service_role;

-- 1. Registro do envio: o arquivo é procurado no acervo da seção da solicitação.
CREATE OR REPLACE FUNCTION vertice_private.check_repository_file()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.vertice_repository_requests%rowtype; o storage.objects%rowtype; actor uuid:=auth.uid(); server_import boolean:=coalesce(auth.jwt()->>'role'='service_role',false);
begin
 if tg_op='INSERT' then
  if server_import then
   actor:=new.uploaded_by;
   if actor is null or not exists(select 1 from public.vertice_admins where user_id=actor) then raise exception 'importação exige atribuição a um administrador' using errcode='42501';end if;
  end if;
  select * into r from public.vertice_repository_requests where id=new.request_id;
  if r.institution_id is distinct from new.institution_id then raise exception 'exigência pertence a outra instituição' using errcode='23514'; end if;
  if new.storage_path not like new.institution_id::text||'/'||new.request_id::text||'/'||new.id::text||'.%' then raise exception 'caminho inválido' using errcode='23514'; end if;
  select * into o from storage.objects where bucket_id=vertice_private.repository_section_scope(r.repository_section)->>'bucket' and name=new.storage_path;
  if o.id is null or (o.owner_id is distinct from actor::text and not(server_import and o.owner_id is null)) then raise exception 'arquivo não enviado por esta conta' using errcode='23514'; end if;
  if coalesce((o.metadata->>'size')::bigint,-1) <> new.size_bytes then raise exception 'tamanho do arquivo divergente' using errcode='23514'; end if;
  new.uploaded_by:=actor;
  select email into new.uploaded_email from auth.users where id=actor;
  new.created_at:=clock_timestamp(); new.status:='enviado'; new.reviewed_by:=null; new.reviewed_at:=null; new.review_note:=null;
 else
  if not vertice_private.has_role(new.institution_id,array['gestor']) then raise exception 'sem permissão' using errcode='42501'; end if;
  if (to_jsonb(new) - array['status','review_note','reviewed_by','reviewed_at','document_category','instrument_indicators','classification_note','classified_by','classified_at']) is distinct from (to_jsonb(old) - array['status','review_note','reviewed_by','reviewed_at','document_category','instrument_indicators','classification_note','classified_by','classified_at']) then raise exception 'metadados do arquivo são imutáveis' using errcode='23514';end if;
  if new.status=old.status and new.review_note is not distinct from old.review_note and (new.document_category,new.instrument_indicators,new.classification_note) is distinct from (old.document_category,old.instrument_indicators,old.classification_note) then
   new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;return new;
  end if;
  if new.status not in ('validado','devolvido') then raise exception 'situação de análise inválida' using errcode='23514'; end if;
  if new.status='devolvido' and length(trim(coalesce(new.review_note,'')))=0 then raise exception 'informe o motivo da devolução' using errcode='23514'; end if;
  new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();
 end if;
 return new;
end; $function$;

-- 2. Classificação: nos acervos com catálogo próprio, o código precisa existir nesse catálogo da IES;
--    nos demais, vale a regra atual do Reconhecimento 2017 (1.x a 3.x, limites 24/16/18).
CREATE OR REPLACE FUNCTION vertice_private.check_repository_classification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare code text; d integer; n integer; v_scope jsonb;
begin
 select vertice_private.repository_section_scope(q.repository_section) into v_scope from public.vertice_repository_requests q where q.id=new.request_id;
 foreach code in array new.instrument_indicators loop
  if v_scope->>'catalog_code' is not null then
   if not exists(select 1 from public.vertice_instrument_catalog c join public.vertice_instrument_objects o on o.catalog_id=c.id
     where c.institution_id=new.institution_id and c.instrument_code=v_scope->>'catalog_code' and c.instrument_version=v_scope->>'catalog_version' and o.object_code=code)
   then raise exception 'indicador fora do instrumento' using errcode='23514';end if;
  else
   if code !~ '^[123]\.[1-9][0-9]?$' then raise exception 'indicador inválido' using errcode='23514';end if;
   d:=split_part(code,'.',1)::integer;n:=split_part(code,'.',2)::integer;
   if n>(case d when 1 then 24 when 2 then 16 else 18 end) then raise exception 'indicador fora do instrumento' using errcode='23514';end if;
  end if;
 end loop;
 if new.document_category='instrumento' and cardinality(new.instrument_indicators)=0 then raise exception 'informe ao menos um indicador' using errcode='23514';end if;
 if new.document_category<>'instrumento' then new.instrument_indicators:='{}';end if;
 if tg_op='INSERT' then
  new.document_category:='nao_classificado';new.instrument_indicators:='{}';new.classified_by:=null;new.classified_at:=null;new.classification_note:=null;
 elsif (new.document_category,new.instrument_indicators,new.classification_note) is distinct from (old.document_category,old.instrument_indicators,old.classification_note) then
  new.classified_by:=auth.uid();new.classified_at:=clock_timestamp();
 else new.classified_by:=old.classified_by;new.classified_at:=old.classified_at;end if;
 return new;
end;$function$;

-- 3. Sincronização da classificação: solicitações dos acervos com catálogo próprio mantêm seção e indicador.
CREATE OR REPLACE FUNCTION vertice_private.sync_repository_classification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare section text; codes text;
begin
 if (new.document_category,new.instrument_indicators) is not distinct from (old.document_category,old.instrument_indicators) then return new;end if;
 if exists(select 1 from public.vertice_repository_requests q where q.id=new.request_id
   and vertice_private.repository_section_scope(q.repository_section)->>'catalog_code' is not null) then return new;end if;
 select case when bool_or(document_category='instrumento') then 'instrumento' when bool_or(document_category='nao_classificado') then 'nao_classificado' when bool_or(document_category='apoio') then 'apoio' else 'diversos' end into section from public.vertice_repository_files where request_id=new.request_id;
 select string_agg(code,', ' order by code) into codes from (select distinct unnest(instrument_indicators) code from public.vertice_repository_files where request_id=new.request_id and document_category='instrumento') q;
 update public.vertice_repository_requests set repository_section=section,indicator=case when section='instrumento' then codes else indicator end where id=new.request_id;
 return new;
end;$function$;

-- 4. Revisão de cache da pré-validação: acervo e catálogo pela seção. Para o Reconhecimento e para
--    vertice_documents a expressão é a mesma de antes, logo a revisão (e o cache) não muda.
CREATE OR REPLACE FUNCTION public.vertice_doc_rules_revision(p_institution_id uuid, p_source_table text, p_file_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare src jsonb; bucket_name text; storage_revision text; catalog_revision text; v_scope jsonb;
begin
 if p_source_table='vertice_documents' then
  select to_jsonb(d) into src from public.vertice_documents d where d.id=p_file_id and d.institution_id=p_institution_id;
  bucket_name:='vertice-documents';
 elsif p_source_table='vertice_repository_files' then
  select to_jsonb(f) into src from public.vertice_repository_files f where f.id=p_file_id and f.institution_id=p_institution_id;
  select vertice_private.repository_section_scope(q.repository_section) into v_scope from public.vertice_repository_requests q where q.id=(src->>'request_id')::uuid;
  bucket_name:=coalesce(v_scope->>'bucket','vertice-repositorios');
 else raise exception 'invalid_source_table'; end if;
 if src is null then raise exception 'source_not_found'; end if;
 select coalesce(o.updated_at::text,'')||coalesce(o.metadata::text,'') into storage_revision
  from storage.objects o where o.bucket_id=bucket_name and o.name=src->>'storage_path';
 if v_scope->>'catalog_code' is null then
  select coalesce(jsonb_agg(jsonb_build_array(c.instrument_code,c.instrument_version,c.source_provenance,o.object_code,o.object_label,o.description) order by c.id,o.object_code)::text,'[]')
   into catalog_revision from public.vertice_instrument_catalog c left join public.vertice_instrument_objects o on o.catalog_id=c.id
   where c.institution_id=p_institution_id and c.is_active;
 else
  select coalesce(jsonb_agg(jsonb_build_array(c.instrument_code,c.instrument_version,c.source_provenance,o.object_code,o.object_label,o.description) order by c.id,o.object_code)::text,'[]')
   into catalog_revision from public.vertice_instrument_catalog c left join public.vertice_instrument_objects o on o.catalog_id=c.id
   where c.institution_id=p_institution_id and c.instrument_code=v_scope->>'catalog_code' and c.instrument_version=v_scope->>'catalog_version';
 end if;
 return md5(jsonb_build_array(src->>'storage_path',src->>'file_name',src->>'version_number',src->>'category_code',src->'tags',src->>'document_category',src->'instrument_indicators',storage_revision,catalog_revision)::text);
end $function$;

-- 5. Conclusão: vínculo só com indicador do catálogo do acervo (ou dos catálogos ativos, fora deles).
CREATE OR REPLACE FUNCTION public.vertice_doc_finish_rules(p_id uuid, p_result jsonb, p_links jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare pv public.vertice_doc_prevalidation; link jsonb; count_links integer:=0; rev text; v_scope jsonb;
begin
 select * into strict pv from public.vertice_doc_prevalidation where id=p_id for update;
 if pv.ai_status<>'processing' or pv.lease_until<=clock_timestamp() then raise exception 'lease_expired'; end if;
 rev:=md5(public.vertice_doc_rules_revision(pv.institution_id,pv.source_table,coalesce(pv.document_id,pv.repository_file_id))||pv.rules_action||pv.ai_model_version);
 if rev<>pv.rules_job_key then raise exception 'source_or_catalog_changed'; end if;
 if pv.source_sha256 is null or pv.extraction_status not in ('ready','partial') then raise exception 'unverified_extraction'; end if;
 if pv.repository_file_id is not null then
  select vertice_private.repository_section_scope(q.repository_section) into v_scope from public.vertice_repository_files f
   join public.vertice_repository_requests q on q.id=f.request_id where f.id=pv.repository_file_id;
 end if;
 for link in select value from jsonb_array_elements(p_links) loop
  if not exists(select 1 from public.vertice_instrument_catalog c join public.vertice_instrument_objects o on o.catalog_id=c.id
   where c.institution_id=pv.institution_id
    and (case when v_scope->>'catalog_code' is null then c.is_active else c.instrument_code=v_scope->>'catalog_code' and c.instrument_version=v_scope->>'catalog_version' end)
    and c.instrument_code=link->>'instrument_code' and c.instrument_version=link->>'instrument_version' and o.object_code=link->>'object_code') then raise exception 'unknown_indicator'; end if;
  if jsonb_array_length(coalesce(link->'evidence_excerpts','[]'))=0 or exists(
   select 1 from jsonb_array_elements(link->'evidence_excerpts') e where length(coalesce(e->>'text',''))<20 or not exists(
    select 1 from jsonb_array_elements(pv.extracted_pages) page where position(e->>'text' in page->>'text')>0
    and (e->>'page' is null or e->>'page'=page->>'page') and (coalesce(e->>'section','')='' or e->>'section'=page->>'section'))) then raise exception 'ungrounded_excerpt'; end if;
  insert into public.vertice_doc_indicator_links(prevalidation_id,institution_id,instrument_code,instrument_version,object_code,dimension,is_primary,compatibility,justification,evidence_excerpts,limitations,status)
  values(pv.id,pv.institution_id,link->>'instrument_code',link->>'instrument_version',link->>'object_code',link->>'dimension',coalesce((link->>'is_primary')::boolean,false),link->>'compatibility',link->>'justification',link->'evidence_excerpts',link->>'limitations','sugerido');
  count_links:=count_links+1;
 end loop;
 update public.vertice_doc_prevalidation set ai_status='completed',ai_summary=left(p_result->>'summary',4000),ai_nature=left(p_result->>'nature',200),ai_institution_detected=left(p_result->>'institution_detected',200),ai_course_detected=left(p_result->>'course_detected',200),ai_period_detected=left(p_result->>'period_detected',100),ai_scope_detected=left(p_result->>'scope_detected',50),ai_analyzed_at=clock_timestamp(),ai_error=null,processing_stage='human_review',lease_until=null,updated_at=clock_timestamp() where id=pv.id;
 insert into public.vertice_mirror_audit_log(institution_id,action,entity_type,entity_id,actor_id,actor_type,ai_model,details)
 values(pv.institution_id,'prevalidation_completed','prevalidation',pv.id,pv.requested_by,'system',pv.ai_model_version,jsonb_build_object('source_sha256',pv.source_sha256,'links_created',count_links,'review_required',true,'provider_transmission',false));
 return jsonb_build_object('status','completed','prevalidation_id',pv.id,'links_created',count_links,'review_required',true,'provider_transmission',false);
end $function$;

commit;
