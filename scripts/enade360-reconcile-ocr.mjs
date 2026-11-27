#!/usr/bin/env node
// Read-only reconciliation. Inputs are authorized metadata exports, never credentials.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function reconcile(receipt,snapshot){
 const rows=new Map((snapshot.prevalidations??[]).map(p=>[p.id,p]));
 const audits=(snapshot.audits??[]).filter(a=>a.action==='document_local_ocr_imported');
 const findings=[];const seen=new Set();
 for(const f of receipt.files??[]){
  if(seen.has(f.file_id)){findings.push({file_id:f.file_id,issue:'duplicate_receipt_entry'});continue;}seen.add(f.file_id);
  const events=audits.filter(a=>a.file_id===f.file_id);
  if(!events.length){findings.push({file_id:f.file_id,issue:'missing_import_audit'});continue;}
  let verified=false;
  for(const a of events){const p=rows.get(a.entity_id);
   if(!p){findings.push({file_id:f.file_id,prevalidation_id:a.entity_id,issue:'audit_target_missing'});continue;}
   const problems=[];
   if(p.repository_file_id!==f.file_id)problems.push('source_id_mismatch');
   if(p.source_sha256!==f.sha256||a.source_sha256!==f.sha256)problems.push('source_hash_mismatch');
   if(p.extraction_method!=='tesseract_local_ocr'||p.extraction_status!=='partial'||!(p.characters>0))problems.push('ocr_text_not_persisted');
   for(const issue of problems)findings.push({file_id:f.file_id,prevalidation_id:p.id,issue});
   if(!problems.length)verified=true;
  }
  if(verified)continue;
 }
 const affected=new Set(findings.map(f=>f.file_id));
 const verifiedFiles=[...seen].filter(id=>!affected.has(id)).length;
 return {checked_at:snapshot.checked_at,mode:'read_only',declared_files:receipt.ocr_imported??seen.size,receipt_files:seen.size,verified_files:verifiedFiles,affected_files:affected.size,findings,complete:findings.length===0&&seen.size===(receipt.ocr_imported??seen.size),limits:['Metadata reconciliation only; no OCR fidelity approval, academic approval or authenticated UI test.','A missing audit target does not establish why it is absent.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [receiptPath,snapshotPath,output]=process.argv.slice(2);
 if(!receiptPath||!snapshotPath)throw Error('Usage: node scripts/enade360-reconcile-ocr.mjs receipt.json snapshot.json [output.json]');
 const result=reconcile(JSON.parse(readFileSync(receiptPath,'utf8')),JSON.parse(readFileSync(snapshotPath,'utf8')));
 const json=JSON.stringify(result,null,2)+'\n';if(output)writeFileSync(output,json);else process.stdout.write(json);
 process.exitCode=result.complete?0:2;
}
