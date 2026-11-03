type EnrollmentRow={course_id:string;semester:string;student_status:string;class_label:string;enrolled:number;reported_total:number|null};
export function courseTotals(rows:EnrollmentRow[]){
 const classes=rows.filter(r=>r.class_label!=='__TOTAL_CURSO__');
 const sum=classes.reduce((s,r)=>s+r.enrolled,0);
 const reported=rows.find(r=>r.reported_total!==null&&r.reported_total!==undefined)?.reported_total??null;
 const totalRow=rows.find(r=>r.class_label==='__TOTAL_CURSO__');
 return {sum,reported,value:reported??(classes.length?sum:totalRow?.enrolled??0)};
}
export function institutionEnrollmentSummary(institutionId:string,courses:{id:string;institution_id:string}[],enrollments:EnrollmentRow[]){
 const ids=new Set(courses.filter(c=>c.institution_id===institutionId).map(c=>c.id));
 const own=enrollments.filter(r=>ids.has(r.course_id)&&r.student_status==='MATRICULADO');
 const semester=[...new Set(own.map(r=>r.semester))].sort().at(-1);
 if(!semester)return undefined;
 const groups=new Map<string,EnrollmentRow[]>();
 for(const r of own.filter(r=>r.semester===semester))groups.set(r.course_id,[...(groups.get(r.course_id)??[]),r]);
 return {semester,enrolled:[...groups.values()].reduce((n,rows)=>n+courseTotals(rows).value,0),covered:groups.size,total:ids.size};
}
