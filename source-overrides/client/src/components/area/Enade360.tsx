import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import EnadeCross from "./EnadeCross";
import type { Role, Row } from "@/lib/area";
import "./enade-360.css";

type Kind = "ciclo" | "competencia" | "diagnostico" | "resultado_oficial" | "evidencia";
type Status = "pendente" | "validado" | "rejeitado";
type EnadeRecord = {
  id: string; institution_id: string; course_id: string; kind: Kind; title: string;
  competency: string | null; cycle_year: number | null; assessment_date: string | null;
  sample_size: number | null; performance_percent: number | null;
  source_kind: "institucional" | "oficial" | "espelho"; source_ref: string | null;
  evidence: string | null; notes: string | null; validation_status: Status;
  created_at: string; validated_at: string | null;
};
type MirrorEnade = { id: number; semestre: string; curso_nome: string; habilitados: number | null };
type CourseSummary = {
  id: string; name: string; code: string; degree: string; modality: string; status: string;
  records: EnadeRecord[]; diagnostics: EnadeRecord[]; official: EnadeRecord[];
  actions: number; evaluated: boolean; attention: boolean;
};
type Draft = {
  kind: Kind; title: string; competency: string; year: string; sample: string; score: string;
  source: "institucional" | "oficial" | "espelho"; sourceRef: string; evidence: string; notes: string;
};
const INITIAL: Draft = {
  kind: "competencia", title: "", competency: "", year: String(new Date().getFullYear()),
  sample: "", score: "", source: "institucional", sourceRef: "", evidence: "", notes: "",
};
const KIND_LABEL: Record<Kind,string> = {
  ciclo: "Ciclo de avaliação", competencia: "Competência curricular",
  diagnostico: "Diagnóstico institucional", resultado_oficial: "Resultado oficial documentado",
  evidencia: "Evidência pedagógica",
};
const MANAGERS: Role[] = ["master","gestor","reitor","diretor_geral","diretor_pedagogico","procurador"];
const AUTHORS: Role[] = [...MANAGERS,"equipe","cpa"];
const fmt = new Intl.NumberFormat("pt-BR");
const pct = (n:number) => n.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}) + "%";
function safeUrl(url:string|null):string|null {
  if (!url) return null;
  try { const result=new URL(url);return result.protocol==="https:"?result.href:null; } catch {return null;}
}
async function readPages<T>(table:string,institutionId:string,field:string,columns:string):Promise<T[]> {
  const all:T[]=[];const size=1000;
  for(let from=0;;from+=size){
    const {data,error}=await supabase.from(table).select(columns).eq(field,institutionId).range(from,from+size-1);
    if(error)throw error;
    const page=(data??[]) as T[];
    all.push(...page);
    if(page.length<size)break;
  }
  return all;
}
function courseStatus(row:CourseSummary) {
  if (!row.diagnostics.length) return {label:row.records.length?"Aguardando diagnóstico":"Sem diagnóstico",color:"neutral"};
  if (!row.evaluated) return {label:"Dados em validação",color:"neutral"};
  if (row.attention) return {label:"Requer análise",color:"warning"};
  return {label:"Diagnóstico documentado",color:"success"};
}

export default function Enade360({institutionId,courses,actions,goals,role,onPlan}:{
  institutionId:string;courses:Row[];actions:Row[];goals:Row[];role:Role|null;onPlan:()=>void;
}) {
  const [records,setRecords]=useState<EnadeRecord[]>([]);
  const [mirror,setMirror]=useState<MirrorEnade[]>([]);
  const [loading,setLoading]=useState(true);
  const [failure,setFailure]=useState("");
  const [courseId,setCourseId]=useState("");
  const [search,setSearch]=useState("");
  const [draft,setDraft]=useState<Draft>(INITIAL);
  const [newRecord,setNewRecord]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const canCreate=Boolean(role && AUTHORS.includes(role));
  const canValidate=Boolean(role && MANAGERS.includes(role));

  const load=useCallback(async()=>{
    setFailure("");
    try {
      const [items,eorbit]=await Promise.all([
        readPages<EnadeRecord>("vertice_enade360_records",institutionId,"institution_id","*"),
        readPages<MirrorEnade>("vertice_eorbit_enade",institutionId,"instituicao_id","id,semestre,curso_nome,habilitados"),
      ]);
      setRecords(items);
      setMirror(eorbit);
    } catch(error){
      setFailure(error instanceof Error?error.message:"Não foi possível carregar as informações do ENADE 360°.");
    } finally {setLoading(false);}
  },[institutionId]);
  useEffect(()=>{setLoading(true);setCourseId("");void load();},[load]);

  const allCourses=useMemo<CourseSummary[]>(()=>courses.map(c=>{
    const id=String(c.id);
    const own=records.filter(r=>r.course_id===id);
    const diagnostics=own.filter(r=>r.kind==="diagnostico");
    const verified=diagnostics.filter(r=>r.validation_status==="validado"&&(r.sample_size??0)>=10);
    const actionCount=actions.filter(a=>a.course_id===id&&String(a.what??"").startsWith("[ENADE 360]")).length;
    return {id,name:String(c.display_name??c.name),code:String(c.code??""),
      degree:String(c.degree??""),modality:String(c.modality??""),status:String(c.status??""),
      records:own,diagnostics,official:own.filter(r=>r.kind==="resultado_oficial"&&r.validation_status==="validado"),
      actions:actionCount,evaluated:verified.length>0,attention:verified.some(r=>Number(r.performance_percent)<60)};
  }).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{numeric:true})),[courses,records,actions]);
  const filtered=useMemo(()=>allCourses.filter(c=>
    (c.name+" "+c.code+" "+c.degree).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))
  ),[allCourses,search]);
  const current=allCourses.find(c=>c.id===courseId)??null;
  const counts={
    courses:allCourses.length,
    diagnosed:allCourses.filter(c=>c.evaluated).length,
    uncovered:allCourses.filter(c=>!c.diagnostics.length).length,
    pending:records.filter(r=>r.validation_status==="pendente").length,
    validated:records.filter(r=>r.validation_status==="validado").length,
    actions:allCourses.reduce((n,c)=>n+c.actions,0),
  };
  async function register(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!current||!canCreate)return;
    setBusy(true);setMessage("");
    try {
      const isOfficial=draft.kind==="resultado_oficial";
      const source=isOfficial?"oficial":draft.source;
      if(isOfficial&&!safeUrl(draft.sourceRef))throw Error("Informe a URL HTTPS da fonte oficial verificável.");
      if(draft.kind==="diagnostico"){
        const sample=Number(draft.sample),score=Number(draft.score);
        if(!Number.isInteger(sample)||sample<1||draft.score.trim()===""||!Number.isFinite(score)||score<0||score>100)
          throw Error("Diagnóstico exige tamanho da amostra e resultado de 0% a 100%.");
      }
      const {error}=await supabase.from("vertice_enade360_records").insert({
        institution_id:institutionId,course_id:current.id,kind:draft.kind,
        title:draft.title.trim(),competency:draft.competency.trim()||null,
        cycle_year:draft.year?Number(draft.year):null,
        assessment_date:new Date().toISOString().slice(0,10),
        sample_size:draft.kind==="diagnostico"?Number(draft.sample):null,
        performance_percent:draft.kind==="diagnostico"?Number(draft.score):null,
        source_kind:source,source_ref:draft.sourceRef.trim()||null,
        evidence:draft.evidence.trim()||null,notes:draft.notes.trim()||null,
        validation_status:"pendente",
      });
      if(error)throw error;
      setDraft(INITIAL);setNewRecord(false);
      setMessage("Registro criado como pendente de validação institucional.");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Falha ao salvar registro.");}
    finally{setBusy(false);}
  }
  async function validate(record:EnadeRecord,accept:boolean) {
    if(!canValidate)return;
    if(!window.confirm(accept?"Validar esta evidência institucional?":"Rejeitar esta evidência?"))return;
    setBusy(true);setMessage("");
    try {
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth.user)throw Error("Sessão não confirmada.");
      const {error}=await supabase.from("vertice_enade360_records").update({
        validation_status:accept?"validado":"rejeitado",
        validated_by:accept?auth.user.id:null,
        validated_at:accept?new Date().toISOString():null,
        updated_at:new Date().toISOString(),
      }).eq("id",record.id).eq("institution_id",institutionId);
      if(error)throw error;
      setMessage(accept?"Evidência validada.":"Evidência rejeitada.");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível validar.");}
    finally{setBusy(false);}
  }
  async function createAction(record?:EnadeRecord){
    if(!current||!canValidate)return;
    if(!window.confirm("Criar ação 5W2H para este curso, vinculada ao ENADE 360°?"))return;
    setBusy(true);setMessage("");
    try {
      const title=record?.title??"Revisar competências e diagnóstico do ENADE";
      const {error}=await supabase.from("vertice_actions").insert({
        institution_id:institutionId,course_id:current.id,
        what:"[ENADE 360] "+title.slice(0,475),
        why:"Acompanhamento contínuo da aprendizagem. Referência interna: "+(record?.id??"diagnóstico geral"),
        where_at:current.name,who:"Coordenação e NDE",how:"Analisar evidências, definir intervenção, aplicar nova avaliação e documentar evolução.",
        status:"nao_iniciada",progress:0,evidence:record?.source_ref??null,
      });
      if(error)throw error;
      setMessage("Ação criada no plano 5W2H do curso.");
      onPlan();
    }catch(error){setMessage(error instanceof Error?error.message:"Falha ao abrir ação 5W2H.");}
    finally{setBusy(false);}
  }
  const mirrorSemesters=[...new Set(mirror.map(m=>m.semestre))].sort().reverse();
  return <section className="enade360" aria-label="Inteligência ENADE 360 graus">
    <header className="enade360-hero">
      <div><span className="enade360-eyebrow">GESTÃO ACADÊMICA CONTÍNUA</span>
        <h3>ENADE 360° <small>· Todos os cursos</small></h3>
        <p>Do diagnóstico à intervenção, do ingresso à conclusão. O cadastro de cursos é a fonte de abrangência; a participação oficial deve ser comprovada por edição.</p>
      </div>
      <button className="corp-button small" type="button" onClick={()=>void load()} disabled={loading}>Atualizar dados</button>
    </header>
    <div className="enade360-kpis">
      <article><span>Cursos cadastrados</span><strong>{fmt.format(counts.courses)}</strong><small>Abrangência institucional integral</small></article>
      <article><span>Com diagnóstico validado</span><strong>{fmt.format(counts.diagnosed)}</strong><small>Amostra mínima de 10</small></article>
      <article><span>Sem diagnóstico registrado</span><strong>{fmt.format(counts.uncovered)}</strong><small>Não significa baixo desempenho</small></article>
      <article><span>Evidências aguardando validação</span><strong>{fmt.format(counts.pending)}</strong><small>Não publicadas como oficiais</small></article>
      <article><span>Ações ENADE 5W2H</span><strong>{fmt.format(counts.actions)}</strong><small>Vinculadas ao plano institucional</small></article>
    </div>
    <p className="enade360-note">As notas e categorias apresentadas abaixo são diagnósticos internos. Não são Conceito ENADE, CPC, IDD ou previsão de resultado oficial. Edição, modalidade e elegibilidade devem ser confirmadas pelas fontes INEP/MEC aplicáveis a cada curso.</p>
    <EnadeCross institutionId={institutionId} courses={courses} goals={goals} actions={actions} role={role} selectedCourseId={courseId} onPlan={onPlan}/>
    {loading?<p role="status">Carregando o conjunto de cursos e evidências…</p>:null}
    {failure?<p role="alert" className="enade360-error">Falha de carregamento: {failure}. Nenhum indicador ausente foi tratado como zero.</p>:null}
    <section className="enade360-panel">
      <div className="enade360-panel-head">
        <div><h4>Mapa institucional de cursos</h4><p>{fmt.format(filtered.length)} de {fmt.format(allCourses.length)} cursos, sem exceção por área</p></div>
        <HelpLabel>Localizar curso <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, código ou grau"/></HelpLabel>
      </div>
      <div className="enade360-table-wrap">
        <table><thead><tr><th>Curso<ContextHelp title="Curso" /></th><th>Registros</th><th>Diagnóstico<ContextHelp title="Diagnóstico" /></th><th>Ações</th><th /></tr></thead><tbody>
          {filtered.map(course=>{
            const state=courseStatus(course);
            return <tr key={course.id} className={courseId===course.id?"enade360-selected":""}>
              <td><strong>{course.name}</strong><small>{course.code||"Sem código"} · {course.degree||"Grau não informado"} · {course.modality||"Modalidade não informada"}</small></td>
              <td>{course.records.length}</td>
              <td><span className={"enade360-state "+state.color}>{state.label}</span></td>
              <td>{course.actions}</td>
              <td><button type="button" className="corp-login-text-button" onClick={()=>{setCourseId(course.id);setNewRecord(false);setMessage("");}}>Examinar curso</button></td>
            </tr>;
          })}
          {!filtered.length?<tr><td colSpan={5}>Nenhum curso corresponde à busca.</td></tr>:null}
        </tbody></table>
      </div>
    </section>
    {current?<section className="enade360-panel" aria-live="polite">
      <div className="enade360-panel-head">
        <div><span className="enade360-eyebrow">DIAGNÓSTICO DO CURSO</span><h4>{current.name}</h4><p>Registros próprios do curso, sem presumir equivalência com códigos externos.</p></div>
        {canCreate?<button type="button" className="corp-button small" onClick={()=>setNewRecord(v=>!v)}>{newRecord?"Fechar formulário":"Registrar evidência"}</button>:null}
      </div>
      <div className="enade360-subkpis">
        <span><b>{current.diagnostics.length}</b> avaliações internas</span>
        <span><b>{current.official.length}</b> resultados oficiais validados</span>
        <span><b>{current.records.filter(r=>r.validation_status==="pendente").length}</b> registros pendentes</span>
        <span><b>{current.actions}</b> ações registradas</span>
      </div>
      {newRecord?<form className="enade360-form" onSubmit={e=>void register(e)}>
        <HelpLabel>Tipo de registro<select value={draft.kind} onChange={e=>setDraft(v=>({...v,kind:e.target.value as Kind}))}>
          {Object.entries(KIND_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select></HelpLabel>
        <HelpLabel>Título<input required minLength={3} maxLength={250} value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}/></HelpLabel>
        <HelpLabel>Competência/tema<input value={draft.competency} maxLength={250} onChange={e=>setDraft(v=>({...v,competency:e.target.value}))}/></HelpLabel>
        <HelpLabel>Ano de referência<input type="number" min={2000} max={2100} value={draft.year} onChange={e=>setDraft(v=>({...v,year:e.target.value}))}/></HelpLabel>
        {draft.kind==="diagnostico"?<>
          <HelpLabel>Estudantes na amostra<input type="number" min={1} step={1} required value={draft.sample} onChange={e=>setDraft(v=>({...v,sample:e.target.value}))}/></HelpLabel>
          <HelpLabel>Aproveitamento interno (%)<input type="number" min={0} max={100} step="0.01" required value={draft.score} onChange={e=>setDraft(v=>({...v,score:e.target.value}))}/></HelpLabel>
        </>:null}
        <HelpLabel>Origem<select value={draft.kind==="resultado_oficial"?"oficial":draft.source} disabled={draft.kind==="resultado_oficial"} onChange={e=>setDraft(v=>({...v,source:e.target.value as Draft["source"]}))}>
          <option value="institucional">Avaliação institucional</option><option value="oficial">Fonte oficial documentada</option><option value="espelho">Extração de sistema acadêmico</option>
        </select></HelpLabel>
        <HelpLabel>Endereço da fonte (HTTPS)<input type="url" placeholder="https://..." required={draft.kind==="resultado_oficial"} value={draft.sourceRef} onChange={e=>setDraft(v=>({...v,sourceRef:e.target.value}))}/></HelpLabel>
        <HelpLabel className="wide">Evidência e metodologia<textarea rows={2} maxLength={4000} value={draft.evidence} onChange={e=>setDraft(v=>({...v,evidence:e.target.value}))}/></HelpLabel>
        <HelpLabel className="wide">Observações<textarea rows={2} maxLength={4000} value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))}/></HelpLabel>
        <div className="wide"><button className="corp-button" disabled={busy} type="submit">Salvar como pendente de validação</button></div>
      </form>:null}
      <h5>Histórico de evidências e evolução</h5>
      {!current.records.length?<p className="enade360-empty">Ainda não existem evidências registradas para este curso. O estado correto é “Sem diagnóstico”, e não uma nota estimada.</p>:<div className="enade360-records">
        {[...current.records].sort((a,b)=>(b.assessment_date||b.created_at).localeCompare(a.assessment_date||a.created_at)).map(record=><article key={record.id}>
          <div><span className="enade360-eyebrow">{KIND_LABEL[record.kind]} · {record.cycle_year||"Sem ano"}</span><strong>{record.title}</strong>
            <p>{record.competency||"Competência não informada"} · {record.sample_size?fmt.format(record.sample_size)+" estudantes": "Amostra não informada"}
              {record.performance_percent!==null?" · "+pct(Number(record.performance_percent))+" (avaliação interna)":""}</p>
            <small>Origem: {record.source_kind} · Situação: <b>{record.validation_status}</b></small>
            {record.source_ref&&safeUrl(record.source_ref)?<p><a href={safeUrl(record.source_ref)||"#"} target="_blank" rel="noopener noreferrer">Consultar fonte informada</a></p>:null}
          </div>
          <div className="enade360-record-actions">
            {canValidate&&record.validation_status==="pendente"?<>
              <button type="button" disabled={busy} onClick={()=>void validate(record,true)}>Validar</button>
              <button type="button" disabled={busy} onClick={()=>void validate(record,false)}>Rejeitar</button>
            </>:null}
            {canValidate?<button type="button" disabled={busy} onClick={()=>void createAction(record)}>Gerar ação 5W2H</button>:null}
          </div>
        </article>)}
      </div>}
      {canValidate?<p><button type="button" className="corp-button secondary small" disabled={busy} onClick={()=>void createAction()}>Criar ação geral 5W2H para este curso</button></p>:null}
    </section>:null}
    {message?<p role="status" className="enade360-feedback">{message}</p>:null}
    <section className="enade360-panel enade360-mirror">
      <h4>Espelho acadêmico existente · e-ORBIT</h4>
      <p>Registros extraídos para esta instituição: <strong>{fmt.format(mirror.length)}</strong>. Períodos presentes: {mirrorSemesters.length?mirrorSemesters.join(", "):"nenhum"}. Esses registros não comprovam, isoladamente, comparecimento, conceito oficial ou equivalência com o cadastro de cursos da Vértice.</p>
      <p>O espelho é exibido como fonte pendente de reconciliação, sem transferência automática de notas ou elegibilidade para os cursos acima.</p>
    </section>
  </section>;
}
