import {useLearningDemoFeed} from '@/lib/learning-demo-feed';
import {useState} from 'react';
import PremiumBI from '@/components/bi/PremiumBI';
import {demoInstitutionCourses,demoInstitutionProfiles,type DemoInstitutionMode} from '@/lib/demo-showroom';

const MODES:DemoInstitutionMode[]=['faculdade','centro','universidade'];
function readMode():DemoInstitutionMode{
 if(typeof window==='undefined')return 'faculdade';
 const p=new URLSearchParams(window.location.search);
 const raw=p.get('porte')||p.get('perfil');
 return raw==='centro'||raw==='universidade'?raw:'faculdade';
}
export default function PremiumBIPublic(){
 const [mode,setMode]=useState<DemoInstitutionMode>(readMode);
 const {feed,status}=useLearningDemoFeed(mode);
 const courses=demoInstitutionCourses(mode);
 function select(next:DemoInstitutionMode){
  setMode(next);
  const url=new URL(window.location.href);
  url.searchParams.delete('perfil');
  url.searchParams.set('porte',next);
  window.history.replaceState(window.history.state,'',url.pathname+url.search);
 }
 return <main className="corp-container" style={{maxWidth:1650,paddingTop:22,paddingBottom:55}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:20}}>
   <div>
    <span className="corp-eyebrow">ACESSO LIVRE • VÉRTICE EDUCAÇÃO SUPERIOR</span>
    <h1 style={{margin:'8px 0 5px',fontSize:'clamp(27px,4vw,43px)'}}>BI Executivo Premium Demonstrativo</h1>
    <p style={{margin:0,maxWidth:850,color:'#536175'}}>Explore os indicadores como um gestor: toque nas barras, selecione cursos, compare semestres ou ative o Modo TV. Não é necessário cadastrar-se.</p>
   </div>
   <a href="/demonstracao" className="corp-button" style={{textDecoration:'none'}}>Conhecer a experiência completa da Vértice</a>
  </div>
  <div role="note" style={{background:'#ecf1f9',border:'1px solid #a1b8d9',borderRadius:12,padding:'13px 16px',marginBottom:15,color:'#284165'}}>
    <strong>Ambiente comercial sem senha: dados 100% fictícios.</strong> Nenhuma informação real de estudantes, docentes, instituições clientes ou processos do MEC é exibida aqui.
  </div>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:18}}>
   {MODES.map(m=><button key={m} type="button" aria-pressed={m===mode} onClick={()=>select(m)} style={{
     padding:'11px 17px',borderRadius:10,border:m===mode?'2px solid #08397e':'1px solid #bac6d6',
     background:m===mode?'#0c3c7f':'white',color:m===mode?'white':'#284062',
     fontWeight:800,cursor:'pointer'
   }}>{demoInstitutionProfiles[m].name}</button>)}
  </div>
  <PremiumBI key={mode} mode={mode} courses={courses} foFeed={feed} initialPage={typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('area')==='aprendizagem'?'aprendizagem':'overview'}/>
  <p role="status" style={{fontSize:12,color:'#606e81',marginTop:14}}>{status}</p>
  <p style={{fontSize:12,color:'#606e81'}}>Para acessar os indicadores reais de uma instituição contratante, é necessária autenticação e autorização institucional. Esta apresentação não abre áreas administrativas.</p>
 </main>;
}
