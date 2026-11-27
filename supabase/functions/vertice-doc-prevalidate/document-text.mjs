// Byte parsers: no URLs, scripts, network resolver, or document instructions.
export const LIMITS={bytes:30*1024*1024,chars:100000,pages:500,entries:1500,expanded:32*1024*1024,cells:50000};
export class ExtractionFailure extends Error{
 constructor(reason,sourceSha256,receivedBytes,method){super(reason);this.name='ExtractionFailure';this.sourceSha256=sourceSha256;this.receivedBytes=receivedBytes;this.method=method;}
}
const utf=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
const clean=s=>s.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
export function xmlText(s){
 if(/<!DOCTYPE|<!ENTITY/i.test(s))throw Error('xml_entities_not_supported');
 return clean(s.replace(/<\/(?:w:p|a:p|row)>/g,'\n').replace(/<[^>]*>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>String.fromCodePoint(v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):parseInt(v,10))).replace(/[ \t]+/g,' '));
}
export function keywords(s){
 const stop=new Set('para como este esta esse essa pelo pela pelos pelas uma umas uns que com dos das aos nas nos são não seu sua seus suas mais entre sobre também documento documentos página páginas instituição curso ensino superior'.split(' ')),counts=new Map();
 for(const w of (s.toLocaleLowerCase('pt-BR').match(/\p{L}{4,}/gu)||[]))if(!stop.has(w))counts.set(w,(counts.get(w)||0)+1);
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,20).map(x=>x[0]);
}
export async function extractDocument(bytes,name,a){
 if(!(bytes instanceof Uint8Array)||bytes.length>LIMITS.bytes)throw Error('file_too_large');
 const hash=await crypto.subtle.digest('SHA-256',bytes),sha256=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 const ext=name.toLowerCase().split('.').pop(),sig=new TextDecoder().decode(bytes.subarray(0,8));
 let pages=[],method='',partial=false,pageCount=null,chars=0,pagesWithoutText=[],reviewSignals=[];
 const add=(text,page=null,section=null)=>{text=clean(text);if(text.length>LIMITS.chars-chars){partial=true;text=text.slice(0,LIMITS.chars-chars);}if(text){pages.push({page,section,text});chars+=text.length;}};
 try{
 // Await durable receipt before any parser can hit a hard runtime limit.
 if(a.onFingerprint)await a.onFingerprint({sha256,receivedBytes:bytes.length});
 if(sig.startsWith('%PDF-')){
  method='pdfjs_text_layer';const d=await a.pdf(bytes.slice());pageCount=d.numPages;
  try{for(let n=1;n<=Math.min(pageCount,LIMITS.pages);n++){const p=await d.getPage(n),c=await p.getTextContent();const pageText=c.items.map(x=>(x.str||'')+(x.hasEOL?'\n':' ')).join('');if(!pageText.trim())pagesWithoutText.push(n);add(pageText,n);if(chars>=LIMITS.chars){partial=partial||n<pageCount;break;}}if(pageCount>LIMITS.pages)partial=true;}finally{await d.destroy();}
 }else if(sig.startsWith('PK\u0003\u0004')&&['docx','xlsx','pptx'].includes(ext)){
  method=ext+'_xml';let expanded=0,entries=0;
  const z=a.unzip(bytes,{filter:f=>{
   if(++entries>LIMITS.entries)throw Error('zip_entry_limit');
   const wanted=ext==='docx'?/^word\/(document|comments|header\d+|footer\d+)\.xml$/.test(f.name):ext==='xlsx'?/^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(f.name):/^ppt\/slides\/slide\d+\.xml$/.test(f.name);
   if(!wanted)return false;expanded+=f.originalSize;if(expanded>LIMITS.expanded)throw Error('zip_expansion_limit');return true;
  }});
  if(ext==='docx'&&!z['word/document.xml'])throw Error('docx_main_part_missing');
  let shared=[],cells=0;if(z['xl/sharedStrings.xml'])shared=[...utf(z['xl/sharedStrings.xml']).matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>xmlText(m[1]));
  for(const path of Object.keys(z).sort((x,y)=>x.localeCompare(y,'en',{numeric:true}))){
   if(path==='xl/sharedStrings.xml')continue;const xml=utf(z[path]);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('xml_entities_not_supported');
   if(ext==='docx'){
    if(/<w:(?:ins|del|moveFrom|moveTo)(?:\s|>)/.test(xml))reviewSignals.push('tracked_changes');
    if(path==='word/comments.xml'||/<w:commentRangeStart(?:\s|>)/.test(xml))reviewSignals.push('comments');
    // Reviewer comments are not the institutional document's body.
    if(path==='word/comments.xml')continue;
   }
   if(ext==='xlsx')for(const m of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
    if(++cells>LIMITS.cells){partial=true;break;}const ref=m[1].match(/\br="([A-Z]+\d+)"/)?.[1],v=m[2].match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
    add(String(/\bt="s"/.test(m[1])?shared[Number(v)]||'':v??xmlText(m[2])),null,path+(ref?'!'+ref:''));if(chars>=LIMITS.chars){partial=true;break;}
   }else add(xmlText(xml),ext==='pptx'?Number(path.match(/slide(\d+)/)?.[1]):null,path);
   if(chars>=LIMITS.chars){partial=true;break;}
  }
 }else if(['txt','csv','tsv'].includes(ext)){
  if(bytes.includes(0)||sig.startsWith('PK'))throw Error('binary_content');method='utf8_text';add(utf(bytes));
 }else throw Error('unsupported_format');
 if(chars<50)throw Error(method==='pdfjs_text_layer'?'no_embedded_text_ocr_required':'insufficient_text');
 if(pagesWithoutText.length)partial=true;
 const text=pages.map(p=>(p.page?'PÁGINA '+p.page+'\n':'')+p.text).join('\n\n');
 return {text,pages,sha256,method,partial,pageCount,pagesWithoutText,reviewSignals:[...new Set(reviewSignals)],characters:chars,keywords:keywords(text),ocrApplied:false};
 }catch(error){throw new ExtractionFailure(error instanceof Error?error.message:String(error),sha256,bytes.length,method||null);}
}
export function groundedLinks(links,extracted){
 const norm=s=>s.normalize('NFC').replace(/\s+/g,' ').trim();
 return (Array.isArray(links)?links:[]).map(l=>({...l,evidence_excerpts:(Array.isArray(l.evidence_excerpts)?l.evidence_excerpts:[]).filter(e=>typeof e.text==='string'&&e.text.length>=20&&extracted.pages.some(p=>(e.page==null||e.page===p.page)&&(!e.section||e.section===p.section)&&norm(p.text).includes(norm(e.text))))})).filter(l=>l.evidence_excerpts.length>0);
}

// Preserve the exact prefix actually sent, including a partially transmitted page.
// Previously a DOCX main part over 30k characters excluded every valid quotation.
export function transmittedEvidence(extracted,limit=30000){
 let cursor=0;const pages=[];
 for(const page of extracted.pages){
  const start=extracted.text.indexOf(page.text,cursor);
  if(start<0)throw Error('extraction_page_text_mismatch');
  cursor=start+page.text.length;
  if(start>=limit)break;
  const text=page.text.slice(0,Math.max(0,limit-start));
  if(text)pages.push({...page,text});
 }
 return {...extracted,text:extracted.text.slice(0,limit),pages};
}

