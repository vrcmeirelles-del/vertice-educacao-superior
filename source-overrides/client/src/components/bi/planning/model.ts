export type Entry = Record<string, any>;
export interface PlanningCourse { id:string; name:string; code:string|null; strategic:Entry|null; semester:Entry|null; stats:Entry|null; previous_stats:Entry|null; stats_matches:number; code_matches:number; goals:Entry[]; actions:Entry[]; tcc:Entry|null; ac:Entry|null; internship:Entry|null; }
export interface PlanningPortfolio { institution_id:string; semester:string|null; semesters:string[]; fetched_at:string; courses:PlanningCourse[]; }
export const list = (value:unknown):Entry[] => Array.isArray(value)?value.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)):[];
export function courseSummary(c:PlanningCourse,today:string) {
 const operations=list(c.strategic?.operational_objectives);
 const active=operations.filter(a=>a.status!=='cancelled');
 const completed=active.filter(a=>a.status==='completed').length;
 const overdue=active.filter(a=>a.status!=='completed'&&/^\d{4}-\d{2}-\d{2}$/.test(a.deadline??'')&&a.deadline<today).length;
 const risks=list(c.strategic?.risks).filter(r=>r.impact==='alto'&&r.probability==='alta');
 const enrollment=c.stats?.matriculados??null, previous=c.previous_stats?.matriculados??null;
 const delta=enrollment!==null&&previous!==null&&previous>0?100*(enrollment-previous)/previous:null;
 const gaps:string[]=[];
 if(!c.strategic)gaps.push('Planejamento estratégico ausente');
 else if(c.strategic.status!=='published')gaps.push('Estratégia em rascunho');
 if(!c.semester)gaps.push('Plano semestral ausente no período');
 if(c.code_matches!==1||c.stats_matches>1)gaps.push('Vínculo acadêmico ambíguo');
 else if(!c.stats)gaps.push('Sem indicadores acadêmicos no período');
 if(overdue)gaps.push(`${overdue} ação(ões) estratégica(s) vencida(s)`);
 if(risks.length)gaps.push(`${risks.length} risco(s) de alta probabilidade e impacto`);
 return {operations:active,completed,overdue,risks,enrollment,delta,gaps,objectives:list(c.strategic?.strategic_objectives),activities:list(c.semester?.activities)};
}
