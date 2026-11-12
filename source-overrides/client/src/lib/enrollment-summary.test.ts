import {describe,it,expect} from 'vitest';
import {isEnrolledStatus,institutionEnrollmentSummary} from './enrollment-summary';
describe('normalized observed enrollment status',()=>{
 it('accepts only the enrolled label regardless of case/whitespace',()=>{
  for(const v of ['MATRICULADO','matriculado',' Matriculado ']) expect(isEnrolledStatus(v)).toBe(true);
  for(const v of ['PRE_MATRICULADO','não matriculado','cancelado','',null,undefined]) expect(isEnrolledStatus(v)).toBe(false);
 });
 it('includes lowercase FV-DEMO fixtures without crossing institution or counting other statuses',()=>{
  const courses=[{id:'demo-course',institution_id:'demo'},{id:'real-course',institution_id:'real'}];
  const row={course_id:'demo-course',semester:'2026/02',student_status:'matriculado',class_label:'A',enrolled:1500,reported_total:null};
  const result=institutionEnrollmentSummary('demo',courses,[row,{...row,student_status:'PRE_MATRICULADO',enrolled:900},{...row,course_id:'real-course',enrolled:9999}]);
  expect(result).toEqual({semester:'2026/02',enrolled:1500,covered:1,total:1});
 });
 it('keeps missing enrollment distinct from observed zero',()=>{
  const courses=[{id:'c',institution_id:'demo'}];
  expect(institutionEnrollmentSummary('demo',courses,[])).toBeUndefined();
  expect(institutionEnrollmentSummary('demo',courses,[{course_id:'c',semester:'2026/02',student_status:'matriculado',class_label:'A',enrolled:0,reported_total:null}])?.enrolled).toBe(0);
 });
});
