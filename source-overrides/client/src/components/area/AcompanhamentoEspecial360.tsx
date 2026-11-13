import { HelpLabel } from '@/components/ContextHelp';
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildSupportPayload, checkedWrite, specialOrigins } from "@/lib/student-support-contracts";
import "./acompanhamento-especial360.css";

// Aligned with actual Supabase schema
interface SpecialCase { id:string; institution_id:string; student_name:string; student_matricula?:string; course_id?:string; category_id?:string; category_code?:string; protocol?:string; status:string; priority?:string; created_at:string; notes?:string; }
interface SpecialRequest { id:string; case_id:string; institution_id:string; origin?:string; category_code?:string; description:string; requester_name?:string; requested_period_start?:string; requested_period_end?:string; urgency?:string; status:string; created_at:string; }
interface SpecialDecision { id:string; case_id:string; institution_id:string; decision_type:string; status:string; authority_name?:string; regime_start?:string; regime_end?:string; justification?:string; conditions?:string; created_at:string; }
interface SpecialPlan { id:string; case_id:string; institution_id:string; student_name?:string; category_code?:string; modality?:string; status:string; plan_start?:string; plan_end?:string; elaborated_by?:string; notes?:string; created_at:string; }
interface Category { id:string; institution_id:string; code:string; label:string; description?:string; legal_basis?:string; requires_documentation:boolean; active:boolean; }

type View = 'casos'|'requerimentos'|'planos'|'indicadores';
interface Props { institutionId:string; role:string; }

export default function AcompanhamentoEspecial360(props:Props) {
  return <AcompanhamentoEspecial360Content key={props.institutionId} {...props} />;
}

function AcompanhamentoEspecial360Content({institutionId,role}:Props) {
  const [view,setView] = useState<View>('casos');
  const [cases,setCases] = useState<SpecialCase[]>([]);
  const [requests,setRequests] = useState<SpecialRequest[]>([]);
  const [decisions,setDecisions] = useState<SpecialDecision[]>([]);
  const [plans,setPlans] = useState<SpecialPlan[]>([]);
  const [categories,setCategories] = useState<Category[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [loadError,setLoadError] = useState(false);
  const loadVersion = useRef(0);
  const [saving,setSaving] = useState(false);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  useEffect(()=>{ mounted.current=true; return ()=>{mounted.current=false}; },[]);
  const [showForm,setShowForm] = useState<'case'|'request'|'decision'|'plan'|'category'|null>(null);

  const [formCase,setFormCase] = useState({student_name:'',student_matricula:'',category_id:'',notes:''});
  const [formReq,setFormReq] = useState({case_id:'',origin:'coordenacao',category_code:'',description:'',requester_name:'',requested_period_start:'',requested_period_end:''});
  const [formDecision,setFormDecision] = useState({case_id:'',decision_type:'deferimento',justification:'',conditions:'',authority_name:'',regime_start:'',regime_end:''});
  const [formPlan,setFormPlan] = useState({case_id:'',plan_start:'',plan_end:'',notes:''});
  const [formCat,setFormCat] = useState({code:'',label:'',description:'',legal_basis:'',requires_documentation:true});

  const load = useCallback(async ()=>{
    const version=++loadVersion.current;
    setLoading(true);
    try {
    const [c,r,d,p,cat] = await Promise.all([
      supabase.from('student_special_cases').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_special_requests').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_special_decisions').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_special_plans').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
      supabase.from('student_special_categories').select('*').eq('institution_id',institutionId).order('label'),
    ]);
    if (!mounted.current || version!==loadVersion.current) return;
    if ([c,r,d,p,cat].some(result=>result.error)) throw new Error('Não foi possível carregar os registros. Tente novamente.');
    setError(''); setLoadError(false);
    if(c.data) setCases(c.data);
    if(r.data) setRequests(r.data);
    if(d.data) setDecisions(d.data);
    if(p.data) setPlans(p.data);
    if(cat.data) setCategories(cat.data);
    } catch { if (mounted.current && version===loadVersion.current) { setLoadError(true); setError('Não foi possível carregar os registros. Tente novamente.'); } }
    finally { if (mounted.current && version===loadVersion.current) setLoading(false); }
  },[institutionId]);

  useEffect(()=>{load()},[load]);

  const regimeTypes = [
    {v:'exercicio_domiciliar',l:'Exercício domiciliar'},{v:'regime_especial',l:'Regime especial'},{v:'abono_faltas',l:'Abono de faltas'},
    {v:'prorrogacao_prazo',l:'Prorrogação de prazo'},{v:'avaliacao_substitutiva',l:'Avaliação substitutiva'},{v:'adaptacao_horario',l:'Adaptação de horário'},
    {v:'trancamento_parcial',l:'Trancamento parcial de disciplinas'},{v:'outro',l:'Outro'},
  ];
  const defaultCategories = [
    'Gestação','Lactação','Acidente','Recuperação pós-operatória','Tratamento de saúde','Condição temporária de saúde','Condição de saúde mental','Internação','Outro'
  ];

  const save = async (kind:string, table:string, form:Record<string,string|boolean>)=>{
    if (saveLock.current) return;
    saveLock.current=true; setSaving(true); setError('');
    try {
      const payload=buildSupportPayload(kind,form,{institutionId,cases,plans,role,categories});
      await checkedWrite(supabase.from(table).insert(payload));
      if (!mounted.current) return;
      setShowForm(null);
      setFormCase({student_name:'',student_matricula:'',category_id:'',notes:''});
      setFormReq({case_id:'',origin:'coordenacao',category_code:'',description:'',requester_name:'',requested_period_start:'',requested_period_end:''});
      setFormDecision({case_id:'',decision_type:'deferimento',justification:'',conditions:'',authority_name:'',regime_start:'',regime_end:''});
      setFormPlan({case_id:'',plan_start:'',plan_end:'',notes:''});
      setFormCat({code:'',label:'',description:'',legal_basis:'',requires_documentation:true});
      await load();
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Não foi possível salvar. Tente novamente.');
    } finally { saveLock.current=false; if (mounted.current) setSaving(false); }
  };
  const saveCase = ()=>save('specialCase','student_special_cases',formCase);
  const saveRequest = ()=>save('specialRequest','student_special_requests',formReq);
  const saveDecision = ()=>save('specialDecision','student_special_decisions',formDecision);
  const savePlan = ()=>save('specialPlan','student_special_plans',formPlan);
  const saveCategory = ()=>save('specialCategory','student_special_categories',formCat);

  const stats = {
    abertos: cases.filter(c=>!['encerrado','indeferido'].includes(c.status)).length,
    autorizados: decisions.filter(d=>d.status==='vigente'&&['deferimento','deferimento_parcial'].includes(d.decision_type)).length,
    planosAtivos: plans.filter(p=>p.status==='ativo').length,
    pendentes: requests.filter(r=>r.status==='pendente'||r.status==='em_analise').length,
  };

  if(loading) return <div className="ae-loading">Carregando acompanhamento especial…</div>;

  if (loadError) return <div role="alert">{error}<button onClick={load}>Tentar novamente</button></div>;

  return (
    <div className="ae360">
      {error && <div role="alert">{error} <button onClick={load} disabled={saving}>Recarregar</button></div>}
      {saving && <div role="status">Salvando…</div>}
      <div className="ae-kpis">
        <div className="ae-kpi"><span className="ae-kpi-n ae-warn">{stats.abertos}</span><span className="ae-kpi-l">Casos abertos</span></div>
        <div className="ae-kpi"><span className="ae-kpi-n ae-alert">{stats.pendentes}</span><span className="ae-kpi-l">Requerimentos pendentes</span></div>
        <div className="ae-kpi"><span className="ae-kpi-n ae-ok">{stats.autorizados}</span><span className="ae-kpi-l">Regimes autorizados</span></div>
        <div className="ae-kpi"><span className="ae-kpi-n">{stats.planosAtivos}</span><span className="ae-kpi-l">Planos ativos</span></div>
      </div>

      <div className="ae-nav">
        {(['casos','requerimentos','planos','indicadores'] as View[]).map(v=>(
          <button key={v} className={`ae-nav-btn${view===v?' active':''}`} onClick={()=>setView(v)}>
            {v==='casos'?'Casos':v==='requerimentos'?'Requerimentos':v==='planos'?'Planos Acadêmicos':'Indicadores'}
          </button>
        ))}
      </div>

      {/* Casos */}
      {view==='casos' && (
        <div className="ae-section">
          <div className="ae-header">
            <h3>Casos de Acompanhamento Especial</h3>
            <div className="ae-header-actions">
              <button className="ae-btn-secondary" onClick={()=>setShowForm('category')}>Categorias</button>
              <button className="ae-btn-primary" onClick={()=>setShowForm('case')}>+ Novo caso</button>
            </div>
          </div>
          {showForm==='category' && (
            <div className="ae-form">
              <h4 style={{margin:'0 0 8px'}}>Cadastrar categoria de regime especial</h4>
              <div className="ae-form-row">
                <input placeholder="Código (ex: GESTACAO)" value={formCat.code} onChange={e=>setFormCat({...formCat,code:e.target.value})} />
                <input placeholder="Nome da categoria" value={formCat.label} onChange={e=>setFormCat({...formCat,label:e.target.value})} />
                <input placeholder="Base legal (ex: Lei 6.202/1975)" value={formCat.legal_basis} onChange={e=>setFormCat({...formCat,legal_basis:e.target.value})} />
              </div>
              <textarea placeholder="Descrição" value={formCat.description} onChange={e=>setFormCat({...formCat,description:e.target.value})} rows={2} />
              <HelpLabel className="ae-checkbox"><input type="checkbox" checked={formCat.requires_documentation} onChange={e=>setFormCat({...formCat,requires_documentation:e.target.checked})} /> Exige documentação comprobatória</HelpLabel>
              <div className="ae-form-actions">
                <button className="ae-btn-primary" onClick={saveCategory} disabled={saving||!formCat.label||!formCat.code}>Salvar</button>
                <button className="ae-btn-secondary" onClick={()=>setShowForm(null)}>Fechar</button>
              </div>
              {categories.length>0 && (
                <div className="ae-cat-list">
                  {categories.map(c=><div key={c.id} className="ae-cat-item"><strong>{c.label}</strong> ({c.code}){c.legal_basis&&<span> · {c.legal_basis}</span>}</div>)}
                </div>
              )}
            </div>
          )}
          {showForm==='case' && (
            <div className="ae-form">
              <div className="ae-form-row">
                <input placeholder="Nome do estudante" value={formCase.student_name} onChange={e=>setFormCase({...formCase,student_name:e.target.value})} />
                <input placeholder="Matrícula" value={formCase.student_matricula} onChange={e=>setFormCase({...formCase,student_matricula:e.target.value})} />
              </div>
              {categories.length>0 && (
                <select value={formCase.category_id} onChange={e=>setFormCase({...formCase,category_id:e.target.value})}>
                  <option value="">Categoria (opcional)</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              <textarea placeholder="Observações" value={formCase.notes} onChange={e=>setFormCase({...formCase,notes:e.target.value})} rows={2} />
              <div className="ae-form-actions">
                <button className="ae-btn-primary" onClick={saveCase} disabled={saving||!formCase.student_name}>Abrir caso</button>
                <button className="ae-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="ae-table-wrap">
            <table className="ae-table">
              <thead><tr><th>Estudante</th><th>Categoria</th><th>Status</th><th>Aberto em</th><th>Requerimentos</th><th>Plano</th></tr></thead>
              <tbody>
                {cases.map(c=>{
                  const cr = requests.filter(r=>r.case_id===c.id);
                  const cp = plans.filter(p=>p.case_id===c.id);
                  const cat = categories.find(ct=>ct.id===c.category_id);
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.student_name}</strong>{c.student_matricula&&<span className="ae-mono"> · {c.student_matricula}</span>}</td>
                      <td>{cat?.label||'—'}</td>
                      <td><span className={`ae-badge ae-badge-${c.status}`}>{c.status}</span></td>
                      <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>{cr.length}</td>
                      <td>{cp.length>0?'✓':'—'}</td>
                    </tr>
                  );
                })}
                {cases.length===0&&<tr><td colSpan={6} className="ae-empty-cell">Nenhum caso de acompanhamento especial registrado. O módulo contempla gestação, lactação, acidentes, recuperação, tratamentos e demais hipóteses legais.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requerimentos */}
      {view==='requerimentos' && (
        <div className="ae-section">
          <div className="ae-header"><h3>Requerimentos de Regime Especial</h3><button className="ae-btn-primary" onClick={()=>setShowForm('request')}>+ Novo requerimento</button></div>
          {showForm==='request' && (
            <div className="ae-form">
              <HelpLabel>Origem<select value={formReq.origin} onChange={e=>setFormReq({...formReq,origin:e.target.value})}>{specialOrigins.map(o=><option key={o} value={o}>{o.replaceAll('_',' ')}</option>)}</select></HelpLabel>
              <select value={formReq.case_id} onChange={e=>setFormReq({...formReq,case_id:e.target.value})}>
                <option value="">Vincular a caso</option>
                {cases.map(c=><option key={c.id} value={c.id}>{c.student_name}</option>)}
              </select>
              <div className="ae-form-row">
                <select value={formReq.category_code} onChange={e=>setFormReq({...formReq,category_code:e.target.value})}>
                  <option value="">Categoria</option>
                  {categories.map(c=><option key={c.id} value={c.code}>{c.label}</option>)}
                </select>
                <input placeholder="Nome do solicitante" value={formReq.requester_name} onChange={e=>setFormReq({...formReq,requester_name:e.target.value})} />
              </div>
              <div className="ae-form-row">
                <HelpLabel>Período início<input type="date" value={formReq.requested_period_start} onChange={e=>setFormReq({...formReq,requested_period_start:e.target.value})} /></HelpLabel>
                <HelpLabel>Período fim<input type="date" value={formReq.requested_period_end} onChange={e=>setFormReq({...formReq,requested_period_end:e.target.value})} /></HelpLabel>
              </div>
              <textarea placeholder="Descrição / justificativa" value={formReq.description} onChange={e=>setFormReq({...formReq,description:e.target.value})} rows={3} />
              <div className="ae-form-actions">
                <button className="ae-btn-primary" onClick={saveRequest} disabled={saving||!formReq.case_id||!formReq.description}>Protocolar</button>
                <button className="ae-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          {requests.map(r=>{
            const rd = decisions.filter(d=>d.case_id===r.case_id);
            return (
              <div key={r.id} className="ae-req-card">
                <div className="ae-req-header">
                  <span className="ae-req-type">{categories.find(c=>c.code===r.category_code)?.label||r.category_code||'Geral'}</span>
                  <span className={`ae-badge ae-badge-${r.status}`}>{r.status}</span>
                </div>
                <div className="ae-req-student">{cases.find(c=>c.id===r.case_id)?.student_name}</div>
                <div className="ae-req-text">{r.description}</div>
                <div className="ae-req-meta">
                  {r.requester_name&&<span>Solicitante: {r.requester_name}</span>}
                  {r.requested_period_start&&<span>De {new Date(r.requested_period_start).toLocaleDateString('pt-BR')}</span>}
                  {r.requested_period_end&&<span>a {new Date(r.requested_period_end).toLocaleDateString('pt-BR')}</span>}
                </div>
                {rd.map(d=>(
                  <div key={d.id} className={`ae-decision ae-decision-${d.status}`}>
                    <strong>{d.decision_type.replaceAll('_',' ')} · {d.status}</strong>
                    {d.justification&&<span> — {d.justification}</span>}
                    {d.conditions&&<div className="ae-decision-cond">Condições: {d.conditions}</div>}
                  </div>
                ))}
                {rd.length===0 && r.status!=='recusada' && !!r.case_id && (
                  <button className="ae-btn-small" onClick={()=>{setFormDecision({...formDecision,case_id:r.case_id});setShowForm('decision');}}>Registrar decisão</button>
                )}
              </div>
            );
          })}
          {showForm==='decision' && (
            <div className="ae-form">
              <h4 style={{margin:'0 0 8px'}}>Registrar decisão</h4>
              <div className="ae-form-row">
                <select value={formDecision.decision_type} onChange={e=>setFormDecision({...formDecision,decision_type:e.target.value})}>
                  <option value="deferimento">Deferimento</option>
                  <option value="indeferimento">Indeferimento</option>
                  <option value="deferimento_parcial">Deferimento parcial</option>
                </select>
                <input placeholder="Autoridade responsável" value={formDecision.authority_name} onChange={e=>setFormDecision({...formDecision,authority_name:e.target.value})} />
              </div>
              <textarea placeholder="Justificativa" value={formDecision.justification} onChange={e=>setFormDecision({...formDecision,justification:e.target.value})} rows={2} />
              <textarea placeholder="Condições / restrições (opcional)" value={formDecision.conditions} onChange={e=>setFormDecision({...formDecision,conditions:e.target.value})} rows={2} />
              <div className="ae-form-actions">
                <button className="ae-btn-primary" onClick={saveDecision} disabled={saving||!formDecision.justification.trim()||!role}>Registrar</button>
                <button className="ae-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          {requests.length===0&&<div className="ae-empty">Nenhum requerimento registrado</div>}
        </div>
      )}

      {/* Planos */}
      {view==='planos' && (
        <div className="ae-section">
          <div className="ae-header"><h3>Planos Acadêmicos Especiais</h3><button className="ae-btn-primary" onClick={()=>setShowForm('plan')}>+ Novo plano</button></div>
          {showForm==='plan' && (
            <div className="ae-form">
              <select value={formPlan.case_id} onChange={e=>setFormPlan({...formPlan,case_id:e.target.value})}>
                <option value="">Vincular a caso</option>
                {cases.map(c=><option key={c.id} value={c.id}>{c.student_name}</option>)}
              </select>
              <div className="ae-form-row">
                <input type="date" value={formPlan.plan_start} onChange={e=>setFormPlan({...formPlan,plan_start:e.target.value})} />
                <input type="date" value={formPlan.plan_end} onChange={e=>setFormPlan({...formPlan,plan_end:e.target.value})} />
              </div>
              <textarea placeholder="Observações e orientações" value={formPlan.notes} onChange={e=>setFormPlan({...formPlan,notes:e.target.value})} rows={3} />
              <div className="ae-form-actions">
                <button className="ae-btn-primary" onClick={savePlan} disabled={saving||!formPlan.case_id}>Criar plano</button>
                <button className="ae-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          {plans.map(p=>(
            <div key={p.id} className="ae-plan-card">
              <div className="ae-plan-header">
                <span className="ae-plan-type">{p.category_code||'Plano acadêmico'}</span>
                <span className={`ae-badge ae-badge-${p.status}`}>{p.status}</span>
              </div>
              <div className="ae-plan-student">{p.student_name||cases.find(c=>c.id===p.case_id)?.student_name}</div>
              {p.notes&&<div className="ae-plan-obj">{p.notes}</div>}
              <div className="ae-plan-meta">
                {p.elaborated_by&&<span>Elaborado por: {p.elaborated_by}</span>}
                {p.plan_start&&<span>De {new Date(p.plan_start).toLocaleDateString('pt-BR')}</span>}
                {p.plan_end&&<span>a {new Date(p.plan_end).toLocaleDateString('pt-BR')}</span>}
              </div>
            </div>
          ))}
          {plans.length===0&&<div className="ae-empty">Nenhum plano acadêmico especial criado</div>}
        </div>
      )}

      {/* Indicadores */}
      {view==='indicadores' && (
        <div className="ae-section">
          <h3>Indicadores — Acompanhamento Especial</h3>
          <div className="ae-ind-grid">
            <div className="ae-ind-card"><div className="ae-ind-label">Total de casos</div><div className="ae-ind-n">{cases.length}</div></div>
            <div className="ae-ind-card"><div className="ae-ind-label">Regimes autorizados</div><div className="ae-ind-n ae-ok">{stats.autorizados}</div></div>
            <div className="ae-ind-card"><div className="ae-ind-label">Planos ativos</div><div className="ae-ind-n">{stats.planosAtivos}</div></div>
            <div className="ae-ind-card"><div className="ae-ind-label">Categorias cadastradas</div><div className="ae-ind-n">{categories.length}</div></div>
          </div>
          <div className="ae-ind-note">
            Indicadores agregados para o BI da Reitoria e dossiê regulatório.
            CID, laudos e informações clínicas não são exibidos — apenas o quantitativo por categoria e status.
            O término do prazo inicia revisão ou retorno, sem encerramento automático de pendências.
          </div>
        </div>
      )}
    </div>
  );
}
