import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {sendPortalEmail} from "../_shared/portal-email.ts";

const origin = "https://www.verticesuperior.com.br";
const allowedOrigins = new Set([origin, "https://verticesuperior.com.br", "https://vertice-portal.onrender.com", "https://vertice-educacao-superior.onrender.com"]);
Deno.serve(async (req) => {
  const requestedOrigin = req.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigins.has(requestedOrigin) ? requestedOrigin : origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Método inválido." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Entre no portal para convidar alunos." }, 401);
  try {
    const body = await req.json();
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const project=await client.from('vertice_extension_projects').select('institution_id,course_ids,title').eq('id',body.project).maybeSingle();
    if(project.error||!project.data)return reply({error:'Projeto não autorizado.'},403);
    const user=await client.auth.getUser();if(user.error||!user.data.user)return reply({error:'Sessão inválida.'},401);
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    let recipient=body.email;
    if(body.invite){
      const list=await client.rpc('vertice_extension_student_review',{p_project:body.project});
      if(list.error)return reply({error:'Convite não autorizado.'},403);
      recipient=list.data?.find((i:any)=>i.id===body.invite)?.email;
    }
    const result=await sendPortalEmail({module:'extensao',institutionId:project.data.institution_id,actorId:user.data.user.id,recipient,requestId:body.request_id,fingerprint:JSON.stringify({project:body.project,invite:body.invite||null,email:recipient,fields:body.fields,execution:body.execution})},async()=>{
      const {data,error}=await client.rpc('vertice_extension_student_issue',{p_project:body.project,p_registration:body.registration??null,p_cpf:body.cpf??null,p_email:body.email??null,p_fields:body.fields??[],p_execution:body.execution===true,p_invite:body.invite??null});
      if(error||!data)throw Error('invite_denied');
      const link=new URL('/extensao-convite',origin);link.searchParams.set('aluno','1');link.hash=new URLSearchParams({ativacao:data.token}).toString();
      return {subject:'Convite individual para a Extensão 360°',text:`Você foi convidado(a) para contribuir com o projeto “${data.title}”.\n\n${link.href}\n\nO link expira em 72 horas. Valide os dados com o e-mail cadastrado.`};
    },{env:name=>Deno.env.get(name),db:admin,fetch,log:entry=>console.log(JSON.stringify(entry))});
    if(!result.ok)return reply({error:result.error,code:result.code,id:result.id},502);
    return reply({ sent: true, accepted_by_provider: true, delivery_confirmed: false });
  } catch {
    return reply({ error: "Não foi possível processar o convite." }, 400);
  }
});
