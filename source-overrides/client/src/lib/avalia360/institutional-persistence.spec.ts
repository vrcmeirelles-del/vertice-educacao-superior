import {describe,expect,it,vi,beforeEach} from 'vitest';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc,functions:{invoke}}}));
import {listAssessmentDrafts,editableQuestionsFromSnapshot} from './draft-api';
import {listInstitutionalBank,saveInstitutionalBank} from './question-bank-api';
import {downloadDraftImages} from './private-image-upload';
import type {QuestionDraft} from './question-draft';
const q:QuestionDraft={
 id:'q1',disciplineId:'Direito Civil',kind:'objetiva',statement:'Considere o caso concreto e assinale a correta',
 options:[{id:'A',text:'Resposta A'},{id:'B',text:'Resposta B'}],correctOptionId:'A',answerJustification:'Art. 186 do CC.',
 rubric:'',topicIds:['t1'],competencyIds:['c1'],purpose:['formativa'],
 estimatedDifficulty:3,points:2,examTags:['oab'],images:[]
};
beforeEach(()=>{rpc.mockReset();invoke.mockReset();});
describe('persistência institucional do Avalia 360°',()=>{
 it('lista rascunhos pela RPC com escopo de curso e disciplina',async()=>{
  rpc.mockResolvedValue({data:[{id:'d1',revision:2,status:'draft',title:'P1',semester:'2027/1',questionCount:1,updatedAt:'2026-11-21T10:00:00Z'}],error:null});
  const r=await listAssessmentDrafts({institutionId:'i',courseId:'c',disciplineId:'Direito Civil'});
  expect(r).toMatchObject({ok:true,drafts:[{id:'d1',revision:2}]});
  expect(rpc).toHaveBeenCalledWith('vertice_avalia_draft',expect.objectContaining({p_action:'list',p_discipline:'Direito Civil'}));
 });
 it('repassa a recusa do servidor sem simular sucesso',async()=>{
  rpc.mockResolvedValue({data:null,error:{code:'42501',message:'Avalia 360° restrito'}});
  expect(await listAssessmentDrafts({institutionId:'i',courseId:'c',disciplineId:'x'})).toMatchObject({ok:false,error:{code:'42501'}});
 });
 it('reconstrói questões editáveis e preserva o gabarito do docente',()=>{
  const restored=editableQuestionsFromSnapshot({questions:[{...q,images:[]} as unknown as Record<string,unknown>]});
  expect(restored?.questions[0]).toMatchObject({id:'q1',correctOptionId:'A',answerJustification:'Art. 186 do CC.',images:[]});
 });
 it('mantém em consulta se a imagem não foi recuperada',()=>{
  expect(editableQuestionsFromSnapshot({questions:[{...q,images:[{imageId:'m1'}]} as unknown as Record<string,unknown>]})).toBeNull();
 });
 it('religa imagens recuperadas com metadados e comprovante, sem novo envio',()=>{
  const file=new File([new Uint8Array([1])],'m1.png',{type:'image/png'});
  const receipt={imageId:'m1',path:'i/c/m1.png',sha256:'a'.repeat(64),mime:'image/png',sizeBytes:1};
  const snapshot={questions:[{...q,images:[
   {imageId:'m1',path:receipt.path,sha256:receipt.sha256,altText:'Mapa do imóvel',caption:'Figura 1',placement:'alternativa',alternativeId:'B',rightsStatus:'autoral',order:0}
  ]} as unknown as Record<string,unknown>]};
  const out=editableQuestionsFromSnapshot(snapshot,new Map([['m1',{file,receipt,questionId:'q1'}]]),()=>'local-1');
  expect(out?.questions[0].images[0]).toMatchObject({localId:'local-1',file,altText:'Mapa do imóvel',placement:'alternativa',alternativeId:'B',rightsStatus:'autoral'});
  expect(out?.receipts).toEqual([{localId:'local-1',file,receipt,questionId:'q1'}]);
  expect(editableQuestionsFromSnapshot(snapshot,new Map([['m1',{file,receipt,questionId:'outra'}]]))).toBeNull();
 });
 it('grava no banco do curso e exige confirmação do mesmo identificador',async()=>{
  rpc.mockImplementation(async(_n:string,args:{p_payload:{record:{bankId:string}}})=>({data:{bankId:args.p_payload.record.bankId,revision:1},error:null}));
  const saved=await saveInstitutionalBank({institutionId:'i',courseId:'c',discipline:'Direito Civil',question:q,bankId:'b1',createdAt:new Date().toISOString()});
  expect(saved.bankId).toBe('b1');
  rpc.mockResolvedValue({data:{bankId:'outro'},error:null});
  await expect(saveInstitutionalBank({institutionId:'i',courseId:'c',discipline:'Direito Civil',question:q,bankId:'b2',createdAt:new Date().toISOString()})).rejects.toThrow('não confirmou');
 });
 it('filtra a consulta do banco localmente sobre o recorte autorizado',async()=>{
  rpc.mockResolvedValue({data:[
   {bankId:'b1',revision:1,status:'rascunho',institutionId:'i',courseId:'c',discipline:'Direito Civil',createdAt:'2026-11-21T10:00:00Z',indexLabels:['contratos'],question:q},
   {bankId:'b2',revision:1,status:'rascunho',institutionId:'i',courseId:'c',discipline:'Direito Civil',createdAt:'2026-11-20T10:00:00Z',indexLabels:['família'],question:{...q,statement:'Outro enunciado sobre guarda compartilhada'}}
  ],error:null});
  const found=await listInstitutionalBank('i','c','Direito Civil','contratos');
  expect(found.map(x=>x.bankId)).toEqual(['b1']);
 });

 it('aceita imagem baixada só se o SHA-256 conferir localmente',async()=>{
  const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3]);
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',png))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const row={questionId:'q1',imageId:'m1',path:'i/c/m1.png',sha256:sha,mime:'image/png',sizeBytes:png.byteLength,url:'https://signed.example/m1'};
  invoke.mockResolvedValue({data:{images:[row]},error:null});
  const fetcher=vi.fn(async()=>new Response(png,{status:200})) as unknown as typeof fetch;
  const got=await downloadDraftImages({institutionId:'i',courseId:'c',disciplineId:'Direito Civil',draftId:'d1'},fetcher);
  expect(got.get('m1')?.receipt).toEqual({imageId:'m1',path:'i/c/m1.png',sha256:sha,mime:'image/png',sizeBytes:png.byteLength});
  invoke.mockResolvedValue({data:{images:[{...row,sha256:'0'.repeat(64)}]},error:null});
  await expect(downloadDraftImages({institutionId:'i',courseId:'c',disciplineId:'Direito Civil',draftId:'d1'},fetcher)).rejects.toThrow('UPLOAD_INTEGRITY_MISMATCH');
  invoke.mockResolvedValue({data:{images:[{...row,path:'outra/c/m1.png'}]},error:null});
  await expect(downloadDraftImages({institutionId:'i',courseId:'c',disciplineId:'Direito Civil',draftId:'d1'},fetcher)).rejects.toThrow('INVALID_MEDIA_RESPONSE');
 });
});
