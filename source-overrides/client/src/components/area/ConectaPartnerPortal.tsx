import {useEffect,useRef,useState} from 'react';
import {ConectaForm} from './Conecta360';
import {conectaPublic,copyLink,publicLink} from '@/lib/conecta-public';
import type {FieldSpec} from '@/lib/conecta-fields';
import type {RecordRow} from '@/lib/conecta';
import {InstitutionAccessState,PublicInstitutionBoundary,usePublicInstitution} from '@/lib/public-institution';
import './conecta360.css';
export const partnerFields:FieldSpec[]=[
 {key:'name',label:'Nome da organização ou parceiro',required:true,min:3,max:250,help:'Nome institucional ou nome completo do parceiro.'},
 {key:'trade_name',label:'Nome fantasia',max:250,help:'Opcional. Nome pelo qual a organização é conhecida.'},
 {key:'partner_type',label:'Tipo de parceiro',kind:'select',required:true,options:[['empresa','Empresa'],['escritorio','Escritório'],['consultorio','Consultório'],['clinica','Clínica'],['organizacao','Organização'],['governo','Órgão público'],['ong','ONG'],['comunidade','Comunidade'],['pessoa_fisica','Pessoa física']],help:'Identifica o perfil de atuação. Não representa convênio firmado.'},
 {key:'identifier',label:'CNPJ ou CPF',required:true,max:20,help:'Obrigatório. Informe o CNPJ da organização ou o CPF do parceiro pessoa física. A gestão confere e concilia com os cadastros existentes antes de aprovar.'},
 {key:'contact_name',label:'Responsável pelo contato',required:true,min:3,max:250,help:'Pessoa que acompanhará a proposta junto à instituição.'},
 {key:'contact_email',label:'E-mail para contato',kind:'email',required:true,max:250,help:'Informe um e-mail válido para contato com a instituição.'},
 {key:'contact_phone',label:'Telefone / WhatsApp',kind:'tel',required:true,max:25,help:'Obrigatório. Informe DDD e telefone para contato.'},
 ...(['address','city','state','sector'] as const).map((key,i)=>({key,label:['Endereço','Cidade','Estado','Área de atuação'][i],required:true,max:key==='address'?1000:250,help:'Informação para análise e relacionamento com a instituição.'}))
];
export const proposalFields:FieldSpec[]=[
 {key:'kind',label:'Tipo de proposta',kind:'select',required:true,options:[['emprego','Vaga de emprego'],['estagio','Vaga de estágio'],['campo_estagio','Campo de estágio'],['evento','Evento'],['extensao','Projeto de extensão'],['formacao','Curso ou formação'],['mentoria','Mentoria'],['acao_institucional','Outra ação institucional']],help:'Campos de estágio e extensão passam também pela validação acadêmica do módulo de destino.'},
 {key:'title',label:'Título da proposta',required:true,min:3,max:250,help:'Nome da vaga, atividade, campo ou ação.'},
 {key:'description',label:'Descrição e condições',kind:'textarea',required:true,min:10,max:8000,help:'Informe atividades, público, requisitos, remuneração quando aplicável e condições de participação. Não inclua dados de candidatos.'},
 {key:'url',label:'Página de referência',kind:'url',max:1000,help:'Opcional. Use um endereço HTTPS.'},
 {key:'deadline',label:'Prazo para participação',kind:'date',help:'Opcional. Data limite para interesse ou inscrição.'},
 {key:'address',label:'Endereço da atividade',max:1000,help:'Local de execução ou informação de modalidade remota.'},
 {key:'area_of_practice',label:'Área de prática',max:1000,help:'Para campos de estágio, descreva a área de atuação oferecida.'},
 {key:'capacity',label:'Quantidade de vagas',kind:'number',help:'Opcional. Número inteiro positivo, até 100.000.'},
 {key:'start_date',label:'Início previsto',kind:'date',help:'Opcional. Data prevista para início da atividade.'},
 {key:'end_date',label:'Término previsto',kind:'date',help:'Opcional. Deve ser igual ou posterior ao início.'}
];
const status=(s:string)=>({pending:'Em análise',approved:'Aprovado pela gestão',rejected:'Não aprovado',suspended:'Suspenso'}[s]||s);
export default function ConectaPartnerPortal(){return <PublicInstitutionBoundary><PartnerAccess/></PublicInstitutionBoundary>;}
function PartnerAccess(){
 const identity=usePublicInstitution()!;
 return identity.status==='ready'?<PartnerContent key={identity.institutionId}/>:<InstitutionAccessState audience="partner"/>;
}
function PartnerContent(){
 const identity=usePublicInstitution()!;
 const params=new URLSearchParams(window.location.search),ies=identity.institutionId,urlToken=params.get('token')||'';
 const storageKey='vx-conecta-partner:'+ies;
 const [token,setToken]=useState(()=>{if(urlToken)return urlToken;try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');return saved&&Date.parse(saved.expires)>Date.now()?saved.token:'';}catch{return '';}}),[info,setInfo]=useState<{name:string;courses:RecordRow[]}|null>(null),[own,setOwn]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[link,setLink]=useState(''),[revision,setRevision]=useState(0);
 const registerId=useRef(crypto.randomUUID()),proposalId=useRef(crypto.randomUUID());
 const call=<T,>(action:string,payload:Record<string,unknown>={})=>conectaPublic<T>({action:'partner_'+action,institution_id:ies,token,payload});
 useEffect(()=>{let active=true;setInfo(null);setError('');conectaPublic<{name:string;courses:RecordRow[]}>({action:'partner_info',institution_id:ies}).then(v=>{if(active)setInfo(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[ies]);
 useEffect(()=>{let active=true;if(!token){setOwn(null);return;}setLink(publicLink('/conecta-parceiros',ies)+'&token='+token);window.history.replaceState(null,'', '/conecta-parceiros?ies='+encodeURIComponent(ies));
 call<any>('me').then(v=>{if(active){setOwn(v);sessionStorage.setItem(storageKey,JSON.stringify({token,expires:v.expires_at}));}}).catch(e=>{if(active){setOwn(null);sessionStorage.removeItem(storageKey);setError(e.message);}});return()=>{active=false;};},[ies,token,revision]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="conecta360" style={{maxWidth:1000,padding:20,margin:'24px auto'}}><header className="conecta-hero"><div><small>{identity.institution?.name||'Instituição'}</small><h2>Conecta · Empresas e parceiros</h2><p>Cadastre sua organização e proponha oportunidades e ações em parceria com a instituição.</p></div></header>
 {error&&<p role="alert" className="conecta-error">{error}</p>}{notice&&<p role="status" className="conecta-success">{notice}</p>}{!info&&!error&&<p role="status">Consultando instituição…</p>}
 {info&&!token&&<article className="conecta-card"><h2>Cadastrar parceiro</h2><p>O cadastro e cada proposta passam por análise institucional. O envio não firma convênio nem aprova estágio ou horas acadêmicas.</p><ConectaForm fields={partnerFields} busy={busy} submitLabel="Enviar cadastro e continuar" onSubmit={data=>run(async()=>{const r=await call<{token:string;access_link:string}>('register',{request_id:registerId.current,data});setLink(r.access_link);setToken(r.token);setNotice('Cadastro recebido. Guarde seu link pessoal para acompanhar as propostas durante 72 horas.');})}/></article>}
 {token&&<article className="conecta-card"><h2>Link pessoal do parceiro</h2><button disabled={busy} onClick={()=>run(async()=>{await call('logout');sessionStorage.removeItem(storageKey);setToken('');setOwn(null);setNotice('Acesso encerrado e link pessoal revogado.');})}>Sair e revogar este link</button><p>Guarde este endereço privado. Ele permite acompanhar e enviar propostas por 72 horas, contadas da emissão. {own?.expires_at&&'Válido até '+new Date(own.expires_at).toLocaleString('pt-BR')+'.'}</p><label>Seu link de acompanhamento<input value={link} readOnly/></label><button onClick={()=>copyLink(link).then(()=>setNotice('Link copiado.')).catch(()=>setError('Selecione e copie o endereço do campo.'))}>Copiar link pessoal</button></article>}
 {own&&info&&<><article className="conecta-card"><h2>{own.partner.data.name}</h2><p>Cadastro: {status(own.partner.status)}</p>{own.partner.review_note&&<p>Parecer: {own.partner.review_note}</p>}</article><article className="conecta-card"><h2>Enviar proposta</h2><ConectaForm key={revision} fields={[{key:'course_id',label:'Curso relacionado',kind:'select',options:[['','Instituição / vários cursos'],...info!.courses.map(c=>[c.id,c.name] as [string,string])],help:'Selecione o curso, quando a proposta for específica.'},...proposalFields]} busy={busy} submitLabel="Enviar para análise" onSubmit={values=>run(async()=>{await call('proposal',{...values,request_id:proposalId.current});proposalId.current=crypto.randomUUID();setRevision(n=>n+1);setNotice('Proposta recebida para análise da instituição.');})}/></article>
 <article className="conecta-card"><h2>Minhas propostas</h2>{!own.proposals.length&&<p>Nenhuma proposta enviada.</p>}{own.proposals.map((p:RecordRow)=><article key={p.id}><h3>{p.title}</h3><p>{status(p.status)} · {p.kind}</p>{p.review_note&&<p>Parecer: {p.review_note}</p>}</article>)}</article></>}
 </section>;
}
