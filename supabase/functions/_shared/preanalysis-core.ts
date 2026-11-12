import {SOURCE_ADAPTERS} from './preanalysis-sources.ts';
/** Common Superior evidence boundary. No storage/provider/database side effects.
 * Correlation is a suggestion, never a compliance decision or an INEP grade. */
export const PIPELINE_VERSION = 'superior-preanalysis-v2.3';
export const DISCLAIMER = 'Pré-análise de possíveis evidências, sujeita à decisão do gestor e à validação independente no destino. Não é avaliação oficial, conformidade ou garantia de nota.';
export type SourceRef = {institutionId:string;sourceTable:string;sourceId:string};
export type Source = SourceRef & {courseId:string|null;version:string;kind:'file'|'structured';fileName?:string;mimeType?:string;sizeBytes?:number;sha256?:string|null;storageBucket?:string;storagePath?:string;fields?:Record<string,unknown>};
export type Chunk = {id:string;text:string;page:number|null;section:string|null};
export type Catalog = {key:string;instrumentCode:string;version:string;label:string;scope:'course'|'institution';regulatoryStatus:'current'|'proposal';sourcePath:string;sourceUrl:string|null;sourceSha256?:string;applicabilityProfile?:string;objects:{code:string;title:string;criteria?:string}[]};
export type Policy = {enabled:boolean;provider:'openai'|'anthropic'|null;model:string|null;maxOutputTokens:number};
export class PreanalysisError extends Error {constructor(readonly code:string,readonly status=400){super(code)}}
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SOURCE_TABLES = new Set<string>(SOURCE_ADAPTERS.map(a=>a.table));
export function sourceRef(body:Record<string,unknown>):SourceRef {
 if(!UUID.test(String(body.institution_id??''))||!UUID.test(String(body.file_id??body.source_id??''))||!SOURCE_TABLES.has(String(body.source_table??'')))throw new PreanalysisError('unsupported_or_invalid_source');
 return {institutionId:String(body.institution_id),sourceTable:String(body.source_table),sourceId:String(body.file_id??body.source_id)};
}
export async function hash(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
/** Incomplete detector; explicit human data review remains mandatory. */
export function sensitiveFlags(text:string):string[]{
 const flags:string[]=[];
 if(/\bsk-[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:password|senha|secret|token|api[_ -]?key)\s*[:=]\s*\S{5,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/i.test(text))flags.push('secret');
 if(/\b\d{3}\.?\d{3}\.?\d{3}[- ]?\d{2}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\(\d{2}\)\s*\d{4,5}[- ]?\d{4}/i.test(text))flags.push('personal_identifier');
 if(/\b(?:diagnóstico|diagnostico|medicação|medicacao|CID[ -]?\d|laudo médico|laudo medico|CPF|RG|passaporte|menor de idade|criança|crianca|conta bancária|conta bancaria)\b/i.test(text))flags.push('sensitive_review');
 return flags;
}
export function verifySelection(input:unknown,chunks:Chunk[]):Chunk[]{
 if(!Array.isArray(input)||input.length<1||input.length>16)throw new PreanalysisError('invalid_selection');
 const seen=new Set<string>();let total=0;
 return input.map(v=>{if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['id','text'].includes(k))||typeof v.id!=='string'||typeof v.text!=='string'||v.text.trim().length<8||v.text.length>4000||seen.has(v.id))throw new PreanalysisError('invalid_selection');
 const source=chunks.find(c=>c.id===v.id);if(!source||!source.text.includes(v.text))throw new PreanalysisError('unverified_excerpt');
 seen.add(v.id);total+=v.text.length;if(total>24000)throw new PreanalysisError('selection_too_large');
 if(sensitiveFlags(v.text).length)throw new PreanalysisError('sensitive_input_requires_minimization');
 return {...source,text:v.text};});
}
export function applicableCatalog(catalog:Catalog[],source:Source):Catalog[]{return catalog.filter(c=>(c.scope==='institution'||source.courseId!==null)&&(!c.applicabilityProfile||c.applicabilityProfile==='base'||c.applicabilityProfile==='geral'))}
export function catalogObjectKey(catalog:Catalog,code:string):string{return `${catalog.key}::${code}`}
function object(v:unknown,keys:string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw new PreanalysisError('invalid_provider_output',502);return v as Record<string,unknown>}
function text(v:unknown,max=1000):string{if(typeof v!=='string'||!v.trim()||v.length>max||/[<>]|https?:\/\//i.test(v)||/\b(?:nota|conceito)\s*(?:INEP|MEC|oficial|estimad[oa])?\s*[:=–-]?\s*[0-5]\b|\b(?:conforme|conformidade comprovada|aprovado pelo MEC)\b/i.test(v)||sensitiveFlags(v).length)throw new PreanalysisError('unsafe_provider_output',502);return v}
function strings(v:unknown,maxItems=8):string[]{if(!Array.isArray(v)||v.length>maxItems)throw new PreanalysisError('invalid_provider_output',502);return v.map(x=>text(x,800))}
export function validateResult(value:unknown,catalog:Catalog[],chunks:Chunk[]){
 const r=object(value,['summary','correlation','links','gaps','limitations']);
 if(!['potential','none','insufficient'].includes(String(r.correlation))||!Array.isArray(r.links)||r.links.length>24)throw new PreanalysisError('invalid_provider_output',502);
 const keys=new Set<string>();
 const links=r.links.map(v=>{const l=object(v,['objectKey','compatibility','justification','quotes','limitations']);
 const c=catalog.find(c=>c.objects.some(o=>catalogObjectKey(c,o.code)===l.objectKey));const o=c?.objects.find(o=>catalogObjectKey(c!,o.code)===l.objectKey);
 if(!c||!o||keys.has(String(l.objectKey))||!['alta','media','baixa'].includes(String(l.compatibility))||!Array.isArray(l.quotes)||!l.quotes.length||l.quotes.length>4)throw new PreanalysisError('invalid_indicator_or_quotes',502);keys.add(String(l.objectKey));
 const quotes=l.quotes.map(v=>{const q=object(v,['chunkId','text']);const chunk=chunks.find(s=>s.id===q.chunkId);if(!chunk||typeof q.text!=='string'||q.text.length<8||q.text.length>500||!chunk.text.includes(q.text))throw new PreanalysisError('unverified_provider_quote',502);return {chunkId:chunk.id,text:text(q.text,500),page:chunk.page,section:chunk.section}});
 return {objectKey:l.objectKey as string,instrumentCode:c.instrumentCode,version:c.version,regulatoryStatus:c.regulatoryStatus,objectCode:o.code,title:o.title,scope:c.scope,compatibility:l.compatibility as string,justification:text(l.justification),quotes,limitations:strings(l.limitations),status:'suggested',validationStatus:'pending'};
 });
 if((r.correlation==='potential')!==Boolean(links.length))throw new PreanalysisError('inconsistent_correlation',502);
 const limitations=strings(r.limitations);if(!limitations.length)throw new PreanalysisError('missing_limitations',502);
 return {summary:text(r.summary,2000),correlation:r.correlation as 'potential'|'none'|'insufficient',links,gaps:strings(r.gaps),limitations:[...limitations,'Somente os trechos selecionados foram analisados. Ausência de correlação não comprova inexistência de atividade institucional.'],disclaimer:DISCLAIMER};
}
export type Result=ReturnType<typeof validateResult>&{provenance?:{pipelineVersion:string;extractionVersion:string;sourceVersion:string;contentHash:string;catalogHash:string;selectedChunkHashes:{id:string;sha256:string}[];scope:'selected_excerpts';documentCoverage?:string|null;pageCoverage?:{page:number;status:string;characters:number}[];coverageAcknowledged?:boolean}};
