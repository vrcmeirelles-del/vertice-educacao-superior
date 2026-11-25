-- ENADE 360° — busca de evidências com texto pré-analisado.
-- Problema (docs/banco/LEVANTAMENTO_INDICES_20261125.md): vertice_evidence_search analisava a cada
-- consulta todo o texto extraído (~7,5 MB, 774 documentos): 1,58 s por busca. O índice
-- enade360_evidence_text_idx nunca era usado, porque a busca combina título, categoria, indicadores e texto.
-- Correção: o vetor do texto fica pré-calculado numa tabela auxiliar mantida por gatilho; na consulta só
-- os metadados (curtos) são analisados e somados ao vetor guardado. Resultado idêntico: para consultas
-- plainto_tsquery (só conjunção), to_tsvector(meta || ' ' || texto) e to_tsvector(meta) || to_tsvector(texto)
-- produzem os mesmos lexemas; conferido em produção, 774 documentos x 10 buscas, 0 divergências.
-- A tabela auxiliar não fica em vertice_doc_prevalidation porque a tela de pré-validação lê "select *".
-- Leitura da tabela auxiliar segue a RLS da pré-validação (a busca é SECURITY INVOKER). Sem escrita direta.
begin;

create table public.vertice_doc_prevalidation_tsv(
  prevalidation_id uuid primary key references public.vertice_doc_prevalidation(id) on delete cascade,
  institution_id uuid not null,
  tsv tsvector not null
);
alter table public.vertice_doc_prevalidation_tsv enable row level security;
revoke all on public.vertice_doc_prevalidation_tsv from public, anon, authenticated;
grant select on public.vertice_doc_prevalidation_tsv to authenticated;
create policy prevalidation_tsv_read on public.vertice_doc_prevalidation_tsv for select to authenticated
  using (exists (select 1 from public.vertice_doc_prevalidation p where p.id = prevalidation_id));

create function vertice_private.doc_prevalidation_tsv_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(new.extracted_text, '') is null then
    delete from public.vertice_doc_prevalidation_tsv where prevalidation_id = new.id;
  else
    insert into public.vertice_doc_prevalidation_tsv(prevalidation_id, institution_id, tsv)
    values (new.id, new.institution_id, to_tsvector('portuguese', new.extracted_text))
    on conflict (prevalidation_id) do update set institution_id = excluded.institution_id, tsv = excluded.tsv;
  end if;
  return null;
end $$;
revoke all on function vertice_private.doc_prevalidation_tsv_sync() from public, anon, authenticated;
create trigger doc_prevalidation_tsv_sync after insert or update of extracted_text, institution_id
  on public.vertice_doc_prevalidation for each row execute function vertice_private.doc_prevalidation_tsv_sync();

insert into public.vertice_doc_prevalidation_tsv(prevalidation_id, institution_id, tsv)
select p.id, p.institution_id, to_tsvector('portuguese', p.extracted_text)
from public.vertice_doc_prevalidation p where nullif(p.extracted_text, '') is not null;

-- Mesma assinatura, mesmas colunas, mesma ordem e mesmo critério; muda só a forma de obter o vetor do texto.
CREATE OR REPLACE FUNCTION public.vertice_evidence_search(p_institution_id uuid, p_course_id uuid DEFAULT NULL::uuid, p_query text DEFAULT ''::text, p_include_institution boolean DEFAULT false, p_limit integer DEFAULT 30)
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
 (select t.tsv from public.vertice_doc_prevalidation_tsv t where t.prevalidation_id=pv.id) as text_tsv
 from public.vertice_repository_files f join public.vertice_repository_requests r on r.id=f.request_id and r.institution_id=f.institution_id
 left join lateral(select p.* from public.vertice_doc_prevalidation p where p.repository_file_id=f.id and p.institution_id=f.institution_id and p.extraction_status in ('ready','partial') order by p.extracted_at desc,p.id desc limit 1) pv on true
 left join lateral(select p.extraction_status,p.source_sha256,p.ai_error from public.vertice_doc_prevalidation p where p.repository_file_id=f.id and p.institution_id=f.institution_id order by p.created_at desc,p.id desc limit 1) last_attempt on true
 where f.institution_id=p_institution_id
 union all
 select 'vertice_documents',d.id,d.course_id,d.title,d.category_code,coalesce(d.tags,'{}'),null::uuid,null::uuid,
 case when nullif(d.extracted_text,'') is null then 'pending' else 'ready' end,d.sha256,d.extracted_text,'{}'::text[],'[]'::jsonb,null::text,
 to_tsvector('portuguese',coalesce(d.extracted_text,''))
 from public.vertice_documents d where d.institution_id=p_institution_id
 union all
 select 'vertice_inep_library',l.id,null::uuid,l.title,l.library_key,array_remove(array[l.indicator],null),null::uuid,null::uuid,
 'catalog_only',l.sha256,null::text,'{}'::text[],'[]'::jsonb,null::text,null::tsvector from public.vertice_inep_library l where l.institution_id=p_institution_id and l.active
 )
 select s.source_table,s.source_id,s.course_id,s.title,s.category,s.indicators,s.request_id,s.goal_id,s.text_status,s.source_sha256,
 case when nullif(s.extracted_text,'') is null then coalesce(s.failure_reason,'Somente metadados; conteúdo ainda não indexado.') else
 (case when s.failure_reason like 'OCR local:%' then s.failure_reason else '' end) || ts_headline('portuguese',s.extracted_text,plainto_tsquery('portuguese',left(coalesce(p_query,''),300)),'MaxWords=45,MinWords=15,StartSel="",StopSel=""') end,
 s.keyword_suggestions,s.approved_links from sources s
 where public.vertice_evidence_can_manage(p_institution_id)
 and ((p_course_id is null and p_include_institution) or (p_course_id is not null and (s.course_id=p_course_id or (p_include_institution and s.course_id is null))))
 and (btrim(coalesce(p_query,''))='' or (to_tsvector('portuguese',coalesce(s.title,'')||' '||coalesce(s.category,'')||' '||array_to_string(s.indicators,' '))||coalesce(s.text_tsv,''::tsvector)) @@ plainto_tsquery('portuguese',left(p_query,300)))
 order by s.title,s.source_id limit greatest(1,least(coalesce(p_limit,30),50));
$function$;

-- O índice de expressão nunca serviu a esta busca (0 usos desde 02/10/2026) e passa a ser redundante.
drop index if exists public.enade360_evidence_text_idx;
commit;
