import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import type {Role,Row} from "@/lib/area";
import "./enade-eligibility.css";

type CourseConfig={id:string;eorbit_curso_id:number|null;course_name:string;modalidade:string;area_enade:string;
 total_periodos:number;carga_horaria_total:number;proximo_enade_ano:number|null;
 ingressante_max_pct:number;concludente_min_pct:number;active:boolean};
type Eligible={id:string;student_name:string;matricula:string;cpf:string|null;curso_name:string;
 periodo:number;situacao:string;elegibility_type:string;pct_conclusao:number;
 status:string;fo_linked:boolean;enade_ano:number|null};
const MANAGEMENT:Role[]=["master","reitor","gestor","diretor_geral","diretor_pedagogico"];
const number=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const pct=(n:number)=>(n*100).toFixed(1)+"%";
const AREAS=["Direito","Administração","Ciências Contábeis","Economia","Engenharia Civil","Engenharia Elétrica",
 "Medicina","Enfermagem","Odontologia","Farmácia","Pedagogia","Letras","Psicologia","Serviço Social",
 "Computação","Arquitetura","Educação Física","Medicina Veterinária","Nutrição","Fisioterapia"] as const;

export default function EnadeEligibility({institutionId,courses,role}:{
 institutionId:string;courses:Row[];role:Role|null;
}){
 const canManage=Boolean(role&&MANAGEMENT.includes(role));
 const [configs,setConfigs]=useState<CourseConfig[]>([]);
 const [eligible,setEligible]=useState<Eligible[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [filterType,setFilterType]=useState("");
 const [filterStatus,setFilterStatus]=useState("");
 const [form,setForm]=useState({course_name:"",area_enade:"",total_periodos:10,
  carga_horaria_total:0,proximo_enade_ano:2027,ingressante_max_pct:0.25,concludente_min_pct:0.80,
  eorbit_curso_id:"",modalidade:"presencial"});

 const loadAll=useCallback(async()=>{
  setLoading(true);
  const [{data:cfgs},{data:elig}]=await Promise.all([
   supabase.from("vertice_enade_course_config").select("*").eq("institution_id",institutionId).eq("active",true),
   supabase.from("vertice_enade_eligibility").select("*").eq("institution_id",institutionId).order("curso_name").order("periodo")
  ]);
  setConfigs((cfgs||[]) as CourseConfig[]);
  setEligible((elig||[]) as Eligible[]);
  setLoading(false);
 },[institutionId]);

 useEffect(()=>{if(canManage)void loadAll();},[canManage,loadAll]);

 const saveConfig=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const payload={
    institution_id:institutionId,course_name:form.course_name,area_enade:form.area_enade,
    modalidade:form.modalidade,total_periodos:form.total_periodos,
    carga_horaria_total:form.carga_horaria_total,
    proximo_enade_ano:form.proximo_enade_ano,
    ingressante_max_pct:form.ingressante_max_pct,concludente_min_pct:form.concludente_min_pct,
    eorbit_curso_id:form.eorbit_curso_id?Number(form.eorbit_curso_id):null,
    updated_at:new Date().toISOString()
   };
   if(editing&&editing!=="new"){
    await supabase.from("vertice_enade_course_config").update(payload).eq("id",editing);
   }else{
    await supabase.from("vertice_enade_course_config").insert(payload);
   }
   setMessage("✅ Configuração salva.");setEditing(null);void loadAll();
  }catch(err){setMessage("❌ "+(err as Error).message);}
  finally{setBusy(false);}
 };

 const computeEligibility=async()=>{
  setBusy(true);setMessage("Calculando elegibilidade...");
  try{
   // For each config, query eorbit_alunos and compute eligibility
   let totalComputed=0;
   for(const cfg of configs){
    // Fetch active students for this course from e-ORBIT
    const query=supabase.from("vertice_eorbit_alunos")
     .select("id,nome_aluno,matricula,periodo,situacao")
     .eq("situacao","AD");
    if(cfg.eorbit_curso_id)query.eq("curso_id",cfg.eorbit_curso_id);
    const {data:students}=await query.limit(2000);
    if(!students?.length)continue;

    // Delete previous computed eligibility for this config
    await supabase.from("vertice_enade_eligibility").delete().eq("config_id",cfg.id);

    // Compute eligibility for each student
    const records=students.map(s=>{
     const periodo=Number(s.periodo)||0;
     const pctConclusao=cfg.total_periodos>0?periodo/cfg.total_periodos:0;
     let type:"ingressante"|"concludente"|"regular"|"irregular";
     if(pctConclusao<=cfg.ingressante_max_pct)type="ingressante";
     else if(pctConclusao>=cfg.concludente_min_pct)type="concludente";
     else type="regular";
     return{
      institution_id:institutionId,config_id:cfg.id,eorbit_aluno_id:s.id,
      student_name:s.nome_aluno,matricula:s.matricula,
      curso_name:cfg.course_name,modalidade:cfg.modalidade,
      periodo,situacao:s.situacao,elegibility_type:type,
      pct_conclusao:Math.round(pctConclusao*1000)/1000,
      enade_ano:cfg.proximo_enade_ano,
      status:type==="ingressante"||type==="concludente"?"elegivel":"regular",
      computed_at:new Date().toISOString()
     };
    });

    // Batch insert
    for(let i=0;i<records.length;i+=200){
     await supabase.from("vertice_enade_eligibility").insert(records.slice(i,i+200));
    }
    totalComputed+=records.length;
   }
   setMessage(`✅ ${number(totalComputed)} alunos processados. Elegíveis identificados.`);
   void loadAll();
  }catch(err){setMessage("❌ "+(err as Error).message);}
  finally{setBusy(false);}
 };

 const linkEligibleToFO=async()=>{
  setBusy(true);setMessage("Vinculando elegíveis ao Fato & Ordem...");
  try{
   const elegibles=eligible.filter(e=>
    (e.elegibility_type==="ingressante"||e.elegibility_type==="concludente")
    &&e.status==="elegivel"&&e.cpf&&!e.fo_linked
   );
   if(!elegibles.length){
    setMessage("⚠️ Nenhum aluno elegível com CPF disponível para vincular. Suba o roster com CPF primeiro.");
    return;
   }
   const {data,error}=await supabase.functions.invoke("vertice-learning-bridge",{
    body:{operation:"batch_link",institutionId,
     courseId:courses[0]?.id||institutionId,
     students:elegibles.map(e=>({cpf:e.cpf,name:e.student_name}))}
   });
   if(error)throw error;
   // Update linked status
   const linkedIds=elegibles.map(e=>e.id);
   await supabase.from("vertice_enade_eligibility")
    .update({fo_linked:true,fo_linked_at:new Date().toISOString(),status:"vinculado_fo",updated_at:new Date().toISOString()})
    .in("id",linkedIds);
   setMessage(`✅ ${number(data?.linked||0)} alunos vinculados ao ENADE no Fato & Ordem.`);
   void loadAll();
  }catch(err){setMessage("❌ "+(err as Error).message);}
  finally{setBusy(false);}
 };

 // Enrich eligibility with CPF from roster imports
 const enrichFromRoster=async()=>{
  setBusy(true);setMessage("Cruzando com roster importado...");
  try{
   const {data:entries}=await supabase.from("vertice_roster_entries")
    .select("student_name,cpf_hash").eq("institution_id",institutionId).eq("status","matched");
   if(!entries?.length){setMessage("⚠️ Nenhum roster importado. Suba a planilha com CPF na aba Aprendizagem Conectada.");return;}
   // Match by name (best effort — CPF match would be better with normalized names)
   const nameMap=new Map((entries||[]).map(e=>[e.student_name.toUpperCase().trim(),e.cpf_hash]));
   let enriched=0;
   for(const elig of eligible){
    if(elig.cpf)continue;
    const hash=nameMap.get(elig.student_name.toUpperCase().trim());
    if(hash){
     await supabase.from("vertice_enade_eligibility").update({cpf:hash,updated_at:new Date().toISOString()}).eq("id",elig.id);
     enriched++;
    }
   }
   setMessage(`✅ ${number(enriched)} alunos enriquecidos com CPF do roster.`);
   void loadAll();
  }catch(err){setMessage("❌ "+(err as Error).message);}
  finally{setBusy(false);}
 };

 if(!canManage)return null;

 const filtered=eligible.filter(e=>
  (!filterType||e.elegibility_type===filterType)&&
  (!filterStatus||e.status===filterStatus)
 );
 const stats={
  total:eligible.length,
  ingressantes:eligible.filter(e=>e.elegibility_type==="ingressante").length,
  concludentes:eligible.filter(e=>e.elegibility_type==="concludente").length,
  comCpf:eligible.filter(e=>e.cpf).length,
  vinculados:eligible.filter(e=>e.fo_linked).length,
 };

 return <section className="enade-elig">
  <header>
   <div><small>INTELIGÊNCIA ENADE</small>
    <h3>Elegibilidade ENADE — Motor Automático</h3>
    <p>Identifica ingressantes e concludentes por curso/período. Vincula automaticamente ao banco de questões ENADE do Fato & Ordem para preparação ativa.</p>
   </div>
  </header>

  <div className="enade-kpis">
   <article><small>Alunos processados</small><b>{number(stats.total)}</b></article>
   <article className="kpi-highlight"><small>Ingressantes ENADE</small><b>{number(stats.ingressantes)}</b><span>≤ 25% do curso</span></article>
   <article className="kpi-highlight"><small>Concludentes ENADE</small><b>{number(stats.concludentes)}</b><span>≥ 80% do curso</span></article>
   <article><small>Com CPF (prontos)</small><b>{number(stats.comCpf)}</b></article>
   <article><small>Vinculados ao F&O</small><b>{number(stats.vinculados)}</b></article>
  </div>

  {/* Course ENADE Config */}
  <div className="enade-panel">
   <div className="enade-head">
    <h4>Configuração de cursos para o ENADE</h4>
    <button className="corp-button small" onClick={()=>{setEditing("new");setForm({course_name:"",area_enade:"",total_periodos:10,carga_horaria_total:0,proximo_enade_ano:2027,ingressante_max_pct:0.25,concludente_min_pct:0.80,eorbit_curso_id:"",modalidade:"presencial"});}}>+ Adicionar curso</button>
   </div>
   {configs.length>0&&<table className="enade-table"><thead><tr><th>Curso<ContextHelp title="Curso" /></th><th>Área ENADE</th><th>Períodos</th><th>Próximo ENADE</th><th>Ingressante ≤</th><th>Concludente ≥</th><th></th></tr></thead>
    <tbody>{configs.map(c=><tr key={c.id}>
     <td><strong>{c.course_name}</strong><small>{c.modalidade}</small></td>
     <td>{c.area_enade}</td><td>{c.total_periodos}</td>
     <td>{c.proximo_enade_ano||"—"}</td>
     <td>{pct(c.ingressante_max_pct)}</td><td>{pct(c.concludente_min_pct)}</td>
     <td><button className="corp-button small outline" onClick={()=>{setEditing(c.id);setForm({
      course_name:c.course_name,area_enade:c.area_enade,total_periodos:c.total_periodos,
      carga_horaria_total:c.carga_horaria_total,proximo_enade_ano:c.proximo_enade_ano||2027,
      ingressante_max_pct:c.ingressante_max_pct,concludente_min_pct:c.concludente_min_pct,
      eorbit_curso_id:c.eorbit_curso_id?.toString()||"",modalidade:c.modalidade
     });}}>Editar</button></td>
    </tr>)}</tbody>
   </table>}
   {!configs.length&&!editing&&<p className="muted">Nenhum curso configurado. Adicione os cursos que participam do ENADE.</p>}
  </div>

  {editing&&<div className="enade-panel enade-form-panel">
   <h4>{editing==="new"?"Novo curso":"Editar curso"}</h4>
   <form className="enade-form" onSubmit={saveConfig}>
    <HelpLabel>Nome do curso<input required value={form.course_name} onChange={e=>setForm(f=>({...f,course_name:e.target.value}))} placeholder="Direito"/></HelpLabel>
    <HelpLabel>Área ENADE<select value={form.area_enade} onChange={e=>setForm(f=>({...f,area_enade:e.target.value}))} required>
     <option value="">Selecione</option>{AREAS.map(a=><option key={a} value={a}>{a}</option>)}
    </select></HelpLabel>
    <HelpLabel>Modalidade<select value={form.modalidade} onChange={e=>setForm(f=>({...f,modalidade:e.target.value}))}>
     <option value="presencial">Presencial</option><option value="semipresencial">Semipresencial</option><option value="ead">EAD</option>
    </select></HelpLabel>
    <HelpLabel>Total de períodos<input type="number" min={1} max={20} required value={form.total_periodos} onChange={e=>setForm(f=>({...f,total_periodos:Number(e.target.value)}))}/></HelpLabel>
    <HelpLabel>Carga horária total (h)<input type="number" min={0} value={form.carga_horaria_total} onChange={e=>setForm(f=>({...f,carga_horaria_total:Number(e.target.value)}))}/></HelpLabel>
    <HelpLabel>Próximo ENADE (ano)<input type="number" min={2025} max={2035} value={form.proximo_enade_ano} onChange={e=>setForm(f=>({...f,proximo_enade_ano:Number(e.target.value)}))}/></HelpLabel>
    <HelpLabel>ID curso e-ORBIT<input value={form.eorbit_curso_id} onChange={e=>setForm(f=>({...f,eorbit_curso_id:e.target.value}))} placeholder="Opcional — ID numérico do e-ORBIT"/></HelpLabel>
    <HelpLabel>Ingressante: até<input type="number" step={0.01} min={0} max={1} value={form.ingressante_max_pct} onChange={e=>setForm(f=>({...f,ingressante_max_pct:Number(e.target.value)}))}/><small>INEP padrão: 0.25 (25%)</small></HelpLabel>
    <HelpLabel>Concludente: a partir de<input type="number" step={0.01} min={0} max={1} value={form.concludente_min_pct} onChange={e=>setForm(f=>({...f,concludente_min_pct:Number(e.target.value)}))}/><small>INEP padrão: 0.80 (80%)</small></HelpLabel>
    <div className="enade-actions">
     <button className="corp-button" type="submit" disabled={busy}>{busy?"Salvando…":"Salvar"}</button>
     <button className="corp-button outline" type="button" onClick={()=>setEditing(null)}>Cancelar</button>
    </div>
   </form>
  </div>}

  {/* Actions */}
  <div className="enade-panel enade-action-bar">
   <button className="corp-button" disabled={busy||!configs.length} onClick={()=>void computeEligibility()}>
    {busy?"Processando…":"🔍 Calcular elegibilidade"}
   </button>
   <button className="corp-button secondary" disabled={busy||!eligible.length} onClick={()=>void enrichFromRoster()}>
    📋 Cruzar CPF do roster
   </button>
   <button className="corp-button" disabled={busy||!stats.comCpf} onClick={()=>void linkEligibleToFO()}>
    🎯 Vincular elegíveis ao ENADE (F&O)
   </button>
  </div>

  {message&&<p role="status" className="enade-message">{message}</p>}

  {/* Eligibility table */}
  {eligible.length>0&&<div className="enade-panel">
   <div className="enade-head">
    <h4>Alunos elegíveis — ENADE {configs[0]?.proximo_enade_ano||""}</h4>
    <div className="enade-filters">
     <select value={filterType} onChange={e=>setFilterType(e.target.value)}>
      <option value="">Todos os tipos</option>
      <option value="ingressante">Ingressantes</option>
      <option value="concludente">Concludentes</option>
      <option value="regular">Regulares (não elegíveis)</option>
     </select>
     <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
      <option value="">Todos os status</option>
      <option value="elegivel">Elegível</option>
      <option value="vinculado_fo">Vinculado ao F&O</option>
      <option value="dispensado">Dispensado</option>
     </select>
    </div>
   </div>
   <div className="enade-scroll"><table className="enade-table"><thead><tr>
    <th>Aluno</th><th>Matrícula</th><th>Curso<ContextHelp title="Curso" /></th><th>Período<ContextHelp title="Período" /></th><th>% Conclusão</th><th>Tipo</th><th>CPF</th><th>Status</th>
   </tr></thead><tbody>{filtered.slice(0,200).map(e=><tr key={e.id} className={e.elegibility_type==="concludente"?"row-concludente":e.elegibility_type==="ingressante"?"row-ingressante":""}>
    <td>{e.student_name}</td><td>{e.matricula}</td><td>{e.curso_name}</td>
    <td>{e.periodo}º</td><td>{pct(e.pct_conclusao)}</td>
    <td><span className={"elig-badge elig-"+e.elegibility_type}>{e.elegibility_type==="concludente"?"Concludente":e.elegibility_type==="ingressante"?"Ingressante":"Regular"}</span></td>
    <td>{e.cpf?"✅":"❌"}</td>
    <td><span className={"elig-badge elig-status-"+e.status}>{e.status==="vinculado_fo"?"Vinculado F&O":e.status==="elegivel"?"Elegível":e.status}</span></td>
   </tr>)}</tbody></table></div>
   {filtered.length>200&&<p className="muted">Mostrando 200 de {number(filtered.length)} registros.</p>}
  </div>}

  {loading&&<p role="status">Carregando dados de elegibilidade…</p>}
 </section>;
}
