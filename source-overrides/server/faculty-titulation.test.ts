import {describe,expect,it} from 'vitest';
import {thresholdsFrom,titulationIndicator,simulate,degreeOf,type FacultyRow} from '../client/src/lib/faculty-titulation';
import {instrumento} from '../client/src/lib/avaliacao-institucional';

const official=instrumento.indicators.find(i=>i.code==='4.1')!;
const t=thresholdsFrom(official.criteria as any)!;
const rows=(spec:Record<string,number>):FacultyRow[]=>Object.entries(spec).flatMap(([titulacao,n])=>Array.from({length:n},(_,i)=>({titulacao,regime:i%2?'integral':'parcial',ch_semanal:20+i,cursos_vinculados:['c1']})));

describe('titulação do corpo docente (indicador 4.1)',()=>{
 it('lê as faixas do texto oficial do instrumento cadastrado, sem valores digitados no código',()=>{
  expect(t.map(x=>[x.level,x.min])).toEqual([[2,.25],[3,.4],[4,.6],[5,.8]]);
  expect(thresholdsFrom({'1':'x','2':'sem percentual','3':'ao menos 40%','4':'ao menos 60%','5':'ao menos 80%'})).toBeNull();
 });
 it('calcula o conceito e quanto falta para a próxima faixa',()=>{
  const r=titulationIndicator(rows({Doutor:3,Mestre:9,Especialista:8}),t);
  expect(r.share).toBeCloseTo(.6,5);expect(r.concept).toBe(4);
  expect(r.next).toMatchObject({level:5,min:.8});
  expect(r.hiresToNext).toBe(20);   // (12+20)/(20+20)=80%
  expect(r.upgradesToNext).toBe(4); // 16/20=80%
  expect(r.reliable).toBe(true);
 });
 it('simula contratações e desligamentos',()=>{
  const r=titulationIndicator(rows({Doutor:3,Mestre:9,Especialista:8}),t);
  expect(simulate(r.mix,{mestre:20},t).concept).toBe(5);
  expect(simulate(r.mix,{mestre:-2},t).concept).toBe(3);
 });
 it('cadastro com valores padrão de importação é marcado como não confiável',()=>{
  const padrao=Array.from({length:95},()=>({titulacao:'mestre',regime:'horista',ch_semanal:16,cursos_vinculados:[]}));
  const r=titulationIndicator(padrao,t);
  expect(r.suspicious).toBe(true);expect(r.reliable).toBe(false);
 });
 it('reconhece as grafias de titulação e separa o não informado',()=>{
  expect(['Doutora','MESTRE','Especialização','Graduação','—'].map(degreeOf)).toEqual(['doutor','mestre','especialista','graduado','nao_informado']);
  expect(titulationIndicator([...rows({Mestre:10}),{titulacao:''}],t).reliable).toBe(false);
 });
});
