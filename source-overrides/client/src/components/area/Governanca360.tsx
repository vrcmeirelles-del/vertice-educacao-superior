import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./governanca360.css";

// ─── Types aligned with actual Supabase schema ───
interface Body { id:string; institution_id:string; name:string; body_type:string; acronym?:string; creation_instrument?:string; regiment_summary?:string; status:string; course_id?:string; president_name?:string; secretary_name?:string; meeting_frequency?:string; notes?:string; created_at:string; }
interface Member { id:string; body_id:string; institution_id:string; member_name:string; member_email?:string; role_in_body:string; segment?:string; is_active:boolean; mandate_start?:string; mandate_end?:string; designation_act?:string; }
interface Meeting { id:string; body_id:string; institution_id:string; meeting_number?:string; meeting_type:string; scheduled_date:string; scheduled_time?:string; location?:string; status:string; quorum_present?:number; quorum_total?:number; agenda?:any; notes?:string; }
interface Deliberation { id:string; meeting_id:string; institution_id:string; body_id:string; protocol:string; subject:string; full_text:string; decision_type:string; nature?:string; priority?:string; due_date?:string; responsible_name?:string; responsible_user_id?:string; status:string; action_id?:string; goal_id?:string; target_sector?:string; ai_extracted?:boolean; created_at:string; }

type View = 'orgaos'|'reunioes'|'deliberacoes'|'timeline'|'vinculos';
interface GovLink { id:string; deliberation_id:string; target_module:string; target_label:string|null; link_type:string; notes:string|null; }

interface Props { institutionId:string; role:string; }

export default function Governanca360({institutionId, role}:Props) {
  const [view, setView] = useState<View>('orgaos');
  const [bodies, setBodies] = useState<Body[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [deliberations, setDeliberations] = useState<Deliberation[]>([]);
  const [govLinks, setGovLinks] = useState<GovLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBody, setSelectedBody] = useState<string|null>(null);
  const [showForm, setShowForm] = useState<'body'|'meeting'|'deliberation'|null>(null);

  // ─── Form state ───
  const [formBody, setFormBody] = useState({name:'',body_type:'nde',acronym:'',creation_instrument:'',regiment_summary:'',course_id:''});
  const [formMeeting, setFormMeeting] = useState({body_id:'',meeting_type:'ordinaria',scheduled_date:'',location:'',notes:''});
  const [formDelib, setFormDelib] = useState({meeting_id:'',protocol:'',subject:'',decision_type:'resolucao',full_text:'',due_date:'',responsible_name:'',priority:'media',target_sector:''});

  const load = useCallback(async () => {
    setLoading(true);
    const [b,m,mt,d] = await Promise.all([
      supabase.from('governance_bodies').select('*').eq('institution_id',institutionId).order('name'),
      supabase.from('governance_members').select('*').eq('institution_id',institutionId).order('name'),
      supabase.from('governance_meetings').select('*').eq('institution_id',institutionId).order('scheduled_date',{ascending:false}),
      supabase.from('governance_deliberations').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
    ]);
    if(b.data) setBodies(b.data);
    if(m.data) setMembers(m.data);
    if(mt.data) setMeetings(mt.data);
    if(d.data) setDeliberations(d.data);
    // Load academic module links
    supabase.from('vertice_governance_links').select('*').eq('institution_id',institutionId).then(r => { if(r.data) setGovLinks(r.data); });
    setLoading(false);
  },[institutionId]);

  useEffect(()=>{load()},[load]);

  const bodyTypes = [
    {value:'nde',label:'NDE'},
    {value:'colegiado',label:'Colegiado de Curso'},
    {value:'conselho_superior',label:'Conselho Superior'},
    {value:'cpa',label:'CPA'},
    {value:'nucleo_docente',label:'Núcleo Docente'},
    {value:'comissao',label:'Comissão'},
    {value:'outro',label:'Outro'},
  ];

  const saveBody = async () => {
    const {error} = await supabase.from('governance_bodies').insert({
      institution_id:institutionId,
      name:formBody.name,
      body_type:formBody.body_type,
      acronym:formBody.acronym||null,
      creation_instrument:formBody.creation_instrument||null,
      regiment_summary:formBody.regiment_summary||null,
      course_id:formBody.course_id||null,
      status:'ativo',
    });
    if(!error){setShowForm(null);setFormBody({name:'',body_type:'nde',acronym:'',creation_instrument:'',regiment_summary:'',course_id:''});load();}
  };

  const saveMeeting = async () => {
    const {error} = await supabase.from('governance_meetings').insert({
      institution_id:institutionId,
      body_id:formMeeting.body_id,
      meeting_type:formMeeting.meeting_type,
      scheduled_date:formMeeting.scheduled_date,
      location:formMeeting.location||null,
      notes:formMeeting.notes||null,
      status:'agendada',
    });
    if(!error){setShowForm(null);setFormMeeting({body_id:'',meeting_type:'ordinaria',scheduled_date:'',location:'',notes:''});load();}
  };

  const saveDeliberation = async () => {
    const {error} = await supabase.from('governance_deliberations').insert({
      institution_id:institutionId,
      meeting_id:formDelib.meeting_id,
      body_id: meetings.find(m=>m.id===formDelib.meeting_id)?.body_id || '',
      protocol:formDelib.protocol,
      subject:formDelib.subject,
      decision_type:formDelib.decision_type,
      full_text:formDelib.full_text,
      due_date:formDelib.due_date||null,
      responsible_name:formDelib.responsible_name||null,
      priority:formDelib.priority,
      target_sector:formDelib.target_sector||null,
      status:'aprovada',
    });
    if(!error){setShowForm(null);load();}
  };

  const createActionFrom = async (d:Deliberation) => {
    await supabase.from('vertice_actions').insert({
      institution_id:institutionId,
      goal_id:null,
      what:d.subject,
      why:`Deliberação ${d.protocol}: ${d.full_text.slice(0,200)}`,
      who:d.responsible_name||'A definir',
      due_date:d.due_date||null,
      status:'pendente',
      progress:0,
      origin_type: d.decision_type==='resolucao'?'colegiado':'nde',
      origin_ref:d.id,
      origin_label:`Deliberação ${d.protocol}`,
      deliberation_id:d.id,
    });
    // Update deliberation with action link
    // (action_id will be set after the action is created — for now just reload)
    load();
  };

  const filteredMeetings = selectedBody ? meetings.filter(m=>m.body_id===selectedBody) : meetings;
  const filteredDelibs = selectedBody ? deliberations.filter(d=>d.body_id===selectedBody) : deliberations;
  const pendingActions = deliberations.filter(d=>!d.action_id && d.status==='aprovada');

  const stats = useMemo(()=>({
    orgaos: bodies.filter(b=>b.status==='ativo').length,
    membros: members.filter(m=>m.is_active).length,
    reunioes: meetings.length,
    deliberacoes: deliberations.length,
    pendentes: pendingActions.length,
  }),[bodies,members,meetings,deliberations,pendingActions]);

  if(loading) return <div className="gov-loading">Carregando governança…</div>;

  return (
    <div className="gov360">
      {/* KPIs */}
      <div className="gov-kpis">
        <div className="gov-kpi"><span className="gov-kpi-n">{stats.orgaos}</span><span className="gov-kpi-l">Órgãos ativos</span></div>
        <div className="gov-kpi"><span className="gov-kpi-n">{stats.membros}</span><span className="gov-kpi-l">Membros</span></div>
        <div className="gov-kpi"><span className="gov-kpi-n">{stats.reunioes}</span><span className="gov-kpi-l">Reuniões</span></div>
        <div className="gov-kpi"><span className="gov-kpi-n">{stats.deliberacoes}</span><span className="gov-kpi-l">Deliberações</span></div>
        <div className="gov-kpi gov-kpi-alert"><span className="gov-kpi-n">{stats.pendentes}</span><span className="gov-kpi-l">Ações pendentes</span></div>
      </div>

      {/* Nav */}
      <div className="gov-nav">
        {(['orgaos','reunioes','deliberacoes','timeline','vinculos'] as View[]).map(v=>(
          <button key={v} className={`gov-nav-btn${view===v?' active':''}`} onClick={()=>setView(v)}>
            {v==='orgaos'?'Órgãos':v==='reunioes'?'Reuniões':v==='deliberacoes'?'Deliberações':v==='vinculos'?'🔗 Módulos':'Timeline'}
          </button>
        ))}
        {bodies.length>0 && (
          <select className="gov-filter" value={selectedBody||''} onChange={e=>setSelectedBody(e.target.value||null)}>
            <option value="">Todos os órgãos</option>
            {bodies.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* ─── Órgãos ─── */}
      {view==='orgaos' && (
        <div className="gov-section">
          <div className="gov-header">
            <h3>Órgãos Colegiados</h3>
            <button className="gov-btn-primary" onClick={()=>setShowForm('body')}>+ Novo órgão</button>
          </div>
          {showForm==='body' && (
            <div className="gov-form">
              <div className="gov-form-row">
                <input placeholder="Nome do órgão" value={formBody.name} onChange={e=>setFormBody({...formBody,name:e.target.value})} />
                <select value={formBody.body_type} onChange={e=>setFormBody({...formBody,body_type:e.target.value})}>
                  {bodyTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="gov-form-row">
                <input placeholder="Sigla (ex: NDE-DIR)" value={formBody.acronym} onChange={e=>setFormBody({...formBody,acronym:e.target.value})} />
                <input placeholder="Instrumento de criação (ex: Resolução nº 5/2018)" value={formBody.creation_instrument} onChange={e=>setFormBody({...formBody,creation_instrument:e.target.value})} />
              </div>
              <textarea placeholder="Resumo do regimento e competências" value={formBody.regiment_summary} onChange={e=>setFormBody({...formBody,regiment_summary:e.target.value})} rows={3} />
              <div className="gov-form-actions">
                <button className="gov-btn-primary" onClick={saveBody} disabled={!formBody.name}>Salvar</button>
                <button className="gov-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="gov-cards">
            {bodies.map(b=>{
              const bMembers = members.filter(m=>m.body_id===b.id && m.is_active);
              const bMeetings = meetings.filter(m=>m.body_id===b.id);
              const bDelibs = deliberations.filter(d=>d.body_id===b.id);
              return (
                <div key={b.id} className="gov-card" onClick={()=>{setSelectedBody(b.id);setView('reunioes');}}>
                  <div className="gov-card-type">{bodyTypes.find(t=>t.value===b.body_type)?.label||b.body_type}</div>
                  <div className="gov-card-name">{b.name}</div>
                  {b.creation_instrument && <div className="gov-card-basis">{b.creation_instrument}</div>}
                  <div className="gov-card-stats">
                    <span>{bMembers.length} membros</span>
                    <span>{bMeetings.length} reuniões</span>
                    <span>{bDelibs.length} deliberações</span>
                  </div>
                </div>
              );
            })}
            {bodies.length===0 && <div className="gov-empty">Nenhum órgão cadastrado. Comece criando o NDE ou o Colegiado de Curso.</div>}
          </div>
        </div>
      )}

      {/* ─── Reuniões ─── */}
      {view==='reunioes' && (
        <div className="gov-section">
          <div className="gov-header">
            <h3>Reuniões{selectedBody ? ` · ${bodies.find(b=>b.id===selectedBody)?.name}`:''}</h3>
            <button className="gov-btn-primary" onClick={()=>setShowForm('meeting')}>+ Nova reunião</button>
          </div>
          {showForm==='meeting' && (
            <div className="gov-form">
              <div className="gov-form-row">
                <select value={formMeeting.body_id} onChange={e=>setFormMeeting({...formMeeting,body_id:e.target.value})}>
                  <option value="">Selecione o órgão</option>
                  {bodies.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={formMeeting.meeting_type} onChange={e=>setFormMeeting({...formMeeting,meeting_type:e.target.value})}>
                  <option value="ordinaria">Ordinária</option>
                  <option value="extraordinaria">Extraordinária</option>
                </select>
              </div>
              <div className="gov-form-row">
                <input type="datetime-local" value={formMeeting.scheduled_date} onChange={e=>setFormMeeting({...formMeeting,scheduled_date:e.target.value})} />
                <input placeholder="Local" value={formMeeting.location} onChange={e=>setFormMeeting({...formMeeting,location:e.target.value})} />
              </div>
              <textarea placeholder="Pauta / Observações" value={formMeeting.notes} onChange={e=>setFormMeeting({...formMeeting,notes:e.target.value})} rows={3} />
              <div className="gov-form-actions">
                <button className="gov-btn-primary" onClick={saveMeeting} disabled={!formMeeting.body_id||!formMeeting.scheduled_date}>Salvar</button>
                <button className="gov-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="gov-table-wrap">
            <table className="gov-table">
              <thead><tr><th>Data</th><th>Órgão</th><th>Tipo</th><th>Status</th><th>Deliberações</th></tr></thead>
              <tbody>
                {filteredMeetings.map(m=>{
                  const md = deliberations.filter(d=>d.meeting_id===m.id);
                  return (
                    <tr key={m.id}>
                      <td>{new Date(m.scheduled_date).toLocaleDateString('pt-BR')}</td>
                      <td>{bodies.find(b=>b.id===m.body_id)?.name||'—'}</td>
                      <td className="gov-capitalize">{m.meeting_type}</td>
                      <td><span className={`gov-badge gov-badge-${m.status}`}>{m.status}</span></td>
                      <td>{md.length}</td>
                    </tr>
                  );
                })}
                {filteredMeetings.length===0 && <tr><td colSpan={5} className="gov-empty-cell">Nenhuma reunião registrada</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Deliberações ─── */}
      {view==='deliberacoes' && (
        <div className="gov-section">
          <div className="gov-header">
            <h3>Deliberações</h3>
            <button className="gov-btn-primary" onClick={()=>setShowForm('deliberation')}>+ Nova deliberação</button>
          </div>
          {showForm==='deliberation' && (
            <div className="gov-form">
              <div className="gov-form-row">
                <select value={formDelib.meeting_id} onChange={e=>setFormDelib({...formDelib,meeting_id:e.target.value})}>
                  <option value="">Selecione a reunião</option>
                  {meetings.map(m=><option key={m.id} value={m.id}>{new Date(m.scheduled_date).toLocaleDateString('pt-BR')} — {bodies.find(b=>b.id===m.body_id)?.name}</option>)}
                </select>
                <input placeholder="Protocolo da deliberação" value={formDelib.protocol} onChange={e=>setFormDelib({...formDelib,protocol:e.target.value})} />
              </div>
              <input placeholder="Assunto" value={formDelib.subject} onChange={e=>setFormDelib({...formDelib,subject:e.target.value})} />
              <textarea placeholder="Texto completo da decisão" value={formDelib.full_text} onChange={e=>setFormDelib({...formDelib,full_text:e.target.value})} rows={4} />
              <div className="gov-form-row">
                <select value={formDelib.decision_type} onChange={e=>setFormDelib({...formDelib,decision_type:e.target.value})}>
                  <option value="resolucao">Resolução</option>
                  <option value="parecer">Parecer</option>
                  <option value="recomendacao">Recomendação</option>
                  <option value="encaminhamento">Encaminhamento</option>
                  <option value="homologacao">Homologação</option>
                </select>
                <input placeholder="Responsável" value={formDelib.responsible_name} onChange={e=>setFormDelib({...formDelib,responsible_name:e.target.value})} />
                <input type="date" value={formDelib.due_date} onChange={e=>setFormDelib({...formDelib,due_date:e.target.value})} />
              </div>
              <input placeholder="Setor de destino (opcional)" value={formDelib.target_sector} onChange={e=>setFormDelib({...formDelib,target_sector:e.target.value})} />
              <div className="gov-form-actions">
                <button className="gov-btn-primary" onClick={saveDeliberation} disabled={!formDelib.meeting_id||!formDelib.subject}>Salvar</button>
                <button className="gov-btn-secondary" onClick={()=>setShowForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="gov-delib-list">
            {filteredDelibs.map(d=>(
              <div key={d.id} className="gov-delib">
                <div className="gov-delib-header">
                  <span className="gov-delib-num">{d.protocol}</span>
                  <span className={`gov-badge gov-badge-${d.status}`}>{d.status}</span>
                  <span className={`gov-badge gov-badge-type`}>{d.decision_type}</span>
                  {d.priority && <span className={`gov-badge gov-badge-pri-${d.priority}`}>{d.priority}</span>}
                </div>
                <div className="gov-delib-subject">{d.subject}</div>
                <div className="gov-delib-text">{d.full_text}</div>
                <div className="gov-delib-meta">
                  {d.responsible_name && <span>Resp: {d.responsible_name}</span>}
                  {d.due_date && <span>Prazo: {new Date(d.due_date).toLocaleDateString('pt-BR')}</span>}
                  <span>{bodies.find(b=>b.id===d.body_id)?.name}</span>
                </div>
                {!d.action_id && (
                  <button className="gov-btn-action" onClick={()=>createActionFrom(d)} title="Criar ação no Plano de Metas 5W2H">
                    → Criar ação no 5W2H
                  </button>
                )}
                {d.action_id && <span className="gov-badge gov-badge-ativo">✓ Ação vinculada</span>}
              </div>
            ))}
            {filteredDelibs.length===0 && <div className="gov-empty">Nenhuma deliberação registrada</div>}
          </div>
        </div>
      )}

      {/* ─── Timeline ─── */}
      {view==='timeline' && (
        <div className="gov-section">
          <h3>Timeline da Governança</h3>
          <div className="gov-timeline">
            {[...meetings.map(m=>({type:'meeting' as const,date:m.scheduled_date,item:m})),
              ...deliberations.map(d=>({type:'delib' as const,date:d.created_at,item:d}))
            ].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,50).map((ev,i)=>(
              <div key={i} className={`gov-tl-item gov-tl-${ev.type}`}>
                <div className="gov-tl-date">{new Date(ev.date).toLocaleDateString('pt-BR')}</div>
                <div className="gov-tl-dot" />
                <div className="gov-tl-content">
                  {ev.type==='meeting' ? (
                    <><strong>Reunião {(ev.item as Meeting).meeting_type}</strong> — {bodies.find(b=>b.id===(ev.item as Meeting).body_id)?.name}</>
                  ):(
                    <><strong>Deliberação {(ev.item as Deliberation).protocol}</strong> — {(ev.item as Deliberation).subject}</>
                  )}
                </div>
              </div>
            ))}
            {meetings.length===0 && deliberations.length===0 && <div className="gov-empty">Nenhum evento registrado</div>}
          </div>
        </div>
      )}

      {view==='vinculos' && (
        <div className="gov-section">
          <h3>Vínculos com Módulos Acadêmicos</h3>
          <p style={{fontSize:'.8125rem',color:'var(--vx-muted)',marginBottom:12}}>Deliberações vinculadas a objetos dos módulos TCC, AC, Estágio, Extensão, CPA e outros. Cada vínculo demonstra que a decisão acadêmica tem amparo colegiado.</p>
          {govLinks.length === 0 ? (
            <div className="gov-empty">Nenhum vínculo registrado. Vincule deliberações a módulos para demonstrar gestão participativa.</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8125rem'}}>
              <thead><tr style={{borderBottom:'2px solid var(--vx-border,#e2e8f0)'}}>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Deliberação</th>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Módulo</th>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Tipo</th>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Objeto</th>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Notas</th>
              </tr></thead>
              <tbody>{govLinks.map(gl => {
                const delib = deliberations.find(d => d.id === gl.deliberation_id);
                const modLabels: Record<string,string> = { tcc:'📝 TCC', ac:'📜 AC', estagio:'🏢 Estágio', extensao:'🤝 Extensão', cpa:'📊 CPA', alumni:'🎓 Egressos', ppc:'📘 PPC' };
                const typeLabels: Record<string,string> = { approval:'Aprovação', regulation:'Regulamentação', review:'Revisão', recommendation:'Recomendação', other:'Outro' };
                return (
                  <tr key={gl.id} style={{borderBottom:'1px solid var(--vx-border,#e2e8f0)'}}>
                    <td style={{padding:'6px 8px'}}><strong>{delib?.protocol || '—'}</strong><div style={{fontSize:'.75rem',color:'var(--vx-muted)'}}>{delib?.subject || '—'}</div></td>
                    <td style={{padding:'6px 8px'}}>{modLabels[gl.target_module] || gl.target_module}</td>
                    <td style={{padding:'6px 8px'}}><span className="gov-tag">{typeLabels[gl.link_type] || gl.link_type}</span></td>
                    <td style={{padding:'6px 8px'}}>{gl.target_label || '—'}</td>
                    <td style={{padding:'6px 8px',fontSize:'.75rem',color:'var(--vx-muted)'}}>{gl.notes || '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
