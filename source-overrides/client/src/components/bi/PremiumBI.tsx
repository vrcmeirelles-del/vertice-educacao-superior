import React,{useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {demoInstitutionProfiles,type DemoCourse,type DemoInstitutionMode} from '@/lib/demo-showroom';

export type BiPage='overview'|'matriculas'|'reprovacoes'|'captacao'|'regulacao'|'aprendizagem';
type Term='2025/1'|'2025/2'|'2026/1'|'2026/2'|'2027/1';
type Feed={origin:string;kind:string;synthetic:boolean;summary:{students:number;courses:number;exam:number|null;engagement:number|null};courses:Array<{id:string;name:string;students:number;exam:number|null}>};
type Props={mode:DemoInstitutionMode;courses:DemoCourse[];foFeed?:Feed|null;initialPage?:BiPage};
type Row={id:string;name:string;students:number;capacity:number;occupancy:number;score:number;note:number;absence:number;risk:number;growth:number;participation:number};
const PAGES:{id:BiPage;label:string;icon:string}[]=[
 {id:'overview',label:'Visão Geral',icon:'⌂'},{id:'matriculas',label:'Matrículas',icon:'▥'},
 {id:'captacao',label:'Captação',icon:'◎'},{id:'reprovacoes',label:'Desempenho Acadêmico',icon:'▤'},
 {id:'regulacao',label:'Regulação (MEC/INEP)',icon:'◇'},{id:'aprendizagem',label:'Fato & Ordem',icon:'↗'}
];
const TERMS:Term[]=['2025/1','2025/2','2026/1','2026/2','2027/1'];
const FACTOR:Record<Term,number>={'2025/1':0.82,'2025/2':0.87,'2026/1':0.92,'2026/2':1,'2027/1':1.08};
const DECAY:Record<Term,number>={'2025/1':1.22,'2025/2':1.17,'2026/1':1.1,'2026/2':1.05,'2027/1':1};
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
function Card({title,subtitle,span,badge,children}:{title:string;subtitle:string;span?:number;badge?:ReactNode;children:ReactNode}){
 return <section className={'vp-card'+(span?' vp-span-'+span:'')}><header><h3>{title}</h3><p>{subtitle}</p>{badge}</header>{children}</section>;
}
function Timeline({labels,values,onSelect}:{labels:string[];values:number[];onSelect:(i:number)=>void}){
 const high=Math.max(...values,1)*1.1;
 const pos=values.map((v,i)=>({x:40+i*475/(values.length-1),y:184-v/high*142}));
 const line=pos.map(p=>p.x+','+p.y).join(' ');
 return <svg className="vp-line" viewBox="0 0 555 218" role="img" aria-label={labels.map((v,i)=>v+': '+fmt(values[i])).join('; ')}>
  {[0,1,2,3,4].map(i=><line key={i} x1="34" x2="525" y1={184-i*35} y2={184-i*35} stroke="#e4e8ee"/>)}
  <polygon points={'40,184 '+line+' 515,184'} fill="#2061bd2d"/>
  <polyline points={line} fill="none" stroke="#0a418d" strokeWidth="4" strokeLinecap="round"/>
  {pos.map((p,i)=><g key={i} role="button" tabIndex={0} aria-label={'Abrir '+labels[i]} onClick={()=>onSelect(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(i);}}}>
   <circle cx={p.x} cy={p.y} r="6" fill="#09489f" stroke="white" strokeWidth="2"/><title>{labels[i]+': '+fmt(values[i])}</title></g>)}
  {pos.map((p,i)=><text key={i} x={p.x} y="207" textAnchor="middle" fill="#6b7787" fontSize="12">{labels[i]}</text>)}
 </svg>;
}
function Donut({parts,center,label}:{parts:Array<{value:number;color:string;name:string}>;center:string;label:string}){
 const total=parts.reduce((a,c)=>a+c.value,0)||1;const R=58,C=2*Math.PI*R;let off=0;
 return <div className="vp-donut-wrap">
  <div className="vp-donut"><svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={label+': '+parts.map(p=>p.name+' '+pct(p.value/total*100)).join('; ')}>
   {parts.map((p,i)=>{const len=p.value/total*C,el=<circle key={i} cx="74" cy="74" r={R} fill="none" stroke={p.color} strokeWidth="21" strokeDasharray={len+' '+(C-len)} strokeDashoffset={-off} strokeLinecap="butt"/>;off+=len;return el;})}
  </svg><div className="vp-donut-center"><small>{label}</small><strong>{center}</strong></div></div>
  <div className="vp-donut-legend">{parts.map(p=><span key={p.name}><i style={{background:p.color}}/>{p.name} ({pct(p.value/total*100)})</span>)}</div>
 </div>;
}
export default function PremiumBI({mode,courses,foFeed,initialPage='overview'}:Props){
 const [page,setPage]=useState<BiPage>(initialPage),[term,setTerm]=useState<Term>('2026/2');
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
 const risk=rows.slice().sort((a,b)=>b.risk-a.risk).slice(0,5);
 const grow=rows.slice().sort((a,b)=>b.growth-a.growth).slice(0,5);
 const reg={ok:rows.length*3,warn:Math.max(1,Math.round(rows.length*0.8)),crit:Math.max(1,Math.round(rows.length*0.3))};
 const foValid=foFeed?.origin==='fato-e-ordem'&&foFeed.kind==='synthetic_demo'&&foFeed.synthetic===true&&foFeed.courses.length===courses.length;
 const detailOf=(title:string,description:string)=>setDetail({title,description:description+' Todos os números desta experiência são fictícios; não constituem resultados de clientes ou exames oficiais.'});
 const chooseCourse=(id:string)=>{const c=rows.find(r=>r.id===id)||full.find(r=>r.id===id);if(!c)return;setCourse(id);detailOf(c.name,'Matrículas: '+fmt(c.students)+'. Reprovação por nota: '+pct(c.note)+'. Por falta: '+pct(c.absence)+'. Risco ilustrativo: '+pct(c.risk)+'.');};
 useEffect(()=>{if(!tv||paused)return;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')setPage(p=>PAGES[(PAGES.findIndex(v=>v.id===p)+1)%PAGES.length].id);},speed);return()=>clearInterval(timer);},[tv,paused,speed]);
 useEffect(()=>{const invisible=()=>{if(document.hidden)setPaused(true);};const closed=()=>{if(!document.fullscreenElement&&tv)setTv(false);};document.addEventListener('visibilitychange',invisible);document.addEventListener('fullscreenchange',closed);return()=>{document.removeEventListener('visibilitychange',invisible);document.removeEventListener('fullscreenchange',closed);};},[tv]);
 const enterTv=async()=>{setTv(true);setPaused(false);try{await host.current?.requestFullscreen?.();}catch{}};
 const exitTv=async()=>{setTv(false);if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}};
 const move=(step:number)=>setPage(p=>PAGES[(PAGES.findIndex(v=>v.id===p)+step+PAGES.length)%PAGES.length].id);
 const riskTone=(v:number)=>v>=14?'red':v>=10?'gold':'';
 const stats=[
  {label:'Matrículas ativas',value:fmt(totals.students),icon:'👥',note:rows.length+' cursos fictícios no recorte'},
  {label:'Captação líquida',value:growth==null?'N/D':(growth>0?'+':'')+pct(growth),icon:'◎',note:'Comparação '+(previous||'indisponível')},
  {label:'Evasão projetada',value:pct(totals.risk*0.62),icon:'📈',note:'Cenário ilustrativo do recorte'},
  {label:'Reprovações',value:pct(totals.note+totals.absence),icon:'⚠',note:'Nota + falta no semestre'}
 ];
 const kpis=<div className="vp-kpis">{stats.map((r,i)=><button type="button" className={'vp-kpi shade-'+i} key={r.label} onClick={()=>detailOf(r.label,'Valor '+r.value+'. '+r.note+'.')}><span className="vp-icon">{r.icon}</span><span>{r.label}</span><strong>{r.value}</strong><small>{r.note}</small></button>)}</div>;
 const tchart=<Timeline labels={TERMS} values={timeline} onSelect={i=>{setTerm(TERMS[i]);detailOf('Matrículas '+TERMS[i],fmt(timeline[i])+' matrículas no cenário simulado.');}}/>;
 const stacked=<><div className="vp-stacked">{TERMS.map(t=>{
  const v=premiumSummary(premiumRows(baseCourse,t)),scale=DECAY[t]/DECAY[term],nota=v.note*scale,falta=v.absence*scale,whole=nota+falta;
  return <button key={t} type="button" onClick={()=>{setTerm(t);setPage('reprovacoes');detailOf('Reprovações '+t,pct(nota)+' por nota e '+pct(falta)+' por falta.');}}>
   <strong>{pct(whole)}</strong><span className="vp-column" style={{height:String(Math.max(52,whole*9))+'px'}}><b style={{height:String(whole?falta/whole*100:0)+'%'}}/><i style={{height:String(whole?nota/whole*100:0)+'%'}}/></span><small>{t}</small>
  </button>;
 })}</div><div className="vp-legend"><span><i style={{background:'#0c438f'}}/>Reprovação por nota</span><span><i style={{background:'#dfa42e'}}/>Reprovação por falta</span></div></>;
 const donut=<Donut label="Conformidade geral" center={pct(92)} parts={[
  {name:'Dimensão 1',value:64,color:'#1452a8'},{name:'Dimensão 2',value:24,color:'#e9b53a'},{name:'Dimensão 3',value:12,color:'#d84343'}]}/>;
 const mec=<div>{[
  {label:'Conformes / sem pendências',value:reg.ok},{label:'Em atenção / ajustes recomendados',value:reg.warn},{label:'Críticos / de alta prioridade',value:reg.crit}
 ].map((v,i)=><button className={'vp-reg s-'+i} key={v.label} type="button" onClick={()=>detailOf(v.label,fmt(v.value)+' itens documentais fictícios.')}><i className={'signal-'+i}/>{v.label}<strong>{fmt(v.value)}</strong></button>)}</div>;
 const growthChart=<div className="vp-growth">{grow.map(r=><button key={r.id} type="button" onClick={()=>chooseCourse(r.id)}>
  <strong>+{pct(r.growth)}</strong><i style={{height:String(26+r.growth*4.2)+'px'}}/><small>{r.name}</small></button>)}</div>;
 const riskTable=<div className="vp-risk"><div className="vp-risk-head"><span>Curso / Período</span><span>Risco de evasão</span><span/></div>
  {risk.map(r=><button key={r.id} type="button" onClick={()=>chooseCourse(r.id)}>
   <span>{r.name} – {term}</span><span className="vp-track"><i className={'vp-fill '+riskTone(r.risk)} style={{width:String(bound(r.risk*5.2))+'%'}}/></span><strong>{pct(r.risk)}</strong>
  </button>)}</div>;
 const plan=<div className="vp-table-scroll"><table className="vp-5w2h"><thead><tr><th/><th>Ação</th><th>O quê?</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead><tbody>{[
  {acao:'Reduzir evasão em cursos de maior risco',oque:'Implantar plano de permanência (tutoria, acompanhamento e bolsas)',resp:'Prograd',prazo:'31/03/'+term.slice(0,4),chip:'alta',status:'⚑ Prioritária'},
  {acao:'Ajustar indicadores do MEC / INEP',oque:'Plano de correções e evidências nas dimensões 2 e 3',resp:'Qualidade Acadêmica',prazo:'30/04/'+term.slice(0,4),chip:'andamento',status:'↻ Em andamento'},
  {acao:'Ampliar captação de matrículas',oque:'Campanha digital e ações com colégios parceiros',resp:'Marketing',prazo:'15/03/'+term.slice(0,4),chip:'aberta',status:'✓ Aberta'}
 ].map((r,i)=><tr key={r.acao} role="button" tabIndex={0} onClick={()=>detailOf(r.acao,r.oque+'. Responsável: '+r.resp+'. Prazo ilustrativo: '+r.prazo+'.')} onKeyDown={e=>{if(e.key==='Enter')detailOf(r.acao,r.oque+'.');}}>
  <td><span className="vp-num">{i+1}</span></td><td><strong>{r.acao}</strong></td><td>{r.oque}</td><td>{r.resp}</td><td>{r.prazo}</td><td><span className={'vp-chip '+r.chip}>{r.status}</span></td></tr>)}</tbody></table></div>;
 const reads=<div className="vp-reads vp-span-3"><h3><b>⚡</b>Leituras rápidas do BI</h3>{[
   {name:'Onde cresce mais',copy:grow[0]?grow[0].name+' (+'+pct(grow[0].growth)+') lidera o crescimento fictício.':'Sem recorte',view:'matriculas' as BiPage,icon:'▲'},
   {name:'Onde o risco aumentou',copy:risk[0]?risk[0].name+' ('+pct(risk[0].risk)+') apresenta maior risco ilustrativo.':'Sem curso',view:'reprovacoes' as BiPage,icon:'⚠'},
   {name:'Quais ações priorizar',copy:'Reduzir evasão, ajustar indicadores e sustentar a captação.',view:'regulacao' as BiPage,icon:'◎'}
  ].map(x=><button className="vp-insight" key={x.name} type="button" onClick={()=>{setPage(x.view);detailOf(x.name,x.copy);}}><b>{x.icon}</b><span><strong>{x.name}</strong><small>{x.copy}</small></span><i>›</i></button>)}</div>;
 const fo=<div className="vp-fo-card vp-span-3"><h3><b>⛓</b>Integração com Fato & Ordem</h3>
  {foValid?<><p><strong style={{color:'#fff'}}>{fmt(foFeed!.summary.students)} alunos fictícios</strong> recebidos do cenário demonstrativo Fato & Ordem.</p><span className="vp-fo-badge">▦ OAB, CFC e ENADE em acompanhamento demonstrativo.</span></>
  :<><p>Feed demonstrativo não confirmado nesta sessão. Nenhum número é apresentado como sincronizado.</p><span className="vp-fo-badge">▦ OAB, CFC e ENADE em acompanhamento demonstrativo.</span></>}
  <p style={{fontSize:11,opacity:.8}}>Cenário sintético — sem dados reais de alunos.</p></div>;
 const table=<div className="vp-table-scroll"><table className="vp-table"><thead><tr><th>Curso</th><th>Matrículas</th><th>Ocupação</th><th>Nota</th><th>Falta</th><th>Detalhes</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} tabIndex={0} role="button" onClick={()=>chooseCourse(r.id)} onKeyDown={e=>{if(e.key==='Enter')chooseCourse(r.id);}}><td>{r.name}</td><td>{fmt(r.students)}</td><td>{pct(r.occupancy)}</td><td>{pct(r.note)}</td><td>{pct(r.absence)}</td><td>Ver ›</td></tr>)}</tbody></table></div>;
 return <div className={'vp-bi'+(tv?' tv':'')} ref={host} aria-label={'BI Demonstrativo: '+demoInstitutionProfiles[mode].name}>
  <aside className="vp-side">
   <div className="vp-side-logo"><i>V</i><div><strong>Vértice</strong><small>Educação Superior</small></div></div>
   <nav className="vp-nav" aria-label="Áreas do BI">{PAGES.map(p=><button key={p.id} aria-current={page===p.id?'page':undefined} type="button" onClick={()=>setPage(p.id)}><b>{p.icon}</b>{p.label}</button>)}</nav>
   <div className="vp-side-tag"><span>🎓</span><p>BI estratégico para Reitores e Gestores da <em>Educação Superior</em></p></div>
  </aside>
  <div className="vp-main">
   <header className="vp-top">
    <h2>{demoInstitutionProfiles[mode].name}<span className="vp-divider">|</span><em>BI Demonstrativo</em><span className="vp-fict">ⓘ Dados fictícios para apresentação comercial</span></h2>
    <div className="vp-top-controls"><span className="vp-demo-pill">◉ Ambiente Demo</span><button type="button" onClick={()=>void enterTv()}>▣ Modo TV</button></div>
   </header>
   <div className="vp-canvas">
   <div className="vp-filters"><label>Semestre<select value={term} onChange={e=>setTerm(e.target.value as Term)}>{TERMS.map(t=><option key={t}>{t}</option>)}</select></label>
   <label>Curso<select value={course} onChange={e=>setCourse(e.target.value)}><option value="all">Todos os cursos</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>Comparar com<select value={compare} onChange={e=>setCompare(e.target.value as 'year'|'previous')}><option value="year">Mesmo semestre do ano anterior</option><option value="previous">Semestre anterior</option></select></label>
   <button type="button" onClick={()=>{setTerm('2026/2');setCourse('all');setCompare('year');setPage('overview');}}>Limpar filtros</button></div>
   {kpis}
   {(page==='overview'||page==='matriculas')&&<div className="vp-grid">
    <Card title="Matrículas por semestre" subtitle="Evolução das matrículas ativas na graduação" span={5} badge={growth!=null?<span className="vp-badge-up">↗ {(growth>0?'+':'')+pct(growth)} no período</span>:undefined}>{tchart}</Card>
    <Card title="Reprovação por nota × falta" subtitle="Percentual de reprovações por causa" span={4}>{stacked}</Card>
    <Card title="Situação regulatória" subtitle="Conformidade por dimensão (MEC)" span={3}>{donut}</Card>
   </div>}
   {(page==='overview'||page==='regulacao'||page==='reprovacoes')&&<div className="vp-grid">
    <Card title="Painel MEC / INEP" subtitle="Principais itens de atenção e conformidade regulatória" span={4}>{mec}</Card>
    <Card title="Cursos com maior crescimento" subtitle="Variação de matrículas ativas no período" span={4}>{growthChart}</Card>
    <Card title="Risco de evasão" subtitle="Cursos/períodos com maior risco (probabilidade ilustrativa)" span={4}>{riskTable}</Card>
   </div>}
   {(page==='overview'||page==='regulacao')&&<div className="vp-grid">
    <Card title="Plano de ação (5W2H)" subtitle="Principais ações para desempenho acadêmico, permanência e regulação" span={6}>{plan}</Card>
    {reads}{fo}
   </div>}
   {(page==='matriculas'||page==='reprovacoes')&&<div className="vp-grid">
    <Card title="Ocupação por curso" subtitle="Clique numa barra para abrir o curso" span={6}><div className="vp-bars">{biggest.map(r=><button type="button" className="vp-bar" key={r.id} onClick={()=>chooseCourse(r.id)}><span>{r.name}</span><span className="vp-track"><i className="vp-fill" style={{width:String(bound(r.occupancy))+'%'}}/></span><strong>{pct(r.occupancy)}</strong></button>)}</div></Card>
    <Card title="Cursos e indicadores" subtitle="Clique numa linha para detalhar os números do recorte" span={6}>{table}</Card>
   </div>}
   {page==='captacao'&&<div className="vp-grid">
    <Card title="Funil comercial ilustrativo" subtitle="Sem dados reais de campanhas" span={6}>{[{label:'Interessados',value:Math.round(totals.students*1.85)},{label:'Inscrições',value:Math.round(totals.students*1.38)},{label:'Aprovados',value:Math.round(totals.students*1.13)},{label:'Matrículas',value:totals.students}].map((v,i)=><button className="vp-funnel" type="button" key={v.label} style={{width:String(100-i*14)+'%'}} onClick={()=>detailOf(v.label,fmt(v.value)+' pessoas fictícias no funil demonstrativo.')}>{v.label}<strong>{fmt(v.value)}</strong></button>)}</Card>
    <Card title="Captação por curso" subtitle="Ocupação de vagas, exclusivamente hipotética" span={6}><div className="vp-bars">{biggest.map(r=><button type="button" className="vp-bar" key={r.id} onClick={()=>chooseCourse(r.id)}><span>{r.name}</span><span className="vp-track"><i className="vp-fill" style={{width:String(bound(r.occupancy))+'%'}}/></span><strong>{pct(r.occupancy)}</strong></button>)}</div></Card>
   </div>}
   {page==='aprendizagem'&&<div className="vp-grid">
    <Card title="Aprendizagem no Fato & Ordem" subtitle="Indicadores da API de cenário fictício, sem alunos reais" span={6}>{foValid?<><div className="vp-fo"><strong>{fmt(foFeed!.summary.students)} alunos fictícios</strong><span>Aproveitamento: {foFeed!.summary.exam==null?'N/D':pct(foFeed!.summary.exam)}</span></div><div className="vp-bars">{foFeed!.courses.filter(x=>x.exam!==null).slice(0,8).map(x=><button type="button" className="vp-bar" key={x.id} onClick={()=>detailOf('Trilha '+x.name,'Dados fictícios recebidos da API Fato & Ordem.')}><span>{x.name}</span><span className="vp-track"><i className="vp-fill" style={{width:String(bound(Number(x.exam)))+'%'}}/></span><strong>{pct(Number(x.exam))}</strong></button>)}</div></>:<p className="vp-empty">O feed demonstrativo não foi confirmado. Nenhum número será apresentado como sincronizado.</p>}</Card>
    <Card title="Comparação sala × exercícios" subtitle="Escalas e competências distintas: sem inferência de causalidade" span={6}><div className="vp-bars">{rows.slice(0,8).map(r=><button type="button" className="vp-bar" key={r.id} onClick={()=>chooseCourse(r.id)}><span>{r.name}</span><span className="vp-track"><i className="vp-fill" style={{width:String(bound(r.score))+'%'}}/></span><strong>{pct(r.score)}</strong></button>)}</div><p className="vp-hint">Acertos são simulados e não representam nota oficial de exame.</p></Card>
   </div>}
   {page==='overview'&&<p className="vp-hint" style={{textAlign:'center'}}>Todos os números deste BI são fictícios e não representam dados oficiais, clientes reais ou resultados do MEC/INEP. Os BIs autenticados da Vértice utilizam suas próprias fontes e regras de acesso.</p>}
   {tv&&<div className="vp-tvbar"><strong>TV • {PAGES.find(p=>p.id===page)?.label}</strong><button type="button" onClick={()=>setPaused(!paused)}>{paused?'Retomar':'Pausar'}</button><button type="button" onClick={()=>move(-1)}>Anterior</button><button type="button" onClick={()=>move(1)}>Próxima</button><select aria-label="Rotação da TV" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={10000}>10 s</option><option value={15000}>15 s</option><option value={20000}>20 s</option><option value={30000}>30 s</option></select><button type="button" onClick={()=>void exitTv()}>Sair</button></div>}
   </div>
  </div>
  {detail&&<div className="vp-modal" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null);}}><div role="dialog" aria-modal="true" aria-label={detail.title}><button type="button" onClick={()=>setDetail(null)} aria-label="Fechar">×</button><span>DETALHAMENTO DO INDICADOR</span><h3>{detail.title}</h3><p>{detail.description}</p></div></div>}
 </div>;
}
