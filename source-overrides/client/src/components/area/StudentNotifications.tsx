import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {Role} from "@/lib/area";
import "./student-notifications.css";

type Campaign={id:string;exam_type:string;channels:string[];subject:string;status:string;
 total_recipients:number;sent_email:number;sent_whatsapp:number;sent_sms:number;failed:number;sent_at:string|null;created_at:string};
type Delivery={id:string;student_name:string;channel:string;destination:string;status:string;error_message:string|null};
const MANAGEMENT:Role[]=["master","reitor","gestor","diretor_geral","diretor_pedagogico"];
const number=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const date=(v:string|null)=>{if(!v)return"—";try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));}catch{return"—";}};
const EXAM_LABELS:{[k:string]:string}={enade:"ENADE",oab:"OAB",cfc:"CFC",geral:"Geral"};
const CHANNEL_LABELS:{[k:string]:string}={email:"📧 E-mail",whatsapp:"💬 WhatsApp",sms:"📱 SMS"};

const TEMPLATES:{[k:string]:{subject:string;preview:string}}={
 enade:{subject:"Preparação ENADE ativada",preview:"Olá, [nome]! A [instituição] inscreveu você na plataforma de preparação ENADE com +1.800 questões INEP e motor adaptativo com IA."},
 oab:{subject:"Preparação OAB ativada",preview:"Olá, [nome]! A [instituição] ativou seu acesso à preparação para o Exame de Ordem com simulados cronometrados e questões por disciplina."},
 cfc:{subject:"Preparação CFC ativada",preview:"Olá, [nome]! A [instituição] ativou seu acesso à preparação para o Exame de Suficiência CFC com questões atualizadas e motor adaptativo."},
 geral:{subject:"Plataforma de estudos ativada",preview:"Olá, [nome]! A [instituição] ativou seu acesso à plataforma Fato & Ordem para preparação acadêmica."},
};

export default function StudentNotifications({institutionId,role}:{institutionId:string;role:Role|null}){
 const canManage=Boolean(role&&MANAGEMENT.includes(role));
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [deliveries,setDeliveries]=useState<Delivery[]>([]);
 const [viewCampaign,setViewCampaign]=useState<string|null>(null);
 const [showForm,setShowForm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [form,setForm]=useState({exam_type:"enade",channels:["email"] as string[]});
 const [eligibleCount,setEligibleCount]=useState(0);

 const load=useCallback(async()=>{
  const [{data:camps},{count}]=await Promise.all([
   supabase.from("vertice_notification_campaigns").select("*")
    .eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(15),
   supabase.from("vertice_enade_eligibility").select("*",{count:"exact",head:true})
    .eq("institution_id",institutionId).in("elegibility_type",["ingressante","concludente"])
    .eq("status","elegivel")
  ]);
  setCampaigns((camps||[]) as Campaign[]);
  setEligibleCount(count||0);
 },[institutionId]);

 useEffect(()=>{if(canManage)void load();},[canManage,load]);

 const toggleChannel=(ch:string)=>{
  setForm(f=>{
   const has=f.channels.includes(ch);
   return{...f,channels:has?f.channels.filter(c=>c!==ch):[...f.channels,ch]};
  });
 };

 const createAndSend=async()=>{
  if(!form.channels.length){setMessage("Selecione pelo menos um canal.");return;}
  setBusy(true);setMessage("Criando campanha e enviando...");
  try{
   const template=TEMPLATES[form.exam_type]||TEMPLATES.geral;
   const {data:campaign,error}=await supabase.from("vertice_notification_campaigns").insert({
    institution_id:institutionId,exam_type:form.exam_type,channels:form.channels,
    subject:template.subject,status:"draft",
    created_by:(await supabase.auth.getUser()).data.user?.id||""
   }).select("id").single();
   if(error||!campaign)throw error||new Error("Falha ao criar campanha");

   // Call Edge Function
   const {data:result,error:fnErr}=await supabase.functions.invoke("vertice-notify-students",{
    body:{campaignId:campaign.id}
   });
   if(fnErr)throw fnErr;

   setMessage(`✅ ${result?.notice||"Envio concluído."}`);
   setShowForm(false);void load();
  }catch(err){setMessage("❌ "+(err as Error).message);}
  finally{setBusy(false);}
 };

 const viewDetails=async(campaignId:string)=>{
  setViewCampaign(campaignId);
  const {data}=await supabase.from("vertice_notification_deliveries")
   .select("id,student_name,channel,destination,status,error_message")
   .eq("campaign_id",campaignId).order("student_name").limit(200);
  setDeliveries((data||[]) as Delivery[]);
 };

 if(!canManage)return null;

 return <section className="student-notif">
  <header>
   <div><h4>Comunicar alunos</h4>
    <p>Envie notificações por e-mail, WhatsApp e SMS para os alunos elegíveis. Templates prontos por exame.</p>
   </div>
   <button className="corp-button small" onClick={()=>setShowForm(!showForm)}>
    {showForm?"Cancelar":"📣 Nova campanha"}
   </button>
  </header>

  {showForm&&<div className="notif-form">
   <div className="notif-exam-select">
    <p><strong>Tipo de exame:</strong></p>
    <div className="notif-pills">
     {Object.entries(EXAM_LABELS).map(([k,v])=>
      <button key={k} className={"notif-pill"+(form.exam_type===k?" active":"")} onClick={()=>setForm(f=>({...f,exam_type:k}))}>{v}</button>
     )}
    </div>
   </div>

   <div className="notif-channels">
    <p><strong>Canais de envio:</strong></p>
    <div className="notif-pills">
     {Object.entries(CHANNEL_LABELS).map(([k,v])=>
      <label key={k} className={"notif-channel-check"+(form.channels.includes(k)?" active":"")}>
       <input type="checkbox" checked={form.channels.includes(k)} onChange={()=>toggleChannel(k)}/>
       {v}
      </label>
     )}
    </div>
   </div>

   <div className="notif-preview">
    <p><strong>Preview da mensagem:</strong></p>
    <div className="notif-preview-box">
     <p className="notif-subject">{TEMPLATES[form.exam_type]?.subject||""}</p>
     <p>{TEMPLATES[form.exam_type]?.preview||""}</p>
    </div>
   </div>

   <div className="notif-summary">
    <p>📊 <strong>{number(eligibleCount)} alunos elegíveis</strong> serão notificados via {form.channels.map(c=>CHANNEL_LABELS[c]).join(" + ")||"nenhum canal"}.</p>
    <p className="notif-hint">O envio usa os contatos disponíveis no roster importado. Alunos sem e-mail ou telefone não receberão pelo canal correspondente.</p>
   </div>

   <button className="corp-button" disabled={busy||!form.channels.length} onClick={()=>{
    if(!window.confirm(`Confirma o envio para ${number(eligibleCount)} alunos via ${form.channels.join(", ")}?`))return;
    void createAndSend();
   }}>
    {busy?"Enviando…":`📣 Enviar para ${number(eligibleCount)} alunos`}
   </button>
  </div>}

  {message&&<p role="status" className="notif-message">{message}</p>}

  {campaigns.length>0&&<div className="notif-history">
   <h5>Campanhas enviadas</h5>
   <table><thead><tr><th>Exame</th><th>Canais</th><th>Data</th><th>Destinatários</th><th>📧</th><th>💬</th><th>📱</th><th>❌</th><th>Status</th><th></th></tr></thead>
    <tbody>{campaigns.map(c=><tr key={c.id}>
     <td><strong>{EXAM_LABELS[c.exam_type]||c.exam_type}</strong></td>
     <td>{(c.channels||[]).map(ch=>CHANNEL_LABELS[ch]||ch).join(", ")}</td>
     <td>{date(c.sent_at||c.created_at)}</td>
     <td>{number(c.total_recipients)}</td>
     <td>{c.sent_email||"—"}</td><td>{c.sent_whatsapp||"—"}</td><td>{c.sent_sms||"—"}</td>
     <td>{c.failed||"—"}</td>
     <td><span className={"notif-badge notif-"+c.status}>{c.status==="sent"?"Enviado":c.status==="sending"?"Enviando":c.status==="error"?"Erro":"Rascunho"}</span></td>
     <td><button className="corp-button small outline" onClick={()=>void viewDetails(c.id)}>Detalhes</button></td>
    </tr>)}</tbody>
   </table>
  </div>}

  {viewCampaign&&deliveries.length>0&&<div className="notif-details">
   <h5>Entregas <button className="corp-button small outline" onClick={()=>{setViewCampaign(null);setDeliveries([]);}}>Fechar</button></h5>
   <table><thead><tr><th>Aluno</th><th>Canal</th><th>Destino</th><th>Status</th><th>Erro</th></tr></thead>
    <tbody>{deliveries.map(d=><tr key={d.id}>
     <td>{d.student_name}</td>
     <td>{CHANNEL_LABELS[d.channel]||d.channel}</td>
     <td>{d.destination}</td>
     <td><span className={"notif-badge notif-del-"+d.status}>{d.status==="sent"?"Enviado":d.status==="delivered"?"Entregue":d.status==="failed"?"Falhou":"Pendente"}</span></td>
     <td className="notif-error-cell">{d.error_message||"—"}</td>
    </tr>)}</tbody>
   </table>
  </div>}
 </section>;
}
