import {useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import type {Row} from "@/lib/area";

const coursePositions = ["coordenador", "nde", "colegiado"];
const labels: Record<string, string> = {
 gestor: "Gestor institucional",
 reitor: "Diretor(a) / Reitor(a)",
 vice_reitor: "Vice-diretor(a)",
 pro_reitor: "Pró-reitor(a)",
 diretor: "Diretor",
 procurador: "Procurador institucional",
 secretaria: "Secretaria acadêmica",
 cpa: "Membro da CPA",
 coordenador: "Coordenador de curso",
 nde: "Membro do NDE",
 colegiado: "Membro do colegiado",
};

export default function RegistryContacts({institutionId,courses,manage,firstVisit=false}:{institutionId:string;courses:Row[];manage:boolean;firstVisit?:boolean}) {
 const [contacts,setContacts]=useState<Row[]>([]);
 const [position,setPosition]=useState("gestor");
 const [course,setCourse]=useState("");
 const [editing,setEditing]=useState<Row|null>(null);
 const [email,setEmail]=useState(false);
 const [whatsapp,setWhatsapp]=useState(false);
 const [number,setNumber]=useState("");
 const [ready,setReady]=useState(false);
 const [hasChoice,setHasChoice]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const phones=(value:string)=>value.replace(/[\s().-]/g,"");
 async function loadContacts() {
  const {data,error}=await supabase.from("vertice_registry_contacts").select("*").eq("institution_id",institutionId).order("name");
  if(error) throw error;
  setContacts(data??[]);
 }
 useEffect(()=>{
  if(manage) void loadContacts().catch(()=>setMessage("Não foi possível carregar os contatos."));
  void supabase.from("vertice_channel_choices").select("email_enabled,whatsapp_phone").eq("institution_id",institutionId).order("id",{ascending:false}).limit(1).then(({data,error})=>{
   if(error){setMessage("Não foi possível carregar suas preferências.");return;}
   setEmail(data?.[0]?.email_enabled??false);
   setWhatsapp(Boolean(data?.[0]?.whatsapp_phone));
   setNumber(data?.[0]?.whatsapp_phone??"");
   setHasChoice(Boolean(data?.length));
   setReady(true);
  });
 },[institutionId,manage]);
 async function saveContact(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form=event.currentTarget;
  const fields=new FormData(form);
  const values={institution_id:institutionId,course_id:coursePositions.includes(position)?course:null,position,name:String(fields.get("name")).trim(),email:String(fields.get("email")).trim().toLowerCase(),phone:phones(String(fields.get("phone")))};
  setBusy(true);
  try{
   const table=supabase.from("vertice_registry_contacts");
   const {error}=await (editing?table.update(values).eq("id",editing.id).eq("institution_id",institutionId):table.insert(values));
   if(error)throw error;
   await loadContacts();
   setEditing(null);
   form.reset();
   setMessage("Contato salvo.");
  }catch{setMessage("Não foi possível salvar. Confira o curso, o e-mail e o telefone com código do país.");}
  finally{setBusy(false);}
 }
 async function saveChoices(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setBusy(true);
  const {error}=await supabase.rpc("vertice_record_channel_choices",{target:institutionId,allow_email:email,whatsapp:whatsapp?phones(number):null});
  if(!error && firstVisit) setHasChoice(true);
  setMessage(error?"Não foi possível salvar suas preferências. Confira os dados e a sessão.":"Preferências registradas.");
  setBusy(false);
 }

 if(firstVisit && (!ready || hasChoice)) return null;
 return <section className="area-panel">
  <h3>{firstVisit?"Escolha como receber avisos":"Organograma e contatos"}</h3>
  {message&&<p role="status">{message}</p>}
  {manage&&<details><summary>Gerenciar funções e contatos</summary>
   <p>Registre a função, o vínculo e o contato de cada pessoa. O perfil de acesso é escolhido separadamente no convite da Equipe.</p>
   <form className="area-form" key={editing?.id??"new"} onSubmit={saveContact}>
    <label>Função <select value={position} onChange={e=>setPosition(e.target.value)}>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    {coursePositions.includes(position)&&<label>Curso <select required value={course} onChange={e=>setCourse(e.target.value)}><option value="">Selecione</option>{courses.map(c=><option key={c.id} value={c.id}>{String(c.display_name??c.name)}</option>)}</select></label>}
    <label>Nome <input name="name" required maxLength={160} defaultValue={String(editing?.name??"")}/></label>
    <label>E-mail <input name="email" type="email" required maxLength={254} defaultValue={String(editing?.email??"")}/></label>
    <label>Telefone com código do país <input name="phone" type="tel" required placeholder="+5563999999999" defaultValue={String(editing?.phone??"")}/></label>
    <button className="corp-button small" disabled={busy}>Salvar contato</button>
    {editing&&<button type="button" onClick={()=>setEditing(null)}>Cancelar edição</button>}
   </form>
   <ul>{contacts.slice().sort((a,b)=>Object.keys(labels).indexOf(String(a.position))-Object.keys(labels).indexOf(String(b.position))).map(c=><li key={c.id}>{String(c.name)} · {labels[String(c.position)]}{c.course_id? ` · ${String(courses.find(item=>item.id===c.course_id)?.display_name??courses.find(item=>item.id===c.course_id)?.name??"Curso")}`:""} · {String(c.email)} · {String(c.phone)} <button className="corp-login-text-button" type="button" onClick={()=>{setPosition(String(c.position));setCourse(String(c.course_id??""));setEditing(c);}}>Editar</button></li>)}</ul>
  </details>}
  <details open={firstVisit || undefined}><summary>Minhas preferências de comunicação</summary>
   <p>Escolha como receber avisos de gestão acadêmica desta instituição. A escolha é opcional e pode ser alterada aqui a qualquer momento.</p>
   <form className="area-form" onSubmit={saveChoices}>
    <label><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)}/> Aceito receber avisos por e-mail na minha conta</label>
    <label><input type="checkbox" checked={whatsapp} onChange={e=>setWhatsapp(e.target.checked)}/> Aceito receber avisos pelo WhatsApp</label>
    {whatsapp&&<label>Meu número de WhatsApp <input type="tel" required value={number} onChange={e=>setNumber(e.target.value)} placeholder="+5563999999999"/></label>}
    <button className="corp-button small" disabled={!ready||busy}>{firstVisit && !email && !whatsapp ? "Continuar sem avisos" : "Salvar preferências"}</button>
   </form>
  </details>
 </section>;
}
