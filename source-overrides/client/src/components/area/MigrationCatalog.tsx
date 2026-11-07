import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import "./migration-catalog.css";

type Catalog={
 id:string;system_name:string;catalog_state:string;source_file:string;
 expected_tables:number;recorded_tables:number;source_sha256:string;registered_at:string;
};
type Entry={
 table_schema:string;table_name:string;area_sugerida:string|null;
 prioridade_sugerida:number|null;confirmation_state:string;observacao:string|null;
};
const UNICALDAS="4224e2fc-6a96-4761-820f-6f8e809ca1c1";
const INITIAL=40;

export default function MigrationCatalog({institutionId}:{institutionId:string}){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [entries,setEntries]=useState<Entry[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [area,setArea]=useState("todas");
 const [priority,setPriority]=useState("todas");
 const [limit,setLimit]=useState(INITIAL);
 useEffect(()=>{if(institutionId!==UNICALDAS)return;
  let alive=true;setLoading(true);setError("");
  (async()=>{
   const {data:catalogRow,error:catalogError}=await supabase.from("vertice_migration_catalogs")
    .select("id,system_name,catalog_state,source_file,expected_tables,recorded_tables,source_sha256,registered_at")
    .eq("institution_id",institutionId).eq("system_name","UNI_GIZ")
    .order("registered_at",{ascending:false}).limit(1).maybeSingle();
   if(catalogError)throw catalogError;
   if(!catalogRow){if(alive){setCatalog(null);setEntries([])}return;}
   const {data:rows,error:rowsError}=await supabase.from("vertice_migration_catalog_tables")
    .select("table_schema,table_name,area_sugerida,prioridade_sugerida,confirmation_state,observacao")
    .eq("institution_id",institutionId).eq("catalog_id",catalogRow.id)
    .order("table_name",{ascending:true}).range(0,999);
   if(rowsError)throw rowsError;
   if(alive){setCatalog(catalogRow as Catalog);setEntries((rows??[]) as Entry[]);}
  })().catch(e=>{if(alive)setError((e as Error).message??"Não foi possível consultar o catálogo.")})
    .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[institutionId]);
 const options=useMemo(()=>[...new Set(entries.map(x=>x.area_sugerida??"Não classificado"))].sort((a,b)=>a.localeCompare(b,"pt-BR")),[entries]);
 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase("pt-BR");
  return entries.filter(x=>(area==="todas"||(x.area_sugerida??"Não classificado")===area)
   &&(priority==="todas"||String(x.prioridade_sugerida)===priority)
   &&(!q||(x.table_schema+"."+x.table_name+" "+(x.area_sugerida??"")).toLocaleLowerCase("pt-BR").includes(q)));
 },[entries,area,priority,search]);
 const priority1=entries.filter(x=>x.prioridade_sugerida===1).length;
 const verified=entries.filter(x=>x.confirmation_state==="confirmado_restauracao").length;
 if(institutionId!==UNICALDAS)return null;
 return <section className="vx-migcat" aria-label="Catálogo UNI_GIZ cadastrado no banco da UNICALDAS">
  <header>
   <span>BASE DE DADOS · UNICALDAS</span>
   <h4>Catálogo UNI_GIZ — estrutura registrada</h4>
   <p>Relação original de tabelas, vinculada ao BAK recebido. Áreas e prioridades são sugestões pelo nome; nenhuma contagem de alunos ou linhas foi inferida.</p>
  </header>
  {loading?<p role="status">Consultando a base da UNICALDAS…</p>:
   error?<p role="alert" className="vx-migcat-error">{error}</p>:
   !catalog?<p>Nenhum inventário estrutural importado para esta instituição.</p>:
   <>
    <div className="vx-migcat-stats">
     <div><strong>{entries.length.toLocaleString("pt-BR")}</strong><small>Nomes no Supabase</small></div>
     <div><strong>{priority1}</strong><small>Tabelas prioritárias</small></div>
     <div><strong>{verified}</strong><small>Verificadas por restauração</small></div>
     <div><strong>0</strong><small>Registros importados ao BI</small></div>
    </div>
    <div className="vx-migcat-notice">
     <strong>Inventário carregado · restauração pendente.</strong> O arquivo BAK foi recebido, mas a mídia ainda necessita de RESTORE VERIFYONLY e restauração em SQL Server isolado. O catálogo não comprova a presença de linhas em nenhuma tabela.
    </div>
    <div className="vx-migcat-filters">
     <label>Buscar tabela
      <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(INITIAL)}} placeholder="Ex.: ALUNOGER, FALTASGLOBAIS"/>
     </label>
     <label>Área sugerida
      <select value={area} onChange={e=>{setArea(e.target.value);setLimit(INITIAL)}}>
       <option value="todas">Todas as áreas</option>
       {options.map(x=><option value={x} key={x}>{x}</option>)}
      </select>
     </label>
     <label>Prioridade sugerida
      <select value={priority} onChange={e=>{setPriority(e.target.value);setLimit(INITIAL)}}>
       <option value="todas">Todas</option>
       <option value="1">1 · Primeira extração</option>
       <option value="2">2 · Complementares</option>
       <option value="3">3 · Posteriores</option>
      </select>
     </label>
    </div>
    <p className="vx-migcat-count">Mostrando {Math.min(limit,filtered.length)} de {filtered.length} tabelas correspondentes aos filtros · {entries.length} cadastradas ao todo.</p>
    <div className="vx-migcat-scroll"><table>
     <thead><tr><th>Tabela</th><th>Área sugerida</th><th>Prioridade</th><th>Validação</th></tr></thead>
     <tbody>{filtered.slice(0,limit).map(x=><tr key={x.table_schema+"."+x.table_name}>
      <td><strong>{x.table_schema}.{x.table_name}</strong></td>
      <td>{x.area_sugerida??"Não classificada"}</td>
      <td>{x.prioridade_sugerida===1?"Alta":x.prioridade_sugerida===2?"Média":"Posterior"}</td>
      <td>Não verificada</td>
     </tr>)}</tbody>
    </table></div>
    {limit<filtered.length&&<button type="button" className="vx-migcat-more" onClick={()=>setLimit(x=>x+40)}>Exibir mais 40 tabelas</button>}
    <footer>Fonte: <strong>{catalog.source_file}</strong> · SHA-256: <code>{catalog.source_sha256.slice(0,16)}…</code> · inclusão {new Date(catalog.registered_at).toLocaleString("pt-BR")}. Os dados permanecem exclusivamente no escopo da UNICALDAS, não homologados para o BI.</footer>
   </>}
 </section>;
}
