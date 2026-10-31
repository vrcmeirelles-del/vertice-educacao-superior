import {describe,it,expect} from "vitest";
import {latestEnrollmentSnapshots,courseTotals,type Enrollment} from "../client/src/components/InstitutionArea";
const row=(values:Partial<Enrollment>):Enrollment=>({id:"a",course_id:"course",semester:"2026/02",student_status:"MATRICULADO",class_label:"1A",enrolled:10,capacity:null,available:null,reported_total:10,source_report_at:"2026-10-29T15:00:00Z",...values});
describe("atualização de planilhas por curso",()=>{
 it("substitui o relatório inteiro sem reter turma retirada da versão mais recente",()=>{
  const rows=[row({id:"old",class_label:"old",enrolled:50}),row({id:"new",class_label:"new",enrolled:20,reported_total:20,source_report_at:"2026-10-30T15:00:00Z"})];
  const latest=latestEnrollmentSnapshots(rows);expect(latest.map(r=>r.id)).toEqual(["new"]);expect(courseTotals(latest).value).toBe(20);
 });
 it("preserva turmas da mesma edição e separa cursos e semestres",()=>{
  const rows=[row({id:"1"}),row({id:"2",class_label:"2A"}),row({id:"3",course_id:"other",source_report_at:"2026-10-28T15:00:00Z"}),row({id:"4",semester:"2026/01",source_report_at:"2026-10-28T15:00:00Z"})];
  expect(latestEnrollmentSnapshots(rows)).toHaveLength(4);
 });
 it("preserva divergência do subtotal da fonte e não inventa capacidade",()=>{
  const result=courseTotals([row({enrolled:243,reported_total:245})]);expect(result).toEqual({sum:243,reported:245,value:245});expect(row({}).capacity).toBeNull();
 });
});
