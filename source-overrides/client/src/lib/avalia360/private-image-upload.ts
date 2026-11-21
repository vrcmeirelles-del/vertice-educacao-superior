/**
 * Vértice Avalia 360° — cliente de upload privado por ticket assinado.
 * O servidor DEVE autorizar curso/IES/docente, gerar o caminho e confirmar
 * o SHA-256 contra os bytes armazenados. Nunca confiar em metadata do cliente.
 * Sem função `vertice-avalia-media` publicada, retorna erro.
 */
import {supabase} from '@/lib/supabase';
import {inspectLocalImage} from './image-inspection';
const BUCKET='avalia360-private';
export type UploadedImageReceipt={
 imageId:string;path:string;sha256:string;mime:string;sizeBytes:number;
};
export type UploadContext={
 institutionId:string;courseId:string;disciplineId:string;questionId:string;
};
type MediaResponse={path?:string;token?:string;imageId?:string;sha256?:string;mime?:string;sizeBytes?:number};
function assertResponse(v:unknown):MediaResponse{
 if(!v||typeof v!=='object')throw new Error('INVALID_MEDIA_RESPONSE');
 return v as MediaResponse;
}
export async function uploadQuestionImage(file:File,ctx:UploadContext):Promise<UploadedImageReceipt>{
 if(!ctx.institutionId||!ctx.courseId||!ctx.disciplineId||!ctx.questionId)
   throw new Error('INVALID_UPLOAD_SCOPE');
 const inspection=await inspectLocalImage(file);
 const claim={...ctx,sha256:inspection.sha256,mime:inspection.mime,sizeBytes:inspection.sizeBytes};
 const prepared=await supabase.functions.invoke('vertice-avalia-media',{
   body:{action:'prepare',...claim}
 });
 if(prepared.error)throw new Error('UPLOAD_PREPARATION_FAILED');
 const ticket=assertResponse(prepared.data);
 if(!ticket.path || !ticket.token || !ticket.imageId ||
    !ticket.path.startsWith(ctx.institutionId+'/'+ctx.courseId+'/'))
   throw new Error('INVALID_UPLOAD_TICKET');
 const {error:uploadError}=await supabase.storage.from(BUCKET)
   .uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:inspection.mime,upsert:false});
 if(uploadError)throw new Error('UPLOAD_STORAGE_FAILED');
 const confirmed=await supabase.functions.invoke('vertice-avalia-media',{
   body:{action:'confirm',...claim,path:ticket.path,imageId:ticket.imageId}
 });
 if(confirmed.error)throw new Error('UPLOAD_CONFIRMATION_FAILED');
 const data=assertResponse(confirmed.data);
 if(data.imageId!==ticket.imageId||data.path!==ticket.path||
    data.sha256!==inspection.sha256||data.mime!==inspection.mime||
    data.sizeBytes!==inspection.sizeBytes)throw new Error('UPLOAD_INTEGRITY_MISMATCH');
 return {imageId:data.imageId,path:data.path,sha256:data.sha256,
   mime:data.mime,sizeBytes:data.sizeBytes};
}

export type RestoredImage={file:File;receipt:UploadedImageReceipt;questionId:string};
type ReadRow={questionId?:unknown;imageId?:unknown;path?:unknown;sha256?:unknown;mime?:unknown;sizeBytes?:unknown;url?:unknown};
/**
 * Recupera as imagens de um caderno salvo para reabrir em edição.
 * URLs curtas emitidas pelo servidor; cada arquivo é conferido localmente
 * (SHA-256, assinatura e tamanho) antes de ser aceito.
 */
export async function downloadDraftImages(ctx:{institutionId:string;courseId:string;disciplineId:string;draftId:string},
 fetcher:typeof fetch=fetch):Promise<Map<string,RestoredImage>>{
 const res=await supabase.functions.invoke('vertice-avalia-media',{body:{action:'read',...ctx}});
 if(res.error)throw new Error('IMAGE_READ_FAILED');
 const rows=(res.data as {images?:unknown})?.images;
 if(!Array.isArray(rows))throw new Error('INVALID_MEDIA_RESPONSE');
 const out=new Map<string,RestoredImage>();
 for(const raw of rows as ReadRow[]){
  if(typeof raw.imageId!=='string'||typeof raw.path!=='string'||typeof raw.sha256!=='string'||
     typeof raw.mime!=='string'||typeof raw.sizeBytes!=='number'||typeof raw.url!=='string'||typeof raw.questionId!=='string'||
     !raw.path.startsWith(ctx.institutionId+'/'+ctx.courseId+'/'))
   throw new Error('INVALID_MEDIA_RESPONSE');
  const response=await fetcher(raw.url);
  if(!response.ok)throw new Error('IMAGE_DOWNLOAD_FAILED');
  const blob=await response.blob();
  const file=new File([blob],raw.path.split('/').pop()||raw.imageId,{type:raw.mime});
  const inspection=await inspectLocalImage(file);
  if(inspection.sha256!==raw.sha256||inspection.sizeBytes!==raw.sizeBytes||inspection.mime!==raw.mime)
   throw new Error('UPLOAD_INTEGRITY_MISMATCH');
  out.set(raw.imageId,{file,questionId:raw.questionId,
   receipt:{imageId:raw.imageId,path:raw.path,sha256:raw.sha256,mime:raw.mime,sizeBytes:raw.sizeBytes}});
 }
 return out;
}
