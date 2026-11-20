import test from 'node:test';import assert from 'node:assert/strict';
import {ruleGrade,validateGrade} from '../../../supabase/functions/vertice-discursiva/core.ts';
import {runAction} from '../../../supabase/functions/vertice-discursiva/handler.ts';
const question={rubric:[{criterion:'Item a) Identifica a hipótese diagnóstica de pneumonia comunitária',points:6},{criterion:'Item b) Indica antibioticoterapia empírica adequada',points:4}]};
const answer='Paciente com quadro compatível com pneumonia comunitária. A hipótese diagnóstica principal é pneumonia.\nConduta: internação e observação.';
test('V5: pré-nota por regra com evidência literal da resposta, provisória',()=>{
 const g=ruleGrade(question,answer);
 assert.equal(g.criteria[0].score,6);
 assert.equal(g.criteria[1].score,0);
 for(const c of g.criteria)for(const e of c.evidence)assert.ok(answer.includes(e));
 assert.doesNotThrow(()=>validateGrade({...g,criteria:g.criteria.map(c=>({index:c.index,score:c.score,reason:c.reason,evidence:c.evidence}))},question,answer),'mesmo contrato da correção por IA');
 assert.match(g.feedback,/revisão docente/);
});
test('V5: com a IA suspensa, grade não chama provedor e grava avaliação provisória',async()=>{
 let calls=0,saved=null;
 const deps={aiOn:false,authorize:async()=>{},call:async()=>{calls++;throw Error('não deveria chamar');},
  rpc:async(action,payload)=>{if(action==='get_submission')return {submission:{id:'s1',version:1,answer,reviewed_at:null},question:{content:{...question,case:'c',command:'x',expectedAnswer:'y',competency:'z',referenceIds:['source:1']}}};if(action==='save_assessment'){saved=payload;return {};}return {};}};
 const out=await runAction({action:'grade',submissionId:'s1'},deps);
 assert.equal(calls,0);assert.equal(out.provisional,true);assert.equal(out.requiresHumanReview,true);assert.equal(out.assessments[0].provider,'regras');
 assert.equal(saved.assessment.suggestedScore,6);
});
