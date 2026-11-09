import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";

type Conexao={id:string;tipo:string;fornecedor:string;rotulo:string;escopo:string;status:string;ultimo_teste_em:string|null;ultimo_sync_em:string|null;ultimo_erro:string|null;config:Record<string,unknown>};
const TIPOS:Record<string,string>={
  api:"API do sistema acadêmico",
  sql:"Banco SQL direto (somente leitura)",
  agente:"Agente instalado na rede da IES",
  onedrive:"Pasta OneDrive / SharePoint da IES"
};
const STATUS:Record<string,string>={pendente:"Pendente",ativa:"Conectada",erro:"Com erro",pausada:"Pausada"};
const ERROS:Record<string,string>={
  aceite_obrigatorio:"Marque o aceite para continuar.",
  access_denied:"Seu perfil não pode gerenciar conexões desta instituição (exige gestor com segundo fator).",
  authentication_required:"Sessão expirada. Entre novamente.",
  url_invalida:"Use um endereço https:// sem usuário e senha na URL.",
  host_invalido:"Endereço inválido.",
  host_nao_permitido:"Esse endereço é interno ou não público. Use um endereço público, ou o agente na rede da IES.",
  config_invalida:"Confira os campos da conexão.",
  credencial_obrigatoria:"Informe a credencial.",
  fornecedor_invalido:"Informe o sistema/fornecedor.",
  rotulo_invalido:"Dê um nome à conexão."
};
const msgErro=(c:string)=>ERROS[c]??(c.startsWith("credencial_recusada")?"O sistema recusou a credencial.":c.startsWith("api_respondeu")?"O sistema respondeu com erro ("+c.replace("api_respondeu_","")+").":"Não foi possível concluir agora. Tente novamente.");

async function chamar(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke("vertice-conexao",{body});
  if(error){let code="";try{code=(await (error as any).context?.json?.())?.error??"";}catch{}throw new Error(code||"falha");}
  return data as {id:string;status:string;teste:string;token_agente?:string|null};
}

export default function ConexoesDados({institutionId,institutionName}:{institutionId:string;institutionName:string}){
  const [lista,setLista]=useState<Conexao[]>([]);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const [token,setToken]=useState("");
  const [f,setF]=useState({tipo:"api",fornecedor:"",rotulo:"",escopo:"agregado",base_url:"",test_path:"/",header_name:"Authorization",scheme:"Bearer",engine:"postgres",host:"",port:"",database:"",user:"",link:"",secret:"",aceite:false});
  const set=(k:string,v:string|boolean)=>setF(p=>({...p,[k]:v}));

  const carregar=async()=>{
    const {data}=await supabase.from("vertice_data_connections")
      .select("id,tipo,fornecedor,rotulo,escopo,status,ultimo_teste_em,ultimo_sync_em,ultimo_erro,config")
      .eq("institution_id",institutionId).order("created_at",{ascending:false});
    setLista((data as Conexao[])??[]);
  };
  useEffect(()=>{setMsg("");setToken("");carregar();},[institutionId]);

  const montarConfig=()=>{
    if(f.tipo==="api")return {base_url:f.base_url,test_path:f.test_path||"/",header_name:f.header_name||"Authorization",scheme:f.scheme};
    if(f.tipo==="sql")return {engine:f.engine,host:f.host,port:f.port?Number(f.port):undefined,database:f.database,user:f.user};
    if(f.tipo==="onedrive")return {link:f.link};
    return {};
  };
  const criar=async()=>{
    setBusy(true);setMsg("");setToken("");
    try{
      const r=await chamar({action:"criar",institution_id:institutionId,tipo:f.tipo,fornecedor:f.fornecedor,rotulo:f.rotulo,escopo:f.escopo,config:montarConfig(),secret:f.secret||undefined,aceite:f.aceite});
      setF(p=>({...p,secret:"",aceite:false}));
      if(r.token_agente)setToken(r.token_agente);
      setMsg(r.status==="erro"?"Conexão criada, mas o teste falhou: "+msgErro(r.teste):"Conexão criada. "+r.teste+".");
      carregar();
    }catch(e){setMsg(msgErro((e as Error).message));}
    setBusy(false);
  };
  const agir=async(id:string,action:string)=>{
    if(action==="revogar"&&!window.confirm("Apagar a credencial do cofre? A conexão será pausada e precisará ser refeita."))return;
    setBusy(true);setMsg("");
    try{const r=await chamar({action,id});setMsg(action==="testar"?(r.status==="erro"?"Teste falhou: "+msgErro(r.teste):r.teste+"."):"Feito.");carregar();}
    catch(e){setMsg(msgErro((e as Error).message));}
    setBusy(false);
  };
  const campo=(label:string,k:string,ph="",type="text")=>
    <label style={{display:"block",margin:"8px 0"}}>{label}<br/>
      <input type={type} value={String((f as any)[k])} placeholder={ph} autoComplete="off" onChange={e=>set(k,e.target.value)} style={{width:"100%",maxWidth:480}}/></label>;

  return (
    <section aria-label="Conexões de dados" style={{margin:"16px 0",padding:16,border:"1px solid var(--line, #d9dde3)",borderRadius:12}}>
      <h3 style={{margin:"0 0 4px"}}>Conexões de dados · {institutionName}</h3>
      <p style={{margin:"0 0 12px"}}>Vincule o sistema ou o banco da instituição. A credencial é guardada no cofre do servidor e nunca volta para a tela. Use sempre um acesso <strong>somente leitura</strong>.</p>

      {lista.length>0&&<ul style={{listStyle:"none",padding:0,margin:"0 0 16px"}}>
        {lista.map(c=><li key={c.id} style={{padding:"8px 0",borderTop:"1px solid var(--line, #d9dde3)"}}>
          <strong>{c.rotulo}</strong> · {TIPOS[c.tipo]??c.tipo} · {c.fornecedor} · {c.escopo==="nominal"?"agregados + nominais":"só agregados"}<br/>
          Situação: <strong>{STATUS[c.status]??c.status}</strong>
          {c.ultimo_teste_em&&<> · testada em {new Date(c.ultimo_teste_em).toLocaleString("pt-BR")}</>}
          {c.ultimo_sync_em?<> · sincronizada em {new Date(c.ultimo_sync_em).toLocaleString("pt-BR")}</>:<> · ainda sem sincronização de dados</>}
          {c.ultimo_erro&&<><br/><span role="alert">Último erro: {msgErro(c.ultimo_erro)}</span></>}
          <div style={{marginTop:6,display:"flex",gap:8,flexWrap:"wrap"}}>
            <button type="button" disabled={busy} onClick={()=>agir(c.id,"testar")}>Testar</button>
            {c.status==="pausada"?<button type="button" disabled={busy} onClick={()=>agir(c.id,"retomar")}>Retomar</button>:<button type="button" disabled={busy} onClick={()=>agir(c.id,"pausar")}>Pausar</button>}
            {(c.tipo==="api"||c.tipo==="sql"||c.tipo==="agente")&&<button type="button" disabled={busy} onClick={()=>agir(c.id,"revogar")}>Apagar credencial</button>}
          </div>
        </li>)}
      </ul>}

      <h4 style={{margin:"0 0 8px"}}>Nova conexão</h4>
      <label style={{display:"block",margin:"8px 0"}}>Tipo<br/>
        <select value={f.tipo} onChange={e=>set("tipo",e.target.value)}>{Object.entries(TIPOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      {campo("Sistema / fornecedor","fornecedor","ex.: e-ORBIT, TOTVS, Gennera, GIZ")}
      {campo("Nome da conexão","rotulo","ex.: Acadêmico principal")}
      {f.tipo==="api"&&<>
        {campo("Endereço da API (https)","base_url","https://api.exemplo.com.br/v1")}
        {campo("Caminho de teste","test_path","/")}
        {campo("Cabeçalho da chave","header_name","Authorization")}
        {campo("Prefixo (vazio se a chave vai pura)","scheme","Bearer")}
        {campo("Chave / token da API","secret","","password")}
      </>}
      {f.tipo==="sql"&&<>
        <label style={{display:"block",margin:"8px 0"}}>Banco<br/>
          <select value={f.engine} onChange={e=>set("engine",e.target.value)}><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="sqlserver">SQL Server</option></select></label>
        {campo("Servidor (nome público)","host","bd.ies.edu.br")}
        {campo("Porta (opcional)","port","")}
        {campo("Banco de dados","database","")}
        {campo("Usuário somente leitura","user","")}
        {campo("Senha","secret","","password")}
      </>}
      {f.tipo==="agente"&&<p>Ao criar, o portal gera um token <strong>exibido uma única vez</strong>. O agente da IES usa esse token para enviar os dados.</p>}
      {f.tipo==="onedrive"&&campo("Link da pasta compartilhada","link","https://…sharepoint.com/…")}

      <label style={{display:"block",margin:"8px 0"}}>Dados que a conexão pode trazer<br/>
        <select value={f.escopo} onChange={e=>set("escopo",e.target.value)}>
          <option value="agregado">Só agregados (totais por curso/semestre)</option>
          <option value="nominal">Agregados + nominais de alunos (acesso restrito)</option>
        </select></label>
      {f.escopo==="nominal"&&<p role="note">Dados nominais ficam sob acesso restrito. CPF, RG, documentos e dados financeiros de alunos nunca são extraídos.</p>}
      <label style={{display:"block",margin:"8px 0"}}>
        <input type="checkbox" checked={f.aceite} onChange={e=>set("aceite",e.target.checked)}/> Declaro que {institutionName} autoriza a Vértice, como operadora, a ler estes dados para fins de gestão acadêmica e regulatória, e que a credencial informada é de acesso somente leitura.
      </label>
      <button type="button" disabled={busy||!f.aceite||!f.fornecedor||!f.rotulo} onClick={criar}>{busy?"Processando…":"Vincular e testar"}</button>

      {msg&&<p role="status" style={{margin:"8px 0 0"}}>{msg}</p>}
      {token&&<p role="alert" style={{margin:"8px 0 0",wordBreak:"break-all"}}>Token do agente (aparece só agora, copie e guarde): <code>{token}</code></p>}
      <p style={{margin:"12px 0 0",fontSize:"0.9em"}}>Situação atual: o portal registra, protege e testa a conexão. A leitura contínua dos dados de cada sistema é ativada conector por conector.</p>
    </section>
  );
}
