import {describe,it,expect} from 'vitest';
import {masteryContract,aggregateMastery,MASTERY_RULES} from './mastery';

const inst='00000000-0000-4000-8000-000000000011',c1='00000000-0000-4000-8000-000000000021',c2='00000000-0000-4000-8000-000000000022';
const tk=(n:number)=>n.toString(16).padStart(64,'0');
const rec=(n:number,extra:Record<string,unknown>={})=>({studentToken:tk(n),courseId:c1,kcId:'kc',discipline:'Civil',theme:'Contratos',bloomLevel:2,eloRating:1500,pKnow:0.5,fsrsStability:1,fsrsDueAt:null,attemptCount:10,correctCount:5,lastAttemptAt:null,...extra});
const feed=(records:unknown[])=>({institutionId:inst,records,total:records.length});
const roster=(ns:number[],course=c1,name='Direito')=>ns.map(n=>({student_token:tk(n),course_id:course,course_name:name}));

describe('masteryContract',()=>{
 it('aceita o formato do F&O e descarta campos não usados',()=>{
  const [r]=masteryContract(feed([rec(1)]),inst);
  expect(r).toEqual({studentToken:tk(1),courseId:c1,discipline:'Civil',theme:'Contratos',pKnow:0.5,attemptCount:10,correctCount:5});
 });
 it.each([
  ['outra instituição',{...feed([rec(1)]),institutionId:c2}],
  ['total divergente',{...feed([rec(1)]),total:2}],
  ['token fora do padrão',feed([rec(1,{studentToken:'abc'})])],
  ['probabilidade acima de 1',feed([rec(1,{pKnow:1.2})])],
  ['probabilidade não numérica',feed([rec(1,{pKnow:'0.5'})])],
  ['acertos acima das tentativas',feed([rec(1,{correctCount:11})])],
  ['disciplina vazia',feed([rec(1,{discipline:''})])],
  ['curso inválido',feed([rec(1,{courseId:'x'})])],
 ])('recusa a resposta inteira: %s',(_,payload)=>{expect(()=>masteryContract(payload,inst)).toThrow(/domínio por competência/);});
 it('aceita tema vazio e curso nulo (vínculo sem curso verificado)',()=>{
  const r=masteryContract(feed([rec(1,{theme:'',courseId:null})]),inst);
  expect(r[0].theme).toBe('');expect(r[0].courseId).toBeNull();
 });
});

describe('aggregateMastery',()=>{
 const five=[1,2,3,4,5];
 it('calcula média, abaixo do limiar e acerto por curso × disciplina × tema',()=>{
  const recs=masteryContract(feed(five.map(n=>rec(n,{pKnow:n<=2?0.3:0.9,correctCount:n}))),inst);
  const s=aggregateMastery(recs,roster(five));
  expect(s.groups).toEqual([{courseId:c1,courseName:'Direito',discipline:'Civil',theme:'Contratos',students:5,meanPKnow:0.66,studentsBelow:2,attempts:50,accuracy:0.3}]);
  expect(s.disciplines).toEqual([{discipline:'Civil',students:5,meanPKnow:0.66,studentsBelow:2}]);
 });
 it('exclui sem matrícula ativa, evidência insuficiente e suprime grupos pequenos',()=>{
  const recs=masteryContract(feed([...five.map(n=>rec(n)),rec(6),rec(7,{attemptCount:MASTERY_RULES.minAttempts-1,correctCount:0}),rec(8,{courseId:null})]),inst);
  const s=aggregateMastery(recs,roster([1,2,3,4,7]));
  expect(s.coverage).toMatchObject({matchedStudents:5,unmatchedStudents:3,insufficientEvidence:1,suppressedGroups:1});
  expect(s.groups).toEqual([]);expect(s.disciplines).toEqual([]);
 });
 it('mesmo token em curso diferente do roster não é atribuído ao curso errado',()=>{
  const recs=masteryContract(feed(five.map(n=>rec(n,{courseId:c2}))),inst);
  expect(aggregateMastery(recs,roster(five,c1)).coverage.unmatchedStudents).toBe(5);
 });
 it('ordena do menor domínio e nunca expõe tokens',()=>{
  const recs=masteryContract(feed([...five.map(n=>rec(n,{theme:'A',pKnow:0.8})),...five.map(n=>rec(n,{theme:'B',pKnow:0.2}))]),inst);
  const s=aggregateMastery(recs,roster(five));
  expect(s.groups.map(g=>g.theme)).toEqual(['B','A']);
  expect(JSON.stringify(s)).not.toContain(tk(1));
 });
});
