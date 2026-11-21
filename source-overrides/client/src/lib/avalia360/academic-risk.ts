/**
 * Avalia 360° — Bloco 5: sinal de risco acadêmico (regras explícitas, sem IA).
 * Entradas: série de notas do aluno (aplicações encerradas, nota ÷ valor da prova) e
 * competências "não demonstradas" (bloco 1).
 *  - tendência = inclinação da reta de mínimos quadrados (nota normalizada × dias), expressa em
 *    pontos percentuais por 90 dias; exige 3 provas;
 *  - ALTO: queda ≥ 10 p.p./90 dias, ou 3+ competências não demonstradas, ou as 2 últimas notas < 40%;
 *  - ATENÇÃO: queda ≥ 5 p.p./90 dias, ou 1+ competência não demonstrada, ou última nota < 50%.
 * Cada sinal traz os motivos. É um alerta pedagógico para acompanhamento, não um diagnóstico.
 */
import type {Mastery} from './competency-mastery';
export const RISK_RULES={version:'2026.11-1',minPointsTrend:3,slopeHigh:-0.1,slopeAttention:-0.05,lowScore:0.4,attentionScore:0.5,criticalHigh:3,criticalAttention:1} as const;
export interface ScorePoint {appliedOn:string;discipline:string;total:number;max:number}
export interface RiskSignal {level:'alto'|'atencao'|null;reasons:string[];slope90:number|null;last:number|null;critical:number;points:number}

const DAY=86_400_000;
/** Inclinação por 90 dias (mínimos quadrados). Null com menos de 2 datas distintas. */
export function slopePer90(points:Array<{x:number;y:number}>):number|null{
 const n=points.length;if(n<2)return null;
 const mx=points.reduce((s,p)=>s+p.x,0)/n,my=points.reduce((s,p)=>s+p.y,0)/n;
 const sxx=points.reduce((s,p)=>s+(p.x-mx)**2,0);
 if(sxx===0)return null;
 return points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/sxx*90;
}
const pp=(v:number)=>Math.round(v*100);
export function evaluateRisk(series:ScorePoint[],masteries:Mastery[]):RiskSignal{
 const pts=[...series].filter(s=>s.max>0).sort((a,b)=>a.appliedOn.localeCompare(b.appliedOn));
 const t0=pts.length?new Date(pts[0].appliedOn+'T12:00:00Z').getTime():0;
 const xy=pts.map(p=>({x:(new Date(p.appliedOn+'T12:00:00Z').getTime()-t0)/DAY,y:p.total/p.max}));
 const slope90=pts.length>=RISK_RULES.minPointsTrend?slopePer90(xy):null;
 const last=xy.length?xy[xy.length-1].y:null;
 const lastTwoLow=xy.length>=2&&xy.slice(-2).every(p=>p.y<RISK_RULES.lowScore);
 const critical=masteries.filter(m=>m.level==='nao_demonstrado').length;
 const high:string[]=[],att:string[]=[];
 if(slope90!==null&&slope90<=RISK_RULES.slopeHigh)high.push('Queda de '+Math.abs(pp(slope90))+' p.p. a cada 90 dias nas últimas '+pts.length+' provas');
 else if(slope90!==null&&slope90<=RISK_RULES.slopeAttention)att.push('Queda de '+Math.abs(pp(slope90))+' p.p. a cada 90 dias');
 if(critical>=RISK_RULES.criticalHigh)high.push(critical+' competências não demonstradas');
 else if(critical>=RISK_RULES.criticalAttention)att.push(critical+' competência(s) não demonstrada(s)');
 if(lastTwoLow)high.push('As duas últimas notas abaixo de '+pp(RISK_RULES.lowScore)+'%');
 else if(last!==null&&last<RISK_RULES.attentionScore)att.push('Última nota: '+pp(last)+'%');
 const level=high.length?'alto':att.length?'atencao':null;
 return {level,reasons:[...high,...att],slope90,last,critical,points:pts.length};
}
