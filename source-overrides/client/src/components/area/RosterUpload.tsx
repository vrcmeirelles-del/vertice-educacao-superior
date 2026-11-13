import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {Role,Row} from "@/lib/area";
import "./roster-upload.css";

type ImportRecord={id:string;filename:string;total_rows:number;matched:number;linked:number;skipped:number;status:string;error_message:string|null;created_at:string;completed_at:string|null;course_id:string};
type EntryRecord={id:string;student_name:string;status:string;course_label:string;turma:string};
type StudentRow={name:string;cpf:string;curso:string;turma:string;email:string;telefone:string;periodo:string};
type CourseGroup={cursoLabel:string;matchedId:string|null;matchedName:string|null;count:number;students:StudentRow[]};

const MANAGEMENT:Role[]=["master","reitor","gestor","diretor_geral","diretor_pedagogico","procurador"];
const number=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const date=(v:string)=>{try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));}catch{return"—";}};
const maskCpf=(c:string)=>{const d=c.replace(/\D/gu,"");return d.length===11?d.slice(0,3)+".***.**"+d.slice(7,9)+"-"+d.slice(9):c;};
const maskEmail=(e:string)=>{if(!e)return"—";const p=e.split("@");return p[0].slice(0,3)+"***@"+(p[1]||"");};
const maskPhone=(p:string)=>{if(!p)return"—";const d=p.replace(/\D/gu,"");return d.length>=10?"("+d.slice(0,2)+") *****-"+d.slice(-4):p;};

function parseCsv(text:string):StudentRow[]{
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length)return[];
  const sep=lines[0].includes(";")?";":lines[0].includes("\t")?"\t":",";
  const header=lines[0].split(sep).map(h=>h.trim().toLowerCase().replace(/[" ]/gu,""));
  const find=(pat:RegExp)=>header.findIndex(h=>pat.test(h));
  const iName=find(/nome|aluno|student/u);
  const iCpf=find(/cpf|documento|doc/u);
  const iCurso=find(/curso|course|programa/u);
  const iTurma=find(/turma|class|grupo/u);
  const iEmail=find(/email|e-mail|correio/u);
  const iTel=find(/telefone|celular|phone|fone|whatsapp|whats/u);
  const iPeriodo=find(/periodo|período|semestre/u);
  if(iCpf<0)throw new Error("Coluna de CPF não encontrada. Use cabeçalho com 'CPF'.");
  return lines.slice(1).map(line=>{
    const cols=line.split(sep).map(c=>c.trim().replace(/^"|"$/gu,""));
    return{
      name:cols[iName]||"",cpf:cols[iCpf]||"",curso:cols[iCurso]||"",
      turma:cols[iTurma]||"",email:iEmail>=0?cols[iEmail]||"":"",
      telefone:iTel>=0?cols[iTel]||"":"",periodo:iPeriodo>=0?cols[iPeriodo]||"":""
    };
  }).filter(r=>r.cpf.replace(/\D/gu,"").length>=11);
}

function matchCourse(label:string,courses:Row[]):string|null{
  const norm=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/gu,"").trim();
  const target=norm(label);
  if(!target)return null;
  for(const c of courses){if(norm(String(c.display_name??c.name))===target)return String(c.id);}
  for(const c of courses){const n=norm(String(c.display_name??c.name));if(n.includes(target)||target.includes(n))return String(c.id);}
  return null;
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
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [preview,setPreview]=useState<StudentRow[]>([]);
  const [fileName,setFileName]=useState("");
  const [courseOverrides,setCourseOverrides]=useState<Record<string,string>>({});
  const fileRef=useRef<HTMLInputElement>(null);

  const loadImports=useCallback(async()=>{
    const {data}=await supabase.from("vertice_roster_imports")
      .select("id,filename,total_rows,matched,linked,skipped,status,error_message,created_at,completed_at,course_id")
      .eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(20);
    setImports((data??[]) as ImportRecord[]);
  },[institutionId]);

  useEffect(()=>{if(canManage)void loadImports();},[canManage,loadImports]);

  const courseNames=useMemo(()=>new Map(courses.map(c=>[String(c.id),String(c.display_name??c.name)])),[courses]);

  // Group students by curso from spreadsheet and auto-match to Vertice courses
  const courseGroups=useMemo(()=>{
    const map=new Map<string,StudentRow[]>();
    for(const r of preview){
      const key=r.curso.trim()||"(sem curso)";
      const arr=map.get(key)||[];arr.push(r);map.set(key,arr);
    }
    const groups:CourseGroup[]=[];
    for(const [label,students] of map){
      const override=courseOverrides[label];
      const autoMatch=matchCourse(label,courses);
      const matchedId=override||autoMatch||null;
      groups.push({cursoLabel:label,matchedId,matchedName:matchedId?courseNames.get(matchedId)||null:null,count:students.length,students});
    }
    return groups.sort((a,b)=>b.count-a.count);
  },[preview,courses,courseNames,courseOverrides]);

  const hasContacts=preview.some(r=>r.email||r.telefone);
  const allMapped=courseGroups.every(g=>g.matchedId);

  const loadEntries=async(importId:string)=>{
    setViewImport(importId);
    const {data}=await supabase.from("vertice_roster_entries")
      .select("id,student_name,status,course_label,turma")
      .eq("import_id",importId).order("student_name").limit(500);
    setEntries((data??[]) as EntryRecord[]);
  };

  const onFile=(event:React.ChangeEvent<HTMLInputElement>)=>{
    setMessage("");setPreview([]);setCourseOverrides({});
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
        const cursosDetectados=[...new Set(rows.map(r=>r.curso).filter(Boolean))];
        const comEmail=rows.filter(r=>r.email).length;
        const comTel=rows.filter(r=>r.telefone).length;
        setMessage(`${number(rows.length)} alunos em ${cursosDetectados.length||1} curso(s).${comEmail?` ${number(comEmail)} com e-mail.`:""}${comTel?` ${number(comTel)} com telefone.`:""}`);
      }catch(err){setMessage((err as Error).message);}
    };
    reader.readAsText(file,"UTF-8");
  };

  const doImport=async()=>{
    if(!preview.length){setMessage("Carregue a planilha primeiro.");return;}
    if(!allMapped){setMessage("Mapeie todos os cursos antes de importar.");return;}
    setBusy(true);setMessage("Enviando roster para vinculação...");
    try{
      let totalLinked=0,totalMatched=0,totalSkipped=0;
      for(const group of courseGroups){
        if(!group.matchedId)continue;
        const {data:imp,error:impErr}=await supabase.from("vertice_roster_imports").insert({
          institution_id:institutionId,course_id:group.matchedId,uploaded_by:userId,
          filename:fileName+" ["+group.cursoLabel+"]",total_rows:group.count,status:"processing"
        }).select("id").single();
        if(impErr||!imp)throw impErr||new Error("Falha ao registrar importação.");

        // Send in chunks of 200 to avoid Edge Function body size limits
        let groupLinked=0,groupMatched=0,groupSkipped=0;let groupError="";
        const allStudents=group.students.map(r=>({cpf:r.cpf,name:r.name,curso:r.curso,turma:r.turma,email:r.email,telefone:r.telefone}));
        for(let i=0;i<allStudents.length;i+=200){
          const chunk=allStudents.slice(i,i+200);
          setMessage(`${group.cursoLabel}: lote ${Math.floor(i/200)+1}/${Math.ceil(allStudents.length/200)} (${number(i)}/${number(allStudents.length)})...`);
          try{
            const {data:result,error:fnErr}=await supabase.functions.invoke("vertice-learning-bridge",{
              body:{operation:"batch_link",institutionId,courseId:group.matchedId,
                importId:imp.id,students:chunk}
            });
            if(fnErr){groupError=fnErr.message||"Edge Function error";continue;}
            groupLinked+=(result?.linked??0);groupMatched+=(result?.matched??0);groupSkipped+=(result?.skipped??0);
          }catch(err){groupError=(err as Error).message;continue;}
        }

        await supabase.from("vertice_roster_imports").update({
          status:groupError&&!groupLinked?"error":"done",
          error_message:groupError||null,
          matched:groupMatched,linked:groupLinked,
          skipped:groupSkipped,completed_at:new Date().toISOString()
        }).eq("id",imp.id);

        totalLinked+=groupLinked;totalMatched+=groupMatched;totalSkipped+=groupSkipped;
      }
      setMessage(`✅ Importação concluída: ${number(totalLinked)} vinculados, ${number(totalMatched)} encontrados, ${number(totalSkipped)} não encontrados.`);
      setPreview([]);setFileName("");setCourseOverrides({});
      if(fileRef.current)fileRef.current.value="";
      void loadImports();
    }catch(err){setMessage("❌ Erro: "+(err as Error).message);}
    finally{setBusy(false);}
  };

  if(!canManage)return null;

  return <section className="roster-upload">
    <header><h4>Importar turma — vinculação institucional</h4>
      <p>Suba a planilha com colunas <strong>Nome, CPF, Curso, Turma</strong> (e opcionalmente <strong>E-mail, Telefone, Período</strong>). O sistema detecta os cursos automaticamente e vincula ao Fato & Ordem.</p>
    </header>

    <div className="roster-form">
      <HelpLabel>Planilha de alunos (.csv, .txt, .tsv)
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={onFile}/>
      </HelpLabel>
    </div>

    {courseGroups.length>0&&<div className="roster-course-map">
      <h5>Cursos detectados na planilha</h5>
      <p className="muted">O sistema tentou mapear automaticamente. Corrija manualmente se necessário.</p>
      <table><thead><tr><th>Curso (planilha)</th><th>Alunos</th><th>Curso Vértice (destino)</th><th>Status</th></tr></thead>
        <tbody>{courseGroups.map(g=><tr key={g.cursoLabel}>
          <td><strong>{g.cursoLabel}</strong></td>
          <td>{number(g.count)}</td>
          <td><select value={g.matchedId||""} onChange={e=>setCourseOverrides(prev=>({...prev,[g.cursoLabel]:e.target.value}))}>
            <option value="">— Selecione o curso —</option>
            {courses.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.display_name??c.name)}</option>)}
          </select></td>
          <td>{g.matchedId?<span className="roster-badge roster-done">✅ Mapeado</span>:<span className="roster-badge roster-pending">⚠️ Pendente</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>}

    {preview.length>0&&<div className="roster-preview">
      <p><strong>{number(preview.length)} registros</strong> em {courseGroups.length} curso(s){allMapped?" — todos mapeados":" — mapeie os cursos acima"}</p>
      <div className="roster-scroll"><table><thead><tr><th>Nome</th><th>CPF</th><th>Curso<ContextHelp title="Curso" /></th><th>Turma</th>{hasContacts&&<><th>E-mail<ContextHelp title="E-mail" /></th><th>Telefone<ContextHelp title="Telefone" /></th></>}<th>Período<ContextHelp title="Período" /></th></tr></thead>
        <tbody>{preview.slice(0,15).map((r,i)=><tr key={i}>
          <td>{r.name}</td><td>{maskCpf(r.cpf)}</td><td>{r.curso}</td><td>{r.turma}</td>
          {hasContacts&&<><td>{maskEmail(r.email)}</td><td>{maskPhone(r.telefone)}</td></>}
          <td>{r.periodo||"—"}</td>
        </tr>)}
        {preview.length>15&&<tr><td colSpan={hasContacts?7:5} className="muted">…e mais {number(preview.length-15)} registros</td></tr>}
        </tbody></table></div>
      <button className="corp-button" disabled={busy||!allMapped} onClick={()=>void doImport()}>
        {busy?"Importando…":`Importar ${number(preview.length)} alunos (${courseGroups.length} curso${courseGroups.length>1?"s":""})`}
      </button>
    </div>}

    {message&&<p role="status" className="roster-message">{message}</p>}

    {imports.length>0&&<div className="roster-history">
      <h5>Histórico de importações</h5>
      <table><thead><tr><th>Arquivo</th><th>Curso<ContextHelp title="Curso" /></th><th>Data</th><th>Total</th><th>Vinculados</th><th>Não encontrados</th><th>Status</th><th></th></tr></thead>
        <tbody>{imports.map(imp=><tr key={imp.id}>
          <td>{imp.filename||"—"}</td>
          <td>{courseNames.get(imp.course_id)||imp.course_id.slice(0,8)}</td>
          <td>{date(imp.created_at)}</td>
          <td>{number(imp.total_rows)}</td>
          <td><strong>{number(imp.linked)}</strong></td>
          <td>{number(imp.skipped)}</td>
          <td><span className={"roster-badge roster-"+imp.status}>{imp.status==="done"?"Concluído":imp.status==="processing"?"Processando":imp.status==="error"?"Erro":"Pendente"}</span></td>
          <td className="roster-actions">
            <button className="corp-button small outline" type="button" onClick={()=>void loadEntries(imp.id)}>Detalhes</button>
            <button className="corp-button small outline roster-delete" type="button" disabled={busy} onClick={async()=>{
              if(!window.confirm("Excluir esta importação?"))return;
              setBusy(true);
              await supabase.from("vertice_roster_entries").delete().eq("import_id",imp.id);
              await supabase.from("vertice_roster_imports").delete().eq("id",imp.id);
              setBusy(false);void loadImports();
            }}>Excluir</button>
          </td>
        </tr>)}</tbody>
      </table>
      <button className="corp-button small outline roster-delete" type="button" disabled={busy} onClick={async()=>{
        if(!window.confirm("Excluir TODAS as importações desta instituição?"))return;
        setBusy(true);
        await supabase.from("vertice_roster_entries").delete().eq("institution_id",institutionId);
        await supabase.from("vertice_roster_imports").delete().eq("institution_id",institutionId);
        setBusy(false);setImports([]);setMessage("Histórico limpo.");
      }}>Limpar todo o histórico</button>
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
