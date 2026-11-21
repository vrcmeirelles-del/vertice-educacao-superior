/**
 * Avalia 360° — Bloco 4: justiça entre versões (DIF simplificado, sem IA).
 *
 * Para cada questão objetiva e cada versão (focal) contra as demais versões (referência),
 * compara alunos de DESEMPENHO EQUIVALENTE pelo procedimento de Mantel-Haenszel:
 *  - estratos pela nota total (grupos de tamanho quase igual pela ordem da nota; notas iguais
 *    ficam no mesmo estrato); k = mín(5, ⌊n/10⌋), no mínimo 2;
 *  - α_MH = Σ(A·D/N) / Σ(B·C/N)  (A, B: referência acerta/erra; C, D: focal acerta/erra);
 *  - D-DIF = −2,35·ln(α_MH): negativo = questão mais difícil na versão focal;
 *  - qui-quadrado de MH com correção de continuidade; significativo se > 3,84 (5%).
 * Classificação no espírito da ETS: A (|D| < 1 ou não significativo), B (1 ≤ |D| < 1,5),
 * C (|D| ≥ 1,5). Exige ao menos 10 alunos em cada grupo.
 * Também compara a nota média de cada versão com as demais (d de Cohen).
 */
export const FAIRNESS_RULES = {version:'2026.11-1',minGroup:10,maxStrata:5,chiCritical:3.84,bThreshold:1,cThreshold:1.5,effectSize:0.5} as const;

export interface MatrixSheet {variant:string;total:number;complete:boolean;items:Record<string,{score:number;max:number;outcome:string}>}
export interface ResponseMatrix {variantCount:number;questions:Array<{id:string;kind:'objetiva'|'discursiva';points:number;statement:string}>;sheets:MatrixSheet[]}
export interface DifResult {questionId:string;variant:string;nFocal:number;nReference:number;alpha:number|null;deltaD:number|null;chi2:number|null;
 category:'A'|'B'|'C'|'amostra_insuficiente'|'indeterminado'}
export interface VariantEffect {variant:string;n:number;mean:number;d:number|null;flag:boolean}

/**
 * Estratos pela ordem da nota, sem separar notas iguais: cada corte vai para a fronteira entre
 * notas diferentes mais próxima da posição-alvo (s·n/k); empate de distância → corte anterior.
 */
export function strata(totals:number[]):number[]{
 const n=totals.length;const k=Math.max(2,Math.min(FAIRNESS_RULES.maxStrata,Math.floor(n/10)));
 const order=totals.map((t,i)=>({t,i})).sort((a,b)=>a.t-b.t||a.i-b.i);
 const boundaries:number[]=[];
 for(let p=1;p<n;p++)if(order[p].t!==order[p-1].t)boundaries.push(p);
 const cuts=new Set<number>();
 for(let s=1;s<k;s++){
  const target=s*n/k;let best:number|null=null;
  for(const b of boundaries)if(best===null||Math.abs(b-target)<Math.abs(best-target))best=b;
  if(best!==null)cuts.add(best);
 }
 const sorted=[...cuts].sort((a,b)=>a-b);
 const out=new Array<number>(n);
 order.forEach((x,pos)=>{out[x.i]=sorted.filter(c=>pos>=c).length;});
 return out;
}

export function mantelHaenszel(rows:Array<{focal:boolean;correct:boolean;stratum:number}>):{alpha:number|null;deltaD:number|null;chi2:number|null}{
 const by=new Map<number,{A:number;B:number;C:number;D:number}>();
 for(const r of rows){const t=by.get(r.stratum)||{A:0,B:0,C:0,D:0};
  if(r.focal){if(r.correct)t.C++;else t.D++;}else{if(r.correct)t.A++;else t.B++;}by.set(r.stratum,t);}
 let num=0,den=0,sumA=0,sumE=0,sumV=0;
 for(const t of by.values()){
  const N=t.A+t.B+t.C+t.D;if(N<2)continue;
  num+=t.A*t.D/N;den+=t.B*t.C/N;
  const nR=t.A+t.B,nF=t.C+t.D,m1=t.A+t.C,m0=t.B+t.D;
  sumA+=t.A;sumE+=nR*m1/N;sumV+=nR*nF*m1*m0/(N*N*(N-1));
 }
 const alpha=num>0&&den>0?num/den:null;
 const chi2=sumV>0?Math.pow(Math.max(0,Math.abs(sumA-sumE)-0.5),2)/sumV:null;
 return {alpha,deltaD:alpha===null?null:-2.35*Math.log(alpha),chi2};
}

export function difByVariant(m:ResponseMatrix):DifResult[]{
 const sheets=m.sheets.filter(s=>s.complete);
 const variants=[...new Set(sheets.map(s=>s.variant))].sort();
 const st=strata(sheets.map(s=>Number(s.total)));
 const out:DifResult[]=[];
 if(variants.length<2)return out;
 for(const q of m.questions.filter(x=>x.kind==='objetiva'))for(const v of variants){
  const rows=sheets.flatMap((s,i)=>s.items[q.id]?[{focal:s.variant===v,correct:s.items[q.id].outcome==='correct',stratum:st[i]}]:[]);
  const nF=rows.filter(r=>r.focal).length,nR=rows.length-nF;
  if(nF<FAIRNESS_RULES.minGroup||nR<FAIRNESS_RULES.minGroup){out.push({questionId:q.id,variant:v,nFocal:nF,nReference:nR,alpha:null,deltaD:null,chi2:null,category:'amostra_insuficiente'});continue;}
  const r=mantelHaenszel(rows);
  const sig=r.chi2!==null&&r.chi2>FAIRNESS_RULES.chiCritical;
  const ad=r.deltaD===null?null:Math.abs(r.deltaD);
  const category:DifResult['category']=ad===null?'indeterminado':!sig||ad<FAIRNESS_RULES.bThreshold?'A':ad<FAIRNESS_RULES.cThreshold?'B':'C';
  out.push({questionId:q.id,variant:v,nFocal:nF,nReference:nR,...r,category});
 }
 return out;
}

export function variantEffects(m:ResponseMatrix):VariantEffect[]{
 const sheets=m.sheets.filter(s=>s.complete);
 const variants=[...new Set(sheets.map(s=>s.variant))].sort();
 if(variants.length<2)return [];
 const mean=(x:number[])=>x.reduce((a,b)=>a+b,0)/x.length;
 const sd=(x:number[])=>{const mu=mean(x);return Math.sqrt(x.reduce((a,b)=>a+(b-mu)**2,0)/(x.length-1));};
 return variants.map(v=>{
  const f=sheets.filter(s=>s.variant===v).map(s=>Number(s.total)),r=sheets.filter(s=>s.variant!==v).map(s=>Number(s.total));
  if(f.length<2||r.length<2)return {variant:v,n:f.length,mean:f.length?mean(f):0,d:null,flag:false};
  const pooled=Math.sqrt(((f.length-1)*sd(f)**2+(r.length-1)*sd(r)**2)/(f.length+r.length-2));
  const d=pooled>0?(mean(f)-mean(r))/pooled:null;
  return {variant:v,n:f.length,mean:mean(f),d,
   flag:d!==null&&Math.abs(d)>=FAIRNESS_RULES.effectSize&&f.length>=FAIRNESS_RULES.minGroup&&r.length>=FAIRNESS_RULES.minGroup};
 });
}
