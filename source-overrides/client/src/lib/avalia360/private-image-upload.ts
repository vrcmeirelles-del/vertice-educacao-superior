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
