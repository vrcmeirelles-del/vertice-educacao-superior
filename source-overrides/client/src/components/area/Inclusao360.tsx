import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildSupportPayload, checkedWrite, readableObjectives, accommodationCategories } from "@/lib/student-support-contracts";
import "./inclusao360.css";

// Aligned with actual Supabase schema
interface SupportCase { id:string; institution_id:string; student_name:string; student_matricula?:string; course_id?:string; protocol?:string; priority:string; status:string; summary?:string; assigned_to?:string; created_at:string; closed_at?:string; }
interface SupportRequest { id:string; case_id:string; institution_id:string; origin:string; needs_type:string; description:string; requester_name:string; urgency?:string; status:string; created_at:string; }
interface IndividualPlan { id:string; case_id:string; institution_id:string; student_name:string; status:string; effective_from?:string; effective_until?:string; objectives?:unknown; created_at:string; version_number?:number; }
interface Accommodation { id:string; plan_id:string; institution_id:string; category:string; description:string; details?:string; responsible?:string; status:string; }

type View = 'casos'|'solicitacoes'|'pei'|'evidencias';
interface Props { institutionId:string; role:string; }

export default function Inclusao360(props:Props) {
  return <Inclusao360Content key={props.institutionId} {...props} />;
}

function Inclusao360Content({institutionId,role}:Props) {
  const [view,setView] = useState<View>('casos');
  const [cases,setCases] = useState<SupportCase[]>([]);
  const [requests,setRequests] = useState<SupportRequest[]>([]);
  const [plans,setPlans] = useState<IndividualPlan[]>([]);
  const [accommodations,setAccommodations] = useState<Accommodation[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [loadError,setLoadError] = useState(false);
  const loadVersion = useRef(0);
  const [saving,setSaving] = useState(false);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  useEffect(()=>{ mounted.current=true; return ()=>{mounted.current=false}; },[]);
  const [showForm,setShowForm] = useState<'case'|'request'|'plan'|'accommodation'|null>(null);

  const [formCase,setFormCase] = useState({student_name:'',student_matricula:'',priority:'normal',summary:''});
  const [formReq,setFormReq] = useState({case_id:'',origin:'coordenacao',needs_type:'apoio_pedagogico',description:'',requester_name:''});
  const [formPlan,setFormPlan] = useState({case_id:'',student_name:'',objectives:'',effective_from:'',effective_until:''});
  const [formAccom,setFormAccom] = useState({plan_id:'',category:'metodologica',description:'',responsible:''});

  const load = useCallback(async ()=>{
    const version=++loadVersion.current;
    setLoading(true);
    try {
    const [c,r,p,a] = await Promise.all([
      supabase.from('student_support_cases').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_support_requests').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_individual_plans').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_plan_accommodations').select('*').eq('institution_id',institutionId).order('category'),
    ]);
    if (!mounted.current || version!==loadVersion.current) return;
    if ([c,r,p,a].some(result=>result.error)) throw new Error('Não foi possível carregar os registros. Tente novamente.');
    setError(''); setLoadError(false);
    if(c.data) setCases(c.data);
    if(r.data) setRequests(r.data);
    if(p.data) setPlans(p.data);
    if(a.data) setAccommodations(a.data);
    } catch { if (mounted.current && version===loadVersion.current) { setLoadError(true); setError('Não foi possível carregar os registros. Tente novamente.'); } }
    finally { if (mounted.current && version===loadVersion.current) setLoading(false); }
  },[institutionId]);

  useEffect(()=>{load()},[load]);

  const origins = [{v:'estudante',l:'Estudante'},{v:'professor',l:'Professor'},{v:'coordenacao',l:'Coordenação'},{v:'secretaria',l:'Secretaria'},{v:'fato_e_ordem',l:'Fato & Ordem'}];
  const needsTypes = [{v:'apoio_pedagogico',l:'Apoio Pedagógico'},{v:'acessibilidade',l:'Acessibilidade'},{v:'apoio_psicologico',l:'Apoio Psicológico'},{v:'adaptacao_curricular',l:'Adaptação Curricular'},{v:'recurso_assistivo',l:'Recurso Assistivo'},{v:'interprete_libras',l:'Intérprete de Libras'},{v:'outro',l:'Outro'}];
  const accomCategories = accommodationCategories.map(v=>({v,l:v.replaceAll('_',' ')}));

  const save = async (kind:string, table:string, form:Record<string,string|boolean>)=>{
    if (saveLock.current) return;
    saveLock.current=true; setSaving(true); setError('');
    try {
      const payload=buildSupportPayload(kind,form,{institutionId,cases,plans,role});
      await checkedWrite(supabase.from(table).insert(payload));
      if (!mounted.current) return;
      setShowForm(null);
      setFormCase({student_name:'',student_matricula:'',priority:'normal',summary:''});
      setFormReq({case_id:'',origin:'coordenacao',needs_type:'apoio_pedagogico',description:'',requester_name:''});
      setFormPlan({case_id:'',student_name:'',objectives:'',effective_from:'',effective_until:''});
      setFormAccom({plan_id:'',category:'metodologica',description:'',responsible:''});
      await load();
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Não foi possível salvar. Tente novamente.');
    } finally { saveLock.current=false; if (mounted.current) setSaving(false); }
  };
  const saveCase = ()=>save('supportCase','student_support_cases',formCase);
  const saveRequest = ()=>save('supportRequest','student_support_requests',formReq);
  const savePlan = ()=>save('supportPlan','student_individual_plans',formPlan);
  const saveAccommodation = ()=>save('accommodation','student_plan_accommodations',formAccom);

  const stats = {
    abertos: cases.filter(c=>['solicitacao_recebida','aguardando_acolhimento'].includes(c.status)).length,
    emAtendimento: cases.filter(c=>['em_avaliacao_pedagogica','apoio_inicial_em_execucao','plano_em_elaboracao','plano_validado','acompanhamento_ativo','em_revisao'].includes(c.status)).length,
    planos: plans.length,
    adaptacoes: accommodations.length,
  };

  if(loading) return <div className="inc-loading">Carregando inclusão…</div>;

  if (loadError) return <div role="alert">{error}<button onClick={load}>Tentar novamente</button></div>;

  return (
    <div className="inc360">
      {error && <div role="alert">{error} <button onClick={load} disabled={saving}>Recarregar</button></div>}
      {saving && <div role="status">Salvando…</div>}
      <div className="inc-kpis">
        <div className="inc-kpi"><span className="inc-kpi-n inc-alert">{stats.abertos}</span><span className="inc-kpi-l">Casos abertos</span></div>
        <div className="inc-kpi"><span className="inc-kpi-n inc-info">{stats.emAtendimento}</span><span className="inc-kpi-l">Em atendimento</span></div>
        <div className="inc-kpi"><span className="inc-kpi-n">{stats.planos}</span><span className="inc-kpi-l">Planos (PEI/PAA/PAI)</span></div>
        <div className="inc-kpi"><span className="inc-kpi-n">{stats.adaptacoes}</span><span className="inc-kpi-l">Adaptações registradas</span></div>
      </div>

      <div className="inc-nav">
        {(['casos','solicitacoes','pei','evidencias'] as View[]).map(v=>(
          <button key={v} className={`inc-nav-btn${view===v?' active':''}`} onClick={()=>setView(v)}>
            {v==='casos'?'Casos':v==='solicitacoes'?'Solicitações':v==='pei'?'PEI / Planos':'Evidências'}
          </button>
        ))}
      </div>

      {/* Casos */}
      {view==='casos' && (
        <div className="inc-section">
          <div className="inc-header"><h3>Casos de Apoio</h3><button className="inc-btn-primary" onClick={()=>setShowForm('case')}>+ Novo caso</button></div>
          {showForm==='case' && (
            <div className="inc-form">
              <div className="inc-form-row">
                <input placeholder="Nome do estudante" value={formCase.student_name} onChange={e=>setFormCase({...formCase,student_name:e.target.value})} />
                <input placeholder="Matrícula (opcional)" value={formCase.student_matricula} onChange={e=>setFormCase({...formCase,student_matricula:e.target.value})} />
              </div>
              <div className="inc-form-row">
                <select value={formCase.priority} onChange={e=>setFormCase({...formCase,priority:e.target.value})}>
                  <option value="normal">Normal</option><option value="urgente">Urgente</option><option value="critico">Crítico</option>
                </select>
              </div>
              <textarea placeholder="Resumo da situação" value={formCase.summary} onChange={e=>setFormCase({...formCase,summary:e.target.value})} rows={3} />
              <div className="inc-form-actions">
                <button className="inc-btn-primary" onClick={saveCase} disabled={saving||!formCase.student_name}>Abrir caso</button>
                <button className="inc-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="inc-table-wrap">
            <table className="inc-table">
              <thead><tr><th>Estudante</th><th>Prioridade<ContextHelp title="Prioridade" /></th><th>Status</th><th>Aberto em</th><th>Solicitações</th><th>Plano</th></tr></thead>
              <tbody>
                {cases.map(c=>{
                  const cr = requests.filter(r=>r.case_id===c.id);
                  const cp = plans.filter(p=>p.case_id===c.id);
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.student_name}</strong>{c.student_matricula&&<span className="inc-mono"> · {c.student_matricula}</span>}</td>
                      <td><span className={`inc-badge inc-badge-${c.priority}`}>{c.priority}</span></td>
                      <td><span className={`inc-badge inc-badge-${c.status}`}>{c.status}</span></td>
                      <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>{cr.length}</td>
                      <td>{cp.length>0?'✓ '+cp.length:'—'}</td>
                    </tr>
                  );
                })}
                {cases.length===0&&<tr><td colSpan={6} className="inc-empty-cell">Nenhum caso registrado. O módulo está pronto para receber solicitações do estudante, professor, coordenação ou Núcleo de Apoio.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Solicitações */}
      {view==='solicitacoes' && (
        <div className="inc-section">
          <div className="inc-header"><h3>Solicitações de Apoio</h3><button className="inc-btn-primary" onClick={()=>setShowForm('request')}>+ Nova solicitação</button></div>
          {showForm==='request' && (
            <div className="inc-form">
              <select value={formReq.case_id} onChange={e=>setFormReq({...formReq,case_id:e.target.value})}>
                <option value="">Vincular a um caso</option>
                {cases.map(c=><option key={c.id} value={c.id}>{c.student_name}</option>)}
              </select>
              <div className="inc-form-row">
                <select value={formReq.origin} onChange={e=>setFormReq({...formReq,origin:e.target.value})}>
                  {origins.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <select value={formReq.needs_type} onChange={e=>setFormReq({...formReq,needs_type:e.target.value})}>
                  {needsTypes.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <input placeholder="Nome do solicitante" value={formReq.requester_name} onChange={e=>setFormReq({...formReq,requester_name:e.target.value})} />
              </div>
              <textarea placeholder="Descrição da necessidade" value={formReq.description} onChange={e=>setFormReq({...formReq,description:e.target.value})} rows={3} />
              <div className="inc-form-actions">
                <button className="inc-btn-primary" onClick={saveRequest} disabled={saving||!formReq.description}>Registrar</button>
                <button className="inc-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="inc-list">
            {requests.map(r=>(
              <div key={r.id} className="inc-item">
                <div className="inc-item-header">
                  <span className="inc-badge inc-badge-type">{needsTypes.find(t=>t.v===r.needs_type)?.l||r.needs_type}</span>
                  <span className={`inc-badge inc-badge-${r.status}`}>{r.status}</span>
                </div>
                <div className="inc-item-text">{r.description}</div>
                <div className="inc-item-meta">
                  <span>Solicitado por: {r.requester_name}</span>
                  <span>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                  {r.case_id && <span>Caso: {cases.find(c=>c.id===r.case_id)?.student_name}</span>}
                </div>
              </div>
            ))}
            {requests.length===0&&<div className="inc-empty">Nenhuma solicitação registrada</div>}
          </div>
        </div>
      )}

      {/* PEI / Planos */}
      {view==='pei' && (
        <div className="inc-section">
          <div className="inc-header"><h3>Planos Educacionais Individualizados</h3><button className="inc-btn-primary" onClick={()=>setShowForm('plan')}>+ Novo plano</button></div>
          {showForm==='plan' && (
            <div className="inc-form">
              <div className="inc-form-row">
                <input aria-label="Estudante do caso" value={cases.find(c=>c.id===formPlan.case_id)?.student_name||''} readOnly />
                <select value={formPlan.case_id} onChange={e=>setFormPlan({...formPlan,case_id:e.target.value})}>
                  <option value="">Vincular a caso (obrigatório)</option>
                  {cases.map(c=><option key={c.id} value={c.id}>{c.student_name}</option>)}
                </select>
              </div>
              <div className="inc-form-row">
                <HelpLabel>Vigência início<input type="date" value={formPlan.effective_from} onChange={e=>setFormPlan({...formPlan,effective_from:e.target.value})} /></HelpLabel>
                <HelpLabel>Vigência fim<input type="date" value={formPlan.effective_until} onChange={e=>setFormPlan({...formPlan,effective_until:e.target.value})} /></HelpLabel>
              </div>
              <textarea placeholder="Objetivos do plano" value={formPlan.objectives} onChange={e=>setFormPlan({...formPlan,objectives:e.target.value})} rows={3} />
              <div className="inc-form-actions">
                <button className="inc-btn-primary" onClick={savePlan} disabled={saving||!formPlan.case_id}>Criar plano</button>
                <button className="inc-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          {plans.map(p=>{
            const pa = accommodations.filter(a=>a.plan_id===p.id);
            return (
              <div key={p.id} className="inc-plan-card">
                <div className="inc-plan-header">
                  <span className="inc-plan-type">PEI v{p.version_number||1}</span>
                  <span className={`inc-badge inc-badge-${p.status}`}>{p.status}</span>
                </div>
                <div className="inc-plan-student">{p.student_name}</div>
                {!!readableObjectives(p.objectives) && <div className="inc-plan-obj">{readableObjectives(p.objectives)}</div>}
                <div className="inc-plan-meta">
                  {p.effective_from&&<span>Vigência: {new Date(p.effective_from).toLocaleDateString('pt-BR')}</span>}
                  {p.effective_until&&<span>até {new Date(p.effective_until).toLocaleDateString('pt-BR')}</span>}
                </div>
                <div className="inc-plan-accoms">
                  <strong>Adaptações ({pa.length})</strong>
                  {pa.map(a=>(
                    <div key={a.id} className="inc-accom">
                      <span className="inc-accom-type">{accomCategories.find(t=>t.v===a.category)?.l||a.category}</span>
                      <span className="inc-accom-desc">{a.description}</span>
                      {a.responsible&&<span className="inc-accom-teacher">Resp: {a.responsible}</span>}
                    </div>
                  ))}
                  <button className="inc-btn-small" onClick={()=>{setFormAccom({...formAccom,plan_id:p.id});setShowForm('accommodation');}}>+ Adaptação</button>
                </div>
              </div>
            );
          })}
          {plans.length===0&&<div className="inc-empty">Nenhum plano individualizado criado. Crie um PEI, PAA ou PAI para iniciar o acompanhamento.</div>}
          {showForm==='accommodation' && (
            <div className="inc-form">
              <div className="inc-form-row">
                <select value={formAccom.category} onChange={e=>setFormAccom({...formAccom,category:e.target.value})}>
                  {accomCategories.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <textarea placeholder="Descrição da adaptação" value={formAccom.description} onChange={e=>setFormAccom({...formAccom,description:e.target.value})} rows={2} />
              <input placeholder="Responsável (opcional)" value={formAccom.responsible} onChange={e=>setFormAccom({...formAccom,responsible:e.target.value})} />
              <div className="inc-form-actions">
                <button className="inc-btn-primary" onClick={saveAccommodation} disabled={saving||!formAccom.description}>Salvar</button>
                <button className="inc-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evidências */}
      {view==='evidencias' && (
        <div className="inc-section">
          <h3>Evidências Regulatórias — Inclusão</h3>
          <div className="inc-evidence-grid">
            <div className="inc-ev-card">
              <div className="inc-ev-label">Casos atendidos</div>
              <div className="inc-ev-n">{cases.length}</div>
            </div>
            <div className="inc-ev-card">
              <div className="inc-ev-label">Planos em execução</div>
              <div className="inc-ev-n">{plans.filter(p=>p.status==='em_execucao'||p.status==='em_elaboracao').length}</div>
            </div>
            <div className="inc-ev-card">
              <div className="inc-ev-label">Adaptações registradas</div>
              <div className="inc-ev-n">{accommodations.length}</div>
            </div>
            <div className="inc-ev-card">
              <div className="inc-ev-label">Origens de solicitações registradas</div>
              <div className="inc-ev-n">{new Set(requests.map(r=>r.origin).filter(Boolean)).size}</div>
            </div>
          </div>
          <div className="inc-ev-note">
            Estes indicadores compõem a evidência da política institucional de inclusão e acessibilidade.
            Dados pessoais e laudos permanecem em ambiente protegido — apenas contagens agregadas são exibidas nos painéis gerais e no dossiê regulatório.
          </div>
        </div>
      )}
    </div>
  );
}
