import { HelpLabel } from '@/components/ContextHelp';
import {isEnrolledStatus} from '@/lib/enrollment-summary';
import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {courseTotals} from "@/lib/enrollment-summary";
import type {Role,Row} from "@/lib/area";
import "./enade-cross.css";

type Offer={semester:string;course_code:string|null;discipline:string|null;teachers:string|null;rf:number|null;rn:number|null;ra:number|null;discipline_enrollments:number|null};
type Enrollment={course_id:string;semester:string;student_status:string;class_label:string;enrolled:number;reported_total:number|null;source_report_at:string};
type Stats={codigo:string|null;semestre:string;modalidade:string|null;evasao_total:number|null;trancado:number|null};
type Report={course_id:string|null;kind:string;source_report_at:string};
type Risk={codigo_curso:string|null;alunos_risco:number|null;data_referencia:string|null};
type Request={id:string;course_id:string|null;semester:string|null};
type EvidenceFile={id:string;request_id:string;status:string};
type Item={name:string;count:number;error:string|null};
type Data={offers:Offer[];enrollments:Enrollment[];stats:Stats[];reports:Report[];risks:Risk[];requests:Request[];files:EvidenceFile[];sources:Item[]};
const EMPTY:Data={offers:[],enrollments:[],stats:[],reports:[],risks:[],requests:[],files:[],sources:[]};
const n=(x:unknown)=>Number.isFinite(Number(x))?Number(x):0;
const fmt=new Intl.NumberFormat("pt-BR");
const fmtPct=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
/** Razão entre ocorrências classificadas e matrículas em disciplinas: não é taxa de alunos únicos. */
function incidenciaBruta(row:{rf:number;rn:number;ra:number;vinculos:number}):string {
  const occurrences=row.rf+row.rn+row.ra;
  // Sem base válida, não produz percentual nem transforma cobertura insuficiente em dado certo.
  if(row.vinculos<=0||occurrences>row.vinculos||occurrences<0)return "—";
  return fmtPct.format(100*occurrences/row.vinculos)+"%";
}
const codeOf=(x:unknown)=>String(x??"").trim();
function term(x:unknown){const m=String(x??"").trim().match(/^(20\d{2})[/-]0?([12])$/);return m?m[1]+"/"+m[2]:"";}
function previous(t:string,mode:"year"|"term"){const m=t.match(/^(\d{4})\/([12])$/);if(!m)return"";return mode==="year"?(Number(m[1])-1)+"/"+m[2]:m[2]==="2"?m[1]+"/1":(Number(m[1])-1)+"/2";}
async function fetchPages<T>(table:string,inst:string,scope="institution_id",columns="*"):Promise<T[]>{
  const all:T[]=[];
  for(let i=0;i<30;i++){
    const {data,error}=await supabase.from(table).select(columns).eq(scope,inst).order("id").range(i*1000,i*1000+999);
    if(error)throw error;
    const rows=(data??[]) as T[];all.push(...rows);
    if(rows.length<1000)return all;
  }
  throw Error("Consulta excedeu o limite de paginação.");
}
function latest(rows:Enrollment[]){
  const times=new Map<string,number>();
  for(const x of rows){const key=[x.course_id,term(x.semester),x.student_status].join("|");times.set(key,Math.max(times.get(key)??0,Date.parse(x.source_report_at)||0));}
  return rows.filter(x=>(Date.parse(x.source_report_at)||0)===(times.get([x.course_id,term(x.semester),x.student_status].join("|"))??0));
}
function enrollCount(rows:Enrollment[],ids:Set<string>,period:string):number|null{
  const selected=rows.filter(x=>ids.has(x.course_id)&&term(x.semester)===period&&isEnrolledStatus(x.student_status));
  if(!selected.length)return null;
  const grouped=new Map<string,Enrollment[]>();
  selected.forEach(x=>grouped.set(x.course_id,[...(grouped.get(x.course_id)??[]),x]));
  return [...grouped.values()].reduce((sum,items)=>sum+courseTotals(items).value,0);
}
function rank(offers:Offer[],key:"discipline"|"teachers"){
  const groups=new Map<string,{label:string;rf:number;rn:number;ra:number;vinculos:number}>();
  for(const row of offers){
    const label=String(row[key]??"Não informado").trim()||"Não informado";
    const v=groups.get(label)??{label,rf:0,rn:0,ra:0,vinculos:0};
    v.rf+=n(row.rf);v.rn+=n(row.rn);v.ra+=n(row.ra);v.vinculos+=n(row.discipline_enrollments);groups.set(label,v);
  }
  return [...groups.values()].sort((a,b)=>(b.rf+b.rn+b.ra)-(a.rf+a.rn+a.ra)).slice(0,12);
}
type Totals={matriculados:number|null;rf:number|null;rn:number|null;ra:number|null;vinculos:number|null;ofertas:number|null;evasao:number|null;trancado:number|null};
const high:Role[]=["master","reitor","gestor","diretor_geral","diretor_pedagogico","procurador"];

export default function EnadeCross({institutionId,courses,goals,actions,role,selectedCourseId,onPlan}:{
  institutionId:string;courses:Row[];goals:Row[];actions:Row[];role:Role|null;selectedCourseId:string;onPlan:()=>void;
}){
  const [data,setData]=useState<Data>(EMPTY);
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState("");
  const [comparison,setComparison]=useState<"year"|"term">("year");
  const [revision,setRevision]=useState(0);
  const allowed=Boolean(role&&high.includes(role));
  const refresh=useCallback(async()=>{
    if(!allowed){setLoading(false);return;}
    setLoading(true);
    const sources=[
      ["Ofertas, docentes e reprovações","offers","vertice_offering_outcomes","institution_id","id,semester,course_code,discipline,teachers,rf,rn,ra,discipline_enrollments"],
      ["Matrículas","enrollments","vertice_enrollment_snapshots","institution_id","id,course_id,semester,student_status,class_label,enrolled,reported_total,source_report_at"],
      ["Histórico de evasão","stats","vertice_course_semester_stats","institution_id","id,codigo,semestre,modalidade,evasao_total,trancado"],
      ["Relatórios acadêmicos","reports","vertice_academic_reports","institution_id","id,course_id,kind,source_report_at"],
      ["Risco agregado","risks","vertice_risco_agregado","institution_id","id,codigo_curso,alunos_risco,data_referencia"],
      ["Solicitações do repositório","requests","vertice_repository_requests","institution_id","id,course_id,semester"],
      ["Evidências documentais","files","vertice_repository_files","institution_id","id,request_id,status"],
      ["Espelho ENADE",null,"vertice_eorbit_enade","instituicao_id","id"],
      ["Diários",null,"vertice_eorbit_diario_classe","instituicao_id","id"],
      ["Frequência e conteúdo",null,"vertice_eorbit_frequencia_conteudo","instituicao_id","id"],
      ["Professores do sistema acadêmico",null,"vertice_eorbit_professores","instituicao_id","id"],
      ["Conformidade dos planos",null,"vertice_eorbit_compliance_plano","instituicao_id","id"],
      ["Conformidade de notas",null,"vertice_eorbit_compliance_notas","instituicao_id","id"],
      ["Registros e-MEC",null,"vertice_emec_snapshots","institution_id","id"],
      ["Biblioteca INEP",null,"vertice_inep_library","institution_id","id"],
      ["Captação",null,"vertice_captacao_leads","institution_id","id"],
    ] as const;
    const results=await Promise.allSettled(sources.map(s=>fetchPages(s[2],institutionId,s[3],s[4])));
    const next:Data={...EMPTY,sources:[]};
    results.forEach((res,i)=>{
      const src=sources[i];
      if(res.status==="rejected"){next.sources.push({name:src[0],count:0,error:String(res.reason)});return;}
      next.sources.push({name:src[0],count:res.value.length,error:null});
      if(src[1]==="offers")next.offers=res.value as Offer[];
      if(src[1]==="enrollments")next.enrollments=res.value as Enrollment[];
      if(src[1]==="stats")next.stats=res.value as Stats[];
      if(src[1]==="reports")next.reports=res.value as Report[];
      if(src[1]==="risks")next.risks=res.value as Risk[];
      if(src[1]==="requests")next.requests=res.value as Request[];
      if(src[1]==="files")next.files=res.value as EvidenceFile[];
    });
    setData(next);setLoading(false);
  },[institutionId,allowed]);
  useEffect(()=>{void refresh();},[refresh,revision]);

  const mapping=useMemo(()=>{
    const byCode=new Map<string,string[]>();
    for(const c of courses){const code=codeOf(c.code);if(code)byCode.set(code,[...(byCode.get(code)??[]),String(c.id)]);}
    const valid=new Map<string,string>();
    byCode.forEach((ids,code)=>{if(ids.length===1)valid.set(code,ids[0]);});
    const offers=new Map<string,Offer[]>(),stats=new Map<string,Stats[]>(),risks=new Map<string,Risk[]>();
    let ambiguous=0,unmatched=0;
    for(const o of data.offers){
      const key=codeOf(o.course_code),id=valid.get(key);
      if(id)offers.set(id,[...(offers.get(id)??[]),o]);
      else if((byCode.get(key)?.length??0)>1)ambiguous++;
      else unmatched++;
    }
    for(const x of data.stats){const id=valid.get(codeOf(x.codigo));if(id)stats.set(id,[...(stats.get(id)??[]),x]);}
    for(const x of data.risks){const id=valid.get(codeOf(x.codigo_curso));if(id)risks.set(id,[...(risks.get(id)??[]),x]);}
    return{offers,stats,risks,byCode,ambiguous,unmatched,linked:data.offers.length-ambiguous-unmatched};
  },[data.offers,data.stats,data.risks,courses]);
  const current=courses.find(c=>c.id===selectedCourseId);
  const ids=current?new Set([String(current.id)]):new Set(courses.map(c=>String(c.id)));
  const offers=current?(mapping.offers.get(String(current.id))??[]):[...mapping.offers.values()].flat();
  const stats=current?(mapping.stats.get(String(current.id))??[]):[...mapping.stats.values()].flat();
  const risks=current?(mapping.risks.get(String(current.id))??[]):[...mapping.risks.values()].flat();
  const terms=[...new Set([
    ...data.offers.map(x=>term(x.semester)),
    ...data.enrollments.map(x=>term(x.semester)),
    ...data.stats.map(x=>term(x.semestre)),
  ].filter(Boolean))].sort().reverse();
  const active=terms.includes(period)?period:(terms[0]??"");
  const priorTerm=previous(active,comparison);
  const snapshots=useMemo(()=>latest(data.enrollments),[data.enrollments]);
  function totals(t:string):Totals{
    const subset=offers.filter(x=>term(x.semester)===t);
    const summary=subset.reduce((acc,x)=>({rf:acc.rf+n(x.rf),rn:acc.rn+n(x.rn),ra:acc.ra+n(x.ra),
      vinculos:acc.vinculos+n(x.discipline_enrollments),ofertas:acc.ofertas+1}),{rf:0,rn:0,ra:0,vinculos:0,ofertas:0});
    const rows=stats.filter(x=>term(x.semestre)===t);
    // Não somar diferentes versões/granularidades de uma mesma extração.
    const seen=new Map<string,Stats>();for(const x of rows){const key=codeOf(x.codigo)+"|"+String(x.modalidade??"");if(!seen.has(key))seen.set(key,x);}
    const unique=[...seen.values()];
    return {...(subset.length?summary:{rf:null,rn:null,ra:null,vinculos:null,ofertas:null}),matriculados:enrollCount(snapshots,ids,t),
      evasao:unique.length?unique.reduce((a,x)=>a+n(x.evasao_total),0):null,
      trancado:unique.length?unique.reduce((a,x)=>a+n(x.trancado),0):null};
  }
  const value=totals(active),prior=totals(priorTerm);
  const observed=offers.filter(x=>term(x.semester)===active);
  const discipline=rank(observed,"discipline"),teachers=rank(observed,"teachers");
  const reported=data.reports.filter(r=>!current||r.course_id===current.id);
  const actionsN=actions.filter(x=>!current||x.course_id===current.id);
  const goalsN=goals.filter(x=>!current||x.course_id===current.id);
  const requestsN=data.requests.filter(x=>!current||x.course_id===current.id);
  const requestIds=new Set(requestsN.map(x=>x.id));
  const filesN=data.files.filter(x=>requestIds.has(x.request_id));
  const filesValidated=filesN.filter(x=>x.status==="validado").length;
  const riskRecords=risks.filter(x=>String(x.data_referencia??"").startsWith(active.slice(0,4)));
  const latestRisk=new Map<string,Risk>();
  for(const x of [...riskRecords].sort((a,b)=>String(b.data_referencia).localeCompare(String(a.data_referencia)))){
    const code=codeOf(x.codigo_curso);
    if(!latestRisk.has(code))latestRisk.set(code,x);
  }
  const riskCount=latestRisk.size?[...latestRisk.values()].reduce((sum,x)=>sum+n(x.alunos_risco),0):null;
  const statusCode=current?mapping.byCode.get(codeOf(current.code))?.length??0:1;
  const metrics:[string,number|null,number|null,string][]=[
    ["Matriculados",value.matriculados,prior.matriculados,"Pessoas informadas nos relatórios"],
    ["Reprovações por falta",value.rf,prior.rf,"Ocorrências em disciplinas"],
    ["Reprovações por nota",value.rn,prior.rn,"Ocorrências em disciplinas"],
    ["Falta e nota",value.ra,prior.ra,"Categoria combinada"],
    ["Ofertas analisadas",value.ofertas,prior.ofertas,"Registros por oferta"],
    ["Matrículas em disciplinas",value.vinculos,prior.vinculos,"Registros nas ofertas; um aluno pode aparecer em várias disciplinas"],
    ["Evasão",value.evasao,prior.evasao,"Contagem da fonte agregada"],
    ["Trancamentos",value.trancado,prior.trancado,"Contagem da fonte agregada"],
  ];
  return <section className="enadex" aria-label="Cruzamento dos dados acadêmicos">
    <header><div><span className="enade360-eyebrow">INTELIGÊNCIA ACADÊMICA CONECTADA</span>
      <h4>ENADE 360° · Cruzamento de dados</h4>
      <p>{current?String(current.display_name??current.name):"Todos os cursos desta instituição"}. Matrículas, reprovações, docentes, evasão, riscos, relatórios e plano 5W2H.</p></div>
      <button type="button" className="corp-button small" onClick={()=>setRevision(v=>v+1)} disabled={loading}>Atualizar cruzamentos</button>
    </header>
    {!allowed?<p role="alert">O acesso aos dados de reprovação e docência é reservado aos perfis institucionais da alta gestão.</p>:<>
      {loading?<p role="status">Cruzando dados reais por curso e período…</p>:null}
      {data.sources.some(x=>x.error)&&<p role="alert" className="enadex-alert">Uma ou mais fontes não responderam. Os valores indisponíveis não são tratados como zero; consulte a auditoria de fontes.</p>}
      <div className="enadex-filters"><HelpLabel>Semestre<select value={active} onChange={e=>setPeriod(e.target.value)}>
        {terms.map(x=><option key={x} value={x}>{x}</option>)}
      </select></HelpLabel><HelpLabel>Comparação<select value={comparison} onChange={e=>setComparison(e.target.value as "year"|"term")}>
        <option value="year">Mesmo semestre do ano anterior</option>
        <option value="term">Semestre imediatamente anterior</option>
      </select></HelpLabel><span>{active||"—"} × {priorTerm||"—"}</span></div>
      <div className="enadex-metrics">{metrics.map(([label,a,b,description])=><article key={label}>
        <span>{label}</span><strong>{a===null?"—":fmt.format(a)}</strong>
        <small>{priorTerm}: {b===null?"sem dados":fmt.format(b)} · diferença {a===null||b===null?"indisponível":(a-b>0?"+":"")+fmt.format(a-b)}</small>
        <em>{description}</em>
      </article>)}</div>
      <p className="enadex-alert">RF/RN/RA representam <strong>ocorrências registradas por disciplina</strong>, não estudantes diferentes. O índice bruto adicional utiliza a soma das categorias por matrículas em disciplinas; não equivale à taxa de alunos reprovados e depende da homologação do dicionário RF/RN/RA e da ausência de sobreposição para uso regulatório. O indicador não é nota oficial do ENADE e não prova causalidade docente. {statusCode>1?"O código deste curso está duplicado: reprovações não são atribuídas a nenhum dos cadastros até a reconciliação.":""}</p>
      <div className="enadex-tables">
        {([["Disciplinas com mais reprovações",discipline],["Docência registrada em ofertas",teachers]] as const).map(([title,rows])=><section key={title}><h5>{title} · {active}</h5>
          <p className="enadex-alert">Matrículas em disciplinas = registros nas ofertas. Um aluno matriculado em várias disciplinas pode gerar vários registros. Índice bruto = (RF + RN + RA) ÷ matrículas em disciplinas × 100, quando o denominador é válido; não mede estudantes únicos nem reprovação oficial.</p>
          <div className="enadex-scroll"><table><thead><tr><th>Registro</th><th title="Código RF informado pela fonte; motivo sujeito à homologação">RF</th><th title="Código RN informado pela fonte; motivo sujeito à homologação">RN</th><th title="Código RA informado pela fonte; significado definitivo sujeito à homologação">RA</th><th title="Quantidade de matrículas em ofertas de disciplinas. Um mesmo aluno pode gerar vários registros.">Matrículas em disciplinas</th><th title="Soma bruta das categorias RF, RN e RA dividida pelas matrículas em disciplinas, sem deduplicação de alunos. Não é taxa oficial de reprovação.">Índice bruto de ocorrências</th></tr></thead>
          <tbody>{rows.map(x=><tr key={x.label}><td>{x.label}</td><td>{fmt.format(x.rf)}</td><td>{fmt.format(x.rn)}</td><td>{fmt.format(x.ra)}</td><td>{fmt.format(x.vinculos)}</td><td title="Indicador descritivo; não representa taxa de alunos reprovados">{incidenciaBruta(x)}</td></tr>)}
          {!rows.length&&<tr><td colSpan={6}>Sem registros atribuíveis com segurança neste período.</td></tr>}</tbody></table></div>
        </section>)}
      </div>
      <section className="enadex-panel"><h5>Correlação com gestão institucional</h5>
        <div className="enadex-numbers">
          <div><b>{reported.length}</b><span>Relatórios acadêmicos vinculados</span></div>
          <div><b>{goalsN.length}</b><span>Metas</span></div>
          <div><b>{actionsN.length}</b><span>Ações 5W2H</span></div>
          <div><b>{requestsN.length}</b><span>Solicitações documentais do repositório</span></div>
          <div><b>{filesN.length}</b><span>Arquivos associados às solicitações</span></div>
          <div><b>{filesValidated}</b><span>Evidências documentais validadas</span></div>
          <div><b>{riskCount===null?"—":fmt.format(riskCount)}</b><span>Risco agregado com data no ano</span></div>
        </div>
        <p>Dados correlacionados por instituição e, quando existente, identificador inequívoco de curso. Risco de evasão não é uma previsão de ENADE.</p>
        <button type="button" className="corp-button small" onClick={onPlan}>Abrir plano 5W2H</button>
      </section>
      <section className="enadex-panel"><h5>Rastreabilidade e reconciliação</h5>
        <div className="enadex-numbers">
          <div><b>{fmt.format(mapping.linked)}</b><span>Ofertas vinculadas por código único</span></div>
          <div><b>{fmt.format(mapping.ambiguous)}</b><span>Ofertas de código duplicado</span></div>
          <div><b>{fmt.format(mapping.unmatched)}</b><span>Ofertas sem correspondência</span></div>
          <div><b>{fmt.format(courses.length)}</b><span>Cursos abrangidos pelo módulo</span></div>
        </div>
        <p>Outras fontes por instituição, sem atribuição indevida ao curso: espelho ENADE, diários, frequência e conteúdo, conformidade de notas e planos, professores do e-ORBIT, e-MEC e Biblioteca INEP. Nesses registros, a equivalência com o cadastro da Vértice ainda necessita validação.</p>
        <div className="enadex-sources">{data.sources.map(x=><div key={x.name}>
          <span>{x.name}</span><strong>{x.error?"Indisponível":fmt.format(x.count)}</strong>
          {x.error&&<small>{x.error}</small>}</div>)}</div>
      </section>
    </>}
  </section>;
}
