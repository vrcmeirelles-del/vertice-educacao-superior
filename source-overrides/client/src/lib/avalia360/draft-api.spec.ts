import {describe,expect,it,vi,beforeEach} from 'vitest';
const rpc=vi.fn();
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
import {saveAssessmentDraft} from './draft-api';
import type {QuestionDraft} from './question-draft';
const q:QuestionDraft={
 id:'q1',disciplineId:'civil',kind:'objetiva',statement:'Considere o caso concreto e assinale a correta',
 options:[{id:'A',text:'Resposta A'},{id:'B',text:'Resposta B'}],correctOptionId:'A',
 rubric:'',topicIds:['t1'],competencyIds:['c1'],purpose:['formativa'],
 estimatedDifficulty:3,points:2,examTags:['oab'],images:[]
};
beforeEach(()=>rpc.mockReset());
describe('cliente de rascunhos do Avalia 360°',()=>{
 it('envia somente metadados serializáveis e recebe comprovante do servidor',async()=>{
   rpc.mockResolvedValue({data:{id:'d1',revision:1,status:'draft'},error:null});
   const r=await saveAssessmentDraft({institutionId:'ies-a',courseId:'direito',disciplineId:'civil',questions:[q]});
   expect(r).toMatchObject({ok:true,receipt:{id:'d1',revision:1}});
   expect(rpc).toHaveBeenCalledOnce();
   const [name,parameters]=rpc.mock.calls[0];
   expect(name).toBe('vertice_avalia_draft');
   expect(parameters.p_payload.questions[0].pendingImageCount).toBe(0);
   expect(parameters.p_payload.questions[0]).not.toHaveProperty('images');
 });
 it('não declara sucesso sem confirmação válida da RPC',async()=>{
   rpc.mockResolvedValue({data:null,error:null});
   const r=await saveAssessmentDraft({institutionId:'ies-a',courseId:'direito',disciplineId:'civil',questions:[q]});
   expect(r).toMatchObject({ok:false,error:{code:'INVALID_RECEIPT'}});
 });
 it('não transmite arquivos locais como se já estivessem armazenados',async()=>{
   const image={localId:'temp',file:{size:100,type:'image/png'} as File,
     altText:'Imagem',caption:'',placement:'enunciado' as const,rightsStatus:'autoral' as const};
   const r=await saveAssessmentDraft({institutionId:'ies-a',courseId:'direito',disciplineId:'civil',
     questions:[{...q,images:[image]}]});
   expect(r).toMatchObject({ok:false,error:{code:'IMAGE_UPLOAD_REQUIRED'}});
   expect(rpc).not.toHaveBeenCalled();
 });
 it('envia token de revisão para atualização',async()=>{
   rpc.mockResolvedValue({data:{id:'d1',revision:2,status:'draft'},error:null});
   await saveAssessmentDraft({institutionId:'ies-a',courseId:'direito',disciplineId:'civil',
     draftId:'d1',expectedRevision:1,questions:[q]});
   expect(rpc.mock.calls[0][1].p_payload).toMatchObject({id:'d1',expectedRevision:1});
   expect(rpc.mock.calls[0][1].p_action).toBe('update');
 });
});
