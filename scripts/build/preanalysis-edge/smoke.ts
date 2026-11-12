// This file is bundled only for a local test, never used as a deployment entrypoint.
import {extractEvidence} from '../../../supabase/functions/_shared/preanalysis-extraction.ts';
import {zipSync} from 'npm:fflate@0.8.3';

const assert=(value:unknown,message:string):asserts value=>{if(!value)throw Error(message);};
const encode=(s:string)=>new TextEncoder().encode(s);
let networkAttempts=0,workerAttempts=0;
globalThis.fetch=async()=>{networkAttempts++;throw Error('NETWORK_FORBIDDEN_LOCAL_SMOKE');};
Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){workerAttempts++;throw Error('WEB_WORKER_FORBIDDEN_LOCAL_SMOKE');}}});
// Do not read credentials from the process, or start a real server.
Deno.env.get=()=>undefined;
let handler:((req:Request)=>Response|Promise<Response>)|undefined;
Deno.serve=((fn:typeof handler)=>{handler=fn;return{finished:Promise.resolve()};}) as typeof Deno.serve;
await import(Deno.args[0]);
assert(handler,'Bundle did not register its request handler');
const denied=await handler(new Request('https://local.invalid',{method:'POST',body:'{}'}));
assert(denied.status===401,'Bundle must reject requests without authorization');

const run=(bytes:Uint8Array,fileName:string,mimeType:string)=>extractEvidence(bytes,{fileName,mimeType,sizeBytes:bytes.length});
const text=await run(encode('Local synthetic evidence'),'local.txt','text/plain');
assert(text.status==='ready'&&text.text==='Local synthetic evidence','Text smoke failed');
const xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Local DOCX &amp; XML evidence</w:t></w:r></w:p></w:body></w:document>';
const docx=zipSync({'[Content_Types].xml':encode('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),'word/document.xml':encode(xml)},{level:0});
const word=await run(docx,'local.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
assert(word.status==='ready'&&word.text.includes('Local DOCX & XML evidence'),'DOCX/ZIP/XML smoke failed: '+word.limitations.join(' '));

function syntheticPdf(pageTexts:string[]):Uint8Array{
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids:string[]=[];
  for(const text of pageTexts){
    const pageId=objects.length+1,streamId=pageId+1;kids.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    const stream=text?`BT /F1 12 Tf 50 700 Td (${text}) Tj ET`:'';
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[1]=`<< /Type /Pages /Count ${pageTexts.length} /Kids [${kids.join(' ')}] >>`;
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  return encode(pdf+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
const pdf=await run(syntheticPdf(['First local page','','Third local page']),'local.pdf','application/pdf');
assert(pdf.status==='ready_with_gaps'&&pdf.documentCoverage==='partial_text','PDF gap smoke failed: '+pdf.limitations.join(' '));
assert(pdf.pageCoverage.length===3&&pdf.pageCoverage[1].status==='no_text_requires_review','Textless page was not flagged');
assert(pdf.chunks.map(c=>c.text).join('')===pdf.text&&pdf.text.includes('Third local page'),'PDF evidence/provenance smoke failed');
let publicSummary=null;
if(Deno.args[1]){
  const bytes=await Deno.readFile(Deno.args[1]);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  assert(digest==='bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768','Only the known public IFPB fixture is permitted');
  const started=performance.now();
  const result=await run(bytes,'ifpb-public-2017.pdf','application/pdf');
  assert(['ready','ready_with_gaps'].includes(result.status),'Public PDF failed: '+result.limitations.join(' '));
  assert(result.pageCoverage.length===54,'Unexpected public PDF page count');
  assert(JSON.stringify(result.pageCoverage.filter(p=>p.status==='no_text_requires_review').map(p=>p.page))==='[6,10,44,52,53]','Unexpected public PDF unresolved pages');
  assert(result.chunks.map(c=>c.text).join('')===result.text,'Public PDF evidence was truncated');
  publicSummary={sha256:digest,status:result.status,pages:result.pageCoverage.length,characters:result.text.length,elapsedMs:Math.round(performance.now()-started)};
}
assert(networkAttempts===0,'Parser attempted network access');
assert(workerAttempts===0,'Parser attempted to create a Web Worker');
console.log(JSON.stringify({scope:'Local Deno smoke only, not hosted Supabase validation',deno:Deno.version.deno,checks:['bundled endpoint boots','missing authorization rejected','TXT','DOCX/ZIP/XML','PDF with textless middle page','lossless chunks'],networkAttempts,workerAttempts,publicPdf:publicSummary}));
