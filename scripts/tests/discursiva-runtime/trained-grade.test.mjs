import test from 'node:test';import assert from 'node:assert/strict';
import {train,predict,features,MIN_TRAINING} from '../../../supabase/functions/vertice-discursiva/trained-grade.ts';
import {ruleGrade} from '../../../supabase/functions/vertice-discursiva/core.ts';
import {runAction} from '../../../supabase/functions/vertice-discursiva/handler.ts';

const question={case:'Paciente com febre e tosse produtiva há três dias.',command:'Indique diagnóstico e conduta.',competency:'Raciocínio clínico',expectedAnswer:'Pneumonia comunitária; solicitar radiografia de tórax e iniciar antibioticoterapia empírica com amoxicilina.',referenceIds:['source:1'],
 rubric:[{criterion:'Item a) Identifica a hipótese diagnóstica de pneumonia comunitária',points:5},{criterion:'Item b) Indica antibioticoterapia empírica e radiografia de tórax',points:5}]};
const answers=[
 'Hipótese diagnóstica: pneumonia comunitária. Solicitar radiografia de tórax e iniciar antibioticoterapia empírica com amoxicilina.',
 'Pneumonia comunitária. Conduta: antibioticoterapia empírica.',
 'Quadro gripal; repouso e hidratação.',
 'Hipótese de pneumonia. Pedir radiografia.',
 'Não sei.',
 'Diagnóstico provável de pneumonia comunitária com indicação de radiografia de tórax, amoxicilina empírica e reavaliação em 48 horas.',
];
// Docentes deste curso dão notas que a regra subestima (a regra é conservadora): o modelo deve aprender.
const teacher=a=>Math.min(10,Math.round((ruleGrade(question,a).total*0.6+features(question,a)[2]*6+1)*2)/2);
const history=n=>Array.from({length:n},(_,i)=>{const a=answers[i%answers.length]+(i%2?' Reavaliar.':'');return {question,answer:a,score:teacher(a)};});

test('sem histórico suficiente, não treina e informa quanto falta',()=>{
 const r=train(history(MIN_TRAINING-1));
 assert.equal(r.ready,false);assert.match(r.reason,/29 de 30/);assert.equal(r.model,undefined);
});
test('com histórico, aprende o padrão docente e só é aprovado se superar a regra em dados não vistos',()=>{
 const r=train(history(60));
 assert.equal(r.ready,true,r.reason);
 assert.ok(r.cvMae<=r.ruleMae-0.25,`cv ${r.cvMae} vs regra ${r.ruleMae}`);assert.ok(r.cvCorr>=0.5);
 const p=predict(r.model,question,answers[0]);
 assert.ok(p>=0&&p<=10&&p*2===Math.round(p*2));
});
test('notas docentes sem relação com a resposta: o modelo não supera a regra e fica travado',()=>{
 const noisy=history(60).map((r,i)=>({...r,score:[0,10,3,8,5,1,9][i%7]}));
 const r=train(noisy);assert.equal(r.ready,false);assert.ok(r.cvMae<r.ruleMae,'a média do curso erra menos que a regra...');assert.match(r.reason,/não acompanha a nota docente/,'...mas não acompanha as respostas');
});
test('linhas inválidas são descartadas antes do treino',()=>{
 const r=train([...history(10),{question,answer:'x',score:15},{question:null,answer:'x',score:5},{question,answer:'x',score:'abc'}]);
 assert.equal(r.n,10);
});
const deps=(rows,store)=>({aiOn:false,authorize:async()=>{},call:async()=>{throw Error('não deveria chamar provedor');},trainingSet:async()=>rows,
 rpc:async(action,payload)=>{if(action==='get_submission')return {submission:{id:'s1',version:1,answer:answers[3],reviewed_at:null},question:{content:question}};if(action==='save_assessment')store.saved=payload;return {};}});
test('handler: modelo aprovado vira sugestão, regra continua visível, revisão docente obrigatória',async()=>{
 const store={};const out=await runAction({action:'grade',submissionId:'s1'},deps(history(60),store));
 assert.equal(out.assessments[0].provider,'modelo-treinado');assert.equal(out.assessments[1].provider,'regras');
 assert.equal(out.suggestedScore,out.assessments[0].total);assert.equal(out.requiresHumanReview,true);assert.equal(out.training.ready,true);
 assert.deepEqual(out.assessments[0].criteria,[],'o modelo não inventa nota por critério');
 assert.equal(store.saved.assessment.promptVersion,'pre-nota-treinada-v1');
});
test('handler: sem histórico, comportamento idêntico ao da regra e motivo registrado',async()=>{
 const store={};const out=await runAction({action:'grade',submissionId:'s1'},deps([],store));
 assert.equal(out.assessments.length,1);assert.equal(out.assessments[0].provider,'regras');
 assert.equal(out.suggestedScore,ruleGrade(question,answers[3]).total);assert.equal(out.training.ready,false);
});
