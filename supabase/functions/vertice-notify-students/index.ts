import {createClient} from "npm:@supabase/supabase-js@2.45.4";

/**
 * vertice-notify-students — Send notifications to students via Email, WhatsApp, SMS
 *
 * Channels:
 * - Email: Resend API (RESEND_API_KEY)
 * - WhatsApp: Meta Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)
 * - SMS: Zenvia API (ZENVIA_API_TOKEN, ZENVIA_SENDER)
 */

const env=(name:string)=>String(Deno.env.get(name)||"");
const secretKey=()=>{
 const raw=env("SUPABASE_SECRET_KEYS");
 if(raw)try{const obj=JSON.parse(raw);return obj.default||Object.values(obj)[0];}catch{}
 return env("SUPABASE_SERVICE_ROLE_KEY");
};
const ORIGINS=new Set([
 "https://www.verticesuperior.com.br","https://verticesuperior.com.br",
 "https://vertice-portal.onrender.com","https://vertice-educacao-superior.onrender.com"
]);
const send=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
  "Access-Control-Allow-Origin":ORIGINS.has(origin)?origin:"https://www.verticesuperior.com.br",
  "Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}
});

// ── Templates ──────────────────────────────────────────────────────

const TEMPLATES:{[key:string]:{subject:string;email:string;whatsapp:string;sms:string}}={
 enade:{
  subject:"Você foi selecionado para preparação ENADE — {{instituicao}}",
  email:`Olá, {{nome}}!

A {{instituicao}} inscreveu você na plataforma de preparação para o ENADE {{ano}}.

Você foi identificado como aluno {{tipo}} do curso de {{curso}} e faz parte do público elegível para o próximo exame.

A plataforma conta com mais de 1.800 questões do banco INEP, motor adaptativo com inteligência artificial e devolutiva detalhada por competência.

👉 Acesse agora: https://www.fatoeordem.com.br/enade#estudar

Seu desempenho será acompanhado pela coordenação do curso para intervenções pedagógicas direcionadas.

Bons estudos!
{{instituicao}}`,
  whatsapp:`🎓 *Preparação ENADE {{ano}}*

Olá, {{nome}}! A {{instituicao}} inscreveu você na plataforma de preparação para o ENADE.

Você é aluno *{{tipo}}* do curso de *{{curso}}*.

✅ +1.800 questões INEP
✅ Motor adaptativo com IA
✅ Devolutiva por competência

👉 Acesse: https://www.fatoeordem.com.br/enade#estudar

Bons estudos! 📚`,
  sms:`{{instituicao}}: Voce foi inscrito na preparacao ENADE {{ano}}. Acesse fatoeordem.com.br/enade para estudar. {{nome}}, curso {{curso}}.`
 },
 oab:{
  subject:"Preparação OAB ativada — {{instituicao}}",
  email:`Olá, {{nome}}!

A {{instituicao}} ativou seu acesso à plataforma de preparação para o Exame de Ordem da OAB.

Como aluno do {{periodo}}º período de Direito, você já está no grupo elegível para a prova.

A plataforma oferece simulados cronometrados, questões por disciplina, motor adaptativo e devolutiva detalhada.

👉 Acesse agora: https://www.fatoeordem.com.br/app#oab

Sua preparação começa hoje!
{{instituicao}}`,
  whatsapp:`⚖️ *Preparação OAB*

{{nome}}, a {{instituicao}} ativou seu acesso à preparação para o Exame de Ordem!

Você está no *{{periodo}}º período de Direito*.

✅ Simulados cronometrados
✅ Motor adaptativo com IA
✅ Questões por disciplina

👉 Acesse: https://www.fatoeordem.com.br/app#oab

Bora aprovar! 💪`,
  sms:`{{instituicao}}: Preparacao OAB ativada para voce, {{nome}}. Acesse fatoeordem.com.br para simulados e questoes. {{periodo}}o periodo Direito.`
 },
 cfc:{
  subject:"Preparação CFC ativada — {{instituicao}}",
  email:`Olá, {{nome}}!

A {{instituicao}} ativou seu acesso à plataforma de preparação para o Exame de Suficiência do CFC.

Como aluno do último ano de Ciências Contábeis, você está no grupo elegível para a próxima prova.

A plataforma oferece questões CFC com devolutiva detalhada e motor adaptativo.

👉 Acesse agora: https://www.fatoeordem.com.br/app#cfc

Bons estudos!
{{instituicao}}`,
  whatsapp:`📊 *Preparação CFC*

{{nome}}, a {{instituicao}} ativou seu acesso à preparação para o Exame de Suficiência!

✅ Questões CFC atualizadas
✅ Motor adaptativo com IA
✅ Devolutiva por área

👉 Acesse: https://www.fatoeordem.com.br/app#cfc

Bora conquistar o registro! 🎯`,
  sms:`{{instituicao}}: Preparacao CFC ativada para voce, {{nome}}. Acesse fatoeordem.com.br para questoes e simulados.`
 },
 geral:{
  subject:"Plataforma de estudos ativada — {{instituicao}}",
  email:`Olá, {{nome}}!

A {{instituicao}} ativou seu acesso à plataforma Fato & Ordem para preparação acadêmica.

👉 Acesse agora: https://www.fatoeordem.com.br/app

Bons estudos!
{{instituicao}}`,
  whatsapp:`📚 {{nome}}, a {{instituicao}} ativou seu acesso à plataforma de estudos Fato & Ordem!

👉 Acesse: https://www.fatoeordem.com.br/app`,
  sms:`{{instituicao}}: Plataforma de estudos ativada. Acesse fatoeordem.com.br. {{nome}}.`
 }
};

function fillTemplate(template:string,vars:Record<string,string>):string{
 return template.replace(/\{\{(\w+)\}\}/g,(_,key)=>vars[key]||"");
}

// ── Channel senders ────────────────────────────────────────────────

async function sendEmail(to:string,subject:string,body:string):Promise<{ok:boolean;error?:string}>{
 const key=env("RESEND_API_KEY");
 if(!key)return{ok:false,error:"RESEND_API_KEY não configurada"};
 const from=env("RESEND_FROM")||"Fato & Ordem <comunicados@fatoeordem.com.br>";
 try{
  const res=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({from,to:[to],subject,text:body}),
   signal:AbortSignal.timeout(15000)
  });
  if(!res.ok)return{ok:false,error:"Resend HTTP "+res.status};
  return{ok:true};
 }catch(e){return{ok:false,error:(e as Error).message};}
}

async function sendWhatsApp(phone:string,body:string):Promise<{ok:boolean;error?:string}>{
 const token=env("WHATSAPP_TOKEN");
 const phoneId=env("WHATSAPP_PHONE_ID");
 if(!token||!phoneId)return{ok:false,error:"WhatsApp não configurado"};
 const to=phone.replace(/\D/g,"");
 if(to.length<10)return{ok:false,error:"Telefone inválido"};
 const number=to.startsWith("55")?to:"55"+to;
 try{
  const res=await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`,{
   method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({messaging_product:"whatsapp",to:number,type:"text",text:{body}}),
   signal:AbortSignal.timeout(15000)
  });
  if(!res.ok)return{ok:false,error:"WhatsApp HTTP "+res.status};
  return{ok:true};
 }catch(e){return{ok:false,error:(e as Error).message};}
}

async function sendSMS(phone:string,body:string):Promise<{ok:boolean;error?:string}>{
 const token=env("ZENVIA_API_TOKEN");
 const sender=env("ZENVIA_SENDER")||"FatoOrdem";
 if(!token)return{ok:false,error:"ZENVIA_API_TOKEN não configurada"};
 const to=phone.replace(/\D/g,"");
 if(to.length<10)return{ok:false,error:"Telefone inválido"};
 const number=to.startsWith("55")?to:"55"+to;
 try{
  const res=await fetch("https://api.zenvia.com/v2/channels/sms/messages",{
   method:"POST",headers:{"X-API-TOKEN":token,"Content-Type":"application/json"},
   body:JSON.stringify({from:sender,to:number,contents:[{type:"text",text:body}]}),
   signal:AbortSignal.timeout(15000)
  });
  if(!res.ok)return{ok:false,error:"Zenvia HTTP "+res.status};
  return{ok:true};
 }catch(e){return{ok:false,error:(e as Error).message};}
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return send({ok:true},200,origin);
 if(req.method!=="POST")return send({error:"Método não permitido"},405,origin);

 try{
  const url=env("SUPABASE_URL"),serviceKey=secretKey();
  if(!url||!serviceKey)throw new Error("Serviço não configurado");
  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});

  // Authenticate
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))throw new Error("Autenticação necessária");
  const {data:userData,error:authError}=await admin.auth.getUser(auth.slice(7));
  if(authError||!userData.user)throw new Error("Sessão inválida");

  const body=await req.json();
  const campaignId=String(body.campaignId||"");
  if(!campaignId)throw new Error("Campaign ID obrigatório");

  // Load campaign
  const {data:campaign,error:campError}=await admin.from("vertice_notification_campaigns")
   .select("*").eq("id",campaignId).single();
  if(campError||!campaign)throw new Error("Campanha não encontrada");

  // Load institution name
  const {data:inst}=await admin.from("vertice_institutions")
   .select("name").eq("id",campaign.institution_id).single();
  const instName=inst?.name||"Sua instituição";

  // Load eligible students with contact info from roster
  const {data:students}=await admin.from("vertice_enade_eligibility")
   .select("student_name,matricula,cpf,curso_name,periodo,elegibility_type,enade_ano")
   .eq("institution_id",campaign.institution_id)
   .in("elegibility_type",["ingressante","concludente"])
   .in("status",["elegivel","vinculado_fo"]);

  // Also get contact info from roster entries
  const {data:contacts}=await admin.from("vertice_roster_entries")
   .select("student_name,course_label,turma")
   .eq("institution_id",campaign.institution_id);

  const contactMap=new Map((contacts||[]).map(c=>[c.student_name?.toUpperCase().trim(),c]));

  const channels=new Set(campaign.channels as string[]);
  const template=TEMPLATES[campaign.exam_type]||TEMPLATES.geral;
  let sentEmail=0,sentWhatsapp=0,sentSms=0,failed=0;
  const deliveries:unknown[]=[];

  await admin.from("vertice_notification_campaigns")
   .update({status:"sending",total_recipients:(students||[]).length}).eq("id",campaignId);

  for(const student of students||[]){
   const vars={
    nome:student.student_name||"Aluno",
    instituicao:instName,
    curso:student.curso_name||"",
    periodo:String(student.periodo||""),
    tipo:student.elegibility_type==="concludente"?"concludente":"ingressante",
    ano:String(student.enade_ano||new Date().getFullYear()),
   };

   // Try to find contact info — for now use body.contacts override or roster
   const contactOverride=(body.contacts as Record<string,{email?:string;phone?:string}>)?.[student.matricula];
   const email=contactOverride?.email||"";
   const phone=contactOverride?.phone||"";

   if(channels.has("email")&&email){
    const result=await sendEmail(email,fillTemplate(template.subject,vars),fillTemplate(template.email,vars));
    deliveries.push({campaign_id:campaignId,institution_id:campaign.institution_id,
     student_name:student.student_name,channel:"email",destination:email.replace(/(.{3}).*(@.*)/, "$1***$2"),
     status:result.ok?"sent":"failed",error_message:result.error||null,sent_at:new Date().toISOString()});
    if(result.ok)sentEmail++;else failed++;
   }

   if(channels.has("whatsapp")&&phone){
    const result=await sendWhatsApp(phone,fillTemplate(template.whatsapp,vars));
    deliveries.push({campaign_id:campaignId,institution_id:campaign.institution_id,
     student_name:student.student_name,channel:"whatsapp",destination:phone.replace(/(\d{2})\d{5}(\d{4})/,"($1) *****-$2"),
     status:result.ok?"sent":"failed",error_message:result.error||null,sent_at:new Date().toISOString()});
    if(result.ok)sentWhatsapp++;else failed++;
   }

   if(channels.has("sms")&&phone){
    const result=await sendSMS(phone,fillTemplate(template.sms,vars));
    deliveries.push({campaign_id:campaignId,institution_id:campaign.institution_id,
     student_name:student.student_name,channel:"sms",destination:phone.replace(/(\d{2})\d{5}(\d{4})/,"($1) *****-$2"),
     status:result.ok?"sent":"failed",error_message:result.error||null,sent_at:new Date().toISOString()});
    if(result.ok)sentSms++;else failed++;
   }
  }

  // Save deliveries in batch
  if(deliveries.length){
   for(let i=0;i<deliveries.length;i+=100){
    await admin.from("vertice_notification_deliveries").insert(deliveries.slice(i,i+100));
   }
  }

  // Update campaign
  await admin.from("vertice_notification_campaigns").update({
   status:"sent",sent_email:sentEmail,sent_whatsapp:sentWhatsapp,sent_sms:sentSms,
   failed,sent_at:new Date().toISOString()
  }).eq("id",campaignId);

  return send({ok:true,sentEmail,sentWhatsapp,sentSms,failed,
   total:(students||[]).length,
   notice:`Envio concluído: ${sentEmail} emails, ${sentWhatsapp} WhatsApp, ${sentSms} SMS.`},200,origin);
 }catch(error){
  return send({error:(error as Error).message},500,origin);
 }
});
