import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./cost-evidence.css";
type Doc={id:string;request_id:string;file_name:string;storage_path:string;status:string;created_at:string};
type Request={id:string;title:string;course_id:string|null;instructions:string|null};
const TYPES=[
 ["CCT","Convenção Coletiva de Trabalho (CCT)"],
 ["Aditivo CCT","Termo aditivo e reajustes"],
 ["Folha","Folha de pagamento e quadro docente"],
 ["Horários","Horários, turnos e distribuição de aulas"],
 ["Ensalamento","Relatório de ensalamento por turma/sala"],
 ["Infraestrutura","Salas, capacidades e infraestrutura"],
 ["Financeiro","Mensalidades, descontos e inadimplência"],
 ["Outros","Outros documentos de custeio"]
] as const;
const PREFIX="CUSTOS | ";
export default function CostEvidence({institutionId,onUpload,compact=false}:{institutionId:string;onUpload?:(courseId:string,title:string,reference:string)=>void;compact?:boolean}){
 const [kind,setKind]=useState<string>("CCT");
 const [docs,setDocs]=useState<Doc[]>([]),[reqs,setReqs]=useState<Request[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  const [r,f]=await Promise.all([
   supabase.from("vertice_repository_requests").select("id,title,course_id,instructions").eq("institution_id",institutionId).is("course_id",null).order("created_at",{ascending:false}).limit(350),
   supabase.from("vertice_repository_files").select("id,request_id,file_name,storage_path,status,created_at").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(500)
  ]);
  if(r.error||f.error){setError("Não foi possível consultar os documentos desta instituição.");setLoading(false);return;}
  setReqs((r.data??[]) as Request[]);setDocs((f.data??[]) as Doc[]);setLoading(false);
 },[institutionId]);
 useEffect(()=>{void refresh();},[refresh]);
 const types=new Map(TYPES);
 const reqMap=new Map(reqs.filter(r=>r.title.startsWith(PREFIX)).map(r=>[r.id,r]));
 const rows=docs.filter(d=>reqMap.has(d.request_id)).map(d=>({...d,request:reqMap.get(d.request_id)!}));
 async function download(d:Doc){
  setError("");
  const {data,error:e}=await supabase.storage.from("vertice-repositorios").download(d.storage_path);
  if(e||!data){setError("Arquivo privado indisponível para este perfil. Confira as permissões.");return;}
  const url=URL.createObjectURL(data);const a=document.createElement("a");a.href=url;a.download=d.file_name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 function send(){
  const title=PREFIX+kind+" | Documento para validação";
  onUpload?.("institucional",title,"Base de custos da IES · "+(types.get(kind)??kind)+". Documento original sujeito a validação, vigência, abrangência territorial, categoria profissional e pertinência. O envio NÃO atualiza automaticamente os parâmetros do simulador.");
 }
 return <section className="cost-evidence area-panel" aria-label="Base documental para cruzamento de custos">
  <div className="cost-evidence-head"><div><small>BASE DOCUMENTAL · CUSTOS</small><h3>Convenções e documentos da IES</h3><p>Arquivos privados vinculados à instituição, reutilizáveis na análise de custos. Anexar não valida automaticamente pisos, jornadas, encargos ou valores.</p></div><button type="button" onClick={()=>void refresh()} disabled={loading}>Atualizar lista</button></div>
  {onUpload&&<div className="cost-evidence-upload"><label>Documento a cadastrar
   <select value={kind} onChange={e=>setKind(e.target.value)}>{TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <button type="button" className="corp-button" onClick={send}>Enviar arquivo pelo repositório privado</button></div>}
  <p className="cost-evidence-info">Para a CCT, registre o PDF integral, instrumento/registro, sindicato, abrangência, categoria e datas de vigência. Também podem ser enviados aditivos, folha, horários, contratos, custos operacionais e ensalamento. A validação permanece humana.</p>
  {error&&<p role="alert" className="area-error">{error}</p>}
  {loading?<p role="status">Consultando o repositório…</p>:!rows.length?<p className="cost-evidence-empty">Nenhum documento de custos disponibilizado no repositório institucional desta IES.</p>:<div className="cost-evidence-list">{rows.slice(0,compact?6:30).map(d=><div key={d.id}><div><strong>{d.file_name}</strong><small>{d.request.title.replace(PREFIX,"")} · {new Date(d.created_at).toLocaleDateString("pt-BR")} · {d.status==="validado"?"Validado pela gestão":d.status==="devolvido"?"Devolvido":"Aguardando validação"}</small></div><button type="button" onClick={()=>void download(d)}>Consultar arquivo</button></div>)}</div>}
 </section>;
}
