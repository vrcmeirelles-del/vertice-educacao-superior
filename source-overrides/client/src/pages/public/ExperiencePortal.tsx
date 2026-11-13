import { HelpLabel } from '@/components/ContextHelp';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'wouter';
import {ArrowRight,CheckCircle2,Clock,Eye,LockKeyhole,ShieldCheck} from 'lucide-react';
import DemoShowroom from '@/components/DemoShowroom';
import {demoInstitutionProfiles} from '@/lib/demo-showroom';
import {clearExperienceCredential,guestExperience,readExperienceCredential,type DemoSnapshot,type ExperienceAccess,type ExperienceCredential,type ExperienceRole} from '@/lib/experience-access';

const roles:Record<ExperienceRole,{title:string;guide:string;start:string}>={
 diretor_escola:{title:'Percurso da direção escolar',guide:'Explore os indicadores e prioridades da escola fictícia.',start:'Comece pelos módulos demonstrativos da escola.'},
 mantenedor:{title:'Percurso do mantenedor',guide:'Investigue a sustentabilidade econômica, a expansão e os riscos regulatórios.',start:'Comece por EBITDA e cenários, depois aquisições e visão executiva.'},
 reitor:{title:'Percurso da Direção',guide:'Compare cursos, entenda as prioridades institucionais e o acompanhamento das metas.',start:'Comece pela visão executiva, avance para o BI acadêmico e a governança CPA/NDE.'},
 coordenador:{title:'Percurso da coordenação',guide:'Observe a evolução dos cursos, aprendizagem, evidências e planos de melhoria.',start:'Comece em Cursos e indicadores, depois ENADE e aprendizagem e Regulação e evidências.'},
};
const date=(d:string)=>new Date(d).toLocaleString('pt-BR');
export default function ExperiencePortal(){
 const [credential,setCredential]=useState<ExperienceCredential|null>(null);
 const [access,setAccess]=useState<ExperienceAccess|null>(null);
 const [initial,setInitial]=useState<Partial<DemoSnapshot>>({});
 const [loading,setLoading]=useState(true),[entryConsent,setEntryConsent]=useState(false),[error,setError]=useState(''),[saveState,setSaveState]=useState(''),[help,setHelp]=useState('');
 const queue=useRef<Promise<unknown>>(Promise.resolve());
 useEffect(()=>{setCredential(readExperienceCredential());setLoading(false);},[]);
 async function enter(){
   if(!credential||!entryConsent)return;
   setLoading(true);setError('');
   try{
     const result=await guestExperience('guest:open',credential);
     setAccess(result.experience as ExperienceAccess);setInitial((result.state??{}) as Partial<DemoSnapshot>);
   }catch(e){setError((e as Error).message);clearExperienceCredential();setCredential(null);}
   finally{setLoading(false);}
 }
 const save=useCallback((snapshot:DemoSnapshot)=>{
  if(!credential||!access)return;
  setSaveState('Salvando seu cenário fictício…');
  const work=queue.current.catch(()=>undefined).then(()=>guestExperience('guest:save',credential,{state:snapshot}));
  queue.current=work;
  void work.then(()=>setSaveState('Progresso fictício salvo: evidências, metas, premissas e navegação.')).catch(e=>setSaveState('Não foi possível salvar: '+e.message));
 },[credential,access]);
 const visit=useCallback((module:string)=>{
  if(!credential)return;
  void guestExperience('guest:module',credential,{module}).catch(()=>setSaveState('A visita foi aberta, mas um registro de navegação não pôde ser confirmado.'));
 },[credential]);
 function leave(){clearExperienceCredential();setCredential(null);setAccess(null);setHelp('');setError('');setSaveState('');}
 if(loading)return <main className="corp-container corp-section" role="status"><h1>Verificando seu convite Vértice Experience…</h1><p>Acesso exclusivamente ao ambiente fictício.</p></main>;
 if(!access)return <main className="corp-container corp-section" style={{maxWidth:850,margin:'0 auto',padding:'48px 20px'}}>
   <span className="corp-eyebrow">VÉRTICE EXPERIENCE</span><h1>Convite de demonstração</h1>
   {credential&&!error?<section className="ds-card" style={{padding:24,marginTop:24}}>
    <h2 style={{marginTop:0}}>Seu acesso demonstrativo está disponível</h2>
    <p>Antes de entrar, saiba que o cenário contém apenas dados fictícios. O Master terá acesso à quantidade de visitas, aos módulos explorados e às alterações fictícias salvas. Nenhum documento verdadeiro deve ser enviado.</p>
    <p>O link funciona como uma chave temporária: qualquer pessoa que o receba poderá utilizá-lo. Não há verificação de identidade por e-mail nesta versão.</p>
    <HelpLabel style={{display:'flex',alignItems:'flex-start',gap:10,margin:'18px 0'}}><input type="checkbox" checked={entryConsent} onChange={e=>setEntryConsent(e.target.checked)} style={{marginTop:5}}/><span>Li as informações acima e concordo em iniciar a experiência demonstrativa com registro de utilização.</span></HelpLabel>
    <button className="corp-button" type="button" disabled={!entryConsent} onClick={()=>void enter()}>Entrar na Vértice Experience<ArrowRight size={16}/></button>
   </section>:<><p role={error?'alert':undefined}>{error||'Para entrar neste ambiente, abra o link temporário compartilhado pela equipe Vértice.'}</p>
   <p>O acesso demonstrativo comum continua disponível sem cadastro, com exemplos fictícios.</p>
   <Link href="/demonstracao" className="corp-button">Explorar demonstração pública<ArrowRight size={16}/></Link></>}
 </main>;
 const institution=demoInstitutionProfiles[access.mode],role=roles[access.role];
 return <main className="corp-container corp-section" style={{maxWidth:1500,margin:'0 auto',padding:'24px 16px 56px'}}>
   <header style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'center',flexWrap:'wrap',paddingBottom:20}}>
    <div><span className="corp-eyebrow">VÉRTICE EXPERIENCE · AMBIENTE RESERVADO</span><h1 style={{margin:'8px 0'}}>{institution.name}</h1>
    <p style={{margin:0}}>{access.name?access.name+' · ':''}{role.title} · <strong>Dados 100% fictícios</strong></p></div>
    <button type="button" className="demo-link-button" onClick={leave}>Encerrar esta visita</button>
   </header>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginBottom:24}}>
    <article className="ds-card"><strong><ShieldCheck size={17} style={{verticalAlign:'middle'}}/> Simulação segregada</strong><p>Não há alunos, instituições ou dados financeiros reais neste ambiente.</p></article>
    <article className="ds-card"><strong><Clock size={17} style={{verticalAlign:'middle'}}/> Prazo do convite</strong><p>Até {date(access.expires_at)}. O Master poderá revogar o acesso antes disso.</p></article>
    <article className="ds-card"><strong><Eye size={17} style={{verticalAlign:'middle'}}/> Atividades demonstrativas</strong><p>Os módulos visitados e as alterações fictícias são registrados para acompanhamento comercial.</p></article>
   </div>
   <section className="ds-card" style={{marginBottom:24,padding:22}}>
     <h2 style={{fontSize:'1.25rem',margin:'0 0 8px'}}>{role.title}</h2>
     <p style={{margin:'0 0 8px'}}>{role.guide}</p>
     <strong>{role.start}</strong>
   </section>
   {help&&<section className="ds-card" role="status" style={{marginBottom:22,padding:18}}>
     <strong>Sobre esta área</strong><p>{help}</p>
     <button type="button" className="demo-link-button" onClick={()=>setHelp('')}>Fechar explicação</button>
   </section>}
   <DemoShowroom mode={access.mode} savedState={initial} onSave={save} onNavigate={visit}
     assistLabel="Explicar recurso"
     onExplore={()=>{}} onAsk={setHelp} onContact={()=>{window.location.href='/contato';}}/>
   {saveState&&<p role="status" style={{marginTop:18}}><CheckCircle2 size={17} style={{verticalAlign:'middle'}}/> {saveState}</p>}
   <p style={{marginTop:24,fontSize:13}}><LockKeyhole size={16} style={{verticalAlign:'middle'}}/> O link é confidencial: qualquer pessoa que o receba poderá utilizá-lo até sua expiração ou revogação. Não insira dados de alunos, funcionários, documentos verdadeiros nem informações sigilosas. Esta experiência não é uma avaliação MEC/INEP.</p>
 </main>;
}
