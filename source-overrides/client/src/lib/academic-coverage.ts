/** Each academic section is enabled by the source it actually consumes. */
export function academicTabAvailability(counts: { quantitative:number; professors:number; disciplines:number; dossiers:number; courseIndicators:number; semesterFailures:number; flow:number; cohorts:number }) {
  return { geral:true, comparador:counts.quantitative>0,
    raiox:counts.professors>0||counts.disciplines>0||counts.dossiers>0||counts.courseIndicators>0,
    simulador:counts.semesterFailures>0, funil:counts.flow>0, evasao:counts.cohorts>0 };
}
/** A period is not a unique report: courses and imports may share its label. */
export function reportSelectionKey(row:{reportId?:string;courseId?:string|null;semestre:string}):string {
  return row.reportId ?? `${row.courseId ?? 'unscoped'}:${row.semestre}`;
}
