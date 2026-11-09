import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";

type Conexao={id:string;tipo:string;fornecedor:string;rotulo:string;escopo:string;escopo_financeiro:string;aprovado_em:string|null;status:string;ultimo_teste_em:string|null;ultimo_sync_em:string|null;ultimo_erro:string|null;config:Record<string,unknown>};
const TIPOS:Record<string,string>={
  api:"API do sistema acadêmico",
  sql:"Banco SQL direto (somente leitura)",
  agente:"Agente instalado na rede da IES",
  onedrive:"Pasta OneDrive / SharePoint da IES"
};
const FIN:Record<string,string>={nenhum:"sem acesso financeiro/contábil",pessoal:"gasto com pessoal",completo:"financeiro e contábil completos"};
const STATUS:Record<string,string>={pendente:"Pendente",aguardando_aprovacao:"Aguardando aprovação do master",ativa:"Conectada",erro:"Com erro",pausada:"Pausada"};
const ERROS:Record<string,string>={
  aceite_obrigatorio:"Marque o aceite para continuar.",
  aceite_financeiro_obrigatorio:"Confirme a autorização do acesso financeiro/contábil.",
  somente_master:"Só o master pode aprovar esta conexão.",
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

type Origem={tabela:string;conjunto:string;fonte:string;metodo:string;status:string;linhas:number|null;congelado:boolean};
const METODO:Record<string,string>={extracao_v1:"Extração v1 (legado)",api:"API",banco_leitura:"Banco somente leitura",agente:"Agente",pasta_autorizada:"Pasta autorizada",manual:"Manual"};
const ORIGEM_STATUS:Record<string,string>={legado:"Legado v1",oficial:"Oficial",aposentado:"Aposentado"};

export default function ConexoesDados({institutionId,institutionName,role}:{institutionId:string;institutionName:string;role?:string}){
  const [lista,setLista]=useState<Conexao[]>([]);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const [token,setToken]=useState("");
  const [origens,setOrigens]=useState<Origem[]>([]);
  const [f,setF]=useState({tipo:"api",fornecedor:"",rotulo:"",escopo:"agregado",fin:"nenhum",aceiteFin:false,datasets:"",base_url:"",test_path:"/",header_name:"Authorization",scheme:"Bearer",engine:"postgres",host:"",port:"",database:"",user:"",link:"",secret:"",aceite:false});
  const set=(k:string,v:string|boolean)=>setF(p=>({...p,[k]:v}));

  const carregar=async()=>{
    const {data}=await supabase.from("vertice_data_connections")
      .select("id,tipo,fornecedor,rotulo,escopo,escopo_financeiro,aprovado_em,status,ultimo_teste_em,ultimo_sync_em,ultimo_erro,config")
      .eq("institution_id",institutionId).order("created_at",{ascending:false});
    setLista((data as Conexao[])??[]);
  };
  const carregarOrigens=async()=>{
    const {data}=await supabase.from("vertice_data_provenance").select("tabela,conjunto,fonte,metodo,status,linhas,congelado")
      .eq("institution_id",institutionId).order("tabela").order("conjunto");
    setOrigens((data as Origem[])??[]);
  };
  useEffect(()=>{setMsg("");setToken("");carregar();carregarOrigens();},[institutionId]);

  const montarConfig=()=>{
    if(f.tipo==="api"){
      const CAT:Record<string,string>={agregado:"academico_agregado",nominal:"academico_nominal",pessoal:"pessoal",financeiro:"financeiro"};
      const datasets=f.datasets.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{
        const [nome,path,cat,array_key]=l.split(";").map(x=>x.trim());
        return {nome,path,categoria:CAT[(cat||"agregado").toLowerCase()]??cat,array_key:array_key||undefined};
      });
      return {base_url:f.base_url,test_path:f.test_path||"/",header_name:f.header_name||"Authorization",scheme:f.scheme,datasets};
    }
    if(f.tipo==="sql")return {engine:f.engine,host:f.host,port:f.port?Number(f.port):undefined,database:f.database,user:f.user};
    if(f.tipo==="onedrive")return {link:f.link};
    return {};
  };
  const criar=async()=>{
    setBusy(true);setMsg("");setToken("");
    try{
      const r=await chamar({action:"criar",institution_id:institutionId,tipo:f.tipo,fornecedor:f.fornecedor,rotulo:f.rotulo,escopo:f.escopo,escopo_financeiro:f.fin,aceite_financeiro:f.fin!=="nenhum"?f.aceiteFin:undefined,config:montarConfig(),secret:f.secret||undefined,aceite:f.aceite});
      setF(p=>({...p,secret:"",aceite:false,aceiteFin:false}));
      if(r.token_agente)setToken(r.token_agente);
      setMsg(r.status==="erro"?"Conexão criada, mas o teste falhou: "+msgErro(r.teste):"Conexão criada. "+r.teste+".");
      carregar();
    }catch(e){setMsg(msgErro((e as Error).message));}
    setBusy(false);
  };
  const agir=async(id:string,action:string)=>{
    if(action==="revogar"&&!window.confirm("Apagar a credencial do cofre? A conexão será pausada e precisará ser refeita."))return;
    setBusy(true);setMsg("");
    try{const r=await chamar({action,id});setMsg(action==="testar"?(r.status==="erro"?"Teste falhou: "+msgErro(r.teste):r.teste+"."):action==="sincronizar"?"Sincronização concluída: "+((r as any).total??0)+" registro(s) lidos. Rotina automática toda segunda, antes das outras sincronizações.":"Feito.");carregar();}
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
          <strong>{c.rotulo}</strong> · {TIPOS[c.tipo]??c.tipo} · {c.fornecedor} · {c.escopo==="nominal"?"agregados + nominais":"só agregados"} · {FIN[c.escopo_financeiro]??c.escopo_financeiro}<br/>
          Situação: <strong>{STATUS[c.status]??c.status}</strong>
          {c.ultimo_teste_em&&<> · testada em {new Date(c.ultimo_teste_em).toLocaleString("pt-BR")}</>}
          {c.ultimo_sync_em?<> · sincronizada em {new Date(c.ultimo_sync_em).toLocaleString("pt-BR")}</>:<> · ainda sem sincronização de dados</>}
          {c.ultimo_erro&&<><br/><span role="alert">Último erro: {msgErro(c.ultimo_erro)}</span></>}
          <div style={{marginTop:6,display:"flex",gap:8,flexWrap:"wrap"}}>
            <button type="button" disabled={busy} onClick={()=>agir(c.id,"testar")}>Testar</button>
            {c.tipo==="api"&&c.status==="ativa"&&<button type="button" disabled={busy} onClick={()=>agir(c.id,"sincronizar")}>Sincronizar agora</button>}
            {c.status==="aguardando_aprovacao"&&role==="master"&&<button type="button" disabled={busy} onClick={()=>agir(c.id,"aprovar")}>Aprovar</button>}
            {c.status==="pausada"?<button type="button" disabled={busy} onClick={()=>agir(c.id,"retomar")}>Retomar</button>:<button type="button" disabled={busy} onClick={()=>agir(c.id,"pausar")}>Pausar</button>}
            {(c.tipo==="api"||c.tipo==="sql"||c.tipo==="agente")&&<button type="button" disabled={busy} onClick={()=>agir(c.id,"revogar")}>Apagar credencial</button>}
          </div>
        </li>)}
      </ul>}

      <div role="note" style={{margin:"0 0 16px",padding:12,border:"1px solid var(--line, #d9dde3)",borderRadius:8}}>
        <strong>Cautela antes de vincular</strong>
        <ul style={{margin:"6px 0 0",paddingLeft:18}}>
          <li>Use um acesso <strong>somente leitura</strong>, criado só para a Vértice. Nunca a senha de administrador.</li>
          <li>Conexões com <strong>dados nominais de alunos</strong> ou com <strong>financeiro e contábil completos</strong> só começam a valer depois da aprovação do master.</li>
          <li>Ao vincular, a IES responde pela base legal do tratamento (LGPD) e a Vértice atua como operadora. Tudo fica registrado em log.</li>
          <li>CPF, RG e documentos pessoais nunca são extraídos.</li>
          <li>Você pode pausar ou apagar a credencial a qualquer momento.</li>
        </ul>
      </div>
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
        <label style={{display:"block",margin:"8px 0"}}>Conjuntos de dados a puxar (um por linha: nome;/caminho;categoria;chave-da-lista opcional)<br/>
          <textarea value={f.datasets} rows={4} placeholder={"cursos;/cursos;agregado\nmatriculas;/matriculas;agregado;dados\nfolha_por_curso;/folha/curso;pessoal"} onChange={e=>set("datasets",e.target.value)} style={{width:"100%",maxWidth:480}}/></label>
        <p role="note" style={{margin:"0 0 8px"}}>Categorias: <strong>agregado</strong>, <strong>nominal</strong> (exige escopo nominal e aprovação do master), <strong>pessoal</strong> (exige autorização de gasto com pessoal) e <strong>financeiro</strong> (exige financeiro completo e aprovação). Campos como CPF, RG, e-mail, telefone e endereço são descartados sempre; nome e matrícula só ficam na categoria nominal.</p>
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
      <label style={{display:"block",margin:"8px 0"}}>Parte financeira e contábil: a IES autoriza o acesso?<br/>
        <select value={f.fin} onChange={e=>set("fin",e.target.value)}>
          <option value="nenhum">Não autorizo acesso financeiro/contábil</option>
          <option value="pessoal">Autorizo somente o gasto com pessoal</option>
          <option value="completo">Autorizo financeiro e contábil completos (exige aprovação do master)</option>
        </select></label>
      <p role="note" style={{margin:"4px 0 8px"}}>O gasto com pessoal é importante para analisar, ainda que parcialmente, a viabilidade econômica do curso. Sem ele, o Simulador de Custo e o Resultado por Curso trabalham apenas com parâmetros estimados. Ele é lido de forma agregada por curso e titulação, sem identificar o salário de cada pessoa.</p>
      {f.fin!=="nenhum"&&<label style={{display:"block",margin:"8px 0"}}>
        <input type="checkbox" checked={f.aceiteFin} onChange={e=>set("aceiteFin",e.target.checked)}/> Confirmo, como gestor de {institutionName}, que autorizo o acesso a {f.fin==="pessoal"?"dados de gasto com pessoal":"dados financeiros e contábeis"} e que sei que essas informações serão usadas nas análises da Vértice.
      </label>}
      <label style={{display:"block",margin:"8px 0"}}>
        <input type="checkbox" checked={f.aceite} onChange={e=>set("aceite",e.target.checked)}/> Declaro que {institutionName} autoriza a Vértice, como operadora, a ler estes dados para fins de gestão acadêmica e regulatória, e que a credencial informada é de acesso somente leitura.
      </label>
      <button type="button" disabled={busy||!f.aceite||!f.fornecedor||!f.rotulo||(f.fin!=="nenhum"&&!f.aceiteFin)} onClick={criar}>{busy?"Processando…":"Vincular e testar"}</button>

      {msg&&<p role="status" style={{margin:"8px 0 0"}}>{msg}</p>}
      {token&&<p role="alert" style={{margin:"8px 0 0",wordBreak:"break-all"}}>Token do agente (aparece só agora, copie e guarde): <code>{token}</code></p>}
      {origens.length>0&&<div style={{marginTop:20}}>
        <h4 style={{margin:"0 0 4px"}}>Origem dos dados já carregados</h4>
        <p style={{margin:"0 0 8px"}}>Dados da primeira versão da Vértice (extração do e-ORBIT e planilhas). Ficam congelados: não recebem novas cargas por esse caminho e serão substituídos, conjunto por conjunto, quando a conexão oficial estiver ativa.</p>
        <ul style={{listStyle:"none",padding:0,margin:0}}>
          {origens.map(o=><li key={o.tabela+o.conjunto} style={{padding:"4px 0",borderTop:"1px solid var(--line, #d9dde3)"}}>
            <strong>{o.conjunto?o.tabela.replace("vertice_","")+" · "+o.conjunto:o.tabela.replace("vertice_","")}</strong> — {o.fonte} · {METODO[o.metodo]??o.metodo} · <strong>{ORIGEM_STATUS[o.status]??o.status}</strong>{o.congelado&&" · congelado"}{o.linhas!=null&&" · "+o.linhas+" linha(s)"}
          </li>)}
        </ul>
      </div>}
      <p style={{margin:"12px 0 0",fontSize:"0.9em"}}>Situação atual: o portal registra, protege e testa a conexão. A leitura contínua dos dados de cada sistema é ativada conector por conector.</p>
    </section>
  );
}
