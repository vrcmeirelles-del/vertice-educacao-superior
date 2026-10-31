export type ReprobationPeriod={semester:string;diaries:number;discipline_enrollments:number;RF:number;RN:number;RA:number;failures:number;diary_weighted_mean:number|null};
export type CourseIndicatorPayload={reprobation_series?:ReprobationPeriod[];risk_roster?:{listed:number|null;period:string|null;label:string;file_modified_at:string};method?:string;sources?:{name:string;source_url:string;modified:string}[]};
const number=(v:number|null|undefined)=>v==null?"Não informado":v.toLocaleString("pt-BR");
export default function CourseIndicators({payload,semester}:{payload:CourseIndicatorPayload;semester:string}){
 const periods=[...(payload.reprobation_series??[])].sort((a,b)=>b.semester.localeCompare(a.semester));
 const current=periods.find(p=>p.semester===semester),risk=payload.risk_roster;
 return <section><h3>Indicadores das planilhas</h3>
  <div className="stats-row">
   <div className="stat-card">Reprovações em disciplinas · {semester||"sem semestre"}<strong className="stat-value">{number(current?.failures)}</strong></div>
   <div className="stat-card">Por falta (RF)<strong className="stat-value">{number(current?.RF)}</strong></div>
   <div className="stat-card">Por nota (RN)<strong className="stat-value">{number(current?.RN)}</strong></div>
   <div className="stat-card">Final (RA)<strong className="stat-value">{number(current?.RA)}</strong></div>
  </div>
  <p>Contagens por matrícula em disciplina, não por aluno único. A mesma pessoa pode aparecer em mais de uma disciplina. Ausência de relatório não é reprovação zero.</p>
  {periods.length>0&&<details><summary>Histórico de reprovações por semestre</summary><div className="table-scroll"><table><thead><tr><th>Semestre</th><th>Diários</th><th>Matrículas em disciplinas</th><th>RF</th><th>RN</th><th>RA</th><th>Total</th></tr></thead><tbody>{periods.map(p=><tr key={p.semester}><td>{p.semester}</td><td>{number(p.diaries)}</td><td>{number(p.discipline_enrollments)}</td><td>{number(p.RF)}</td><td>{number(p.RN)}</td><td>{number(p.RA)}</td><td>{number(p.failures)}</td></tr>)}</tbody></table></div></details>}
  {risk&&<details><summary>Lista de acompanhamento · {risk.listed==null?"curso não localizado na lista":`${number(risk.listed)} matrículas listadas`}</summary><p>{risk.label}</p><p>Arquivo atualizado em {new Date(risk.file_modified_at).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}. O período da seleção não foi informado na fonte.</p></details>}
  <details><summary>Fontes e limites dos dados</summary><p>{payload.method}</p>{payload.sources?.map(s=><p key={s.name}><a href={s.source_url} target="_blank" rel="noreferrer">{s.name}</a> · arquivo atualizado em {new Date(s.modified).toLocaleDateString("pt-BR",{timeZone:"America/Fortaleza"})}</p>)}</details>
 </section>;
}
