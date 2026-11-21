/**
 * Avalia 360° — Bloco 3: recuperação personalizada (algoritmo, sem IA).
 *
 * Plano por aluno:
 *  - competências-alvo: "não demonstrado" antes de "em desenvolvimento", da menor para a maior
 *    nota, no máximo 5;
 *  - por competência, até 3 itens do banco ainda NÃO respondidos pelo aluno, com acerto esperado
 *    entre 50% e 80% (zona em que se aprende), mais perto de 65% primeiro, depois maior
 *    discriminação, depois menor id. Sem calibração suficiente, usa-se a dificuldade declarada
 *    2 ou 3 (fácil/média), sinalizada.
 * Agenda (repetição espaçada, caixas de Leitner): revisões em 1, 3, 7 e 15 dias; acerto avança
 * uma caixa, erro volta à primeira; acerto na última caixa consolida o item.
 */
import type {AssemblyItem,Calibration} from './exam-assembly';
import type {Mastery} from './competency-mastery';

const r6=(x:number)=>Math.round(x*1e6)/1e6;
export const RECOVERY_RULES = {
 version:'2026.11-1',intervals:[1,3,7,15] as const,bandLow:0.5,bandHigh:0.8,target:0.65,
 itemsPerCompetency:3,maxCompetencies:5,minCalibrationN:10,declaredLevels:[2,3] as const,
} as const;

export interface PlannedItem {bankId:string;competency:string;expected:number|null;source:'observada'|'declarada'}
export interface RecoveryProposal {competencies:string[];items:PlannedItem[];gaps:string[]}

export function buildRecoveryPlan(args:{masteries:Mastery[];items:AssemblyItem[];calibration:Record<string,Calibration>;answered:Set<string>}):RecoveryProposal{
 const order={nao_demonstrado:0,em_desenvolvimento:1} as Record<string,number>;
 const targets=args.masteries.filter(m=>m.level==='nao_demonstrado'||m.level==='em_desenvolvimento')
  .sort((a,b)=>order[a.level]-order[b.level]||(a.value??0)-(b.value??0)||a.competency.localeCompare(b.competency))
  .slice(0,RECOVERY_RULES.maxCompetencies).map(m=>m.competency);
 const used=new Set<string>();const items:PlannedItem[]=[];const gaps:string[]=[];
 for(const key of targets){
  const pool=args.items.filter(i=>i.competencyKeys.includes(key)&&!args.answered.has(i.bankId)&&!used.has(i.bankId));
  const observed=pool.map(i=>({i,cal:args.calibration[i.bankId]}))
   .filter(x=>x.cal&&x.cal.p!==null&&x.cal.n>=RECOVERY_RULES.minCalibrationN&&x.cal.p>=RECOVERY_RULES.bandLow&&x.cal.p<=RECOVERY_RULES.bandHigh)
   .sort((a,b)=>r6(Math.abs(a.cal.p!-RECOVERY_RULES.target))-r6(Math.abs(b.cal.p!-RECOVERY_RULES.target))
     ||(b.cal.discrimination??0)-(a.cal.discrimination??0)||a.i.bankId.localeCompare(b.i.bankId))
   .map(x=>({bankId:x.i.bankId,competency:key,expected:x.cal.p,source:'observada' as const}));
  const declared=pool.filter(i=>{const c=args.calibration[i.bankId];return !(c&&c.p!==null&&c.n>=RECOVERY_RULES.minCalibrationN)
    &&(RECOVERY_RULES.declaredLevels as readonly number[]).includes(i.record.question.estimatedDifficulty);})
   .sort((a,b)=>Math.abs(a.record.question.estimatedDifficulty-2.5)-Math.abs(b.record.question.estimatedDifficulty-2.5)||a.bankId.localeCompare(b.bankId))
   .map(i=>({bankId:i.bankId,competency:key,expected:null,source:'declarada' as const}));
  const chosen=[...observed,...declared].slice(0,RECOVERY_RULES.itemsPerCompetency);
  if(!chosen.length)gaps.push(key);
  for(const c of chosen){used.add(c.bankId);items.push(c);}
 }
 return {competencies:targets,items,gaps};
}

const addDays=(iso:string,days:number)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
export interface LogEntry {bankId:string;on:string;correct:boolean}
export interface ItemSchedule {bankId:string;box:number;due:string|null;status:'em_revisao'|'consolidado';reviews:number;lastResult:boolean|null}
export function scheduleItems(items:Array<{bankId:string}>,startOn:string,log:LogEntry[]):ItemSchedule[]{
 const iv=RECOVERY_RULES.intervals;
 const state=new Map(items.map(i=>[i.bankId,{bankId:i.bankId,box:0,due:addDays(startOn,iv[0]) as string|null,status:'em_revisao' as ItemSchedule['status'],reviews:0,lastResult:null as boolean|null}]));
 const ordered=log.map((e,idx)=>({e,idx})).sort((a,b)=>a.e.on.localeCompare(b.e.on)||a.idx-b.idx);
 for(const {e} of ordered){
  const s=state.get(e.bankId);if(!s||s.status==='consolidado')continue;
  s.reviews++;s.lastResult=e.correct;
  if(e.correct){
   s.box++;
   if(s.box>=iv.length){s.status='consolidado';s.due=null;}
   else s.due=addDays(e.on,iv[s.box]);
  }else{s.box=0;s.due=addDays(e.on,iv[0]);}
 }
 return [...state.values()];
}
export function nextDue(schedule:ItemSchedule[]):string|null{
 return schedule.filter(s=>s.due).map(s=>s.due as string).sort()[0]??null;
}
export function recoveryCsv(rows:Array<{student:string;competency:string;statement:string;due:string|null;status:string;reviews:number}>):string{
 const esc=(v:string|number|null)=>{const s=v===null?'':String(v);return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 return ['Aluno;Competência;Questão;Próxima revisão;Situação;Revisões',...rows.map(r=>[r.student,r.competency,r.statement,r.due,r.status,r.reviews].map(esc).join(';'))].join('\n');
}
