import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const EXAM_LABELS: Record<string,string> = {
  enamed:"ENAMED", enade:"ENADE (acervo histórico)", residencia:"Residência Médica"
};
type Exam = "enamed" | "enade" | "residencia";
type Metric = {
  course_id:string; institution_id:string; module:string; semester:string;
  subject_code:string; competency:string; participants:number; attempts:number;
  graded:number; correct:number; paired_students:number;
  external_accuracy:number|null; curricular_average:number|null; updated_at:string;
};
type Props = { institutionId:string; courseId:string };
type State = "idle"|"loading"|"ready"|"error";
const pct = (n:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(n)+"%";
const count = (n:number)=>new Intl.NumberFormat("pt-BR").format(n);

export default function EnamedFatoOrdemMetrics({institutionId,courseId}:Props) {
  const [rows,setRows]=useState<Metric[]>([]);
  const [status,setStatus]=useState<State>("idle");
  const [message,setMessage]=useState("");
  const [exam,setExam]=useState<Exam>("enamed");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    setRows([]);
    if(!institutionId||!courseId){setStatus("idle");setMessage("");return()=>{active=false;};}
    setStatus("loading");setMessage("");
    (async()=>{
      try{
        const result=await supabase.from("vertice_learning_course_metrics")
          .select("institution_id,course_id,semester,subject_code,module,competency,participants,attempts,graded,correct,paired_students,external_accuracy,curricular_average,updated_at")
          .eq("institution_id",institutionId).eq("course_id",courseId)
          .in("module",["enade","enamed","residencia"])
          .order("updated_at",{ascending:false}).limit(1001);
        if(!active)return;
        if(result.error)throw result.error;
        const validated=(result.data??[]).filter((r:any)=>
          r.institution_id===institutionId&&r.course_id===courseId&&
          (r.module==="enade"||r.module==="enamed"||r.module==="residencia")
        ) as Metric[];
        setRows(validated.slice(0,1000));
        setMessage(validated.length>1000?"A consulta alcançou o limite de 1.000 agrupamentos. Refine a análise no painel Aprendizagem Conectada; este quadro não representa a base completa.":"");
        setStatus("ready");
      }catch(error){
        if(!active)return;
        setStatus("error");
        setMessage(error instanceof Error?error.message:"Não foi possível consultar os indicadores institucionais.");
      }
    })();
    return()=>{active=false;};
  },[institutionId,courseId,revision]);
  const selected=useMemo(()=>rows.filter(r=>r.module===exam&&r.participants>=5),[rows,exam]);
  const totalGraded=selected.reduce((n,r)=>n+Math.max(0,r.graded||0),0);
  const totalCorrect=selected.reduce((n,r)=>n+Math.max(0,r.correct||0),0);
  const canShowRate=totalGraded>0 && selected.every(r=>r.graded>=0&&r.correct>=0&&r.correct<=r.graded);
  const noData=status==="ready"&&selected.length===0;
  return <section aria-label="Integração pedagógica Fato e Ordem" style={{border:"1px solid #cbd5e1",borderRadius:12,padding:16,background:"#fff",marginTop:16}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
      <div><h4 style={{margin:"0 0 4px"}}>Fato & Ordem — indicadores por curso</h4><p style={{margin:0,fontSize:13}}>Leitura agregada da ponte institucional existente, sujeita às permissões da Vértice.</p></div>
      <button type="button" disabled={!courseId||status==="loading"} onClick={()=>setRevision(v=>v+1)}>Atualizar indicadores</button>
    </header>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,margin:"12px 0"}}>
      {(Object.keys(EXAM_LABELS) as Exam[]).map(k=><button key={k} type="button" aria-pressed={exam===k} onClick={()=>setExam(k)} style={{background:exam===k?"#174c78":"#edf3fa",color:exam===k?"white":"#174c78",padding:"8px 10px",border:"1px solid #becddd",borderRadius:8}}>{EXAM_LABELS[k]}</button>)}
    </div>
    {status==="idle"?<p role="status">Selecione um curso de Medicina cadastrado para consultar apenas os resultados da instituição.</p>:null}
    {status==="loading"?<p role="status">Consultando dados agregados autorizados…</p>:null}
    {status==="error"?<p role="alert">Falha na consulta: {message}. Nenhuma nota foi inferida.</p>:null}
    {status==="ready"?<>
      <p style={{fontSize:12}}>Origem: <strong>simulados e eventos do Fato & Ordem</strong> consolidados na tabela institucional. Não são pontuações TRI ou resultados oficiais do Inep.</p>
      {message?<p role="status">{message}</p>:null}
      {noData?<p role="status">Sem indicadores publicados para {EXAM_LABELS[exam]} neste curso. Ausência de dados não representa desempenho zero; a vinculação acadêmica, o mapeamento e a sincronização podem estar pendentes.</p>:<>
        <div style={{display:"flex",flexWrap:"wrap",gap:12,padding:"8px 0"}}>
          <div><small>Agrupamentos publicados</small><div><strong>{count(selected.length)}</strong></div></div>
          <div><small>Respostas avaliadas por vínculo</small><div><strong>{count(totalGraded)}</strong></div></div>
          <div><small>Acerto por vínculo</small><div><strong>{canShowRate?pct(totalCorrect/totalGraded*100):"Indisponível"}</strong></div></div>
        </div>
        <p style={{fontSize:12}}>As mesmas tentativas podem aparecer em mais de um agrupamento curricular. Este percentual é descritivo por vínculo e não mede proficiência individual ou taxa única de acertos do curso.</p>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Período","Disciplina","Competência mapeada","Participantes","Acertos / respostas","Última atualização"].map(t=><th key={t} scope="col" style={{textAlign:"left",padding:8,borderBottom:"1px solid #cbd5e1"}}>{t}</th>)}</tr></thead>
            <tbody>{selected.map((r,i)=><tr key={r.semester+":"+r.subject_code+":"+r.competency+":"+i}>
              <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.semester||"—"}</td>
              <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.subject_code||"—"}</td>
              <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.competency||"Não mapeada"}</td>
              <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.participants>=5?count(r.participants):"Amostra protegida"}</td>
              <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.participants>=5&&r.graded>0&&r.correct<=r.graded?r.correct+" / "+r.graded:"—"}</td>
              <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{r.updated_at?new Date(r.updated_at).toLocaleDateString("pt-BR"):"—"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </>:null}
    <p style={{fontSize:12,marginTop:12}}>Dados oficiais ENAMED/ENADE, boletins de IES e calibração TRI terão importação própria após autenticação e homologação das fontes do Inep. Nenhum vínculo curricular é criado por esta tela.</p>
  </section>;
}
