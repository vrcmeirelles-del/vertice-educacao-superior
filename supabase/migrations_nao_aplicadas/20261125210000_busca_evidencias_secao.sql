-- Busca de evidências com filtro opcional por seção do acervo (Reconhecimento, Recredenciamento 2017,
-- Novo Instrumento 2026). O filtro precisa estar dentro da busca: ela devolve no máximo 50 documentos, e
-- filtrar depois perderia resultados.
-- Parte do texto vigente em produção (mesmo hash do repositório, 25/11/2026). Sem p_section, o resultado é
-- idêntico ao atual: mesmas colunas, mesma ordem, mesmo critério. Com p_section, ficam só os arquivos do
-- acervo dessa seção (documentos gerais e biblioteca do INEP saem, pois não têm seção).
-- Assinatura nova (parâmetro com padrão): a função antiga é removida para não haver duas versões com
-- chamada ambígua; o único chamador (EvidenceSearch.tsx) usa parâmetros nomeados. Permissões como antes.
begin;
drop function public.vertice_evidence_search(uuid, uuid, text, boolean, integer);
CREATE FUNCTION public.vertice_evidence_search(p_institution_id uuid, p_course_id uuid DEFAULT NULL::uuid, p_query text DEFAULT ''::text, p_include_institution boolean DEFAULT false, p_limit integer DEFAULT 30, p_section text DEFAULT NULL::text)
 RETURNS TABLE(source_table text, source_id uuid, course_id uuid, title text, category text, indicators text[], request_id uuid, goal_id uuid, text_status text, source_sha256 text, excerpt text, keyword_suggestions text[], approved_links jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with sources as (
 select 'vertice_repository_files'::text as source_table,f.id as source_id,r.course_id,f.file_name as title,f.document_category as category,
 coalesce(f.instrument_indicators,'{}') as indicators,r.id as request_id,r.goal_id,
 coalesce(pv.extraction_status,case when last_attempt.extraction_status='failed' then 'failed' else 'pending' end) as text_status,coalesce(pv.source_sha256,last_attempt.source_sha256) as source_sha256,pv.extracted_text,
 coalesce(pv.keyword_suggestions,'{}') as keyword_suggestions,
 coalesce((select jsonb_agg(jsonb_build_object('instrument',l.instrument_code,'version',l.instrument_version,'indicator',l.object_code,'excerpts',l.evidence_excerpts))
 from public.vertice_doc_indicator_links l join public.vertice_doc_prevalidation old on old.id=l.prevalidation_id
 where old.repository_file_id=f.id and old.institution_id=f.institution_id and l.institution_id=f.institution_id and l.status='aprovado'
 and old.source_sha256=pv.source_sha256),'[]'::jsonb) as approved_links,
 case when pv.extraction_metadata->>'ocr_applied'='true' then 'OCR local: texto reconhecido automaticamente; fidelidade, acentos, nomes e números exigem conferência no original. ' when last_attempt.extraction_status='failed' then
  case when last_attempt.ai_error like '%no_embedded_text_ocr_required%' then 'OCR necessário: o arquivo não possui camada textual utilizável. Nenhum texto foi extraído.'
   when last_attempt.ai_error like '%unsupported_format%' then 'Formato sem parser de texto; OCR ou conversão é necessário. Nenhum texto foi extraído.'
   when last_attempt.ai_error like '%limit%' or last_attempt.ai_error like '%too_large%' then 'Limite de processamento atingido. Nenhum texto foi declarado extraído.'
   else 'Tentativa de extração falhou; consulte o registro de pré-validação para conferir a limitação.' end
 end as failure_reason,
 (select t.tsv from public.vertice_doc_prevalidation_tsv t where t.prevalidation_id=pv.id) as text_tsv,
 r.repository_section as section
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id and r.institution_id=f.institution_id
 left join lateral(select p.* from public.vertice_doc_prevalidation p where p.repository_file_id=f.id and p.institution_id=f.institution_id and p.extraction_status in ('ready','partial') order by p.extracted_at desc,p.id desc limit 1) pv on true
 left join lateral(select p.extraction_status,p.source_sha256,p.ai_error from public.vertice_doc_prevalidation p where p.repository_file_id=f.id and p.institution_id=f.institution_id order by p.created_at desc,p.id desc limit 1) last_attempt on true
 where f.institution_id=p_institution_id
 union all
 select 'vertice_documents',d.id,d.course_id,d.title,d.category_code,coalesce(d.tags,'{}'),null::uuid,null::uuid,
 case when nullif(d.extracted_text,'') is null then 'pending' else 'ready' end,d.sha256,d.extracted_text,'{}'::text[],'[]'::jsonb,null::text,
 to_tsvector('portuguese',coalesce(d.extracted_text,'')),null::text
 from public.vertice_documents d where d.institution_id=p_institution_id
 union all
 select 'vertice_inep_library',l.id,null::uuid,l.title,l.library_key,array_remove(array[l.indicator],null),null::uuid,null::uuid,
 'catalog_only',l.sha256,null::text,'{}'::text[],'[]'::jsonb,null::text,null::tsvector,null::text from public.vertice_inep_library l where l.institution_id=p_institution_id and l.active
 )
 select s.source_table,s.source_id,s.course_id,s.title,s.category,s.indicators,s.request_id,s.goal_id,s.text_status,s.source_sha256,
 case when nullif(s.extracted_text,'') is null then coalesce(s.failure_reason,'Somente metadados; conteúdo ainda não indexado.') else
 (case when s.failure_reason like 'OCR local:%' then s.failure_reason else '' end) || ts_headline('portuguese',s.extracted_text,plainto_tsquery('portuguese',left(coalesce(p_query,''),300)),'MaxWords=45,MinWords=15,StartSel="",StopSel=""') end,
 s.keyword_suggestions,s.approved_links from sources s
 where public.vertice_evidence_can_manage(p_institution_id)
 and (p_section is null or s.section = p_section)
 and ((p_course_id is null and p_include_institution) or (p_course_id is not null and (s.course_id=p_course_id or (p_include_institution and s.course_id is null))))
 and (btrim(coalesce(p_query,''))='' or (to_tsvector('portuguese',coalesce(s.title,'')||' '||coalesce(s.category,'')||' '||array_to_string(s.indicators,' '))||coalesce(s.text_tsv,''::tsvector)) @@ plainto_tsquery('portuguese',left(p_query,300)))
 order by s.title,s.source_id limit greatest(1,least(coalesce(p_limit,30),50));
$function$;
revoke all on function public.vertice_evidence_search(uuid, uuid, text, boolean, integer, text) from public, anon;
grant execute on function public.vertice_evidence_search(uuid, uuid, text, boolean, integer, text) to authenticated, service_role;
commit;
