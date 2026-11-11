import React,{useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {Link} from 'wouter';
import {Copy,ExternalLink,LockKeyhole,RefreshCw,ShieldCheck,Trash2} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {experienceApi,type ExperienceInvite,type ExperienceRole} from '@/lib/experience-access';
import {demoInstitutionProfiles,type DemoInstitutionMode} from '@/lib/demo-showroom';
import MasterCommercialSuite from './MasterCommercialSuite';
import './master-commercial-suite.css';

const roleLabels:Record<ExperienceRole,string>={mantenedor:'Mantenedor',reitor:'Direção / dirigente',coordenador:'Coordenador de curso'};
const time=(x:string|null)=>x?new Date(x).toLocaleString('pt-BR'):'—';
export default function ExperienceAdmin({embedded=false}:{embedded?:boolean}={}){
 const [access,setAccess]=useState<'loading'|'ready'|'denied'>('loading');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [invites,setInvites]=useState<ExperienceInvite[]>([]),[link,setLink]=useState('');
 const [lastRecipient,setLastRecipient]=useState({name:'',email:''});
 const [email,setEmail]=useState(''),[name,setName]=useState('');
 const [mode,setMode]=useState<DemoInstitutionMode>('faculdade'),[role,setRole]=useState<ExperienceRole>('reitor'),[hours,setHours]=useState(72);
 const call=useCallback(async (action:string,data:Record<string,unknown>={})=>{
   const {data:session,error}=await supabase.auth.getSession();
   if(error||!session.session?.access_token)throw new Error('A sessão Master não está disponível. Entre novamente.');
   return experienceApi(action,data,session.session.access_token);
 },[]);
 const load=useCallback(async()=>{
   const data=await call('admin:list');setInvites((data.invitations??[]) as ExperienceInvite[]);
 },[call]);
 useEffect(()=>{
   let active=true;
   (async()=>{
     try{
       const {data:auth,error}=await supabase.auth.getUser();
       if(error||!auth.user||!auth.user.email_confirmed_at)throw new Error('auth');
       const mfa=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
       if(mfa.error||mfa.data.currentLevel!=='aal2')throw new Error('mfa');
       const check=await supabase.from('vertice_admins').select('user_id').eq('user_id',auth.user.id).limit(1);
       if(check.error||!check.data?.length)throw new Error('role');
       if(!active)return;
       await load();if(active)setAccess('ready');
     }catch{if(active)setAccess('denied');}
   })();
   return()=>{active=false;};
 },[load]);
 async function create(e:FormEvent){
   e.preventDefault();setBusy(true);setError('');setNotice('');setLink('');
   try{
     const result=await call('admin:create',{email:email.trim().toLowerCase(),name:name.trim(),mode,role,hours});
     setLink(result.link);setLastRecipient({name:name.trim(),email:email.trim().toLowerCase()});setNotice('Convite criado. O link é mostrado uma única vez e deve ser enviado diretamente ao destinatário. Nenhuma mensagem foi enviada automaticamente.');
     setEmail('');setName('');await load();
   }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function revoke(id:string,email:string){
   if(!window.confirm('Revogar o convite demonstrativo de '+email+'? A decisão interrompe futuros acessos.'))return;
   setBusy(true);setError('');setLink('');
   try{await call('admin:revoke',{id});await load();setNotice('Convite revogado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function copy(){if(!link)return;try{await navigator.clipboard.writeText(link);setNotice('Link copiado. Compartilhe somente com o destinatário autorizado.');}catch{setNotice('Selecione e copie manualmente o link no campo abaixo.');}}
 function exportCsv(){
   const header=['Destinatário','E-mail','Cenário','Perfil','Criado em','Expira em','Revogado em','Aberturas','Simulações salvas','Último acesso','Módulos explorados'];
   const safe=(x:unknown)=>{const value=String(x??'');const escaped=/^[=+@-]/.test(value)?"'"+value:value;return '"'+escaped.replaceAll('"','""')+'"';};
   const rows=invites.map(i=>[i.recipient_name,i.target_email,demoInstitutionProfiles[i.institution_type]?.name,i.experience_role,i.created_at,i.expires_at,i.revoked_at??'',i.opens,i.saves,i.last_opened_at??'',Object.entries(i.usage??{}).map(([k,v])=>k+':'+v).join(' | ')]);
   const csv='\uFEFF'+[header,...rows].map(row=>row.map(safe).join(';')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download='Vertice-Experience-Relatorio-Comercial.csv';anchor.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 const Frame: 'main'|'section' = embedded ? 'section' : 'main';
 const summary=useMemo(()=>({
    total:invites.length,opened:invites.filter(i=>i.opens>0).length,
    active:invites.filter(i=>!i.revoked_at&&Date.parse(i.expires_at)>Date.now()).length,
    usage:invites.reduce((sum,i)=>sum+i.saves,0)
 }),[invites]);
 if(access==='loading')return <Frame className="corp-container corp-section" role="status"><h1>Verificando seu acesso Master…</h1></Frame>;
 if(access==='denied')return <Frame className="corp-container corp-section" style={{maxWidth:850,margin:'0 auto',padding:'45px 18px'}}>
   <span className="corp-eyebrow">VÉRTICE EXPERIENCE · ADMINISTRAÇÃO</span>
   <h1><LockKeyhole size={27} style={{verticalAlign:'middle'}}/> Acesso restrito ao Master</h1>
   <p>Esta página exige e-mail confirmado, autenticação multifator e autorização global de Master. Nenhum convite foi criado.</p>
   <Link href="/entrar" className="corp-button">Entrar ou confirmar segundo fator</Link>
 </Frame>;
 return <Frame id="convites-demonstrativos" className={embedded?"":"corp-container corp-section"} style={{maxWidth:1350,margin:'0 auto',padding:embedded?'18px 0 36px':'32px 18px 60px'}}>
   <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
     <div><span className="corp-eyebrow">VÉRTICE EXPERIENCE · MASTER</span><h1>Convites e inteligência comercial</h1><p>Ambientes fictícios por perfil, com validade, revogação e acompanhamento da visita.</p></div>
     {!embedded&&<Link href="/master" className="corp-button">Voltar ao painel Master<ExternalLink size={16}/></Link>}
   </header>
   <nav aria-label="Cenários públicos para demonstrar" style={{display:"flex",flexWrap:"wrap",gap:10,margin:"16px 0"}}>
    <a className="corp-button small" href="/demonstracao?perfil=faculdade" target="_blank" rel="noopener noreferrer">Prévia Faculdade <ExternalLink size={14}/></a>
    <a className="corp-button small" href="/demonstracao?perfil=centro" target="_blank" rel="noopener noreferrer">Prévia Centro Universitário <ExternalLink size={14}/></a>
    <a className="corp-button small" href="/demonstracao?perfil=universidade" target="_blank" rel="noopener noreferrer">Prévia Universidade <ExternalLink size={14}/></a>
   </nav>
   <MasterCommercialSuite mode={mode} name={name||lastRecipient.name} email={email||lastRecipient.email} verticeInvite={link}
      onCreateVertice={()=>document.getElementById('vertice-invite-form')?.scrollIntoView({behavior:'smooth',block:'center'})}/>
   <div className="ds-kpis" style={{margin:'25px 0'}}>
     <article className="ds-metric"><span>Convites cadastrados</span><strong>{summary.total}</strong><small>Últimos 100 registros</small></article>
     <article className="ds-metric"><span>Convites ativos</span><strong>{summary.active}</strong><small>Não expirados nem revogados</small></article>
     <article className="ds-metric"><span>Convites visitados</span><strong>{summary.opened}</strong><small>Abertos ao menos uma vez</small></article>
     <article className="ds-metric"><span>Interações salvas</span><strong>{summary.usage}</strong><small>Somente em cenários fictícios</small></article>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:20,alignItems:'start'}}>
     <section className="ds-card" style={{padding:22}}>
       <h2 style={{marginTop:0}}>Gerar convite comercial</h2>
       <p>Envie acesso à Faculdade, Centro Universitário ou Universidade Vértice sem conceder acesso a dados de clientes.</p>
       <form id="vertice-invite-form" onSubmit={create} style={{display:'grid',gap:13,scrollMarginTop:110}}>
         <label>Nome do destinatário (opcional)<input value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Ex.: dirigente convidado"/></label>
         <label>E-mail do destinatário<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="gestor@instituicao.edu.br"/></label>
         <label>Organização acadêmica<select value={mode} onChange={e=>setMode(e.target.value as DemoInstitutionMode)}>
          {(['faculdade','centro','universidade'] as DemoInstitutionMode[]).map(k=><option key={k} value={k}>{demoInstitutionProfiles[k].name}</option>)}
         </select></label>
         <label>Trilha do visitante<select value={role} onChange={e=>setRole(e.target.value as ExperienceRole)}>
          {(['mantenedor','reitor','coordenador'] as ExperienceRole[]).map(k=><option key={k} value={k}>{roleLabels[k]}</option>)}
         </select></label>
         <label>Validade<select value={hours} onChange={e=>setHours(Number(e.target.value))}>
           <option value={24}>24 horas</option><option value={72}>3 dias</option><option value={168}>7 dias</option><option value={336}>14 dias</option>
         </select></label>
         <button className="corp-button" disabled={busy||!email.trim()} type="submit">{busy?'Registrando…':'Criar convite temporário'}</button>
       </form>
       {link&&<section style={{marginTop:22,overflowWrap:'anywhere'}}>
        <h3>Link confidencial — disponível somente agora</h3>
        <textarea rows={4} readOnly value={link} onFocus={e=>e.currentTarget.select()} style={{width:'100%'}}/>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="corp-button" type="button" onClick={()=>void copy()}><Copy size={16}/> Copiar link</button>
          <button className="demo-link-button" type="button" onClick={()=>setLink('')}>Ocultar</button>
        </div>
       </section>}
       <p style={{fontSize:13,marginTop:18}}><ShieldCheck size={16} style={{verticalAlign:'middle'}}/> O link concede acesso apenas à demonstração. A identidade de quem abrir o link não é verificada por OTP nesta versão; o destinatário deverá recebê-lo por canal seguro.</p>
     </section>
     <section className="ds-card" style={{padding:22}}>
       <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><h2 style={{marginTop:0}}>Visitas e desempenho</h2><button type="button" className="demo-link-button" disabled={busy} onClick={()=>{setBusy(true);void load().catch(e=>setError(e.message)).finally(()=>setBusy(false));}}><RefreshCw size={15}/> Atualizar</button></div>
       <p>Visão comercial por convite: o que foi explorado, quantas alterações fictícias foram realizadas e quais módulos despertaram interesse.</p>
       <button type="button" className="demo-link-button" disabled={!invites.length} onClick={exportCsv}>Exportar relatório CSV</button>
       {!invites.length&&<p>Não há convites registrados neste ambiente.</p>}
       <div className="table-scroll"><table><thead><tr><th>Destinatário / cenário</th><th>Visitas</th><th>Utilização</th><th>Situação</th><th>Ação</th></tr></thead><tbody>
        {invites.map(x=>{
         const expired=Date.parse(x.expires_at)<=Date.now();
         const usage=Object.entries(x.usage??{}).filter(([k])=>k!=='opened'&&k!=='save').sort((a,b)=>b[1]-a[1]).slice(0,3);
         return <tr key={x.id}><td><strong>{x.recipient_name||x.target_email}</strong><small style={{display:'block'}}>{x.target_email}</small><small style={{display:'block'}}>{demoInstitutionProfiles[x.institution_type]?.name||x.institution_type} · {roleLabels[x.experience_role]}</small><small style={{display:'block'}}>Até {time(x.expires_at)}</small></td>
           <td>{x.opens}</td><td>{x.saves} alterações<small style={{display:'block'}}>{usage.length?usage.map(([k,n])=>k+' ('+n+')').join(', '):'Sem navegação registrada'}</small></td>
           <td>{x.revoked_at?'Revogado':expired?'Expirado':'Ativo'}</td>
           <td>{!x.revoked_at&&!expired&&<button type="button" disabled={busy} className="demo-link-button" onClick={()=>void revoke(x.id,x.target_email)}><Trash2 size={15}/> Revogar</button>}</td>
         </tr>;
        })}
       </tbody></table></div>
       <p style={{fontSize:12}}>As métricas são dados de utilização do convite, não representam identidade verificada, intenção de compra ou resultado de negócio. Os módulos apresentados pertencem à janela recente de eventos.</p>
     </section>
   </div>
   {error&&<p role="alert" style={{color:'#ad2634',marginTop:20}}>{error}</p>}
   {notice&&<p role="status" style={{marginTop:20}}>{notice}</p>}
 </Frame>;
}
