import {describe,expect,it,vi,beforeEach} from 'vitest';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
import {checklistSummary,decideReview,listReviewQueue,ReviewError,submitForReview} from './review-api';
import {checkAssessment} from './item-checklist';
beforeEach(()=>rpc.mockReset());
const result=checkAssessment([{kind:'objetiva',statement:'Assinale a correta no caso.',options:[{id:'A',text:'x'},{id:'B',text:'y'}],
 correctOptionId:'A',answerJustification:'ok',rubric:'',points:1,competencyIds:[],topicIds:[],images:[]}]);
describe('cliente da validação pelo colegiado',()=>{
 it('envia a versão salva com resumo do checklist sem conteúdo da prova',async()=>{
  rpc.mockResolvedValue({data:{id:'d1',revision:3,status:'submitted'},error:null});
  const out=await submitForReview('i','c',{id:'d1',revision:3,status:'draft'},result);
  expect(out.status).toBe('submitted');
  const [name,args]=rpc.mock.calls[0];
  expect(name).toBe('vertice_avalia_review');
  expect(args).toMatchObject({p_action:'submit',p_payload:{id:'d1',expectedRevision:3}});
  expect(JSON.stringify(args.p_payload.checklist)).not.toContain('Assinale');
 });
 it('resumo traz códigos e contagens',()=>{
  expect(checklistSummary(result)).toMatchObject({blocking:0,warnings:1,codes:[{code:'SEM_VINCULO_CURRICULAR',question:1}]});
 });
 it('devolução leva motivos padronizados e justificativa',async()=>{
  rpc.mockResolvedValue({data:{id:'d1',revision:3,status:'draft'},error:null});
  await decideReview('i','c',{id:'d1',revision:3,decision:'return',justification:'Enunciado ambíguo na questão 2.',reasons:['enunciado']});
  expect(rpc.mock.calls[0][1]).toMatchObject({p_action:'return',p_payload:{reasons:['enunciado'],expectedRevision:3}});
 });
 it('propaga o código de recusa do servidor',async()=>{
  rpc.mockResolvedValue({data:null,error:{code:'42501',message:'restrito'}});
  await expect(listReviewQueue('i','c')).rejects.toMatchObject({code:'42501'});
  await expect(listReviewQueue('i','c')).rejects.toBeInstanceOf(ReviewError);
 });
});
