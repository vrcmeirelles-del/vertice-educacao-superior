import EvidenceSearch from "./EvidenceSearch";
import SapiensPlanning from './SapiensPlanning';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isFullAccess, type Role } from '@/lib/area';
import { TABS, EMPTY_PLAN, EMPTY_SEMESTER, type TabKey, type PlanDraft, type SemesterDraft, IdentificacaoTab, VisaoTab, SwotTab, CicloTab, BcgTab, PorterTab, FcsTab, BenchmarkingTab, AtributosTab, ObjetivosTab, AlinhamentoTab, RiscosTab, OperacionalTab, SemestreTab } from './planning/sections';
import './planning/planning.css';
import PlanningManagement from '../bi/PlanningManagement';
import CompetitiveIntelligence from './planning/CompetitiveIntelligence';

export interface CrossModuleData {
  extensionProjects: {name:string;hours_per_student?:number}[];
  goals: {area:string;target_value:string;metric:string;baseline?:string}[];
  internshipCount: number;
  tccDefenseCount: number;
  atRiskCount: number;
  peiCount: number;
  professors: {name:string;title?:string}[];
}

async function loadCrossModuleData(institutionId:string, courseId:string): Promise<CrossModuleData> {
  const empty:CrossModuleData = {extensionProjects:[],goals:[],internshipCount:0,tccDefenseCount:0,atRiskCount:0,peiCount:0,professors:[]};
  try {
    const [ext, goals, intern, tcc, risk, pei, profs] = await Promise.allSettled([
      supabase.from('vertice_extension_projects').select('name,expected_hours_per_student').eq('institution_id',institutionId).eq('status','active').limit(50),
      supabase.from('vertice_goals').select('title,target_value,metric,baseline_value').eq('institution_id',institutionId).eq('status','active').limit(30),
      supabase.from('vertice_internship_placements').select('id',{count:'exact',head:true}).eq('institution_id',institutionId).eq('course_id',courseId).in('status',['active','pending']),
      supabase.from('vertice_tcc_works').select('id',{count:'exact',head:true}).eq('institution_id',institutionId).eq('course_id',courseId).in('status',['defense_scheduled','in_progress']),
      supabase.from('vertice_risco_agregado').select('total_risco').eq('institution_id',institutionId).eq('course_id',courseId).maybeSingle(),
      supabase.from('student_individual_plans').select('id',{count:'exact',head:true}).eq('institution_id',institutionId).in('status',['ativo','em_revisao']),
      supabase.from('vertice_eorbit_professores').select('nome,titulacao').eq('instituicao_id',institutionId).limit(50),
    ]);
    return {
      extensionProjects: ext.status==='fulfilled'&&ext.value.data? ext.value.data.map((r:Record<string,unknown>)=>({name:String(r.name??''),hours_per_student:Number(r.expected_hours_per_student??0)})) : [],
      goals: goals.status==='fulfilled'&&goals.value.data? goals.value.data.map((r:Record<string,unknown>)=>({area:String(r.title??''),target_value:String(r.target_value??''),metric:String(r.metric??''),baseline:r.baseline_value?String(r.baseline_value):undefined})) : [],
      internshipCount: intern.status==='fulfilled'?intern.value.count??0:0,
      tccDefenseCount: tcc.status==='fulfilled'?tcc.value.count??0:0,
      atRiskCount: risk.status==='fulfilled'&&risk.value.data?Number(risk.value.data.total_risco??0):0,
      peiCount: pei.status==='fulfilled'?pei.value.count??0:0,
      professors: profs.status==='fulfilled'&&profs.value.data? profs.value.data.map((r:Record<string,unknown>)=>({name:String(r.nome??''),title:r.titulacao?String(r.titulacao):undefined})) : [],
    };
  } catch { return empty; }
}

type Course = {id:string;name:string;code?:string|null};
type Stored = {id:string;version:number;status:'draft'|'published'|'archived';updated_at:string;created_at:string;semester?:string;[key:string]:unknown};
const statusNames = {draft:'Rascunho',published:'Publicado',archived:'Arquivado'};
const sections = {identificacao:IdentificacaoTab,visao:VisaoTab,swot:SwotTab,ciclo:CicloTab,bcg:BcgTab,porter:PorterTab,fcs:FcsTab,benchmarking:BenchmarkingTab,atributos:AtributosTab,objetivos:ObjetivosTab,alinhamento:AlinhamentoTab,riscos:RiscosTab,operacional:OperacionalTab};

export async function planningRequest(institutionId:string,courseId:string,kind:'strategic'|'semester',action:string,payload:object={}) {
  const {data,error}=await supabase.rpc('vertice_course_planning',{p_institution_id:institutionId,p_course_id:courseId,p_kind:kind,p_action:action,p_payload:payload});
  if(error) throw new Error(error.message);
  return data as {plans?:Stored[];plan?:Stored};
}

const TITLES = {
  strategic: { heading: 'Planejamento Estratégico do Curso', description: 'Defina a direção estratégica do curso: visão, análise de mercado, posicionamento e objetivos de longo prazo.' },
  semester: { heading: 'Planejamento Semestral do Curso', description: 'Organize as atividades, eventos e ações de cada semestre letivo.' },
  both: { heading: 'Planejamento Estratégico e Semestral do Curso', description: 'Defina a direção do curso e organize as atividades de cada semestre. Os planos utilizam o cadastro institucional e o acesso do portal.' },
} as const;

export default function CoursePlanning({institutionId,courses,role,initialCourseId,kind='both'}:{institutionId:string;courses:Course[];role:Role|null;initialCourseId?:string;kind?:'strategic'|'semester'|'both'}) {
  const [portfolioOpen,setPortfolioOpen]=useState(false);
  const [selection,setSelection]=useState(initialCourseId??'');
  const [unsaved,setUnsaved]=useState(false);
  const selected=courses.find(c=>c.id===selection);
  const canWrite=isFullAccess(role)||role==='coordenador'||role==='nde';
  const title=TITLES[kind];
  return <section className="course-planning" aria-label={title.heading}>
    {isFullAccess(role)&&<div><button type="button" aria-expanded={portfolioOpen} onClick={()=>setPortfolioOpen(!portfolioOpen)}>Consolidação da alta gestão</button>{portfolioOpen&&<PlanningManagement key={institutionId} institutionId={institutionId}/>}</div>}
    <header><h2>{title.heading}</h2><p>{title.description}</p></header>
    <label className="planning-field"><span>Curso</span><select aria-label="Curso do planejamento" value={selected?.id??''} onChange={e=>{if(!unsaved||window.confirm('Há alterações não salvas. Deseja trocar de curso?')){setSelection(e.target.value);setUnsaved(false);}}}><option value="">Selecione um curso</option>{courses.map(c=><option key={c.id} value={c.id}>{c.code?`${c.code} · `:''}{c.name}</option>)}</select></label>
    {!courses.length?<p role="status">Nenhum curso disponível neste cadastro.</p>:!selected?<p role="status">Selecione o curso para consultar seus planejamentos.</p>:<PlanningEditor key={`${institutionId}:${selected.id}:${kind}`} institutionId={institutionId} courseId={selected.id} canAnalyze={isFullAccess(role)||role==='coordenador'||role==='nde'} canWrite={canWrite} onDirty={setUnsaved} kind={kind}/>}
  </section>;
}

const STRATEGIC_TABS:TabKey[]=['identificacao','visao','swot','ciclo','bcg','porter','fcs','benchmarking','atributos','objetivos','alinhamento','riscos','operacional'];

function PlanningEditor({institutionId,courseId,canWrite,canAnalyze,onDirty,kind='both'}:{institutionId:string;courseId:string;canAnalyze:boolean;canWrite:boolean;onDirty:(value:boolean)=>void;kind?:'strategic'|'semester'|'both'}) {
  const defaultTab:TabKey=kind==='semester'?'semestre':'identificacao';
  const [tab,setTab]=useState<TabKey>(defaultTab);
  const visibleTabs=kind==='strategic'?TABS.filter(t=>STRATEGIC_TABS.includes(t.key)):kind==='semester'?TABS.filter(t=>t.key==='semestre'):TABS;
  const [plans,setPlans]=useState<Stored[]>([]),[semesters,setSemesters]=useState<Stored[]>([]);
  const [draft,setDraft]=useState<PlanDraft>({...EMPTY_PLAN,courseId}),[semDraft,setSemDraft]=useState<SemesterDraft>({...EMPTY_SEMESTER,courseId});
  const [strategicRevision,setStrategicRevision]=useState(''),[semesterRevision,setSemesterRevision]=useState('');
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [crossData,setCrossData]=useState<CrossModuleData|null>(null);
  const [dirtyKinds,setDirtyKinds]=useState({strategic:false,semester:false});
  const dirty=tab==='semestre'?dirtyKinds.semester:dirtyKinds.strategic;
  const anyDirty=dirtyKinds.strategic||dirtyKinds.semester;
  const setDirty=(value:boolean)=>setDirtyKinds(previous=>({...previous,[tab==='semestre'?'semester':'strategic']:value}));
  useEffect(()=>onDirty(anyDirty),[anyDirty,onDirty]);
  function loadRecord(row:Stored,kind:'strategic'|'semester') {
    // Strip null/undefined values so EMPTY defaults survive the spread
    const clean:Record<string,unknown>={};
    for(const[k,v]of Object.entries(row)){if(v!=null)clean[k]=v;}
    if(kind==='strategic'){
      const swot=clean.swot as Partial<PlanDraft['swot']>|undefined;
      const normalizedSwot=Object.fromEntries(['strengths','weaknesses','opportunities','threats'].map(key=>[key,Array.isArray(swot?.[key as keyof typeof swot])?swot![key as keyof typeof swot]:[]]));
      setDraft({...EMPTY_PLAN,...clean,swot:normalizedSwot,alignment:Array.isArray(clean.alignment)?clean.alignment:[],courseId} as PlanDraft);setStrategicRevision(row.updated_at);
    }
    else{setSemDraft({...EMPTY_SEMESTER,...clean,form_code:null,courseId} as SemesterDraft);setSemesterRevision(row.updated_at);}
  }
  useEffect(()=>{
    let active=true;
    Promise.all([
      planningRequest(institutionId,courseId,'strategic','list'),
      planningRequest(institutionId,courseId,'semester','list'),
      loadCrossModuleData(institutionId,courseId),
    ]).then(([a,b,cross])=>{
      if(!active)return;setPlans(a.plans??[]);setSemesters(b.plans??[]);
      if(a.plans?.[0])loadRecord(a.plans[0],'strategic');
      if(b.plans?.[0])loadRecord(b.plans[0],'semester');
      setCrossData(cross);
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[institutionId,courseId]);
  useEffect(()=>{
    const leave=(event:BeforeUnloadEvent)=>{if(anyDirty){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);
  },[anyDirty]);
  const isSemester=tab==='semestre',planKind:('strategic'|'semester')=isSemester?'semester':'strategic';
  const current=isSemester?semDraft:draft;
  const currentRevision=isSemester?semesterRevision:strategicRevision;
  const records=isSemester?semesters:plans;
  async function persist(action='save') {
    setSaving(true);setError('');setNotice('');
    try {
      const result=await planningRequest(institutionId,courseId,planKind,action,{...current,form_code:null,expected_updated_at:currentRevision||null});
      if(!result.plan)throw new Error('O servidor não confirmou o planejamento.');
      loadRecord(result.plan,planKind);
      const all=await planningRequest(institutionId,courseId,planKind,'list');
      if(isSemester)setSemesters(all.plans??[]);else setPlans(all.plans??[]);
      setDirty(false);setNotice(action==='publish'?'Planejamento publicado.':'Planejamento salvo.');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setSaving(false);}
  }
  function fresh(){
    if(dirty&&!window.confirm('Há alterações não salvas. Deseja abrir um novo planejamento?'))return;
    if(isSemester){setSemDraft({...EMPTY_SEMESTER,courseId});setSemesterRevision('');}
    else{setDraft({...EMPTY_PLAN,courseId});setStrategicRevision('');}
    setDirty(false);setNotice('');
  }
  const Section=tab==='semestre'?null:sections[tab as keyof typeof sections];
  const [helpOpen,setHelpOpen]=useState<string|null>(null);
  const activeTab=visibleTabs.find(t=>t.key===tab);
  const [sapiensOpen,setSapiensOpen]=useState(false);
  const [competitiveOpen,setCompetitiveOpen]=useState(false);
  if(loading)return <p role="status">Carregando planejamentos do curso…</p>;
  return <>
    {error&&<p role="alert" className="planning-error">{error}</p>}
    {notice&&<p role="status" className="planning-success">{notice}</p>}
    {visibleTabs.length>1&&<div className="planning-section-picker">
      <label className="planning-field"><span>Etapa {visibleTabs.findIndex(t=>t.key===tab)+1} de {visibleTabs.length} · Navegue pelo planejamento</span>
        <select aria-label="Seção do planejamento" value={tab} onChange={e=>setTab(e.target.value as TabKey)}>{visibleTabs.map((t,i)=><option key={t.key} value={t.key}>{i+1}. {t.label}</option>)}</select>
      </label>
      <button type="button" aria-label="Ajuda sobre a seção atual" onClick={()=>setHelpOpen(tab)}>Como preencher?</button>
      <details className="planning-section-index"><summary>Ver todas as etapas</summary><nav className="planning-nav" aria-label="Seções do planejamento">
        {visibleTabs.map((t,i)=><button key={t.key} type="button" aria-current={tab===t.key?'step':undefined} className={`planning-nav-card${tab===t.key?' planning-nav-active':''}`} onClick={()=>setTab(t.key)}>
          <span className="planning-nav-icon">{i+1}</span><span className="planning-nav-text"><strong>{t.label}</strong><small>{t.description}</small></span>
        </button>)}
      </nav></details>
    </div>}
    {helpOpen&&<div className="planning-help-popup" role="dialog"><div className="planning-help-inner"><button className="planning-help-close" onClick={()=>setHelpOpen(null)}>✕</button><h4>{activeTab?.icon||'ℹ️'} {visibleTabs.find(t=>t.key===helpOpen)?.label}</h4><p>{visibleTabs.find(t=>t.key===helpOpen)?.help}</p></div></div>}
    <div className="planning-toolbar planning-version"><p><span className="planning-status">{statusNames[current.status]} · versão {current.version}</span><small>{dirty?'Alterações não salvas':'Nenhuma alteração pendente'}</small></p>{canWrite&&<button type="button" onClick={fresh}>Novo {isSemester?'planejamento semestral':'planejamento estratégico'}</button>}</div>
    {error&&!plans.length&&!semesters.length?<p>Confira o acesso e atualize a página antes de editar.</p>:<>
      {!canWrite&&<p>Seu perfil permite consultar este planejamento.</p>}
      <div className="planning-section-heading"><h3>{activeTab?.label}</h3><p>{activeTab?.description}</p></div>
      <fieldset disabled={!canWrite||saving}><legend className="planning-sr">Conteúdo do planejamento</legend>{Section?<Section plan={draft} setPlan={value=>{setDraft(value);setDirty(true);setNotice('');}}/>:<SemestreTab draft={semDraft} setDraft={value=>{setSemDraft(value);setDirty(true);setNotice('');}} crossData={crossData}/>}</fieldset>
      {canWrite&&<div className="planning-toolbar planning-save-bar"><button type="button" className="planning-primary" disabled={saving||(isSemester&&!semDraft.semester)} onClick={()=>persist()}>{saving?'Salvando…':isSemester?'Salvar planejamento semestral':'Salvar planejamento estratégico'}</button>{current.id&&current.status==='draft'&&<button type="button" disabled={saving||dirty} onClick={()=>persist('publish')}>Publicar versão salva</button>}{current.status!=='draft'&&<small>Salvar alterações cria uma nova versão em rascunho e preserva a versão anterior.</small>}</div>}
    </>}
    {visibleTabs.length>1&&<div className="planning-step-controls"><button type="button" disabled={visibleTabs[0].key===tab} onClick={()=>setTab(visibleTabs[visibleTabs.findIndex(t=>t.key===tab)-1].key)}>← Etapa anterior</button><span>{visibleTabs.findIndex(t=>t.key===tab)+1} / {visibleTabs.length}</span><button type="button" disabled={visibleTabs[visibleTabs.length-1].key===tab} onClick={()=>setTab(visibleTabs[visibleTabs.findIndex(t=>t.key===tab)+1].key)}>Próxima etapa →</button></div>}
    {!isSemester&&canAnalyze&&<details className="planning-history" onToggle={e=>setCompetitiveOpen(e.currentTarget.open)}><summary>Inteligência competitiva · mercado e ações do curso</summary>{competitiveOpen&&(draft.id?<CompetitiveIntelligence key={`${institutionId}:${courseId}:${draft.id}`} institutionId={institutionId} courseId={courseId} planId={draft.id} dirty={dirtyKinds.strategic} canWrite={canWrite}/>:<p>Salve uma versão do planejamento para vincular os achados aos objetivos.</p>)}</details>}
    <EvidenceSearch institutionId={institutionId} courseId={courseId}/>
    {canAnalyze&&<><button type="button" onClick={()=>setSapiensOpen(v=>!v)} aria-expanded={sapiensOpen}>Análise interpretativa · Sapiens</button>{sapiensOpen&&<SapiensPlanning institutionId={institutionId} courseId={courseId} semester={isSemester?semDraft.semester:undefined}/>}</>}
    <details className="planning-history"><summary>Histórico {isSemester?'semestral':'estratégico'} · {records.length} versão(ões)</summary>
    {!records.length?<p>Nenhuma versão registrada para este curso.</p>:<div className="planning-scroll"><table><thead><tr>{isSemester&&<th>Semestre</th>}<th>Versão</th><th>Situação</th><th>Atualização</th><th>Acesso</th></tr></thead><tbody>{records.map(row=><tr key={row.id}>{isSemester&&<td>{row.semester}</td>}<td>{row.version}</td><td>{statusNames[row.status]}</td><td>{new Date(row.updated_at).toLocaleString('pt-BR')}</td><td><button type="button" onClick={()=>{if(!dirty||window.confirm('Deseja trocar a versão sem salvar as alterações?')){loadRecord(row,planKind);setDirty(false);setNotice('');}}}>Abrir versão</button></td></tr>)}</tbody></table></div>}
    </details>
  </>;
}
