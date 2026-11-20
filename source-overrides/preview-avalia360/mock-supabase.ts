/**
 * Stub EXCLUSIVO da prévia visual — nenhum cliente Supabase é inicializado.
 * Os recibos e tickets simulados não são credenciais de Storage.
 * Somente dados sintéticos ou inseridos pelo próprio visitante permanecem no browser.
 */
type Body=Record<string,unknown>;
type MockRow={id:string;revision:number;status:'draft';scope:{institution:string;course:string;discipline:string};snapshot:{questions:unknown[];meta:unknown;curriculumStatus:'unmapped'}};
type MockMedia={imageId:string;path:string;sha256:string;mime:string;sizeBytes:number;token:string;uploaded:boolean};
const storeKey='vertice-avalia360-preview-v1';
const mediaMap=new Map<string,MockMedia>();
const readAll=():MockRow[]=>{
 try{
  const parsed=JSON.parse(localStorage.getItem(storeKey)||'[]');
  return Array.isArray(parsed)?parsed:[];
 }catch{return [];}
};
const writeAll=(value:MockRow[])=>{
 localStorage.setItem(storeKey,JSON.stringify(value));
};
const fail=(code:string,message:string)=>({data:null,error:{code,message}});
const success=(data:unknown)=>({data,error:null});
const uuid=()=>crypto.randomUUID();

export const supabase={
 rpc:async(name:string,p:Body)=>{
  if(name!=='vertice_avalia_draft')return fail('DEMO_UNSUPPORTED','Operação fora do escopo da demonstração.');
  const institution=String(p.p_institution||'');
  const course=String(p.p_course||'');
  const discipline=String(p.p_discipline||'');
  const action=String(p.p_action||'');
  const payload=(p.p_payload||{}) as Body;
  if(!institution||!course||!discipline)return fail('DEMO_SCOPE','Selecione instituição, curso e disciplina.');
  const scope={institution,course,discipline};
  const all=readAll();
  const existing=all.find(x=>x.id===String(payload.id||'')&&
    x.scope.institution===institution&&x.scope.course===course&&x.scope.discipline===discipline);
  if(action==='get')return existing?success(existing):fail('DEMO_NOT_FOUND','Rascunho local não encontrado neste navegador.');
  if(action!=='create'&&action!=='update')return fail('DEMO_UNSUPPORTED','Operação não implementada nesta prévia.');
  const questions=payload.questions;
  if(!Array.isArray(questions)||questions.length<1)return fail('DEMO_EMPTY','Inclua uma questão.');
  const meta=payload.meta||{};
  if(action==='update'){
   if(!existing)return fail('DEMO_NOT_FOUND','Rascunho local não encontrado.');
   if(existing.revision!==payload.expectedRevision)
    return fail('VERSION_CONFLICT','Outra versão local foi gravada. Recarregue o rascunho.');
   existing.revision++;
   existing.snapshot={questions,meta,curriculumStatus:'unmapped'};
   try{writeAll(all)}catch{return fail('LOCAL_QUOTA','Espaço de armazenamento local indisponível.');}
   return success({id:existing.id,revision:existing.revision,status:'draft'});
  }
  const draft:MockRow={id:uuid(),revision:1,status:'draft',scope,snapshot:{questions,meta,curriculumStatus:'unmapped'}};
  try{writeAll([...all,draft])}catch{return fail('LOCAL_QUOTA','Espaço de armazenamento local indisponível.');}
  return success({id:draft.id,revision:1,status:'draft'});
 },
 functions:{
  invoke:async(name:string,{body}:{body:Body})=>{
   if(name!=='vertice-avalia-media')return fail('DEMO_UNSUPPORTED','Serviço externo não disponível.');
   const action=String(body.action||'');
   const institution=String(body.institutionId||'');
   const course=String(body.courseId||'');
   const discipline=String(body.disciplineId||'');
   const question=String(body.questionId||'');
   if(!institution||!course||!discipline||!question)return fail('DEMO_SCOPE','Escopo incompleto.');
   if(action==='prepare'){
    const imageId=uuid();
    const mime=String(body.mime||'');
    const extension=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
    const path=[institution,course,'visitante-demo',question,imageId+'.'+extension].join('/');
    const record:MockMedia={imageId,path,sha256:String(body.sha256),mime,sizeBytes:Number(body.sizeBytes),token:'demo-'+uuid(),uploaded:false};
    mediaMap.set(path,record);
    return success({path,imageId,token:record.token});
   }
   const path=String(body.path||'');
   const record=mediaMap.get(path);
   if(action!=='confirm'||!record||record.imageId!==body.imageId||
      !record.uploaded||record.sha256!==body.sha256||record.mime!==body.mime||
      record.sizeBytes!==body.sizeBytes)return fail('DEMO_UPLOAD','Anexo local não confirmado.');
   return success({imageId:record.imageId,path,sha256:record.sha256,mime:record.mime,sizeBytes:record.sizeBytes});
  }
 },
 storage:{
  from:(_bucket:string)=>({
   uploadToSignedUrl:async(path:string,token:string,file:File)=>{
    const record=mediaMap.get(path);
    if(!record||record.token!==token||record.sizeBytes!==file.size||record.mime!==file.type)
     return {data:null,error:{message:'Ticket de demonstração inválido'}};
    record.uploaded=true;
    return {data:{path},error:null};
   }
  })
 }
};
