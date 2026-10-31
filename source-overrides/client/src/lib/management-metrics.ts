import type { managementReview } from './management-review';
type Report = ReturnType<typeof managementReview>;
export const REVIEW_STATES = [
 {key:'validado',label:'Validados',color:'#147d64'},
 {key:'enviado',label:'Aguardando análise',color:'#2867be'},
 {key:'pendente',label:'Não enviados',color:'#a3640b'},
 {key:'devolvido',label:'Para correção',color:'#b33949'},
 {key:'classificacao',label:'Reclassificar',color:'#7652a5'},
 {key:'nsa',label:'NSA declarado',color:'#657487'},
] as const;
export function reviewMetrics(report: Report) {
 const states=REVIEW_STATES.map(s=>({...s,value:report.evidence.filter(e=>e.state===s.key).length}));
 const unknown=report.evidence.filter(e=>!REVIEW_STATES.some(s=>s.key===e.state)).length;
 return {states,unknown,total:report.evidence.length,measured:report.goals.filter(g=>g.latestMeasurement!==undefined).length,planned:report.goals.length,withAction:report.goals.filter(g=>g.actions.length>0).length,withDocuments:report.goals.filter(g=>g.documents.length>0).length,attention:report.goals.filter(g=>g.gaps.length>0).length};
}
