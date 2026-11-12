import {describe,it,expect,vi} from 'vitest';
vi.mock('./supabase',()=>({supabase:{}}));
import {academicTabAvailability,reportSelectionKey} from './academic-coverage';
import {parseReprovaSemestre,type AcademicReportRow} from './academico';
const empty={quantitative:0,professors:0,disciplines:0,dossiers:0,courseIndicators:0,semesterFailures:0,flow:0,cohorts:0};
describe('academic source coverage',()=>{
 it('enables the FV-DEMO semester-report simulator without inventing e-ORBIT data',()=>{
  expect(academicTabAvailability({...empty,semesterFailures:24})).toEqual({geral:true,comparador:false,raiox:false,simulador:true,funil:false,evasao:false});
 });
 it('does not enable simulation or funnel from professor reports',()=>{
  expect(academicTabAvailability({...empty,professors:1})).toMatchObject({raiox:true,simulador:false,funil:false});
 });
 it('allows course, discipline and dossier sources independently for the x-ray',()=>{
  for(const key of ['courseIndicators','disciplines','dossiers']) expect(academicTabAvailability({...empty,[key]:1}).raiox).toBe(true);
 });
 it('does not substitute flow data for a simulation source',()=>{
  expect(academicTabAvailability({...empty,flow:1})).toMatchObject({funil:true,simulador:false,raiox:false});
 });
 it('keeps empty sources absent',()=>{
  expect(academicTabAvailability(empty)).toEqual({geral:true,comparador:false,raiox:false,simulador:false,funil:false,evasao:false});
 });
 it('retains separate courses and imports sharing a semester, without summing them',()=>{
  const base={institution_id:'demo',kind:'reprovacoes_semestre',dedupe_key:null,source_report_at:null,imported_at:null};
  const rows:AcademicReportRow[]=[{...base,id:'r1',course_id:'c1',payload:{s:'2026/02',reprovacoes:16,matriculas:120,pct_reprovacao:13.3}},{...base,id:'r2',course_id:'c2',payload:{s:'2026/02',reprovacoes:39,matriculas:300,pct_reprovacao:13}},{...base,id:'r3',course_id:'c1',payload:{s:'2026/02',reprovacoes:17}}];
  const parsed=parseReprovaSemestre(rows,new Map([['c1','Direito fictício'],['c2','Medicina fictícia']]));
  expect(parsed.map(reportSelectionKey)).toEqual(['r1','r2','r3']);
  expect(parsed.map(r=>r.reprovacoes)).toEqual([16,39,17]);
  expect(parsed[0].scopeLabel).toBe('Direito fictício');
  expect(parsed[1].scopeLabel).toBe('Medicina fictícia');
 });
 it('does not label missing course metadata as an institutional total',()=>{
  const [row]=parseReprovaSemestre([{id:'abcdefghi',institution_id:'demo',kind:'reprovacoes_semestre',dedupe_key:null,payload:{s:'2026/02'},source_report_at:null,imported_at:null}]);
  expect(row.scopeLabel).toBe('Recorte sem curso identificado · abcdefgh');
 });
});
