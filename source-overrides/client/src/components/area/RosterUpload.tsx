import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {Role,Row} from "@/lib/area";
import "./roster-upload.css";

type ImportRecord={id:string;filename:string;total_rows:number;matched:number;linked:number;skipped:number;status:string;error_message:string|null;created_at:string;completed_at:string|null;course_id:string};
type EntryRecord={id:string;student_name:string;status:string;course_label:string;turma:string};
const MANAGEMENT:Role[]=["master","reitor","gestor","diretor_geral","diretor_pedagogico","procurador"];
const number=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const date=(v:string)=>{try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));}catch{return"—";}};

function parseCsv(text:string):{name:string;cpf:string;curso:string;turma:string}[]{
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length)return[];
  const sep=lines[0].includes(";")?";":lines[0].includes("\t")?"\t":",";
  const header=lines[0].split(sep).map(h=>h.trim().toLowerCase().replace(/[" ]/gu,""));
  const iName=header.findIndex(h=>/nome|aluno|student/u.test(h));
  const iCpf=header.findIndex(h=>/cpf|documento|doc/u.test(h));
  const iCurso=header.findIndex(h=>/curso|course|programa/u.test(h));
  const iTurma=header.findIndex(h=>/turma|class|grupo|period/u.test(h));
  if(iCpf<0)throw new Error("Coluna de CPF não encontrada. Use cabeçalho com 'CPF'.");
  return lines.slice(1).map(line=>{
    const cols=line.split(sep).map(c=>c.trim().replace(/^"|"$/gu,""));
    return{name:cols[iName]||"",cpf:cols[iCpf]||"",curso:cols[iCurso]||"",turma:cols[iTurma]||""};
  }).filter(r=>r.cpf.replace(/\D/gu,"").length>=11);
}

export default function RosterUpload({institutionId,courses,role}:{
  institutionId:string;courses:Row[];role:Role|null;
}){
  const canManage=Boolean(role&&MANAGEMENT.includes(role));
  const [userId,setUserId]=useState("");
  useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(data.user)setUserId(data.user.id);});},[]);
  const [imports,setImports]=useState<ImportRecord[]>([]);
  const [entries,setEntries]=useState<EntryRecord[]>([]);
  const [viewImport,setViewImport]=useState<string|null>(null);
  const [selectedCourse,setSelectedCourse]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [preview,setPreview]=useState<{name:string;cpf:string;curso:string;turma:string}[]>([]);
  const [fileName,setFileName]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);

  const loadImports=useCallback(async()=>{
    const {data}=await supabase.from("vertice_roster_imports")
      .select("id,filename,total_rows,matched,linked,skipped,status,error_message,created_at,completed_at,course_id")
      .eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(20);
    setImports((data??[]) as ImportRecord[]);
  },[institutionId]);

  useEffect(()=>{if(canManage)void loadImports();},[canManage,loadImports]);

  const loadEntries=async(importId:string)=>{
    setViewImport(importId);
    const {data}=await supabase.from("vertice_roster_entries")
      .select("id,student_name,status,course_label,turma")
      .eq("import_id",importId).order("student_name").limit(500);
    setEntries((data??[]) as EntryRecord[]);
  };

  const onFile=(event:React.ChangeEvent<HTMLInputElement>)=>{
    setMessage("");setPreview([]);
    const file=event.target.files?.[0];
    if(!file)return;
    setFileName(file.name);
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const text=reader.result as string;
        const rows=parseCsv(text);
        if(!rows.length)throw new Error("Nenhum registro com CPF válido encontrado.");
        setPreview(rows);
        setMessage(`${number(rows.length)} alunos encontrados na planilha. Selecione o curso e clique em Importar.`);
      }catch(err){setMessage((err as Error).message);}
    };
    reader.readAsText(file,"UTF-8");
  };

  const doImport=async()=>{
    if(!preview.length||!selectedCourse){setMessage("Selecione o curso e carregue a planilha.");return;}
    setBusy(true);setMessage("Enviando roster para vinculação...");
    try{
      // 1. Create import record
      const {data:imp,error:impErr}=await supabase.from("vertice_roster_imports").insert({
        institution_id:institutionId,course_id:selectedCourse,uploaded_by:userId,
        filename:fileName,total_rows:preview.length,status:"processing"
      }).select("id").single();
      if(impErr||!imp)throw impErr||new Error("Falha ao registrar importação.");

      // 2. Call Edge Function to do batch-link via bridge
      const {data:result,error:fnErr}=await supabase.functions.invoke("vertice-learning-bridge",{
        body:{operation:"batch_link",institutionId,courseId:selectedCourse,
          importId:imp.id,
          students:preview.map(r=>({cpf:r.cpf,name:r.name,curso:r.curso,turma:r.turma}))}
      });
      if(fnErr)throw fnErr;

      // 3. Update import record
      await supabase.from("vertice_roster_imports").update({
        status:"done",matched:result?.matched??0,linked:result?.linked??0,
        skipped:result?.skipped??0,completed_at:new Date().toISOString()
      }).eq("id",imp.id);

      setMessage(`✅ Importação concluída: ${number(result?.linked??0)} vinculados, ${number(result?.matched??0)} encontrados na plataforma, ${number(result?.skipped??0)} não encontrados.`);
      setPreview([]);setFileName("");
      if(fileRef.current)fileRef.current.value="";
      void loadImports();
    }catch(err){setMessage("❌ Erro: "+(err as Error).message);}
    finally{setBusy(false);}
  };

  if(!canManage)return null;
  const courseNames=new Map(courses.map(c=>[String(c.id),String(c.display_name??c.name)]));

  return <section className="roster-upload">
    <header><h4>Importar turma — vinculação institucional</h4>
      <p>Suba a planilha da turma (CSV ou TXT com colunas <strong>Nome, CPF, Curso, Turma</strong>). O sistema localiza automaticamente quem já tem conta no Fato & Ordem e vincula para acompanhamento acadêmico.</p>
    </header>

    <div className="roster-form">
      <label>Curso de destino
        <select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} required>
          <option value="">Selecione o curso</option>
          {courses.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.display_name??c.name)}</option>)}
        </select>
      </label>
      <label>Planilha de alunos (.csv, .txt)
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={onFile}/>
      </label>
    </div>

    {preview.length>0&&<div className="roster-preview">
      <p><strong>{number(preview.length)} registros</strong> prontos para importação{selectedCourse?` → ${courseNames.get(selectedCourse)||"curso selecionado"}`:""}</p>
      <div className="roster-scroll"><table><thead><tr><th>Nome</th><th>CPF</th><th>Curso (planilha)</th><th>Turma</th></tr></thead>
        <tbody>{preview.slice(0,10).map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.***.**$3-$4")}</td><td>{r.curso}</td><td>{r.turma}</td></tr>)}
        {preview.length>10&&<tr><td colSpan={4} className="muted">…e mais {number(preview.length-10)} registros</td></tr>}
        </tbody></table></div>
      <button className="corp-button" disabled={busy||!selectedCourse} onClick={()=>void doImport()}>
        {busy?"Importando…":`Importar ${number(preview.length)} alunos`}
      </button>
    </div>}

    {message&&<p role="status" className="roster-message">{message}</p>}

    {imports.length>0&&<div className="roster-history">
      <h5>Histórico de importações</h5>
      <table><thead><tr><th>Arquivo</th><th>Curso</th><th>Data</th><th>Total</th><th>Vinculados</th><th>Não encontrados</th><th>Status</th><th></th></tr></thead>
        <tbody>{imports.map(imp=><tr key={imp.id}>
          <td>{imp.filename||"—"}</td>
          <td>{courseNames.get(imp.course_id)||imp.course_id.slice(0,8)}</td>
          <td>{date(imp.created_at)}</td>
          <td>{number(imp.total_rows)}</td>
          <td><strong>{number(imp.linked)}</strong></td>
          <td>{number(imp.skipped)}</td>
          <td><span className={"roster-badge roster-"+imp.status}>{imp.status==="done"?"Concluído":imp.status==="processing"?"Processando":imp.status==="error"?"Erro":"Pendente"}</span></td>
          <td><button className="corp-button small outline" type="button" onClick={()=>void loadEntries(imp.id)}>Detalhes</button></td>
        </tr>)}</tbody>
      </table>
    </div>}

    {viewImport&&entries.length>0&&<div className="roster-details">
      <h5>Detalhes da importação <button className="corp-button small outline" onClick={()=>{setViewImport(null);setEntries([]);}}>Fechar</button></h5>
      <table><thead><tr><th>Nome</th><th>Curso (planilha)</th><th>Turma</th><th>Status</th></tr></thead>
        <tbody>{entries.map(e=><tr key={e.id}>
          <td>{e.student_name}</td><td>{e.course_label}</td><td>{e.turma}</td>
          <td><span className={"roster-badge roster-"+e.status}>{e.status==="matched"?"Vinculado":e.status==="not_found"?"Não encontrado":"Pendente"}</span></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
