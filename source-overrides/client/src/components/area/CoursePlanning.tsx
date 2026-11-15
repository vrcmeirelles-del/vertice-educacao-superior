import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isFullAccess, type Role } from '@/lib/area';
import { TABS, EMPTY_PLAN, EMPTY_SEMESTER, type TabKey, type PlanDraft, type SemesterDraft, IdentificacaoTab, VisaoTab, CicloTab, BcgTab, PorterTab, FcsTab, AtributosTab, ObjetivosTab, OperacionalTab, SemestreTab } from './planning/sections';
import './planning/planning.css';

type Course = {id:string;name:string;code?:string|null};
type Stored = {id:string;version:number;status:'draft'|'published'|'archived';updated_at:string;created_at:string;semester?:string;[key:string]:unknown};
const statusNames = {draft:'Rascunho',published:'Publicado',archived:'Arquivado'};
const sections = {identificacao:IdentificacaoTab,visao:VisaoTab,ciclo:CicloTab,bcg:BcgTab,porter:PorterTab,fcs:FcsTab,atributos:AtributosTab,objetivos:ObjetivosTab,operacional:OperacionalTab};

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
  const [selection,setSelection]=useState(initialCourseId??'');
  const [unsaved,setUnsaved]=useState(false);
  const selected=courses.find(c=>c.id===selection);
  const canWrite=isFullAccess(role)||role==='coordenador'||role==='nde';
  const title=TITLES[kind];
  return <section className="course-planning" aria-label={title.heading}>
    <header><h2>{title.heading}</h2><p>{title.description}</p></header>
    <label className="planning-field"><span>Curso</span><select aria-label="Curso do planejamento" value={selected?.id??''} onChange={e=>{if(!unsaved||window.confirm('Há alterações não salvas. Deseja trocar de curso?')){setSelection(e.target.value);setUnsaved(false);}}}><option value="">Selecione um curso</option>{courses.map(c=><option key={c.id} value={c.id}>{c.code?`${c.code} · `:''}{c.name}</option>)}</select></label>
    {!courses.length?<p role="status">Nenhum curso disponível neste cadastro.</p>:!selected?<p role="status">Selecione o curso para consultar seus planejamentos.</p>:<PlanningEditor key={`${institutionId}:${selected.id}:${kind}`} institutionId={institutionId} courseId={selected.id} canWrite={canWrite} onDirty={setUnsaved} kind={kind}/>}
  </section>;
}

const STRATEGIC_TABS:TabKey[]=['identificacao','visao','ciclo','bcg','porter','fcs','atributos','objetivos','operacional'];

function PlanningEditor({institutionId,courseId,canWrite,onDirty,kind='both'}:{institutionId:string;courseId:string;canWrite:boolean;onDirty:(value:boolean)=>void;kind?:'strategic'|'semester'|'both'}) {
  const defaultTab:TabKey=kind==='semester'?'semestre':'identificacao';
  const [tab,setTab]=useState<TabKey>(defaultTab);
  const visibleTabs=kind==='strategic'?TABS.filter(t=>STRATEGIC_TABS.includes(t.key)):kind==='semester'?TABS.filter(t=>t.key==='semestre'):TABS;
  const [plans,setPlans]=useState<Stored[]>([]),[semesters,setSemesters]=useState<Stored[]>([]);
  const [draft,setDraft]=useState<PlanDraft>({...EMPTY_PLAN,courseId}),[semDraft,setSemDraft]=useState<SemesterDraft>({...EMPTY_SEMESTER,courseId});
  const [strategicRevision,setStrategicRevision]=useState(''),[semesterRevision,setSemesterRevision]=useState('');
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [dirtyKinds,setDirtyKinds]=useState({strategic:false,semester:false});
  const dirty=tab==='semestre'?dirtyKinds.semester:dirtyKinds.strategic;
  const anyDirty=dirtyKinds.strategic||dirtyKinds.semester;
  const setDirty=(value:boolean)=>setDirtyKinds(previous=>({...previous,[tab==='semestre'?'semester':'strategic']:value}));
  useEffect(()=>onDirty(anyDirty),[anyDirty,onDirty]);
  function loadRecord(row:Stored,kind:'strategic'|'semester') {
    if(kind==='strategic'){setDraft({...EMPTY_PLAN,...row,courseId} as PlanDraft);setStrategicRevision(row.updated_at);}
    else{setSemDraft({...EMPTY_SEMESTER,...row,form_code:null,courseId} as SemesterDraft);setSemesterRevision(row.updated_at);}
  }
  useEffect(()=>{
    let active=true;
    Promise.all([planningRequest(institutionId,courseId,'strategic','list'),planningRequest(institutionId,courseId,'semester','list')]).then(([a,b])=>{
      if(!active)return;setPlans(a.plans??[]);setSemesters(b.plans??[]);
      if(a.plans?.[0])loadRecord(a.plans[0],'strategic');
      if(b.plans?.[0])loadRecord(b.plans[0],'semester');
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[institutionId,courseId]);
  useEffect(()=>{
    const leave=(event:BeforeUnloadEvent)=>{if(anyDirty){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);
  },[anyDirty]);
  const semester=tab==='semestre',kind=semester?'semester':'strategic';
  const current=semester?semDraft:draft;
  const currentRevision=semester?semesterRevision:strategicRevision;
  const records=semester?semesters:plans;
  async function persist(action='save') {
    setSaving(true);setError('');setNotice('');
    try {
      const result=await planningRequest(institutionId,courseId,kind,action,{...current,form_code:null,expected_updated_at:currentRevision||null});
      if(!result.plan)throw new Error('O servidor não confirmou o planejamento.');
      loadRecord(result.plan,kind);
      const all=await planningRequest(institutionId,courseId,kind,'list');
      if(semester)setSemesters(all.plans??[]);else setPlans(all.plans??[]);
      setDirty(false);setNotice(action==='publish'?'Planejamento publicado.':'Planejamento salvo.');
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setSaving(false);}
  }
  function fresh(){
    if(dirty&&!window.confirm('Há alterações não salvas. Deseja abrir um novo planejamento?'))return;
    if(semester){setSemDraft({...EMPTY_SEMESTER,courseId});setSemesterRevision('');}
    else{setDraft({...EMPTY_PLAN,courseId});setStrategicRevision('');}
    setDirty(false);setNotice('');
  }
  const Section=tab==='semestre'?null:sections[tab];
  if(loading)return <p role="status">Carregando planejamentos do curso…</p>;
  return <>
    {error&&<p role="alert" className="planning-error">{error}</p>}
    {notice&&<p role="status" className="planning-success">{notice}</p>}
    {visibleTabs.length>1&&<nav className="planning-tabs" aria-label="Seções do planejamento">{visibleTabs.map(t=><button key={t.key} type="button" aria-pressed={tab===t.key} onClick={()=>setTab(t.key)}>{t.label}</button>)}</nav>}
    <div className="planning-toolbar"><p>{statusNames[current.status]} · versão {current.version}</p>{canWrite&&<button type="button" onClick={fresh}>Novo {semester?'planejamento semestral':'planejamento estratégico'}</button>}</div>
    {error&&!plans.length&&!semesters.length?<p>Confira o acesso e atualize a página antes de editar.</p>:<>
      {!canWrite&&<p>Seu perfil permite consultar este planejamento.</p>}
      <fieldset disabled={!canWrite||saving}><legend className="planning-sr">Conteúdo do planejamento</legend>{Section?<Section plan={draft} setPlan={value=>{setDraft(value);setDirty(true);setNotice('');}}/>:<SemestreTab draft={semDraft} setDraft={value=>{setSemDraft(value);setDirty(true);setNotice('');}}/>}</fieldset>
      {canWrite&&<div className="planning-toolbar"><button type="button" className="planning-primary" disabled={saving||(semester&&!semDraft.semester)} onClick={()=>persist()}>{saving?'Salvando…':semester?'Salvar planejamento semestral':'Salvar planejamento estratégico'}</button>{current.id&&current.status==='draft'&&<button type="button" disabled={saving||dirty} onClick={()=>persist('publish')}>Publicar versão salva</button>}{current.status!=='draft'&&<small>Salvar alterações cria uma nova versão em rascunho e preserva a versão anterior.</small>}</div>}
    </>}
    <h3>Histórico {semester?'semestral':'estratégico'}</h3>
    {!records.length?<p>Nenhuma versão registrada para este curso.</p>:<div className="planning-scroll"><table><thead><tr>{semester&&<th>Semestre</th>}<th>Versão</th><th>Situação</th><th>Atualização</th><th>Acesso</th></tr></thead><tbody>{records.map(row=><tr key={row.id}>{semester&&<td>{row.semester}</td>}<td>{row.version}</td><td>{statusNames[row.status]}</td><td>{new Date(row.updated_at).toLocaleString('pt-BR')}</td><td><button type="button" onClick={()=>{if(!dirty||window.confirm('Deseja trocar a versão sem salvar as alterações?')){loadRecord(row,kind);setDirty(false);setNotice('');}}}>Abrir versão</button></td></tr>)}</tbody></table></div>}
  </>;
}
