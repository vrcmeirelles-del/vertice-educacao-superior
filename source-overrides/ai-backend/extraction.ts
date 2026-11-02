/** Local-backend preview only. No provider, URLs, HTML rendering, execution, OCR,
 * network resolver, or client-supplied document text/path accepted by this module.
 * Adapters MUST resolve auth/MFA/IES/course/version permissions server-side and use
 * a private immutable storage object. UI-selected IDs alone are not authority.
 */
export const EXTRACTION_LIMITS = Object.freeze({files:3,bytesPerFile:5*1024*1024,totalCharacters:30_000,chunkCharacters:2_000});
export type ExtractionScope = {actorId:string;institutionId:string;courseId:string|null};
export type ImmutableFile = {
 fileId:string;institutionId:string;courseId:string|null;requestId:string;
 versionId:string;storagePath:string;fileName:string;mimeType:string;sizeBytes:number;
};
export type ExtractionAdapters = {
 /** Must recheck current authenticated actor, MFA, current course membership, document
  * visibility and immutable version relation. Return null for unavailable OR forbidden. */
 authorizeImmutableFile:(scope:ExtractionScope,fileId:string)=>Promise<ImmutableFile|null>;
 /** Read a private storage object using ONLY the descriptor resolved above; do not
  * interpret file contents as URLs. Reject overwrite/version drift. Stream with abort. */
 readImmutableStorage:(file:Readonly<ImmutableFile>,signal?:AbortSignal)=>Promise<AsyncIterable<Uint8Array>>;
};
export type SourceChunk = {
 id:string;fileId:string;versionId:string;sha256:string;page:null;
 ordinal:number;text:string;startCharacter:number;endCharacter:number;
};
export type ExtractionStatus = 'ready'|'unavailable'|'unsupported_pdf'|'unsupported_docx'|'unsupported_type'|'invalid_encoding'|'binary_content'|'no_text'|'file_too_large'|'text_limit_exceeded'|'integrity_error'|'read_failed';
export type FilePreview = {fileId:string;status:ExtractionStatus;chunks:SourceChunk[];sha256?:string;fileName?:string;characters:number;normalized?:boolean;message:string};
export type ExtractionPreview = {reviewRequired:true;providerTransmission:false;formatVersion:1;totalCharacters:number;files:FilePreview[]};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const messages:Record<ExtractionStatus,string>={
 ready:'Trechos extraídos no backend para revisão humana. Ainda não enviados à IA.',
 unavailable:'Documento indisponível para este escopo.',unsupported_pdf:'Extração de PDF ainda não habilitada neste ambiente. Não foi possível verificar texto ou digitalização; OCR não disponível.',
 unsupported_docx:'Extração de DOCX ainda não habilitada neste ambiente.',unsupported_type:'Formato não suportado. Apenas TXT e CSV em UTF-8 nesta versão.',
 invalid_encoding:'Texto não está em UTF-8 válido; nenhuma conversão presumida.',binary_content:'Conteúdo binário ou formato incompatível com texto simples.',
 no_text:'Nenhum texto utilizável foi encontrado; não há evidência textual para análise.',file_too_large:'Arquivo excede o limite de 5 MiB.',
 text_limit_exceeded:'Texto excede o limite total de 30.000 caracteres. Nenhum trecho deste arquivo foi incluído.',
 integrity_error:'Versão, caminho ou tamanho do arquivo não confere; extração recusada.',read_failed:'Não foi possível concluir a leitura autorizada. Nenhum trecho parcial foi incluído.',
};
function failed(fileId:string,status:ExtractionStatus):FilePreview{return {fileId,status,chunks:[],characters:0,message:messages[status]};}
function validDescriptor(d:ImmutableFile,scope:ExtractionScope,fileId:string):boolean{
 return d.fileId===fileId&&d.institutionId===scope.institutionId&&d.courseId===scope.courseId&&UUID.test(d.requestId)&&
  typeof d.versionId==='string'&&d.versionId.length>0&&d.versionId.length<=128&&/^[a-zA-Z0-9_-]+$/.test(d.versionId)&&
  typeof d.storagePath==='string'&&new RegExp(`^${scope.institutionId}/${d.requestId}/${fileId}\\.[A-Za-z0-9]{1,10}$`,'i').test(d.storagePath)&&
  typeof d.fileName==='string'&&d.fileName.length>0&&d.fileName.length<=500&&
  typeof d.mimeType==='string'&&Number.isSafeInteger(d.sizeBytes)&&d.sizeBytes>=0;
}
class LocalFailure extends Error{constructor(readonly status:ExtractionStatus){super(status);}}
function format(file:ImmutableFile):'text'|'csv'|ExtractionStatus{
 const ext=file.fileName.toLowerCase().split('.').pop();const type=file.mimeType.toLowerCase().split(';')[0].trim();
 if(ext==='pdf'||type==='application/pdf')return 'unsupported_pdf';
 if(ext==='docx'||type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return 'unsupported_docx';
 if(ext==='txt'&&type==='text/plain')return 'text';
 if(ext==='csv'&&['text/csv','application/csv','text/plain'].includes(type))return 'csv';
 return 'unsupported_type';
}
async function readBounded(file:ImmutableFile,adapters:ExtractionAdapters,signal?:AbortSignal):Promise<Uint8Array>{
 if(signal?.aborted)throw new LocalFailure('read_failed');
 const stream=await adapters.readImmutableStorage(Object.freeze({...file}),signal);
 const parts:Uint8Array[]=[];let size=0;
 for await(const part of stream){
  if(signal?.aborted)throw new LocalFailure('read_failed');
  if(!(part instanceof Uint8Array))throw new LocalFailure('integrity_error');
  size+=part.byteLength;
  if(size>EXTRACTION_LIMITS.bytesPerFile)throw new LocalFailure('file_too_large');
  if(size>file.sizeBytes)throw new LocalFailure('integrity_error');
  parts.push(part.slice());
 }
 if(size!==file.sizeBytes)throw new LocalFailure('integrity_error');
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.byteLength;}return result;
}
async function digest(bytes:Uint8Array):Promise<string>{
 const buffer=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer);
 return Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
}
function plainText(bytes:Uint8Array):{text:string;normalized:boolean}{
 const signature=new TextDecoder().decode(bytes.subarray(0,16));
 if(signature.startsWith('%PDF-')||signature.startsWith('PK\x03\x04')||bytes.includes(0))throw new LocalFailure('binary_content');
 let decoded:string;try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new LocalFailure('invalid_encoding');}
 const text=decoded.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').trim();
 return {text,normalized:text!==decoded};
}
/** All returned text is UNTRUSTED evidence, never an instruction. A separate
 * authenticated preview-confirmation endpoint must bind exact selected chunk IDs,
 * version hashes, actor and IES, expire preview and re-authorize before any provider
 * request. This helper intentionally provides no provider-send capability. */
export async function extractDocumentPreview(scope:ExtractionScope,fileIds:readonly string[],adapters:ExtractionAdapters,signal?:AbortSignal):Promise<ExtractionPreview>{
 if(!UUID.test(scope.actorId)||!UUID.test(scope.institutionId)||(scope.courseId!==null&&!UUID.test(scope.courseId)))throw new Error('Invalid extraction scope');
 if(!Array.isArray(fileIds)||fileIds.length<1||fileIds.length>EXTRACTION_LIMITS.files||fileIds.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(fileIds).size!==fileIds.length)throw new Error('Select one to three distinct file IDs');
 const result:ExtractionPreview={reviewRequired:true,providerTransmission:false,formatVersion:1,totalCharacters:0,files:[]};
 for(const fileId of fileIds){
  let file:ImmutableFile|null;
  try{file=await adapters.authorizeImmutableFile({...scope},fileId);}catch{result.files.push(failed(fileId,'unavailable'));continue;}
  if(!file){result.files.push(failed(fileId,'unavailable'));continue;}
  file={...file};
  if(!validDescriptor(file,scope,fileId)){result.files.push(failed(fileId,'unavailable'));continue;}
  if(file.sizeBytes>EXTRACTION_LIMITS.bytesPerFile){result.files.push(failed(fileId,'file_too_large'));continue;}
  const kind=format(file);
  if(kind!=='text'&&kind!=='csv'){result.files.push(failed(fileId,kind));continue;}
  try{
   const bytes=await readBounded(file,adapters,signal);const {text,normalized}=plainText(bytes);
   // Bound code points without splitting surrogate pairs in source excerpts.
   if(text.length>(EXTRACTION_LIMITS.totalCharacters-result.totalCharacters)*2)throw new LocalFailure('text_limit_exceeded');
   const chars=Array.from(text);
   if(!text||!/[\p{L}\p{N}]/u.test(text))throw new LocalFailure('no_text');
   if(result.totalCharacters+chars.length>EXTRACTION_LIMITS.totalCharacters)throw new LocalFailure('text_limit_exceeded');
   const sha256=await digest(bytes);const chunks:SourceChunk[]=[];
   for(let start=0;start<chars.length;start+=EXTRACTION_LIMITS.chunkCharacters){
    const ordinal=chunks.length+1,end=Math.min(start+EXTRACTION_LIMITS.chunkCharacters,chars.length);
    chunks.push({id:`${fileId.replace(/-/g,'').toLowerCase()}_${sha256.slice(0,32)}_${ordinal}`,fileId,versionId:file.versionId,sha256,page:null,ordinal,text:chars.slice(start,end).join(''),startCharacter:start,endCharacter:end});
   }
   result.files.push({fileId,status:'ready',chunks,sha256,fileName:file.fileName,characters:chars.length,normalized,message:messages.ready});result.totalCharacters+=chars.length;
  }catch(error){result.files.push(failed(fileId,error instanceof LocalFailure?error.status:'read_failed'));}
 }
 return result;
}

