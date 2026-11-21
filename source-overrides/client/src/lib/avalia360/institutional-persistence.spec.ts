import {describe,expect,it,vi,beforeEach} from 'vitest';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
import {listAssessmentDrafts,editableQuestionsFromSnapshot} from './draft-api';
import {listInstitutionalBank,saveInstitutionalBank} from './question-bank-api';
import type {QuestionDraft} from './question-draft';
const q:QuestionDraft={
 id:'q1',disciplineId:'Direito Civil',kind:'objetiva',statement:'Considere o caso concreto e assinale a correta',
 options:[{id:'A',text:'Resposta A'},{id:'B',text:'Resposta B'}],correctOptionId:'A',answerJustification:'Art. 186 do CC.',
 rubric:'',topicIds:['t1'],competencyIds:['c1'],purpose:['formativa'],
 estimatedDifficulty:3,points:2,examTags:['oab'],images:[]
};
beforeEach(()=>rpc.mockReset());
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
  expect(restored?.[0]).toMatchObject({id:'q1',correctOptionId:'A',answerJustification:'Art. 186 do CC.',images:[]});
 });
 it('mantém em consulta o caderno com imagem armazenada',()=>{
  expect(editableQuestionsFromSnapshot({questions:[{...q,images:[{imageId:'m1'}]} as unknown as Record<string,unknown>]})).toBeNull();
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
});
