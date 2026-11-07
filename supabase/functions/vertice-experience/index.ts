import { createClient } from "npm:@supabase/supabase-js@2.57.0";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const origins = new Set(["https://www.verticesuperior.com.br","https://verticesuperior.com.br","https://vertice-portal.onrender.com"]);
const modes = ["faculdade","centro","universidade"];
const roles = ["mantenedor","reitor","coordenador"];
const modules = ["overview","courses","academic","enade","governance","evidence","library","goals","acquisitions","economics","admissions","report"];
const states = ["pending","returned","review","validated"];
const hex = /^[a-f0-9]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const suffix = "https://www.verticesuperior.com.br/experience#convite=";
class APIError extends Error { constructor(readonly label: string, readonly status=400) { super(label); } }
const env = (key: string) => Deno.env.get(key) ?? "";
function serviceKey() {
  const all = env("SUPABASE_SECRET_KEYS");
  if (all) try {const key = JSON.parse(all).default; if (typeof key==="string" && key) return key;} catch {}
  return env("SUPABASE_SERVICE_ROLE_KEY");
}
function database() {
  const key=serviceKey(), url=env("SUPABASE_URL");
  if(!key||!url) throw new APIError("service_unavailable",503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function digest(token:string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
  return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function secret() {
  const a=crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function body(req:Request): Promise<Record<string,unknown>> {
  if(Number(req.headers.get("content-length")||0)>32768)throw new APIError("payload_too_large",413);
  const b=await req.text();
  if(b.length>32768)throw new APIError("payload_too_large",413);
  let data:unknown;
  try{data=JSON.parse(b);}catch{throw new APIError("invalid_request");}
  if(!data||typeof data!=="object"||Array.isArray(data))throw new APIError("invalid_request");
  return data as Record<string,unknown>;
}
function readString(x:unknown,max=120){return typeof x==="string" ? x.trim().slice(0,max) : "";}
function validMode(x:unknown):x is string{return typeof x==="string"&&modes.includes(x);}
function validRole(x:unknown):x is string{return typeof x==="string"&&roles.includes(x);}
const now=()=>new Date().toISOString();
type Db=ReturnType<typeof database>;
async function requireMaster(db:Db,req:Request){
  const auth=req.headers.get("authorization")??"";
  const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(auth);
  if(!match)throw new APIError("master_auth_required",401);
  const token=match[1];
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user||!data.user.email_confirmed_at)throw new APIError("master_auth_required",401);
  let claim:Record<string,unknown>;
  try{claim=JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));}catch{throw new APIError("master_auth_required",401);}
  if(claim.sub!==data.user.id||claim.aal!=="aal2")throw new APIError("master_mfa_required",403);
  const {data:masters,error:accessError}=await db.from("vertice_admins").select("user_id").eq("user_id",data.user.id).limit(1);
  if(accessError||!masters?.length)throw new APIError("master_access_denied",403);
  return data.user.id;
}
async function invitation(db:Db,payload:Record<string,unknown>){
  const id=readString(payload.id,50),token=readString(payload.token,70);
  if(!uuid.test(id)||!(/^[A-Za-z0-9_-]{43}$/.test(token)))throw new APIError("invalid_invitation",401);
  const token_digest=await digest(token);
  if(!hex.test(token_digest))throw new APIError("invalid_invitation",401);
  const {data,error}=await db.from("vertice_experience_invites")
    .select("id,token_digest,recipient_name,target_email,experience_role,institution_type,expires_at,revoked_at,opens,saves,demo_state")
    .eq("id",id).eq("token_digest",token_digest).maybeSingle();
  if(error)throw new APIError("service_unavailable",503);
  if(!data||data.revoked_at||Date.parse(data.expires_at)<=Date.now())throw new APIError("invitation_expired_or_revoked",401);
  return data;
}
function snapshot(input:unknown) {
  if(!input||typeof input!=="object"||Array.isArray(input))throw new APIError("invalid_state");
  const raw=input as Record<string,unknown>;
  if(Object.keys(raw).some(k=>!["evidence","goals","finance","queue","submitted","lastView"].includes(k)))throw new APIError("invalid_state");
  const evidence=Array.isArray(raw.evidence)?raw.evidence:[];
  const goals=Array.isArray(raw.goals)?raw.goals:[];
  const submitted=Array.isArray(raw.submitted)?raw.submitted:[];
  if(evidence.length>180||goals.length>24||submitted.length>310)throw new APIError("invalid_state");
  const validId=(x:unknown)=>typeof x==="string"&&/^[a-z0-9-]{1,65}$/.test(x);
  const ev=evidence.map(x=>{
    if(!x||typeof x!=="object"||!validId(x.id)||!states.includes(x.status))throw new APIError("invalid_state");
    return {id:x.id,status:x.status};
  });
  const gs=goals.map(x=>{
    if(!x||typeof x!=="object"||!validId(x.id)||!Number.isInteger(x.progress)||x.progress<0||x.progress>100)throw new APIError("invalid_state");
    return {id:x.id,progress:x.progress};
  });
  const ss=submitted.map(x=>{if(typeof x!=="string"||!(/^[A-Z0-9._-]{1,45}$/.test(x)))throw new APIError("invalid_state");return x;});
  const fin=raw.finance&&typeof raw.finance==="object"&&!Array.isArray(raw.finance)?raw.finance as Record<string,unknown>:{};
  const finance:Record<string,number>={};
  for(const k of ["revenue","cost","depreciation","multiple","debt","cash"]){
    const n=fin[k];if(typeof n!=="number"||!Number.isFinite(n)||n<0||n>1000000000)throw new APIError("invalid_state");finance[k]=n;
  }
  if(finance.multiple<1||finance.multiple>8)throw new APIError("invalid_state");
  if(typeof raw.queue!=="boolean"||typeof raw.lastView!=="string"||!modules.includes(raw.lastView))throw new APIError("invalid_state");
  return {evidence:ev,goals:gs,finance,queue:raw.queue,submitted:ss,lastView:raw.lastView};
}
async function logEvent(db:Db,id:string,kind:string,module:string|null=null) {
  const {error}=await db.from("vertice_experience_events").insert({invite_id:id,kind,module});
  if(error)throw new APIError("service_unavailable",503);
}
async function handler(req:Request):Promise<Response> {
  const origin=req.headers.get("origin")||"";
  const headers:Record<string,string>={
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "Referrer-Policy":"no-referrer",
    "X-Content-Type-Options":"nosniff",
    "Vary":"Origin",
  };
  if(origins.has(origin))Object.assign(headers,{
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Headers":"content-type, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
  });
  const send=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
  if(!origins.has(origin))return send({error:"origin_denied"},403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return send({error:"method_not_allowed"},405);
  try{
    const input=await body(req),action=readString(input.action,35),db=database();
    if(action.startsWith("admin:")){
      const actor=await requireMaster(db,req);
      if(action==="admin:create"){
        const email=readString(input.email,254).toLowerCase();
        if(!emailPattern.test(email)||!validMode(input.mode)||!validRole(input.role))throw new APIError("invalid_invitation_data");
        const hours=Number(input.hours);
        if(![24,72,168,336].includes(hours))throw new APIError("invalid_expiration");
        const name=readString(input.name,120);
        const accessToken=secret(),token_digest=await digest(accessToken);
        const expiresAt=new Date(Date.now()+hours*3600000).toISOString();
        const {data,error}=await db.from("vertice_experience_invites").insert({
          target_email:email,recipient_name:name,institution_type:input.mode,
          experience_role:input.role,issued_by:actor,token_digest,expires_at:expiresAt
        }).select("id,expires_at").single();
        if(error||!data)throw new APIError("invitation_creation_failed",503);
        return send({id:data.id,expires_at:data.expires_at,link:suffix+data.id+"."+accessToken});
      }
      if(action==="admin:list"){
        const {data,error}=await db.from("vertice_experience_invites")
          .select("id,target_email,recipient_name,institution_type,experience_role,created_at,expires_at,revoked_at,opens,saves,last_opened_at")
          .order("created_at",{ascending:false}).limit(100);
        if(error)throw new APIError("service_unavailable",503);
        const {data:events,error:eventError}=await db.from("vertice_experience_events")
          .select("invite_id,kind,module,occurred_at").order("occurred_at",{ascending:false}).limit(3000);
        if(eventError)throw new APIError("service_unavailable",503);
        const usage:Record<string,Record<string,number>>={};
        for(const item of events||[]){
          const id=item.invite_id,category=item.module||item.kind;
          if(!usage[id])usage[id]={};
          usage[id][category]=(usage[id][category]??0)+1;
        }
        return send({invitations:(data||[]).map(x=>({...x,usage:usage[x.id]||{}})),count:(data||[]).length,events_window:3000});
      }
      if(action==="admin:revoke"){
        const id=readString(input.id,50);
        if(!uuid.test(id))throw new APIError("invalid_invitation");
        const {data,error}=await db.from("vertice_experience_invites")
          .update({revoked_at:now(),revoked_by:actor,updated_at:now()})
          .eq("id",id).is("revoked_at",null).select("id").maybeSingle();
        if(error)throw new APIError("service_unavailable",503);
        return send({revoked:Boolean(data)});
      }
      throw new APIError("unknown_action",404);
    }
    const item=await invitation(db,input);
    if(action==="guest:open"){
      const timestamp=now();
      if(item.opens>=500)throw new APIError("usage_limit",429);
      const {data,error}=await db.from("vertice_experience_invites")
        .update({opens:item.opens+1,last_opened_at:timestamp,updated_at:timestamp})
        .eq("id",item.id).is("revoked_at",null).gt("expires_at",timestamp)
        .select("id").maybeSingle();
      if(error)throw new APIError("service_unavailable",503);
      if(!data)throw new APIError("invitation_expired_or_revoked",401);
      await logEvent(db,item.id,"opened");
      return send({experience:{id:item.id,mode:item.institution_type,role:item.experience_role,
        name:item.recipient_name,expires_at:item.expires_at},state:item.demo_state,
        note:"Convite por link: qualquer pessoa com o segredo pode abri-lo. Não contém dados reais."});
    }
    if(action==="guest:save"){
      if(item.saves>=1000)throw new APIError("usage_limit",429);
      const demo_state=snapshot(input.state);
      const timestamp=now();
      const {data,error}=await db.from("vertice_experience_invites")
        .update({demo_state,saves:item.saves+1,updated_at:timestamp})
        .eq("id",item.id).is("revoked_at",null).gt("expires_at",timestamp)
        .select("id").maybeSingle();
      if(error)throw new APIError("service_unavailable",503);
      if(!data)throw new APIError("invitation_expired_or_revoked",401);
      return send({saved:true});
    }
    if(action==="guest:module"){
      const module=readString(input.module,35);
      if(!modules.includes(module))throw new APIError("invalid_module");
      await logEvent(db,item.id,module==="report"?"report":"module",module);
      return send({tracked:true});
    }
    throw new APIError("unknown_action",404);
  } catch(error){
    if(error instanceof APIError)return send({error:error.label},error.status);
    return send({error:"service_unavailable"},503);
  }
}
Deno.serve(handler);
