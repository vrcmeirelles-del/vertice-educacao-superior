import {describe,it,expect} from 'vitest';
import {courseSummary,type PlanningCourse} from './model';
const base:PlanningCourse={id:'c',name:'Direito',code:'027',strategic:null,semester:null,stats:null,previous_stats:null,code_matches:1,stats_matches:0,goals:[],actions:[],tcc:null,ac:null,internship:null};
describe('management cross-source summaries',()=>{
 it('keeps missing enrollment distinct from zero',()=>{expect(courseSummary(base,'2026-11-15').enrollment).toBeNull();expect(courseSummary({...base,stats:{matriculados:0}},'2026-11-15').enrollment).toBe(0);});
 it('compares stocks only when a nonzero prior stock exists',()=>{expect(courseSummary({...base,stats:{matriculados:245},previous_stats:{matriculados:220}},'2026-11-15').delta).toBeCloseTo(11.3636);expect(courseSummary({...base,stats:{matriculados:245},previous_stats:{matriculados:0}},'2026-11-15').delta).toBeNull();});
 it('does not count cancelled or completed actions as overdue',()=>{const s=courseSummary({...base,strategic:{status:'draft',operational_objectives:[{status:'completed',deadline:'2026-01-01'},{status:'cancelled',deadline:'2026-01-01'},{status:'planned',deadline:'2026-01-01'},{status:'planned',deadline:'invalid'}],risks:{}}},'2026-11-15');expect(s.operations).toHaveLength(3);expect(s.completed).toBe(1);expect(s.overdue).toBe(1);expect(s.gaps).toContain('Estratégia em rascunho');});
 it('flags ambiguous code matching instead of treating it as absent or zero',()=>{expect(courseSummary({...base,code_matches:2},'2026-11-15').gaps).toContain('Vínculo acadêmico ambíguo');});
});
