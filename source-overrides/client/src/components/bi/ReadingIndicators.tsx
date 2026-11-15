import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import './reading-indicators.css';

type Action='displayed'|'opened'|'declared_read';
type Snapshot={
 ok:true;institutionId:string;educationTier:'superior'|'escolas';scope:'institution';
 periodDays:90;retrievedAt:string;indicators:{module:string;action:Action;total:number}[];
};
const ROLES=new Set(['master','reitor','gestor','diretor_geral','diretor_pedagogico','procurador']);
const LABELS:Record<string,string>={oab:'OAB 1ª fase',oab2:'OAB 2ª fase',carreiras:'Carreiras Jurídicas',cfc:'CFC',enade:'ENADE',enamed:'ENAMED',residencia:'Residência Médica',enem:'ENEM'};
const ACTIONS:Action[]=['displayed','opened','declared_read'];
const fmt=new Intl.NumberFormat('pt-BR');

export default function ReadingIndicators({institutionId,role,expectedTier,revision=0}:{
 institutionId:string;role:string|null;expectedTier?:'superior'|'escolas';revision?:number;
}){
 const [refresh,setRefresh]=useState(0);
 const [state,setState]=useState<{scope:string;data?:Snapshot;error?:string;loading:boolean}>({scope:'',loading:true});
 const sequence=useRef(0);
 const scope=[institutionId,role,expectedTier].join(':');
 const allowed=Boolean(institutionId&&role&&ROLES.has(role));
 useEffect(()=>{
  const current=++sequence.current;
  if(!allowed)return;
  setState({scope,loading:true});
  void (async()=>{
   try{
    const {data,error}=await supabase.functions.invoke('vertice-learning-bridge',{body:{operation:'reading_indicators',institutionId}});
    if(error||data?.error)throw new Error('Consulta de leituras indisponível. Verifique a sessão com MFA, a autorização institucional e a conexão com o Fato & Ordem.');
    // Guard the UI against stale, misrouted or incompatible responses as well.
    if(data?.ok!==true||data.institutionId!==institutionId||data.scope!=='institution'||data.periodDays!==90||
      !['superior','escolas'].includes(data.educationTier)||(expectedTier&&data.educationTier!==expectedTier)||
      !Array.isArray(data.indicators)||data.indicators.length>24||!Number.isFinite(Date.parse(data.retrievedAt)))
     throw new Error('Resposta de leitura incompatível com a instituição selecionada.');
    const seen=new Set<string>();
    for(const row of data.indicators){
     const key=row?.module+':'+row?.action;
     if(!row||!Object.hasOwn(LABELS,row.module)||((row.module==='enem')!==(data.educationTier==='escolas'))||
       !ACTIONS.includes(row.action)||!Number.isSafeInteger(row.total)||row.total<0||seen.has(key))
      throw new Error('Indicadores de leitura inválidos. Atualize a consulta.');
     seen.add(key);
    }
    if(current===sequence.current)setState({scope,loading:false,data:data as Snapshot});
   }catch(error){if(current===sequence.current)setState({scope,loading:false,error:error instanceof Error?error.message:'Consulta de leituras indisponível.'});}
  })();
  return()=>{sequence.current++;};
 },[institutionId,role,expectedTier,revision,refresh,allowed,scope]);
 if(!allowed)return <section className="reading-indicators"><h3>Leituras e aprofundamento</h3><p>Totais institucionais de leitura restritos à alta gestão autorizada. O contrato atual não fornece recorte por curso.</p></section>;
 const current=state.scope===scope?state:undefined;
 const snapshot=current?.data;
 const modules=snapshot?Object.keys(LABELS).filter(module=>snapshot.indicators.some(row=>row.module===module)):[];
 const total=(module:string,action:Action)=>snapshot?.indicators.find(row=>row.module===module&&row.action===action)?.total??0;
 return <section className="reading-indicators" aria-label="Leituras e aprofundamento institucional">
  <header><div><small>FATO & ORDEM · {snapshot?.educationTier==='escolas'?'VÉRTICE ESCOLAS':'INDICADORES INSTITUCIONAIS'}</small><h3>Leituras e aprofundamento</h3></div>
   <button type="button" className="corp-button small" disabled={!current||current.loading} onClick={()=>setRefresh(n=>n+1)}>Atualizar leituras</button></header>
  <p>Últimos 90 dias · instituição selecionada · vínculos verificados e não revogados na origem. Os filtros de curso, turma e semestre de outros painéis não se aplicam a estes totais.</p>
  <p role="note"><strong>Leitura autodeclarada não comprova aprendizagem.</strong> Exibições e aberturas são interações. Estes registros não alteram notas, acertos, rankings, domínio de competências ou resultados do Sapiens.</p>
  {(!current||current.loading)&&<p role="status">Consultando leituras autorizadas…</p>}
  {current?.error&&<p role="alert">{current.error} Nenhum total anterior é apresentado como atualizado.</p>}
  {snapshot&&<>
   <p className="reading-provenance">Fonte: Fato & Ordem · consultado em <time dateTime={snapshot.retrievedAt}>{new Date(snapshot.retrievedAt).toLocaleString('pt-BR')}</time>. Janela móvel de 90 dias calculada na origem; contagens de eventos, sem total de estudantes únicos.</p>
   {!modules.length?<p role="status">Nenhum evento de leitura disponível no recorte autorizado. Isso não comprova ausência de estudo.</p>:<div className="reading-scroll"><table><caption>Eventos de aprofundamento por módulo</caption><thead><tr><th scope="col">Módulo</th><th scope="col">Exibições</th><th scope="col">Aberturas</th><th scope="col">Leituras autodeclaradas</th></tr></thead><tbody>
    {modules.map(module=><tr key={module}><th scope="row">{LABELS[module]}</th>{ACTIONS.map(action=><td key={action}>{fmt.format(total(module,action))}</td>)}</tr>)}
   </tbody></table></div>}
   <p>Exibições podem incluir a apresentação do bloco e de referências. Ações não formam um funil de conversão nem equivalem a publicações ou leitores únicos. O contrato não permite relacionar estes totais a um curso, competência, intervenção ou causa de melhora no desempenho.</p>
  </>}
 </section>;
}
