-- Read-only candidate selection. Run with a single institution UUID ($1), then
-- export only inside its authorized/private environment. No bodies or names.
-- Method indicates a candidate stratum, NOT a human-confirmed document kind.
-- Final corpus must contain digital, scanned AND photographed sources, verified
-- by two reviewers; this query does not manufacture that distinction.
with latest as (
  select distinct on (source_table,coalesce(document_id,repository_file_id))
    id as extraction_id,institution_id,source_table,
    coalesce(document_id,repository_file_id) as file_id,source_sha256,
    extraction_method,extraction_status,created_at
  from public.vertice_doc_prevalidation
  where institution_id=$1::uuid and created_at<='2026-11-27T13:18:06.152796Z'
  order by source_table,coalesce(document_id,repository_file_id),created_at desc,id desc
), unique_sources as (
  select distinct on (source_sha256) * from latest where source_sha256 is not null
  order by source_sha256,created_at desc,file_id
), stratified as (
  select *,case when extraction_method='tesseract_local_ocr' then 'ocr_candidate'
    when extraction_status='failed' then 'failed_extraction'
    when extraction_method='pdfjs_text_layer' then 'pdf_text'
    else 'office_text' end as candidate_stratum
  from unique_sources
), ranked as (
  select *,row_number() over(partition by candidate_stratum order by md5(file_id::text||'vertice-benchmark-20261127')) as position
  from stratified
), selected as (
  select * from ranked where position<=case candidate_stratum
    when 'ocr_candidate' then 30 when 'failed_extraction' then 10
    when 'pdf_text' then 30 else 30 end
), topup as (
  select r.* from ranked r where not exists(select 1 from selected s where s.file_id=r.file_id and s.source_table=r.source_table)
  order by md5(r.file_id::text||'vertice-benchmark-20261127-topup')
  limit (select greatest(0,100-count(*)) from selected)
), sample as (
  select * from selected union all select * from topup
)
select extraction_id,institution_id,source_table,file_id,source_sha256,
  extraction_method,extraction_status,candidate_stratum
from sample order by candidate_stratum,position;
