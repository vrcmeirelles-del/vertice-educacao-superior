type Cohort={cohort:string;entrants:number;next_link:number|null;no_next:number|null;positive_av1:number;returned_after_gap:number|null};
export type AcademicReport={id:string;kind:'cohorts'|'enrollment_continuity'|'status_series'|'course_indicators';source_label:string;source_report_at:string;payload:Record<string,unknown>};
export default function AcademicReports({reports}:{reports:AcademicReport[]}){
 const historical=reports.find(r=>r.kind==='cohorts');
 const continuity=reports.find(r=>r.kind==='enrollment_continuity');
 const cohorts=(historical?.payload.cohorts??[]) as Cohort[];
 const current=continuity?.payload as {from_semester:string;to_semester:string;from_count:number;to_count:number;both:number;not_found_next:number;method:string}|undefined;
 return <>
 {current&&<section><h2>Continuidade entre relações de matriculados</h2><p>{continuity?.source_label}</p>
 <div className="table-scroll"><table><thead><tr><th>Semestre de origem</th><th>Matrículas na origem</th><th>Também em {current.to_semester}</th><th>Não localizadas na relação seguinte</th></tr></thead><tbody><tr><td>{current.from_semester}</td><td>{current.from_count}</td><td>{current.both}</td><td>{current.not_found_next}</td></tr></tbody></table></div>
 <p>A relação de {current.to_semester} contém {current.to_count} matrículas. O cruzamento utiliza matrícula, sem deduplicação por CPF.</p><p>{current.method}</p></section>}
 {historical&&<section><h2>Coortes de entrada e evidências de AV1</h2><p>{historical.source_label}</p>
 <div className="table-scroll"><table><thead><tr><th>Coorte</th><th>Entrantes</th><th>Vínculo seguinte localizado</th><th>Sem vínculo seguinte localizado</th><th>AV1 positiva na entrada</th><th>Retorno após lacuna</th></tr></thead><tbody>{cohorts.map(c=><tr key={c.cohort}><td>{c.cohort}</td><td>{c.entrants}</td><td>{c.next_link??'Não aplicável'}</td><td>{c.no_next??'Não aplicável'}</td><td>{c.positive_av1}</td><td>{c.returned_after_gap??'Não aplicável'}</td></tr>)}</tbody></table></div>
 <p>{String(historical.payload.method??'')}</p><p>A cobertura histórica termina na consulta de 20/10/2026. Uma AV1 igual a zero não é prova de ausência; os valores positivos são evidências localizadas, não a cobertura integral de todas as avaliações.</p></section>}
 {!reports.length&&<p>Nenhum cruzamento acadêmico disponível para sua conta.</p>}
 </>;
}
