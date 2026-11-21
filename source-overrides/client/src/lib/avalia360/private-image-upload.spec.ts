import {beforeEach,describe,expect,it,vi} from 'vitest';
const {invoke,uploadToSignedUrl}=vi.hoisted(()=>({
 invoke:vi.fn(),uploadToSignedUrl:vi.fn()
}));
vi.mock('@/lib/supabase',()=>({supabase:{
 functions:{invoke},storage:{from:()=>({uploadToSignedUrl})}
}}));
import {uploadQuestionImage} from './private-image-upload';
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const file={size:png.length,type:'image/png',arrayBuffer:async()=>png.buffer.slice(0)} as File;
const context={institutionId:'ies1',courseId:'direito',disciplineId:'civil',questionId:'q1'};
beforeEach(()=>{invoke.mockReset();uploadToSignedUrl.mockReset()});
describe('upload privado Avalia 360°',()=>{
 it('envia ticket e confirma hash sem expor uma URL pública',async()=>{
   const digest=await crypto.subtle.digest('SHA-256',png);
   const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
   const path='ies1/direito/docente/q1/image.png';
   invoke.mockResolvedValueOnce({error:null,data:{path,token:'signed-secret',imageId:'m1'}})
     .mockResolvedValueOnce({error:null,data:{path,imageId:'m1',sha256:hash,mime:'image/png',sizeBytes:png.length}});
   uploadToSignedUrl.mockResolvedValue({error:null});
   const receipt=await uploadQuestionImage(file,context);
   expect(receipt).toMatchObject({imageId:'m1',sha256:hash});
   expect(uploadToSignedUrl).toHaveBeenCalledOnce();
   expect(invoke).toHaveBeenCalledTimes(2);
 });
 it('recusa ticket forjado de outra instituição',async()=>{
   invoke.mockResolvedValueOnce({error:null,data:{path:'outra-ies/direito/x',token:'t',imageId:'m1'}});
   await expect(uploadQuestionImage(file,context)).rejects.toThrow('INVALID_UPLOAD_TICKET');
   expect(uploadToSignedUrl).not.toHaveBeenCalled();
 });
 it('não confirma upload se o storage falhar',async()=>{
   invoke.mockResolvedValueOnce({error:null,data:{path:'ies1/direito/x',token:'t',imageId:'m1'}});
   uploadToSignedUrl.mockResolvedValue({error:{message:'falhou'}});
   await expect(uploadQuestionImage(file,context)).rejects.toThrow('UPLOAD_STORAGE_FAILED');
   expect(invoke).toHaveBeenCalledTimes(1);
 });
 it('recusa divergência entre hash enviado e arquivo confirmado',async()=>{
   invoke.mockResolvedValueOnce({error:null,data:{path:'ies1/direito/x',token:'t',imageId:'m1'}})
     .mockResolvedValueOnce({error:null,data:{path:'ies1/direito/x',imageId:'m1',sha256:'0'.repeat(64),mime:'image/png',sizeBytes:png.length}});
   uploadToSignedUrl.mockResolvedValue({error:null});
   await expect(uploadQuestionImage(file,context)).rejects.toThrow('UPLOAD_INTEGRITY_MISMATCH');
 });
});
