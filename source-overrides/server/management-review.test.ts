import { describe, expect, it } from 'vitest';
import { managementReview, type ReviewData } from '../client/src/lib/management-review';
const base = (): ReviewData => ({goals:[{id:'g',institution_id:'i',course_id:'c',status:'planejada'}],measurements:[],actions:[],diagnosis:[],requests:[{id:'r',institution_id:'i',course_id:'c',goal_id:'g',indicator:'1.1; 2.3',semester:'2026-2'}],files:[]});
const run = (data:ReviewData) => managementReview(data,'i','c','2026-2');
describe('conciliação gerencial explicável',()=>{
 it('não inventa conceito nem resultados na ausência de medições',()=>{const r=run(base());expect(r.concept).toBeNull();expect(r.goals[0].latestMeasurement).toBeUndefined();expect(r.goals[0].gaps).toHaveLength(3);expect(r.indicators.map(i=>i.code)).toEqual(['1.1','2.3']);});
 it('isola instituição, curso, período e documentos de apoio',()=>{const d=base();d.requests.push({id:'x',institution_id:'other',course_id:'c'},{id:'y',institution_id:'i',course_id:'other'},{id:'z',institution_id:'i',course_id:'c',semester:'2025-2'},{id:'s',institution_id:'i',course_id:'c',semester:'2026-2',repository_section:'apoio'});d.goals.push({id:'other',institution_id:'other',course_id:'c'});expect(run(d).evidence).toHaveLength(1);expect(run(d).goals).toHaveLength(1);});
 it('reenvio pendente não reutiliza a validação da versão antiga',()=>{const d=base();d.files=[{id:'f1',institution_id:'i',request_id:'r',status:'validado',created_at:'2026-10-01'},{id:'f2',institution_id:'i',request_id:'r',status:'enviado',created_at:'2026-10-02'}];expect(run(d).evidence[0].state).toBe('enviado');expect(run(d).goals[0].latestMeasurement).toBeUndefined();});
 it('nova versão de apoio não restaura evidência antiga',()=>{const d=base();d.files=[{id:'f1',institution_id:'i',request_id:'r',status:'validado',created_at:'2026-10-01'},{id:'f2',institution_id:'i',request_id:'r',document_category:'apoio',created_at:'2026-10-02'}];expect(run(d).evidence[0].state).toBe('classificacao');});
 it('NSA exige declaração explícita e não vira nota',()=>{const d=base();d.requests[0].not_applicable=true;const r=run(d);expect(r.evidence[0].state).toBe('nsa');expect(r.concept).toBeNull();});
 it('mantém zero válido e ignora números ausentes, inválidos e de outra IES',()=>{const d=base();d.measurements=[{id:'m',institution_id:'i',goal_id:'g',value:0,measured_on:'2026-10-01'},{id:'n',institution_id:'i',goal_id:'g',value:null,measured_on:'2026-10-02'},{id:'bad',institution_id:'i',goal_id:'g',value:'oops',measured_on:'2026-10-03'},{id:'foreign',institution_id:'other',goal_id:'g',value:100,measured_on:'2026-10-04'}];expect(run(d).goals[0].latestMeasurement?.value).toBe(0);});
 it('exibe vínculo ausente sem inventar associação semântica',()=>{const d=base();d.requests[0].goal_id=null;expect(run(d).unlinked).toHaveLength(1);expect(run(d).goals[0].documents).toHaveLength(0);});
});

import { latestInstrumentDocuments, repositorySummary } from '../client/src/lib/repository';
import { evidenceSeries, coverageCsv } from '../client/src/lib/repository-evidence';
it('resumo, série e CSV não ressuscitam documento validado anterior após reclassificação',()=>{
 const requests=[{id:'r',title:'Ata',semester:'2026-2',document_code:'DOC-1'}];
 const files=[{id:'a',request_id:'r',status:'validado',created_at:'2026-01-01',file_name:'antigo.pdf'}, {id:'b',request_id:'r',document_category:'apoio',status:'enviado',created_at:'2026-02-01',file_name:'apoio.pdf'}];
 expect(latestInstrumentDocuments(files).has('r')).toBe(false);
 expect(repositorySummary(requests,files)).toMatchObject({validated:0,sent:0,pending:1});
 expect(evidenceSeries(requests,files,['2026-2'])[0].cells[0].status).toBe('pendente');
 expect(coverageCsv(requests,files)).not.toContain('antigo.pdf');
 expect(files).toHaveLength(2);
});
