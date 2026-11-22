import {describe,expect,it} from 'vitest';
import {readSheet} from 'read-excel-file/node';
import {resultsWorkbook,resultsFilename} from './results-export';
import type {ApplicationDetail} from './application-api';

const d:ApplicationDetail={id:'a',draftId:'d',revision:1,title:'AV1 Penal',discipline:'Penal',classLabel:'3º A',appliedOn:'2027-03-10',variantCount:2,
 variantMap:{A:[],B:[]},status:'closed',
 questions:[{id:'q1',kind:'objetiva',points:2,statement:'Sobre o dolo eventual'},{id:'q2',kind:'discursiva',points:3,statement:'Teoria finalista'},{id:'q3',kind:'objetiva',points:1,statement:'Legítima defesa'}],
 sheets:[
  {id:'s1',studentId:'x',label:'Bruna',enrollment:'2027002',variant:'B',total:1,max:6,updatedAt:'',items:[
   {q:'q3',n:1,kind:'objetiva',mark:'B',outcome:'correct',score:1,max:1},{q:'q2',n:2,kind:'discursiva',mark:null,outcome:'pending',score:null,max:3},{q:'q1',n:3,kind:'objetiva',mark:'C',outcome:'wrong',score:0,max:2}]},
  {id:'s2',studentId:'y',label:'Ana',enrollment:'2027001',variant:'A',total:5.5,max:6,updatedAt:'',items:[
   {q:'q1',n:1,kind:'objetiva',mark:'B',outcome:'correct',score:2,max:2},{q:'q2',n:2,kind:'discursiva',mark:null,outcome:'scored',score:2.5,max:3},{q:'q3',n:3,kind:'objetiva',mark:'A',outcome:'correct',score:1,max:1}]},
  {id:'s3',studentId:null,label:'Ouvinte',enrollment:null,variant:'A',total:0,max:6,updatedAt:'',items:null},
 ]};

describe('planilha de resultados da aplicação',()=>{
 const buf=Buffer.from(resultsWorkbook(d,new Date('2027-03-11T10:00:00')));
 it('resumo por aluno: nota, percentual e contagens, em ordem alfabética, só folhas corrigidas',async()=>{
  const r=await readSheet(buf,'Resumo por aluno') as unknown[][];
  expect(r.length).toBe(3);
  expect(r[1].slice(0,6)).toEqual(['Ana','2027001','A',5.5,6,0.9167]);
  expect(r[2].slice(6)).toEqual([1,1,0,0,1]);
 });
 it('questões na numeração do caderno original, com a letra da versão do aluno',async()=>{
  const r=await readSheet(buf,'Questões por aluno') as unknown[][];
  expect(r[0]).toEqual(['Aluno','Versão','Q1','Q2 (disc.)','Q3']);
  expect(r[2]).toEqual(['Bruna','B','Errado (C, nº 3 na versão B)','Pendente','Certo (B, nº 1 na versão B)']);
  expect(r[1][3]).toBe('2,5 de 3');
 });
 it('acerto por questão: percentuais e média de pontos',async()=>{
  const r=await readSheet(buf,'Acerto por questão') as unknown[][];
  expect(r[1].slice(0,7)).toEqual(['Q1','Objetiva','Sobre o dolo eventual',2,2,1,0.5]);
  expect(r[2].slice(10)).toEqual([2.5,0.8333]);
  expect(r[3][6]).toBe(1);
 });
 it('informações e nome do arquivo',async()=>{
  const r=await readSheet(buf,'Informações') as unknown[][];
  expect(r.find(x=>x[0]==='Média da turma')?.[1]).toBe(3.25);
  expect(resultsFilename(d)).toBe('Resultados-AV1-Penal-3-A-2027-03-10.xlsx');
 });
});
