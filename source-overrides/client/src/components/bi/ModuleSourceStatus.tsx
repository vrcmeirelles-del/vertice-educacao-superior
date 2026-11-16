import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
type Snapshot={institution_id:string;tier:string;retrieved_at:string;notice:string;modules:{key:string;label:string;source:string;records:number|null;last_updated_at:string|null;status:string}[]};
export default function ModuleSourceStatus({institutionId,revision=0}:{institutionId:string;revision?:number}){
 const [state,setState]=useState<{institution:string;data?:Snapshot;error?:string}>({institution:''}),[tick,setTick]=useState(0);
 useEffect(()=>{let active=true;setState({institution:institutionId});
 Promise.resolve(supabase.rpc('vertice_bi_module_status',{p_institution:institutionId})).then(({data,error})=>{
 if(!active)return;if(error)throw error;setState({institution:institutionId,data});
 }).catch(e=>{if(active)setState({institution:institutionId,error:e.message||'Falha ao consultar fontes dos módulos'});});
 return()=>{active=false;};},[institutionId,revision,tick]);
 const current=state.institution===institutionId?state:undefined;
 return <details className="area-panel"><summary>Fontes e atualização dos módulos</summary>
 <p>Disponibilidade da base institucional para BI e Sapiens. Cada módulo mantém suas fórmulas, filtros e validações.</p>
 <button className="area-btn secondary" type="button" onClick={()=>setTick(n=>n+1)}>Conferir fontes agora</button>
 {current?.error?<p role="alert">{current.error}</p>:!current?.data?<p role="status">Conferindo fontes institucionais…</p>:<>
 <p>Consulta: {new Date(current.data.retrieved_at).toLocaleString('pt-BR')} · {current.data.tier==='escolas'?'Vértice Escolas':'Vértice Educação Superior'}</p>
 <div style={{overflowX:'auto'}}><table className="area-table"><caption>Registros disponíveis por fonte, incluindo rascunhos</caption><thead><tr><th>Módulo</th><th>Registros</th><th>Disponibilidade</th><th>Última alteração na fonte</th></tr></thead>
 <tbody>{current.data.modules.map(m=><tr key={m.key}><td>{m.label}<small className="area-block">{m.source}</small></td><td>{m.records==null?'Não consultado':m.records.toLocaleString('pt-BR')}</td><td>{m.status==='available'?'Com registros':m.status==='empty'?'Sem registros na fonte':'Fonte indisponível'}</td><td>{m.last_updated_at?new Date(m.last_updated_at).toLocaleString('pt-BR'):'Sem data disponível'}</td></tr>)}</tbody></table></div>
 <p className="area-muted">{current.data.notice}</p></>}
 </details>;
}
