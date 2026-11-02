import {describe,it,expect} from 'vitest';
import {displayCourseRows} from '../client/src/lib/course-labels';
describe('cadastros de curso com mesmo nome',()=>{
 it('distingue as bases sem alterar identidade, nome ou vínculo persistido',()=>{
  const rows=[{id:'b',institution_id:'ies',code:'027',name:'Direito',modality:'presencial',created_at:'2026-10-30'},{id:'a',institution_id:'ies',code:'027',name:'Direito',modality:'presencial',created_at:'2026-10-29'}];
  const requests=[{id:'r',institution_id:'ies',course_id:'a'}],goals=[{id:'g',institution_id:'ies',course_id:'b'}];
  const result=displayCourseRows(rows,requests,goals);expect(result[0].display_name).toContain('Base 2 (0 exigências; 1 metas)');expect(result[1].display_name).toContain('Base 1 (1 exigências; 0 metas)');expect(result.map(r=>r.id)).toEqual(rows.map(r=>r.id));expect(rows[0]).not.toHaveProperty('display_name');expect(result.every(r=>r.name==='Direito')).toBe(true);
 });
 it('não mistura instituições e não muda cursos sem ambiguidade',()=>{
  const c={id:'a',institution_id:'ies-a',name:'Direito',code:'027',modality:'presencial'};
  const result=displayCourseRows([c,{...c,id:'b',institution_id:'ies-b'}],[{id:'r',institution_id:'ies-b',course_id:'a'}],[]);expect(result[0].display_name).toBe('Direito');expect(result[1].display_name).toBe('Direito');
 });
});
