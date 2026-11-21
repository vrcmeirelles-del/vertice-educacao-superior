import {describe,expect,it} from 'vitest';
import {difByVariant,mantelHaenszel,strata,variantEffects,type ResponseMatrix} from './fairness';
import {iccA1,icc21,iccLabel,summarizeAgreement} from './agreement';

describe('Mantel-Haenszel (conferido com statsmodels StratifiedTable)',()=>{
 it('α, D-DIF e qui-quadrado com correção de continuidade',()=>{
  // estrato 1: ref 8 acertos/2 erros, focal 5/5; estrato 2: ref 4/6, focal 2/8
  const rows=[...[[8,2,5,5,0],[4,6,2,8,1]].flatMap(([A,B,C,D,s])=>[
   ...Array(A).fill({focal:false,correct:true,stratum:s}),...Array(B).fill({focal:false,correct:false,stratum:s}),
   ...Array(C).fill({focal:true,correct:true,stratum:s}),...Array(D).fill({focal:true,correct:false,stratum:s})])];
  const r=mantelHaenszel(rows);
  expect(r.alpha).toBeCloseTo(3.2727272727,8);
  expect(r.chi2).toBeCloseTo(1.737142857,8);
  expect(r.deltaD).toBeCloseTo(-2.786215614,8);
 });
 it('estratos por ordem da nota mantêm notas iguais juntas',()=>{
  const s=strata([1,1,1,1,1,1,1,1,1,1,9,9,9,9,9,9,9,9,9,9,9,9]);
  expect(new Set(s.slice(0,10)).size).toBe(1);
  expect(s[0]).not.toBe(s[10]);
 });
});

describe('justiça entre versões',()=>{
 const mk=(variant:string,total:number,correct:boolean)=>({variant,total,complete:true,items:{q1:{score:correct?1:0,max:1,outcome:correct?'correct':'wrong'}}});
 const q=[{id:'q1',kind:'objetiva' as const,points:1,statement:'x'}];
 it('questão muito mais difícil numa versão, com desempenho equivalente: categoria C',()=>{
  // mesmas notas totais nos dois grupos; versão B erra muito mais a q1
  const sheets=[...Array.from({length:20},(_,i)=>mk('A',i%4+5,i%5!==0)),...Array.from({length:20},(_,i)=>mk('B',i%4+5,i%5===0))];
  const d=difByVariant({variantCount:2,questions:q,sheets});
  expect(d.find(x=>x.variant==='B')).toMatchObject({category:'C'});
  expect(d.find(x=>x.variant==='B')!.deltaD!).toBeLessThan(-1.5);
 });
 it('sem diferença: categoria A; grupos pequenos: amostra insuficiente',()=>{
  // acerto não determinado pela nota (padrão misto e idêntico nas duas versões)
  const eq=[...Array.from({length:20},(_,i)=>mk('A',i%4+5,i%3!==0)),...Array.from({length:20},(_,i)=>mk('B',i%4+5,i%3!==0))];
  expect(difByVariant({variantCount:2,questions:q,sheets:eq}).every(x=>x.category==='A')).toBe(true);
  expect(difByVariant({variantCount:2,questions:q,sheets:eq.slice(0,25)}).find(x=>x.variant==='B')?.category).toBe('amostra_insuficiente');
 });
 it('acerto totalmente determinado pela nota: sem informação, indeterminado (não afirma ausência de DIF)',()=>{
  const det=[...Array.from({length:20},(_,i)=>mk('A',i%4+5,i%2===0)),...Array.from({length:20},(_,i)=>mk('B',i%4+5,i%2===0))];
  expect(difByVariant({variantCount:2,questions:q,sheets:det}).every(x=>x.category==='indeterminado')).toBe(true);
 });
 it('d de Cohen entre versões',()=>{
  const m:ResponseMatrix={variantCount:2,questions:q,sheets:[...[5,6,7,6,5,6,7,6,5,6].map(t=>mk('A',t,true)),...[3,4,5,4,3,4,5,4,3,4].map(t=>mk('B',t,true))]};
  const e=variantEffects(m);
  expect(e.find(x=>x.variant==='B')).toMatchObject({flag:true});
  expect(e.find(x=>x.variant==='B')!.d!).toBeCloseTo(-2.7105237087,8); // conferido com numpy (desvio amostral combinado)
 });
});

describe('concordância entre corretores (ICC 2,1)',()=>{
 it('reproduz Shrout & Fleiss (1979), ICC(2,1) = 0,29',()=>{
  const sf=[[9,2,5,8],[6,1,3,2],[8,4,6,8],[7,1,2,6],[10,5,6,9],[6,2,4,7]];
  expect(iccA1(sf)).toBeCloseTo(0.2898,4);
 });
 it('pares de dois corretores, leitura e resumo',()=>{
  const pairs:Array<[number,number]>=[[2,2],[1.5,1],[1,1.5],[0.5,0.5],[2,1.5],[0,0.5]];
  expect(icc21(pairs)).toBeCloseTo(0.8333333,6);
  expect(iccLabel(0.8333)).toBe('boa');
  const s=summarizeAgreement(pairs,2);
  expect(s).toMatchObject({pairs:6,label:'boa'});
  expect(s.meanAbsDiff).toBeCloseTo(2/6,9);
  expect(s.withinTolerance).toBeCloseTo(2/6,9);
  expect(summarizeAgreement(pairs.slice(0,3),2)).toMatchObject({icc:null});
 });
});
