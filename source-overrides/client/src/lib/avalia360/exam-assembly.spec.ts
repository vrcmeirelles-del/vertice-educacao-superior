import {describe,expect,it} from 'vitest';
import {assembleExam,toAssemblyItems,toDraftQuestions,type AssemblySpec} from './exam-assembly';
import {competencyKeyOf,mergeIntoCatalog} from './competency-key';
import type {BankQuestion} from './question-bank';

const C1={id:'x1',code:'C1',title:'Contratos',period:3},C2={id:'x2',code:'C2',title:'Nexo causal',period:2};
const K1=competencyKeyOf(C1),K2=competencyKeyOf(C2);
let seq=0;
const rec=(bankId:string,comps:typeof C1[],difficulty:1|2|3|4|5=3,kind:'objetiva'|'discursiva'='objetiva'):BankQuestion=>({
 bankId,revision:1,institutionId:'i',courseId:'c',discipline:'Civil',createdAt:'2026-11-0'+(++seq%9+1)+'T00:00:00Z',status:'rascunho',
 competencies:comps,
 question:{id:bankId,disciplineId:'Civil',kind,statement:'Enunciado do item '+bankId,options:[{id:'A',text:'a'},{id:'B',text:'b'}],
  correctOptionId:'A',answerJustification:'ok',rubric:'r',expectedAnswer:'e',topicIds:[],competencyIds:comps.map(c=>c.id),purpose:['formativa'],
  estimatedDifficulty:difficulty,points:1,examTags:[],images:[]}});
const spec=(o:Partial<AssemblySpec>={}):AssemblySpec=>({total:3,requirements:[],targetLevel:3,kinds:['objetiva','discursiva'],exposureMonths:0,referenceDate:'2027-06-30',...o});

describe('montagem automática de prova',()=>{
 it('chave da competência igual à do servidor',()=>{
  expect(competencyKeyOf({code:' C1 ',title:'Interpretar  Contratos'})).toBe('cmp:c1|interpretar contratos');
 });
 it('usa a dificuldade observada quando calibrada e a declarada como reserva',()=>{
  const items=toAssemblyItems([rec('b1',[C1],1),rec('b2',[C1],1)],{b1:{applications:2,n:40,p:0.2,discrimination:0.4},b2:{applications:1,n:5,p:0.2,discrimination:0.1}},{});
  expect(items.find(i=>i.bankId==='b1')).toMatchObject({level:4,levelSource:'observada'});
  expect(items.find(i=>i.bankId==='b2')).toMatchObject({level:1,levelSource:'declarada'});
 });
 it('cobre a especificação por competência, da mais escassa para a mais abundante',()=>{
  const items=toAssemblyItems([rec('a1',[C1]),rec('a2',[C1]),rec('a3',[C1]),rec('b1',[C2])],{},{});
  const r=assembleExam(items,spec({total:2,requirements:[{key:K1,count:1},{key:K2,count:1}]}));
  expect(r.selected.map(s=>s.bankId).sort()).toEqual(['a1','b1']);
  expect(r.coverage).toEqual([{key:K1,requested:1,obtained:1},{key:K2,requested:1,obtained:1}]);
  expect(r.shortfalls).toEqual([]);
 });
 it('aproxima a dificuldade média do alvo e desempata por discriminação e id',()=>{
  const items=toAssemblyItems([rec('f',[C1],1),rec('m1',[C1],3),rec('m2',[C1],3),rec('d',[C1],5)],{m2:{applications:1,n:5,p:null,discrimination:0.5}},{});
  // alvo 3: primeiro m2 (empata com m1 em custo, maior discriminação), depois m1, depois f ou d (custo igual) -> d? (3+3+1)/3=2.33 vs (3+3+5)/3=3.67 -> empate: maior discriminação igual (0,2) -> menor id: d
  const r=assembleExam(items,spec({total:3}));
  expect(r.selected.map(s=>s.bankId)).toEqual(['m1','m2','d']);
  expect(r.meanLevel).toBeCloseTo(11/3,6);
 });
 it('mesma entrada ⇒ mesma prova, independentemente da ordem do banco',()=>{
  const recs=[rec('q3',[C1],2),rec('q1',[C2],4),rec('q2',[C1,C2],3),rec('q4',[C1],5)];
  const a=assembleExam(toAssemblyItems(recs,{},{}),spec({total:3,requirements:[{key:K1,count:2}]}));
  const b=assembleExam(toAssemblyItems([...recs].reverse(),{},{}),spec({total:3,requirements:[{key:K1,count:2}]}));
  expect(a.selected.map(s=>s.bankId)).toEqual(b.selected.map(s=>s.bankId));
 });
 it('controle de exposição pela janela em meses',()=>{
  const items=toAssemblyItems([rec('velho',[C1]),rec('recente',[C1]),rec('nunca',[C1])],{},
   {velho:{lastAppliedOn:'2026-11-30',applications:1},recente:{lastAppliedOn:'2027-03-01',applications:1}});
  const r=assembleExam(items,spec({total:3,exposureMonths:6}));
  expect(r.selected.map(s=>s.bankId).sort()).toEqual(['nunca','velho']);
  expect(r.excluded.exposure).toBe(1);
  expect(assembleExam(items,spec({total:3,exposureMonths:0})).selected).toHaveLength(3);
 });
 it('exclui itens de discriminação fraca comprovada ou negativa e filtra o tipo',()=>{
  const items=toAssemblyItems([rec('fraco',[C1]),rec('negativo',[C1]),rec('pouco',[C1]),rec('disc',[C1],3,'discursiva')],
   {fraco:{applications:2,n:40,p:0.5,discrimination:0.1},negativo:{applications:1,n:12,p:0.5,discrimination:-0.2},pouco:{applications:1,n:12,p:0.5,discrimination:0.1}},{});
  const r=assembleExam(items,spec({total:4,kinds:['objetiva']}));
  expect(r.selected.map(s=>s.bankId)).toEqual(['pouco']);
  expect(r.excluded).toEqual({kind:1,exposure:0,weak:2});
 });
 it('informa a falta de itens sem inventar questões',()=>{
  const r=assembleExam(toAssemblyItems([rec('a1',[C1])],{},{}),spec({total:3,requirements:[{key:K2,count:2}]}));
  expect(r.selected).toHaveLength(1);
  expect(r.shortfalls.join(' ')).toMatch(/c2\|nexo causal: 0 de 2/);
  expect(r.shortfalls.join(' ')).toMatch(/Montadas 1 de 3/);
 });
 it('valida a especificação',()=>{
  expect(()=>assembleExam([],spec({total:0}))).toThrow(/entre 1 e 200/);
  expect(()=>assembleExam([],spec({targetLevel:6}))).toThrow(/entre 1 e 5/);
 });
});

describe('rascunho a partir da prova montada',()=>{
 it('copia com sourceBankId e religa competências ao catálogo pela chave',()=>{
  const items=toAssemblyItems([rec('a1',[C1]),rec('b1',[C1,C2])],{},{});
  const catalog=[{id:'local-c1',code:'c1',title:'contratos',period:3}];
  let n=0;
  const out=toDraftQuestions(assembleExam(items,spec({total:2})).selected,'Civil',catalog,()=>'novo-'+(++n));
  expect(out.questions.map(q=>q.sourceBankId).sort()).toEqual(['a1','b1']);
  expect(out.questions.every(q=>q.competencyIds.includes('local-c1'))).toBe(true);
  expect(out.catalog.map(c=>c.code)).toEqual(['c1','C2']);
  expect(new Set(out.questions.map(q=>q.id)).size).toBe(2);
 });
 it('mesclagem ignora competência sem descritor',()=>{
  expect(mergeIntoCatalog([],[],['sem-descritor'])).toEqual({catalog:[],ids:[]});
 });
});
