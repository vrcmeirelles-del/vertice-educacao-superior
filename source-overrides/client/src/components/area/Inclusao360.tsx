import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./inclusao360.css";

// Aligned with actual Supabase schema
interface SupportCase { id:string; institution_id:string; student_name:string; student_matricula?:string; course_id?:string; protocol?:string; priority:string; status:string; summary?:string; assigned_to?:string; created_at:string; closed_at?:string; }
interface SupportRequest { id:string; case_id:string; institution_id:string; origin:string; needs_type:string; description:string; requester_name:string; urgency?:string; status:string; created_at:string; }
interface IndividualPlan { id:string; case_id:string; institution_id:string; student_name:string; status:string; effective_from?:string; effective_until?:string; objectives?:string; created_at:string; version_number?:number; }
interface Accommodation { id:string; plan_id:string; institution_id:string; category:string; description:string; details?:string; responsible?:string; status:string; }

type View = 'casos'|'solicitacoes'|'pei'|'evidencias';
interface Props { institutionId:string; role:string; }

export default function Inclusao360({institutionId,role}:Props) {
  const [view,setView] = useState<View>('casos');
  const [cases,setCases] = useState<SupportCase[]>([]);
  const [requests,setRequests] = useState<SupportRequest[]>([]);
  const [plans,setPlans] = useState<IndividualPlan[]>([]);
  const [accommodations,setAccommodations] = useState<Accommodation[]>([]);
  const [loading,setLoading] = useState(true);
  const [showForm,setShowForm] = useState<'case'|'request'|'plan'|'accommodation'|null>(null);

  const [formCase,setFormCase] = useState({student_name:'',student_matricula:'',priority:'normal',summary:''});
  const [formReq,setFormReq] = useState({case_id:'',origin:'coordenacao',needs_type:'apoio_pedagogico',description:'',requester_name:''});
  const [formPlan,setFormPlan] = useState({case_id:'',student_name:'',objectives:'',effective_from:'',effective_until:''});
  const [formAccom,setFormAccom] = useState({plan_id:'',category:'tempo_adicional',description:'',responsible:''});

  const load = useCallback(async ()=>{
    setLoading(true);
    const [c,r,p,a] = await Promise.all([
      supabase.from('student_support_cases').select('*').eq('institution_id',institutionId).order('opened_at',{ascending:false}),
      supabase.from('student_support_requests').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_individual_plans').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_plan_accommodations').select('*').eq('institution_id',institutionId).order('accommodation_type'),
    ]);
    if(c.data) setCases(c.data);
    if(r.data) setRequests(r.data);
    if(p.data) setPlans(p.data);
    if(a.data) setAccommodations(a.data);
    setLoading(false);
  },[institutionId]);

  useEffect(()=>{load()},[load]);

  const origins = [{v:'estudante',l:'Estudante'},{v:'professor',l:'Professor'},{v:'coordenacao',l:'Coordenação'},{v:'secretaria',l:'Secretaria'},{v:'nucleo_apoio',l:'Núcleo de Apoio'},{v:'fato_ordem',l:'Fato & Ordem'}];
  const needsTypes = [{v:'apoio_pedagogico',l:'Apoio Pedagógico'},{v:'acessibilidade',l:'Acessibilidade'},{v:'apoio_psicologico',l:'Apoio Psicológico'},{v:'adaptacao_curricular',l:'Adaptação Curricular'},{v:'recurso_assistivo',l:'Recurso Assistivo'},{v:'interprete_libras',l:'Intérprete de Libras'},{v:'outro',l:'Outro'}];
  const accomCategories = [{v:'tempo_adicional',l:'Tempo adicional em provas'},{v:'material_adaptado',l:'Material adaptado'},{v:'sala_reservada',l:'Sala reservada'},{v:'interprete',l:'Intérprete de Libras'},{v:'tecnologia_assistiva',l:'Tecnologia assistiva'},{v:'adaptacao_avaliativa',l:'Adaptação avaliativa'},{v:'tutoria',l:'Tutoria'},{v:'outro',l:'Outra adaptação'}];

  const saveCase = async ()=>{
    await supabase.from('student_support_cases').insert({institution_id:institutionId,student_name:formCase.student_name,student_matricula:formCase.student_matricula||null,priority:formCase.priority,status:'aberto',summary:formCase.summary||null});
    setShowForm(null); load();
  };
  const saveRequest = async ()=>{
    await supabase.from('student_support_requests').insert({institution_id:institutionId,case_id:formReq.case_id||null,origin:formReq.origin,needs_type:formReq.needs_type,description:formReq.description,requester_name:formReq.requester_name,status:'pendente'});
    setShowForm(null); load();
  };
  const savePlan = async ()=>{
    await supabase.from('student_individual_plans').insert({institution_id:institutionId,case_id:formPlan.case_id||null,student_name:formPlan.student_name,objectives:formPlan.objectives||null,effective_from:formPlan.effective_from||null,effective_until:formPlan.effective_until||null,status:'em_elaboracao'});
    setShowForm(null); load();
  };
  const saveAccommodation = async ()=>{
    await supabase.from('student_plan_accommodations').insert({institution_id:institutionId,plan_id:formAccom.plan_id,category:formAccom.category,description:formAccom.description,responsible:formAccom.responsible||null,status:'pendente'});
    setShowForm(null); load();
  };

  const stats = {
    abertos: cases.filter(c=>c.status==='aberto').length,
    emAtendimento: cases.filter(c=>c.status==='em_atendimento').length,
    planos: plans.length,
    adaptacoes: accommodations.length,
  };

  if(loading) return <div className="inc-loading">Carregando inclusão…</div>;

  return (
    <div className="inc360">
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
                <button className="inc-btn-primary" onClick={saveCase} disabled={!formCase.student_name}>Abrir caso</button>
                <button className="inc-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="inc-table-wrap">
            <table className="inc-table">
              <thead><tr><th>Estudante</th><th>Prioridade</th><th>Status</th><th>Aberto em</th><th>Solicitações</th><th>Plano</th></tr></thead>
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
                <button className="inc-btn-primary" onClick={saveRequest} disabled={!formReq.description}>Registrar</button>
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
                <input placeholder="Nome do estudante" value={formPlan.student_name} onChange={e=>setFormPlan({...formPlan,student_name:e.target.value})} />
                <select value={formPlan.case_id} onChange={e=>setFormPlan({...formPlan,case_id:e.target.value})}>
                  <option value="">Vincular a caso (opcional)</option>
                  {cases.map(c=><option key={c.id} value={c.id}>{c.student_name}</option>)}
                </select>
              </div>
              <div className="inc-form-row">
                <label>Vigência início<input type="date" value={formPlan.effective_from} onChange={e=>setFormPlan({...formPlan,effective_from:e.target.value})} /></label>
                <label>Vigência fim<input type="date" value={formPlan.effective_until} onChange={e=>setFormPlan({...formPlan,effective_until:e.target.value})} /></label>
              </div>
              <textarea placeholder="Objetivos do plano" value={formPlan.objectives} onChange={e=>setFormPlan({...formPlan,objectives:e.target.value})} rows={3} />
              <div className="inc-form-actions">
                <button className="inc-btn-primary" onClick={savePlan} disabled={!formPlan.student_name}>Criar plano</button>
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
                {p.objectives && <div className="inc-plan-obj">{p.objectives}</div>}
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
                <button className="inc-btn-primary" onClick={saveAccommodation} disabled={!formAccom.description}>Salvar</button>
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
              <div className="inc-ev-label">Canais de entrada ativos</div>
              <div className="inc-ev-n">{new Set(cases.map(c=>c.entry_channel)).size}</div>
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
