import { expect, it } from 'vitest';
import { reviewMetrics } from '../client/src/lib/management-metrics';
import { managementReview, type ReviewData } from '../client/src/lib/management-review';
const empty:ReviewData={goals:[],measurements:[],actions:[],diagnosis:[],requests:[],files:[]};
it('gráficos vazios não fabricam cobertura nem metas',()=>{expect(reviewMetrics(managementReview(empty,'i','c',''))).toMatchObject({total:0,measured:0,planned:0,attention:0,withAction:0,withDocuments:0});});
it('distribuição documental soma exigências uma vez e distingue NSA e validação',()=>{
 const d:ReviewData={...empty,requests:[{id:'a',institution_id:'i',course_id:'c'},{id:'b',institution_id:'i',course_id:'c',not_applicable:true},{id:'c',institution_id:'i',course_id:'c'}],files:[{id:'f',institution_id:'i',request_id:'c',status:'validado',created_at:'2026-01-01'}]};const m=reviewMetrics(managementReview(d,'i','c',''));expect(m.total).toBe(3);expect(m.states.reduce((n,s)=>n+s.value,0)).toBe(3);expect(m.states.find(s=>s.key==='validado')?.value).toBe(1);expect(m.states.find(s=>s.key==='nsa')?.value).toBe(1);
});
it('barra de medição representa disponibilidade, não atingimento',()=>{const d:ReviewData={...empty,goals:[{id:'g',institution_id:'i',course_id:'c',target:100}],measurements:[{id:'m',institution_id:'i',goal_id:'g',value:0,measured_on:'2026-01-01'}]};expect(reviewMetrics(managementReview(d,'i','c',''))).toMatchObject({planned:1,measured:1,withAction:0,withDocuments:0});});
