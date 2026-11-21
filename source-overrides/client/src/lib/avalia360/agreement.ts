/**
 * Avalia 360° — Bloco 4: concordância entre corretores (sem IA).
 * ICC(2,1) de Shrout & Fleiss (efeitos aleatórios de dois fatores, concordância absoluta,
 * medida única), sobre os pares (1ª correção, 2ª correção cega) de cada discursiva.
 * Leitura (Koo & Li, 2016): < 0,50 pobre; 0,50–0,75 moderada; 0,75–0,90 boa; > 0,90 excelente.
 * Também: diferença média absoluta, viés médio (2ª − 1ª) e % de pares dentro da tolerância
 * (diferença ≤ 10% do valor da questão). Exige ao menos 5 pares para o ICC.
 */
export const AGREEMENT_RULES={version:'2026.11-1',minPairs:5,tolerance:0.1} as const;

/** ICC(2,1) para n sujeitos × k corretores (matriz completa). */
export function iccA1(matrix:number[][]):number|null{
 const n=matrix.length;const k=matrix[0]?.length??0;
 if(n<2||k<2||matrix.some(r=>r.length!==k))return null;
 const grand=matrix.flat().reduce((a,b)=>a+b,0)/(n*k);
 const rowMeans=matrix.map(r=>r.reduce((a,b)=>a+b,0)/k);
 const colMeans=Array.from({length:k},(_,j)=>matrix.reduce((s,r)=>s+r[j],0)/n);
 const msr=k*rowMeans.reduce((s,m)=>s+(m-grand)**2,0)/(n-1);
 const msc=n*colMeans.reduce((s,m)=>s+(m-grand)**2,0)/(k-1);
 let sse=0;matrix.forEach((r,i)=>r.forEach((x,j)=>{sse+=(x-rowMeans[i]-colMeans[j]+grand)**2;}));
 const mse=sse/((n-1)*(k-1));
 const den=msr+(k-1)*mse+k*(msc-mse)/n;
 return den>0?(msr-mse)/den:null;
}
export const icc21=(pairs:Array<[number,number]>)=>iccA1(pairs.map(([a,b])=>[a,b]));
export function iccLabel(v:number|null):string{
 if(v===null)return 'não calculável';
 if(v>0.9)return 'excelente';if(v>=0.75)return 'boa';if(v>=0.5)return 'moderada';return 'pobre';
}
export interface AgreementSummary {pairs:number;icc:number|null;label:string;meanAbsDiff:number|null;bias:number|null;withinTolerance:number|null}
export function summarizeAgreement(pairs:Array<[number,number]>,points:number):AgreementSummary{
 const n=pairs.length;
 if(!n)return {pairs:0,icc:null,label:'sem pares',meanAbsDiff:null,bias:null,withinTolerance:null};
 const icc=n>=AGREEMENT_RULES.minPairs?icc21(pairs):null;
 return {pairs:n,icc,label:n<AGREEMENT_RULES.minPairs?'poucos pares (mínimo '+AGREEMENT_RULES.minPairs+')':iccLabel(icc),
  meanAbsDiff:pairs.reduce((s,[a,b])=>s+Math.abs(b-a),0)/n,bias:pairs.reduce((s,[a,b])=>s+(b-a),0)/n,
  withinTolerance:pairs.filter(([a,b])=>Math.abs(b-a)<=AGREEMENT_RULES.tolerance*points+1e-9).length/n};
}
