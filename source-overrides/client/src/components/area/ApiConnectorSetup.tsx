import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {Role} from "@/lib/area";
import "./api-connector.css";

type Connector={
 id:string;connector_type:string;label:string;api_base_url:string;api_auth_type:string;
 api_roster_endpoint:string;api_roster_method:string;api_response_mapping:Record<string,string>;
 sync_enabled:boolean;sync_interval_hours:number;sync_auto_link:boolean;sync_filter_status:string[];
 last_sync_at:string|null;last_sync_status:string;last_sync_message:string|null;
 last_sync_matched:number;last_sync_linked:number;last_sync_total:number;
};
type LogEntry={id:string;started_at:string;completed_at:string|null;status:string;total_fetched:number;matched:number;linked:number;skipped:number;error_message:string|null};
const MANAGEMENT:Role[]=["master","reitor","gestor","diretor_geral","diretor_pedagogico"];
const AUTH_TYPES=[["bearer","Token Bearer"],["basic","Basic Auth"],["api_key_header","Header personalizado"],["oauth2_client","OAuth2 Client"]] as const;
const number=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const date=(v:string|null)=>{if(!v)return"Nunca";try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));}catch{return"—";}};

const DEFAULT_MAPPING=JSON.stringify({students:"data",cpf:"cpf",name:"nome",course:"curso",turma:"turma",status:"situacao"},null,2);

export default function ApiConnectorSetup({institutionId,role}:{institutionId:string;role:Role|null}){
 const canManage=Boolean(role&&MANAGEMENT.includes(role));
 const [connector,setConnector]=useState<Connector|null>(null);
 const [logs,setLogs]=useState<LogEntry[]>([]);
 const [editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [form,setForm]=useState({
  label:"",connector_type:"rest_api",api_base_url:"",api_auth_type:"bearer",api_auth_value:"",
  api_roster_endpoint:"/alunos/matriculados",api_roster_method:"GET",
  api_response_mapping:DEFAULT_MAPPING,
  sync_enabled:false,sync_interval_hours:24,sync_auto_link:true,
  sync_filter_status:"matriculado,ativo,cursando"
 });

 const load=useCallback(async()=>{
  const {data}=await supabase.from("vertice_api_connectors")
   .select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(data){
   setConnector(data as Connector);
   setForm({
    label:data.label,connector_type:data.connector_type,api_base_url:data.api_base_url,
    api_auth_type:data.api_auth_type,api_auth_value:"",
    api_roster_endpoint:data.api_roster_endpoint,api_roster_method:data.api_roster_method,
    api_response_mapping:JSON.stringify(data.api_response_mapping,null,2),
    sync_enabled:data.sync_enabled,sync_interval_hours:data.sync_interval_hours,
    sync_auto_link:data.sync_auto_link,sync_filter_status:(data.sync_filter_status||[]).join(",")
   });
   // Load logs
   const {data:logData}=await supabase.from("vertice_sync_log")
    .select("*").eq("connector_id",data.id).order("started_at",{ascending:false}).limit(10);
   setLogs((logData||[]) as LogEntry[]);
  }
 },[institutionId]);

 useEffect(()=>{if(canManage)void load();},[canManage,load]);

 const save=async()=>{
  setBusy(true);setMessage("");
  try{
   let mapping:Record<string,string>;
   try{mapping=JSON.parse(form.api_response_mapping);}
   catch{throw new Error("Mapeamento JSON inválido");}

   const payload={
    institution_id:institutionId,label:form.label,connector_type:form.connector_type,
    api_base_url:form.api_base_url,api_auth_type:form.api_auth_type,
    ...(form.api_auth_value?{api_auth_value:form.api_auth_value}:{}),
    api_roster_endpoint:form.api_roster_endpoint,api_roster_method:form.api_roster_method,
    api_response_mapping:mapping,
    sync_enabled:form.sync_enabled,sync_interval_hours:form.sync_interval_hours,
    sync_auto_link:form.sync_auto_link,
    sync_filter_status:form.sync_filter_status.split(",").map(s=>s.trim()).filter(Boolean),
    updated_at:new Date().toISOString()
   };

   if(connector){
    const {error}=await supabase.from("vertice_api_connectors").update(payload).eq("id",connector.id);
    if(error)throw error;
   }else{
    const {data:{user}}=await supabase.auth.getUser();
    const {error}=await supabase.from("vertice_api_connectors").insert({...payload,created_by:user?.id||""});
    if(error)throw error;
   }
   setMessage("✅ Conector salvo.");setEditing(false);void load();
  }catch(err){setMessage("❌ "+(err as Error).message);}
  finally{setBusy(false);}
 };

 const triggerSync=async()=>{
  if(!connector)return;
  setBusy(true);setMessage("Sincronizando...");
  try{
   const {data,error}=await supabase.functions.invoke("vertice-roster-sync",{
    body:{connectorId:connector.id}
   });
   if(error)throw error;
   const r=data?.results?.[0];
   if(r?.status==="error")setMessage("❌ "+r.error);
   else setMessage(`✅ Sync: ${number(r?.linked||0)} vinculados de ${number(r?.total||0)} alunos`);
   void load();
  }catch(err){setMessage("❌ "+(err as Error).message);}
  finally{setBusy(false);}
 };

 if(!canManage)return null;

 return <section className="api-connector">
  <header>
   <div><h4>Conector automático — API do sistema acadêmico</h4>
   <p>Configure a API do sistema acadêmico da IES para sincronizar matrículas automaticamente. A cada ciclo, alunos novos são vinculados ao Fato & Ordem sem intervenção manual.</p></div>
   {!editing&&<button className="corp-button small" onClick={()=>setEditing(true)}>{connector?"Editar":"Configurar"}</button>}
  </header>

  {connector&&!editing&&<div className="api-status">
   <dl>
    <div><dt>Conector</dt><dd>{connector.label||connector.connector_type}</dd></div>
    <div><dt>Sync automático</dt><dd>{connector.sync_enabled?`Ativo (a cada ${connector.sync_interval_hours}h)`:"Desativado"}</dd></div>
    <div><dt>Última sync</dt><dd>{date(connector.last_sync_at)}</dd></div>
    <div><dt>Status</dt><dd><span className={"api-badge api-"+connector.last_sync_status}>{connector.last_sync_status==="success"?"OK":connector.last_sync_status==="error"?"Erro":connector.last_sync_status==="running"?"Rodando":"Nunca"}</span></dd></div>
    <div><dt>Último resultado</dt><dd>{connector.last_sync_message||"—"}</dd></div>
   </dl>
   <button className="corp-button small" disabled={busy} onClick={()=>void triggerSync()}>
    {busy?"Sincronizando…":"Sincronizar agora"}
   </button>
  </div>}

  {editing&&<div className="api-form">
   <label>Nome do conector<input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="Ex: API e-ORBIT UNITOP"/></label>
   <label>URL base da API<input value={form.api_base_url} onChange={e=>setForm(f=>({...f,api_base_url:e.target.value}))} placeholder="https://api.sistema-academico.com.br"/></label>
   <label>Endpoint do roster<input value={form.api_roster_endpoint} onChange={e=>setForm(f=>({...f,api_roster_endpoint:e.target.value}))} placeholder="/alunos/matriculados"/></label>
   <label>Autenticação
    <select value={form.api_auth_type} onChange={e=>setForm(f=>({...f,api_auth_type:e.target.value}))}>
     {AUTH_TYPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}
    </select>
   </label>
   <label>Credencial (token/chave)<input type="password" value={form.api_auth_value} onChange={e=>setForm(f=>({...f,api_auth_value:e.target.value}))} placeholder={connector?"(manter atual)":"Token de acesso"}/></label>
   <label className="wide">Mapeamento de campos (JSON)<textarea rows={5} value={form.api_response_mapping} onChange={e=>setForm(f=>({...f,api_response_mapping:e.target.value}))}/></label>
   <label>Intervalo de sync (horas)<input type="number" min={1} max={168} value={form.sync_interval_hours} onChange={e=>setForm(f=>({...f,sync_interval_hours:Number(e.target.value)}))}/></label>
   <label>Status do aluno para incluir<input value={form.sync_filter_status} onChange={e=>setForm(f=>({...f,sync_filter_status:e.target.value}))} placeholder="matriculado,ativo,cursando"/></label>
   <label className="api-check"><input type="checkbox" checked={form.sync_enabled} onChange={e=>setForm(f=>({...f,sync_enabled:e.target.checked}))}/><span>Ativar sincronização automática</span></label>
   <label className="api-check"><input type="checkbox" checked={form.sync_auto_link} onChange={e=>setForm(f=>({...f,sync_auto_link:e.target.checked}))}/><span>Vincular automaticamente ao Fato & Ordem</span></label>
   <div className="api-actions">
    <button className="corp-button" disabled={busy} onClick={()=>void save()}>{busy?"Salvando…":"Salvar conector"}</button>
    <button className="corp-button outline" onClick={()=>setEditing(false)}>Cancelar</button>
   </div>
  </div>}

  {message&&<p role="status" className="api-message">{message}</p>}

  {logs.length>0&&<div className="api-logs">
   <h5>Histórico de sincronizações</h5>
   <table><thead><tr><th>Data</th><th>Buscados</th><th>Vinculados</th><th>Não encontrados</th><th>Status</th><th>Erro</th></tr></thead>
   <tbody>{logs.map(l=><tr key={l.id}>
    <td>{date(l.started_at)}</td><td>{number(l.total_fetched)}</td><td><strong>{number(l.linked)}</strong></td>
    <td>{number(l.skipped)}</td>
    <td><span className={"api-badge api-"+l.status}>{l.status==="success"?"OK":l.status==="error"?"Erro":"Rodando"}</span></td>
    <td className="api-error-cell">{l.error_message||"—"}</td>
   </tr>)}</tbody></table>
  </div>}
 </section>;
}
