import React,{useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {demoInstitutionProfiles,type DemoCourse,type DemoInstitutionMode} from '@/lib/demo-showroom';


export type BiPage='overview'|'matriculas'|'reprovacoes'|'captacao'|'regulacao'|'aprendizagem';
type Term='2025/1'|'2025/2'|'2026/1'|'2026/2'|'2027/1';
type Feed={origin:string;kind:string;synthetic:boolean;summary:{students:number;courses:number;exam:number|null;engagement:number|null};courses:Array<{id:string;name:string;students:number;exam:number|null}>};
type Props={mode:DemoInstitutionMode;courses:DemoCourse[];foFeed?:Feed|null};
type Row={id:string;name:string;students:number;capacity:number;occupancy:number;score:number;note:number;absence:number;risk:number;growth:number;participation:number};
const PAGES:{id:BiPage;label:string;icon:string}[]=[
 {id:'overview',label:'Visão Geral',icon:'◈'},{id:'matriculas',label:'Matrículas',icon:'▥'},
 {id:'reprovacoes',label:'Reprovações',icon:'▤'},{id:'captacao',label:'Captação',icon:'◎'},
 {id:'regulacao',label:'Regulação',icon:'◇'},{id:'aprendizagem',label:'Aprendizagem',icon:'↗'}
];
const TERMS:Term[]=['2025/1','2025/2','2026/1','2026/2','2027/1'];
const FACTOR:Record<Term,number>={'2025/1':0.82,'2025/2':0.87,'2026/1':0.92,'2026/2':1,'2027/1':1.08};
const fmt=(x:number)=>Math.round(x).toLocaleString('pt-BR');
const pct=(x:number)=>x.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const hash=(s:string)=>Array.from(s).reduce((n,c)=>(n*31+c.charCodeAt(0))%7919,17);
const bound=(x:number)=>Math.max(0,Math.min(100,x));
export function premiumRows(courses:DemoCourse[],term:Term):Row[]{
 return courses.map(c=>{
  const seed=hash(c.id),n=Math.round(c.students*FACTOR[term]);
  return {id:c.id,name:c.name,students:n,capacity:c.capacity,
   occupancy:c.capacity?n/c.capacity*100:0,score:45+seed%36,
   note:4.8+(seed%62)/10,absence:1.5+(seed%32)/10,
   risk:6.4+(seed%110)/10,growth:7+seed%23,participation:55+seed%34};
 });
}
export function premiumSummary(rows:Row[]){
 const n=rows.reduce((a,c)=>a+c.students,0);
 const avg=(k:keyof Row)=>n?rows.reduce((a,c)=>a+c.students*Number(c[k]),0)/n:0;
 return {students:n,courses:rows.length,capacity:rows.reduce((a,c)=>a+c.capacity,0),
  occupancy:avg('occupancy'),note:avg('note'),absence:avg('absence'),risk:avg('risk'),
  score:avg('score'),participation:avg('participation')};
}
function Card({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}){
 return <section className="vp-card"><header><h3>{title}</h3><p>{subtitle}</p></header>{children}</section>;
}
function Bars({rows,onClick,tone='teal'}:{rows:Array<{id:string;name:string;value:number}>;onClick:(id:string)=>void;tone?:string}){
 return <div className="vp-bars">{rows.map(r=><button type="button" className="vp-bar" key={r.id} onClick={()=>onClick(r.id)}>
  <span>{r.name}</span><span className="vp-track"><i className={'vp-fill '+tone} style={{width:String(bound(r.value))+'%'}}/></span><strong>{pct(r.value)}</strong>
 </button>)}</div>;
}
function Timeline({labels,values,onSelect}:{labels:string[];values:number[];onSelect:(i:number)=>void}){
 const high=Math.max(...values,1)*1.1;
 const pos=values.map((v,i)=>({x:40+i*475/(values.length-1),y:184-v/high*142}));
 const line=pos.map(p=>p.x+','+p.y).join(' ');
 return <svg className="vp-line" viewBox="0 0 555 218" role="img" aria-label={labels.map((v,i)=>v+': '+fmt(values[i])).join('; ')}>
  {[0,1,2,3,4].map(i=><line key={i} x1="34" x2="525" y1={184-i*35} y2={184-i*35} stroke="#e4eeee"/>)}
  <polygon points={'40,184 '+line+' 515,184'} fill="#20bdad2d"/>
  <polyline points={line} fill="none" stroke="#0a8d82" strokeWidth="4" strokeLinecap="round"/>
  {pos.map((p,i)=><g key={i} role="button" tabIndex={0} aria-label={'Abrir '+labels[i]} onClick={()=>onSelect(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(i);}}}>
   <circle cx={p.x} cy={p.y} r="6" fill="#099f8f" stroke="white" strokeWidth="2"/><title>{labels[i]+': '+fmt(values[i])}</title></g>)}
  {pos.map((p,i)=><text key={i} x={p.x} y="207" textAnchor="middle" fill="#6b8387" fontSize="12">{labels[i]}</text>)}
 </svg>;
}
export default function PremiumBI({mode,courses,foFeed}:Props){
 const [page,setPage]=useState<BiPage>('overview'),[term,setTerm]=useState<Term>('2026/2');
 const [course,setCourse]=useState('all'),[compare,setCompare]=useState<'year'|'previous'>('year');
 const [detail,setDetail]=useState<{title:string;description:string}|null>(null);
 const [tv,setTv]=useState(false),[paused,setPaused]=useState(false),[speed,setSpeed]=useState(15000);
 const host=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{setCourse('all');},[mode]);
 const full=useMemo(()=>premiumRows(courses,term),[courses,term]);
 const rows=useMemo(()=>full.filter(c=>course==='all'||c.id===course),[full,course]);
 const totals=useMemo(()=>premiumSummary(rows),[rows]);
 const baseCourse=courses.filter(c=>course==='all'||c.id===course);
 const timeline=TERMS.map(t=>premiumRows(baseCourse,t).reduce((a,c)=>a+c.students,0));
 const previous=compare==='year'?TERMS.find(t=>Number(t.slice(0,4))===Number(term.slice(0,4))-1&&t.endsWith(term.slice(-1))):TERMS[TERMS.indexOf(term)-1];
 const previousCount=previous?premiumRows(baseCourse,previous).reduce((a,c)=>a+c.students,0):0;
 const growth=previousCount?100*(totals.students-previousCount)/previousCount:null;
 const biggest=rows.slice().sort((a,b)=>b.students-a.students).slice(0,7);
 const risk=rows.slice().sort((a,b)=>b.risk-a.risk).slice(0,7);
 const foValid=foFeed?.origin==='fato-e-ordem'&&foFeed.kind==='synthetic_demo'&&foFeed.synthetic===true&&foFeed.courses.length===courses.length;
 const detailOf=(title:string,description:string)=>setDetail({title,description:description+' Todos os números desta experiência são fictícios; não constituem resultados de clientes ou exames oficiais.'});
 const chooseCourse=(id:string)=>{const c=rows.find(r=>r.id===id);if(!c)return;setCourse(id);detailOf(c.name,'Matrículas: '+fmt(c.students)+'. Reprovação por nota: '+pct(c.note)+'. Por falta: '+pct(c.absence)+'. Risco ilustrativo: '+pct(c.risk)+'.');};
 useEffect(()=>{if(!tv||paused)return;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')setPage(p=>PAGES[(PAGES.findIndex(v=>v.id===p)+1)%PAGES.length].id);},speed);return()=>clearInterval(timer);},[tv,paused,speed]);
 useEffect(()=>{const invisible=()=>{if(document.hidden)setPaused(true);};const closed=()=>{if(!document.fullscreenElement&&tv)setTv(false);};document.addEventListener('visibilitychange',invisible);document.addEventListener('fullscreenchange',closed);return()=>{document.removeEventListener('visibilitychange',invisible);document.removeEventListener('fullscreenchange',closed);};},[tv]);
 const enterTv=async()=>{setTv(true);setPaused(false);try{await host.current?.requestFullscreen?.();}catch{}};
 const exitTv=async()=>{setTv(false);if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}};
 const move=(step:number)=>setPage(p=>PAGES[(PAGES.findIndex(v=>v.id===p)+step+PAGES.length)%PAGES.length].id);
 const stats=[
  {label:'Matrículas ativas',value:fmt(totals.students),icon:'♟',note:rows.length+' cursos fictícios'},
  {label:'Variação no período',value:growth==null?'N/D':(growth>0?'+':'')+pct(growth),icon:'◎',note:'Comparação '+(previous||'indisponível')},
  {label:'Reprovação por nota',value:pct(totals.note),icon:'▤',note:'Taxa hipotética'},
  {label:'Reprovação por falta',value:pct(totals.absence),icon:'⚑',note:'Taxa hipotética'}
 ];
 const kpis=<div className="vp-kpis">{stats.map((r,i)=><button type="button" className={'vp-kpi shade-'+i} key={r.label} onClick={()=>detailOf(r.label,'Valor '+r.value+'. '+r.note+'.')}><span className="vp-icon">{r.icon}</span><span>{r.label}</span><strong>{r.value}</strong><small>{r.note}</small></button>)}</div>;
 const tchart=<Timeline labels={TERMS} values={timeline} onSelect={i=>{setTerm(TERMS[i]);detailOf('Matrículas '+TERMS[i],fmt(timeline[i])+' matrículas no cenário simulado.');}}/>;
 const stacked=<div className="vp-stacked">{TERMS.map(t=>{
  const v=premiumSummary(premiumRows(baseCourse,t)),whole=v.note+v.absence;
  return <button key={t} type="button" onClick={()=>{setTerm(t);setPage('reprovacoes');detailOf('Reprovações '+t,pct(v.note)+' por nota e '+pct(v.absence)+' por falta.');}}>
   <strong>{pct(whole)}</strong><span className="vp-column" style={{height:String(Math.max(46,whole*9))+'px'}}><i style={{height:String(whole?v.note/whole*100:0)+'%'}}/><b style={{height:String(whole?v.absence/whole*100:0)+'%'}}/></span><small>{t}</small>
  </button>;
 })}</div>;
 const table=<div className="vp-table-scroll"><table className="vp-table"><thead><tr><th>Curso</th><th>Matrículas</th><th>Ocupação</th><th>Nota</th><th>Falta</th><th>Detalhes</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} tabIndex={0} role="button" onClick={()=>chooseCourse(r.id)} onKeyDown={e=>{if(e.key==='Enter')chooseCourse(r.id);}}><td>{r.name}</td><td>{fmt(r.students)}</td><td>{pct(r.occupancy)}</td><td>{pct(r.note)}</td><td>{pct(r.absence)}</td><td>Ver ›</td></tr>)}</tbody></table></div>;
 return <div className={'vp-bi'+(tv?' tv':'')} ref={host} aria-label={'BI Premium: '+demoInstitutionProfiles[mode].name}>
  <header className="vp-top"><div><span>VÉRTICE EDUCAÇÃO SUPERIOR • INTELIGÊNCIA EXECUTIVA</span><h2>BI Premium <em>Interativo</em></h2><p>{demoInstitutionProfiles[mode].name}</p></div><div className="vp-top-controls"><strong>DADOS FICTÍCIOS • DEMONSTRAÇÃO</strong><button type="button" onClick={()=>void enterTv()}>▣ Modo TV</button></div></header>
  <nav className="vp-tabs" aria-label="Áreas do BI">{PAGES.map(p=><button key={p.id} aria-current={page===p.id?'page':undefined} type="button" onClick={()=>setPage(p.id)}>{p.icon} {p.label}</button>)}</nav>
  <div className="vp-filters"><label>Semestre<select value={term} onChange={e=>setTerm(e.target.value as Term)}>{TERMS.map(t=><option key={t}>{t}</option>)}</select></label>
  <label>Curso<select value={course} onChange={e=>setCourse(e.target.value)}><option value="all">Todos os cursos</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <label>Comparar com<select value={compare} onChange={e=>setCompare(e.target.value as 'year'|'previous')}><option value="year">Mesmo semestre do ano anterior</option><option value="previous">Semestre anterior</option></select></label>
  <button type="button" onClick={()=>{setTerm('2026/2');setCourse('all');setCompare('year');setPage('overview');}}>Limpar filtros</button></div>
  {kpis}
  {(page==='overview'||page==='matriculas'||page==='captacao')&&<div className="vp-grid">
   <Card title="Matrículas por semestre" subtitle="Clique em um ponto para selecionar o período">{tchart}</Card>
   <Card title="Ocupação por curso" subtitle="Clique numa barra para abrir o curso"><Bars rows={biggest.map(r=>({id:r.id,name:r.name,value:r.occupancy}))} onClick={chooseCourse}/></Card>
  </div>}
  {(page==='overview'||page==='reprovacoes')&&<div className="vp-grid">
   <Card title="Reprovação por nota × falta" subtitle="Duas causas, uma análise; clique no semestre">{stacked}<p className="vp-hint">Verde: nota. Dourado: falta. Cenário sintético.</p></Card>
   <Card title="Risco de evasão" subtitle="Faixas hipotéticas, não predição estatística"><Bars rows={risk.map(r=>({id:r.id,name:r.name,value:r.risk}))} onClick={chooseCourse} tone="red"/></Card>
  </div>}
  {(page==='overview'||page==='matriculas'||page==='reprovacoes')&&<Card title="Cursos e indicadores" subtitle="Clique numa linha para detalhar os números do recorte">{table}</Card>}
  {page==='captacao'&&<div className="vp-grid">
   <Card title="Funil comercial ilustrativo" subtitle="Sem dados reais de campanhas">{[{label:'Interessados',value:Math.round(totals.students*1.85)},{label:'Inscrições',value:Math.round(totals.students*1.38)},{label:'Aprovados',value:Math.round(totals.students*1.13)},{label:'Matrículas',value:totals.students}].map((v,i)=><button className="vp-funnel" key={v.label} style={{width:String(100-i*14)+'%'}} onClick={()=>detailOf(v.label,fmt(v.value)+' pessoas fictícias no funil demonstrativo.')}>{v.label}<strong>{fmt(v.value)}</strong></button>)}</Card>
   <Card title="Captação por curso" subtitle="Ocupação de vagas, exclusivamente hipotética"><Bars rows={biggest.map(r=>({id:r.id,name:r.name,value:r.occupancy}))} onClick={chooseCourse}/></Card></div>}
  {page==='regulacao'&&<div className="vp-grid">
   <Card title="Painel MEC / INEP ilustrativo" subtitle="Não equivale a avaliação ou evidência regulatória">{[{label:'Revisados no cenário',value:rows.length*3},{label:'Em acompanhamento',value:rows.length*2},{label:'Pendentes',value:rows.length}].map((v,i)=><button className="vp-reg" key={v.label} onClick={()=>detailOf(v.label,fmt(v.value)+' itens documentais fictícios.') }><i className={'signal-'+i}/>{v.label}<strong>{fmt(v.value)}</strong></button>)}</Card>
   <Card title="Plano de ação 5W2H" subtitle="Clique para compreender a intervenção sugerida">{['Revisar indicadores por dimensão','Planejar acompanhamento pedagógico','Revisar estratégia de captação','Preparar evidências acadêmicas'].map((name,i)=><button className="vp-action" key={name} onClick={()=>detailOf(name,'Ação ilustrativa '+(i+1)+'. Responsável, prazo e orçamento dependem da análise institucional real.')}><span>{i+1}</span>{name}<small>Explorar ›</small></button>)}</Card></div>}
  {page==='aprendizagem'&&<div className="vp-grid">
   <Card title="Aprendizagem no Fato & Ordem" subtitle="Indicadores da API de cenário fictício, sem alunos reais">{foValid?<><div className="vp-fo"><strong>{fmt(foFeed!.summary.students)} alunos fictícios</strong><span>Aproveitamento: {foFeed!.summary.exam==null?'N/D':pct(foFeed!.summary.exam)}</span></div><Bars rows={foFeed!.courses.filter(x=>x.exam!==null).slice(0,8).map(x=>({id:x.id,name:x.name,value:Number(x.exam)}))} onClick={id=>detailOf('Trilha '+id,'Dados fictícios recebidos da API Fato & Ordem.')}/></>:<p className="vp-empty">O feed demonstrativo não foi confirmado. Nenhum número será apresentado como sincronizado.</p>}</Card>
   <Card title="Comparação sala × exercícios" subtitle="Escalas e competências distintas: sem inferência de causalidade"><Bars rows={rows.slice(0,8).map(r=>({id:r.id,name:r.name,value:r.score}))} onClick={chooseCourse}/><p className="vp-hint">Acertos são simulados e não representam nota oficial de exame.</p></Card></div>}
  {(page==='overview'||page==='aprendizagem')&&<div className="vp-grid"><Card title="Leituras rápidas do BI" subtitle="Clique para abrir o assunto">{[
    {name:'Onde cresce mais',copy:growth==null?'Comparativo indisponível':pct(growth)+' no cenário.',view:'matriculas' as BiPage},
    {name:'Onde investigar riscos',copy:risk[0]?.name||'Sem curso selecionado',view:'reprovacoes' as BiPage},
    {name:'Quais ações priorizar',copy:'Aprendizagem, permanência e qualidade.',view:'regulacao' as BiPage}
   ].map(x=><button className="vp-insight" key={x.name} onClick={()=>{setPage(x.view);detailOf(x.name,x.copy);}}><b>⚡</b><span><strong>{x.name}</strong><small>{x.copy}</small></span>›</button>)}</Card>
   <Card title="Interpretação responsável" subtitle="Não confundir demonstração com dados de clientes"><p className="vp-empty">Todos os números deste BI são fictícios. A comparação anual, as taxas de reprovação, o risco de evasão e os indicadores regulatórios não representam dados oficiais. Os BIs autenticados da Vértice continuam utilizando suas próprias fontes e regras de acesso.</p></Card></div>}
  {tv&&<div className="vp-tvbar"><strong>TV • {PAGES.find(p=>p.id===page)?.label}</strong><button type="button" onClick={()=>setPaused(!paused)}>{paused?'Retomar':'Pausar'}</button><button type="button" onClick={()=>move(-1)}>Anterior</button><button type="button" onClick={()=>move(1)}>Próxima</button><select aria-label="Rotação da TV" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={10000}>10 s</option><option value={15000}>15 s</option><option value={20000}>20 s</option><option value={30000}>30 s</option></select><button type="button" onClick={()=>void exitTv()}>Sair</button></div>}
  {detail&&<div className="vp-modal" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null);}}><div role="dialog" aria-modal="true" aria-label={detail.title}><button type="button" onClick={()=>setDetail(null)} aria-label="Fechar">×</button><span>DETALHAMENTO DO INDICADOR</span><h3>{detail.title}</h3><p>{detail.description}</p></div></div>}
 </div>;
}
