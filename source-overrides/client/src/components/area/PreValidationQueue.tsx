/** Common evidence inbox; coverage is generated from the server's adapter registry. */
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {type Row,explain} from '@/lib/area';
import sourceCoverage from '@/lib/preanalysis-sources.json';
const PreValidationPanel=lazy(()=>import('./PreValidationPanel'));
type Item={id:string;title:string;sourceTable:string;sourceLabel:string};
export default function PreValidationQueue({institutionId,role}:{institutionId:string;role:string|null}){
 const [items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState<Item|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);const generation=useRef(0);
 useEffect(()=>{const token=++generation.current;setSelected(null);setItems([]);setError('');if(!['master','gestor'].includes(role??''))return;setLoading(true);
  void Promise.all(sourceCoverage.adapters.map(a=>{
   const titleField=['vertice_documents','vertice_goals'].includes(a.table)?'title':a.table==='vertice_actions'?'what':a.table==='vertice_repository_files'?'file_name':null;
   return supabase.from(a.table).select(titleField?`id,${titleField}`:'id').eq('institution_id',institutionId).order(a.table==='vertice_enrollment_snapshots'?'imported_at':'created_at',{ascending:false}).limit(100).returns<Row[]>();
  })).then(results=>{if(token!==generation.current)return;const failure=results.find(r=>r.error)?.error;if(failure)throw failure;setItems(results.flatMap((r,i)=>(r.data??[]).map((x:Row)=>({id:String(x.id),title:String(x.file_name??x.title??x.what??`${sourceCoverage.adapters[i].label} · ${String(x.id).slice(0,8)}`),sourceTable:sourceCoverage.adapters[i].table,sourceLabel:sourceCoverage.adapters[i].label}))))}).catch(e=>{if(token===generation.current)setError(explain(e))}).finally(()=>{if(token===generation.current)setLoading(false)});
  return()=>{generation.current++};
 },[institutionId,role]);
 return <section><h2>Possíveis evidências: pré-análise e decisão</h2><p>Objetivo: todos os módulos do Superior. Nesta etapa há {sourceCoverage.adapters.length} adaptadores de fontes. Demais módulos e especializações de curso aguardam conexão e homologação. Escolas fica fora deste fluxo.</p><p>Documento ou dado recebido não é evidência validada. A análise pode indicar pertinência, nenhuma correlação ou informação insuficiente. O gestor decide, e a validação no destino permanece pendente.</p><p>A lista mostra os 100 registros mais recentes de cada fonte, não todo o acervo. Abra também pelo documento no módulo de origem.</p><details><summary>Fontes e limites de cobertura</summary>{sourceCoverage.adapters.map(a=><p key={a.table}><strong>{a.label}</strong>: {a.fieldPolicy}</p>)}<p>{sourceCoverage.limitations}</p></details>{!['master','gestor'].includes(role??'')&&<p>Primeira etapa disponível apenas a gestor institucional/master com MFA; não amplia as permissões de outros perfis.</p>}{error&&<p role="alert">{error}</p>}{loading&&<p>Carregando fontes…</p>}
 {selected&&<Suspense fallback={<p>Carregando pré-análise…</p>}><PreValidationPanel key={`${institutionId}/${selected.sourceTable}/${selected.id}`} file={{id:selected.id,title:selected.title} as Row} institutionId={institutionId} sourceTable={selected.sourceTable} onClose={()=>setSelected(null)}/></Suspense>}
 <ul>{items.map(item=><li key={`${item.sourceTable}/${item.id}`}><button onClick={()=>setSelected(item)}>{item.title}</button> · {item.sourceLabel}</li>)}</ul>
 </section>;
}
