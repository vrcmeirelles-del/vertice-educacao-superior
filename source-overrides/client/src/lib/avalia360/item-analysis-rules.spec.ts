import {describe,expect,it} from 'vitest';
import {discriminationLabel,facilityLabel,observedLevel,readItem,reliabilityLabel,sampleLabel,type ItemStat} from './item-analysis-rules';

const base:ItemStat={questionId:'q',order:1,kind:'objetiva',statement:'x',points:1,declaredDifficulty:3,sourceBankId:null,correctOptionId:'A',
 n:40,p:0.55,pUpper:0.9,pLower:0.3,discrimination:0.6,pointBiserial:0.45,blanks:0,multiples:0,
 options:[{optionId:'A',correct:true,n:22,nUpper:10,nLower:3},{optionId:'B',correct:false,n:10,nUpper:1,nLower:4},
  {optionId:'C',correct:false,n:6,nUpper:0,nLower:2},{optionId:'D',correct:false,n:1,nUpper:0,nLower:1}]};

describe('leitura da análise de itens (regras explícitas)',()=>{
 it('faixas de facilidade, nível observado, discriminação e confiabilidade',()=>{
  expect([0.95,0.75,0.5,0.2,0.1].map(facilityLabel)).toEqual(['muito fácil','fácil','média','difícil','muito difícil']);
  expect([0.95,0.75,0.5,0.2,0.1].map(observedLevel)).toEqual([1,2,3,4,5]);
  expect([0.45,0.35,0.25,0.1].map(discriminationLabel)).toEqual(['muito boa','boa','marginal','fraca']);
  expect([0.85,0.75,0.65,0.4,null].map(reliabilityLabel)).toEqual(['boa','aceitável','questionável','baixa','não calculável']);
  expect([5,15,40].map(sampleLabel)[0]).toMatch(/insuficiente/);
 });
 it('questão boa: manter',()=>{
  const r=readItem({...base,options:base.options!.map(o=>o.optionId==='D'?{...o,n:4}:o)},40);
  expect(r.recommendation).toBe('manter');
  expect(r.flags).toEqual([]);
 });
 it('alternativa quase não escolhida não funciona',()=>{
  const r=readItem(base,40);
  expect(r.distractors.find(d=>d.optionId==='D')?.flag).toBe('nao_funciona');
  expect(r.flags.join(' ')).toMatch(/D quase não escolhida/);
 });
 it('ponto-bisserial negativo pede verificação do gabarito',()=>{
  expect(readItem({...base,pointBiserial:-0.1},40).recommendation).toBe('revisar_gabarito');
 });
 it('distrator que atrai mais os melhores que o gabarito pede verificação do gabarito',()=>{
  const opts=[{optionId:'A',correct:true,n:15,nUpper:3,nLower:5},{optionId:'B',correct:false,n:20,nUpper:8,nLower:2},
   {optionId:'C',correct:false,n:5,nUpper:0,nLower:4}];
  const r=readItem({...base,options:opts},40);
  expect(r.distractors.find(d=>d.optionId==='B')?.flag).toBe('atrai_melhores');
  expect(r.recommendation).toBe('revisar_gabarito');
 });
 it('discriminação fraca e extremos de facilidade pedem revisão',()=>{
  expect(readItem({...base,discrimination:0.1},40).recommendation).toBe('revisar');
  expect(readItem({...base,p:0.95},40).recommendation).toBe('revisar');
  expect(readItem({...base,p:0.1},40).recommendation).toBe('revisar');
 });
 it('dificuldade declarada distante da observada gera alerta',()=>{
  expect(readItem({...base,declaredDifficulty:1,p:0.2},40).flags.join(' ')).toMatch(/nível 1.*nível 4/);
 });
 it('amostra pequena não gera recomendação',()=>{
  expect(readItem({...base,pointBiserial:-0.5},8).recommendation).toBe('amostra_insuficiente');
 });
 it('discursiva sem análise de alternativas',()=>{
  const r=readItem({...base,kind:'discursiva',options:null,correctOptionId:null},40);
  expect(r.distractors).toEqual([]);
 });
});

import {prepareBankQuestion,reuseBankQuestion} from './question-bank';
import type {QuestionDraft} from './question-draft';
describe('vínculo da questão reaproveitada com o banco',()=>{
 const q:QuestionDraft={id:'q1',disciplineId:'Civil',kind:'objetiva',statement:'Enunciado suficientemente longo',options:[{id:'A',text:'a'},{id:'B',text:'b'}],
  correctOptionId:'A',answerJustification:'ok',rubric:'',topicIds:[],competencyIds:[],purpose:['formativa'],estimatedDifficulty:3,points:1,examTags:[],images:[]};
 it('a cópia na prova guarda a origem; uma nova entrada no banco não herda a origem antiga',()=>{
  const bank=prepareBankQuestion({institutionId:'i',courseId:'c',discipline:'Civil',question:q,bankId:'b1',createdAt:'2026-11-21T00:00:00Z'});
  const copy=reuseBankQuestion(bank,'nova','Civil');
  expect(copy.sourceBankId).toBe('b1');
  const again=prepareBankQuestion({institutionId:'i',courseId:'c',discipline:'Civil',question:copy,bankId:'b2',createdAt:'2026-11-21T00:00:00Z'});
  expect(again.question.sourceBankId).toBeUndefined();
 });
});
