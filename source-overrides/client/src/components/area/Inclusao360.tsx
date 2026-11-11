import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./inclusao360.css";

interface SupportCase { id:string; institution_id:string; student_name:string; enrollment_id?:string; course_id?:string; entry_channel:string; urgency:string; status:string; assigned_to?:string; opened_at:string; closed_at?:string; notes?:string; }
interface SupportRequest { id:string; case_id:string; institution_id:string; request_type:string; description:string; requested_by:string; status:string; created_at:string; }
interface IndividualPlan { id:string; case_id:string; institution_id:string; student_name:string; plan_type:string; status:string; start_date?:string; end_date?:string; coordinator_name?:string; created_at:string; objectives?:string; }
interface Accommodation { id:string; plan_id:string; institution_id:string; accommodation_type:string; description:string; discipline?:string; teacher_name?:string; status:string; }

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

  const [formCase,setFormCase] = useState({student_name:'',enrollment_id:'',entry_channel:'coordenacao',urgency:'normal',notes:''});
  const [formReq,setFormReq] = useState({case_id:'',request_type:'apoio_pedagogico',description:'',requested_by:''});
  const [formPlan,setFormPlan] = useState({case_id:'',student_name:'',plan_type:'pei',objectives:'',coordinator_name:'',start_date:'',end_date:''});
  const [formAccom,setFormAccom] = useState({plan_id:'',accommodation_type:'tempo_adicional',description:'',discipline:'',teacher_name:''});

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

  const entryChannels = [{v:'estudante',l:'Estudante'},{v:'professor',l:'Professor'},{v:'coordenacao',l:'Coordenação'},{v:'secretaria',l:'Secretaria'},{v:'nucleo_apoio',l:'Núcleo de Apoio'},{v:'fato_ordem',l:'Fato & Ordem'}];
  const requestTypes = [{v:'apoio_pedagogico',l:'Apoio Pedagógico'},{v:'acessibilidade',l:'Acessibilidade'},{v:'apoio_psicologico',l:'Apoio Psicológico'},{v:'adaptacao_curricular',l:'Adaptação Curricular'},{v:'recurso_assistivo',l:'Recurso Assistivo'},{v:'interprete_libras',l:'Intérprete de Libras'},{v:'outro',l:'Outro'}];
  const planTypes = [{v:'pei',l:'PEI — Plano Educacional Individualizado'},{v:'paa',l:'PAA — Plano de Acompanhamento Acadêmico'},{v:'pai',l:'PAI — Plano de Acessibilidade Individual'}];
  const accomTypes = [{v:'tempo_adicional',l:'Tempo adicional em provas'},{v:'material_adaptado',l:'Material adaptado'},{v:'sala_reservada',l:'Sala reservada'},{v:'interprete',l:'Intérprete de Libras'},{v:'tecnologia_assistiva',l:'Tecnologia assistiva'},{v:'adaptacao_avaliativa',l:'Adaptação avaliativa'},{v:'tutoria',l:'Tutoria'},{v:'outro',l:'Outra adaptação'}];

  const saveCase = async ()=>{
    await supabase.from('student_support_cases').insert({institution_id:institutionId,student_name:formCase.student_name,enrollment_id:formCase.enrollment_id||null,entry_channel:formCase.entry_channel,urgency:formCase.urgency,status:'aberto',opened_at:new Date().toISOString(),notes:formCase.notes||null});
    setShowForm(null); load();
  };
  const saveRequest = async ()=>{
    await supabase.from('student_support_requests').insert({institution_id:institutionId,case_id:formReq.case_id,request_type:formReq.request_type,description:formReq.description,requested_by:formReq.requested_by,status:'pendente'});
    setShowForm(null); load();
  };
  const savePlan = async ()=>{
    await supabase.from('student_individual_plans').insert({institution_id:institutionId,case_id:formPlan.case_id||null,student_name:formPlan.student_name,plan_type:formPlan.plan_type,objectives:formPlan.objectives||null,coordinator_name:formPlan.coordinator_name||null,start_date:formPlan.start_date||null,end_date:formPlan.end_date||null,status:'em_elaboracao'});
    setShowForm(null); load();
  };
  const saveAccommodation = async ()=>{
    await supabase.from('student_plan_accommodations').insert({institution_id:institutionId,plan_id:formAccom.plan_id,accommodation_type:formAccom.accommodation_type,description:formAccom.description,discipline:formAccom.discipline||null,teacher_name:formAccom.teacher_name||null,status:'pendente'});
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
                <input placeholder="Matrícula (opcional)" value={formCase.enrollment_id} onChange={e=>setFormCase({...formCase,enrollment_id:e.target.value})} />
              </div>
              <div className="inc-form-row">
                <select value={formCase.entry_channel} onChange={e=>setFormCase({...formCase,entry_channel:e.target.value})}>
                  {entryChannels.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
                <select value={formCase.urgency} onChange={e=>setFormCase({...formCase,urgency:e.target.value})}>
                  <option value="normal">Normal</option><option value="urgente">Urgente</option><option value="critico">Crítico</option>
                </select>
              </div>
              <textarea placeholder="Observações iniciais" value={formCase.notes} onChange={e=>setFormCase({...formCase,notes:e.target.value})} rows={3} />
              <div className="inc-form-actions">
                <button className="inc-btn-primary" onClick={saveCase} disabled={!formCase.student_name}>Abrir caso</button>
                <button className="inc-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="inc-table-wrap">
            <table className="inc-table">
              <thead><tr><th>Estudante</th><th>Canal</th><th>Urgência</th><th>Status</th><th>Aberto em</th><th>Solicitações</th><th>Plano</th></tr></thead>
              <tbody>
                {cases.map(c=>{
                  const cr = requests.filter(r=>r.case_id===c.id);
                  const cp = plans.filter(p=>p.case_id===c.id);
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.student_name}</strong>{c.enrollment_id&&<span className="inc-mono"> · {c.enrollment_id}</span>}</td>
                      <td>{entryChannels.find(ch=>ch.v===c.entry_channel)?.l||c.entry_channel}</td>
                      <td><span className={`inc-badge inc-badge-${c.urgency}`}>{c.urgency}</span></td>
                      <td><span className={`inc-badge inc-badge-${c.status}`}>{c.status}</span></td>
                      <td>{new Date(c.opened_at).toLocaleDateString('pt-BR')}</td>
                      <td>{cr.length}</td>
                      <td>{cp.length>0?'✓ '+cp.length:'—'}</td>
                    </tr>
                  );
                })}
                {cases.length===0&&<tr><td colSpan={7} className="inc-empty-cell">Nenhum caso registrado. O módulo está pronto para receber solicitações do estudante, professor, coordenação ou Núcleo de Apoio.</td></tr>}
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
                <select value={formReq.request_type} onChange={e=>setFormReq({...formReq,request_type:e.target.value})}>
                  {requestTypes.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <input placeholder="Solicitado por" value={formReq.requested_by} onChange={e=>setFormReq({...formReq,requested_by:e.target.value})} />
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
                  <span className="inc-badge inc-badge-type">{requestTypes.find(t=>t.v===r.request_type)?.l||r.request_type}</span>
                  <span className={`inc-badge inc-badge-${r.status}`}>{r.status}</span>
                </div>
                <div className="inc-item-text">{r.description}</div>
                <div className="inc-item-meta">
                  <span>Solicitado por: {r.requested_by}</span>
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
                <select value={formPlan.plan_type} onChange={e=>setFormPlan({...formPlan,plan_type:e.target.value})}>
                  {planTypes.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div className="inc-form-row">
                <select value={formPlan.case_id} onChange={e=>setFormPlan({...formPlan,case_id:e.target.value})}>
                  <option value="">Vincular a caso (opcional)</option>
                  {cases.map(c=><option key={c.id} value={c.id}>{c.student_name}</option>)}
                </select>
                <input placeholder="Coordenador responsável" value={formPlan.coordinator_name} onChange={e=>setFormPlan({...formPlan,coordinator_name:e.target.value})} />
              </div>
              <div className="inc-form-row">
                <input type="date" value={formPlan.start_date} onChange={e=>setFormPlan({...formPlan,start_date:e.target.value})} />
                <input type="date" value={formPlan.end_date} onChange={e=>setFormPlan({...formPlan,end_date:e.target.value})} />
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
                  <span className="inc-plan-type">{planTypes.find(t=>t.v===p.plan_type)?.l||p.plan_type}</span>
                  <span className={`inc-badge inc-badge-${p.status}`}>{p.status}</span>
                </div>
                <div className="inc-plan-student">{p.student_name}</div>
                {p.objectives && <div className="inc-plan-obj">{p.objectives}</div>}
                <div className="inc-plan-meta">
                  {p.coordinator_name&&<span>Coord: {p.coordinator_name}</span>}
                  {p.start_date&&<span>Início: {new Date(p.start_date).toLocaleDateString('pt-BR')}</span>}
                </div>
                <div className="inc-plan-accoms">
                  <strong>Adaptações ({pa.length})</strong>
                  {pa.map(a=>(
                    <div key={a.id} className="inc-accom">
                      <span className="inc-accom-type">{accomTypes.find(t=>t.v===a.accommodation_type)?.l||a.accommodation_type}</span>
                      <span className="inc-accom-desc">{a.description}</span>
                      {a.teacher_name&&<span className="inc-accom-teacher">Prof. {a.teacher_name}</span>}
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
                <select value={formAccom.accommodation_type} onChange={e=>setFormAccom({...formAccom,accommodation_type:e.target.value})}>
                  {accomTypes.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <input placeholder="Disciplina (opcional)" value={formAccom.discipline} onChange={e=>setFormAccom({...formAccom,discipline:e.target.value})} />
              </div>
              <textarea placeholder="Descrição da adaptação" value={formAccom.description} onChange={e=>setFormAccom({...formAccom,description:e.target.value})} rows={2} />
              <input placeholder="Professor responsável (opcional)" value={formAccom.teacher_name} onChange={e=>setFormAccom({...formAccom,teacher_name:e.target.value})} />
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
