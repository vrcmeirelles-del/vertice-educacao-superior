import { ContextHelp } from '@/components/ContextHelp';
import { supabase } from '@/lib/supabase';
// CpaAutoavaliacao.tsx — Módulo CPA e Autoavaliação Institucional
// Módulo independente. CPA não é subordinada a Egressos.
import { useState, useEffect, useMemo } from 'react';
import {
  fetchReferences, fetchReferenceObjects, fetchMembers, fetchMeetings,
  fetchCycles, fetchInstruments, fetchCampaigns,
  fetchCpaFindings, fetchCpaActions, fetchCpaFeedbacks,
  fetchCampaignIndicators, fetchCycleSummary,
  createCycle, createInstrument, createCpaFinding, createCpaAction,
  updateCpaActionStatus, createMember, createFeedback,
  fetchQuestions, createQuestion, updateQuestion, deleteQuestion, updateInstrument,
  CpaReference, CpaReferenceObject, CpaMember, CpaMeeting,
  CpaCycle, CpaInstrument, CpaCampaign,
  CpaFinding, CpaAction, CpaFeedback,
  CpaCampaignIndicator, CpaCycleSummary,
  type CpaQuestion,
} from '../../lib/cpa';
import './egressos360.css'; // reutiliza estilos alumni-*

interface Props {
  institutionId: string;
  role: 'master' | 'gestor' | 'equipe';
}

type View = 'overview' | 'governanca' | 'referenciais' | 'ciclos' | 'instrumentos' | 'campanhas' | 'resultados' | 'relatorios' | 'achados' | 'planos' | 'devolutivas' | 'mesa' | 'meta';

const NAV: { v: View; label: string; icon: string }[] = [
  { v: 'overview', label: 'Visão Geral', icon: '📊' },
  { v: 'governanca', label: 'Governança', icon: '⚖' },
  { v: 'referenciais', label: 'Referenciais', icon: '📚' },
  { v: 'ciclos', label: 'Ciclos', icon: '🔄' },
  { v: 'instrumentos', label: 'Instrumentos', icon: '📋' },
  { v: 'campanhas', label: 'Campanhas', icon: '📨' },
  { v: 'resultados', label: 'Resultados', icon: '📈' },
  { v: 'relatorios', label: 'Relatórios', icon: '📄' },
  { v: 'achados', label: 'Achados', icon: '🔍' },
  { v: 'planos', label: 'Planos', icon: '🎯' },
  { v: 'devolutivas', label: 'Devolutivas', icon: '📢' },
  { v: 'mesa', label: 'Mesa Digital', icon: '🖥' },
  { v: 'meta', label: 'Meta-avaliação', icon: '🔬' },
];

export default function CpaAutoavaliacao({ institutionId, role }: Props) {
  const [view, setView] = useState<View>('overview');
  const [error, setError] = useState('');

  // Dados carregados sob demanda
  const [cycleSummary, setCycleSummary] = useState<CpaCycleSummary[]>([]);
  const [campIndicators, setCampIndicators] = useState<CpaCampaignIndicator[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCycleSummary(institutionId),
      fetchCampaignIndicators(institutionId),
    ]).then(([cs, ci]) => { setCycleSummary(cs); setCampIndicators(ci); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [institutionId]);

  return (
    <div className="alumni-360">
      <header className="alumni-header">
        <h2>CPA e Autoavaliação Institucional</h2>
        <p className="alumni-subtitle">Planejar → pesquisar → analisar → melhorar → devolver → reavaliar</p>
        <nav className="alumni-nav" style={{ flexWrap: 'wrap' }}>
          {NAV.map(n => (
            <button key={n.v} className={`alumni-nav-btn${view === n.v ? ' active' : ''}`}
              onClick={() => { setView(n.v); setError(''); }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
      </header>
      {error && <div className="alumni-error">⚠ {error}</div>}

      {view === 'overview' && <OverviewCPA cycleSummary={cycleSummary} campIndicators={campIndicators} loading={loading} />}
      {view === 'governanca' && <GovernancaCPA institutionId={institutionId} role={role} />}
      {view === 'referenciais' && <ReferenciaisCPA />}
      {view === 'ciclos' && <CiclosCPA institutionId={institutionId} role={role} />}
      {view === 'instrumentos' && <InstrumentosCPA institutionId={institutionId} role={role} />}
      {view === 'campanhas' && <CampanhasCPA institutionId={institutionId} role={role} />}
      {view === 'resultados' && <ResultadosCPA institutionId={institutionId} campIndicators={campIndicators} />}
      {view === 'relatorios' && <RelatoriosCPA institutionId={institutionId} role={role} />}
      {view === 'achados' && <AchadosCPA institutionId={institutionId} role={role} />}
      {view === 'planos' && <PlanosCPA institutionId={institutionId} role={role} />}
      {view === 'devolutivas' && <DevolutivasCPA institutionId={institutionId} role={role} />}
      {view === 'mesa' && <MesaDigitalCPA institutionId={institutionId} role={role} />}
      {view === 'meta' && <MetaCPA institutionId={institutionId} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */

function OverviewCPA({ cycleSummary, campIndicators, loading }: {
  cycleSummary: CpaCycleSummary[]; campIndicators: CpaCampaignIndicator[]; loading: boolean;
}) {
  if (loading) return <p className="alumni-loading">Carregando visão geral…</p>;
  const totals = cycleSummary.reduce((t, c) => ({
    campaigns: t.campaigns + c.campaigns, findings: t.findings + c.findings,
    actions: t.actions + c.actions, completed: t.completed + c.actions_completed,
    evidence: t.evidence + c.actions_with_evidence, feedbacks: t.feedbacks + c.feedbacks_delivered,
  }), { campaigns: 0, findings: 0, actions: 0, completed: 0, evidence: 0, feedbacks: 0 });

  return (
    <section className="alumni-overview">
      <div className="alumni-kpis">
        <KPI label="Ciclos" value={cycleSummary.length} color="#2563eb" />
        <KPI label="Campanhas" value={totals.campaigns} color="#7c3aed" />
        <KPI label="Achados" value={totals.findings} color="#d97706" />
        <KPI label="Ações" value={totals.actions} pct={totals.actions ? Math.round(100 * totals.completed / totals.actions) : 0} color="#16a34a" />
        <KPI label="Com Evidência" value={totals.evidence} color="#0891b2" />
        <KPI label="Devolutivas" value={totals.feedbacks} color="#e11d48" />
      </div>
      {cycleSummary.length > 0 && (
        <div className="alumni-table-wrapper">
          <table className="alumni-table">
            <thead><tr><th>Ciclo</th><th>Status</th><th style={{textAlign:'right'}}>Campanhas</th><th style={{textAlign:'right'}}>Achados</th><th style={{textAlign:'right'}}>Ações</th><th style={{textAlign:'right'}}>Executadas</th><th style={{textAlign:'right'}}>Devolutivas</th></tr></thead>
            <tbody>
              {cycleSummary.map(c => (
                <tr key={c.cycle_id}>
                  <td><strong>{c.cycle_title}</strong></td>
                  <td><span className="alumni-status-pill" style={{ background: c.cycle_status === 'encerrado' ? '#6b7280' : '#16a34a' }}>{c.cycle_status}</span></td>
                  <td style={{textAlign:'right'}}>{c.campaigns}</td>
                  <td style={{textAlign:'right'}}>{c.findings}</td>
                  <td style={{textAlign:'right'}}>{c.actions}</td>
                  <td style={{textAlign:'right'}}>{c.actions_completed}</td>
                  <td style={{textAlign:'right'}}>{c.feedbacks_delivered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cycleSummary.length === 0 && <EmptyState msg="Nenhum ciclo de autoavaliação criado. Comece pela aba Ciclos." />}
      <div className="alumni-info-box">
        <strong>Fluxo CPA:</strong> Planejar → Aplicar pesquisas → Acompanhar participação → Analisar resultados → Identificar fragilidades → Tomar decisões → Executar melhorias → Registrar evidências → Devolver resultados → Reavaliar.
      </div>
    </section>
  );
}

function GovernancaCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [members, setMembers] = useState<CpaMember[]>([]);
  const [meetings, setMeetings] = useState<CpaMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([fetchMembers(institutionId), fetchMeetings(institutionId)])
      .then(([m, mt]) => { setMembers(m); setMeetings(mt); }).finally(() => setLoading(false));
  }, [institutionId]);
  if (loading) return <p className="alumni-loading">Carregando governança…</p>;
  return (
    <section>
      <div className="alumni-section-header"><h3>Composição da CPA</h3>
        {(role==='master'||role==='gestor')&&<button className="alumni-btn-primary" onClick={async()=>{
          const name=prompt('Nome do membro:'); if(!name)return;
          const r=prompt('Papel (presidente/docente/discente/tecnico/sociedade):')||'docente';
          const m=await createMember({institution_id:institutionId,full_name:name,role:r});
          setMembers(p=>[m,...p]);
        }}>+ Membro</button>}
      </div>
      {members.length===0?<EmptyState msg="Nenhum membro cadastrado." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Nome</th><th>Papel</th><th>Segmento</th><th>Portaria</th><th>Ativo</th></tr></thead>
          <tbody>{members.map(m=><tr key={m.id}><td>{m.full_name}</td><td>{m.role}</td><td>{m.segment||'—'}</td><td>{m.appointment_ref||'—'}</td><td>{m.active?'✓':'—'}</td></tr>)}</tbody></table>
        </div>
      )}
      <h4 style={{marginTop:'1.5rem'}}>Reuniões e Atas</h4>
      {meetings.length===0?<EmptyState msg="Nenhuma reunião registrada." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Data</th><th>Pauta</th><th>Decisões</th><th>Ata</th></tr></thead>
          <tbody>{meetings.map(m=><tr key={m.id}><td>{new Date(m.meeting_date).toLocaleDateString('pt-BR')}</td><td>{m.agenda||'—'}</td><td>{m.decisions||'—'}</td><td>{m.minutes_url?<a href={m.minutes_url} target="_blank" rel="noopener">📎</a>:'—'}</td></tr>)}</tbody></table>
        </div>
      )}
    </section>
  );
}

function ReferenciaisCPA() {
  const [refs, setRefs] = useState<CpaReference[]>([]);
  const [objects, setObjects] = useState<CpaReferenceObject[]>([]);
  const [selectedRef, setSelectedRef] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchReferences().then(setRefs).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selectedRef) fetchReferenceObjects(selectedRef).then(setObjects); }, [selectedRef]);
  if (loading) return <p className="alumni-loading">Carregando referenciais…</p>;
  return (
    <section>
      <h3>Biblioteca de Referenciais INEP</h3>
      <p className="alumni-hint">Referenciais versionados. Não confundir instrumento vigente com proposta em consulta pública.</p>
      <div className="alumni-table-wrapper">
        <table className="alumni-table"><thead><tr><th>Referencial</th><th>Versão</th><th>Status</th><th>Fonte<ContextHelp title="Fonte" /></th><th></th></tr></thead>
        <tbody>{refs.map(r=><tr key={r.id}>
          <td><strong>{r.title}</strong></td><td>{r.version}</td>
          <td><span className="alumni-status-pill" style={{background:r.status==='vigente'?'#16a34a':r.status==='proposta'?'#d97706':'#6b7280'}}>{r.status}</span></td>
          <td>{r.source_url?<a href={r.source_url} target="_blank" rel="noopener">🔗</a>:'—'}</td>
          <td><button className="alumni-btn-small" onClick={()=>setSelectedRef(r.id)}>Ver objetos</button></td>
        </tr>)}</tbody></table>
      </div>
      {selectedRef && objects.length > 0 && (
        <div style={{marginTop:'1rem'}}>
          <h4>Objetos — {refs.find(r=>r.id===selectedRef)?.title}</h4>
          <div className="alumni-table-wrapper">
            <table className="alumni-table"><thead><tr><th>Código</th><th>Eixo</th><th>Objeto</th></tr></thead>
            <tbody>{objects.map(o=><tr key={o.id}><td><code>{o.object_code}{o.internal_code?` (${o.internal_code})`:''}</code></td><td>{o.axis||'—'}</td><td>{o.title}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
    </section>
  );
}

function CiclosCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [cycles, setCycles] = useState<CpaCycle[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchCycles(institutionId).then(setCycles).finally(() => setLoading(false)); }, [institutionId]);
  if (loading) return <p className="alumni-loading">Carregando ciclos…</p>;
  return (
    <section>
      <div className="alumni-section-header"><h3>Ciclos de Autoavaliação</h3>
        {(role==='master'||role==='gestor')&&<button className="alumni-btn-primary" onClick={async()=>{
          const title=prompt('Título do ciclo (ex: Ciclo 2026):'); if(!title)return;
          const c=await createCycle({institution_id:institutionId,title,status:'planejamento'});
          setCycles(p=>[c,...p]);
        }}>+ Novo Ciclo</button>}
      </div>
      {cycles.length===0?<EmptyState msg="Nenhum ciclo criado. Cada ciclo representa um período de autoavaliação." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Ciclo</th><th>Status</th><th>Período<ContextHelp title="Período" /></th><th>Metodologia</th></tr></thead>
          <tbody>{cycles.map(c=><tr key={c.id}><td><strong>{c.title}</strong></td>
            <td><span className="alumni-status-pill" style={{background:c.status==='encerrado'?'#6b7280':'#16a34a'}}>{c.status}</span></td>
            <td>{c.start_date?new Date(c.start_date).toLocaleDateString('pt-BR'):'—'} → {c.end_date?new Date(c.end_date).toLocaleDateString('pt-BR'):'—'}</td>
            <td>{c.methodology?.substring(0,80)||'—'}</td></tr>)}</tbody></table>
        </div>
      )}
    </section>
  );
}

function InstrumentosCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [instruments, setInstruments] = useState<CpaInstrument[]>([]);
  const [templates, setTemplates] = useState<CpaInstrument[]>([]);
  const [templateQuestions, setTemplateQuestions] = useState<Record<string, any[]>>({});
  const [expandedTemplate, setExpandedTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState('');
  const [editingInst, setEditingInst] = useState<CpaInstrument | null>(null);
  const AUDIENCES: Record<string,string> = {estudante:'Estudantes',docente:'Docentes',tecnico:'Técnicos',egresso:'Egressos',sociedade:'Sociedade Civil',gestao:'Gestão',todos:'Todos'};
  const SINAES_AXIS: Record<string,string> = {I:'Planejamento e Avaliação',II:'Desenvolvimento Institucional',III:'Políticas Acadêmicas',IV:'Políticas de Gestão',V:'Infraestrutura Física'};
  const SINAES_DIM: Record<string,string> = {I:'Missão e PDI',II:'Ensino, Pesquisa e Extensão',III:'Responsabilidade Social',IV:'Comunicação',V:'Pessoal Docente',VI:'Gestão Institucional',VII:'Infraestrutura',VIII:'Avaliação Institucional',IX:'Atendimento ao Estudante',X:'Sustentabilidade Financeira'};

  useEffect(() => {
    Promise.all([
      fetchInstruments(institutionId),
      supabase.from('vertice_cpa_instruments').select('*').is('institution_id', null).eq('is_template', true).order('target_audience').then(r => r.data || []),
    ]).then(([inst, tmpl]) => { setInstruments(inst); setTemplates(tmpl as CpaInstrument[]); }).finally(() => setLoading(false));
  }, [institutionId]);

  const loadTemplateQuestions = async (templateId: string) => {
    if (templateQuestions[templateId]) return;
    const { data } = await supabase.from('vertice_cpa_questions').select('*').eq('instrument_id', templateId).order('sort_order');
    setTemplateQuestions(prev => ({ ...prev, [templateId]: data || [] }));
  };

  const duplicateTemplate = async (tmpl: CpaInstrument) => {
    setCopying(tmpl.id);
    try {
      const newInst = await createInstrument({ institution_id: institutionId, title: tmpl.title.replace('(Biblioteca Vértice)', '').trim(), target_audience: tmpl.target_audience, status: 'rascunho' });
      // Copiar perguntas
      const { data: questions } = await supabase.from('vertice_cpa_questions').select('*').eq('instrument_id', tmpl.id).order('sort_order');
      if (questions && questions.length > 0) {
        const copies = questions.map((q: any) => ({ instrument_id: newInst.id, stable_code: q.stable_code, sort_order: q.sort_order, section: q.section, dimension: q.dimension, question_text: q.question_text, objective: q.objective, question_type: q.question_type, scale_config: q.scale_config, options: q.options, required: q.required, sinaes_axis: q.sinaes_axis, sinaes_dimension: q.sinaes_dimension, segment: q.segment, category: q.category }));
        await supabase.from('vertice_cpa_questions').insert(copies);
      }
      // Marcar source
      await supabase.from('vertice_cpa_instruments').update({ template_source_id: tmpl.id }).eq('id', newInst.id);
      setInstruments(prev => [{ ...newInst, template_source_id: tmpl.id }, ...prev]);
      alert(`Questionário "${newInst.title}" criado com ${questions?.length || 0} perguntas. Edite conforme a realidade da sua IES.`);
    } catch (err) { alert('Erro: ' + (err as Error).message); }
    finally { setCopying(''); }
  };

  if (loading) return <p className="alumni-loading">Carregando instrumentos…</p>;
  return (
    <section>
      {/* BIBLIOTECA VÉRTICE */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>📚 Biblioteca Vértice <span style={{ fontSize: '.7rem', padding: '2px 10px', borderRadius: 12, background: '#2563eb', color: '#fff', fontWeight: 700 }}>MODELOS</span></h3>
        <p className="alumni-hint">Questionários-base da plataforma. Use como ponto de partida — cada IES adapta, adiciona ou remove perguntas conforme sua realidade. Clique para ver as perguntas.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {templates.map(t => (
            <div key={t.id} style={{ padding: 14, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => { if (expandedTemplate === t.id) { setExpandedTemplate(''); } else { setExpandedTemplate(t.id); loadTemplateQuestions(t.id); } }}>
                  <strong style={{ fontSize: '.9rem' }}>{t.title}</strong>
                  <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>{AUDIENCES[t.target_audience] || t.target_audience} · {t.notes} · {expandedTemplate === t.id ? '▾ Fechar' : '▸ Ver perguntas'}</div>
                </div>
                <button disabled={!!copying} style={{ fontSize: '.75rem', padding: '6px 14px', borderRadius: 8, border: '1px solid #2563eb', background: copying === t.id ? '#93c5fd' : '#fff', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}
                  onClick={() => duplicateTemplate(t)}>{copying === t.id ? 'Copiando…' : '📋 Usar este modelo'}</button>
              </div>
              {expandedTemplate === t.id && templateQuestions[t.id] && (
                <div style={{ marginTop: 12 }}>
                  <table className="alumni-table" style={{ fontSize: '.75rem' }}>
                    <thead><tr><th style={{ width: 70 }}>Código</th><th>Pergunta</th><th style={{ width: 60 }}>Eixo</th><th style={{ width: 60 }}>Dim.</th><th style={{ width: 60 }}>Tipo</th></tr></thead>
                    <tbody>{templateQuestions[t.id].map((q: any) => (
                      <tr key={q.id}>
                        <td><code style={{ fontSize: '.65rem' }}>{q.stable_code}</code></td>
                        <td>{q.question_text}</td>
                        <td title={SINAES_AXIS[q.sinaes_axis] || ''}>{q.sinaes_axis || '—'}</td>
                        <td title={SINAES_DIM[q.sinaes_dimension] || ''}>{q.sinaes_dimension || '—'}</td>
                        <td><span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 4, background: q.question_type === 'likert' ? '#dbeafe' : '#f3e8ff', color: q.question_type === 'likert' ? '#2563eb' : '#7c3aed' }}>{q.question_type === 'likert' ? '1–5' : 'Aberta'}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <p style={{ fontSize: '.7rem', color: '#64748b', margin: '6px 0 0' }}>Escala Likert 1–5 com "Não sei responder" e "Não se aplica" (não integram a média). Perguntas condicionais devem ser configuradas pela IES.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* INSTRUMENTOS DA IES */}
      <div className="alumni-section-header"><h3>📋 Meus Questionários</h3>
        {(role==='master'||role==='gestor')&&<button className="alumni-btn-primary" onClick={async()=>{
          const title=prompt('Título do instrumento:'); if(!title)return;
          const audience=prompt('Público (estudante/docente/tecnico/egresso/sociedade/gestao/todos):')||'estudante';
          const i=await createInstrument({institution_id:institutionId,title,target_audience:audience,status:'rascunho'});
          setInstruments(p=>[i,...p]);
        }}>+ Criar do zero</button>}
      </div>
      <p className="alumni-hint">Questionários da sua instituição. Versione antes de aplicar. Uma versão publicada não muda durante uma campanha.</p>
      {instruments.length===0?<EmptyState msg="Nenhum instrumento criado. Use um modelo da Biblioteca Vértice acima ou crie do zero." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Instrumento</th><th>Público</th><th>Versão</th><th>Status</th><th>Origem</th><th></th></tr></thead>
          <tbody>{instruments.map(i=><tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => setEditingInst(i)}>
            <td><strong>{i.title}</strong></td><td>{AUDIENCES[i.target_audience]||i.target_audience}</td><td>v{i.version}</td>
            <td><span className="alumni-status-pill" style={{background:i.status==='publicado'?'#16a34a':i.status==='piloto'?'#d97706':'#94a3b8'}}>{i.status}</span></td>
            <td style={{ fontSize: '.7rem' }}>{(i as any).template_source_id ? '📚 Biblioteca' : '✏️ Próprio'}</td>
            <td><button className="alumni-btn-small" onClick={e => { e.stopPropagation(); setEditingInst(i); }}>Editar</button></td></tr>)}</tbody></table>
        </div>
      )}

      {/* EDITOR DE QUESTIONÁRIO */}
      {editingInst && <QuestionnaireEditor instrument={editingInst} role={role} onClose={() => setEditingInst(null)}
        onStatusChange={(id, status) => { setInstruments(prev => prev.map(x => x.id === id ? { ...x, status } : x)); setEditingInst(prev => prev ? { ...prev, status } : null); }}
        AUDIENCES={AUDIENCES} SINAES_AXIS={SINAES_AXIS} SINAES_DIM={SINAES_DIM} />}
    </section>
  );
}

/* ============ EDITOR DE QUESTIONÁRIO ============ */
function QuestionnaireEditor({ instrument, role, onClose, onStatusChange, AUDIENCES, SINAES_AXIS, SINAES_DIM }: {
  instrument: CpaInstrument; role: string; onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  AUDIENCES: Record<string,string>; SINAES_AXIS: Record<string,string>; SINAES_DIM: Record<string,string>;
}) {
  const [questions, setQuestions] = useState<CpaQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingQ, setAddingQ] = useState(false);
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const isEditable = instrument.status === 'rascunho' || instrument.status === 'piloto';
  const canEdit = (role === 'master' || role === 'gestor') && isEditable;

  useEffect(() => { fetchQuestions(instrument.id).then(setQuestions).finally(() => setLoading(false)); }, [instrument.id]);

  const handleAdd = async (q: Partial<CpaQuestion>) => {
    const newQ = await createQuestion({ instrument_id: instrument.id, stable_code: q.stable_code || `Q-${(questions.length + 1).toString().padStart(3, '0')}`, sort_order: questions.length + 1, question_text: q.question_text!, question_type: q.question_type || 'likert', required: q.required ?? true, sinaes_axis: q.sinaes_axis, sinaes_dimension: q.sinaes_dimension, segment: q.segment, scale_config: q.question_type === 'text' ? null : { min: 1, max: 5, labels: ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'], allow_na: true, allow_dk: true } });
    setQuestions(prev => [...prev, newQ]);
    setAddingQ(false);
  };

  const handleUpdate = async (id: string, updates: Partial<CpaQuestion>) => {
    const updated = await updateQuestion(id, updates);
    setQuestions(prev => prev.map(q => q.id === id ? updated : q));
    setEditingQ(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta pergunta?')) return;
    await deleteQuestion(id);
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateInstrument(instrument.id, { status: newStatus } as any);
    onStatusChange(instrument.id, newStatus);
  };

  const sel: React.CSSProperties = { fontSize: '.75rem', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' };
  const inp: React.CSSProperties = { ...sel, width: '100%' };

  return (
    <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#fff', border: '2px solid #2563eb', boxShadow: '0 4px 20px rgba(37,99,235,0.1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong style={{ fontSize: '1.1rem' }}>{instrument.title}</strong>
            <span className="alumni-status-pill" style={{ background: instrument.status === 'publicado' ? '#16a34a' : '#94a3b8' }}>{instrument.status}</span>
          </div>
          <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 2 }}>{AUDIENCES[instrument.target_audience] || instrument.target_audience} · {questions.length} perguntas · v{instrument.version}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {canEdit && instrument.status === 'rascunho' && <button style={{ ...sel, border: '1px solid #f59e0b', color: '#b45309', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleStatusChange('piloto')}>🧪 Piloto</button>}
          {canEdit && (instrument.status === 'rascunho' || instrument.status === 'piloto') && <button style={{ ...sel, border: '1px solid #16a34a', color: '#16a34a', fontWeight: 600, cursor: 'pointer' }} onClick={() => { if (questions.length === 0) { alert('Adicione pelo menos uma pergunta.'); return; } handleStatusChange('publicado'); }}>✅ Publicar</button>}
          {!isEditable && (role === 'master' || role === 'gestor') && <button style={{ ...sel, border: '1px solid #64748b', color: '#64748b', cursor: 'pointer' }} onClick={() => handleStatusChange('arquivado')}>📦 Arquivar</button>}
          <button style={{ ...sel, cursor: 'pointer' }} onClick={onClose}>✕ Fechar</button>
        </div>
      </div>

      {!isEditable && <div style={{ padding: 8, background: '#fef3c7', borderRadius: 8, fontSize: '.8rem', color: '#92400e', marginBottom: 12 }}>⚠️ Instrumento publicado — edição bloqueada. Para alterar, crie uma nova versão.</div>}

      {loading ? <p>Carregando perguntas…</p> : (
        <>
          {/* Lista de perguntas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {questions.map((q, idx) => (
              <div key={q.id} style={{ padding: '10px 12px', borderRadius: 8, background: idx % 2 === 0 ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>{idx + 1}</div>
                {editingQ === q.id ? (
                  <QuestionEditForm q={q} onSave={(u) => handleUpdate(q.id, u)} onCancel={() => setEditingQ(null)} SINAES_AXIS={SINAES_AXIS} SINAES_DIM={SINAES_DIM} inp={inp} sel={sel} />
                ) : (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: '.85rem' }}><strong>{q.question_text}</strong></div>
                      {canEdit && <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button style={{ fontSize: '.65rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }} onClick={() => setEditingQ(q.id)}>✏️</button>
                        <button style={{ fontSize: '.65rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }} onClick={() => handleDelete(q.id)}>🗑</button>
                      </div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 4, background: '#dbeafe', color: '#2563eb' }}>{q.stable_code}</span>
                      {q.sinaes_axis && <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 4, background: '#f3e8ff', color: '#7c3aed' }} title={SINAES_AXIS[q.sinaes_axis]}>Eixo {q.sinaes_axis}</span>}
                      {q.sinaes_dimension && <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 4, background: '#ecfdf5', color: '#059669' }} title={SINAES_DIM[q.sinaes_dimension]}>Dim. {q.sinaes_dimension}</span>}
                      <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 4, background: q.question_type === 'likert' ? '#f0f9ff' : '#fefce8', color: q.question_type === 'likert' ? '#0369a1' : '#a16207' }}>{q.question_type === 'likert' ? 'Likert 1–5' : q.question_type === 'text' ? 'Aberta' : q.question_type}</span>
                      {q.required && <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 4, background: '#fef2f2', color: '#dc2626' }}>Obrigatória</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Adicionar pergunta */}
          {canEdit && !addingQ && <button style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 8, border: '2px dashed #2563eb', background: '#f0f9ff', color: '#2563eb', fontWeight: 700, cursor: 'pointer', fontSize: '.85rem' }} onClick={() => setAddingQ(true)}>+ Adicionar pergunta</button>}
          {addingQ && <QuestionEditForm q={null} onSave={handleAdd} onCancel={() => setAddingQ(false)} SINAES_AXIS={SINAES_AXIS} SINAES_DIM={SINAES_DIM} inp={inp} sel={sel} />}
        </>
      )}

      {/* Resumo SINAES */}
      {questions.length > 0 && (() => {
        const byAxis: Record<string, number> = {};
        questions.forEach(q => { if (q.sinaes_axis) byAxis[q.sinaes_axis] = (byAxis[q.sinaes_axis] || 0) + 1; });
        return (
          <div style={{ marginTop: 16, padding: 12, background: '#f5f3ff', borderRadius: 10 }}>
            <strong style={{ fontSize: '.8rem' }}>Cobertura SINAES:</strong>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {Object.entries(SINAES_AXIS).map(([k, v]) => (
                <span key={k} style={{ fontSize: '.7rem', padding: '3px 10px', borderRadius: 12, background: byAxis[k] ? '#dbeafe' : '#fee2e2', color: byAxis[k] ? '#2563eb' : '#dc2626', fontWeight: 600 }}>
                  {k}. {v}: {byAxis[k] || 0}q {!byAxis[k] && '⚠'}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ============ FORMULÁRIO DE PERGUNTA ============ */
function QuestionEditForm({ q, onSave, onCancel, SINAES_AXIS, SINAES_DIM, inp, sel }: {
  q: CpaQuestion | null; onSave: (data: Partial<CpaQuestion>) => void; onCancel: () => void;
  SINAES_AXIS: Record<string,string>; SINAES_DIM: Record<string,string>;
  inp: React.CSSProperties; sel: React.CSSProperties;
}) {
  const [text, setText] = useState(q?.question_text || '');
  const [code, setCode] = useState(q?.stable_code || '');
  const [type, setType] = useState(q?.question_type || 'likert');
  const [axis, setAxis] = useState(q?.sinaes_axis || '');
  const [dim, setDim] = useState(q?.sinaes_dimension || '');
  const [req, setReq] = useState(q?.required ?? true);

  return (
    <div style={{ flex: 1, padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ fontSize: '.7rem', fontWeight: 600 }}>Texto da pergunta
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Como você avalia..." />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          <label style={{ fontSize: '.7rem', fontWeight: 600 }}>Código<input value={code} onChange={e => setCode(e.target.value)} style={inp} placeholder="DIS-026" /></label>
          <label style={{ fontSize: '.7rem', fontWeight: 600 }}>Tipo
            <select value={type} onChange={e => setType(e.target.value)} style={sel}>
              <option value="likert">Likert 1–5</option><option value="text">Aberta</option><option value="single_choice">Escolha única</option><option value="multiple_choice">Múltipla escolha</option><option value="boolean">Sim/Não</option>
            </select>
          </label>
          <label style={{ fontSize: '.7rem', fontWeight: 600 }}>Eixo SINAES
            <select value={axis} onChange={e => setAxis(e.target.value)} style={sel}>
              <option value="">—</option>{Object.entries(SINAES_AXIS).map(([k, v]) => <option key={k} value={k}>{k}. {v}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '.7rem', fontWeight: 600 }}>Dimensão SINAES
            <select value={dim} onChange={e => setDim(e.target.value)} style={sel}>
              <option value="">—</option>{Object.entries(SINAES_DIM).map(([k, v]) => <option key={k} value={k}>{k}. {v}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={req} onChange={e => setReq(e.target.checked)} /> Obrigatória
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
        <button style={{ ...sel, cursor: 'pointer' }} onClick={onCancel}>Cancelar</button>
        <button disabled={!text.trim()} style={{ ...sel, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: text.trim() ? 1 : .5 }}
          onClick={() => onSave({ question_text: text.trim(), stable_code: code.trim() || undefined, question_type: type, sinaes_axis: axis || undefined, sinaes_dimension: dim || undefined, required: req })}>{q ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  );
}

function CampanhasCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [campaigns, setCampaigns] = useState<CpaCampaign[]>([]);
  const [instruments, setInstruments] = useState<CpaInstrument[]>([]);
  const [cycles, setCycles] = useState<CpaCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [responses, setResponses] = useState<Record<string, { total: number; completed: number; in_progress: number }>>({});

  const AUDIENCES: Record<string,string> = {estudante:'Estudantes',docente:'Docentes',tecnico:'Técnicos',egresso:'Egressos',sociedade:'Sociedade Civil',gestao:'Gestão',todos:'Todos'};
  const STATUS_LABEL: Record<string,{l:string;bg:string}> = {
    rascunho:{l:'Rascunho',bg:'#94a3b8'}, agendada:{l:'Agendada',bg:'#2563eb'}, ativa:{l:'🟢 Ativa',bg:'#16a34a'},
    pausada:{l:'⏸ Pausada',bg:'#f59e0b'}, encerrada:{l:'Encerrada',bg:'#64748b'}, cancelada:{l:'Cancelada',bg:'#dc2626'},
  };

  useEffect(() => {
    Promise.all([
      fetchCampaigns(institutionId),
      fetchInstruments(institutionId),
      fetchCycles(institutionId),
    ]).then(([c, i, cy]) => {
      setCampaigns(c); setInstruments(i); setCycles(cy);
      // Load response counts per campaign
      c.forEach(async (camp: CpaCampaign) => {
        const { data } = await supabase.from('vertice_cpa_responses').select('id,status').eq('campaign_id', camp.id);
        if (data) setResponses(prev => ({ ...prev, [camp.id]: { total: data.length, completed: data.filter((r: any) => r.status === 'concluida').length, in_progress: data.filter((r: any) => r.status === 'em_andamento').length } }));
      });
    }).finally(() => setLoading(false));
  }, [institutionId]);

  const pubInstruments = instruments.filter(i => i.status === 'publicado');

  const handleCreate = async (data: { title: string; instrument_id: string; cycle_id?: string; target_audience: string; opens_at: string; closes_at: string; channels: string[] }) => {
    const c = await createCampaign({ institution_id: institutionId, ...data, status: 'rascunho' } as any);
    setCampaigns(prev => [c, ...prev]);
    setShowForm(false);
  };

  const handleStatus = async (id: string, status: string) => {
    await supabase.from('vertice_cpa_campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const copyLink = (campId: string) => {
    const url = `${window.location.origin}/cpa-avaliacao?campanha=${campId}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copiado!')).catch(() => prompt('Copie o link:', url));
  };

  if (loading) return <p className="alumni-loading">Carregando campanhas…</p>;

  return (
    <section>
      <div className="alumni-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>📨 Campanhas de Avaliação</h3>
        {(role==='master'||role==='gestor') && <button className="alumni-btn-primary" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : '+ Nova Campanha'}</button>}
      </div>

      {/* KPIs */}
      <div className="alumni-kpis" style={{ marginBottom: 16 }}>
        <div className="alumni-kpi"><div className="alumni-kpi-value">{campaigns.length}</div><div className="alumni-kpi-label">Campanhas</div></div>
        <div className="alumni-kpi"><div className="alumni-kpi-value" style={{ color: '#16a34a' }}>{campaigns.filter(c => c.status === 'ativa').length}</div><div className="alumni-kpi-label">Ativas</div></div>
        <div className="alumni-kpi"><div className="alumni-kpi-value" style={{ color: '#2563eb' }}>{Object.values(responses).reduce((s, r) => s + r.completed, 0)}</div><div className="alumni-kpi-label">Respostas</div></div>
        <div className="alumni-kpi"><div className="alumni-kpi-value" style={{ color: '#f59e0b' }}>{Object.values(responses).reduce((s, r) => s + r.in_progress, 0)}</div><div className="alumni-kpi-label">Em andamento</div></div>
      </div>

      {/* Formulário de criação */}
      {showForm && <CampaignForm instruments={pubInstruments} cycles={cycles} audiences={AUDIENCES} onCreate={handleCreate} onCancel={() => setShowForm(false)} />}

      {/* Lista de campanhas */}
      {campaigns.length === 0 && !showForm ? <EmptyState msg="Nenhuma campanha criada. Publique um instrumento e crie uma campanha." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campaigns.map(c => {
            const st = STATUS_LABEL[c.status] || { l: c.status, bg: '#94a3b8' };
            const resp = responses[c.id] || { total: 0, completed: 0, in_progress: 0 };
            const instName = instruments.find(i => i.id === c.instrument_id)?.title || '—';
            const cycleName = cycles.find(cy => cy.id === c.cycle_id)?.title;
            const isActive = c.status === 'ativa';
            const now = new Date();
            const opens = new Date(c.opens_at);
            const closes = new Date(c.closes_at);
            const daysLeft = isActive ? Math.ceil((closes.getTime() - now.getTime()) / 86400000) : 0;

            return (
              <div key={c.id} style={{ padding: 14, borderRadius: 10, background: isActive ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`, borderLeft: `4px solid ${st.bg}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ fontSize: '.95rem' }}>{c.title}</strong>
                      <span className="alumni-status-pill" style={{ background: st.bg }}>{st.l}</span>
                    </div>
                    <div style={{ fontSize: '.75rem', color: '#64748b' }}>
                      {AUDIENCES[c.target_audience] || c.target_audience} · {instName}{cycleName ? ` · ${cycleName}` : ''} · {c.channels?.join(', ') || 'portal'}
                    </div>
                    <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>
                      📅 {opens.toLocaleDateString('pt-BR')} → {closes.toLocaleDateString('pt-BR')}
                      {isActive && daysLeft > 0 && <strong style={{ color: daysLeft <= 3 ? '#dc2626' : '#f59e0b', marginLeft: 8 }}>{daysLeft} dia{daysLeft > 1 ? 's' : ''} restante{daysLeft > 1 ? 's' : ''}</strong>}
                      {isActive && daysLeft <= 0 && <strong style={{ color: '#dc2626', marginLeft: 8 }}>Vencida</strong>}
                    </div>
                    {/* Barra de respostas */}
                    {resp.total > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', marginBottom: 3 }}>
                          <span>{resp.completed} concluída{resp.completed !== 1 ? 's' : ''} · {resp.in_progress} em andamento</span>
                          <span style={{ fontWeight: 700 }}>{resp.total} resposta{resp.total !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${resp.total > 0 ? Math.round(100 * resp.completed / Math.max(resp.total, 1)) : 0}%`, background: '#16a34a', borderRadius: 3 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
                    {isActive && <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }} onClick={() => copyLink(c.id)}>🔗 Link</button>}
                    {c.status === 'rascunho' && (role === 'master' || role === 'gestor') && <>
                      <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleStatus(c.id, 'agendada')}>📅 Agendar</button>
                      <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleStatus(c.id, 'ativa')}>▶ Ativar</button>
                    </>}
                    {c.status === 'agendada' && <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleStatus(c.id, 'ativa')}>▶ Ativar</button>}
                    {isActive && <>
                      <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', cursor: 'pointer' }} onClick={() => handleStatus(c.id, 'pausada')}>⏸ Pausar</button>
                      <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #64748b', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }} onClick={() => handleStatus(c.id, 'encerrada')}>⏹ Encerrar</button>
                    </>}
                    {c.status === 'pausada' && <button style={{ fontSize: '.7rem', padding: '4px 10px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleStatus(c.id, 'ativa')}>▶ Retomar</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="alumni-info-box" style={{ marginTop: 16 }}>
        <strong>📋 Fluxo:</strong> Rascunho → Agendada → Ativa (link público liberado) → Encerrada. Respostas são anônimas. O link de coleta funciona para qualquer pessoa do segmento elegível.
      </div>
    </section>
  );
}

/* ============ FORMULÁRIO DE CAMPANHA ============ */
function CampaignForm({ instruments, cycles, audiences, onCreate, onCancel }: {
  instruments: CpaInstrument[]; cycles: CpaCycle[]; audiences: Record<string,string>;
  onCreate: (data: any) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [instId, setInstId] = useState(instruments[0]?.id || '');
  const [cycleId, setCycleId] = useState(cycles[0]?.id || '');
  const [audience, setAudience] = useState('estudante');
  const [opens, setOpens] = useState(new Date().toISOString().slice(0, 10));
  const [closes, setCloses] = useState('');
  const [channels, setChannels] = useState<string[]>(['portal']);

  const sel: React.CSSProperties = { fontSize: '.8rem', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', width: '100%' };

  return (
    <div style={{ padding: 16, borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 16 }}>
      <strong style={{ fontSize: '.9rem' }}>Nova campanha de avaliação</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 10 }}>
        <label style={{ fontSize: '.75rem', fontWeight: 600 }}>Nome da campanha
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Avaliação CPA 2026.2 — Discentes" style={sel} />
        </label>
        <label style={{ fontSize: '.75rem', fontWeight: 600 }}>Questionário
          <select value={instId} onChange={e => setInstId(e.target.value)} style={sel}>
            {instruments.length === 0 && <option value="">Publique um instrumento primeiro</option>}
            {instruments.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '.75rem', fontWeight: 600 }}>Ciclo
          <select value={cycleId} onChange={e => setCycleId(e.target.value)} style={sel}>
            <option value="">Sem ciclo</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '.75rem', fontWeight: 600 }}>Segmento
          <select value={audience} onChange={e => setAudience(e.target.value)} style={sel}>
            {Object.entries(audiences).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '.75rem', fontWeight: 600 }}>Abertura<input type="date" value={opens} onChange={e => setOpens(e.target.value)} style={sel} /></label>
        <label style={{ fontSize: '.75rem', fontWeight: 600 }}>Encerramento<input type="date" value={closes} onChange={e => setCloses(e.target.value)} style={sel} /></label>
        <label style={{ fontSize: '.75rem', fontWeight: 600 }}>Canais
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {['portal', 'email', 'whatsapp', 'link'].map(ch => (
              <label key={ch} style={{ fontSize: '.7rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                <input type="checkbox" checked={channels.includes(ch)} onChange={e => setChannels(prev => e.target.checked ? [...prev, ch] : prev.filter(c => c !== ch))} /> {ch}
              </label>
            ))}
          </div>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button style={{ fontSize: '.8rem', padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }} onClick={onCancel}>Cancelar</button>
        <button disabled={!title.trim() || !instId || !closes} style={{ fontSize: '.8rem', padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: title.trim() && instId && closes ? 1 : .5 }}
          onClick={() => onCreate({ title: title.trim(), instrument_id: instId, cycle_id: cycleId || undefined, target_audience: audience, opens_at: opens + 'T00:00:00Z', closes_at: closes + 'T23:59:59Z', channels })}>Criar campanha</button>
      </div>
    </div>
  );
}

function ResultadosCPA({ institutionId, campIndicators }: { institutionId: string; campIndicators: CpaCampaignIndicator[] }) {
  const [campaigns, setCampaigns] = useState<CpaCampaign[]>([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [viewMode, setViewMode] = useState<'questions'|'axes'|'dimensions'|'open'>('axes');
  const AUDIENCES: Record<string,string> = {estudante:'Estudantes',docente:'Docentes',tecnico:'Técnicos',sociedade:'Sociedade Civil',egresso:'Egressos',gestao:'Gestão'};
  const AXIS_NAMES: Record<string,string> = {I:'Planejamento e Avaliação',II:'Desenvolvimento Institucional',III:'Políticas Acadêmicas',IV:'Políticas de Gestão',V:'Infraestrutura'};
  const DIM_NAMES: Record<string,string> = {I:'Missão e PDI',II:'Ensino, Pesquisa e Extensão',III:'Responsabilidade Social',IV:'Comunicação',V:'Pessoal Docente',VI:'Gestão Institucional',VII:'Infraestrutura',VIII:'Avaliação Institucional',IX:'Atendimento ao Estudante',X:'Sustentabilidade Financeira'};

  useEffect(() => { fetchCampaigns(institutionId).then(c => { setCampaigns(c.filter(x => x.status === 'ativa' || x.status === 'encerrada')); }); }, [institutionId]);

  const loadResults = async (campId: string) => {
    setSelectedCamp(campId); setLoadingResults(true); setResults(null);
    const { data } = await supabase.rpc('vertice_cpa_campaign_results', { p_campaign_id: campId });
    setResults(data); setLoadingResults(false);
  };

  const scoreColor = (v: number) => v >= 4 ? '#16a34a' : v >= 3 ? '#f59e0b' : '#dc2626';
  const scoreBar = (v: number, max = 5) => ({ width: `${(v / max) * 100}%`, height: 10, borderRadius: 5, background: scoreColor(v), transition: 'width .3s' });

  return (
    <section>
      <h3>📈 Resultados e Indicadores</h3>

      {/* Seletor de campanha */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {campaigns.map(c => (
          <button key={c.id} onClick={() => loadResults(c.id)}
            style={{ padding: '6px 14px', borderRadius: 20, border: selectedCamp === c.id ? '2px solid #2563eb' : '1px solid #e2e8f0', background: selectedCamp === c.id ? '#eff6ff' : '#fff', fontSize: '.8rem', fontWeight: selectedCamp === c.id ? 700 : 400, cursor: 'pointer', color: selectedCamp === c.id ? '#2563eb' : '#475569' }}>
            {c.title}
          </button>
        ))}
        {campaigns.length === 0 && <EmptyState msg="Nenhuma campanha com respostas. Ative e colete dados primeiro." />}
      </div>

      {loadingResults && <p className="alumni-loading">Calculando resultados…</p>}

      {results && !results.error && (<>
        {/* KPIs principais */}
        <div className="alumni-kpis" style={{ marginBottom: 16 }}>
          <div className="alumni-kpi"><div className="alumni-kpi-value">{results.total_responses}</div><div className="alumni-kpi-label">Respostas</div></div>
          <div className="alumni-kpi"><div className="alumni-kpi-value" style={{ color: scoreColor(results.institutional_avg || 0), fontSize: '1.5rem' }}>{results.institutional_avg || '—'}</div><div className="alumni-kpi-label">Média institucional</div></div>
          <div className="alumni-kpi"><div className="alumni-kpi-value" style={{ color: '#2563eb' }}>{results.top2_pct || 0}%</div><div className="alumni-kpi-label">Notas 4 e 5</div></div>
          <div className="alumni-kpi"><div className="alumni-kpi-value">{AUDIENCES[results.target_audience] || results.target_audience}</div><div className="alumni-kpi-label">Segmento</div></div>
        </div>

        {/* Abas de visualização */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{k:'axes',l:'Por Eixo'},{k:'dimensions',l:'Por Dimensão'},{k:'questions',l:'Por Pergunta'},{k:'open',l:'Respostas Abertas'}].map(t => (
            <button key={t.k} onClick={() => setViewMode(t.k as any)}
              style={{ padding: '6px 12px', borderRadius: 8, border: viewMode === t.k ? '2px solid #2563eb' : '1px solid #e2e8f0', background: viewMode === t.k ? '#eff6ff' : '#fff', fontSize: '.75rem', fontWeight: viewMode === t.k ? 700 : 400, cursor: 'pointer' }}>{t.l}</button>
          ))}
        </div>

        {/* POR EIXO */}
        {viewMode === 'axes' && results.by_axis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.by_axis.map((a: any) => {
              const top2Pct = a.total_valid > 0 ? Math.round(100 * a.top2_total / a.total_valid) : 0;
              return (
                <div key={a.axis} style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: `4px solid ${scoreColor(a.avg_score)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div><strong>Eixo {a.axis}</strong> <span style={{ fontSize: '.8rem', color: '#64748b' }}>— {AXIS_NAMES[a.axis] || a.axis}</span></div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '.75rem', color: '#64748b' }}>{top2Pct}% notas 4–5</span>
                      <strong style={{ fontSize: '1.2rem', color: scoreColor(a.avg_score) }}>{a.avg_score}</strong>
                    </div>
                  </div>
                  <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={scoreBar(a.avg_score)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* POR DIMENSÃO */}
        {viewMode === 'dimensions' && results.by_dimension && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.by_dimension.map((d: any) => {
              const top2Pct = d.total_valid > 0 ? Math.round(100 * d.top2_total / d.total_valid) : 0;
              return (
                <div key={`${d.axis}-${d.dimension}`} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 60px', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#f8fafc' }}>
                  <div><span style={{ fontSize: '.7rem', color: '#7c3aed' }}>Eixo {d.axis}</span><br/><strong style={{ fontSize: '.8rem' }}>Dim. {d.dimension}</strong> <span style={{ fontSize: '.7rem', color: '#64748b' }}>{DIM_NAMES[d.dimension] || ''}</span></div>
                  <div>
                    <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                      <div style={scoreBar(d.avg_score)} />
                    </div>
                    <div style={{ fontSize: '.65rem', color: '#94a3b8', marginTop: 2 }}>{top2Pct}% notas 4–5 · {d.total_valid} respostas válidas</div>
                  </div>
                  <strong style={{ textAlign: 'right', fontSize: '1rem', color: scoreColor(d.avg_score) }}>{d.avg_score}</strong>
                </div>
              );
            })}
          </div>
        )}

        {/* POR PERGUNTA */}
        {viewMode === 'questions' && results.questions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.questions.filter((q: any) => q.question_type === 'likert').map((q: any) => {
              const top2Pct = q.valid_count > 0 ? Math.round(100 * q.top2_count / q.valid_count) : 0;
              return (
                <div key={q.question_id} style={{ padding: '8px 12px', borderRadius: 8, background: q.avg_score && q.avg_score < 3 ? '#fef2f2' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '.65rem', color: '#2563eb', marginRight: 6 }}>{q.stable_code}</span>
                      <span style={{ fontSize: '.8rem' }}>{q.question_text}</span>
                    </div>
                    <strong style={{ fontSize: '1rem', color: scoreColor(q.avg_score || 0), flexShrink: 0 }}>{q.avg_score || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ ...scoreBar(q.avg_score || 0), height: 8 }} />
                    </div>
                    <div style={{ fontSize: '.6rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{q.valid_count}r · {top2Pct}% top · {q.na_count}NA · {q.dk_count}NS</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RESPOSTAS ABERTAS */}
        {viewMode === 'open' && results.questions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.questions.filter((q: any) => q.question_type === 'text' && q.open_answers && q.open_answers.length > 0).map((q: any) => (
              <div key={q.question_id} style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '.85rem' }}>{q.question_text}</strong>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {q.open_answers.filter((a: string | null) => a).map((a: string, i: number) => (
                    <div key={i} style={{ padding: '6px 10px', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0', fontSize: '.8rem', color: '#475569' }}>"{a}"</div>
                  ))}
                </div>
                <div style={{ fontSize: '.7rem', color: '#94a3b8', marginTop: 4 }}>{q.open_answers.filter((a: string | null) => a).length} resposta(s)</div>
              </div>
            ))}
            {results.questions.filter((q: any) => q.question_type === 'text' && q.open_answers && q.open_answers.length > 0).length === 0 && <EmptyState msg="Nenhuma resposta aberta recebida." />}
          </div>
        )}

        {/* Legenda */}
        <div style={{ marginTop: 16, padding: 12, background: '#f5f3ff', borderRadius: 10, fontSize: '.75rem', color: '#475569' }}>
          <strong>Escala:</strong> 🟢 ≥ 4,0 (bom/ótimo) · 🟡 3,0–3,9 (regular) · 🔴 &lt; 3,0 (atenção). "Não sei" e "Não se aplica" não integram a média. Denominadores e exclusões registrados por pergunta.
        </div>
      </>)}

      {results?.error && <div className="alumni-info-box" style={{ background: '#fef2f2' }}>Erro: {results.error}</div>}

      {/* Participação (tabela original) */}
      {campIndicators.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: '.85rem', color: '#64748b' }}>Participação por campanha</h4>
          <div className="alumni-table-wrapper">
            <table className="alumni-table"><thead><tr><th>Campanha</th><th>Público</th><th style={{textAlign:'right'}}>Concluídos</th><th style={{textAlign:'right'}}>Em andamento</th><th style={{textAlign:'right'}}>% Conclusão</th></tr></thead>
            <tbody>{campIndicators.map(c=><tr key={c.campaign_id}><td>{c.campaign_title}</td><td>{c.target_audience}</td>
              <td style={{textAlign:'right'}}><strong>{c.total_completed}</strong></td>
              <td style={{textAlign:'right'}}>{c.total_in_progress}</td>
              <td style={{textAlign:'right',fontWeight:700,color:(c.pct_completion||0)>=50?'#16a34a':'#dc2626'}}>{c.pct_completion!=null?c.pct_completion+'%':'N/D'}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============ RELATÓRIOS CPA ============ */
function RelatoriosCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewReport, setViewReport] = useState<any>(null);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const STATUS_L: Record<string,{l:string;bg:string}> = {
    em_elaboracao:{l:'Em elaboração',bg:'#94a3b8'}, minuta_gerada:{l:'Minuta gerada',bg:'#2563eb'},
    em_revisao:{l:'Em revisão CPA',bg:'#f59e0b'}, aprovado:{l:'Aprovado',bg:'#16a34a'},
    finalizado:{l:'Finalizado',bg:'#059669'}, postagem_registrada:{l:'Postagem registrada',bg:'#7c3aed'},
  };

  useEffect(() => {
    supabase.from('vertice_cpa_reports').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false })
      .then(({ data }) => setReports(data || [])).finally(() => setLoading(false));
  }, [institutionId]);

  const generate = async (reportType: string, yearBase: string) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('vertice-cpa-report', { body: { institution_id: institutionId, report_type: reportType, year_base: yearBase } });
      if (error) throw error;
      if (data?.report_id) {
        const { data: rep } = await supabase.from('vertice_cpa_reports').select('*').eq('id', data.report_id).single();
        if (rep) { setReports(prev => [rep, ...prev.filter(r => r.id !== rep.id)]); setViewReport(rep); }
      }
      alert(`Relatório gerado com ${data?.sections?.length || 0} seções!`);
    } catch (err) { alert('Erro: ' + (err as Error).message); }
    finally { setGenerating(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'em_revisao') updates.reviewed_at = new Date().toISOString();
    if (status === 'aprovado') { updates.approved_at = new Date().toISOString(); }
    await supabase.from('vertice_cpa_reports').update(updates).eq('id', id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    if (viewReport?.id === id) setViewReport((p: any) => ({ ...p, ...updates }));
  };

  const saveSection = async (reportId: string, sectionKey: string, newContent: string) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    const updated = { ...report.content_json, [sectionKey]: { ...report.content_json[sectionKey], content: newContent, ai_notes: 'Editado pela CPA' } };
    await supabase.from('vertice_cpa_reports').update({ content_json: updated, updated_at: new Date().toISOString() }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, content_json: updated } : r));
    setViewReport((p: any) => p?.id === reportId ? { ...p, content_json: updated } : p);
    setEditSection(null);
  };

  const exportReportWord = (report: any) => {
    const sections = Object.values(report.content_json) as any[];
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
body{font-family:Calibri,sans-serif;font-size:12pt;line-height:1.6;margin:40px}
h1{font-size:18pt;color:#1e3a5f;text-align:center;margin-bottom:8px}
h2{font-size:14pt;color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-top:24px}
p{text-align:justify}
.meta{text-align:center;color:#666;font-size:10pt;margin-bottom:24px}
.footer{text-align:center;font-size:9pt;color:#999;margin-top:40px;border-top:1px solid #ccc;padding-top:10px}
</style></head><body>
<h1>${report.title || 'Relatório de Autoavaliação Institucional'}</h1>
<p class="meta">${report.report_type === 'integral' ? 'Relatório Integral' : 'Relatório Parcial'} — Ano-base ${report.year_base}<br/>Gerado pela Plataforma Vértice Educação Superior</p>
${sections.map(s => `<h2>${s.title}</h2><p>${(s.content || '').replace(/\n/g, '</p><p>')}</p>`).join('')}
<p class="footer">Documento gerado automaticamente — Vértice Educação Superior © ${new Date().getFullYear()}</p>
</body></html>`;
    const blob = new Blob(['﻿' + html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Relatorio_CPA_${report.year_base}_${report.report_type}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportReportPDF = (report: any) => {
    const sections = Object.values(report.content_json) as any[];
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para exportar PDF'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${report.title}</title>
<style>@media print{@page{margin:20mm}body{-webkit-print-color-adjust:exact}}
body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.6;margin:40px;color:#1e293b}
h1{font-size:18pt;color:#1e3a5f;text-align:center;margin-bottom:4px}
h2{font-size:13pt;color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-top:20px}
p{text-align:justify}
.meta{text-align:center;color:#64748b;font-size:10pt;margin-bottom:20px}
.footer{text-align:center;font-size:9pt;color:#94a3b8;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:8px}
</style></head><body>
<h1>${report.title || 'Relatório de Autoavaliação Institucional'}</h1>
<p class="meta">${report.report_type === 'integral' ? 'Relatório Integral' : 'Relatório Parcial'} — Ano-base ${report.year_base}<br/>Vértice Educação Superior</p>
${sections.map(s => `<h2>${s.title}</h2><p>${(s.content || '').replace(/\n/g, '</p><p>')}</p>`).join('')}
<p class="footer">Vértice Educação Superior © ${new Date().getFullYear()}</p>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  if (loading) return <p className="alumni-loading">Carregando relatórios…</p>;

  return (
    <section>
      <div className="alumni-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>📄 Relatórios de Autoavaliação</h3>
        {(role === 'master' || role === 'gestor') && !generating && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="alumni-btn-primary" onClick={() => generate('parcial', String(new Date().getFullYear()))}>🤖 Gerar relatório parcial</button>
            <button className="alumni-btn-primary" style={{ background: '#7c3aed' }} onClick={() => generate('integral', String(new Date().getFullYear()))}>🤖 Gerar relatório integral</button>
          </div>
        )}
        {generating && <span style={{ color: '#2563eb', fontWeight: 600 }}>⏳ Gerando com IA (pode levar 1-2 minutos)…</span>}
      </div>

      {/* Lista de relatórios */}
      {reports.length === 0 && !generating ? <EmptyState msg="Nenhum relatório gerado. Clique em 'Gerar relatório' para criar a minuta com IA." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {reports.map(r => {
            const st = STATUS_L[r.status] || { l: r.status, bg: '#94a3b8' };
            const sections = r.content_json ? Object.keys(r.content_json) : [];
            return (
              <div key={r.id} style={{ padding: 12, borderRadius: 10, background: viewReport?.id === r.id ? '#eff6ff' : '#f8fafc', border: `1px solid ${viewReport?.id === r.id ? '#2563eb' : '#e2e8f0'}`, cursor: 'pointer' }}
                onClick={() => setViewReport(viewReport?.id === r.id ? null : r)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <strong>{r.title}</strong>
                    <div style={{ fontSize: '.75rem', color: '#64748b' }}>{r.report_type === 'integral' ? 'Integral' : 'Parcial'} · Ano-base {r.year_base} · v{r.version} · {sections.length} seções</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="alumni-status-pill" style={{ background: st.bg }}>{st.l}</span>
                    {r.generated_at && <span style={{ fontSize: '.65rem', color: '#94a3b8' }}>{new Date(r.generated_at).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Visualizador do relatório */}
      {viewReport && viewReport.content_json && (
        <div style={{ border: '2px solid #2563eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: '1.1rem' }}>{viewReport.title}</strong>
              <div style={{ fontSize: '.8rem', color: '#64748b' }}>{(STATUS_L[viewReport.status] || {}).l} · {viewReport.report_type} · Ano-base {viewReport.year_base}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {viewReport.status === 'minuta_gerada' && (role === 'master' || role === 'gestor') && (
                <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => updateStatus(viewReport.id, 'em_revisao')}>📝 Enviar para revisão CPA</button>
              )}
              {viewReport.status === 'em_revisao' && (role === 'master' || role === 'gestor') && (
                <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => updateStatus(viewReport.id, 'aprovado')}>✅ Aprovar relatório</button>
              )}
              {viewReport.status === 'aprovado' && (
                <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid #059669', background: '#ecfdf5', color: '#059669', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => updateStatus(viewReport.id, 'finalizado')}>📦 Finalizar para postagem</button>
              )}
              {(viewReport.status === 'aprovado' || viewReport.status === 'finalizado') && (
                <>
                  <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => exportReportWord(viewReport)}>📥 Word</button>
                  <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => exportReportPDF(viewReport)}>📥 PDF</button>
                </>
              )}
              <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
                onClick={() => { setViewReport(null); }}>✕ Fechar</button>
            </div>
          </div>

          {/* Seções do relatório */}
          {Object.entries(viewReport.content_json).map(([key, sec]: [string, any]) => (
            <div key={key} style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: '.95rem', color: '#0f172a' }}>{sec.title}</strong>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: '.6rem', padding: '2px 6px', borderRadius: 4, background: sec.ai_notes?.includes('Editado') ? '#dcfce7' : '#dbeafe', color: sec.ai_notes?.includes('Editado') ? '#16a34a' : '#2563eb' }}>{sec.ai_notes?.includes('Editado') ? '✏️ Editado' : '🤖 IA'}</span>
                  {(role === 'master' || role === 'gestor') && viewReport.status !== 'aprovado' && viewReport.status !== 'finalizado' && (
                    <button style={{ fontSize: '.65rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', cursor: 'pointer' }}
                      onClick={() => { setEditSection(key); setEditText(sec.content); }}>✏️ Editar</button>
                  )}
                </div>
              </div>
              {editSection === key ? (
                <div>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={12}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2563eb', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }} onClick={() => setEditSection(null)}>Cancelar</button>
                    <button style={{ fontSize: '.75rem', padding: '4px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                      onClick={() => saveSection(viewReport.id, key, editText)}>Salvar alteração</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '.85rem', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap' }}>{sec.content}</div>
              )}
            </div>
          ))}

          <div style={{ padding: 12, background: '#f5f3ff', borderRadius: 10, fontSize: '.8rem', color: '#475569' }}>
            🤖 <strong>Minuta gerada por IA</strong> — requer revisão e aprovação da CPA. A CPA pode editar cada seção antes de aprovar.
            Fluxo: Minuta → Revisão CPA → Aprovado → Finalizado para postagem.
          </div>
        </div>
      )}
    </section>
  );
}

function AchadosCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [findings, setFindings] = useState<CpaFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const TYPES: Record<string,{l:string;c:string}> = {fragilidade:{l:'Fragilidade',c:'#dc2626'},potencialidade:{l:'Potencialidade',c:'#16a34a'},oportunidade:{l:'Oportunidade',c:'#2563eb'},risco:{l:'Risco',c:'#d97706'},neutro:{l:'Neutro',c:'#6b7280'}};
  useEffect(() => { fetchCpaFindings(institutionId).then(setFindings).finally(() => setLoading(false)); }, [institutionId]);
  if (loading) return <p className="alumni-loading">Carregando achados…</p>;
  return (
    <section>
      <div className="alumni-section-header"><h3>Achados e Decisões</h3>
        {(role==='master'||role==='gestor')&&<button className="alumni-btn-primary" onClick={async()=>{
          const title=prompt('Título do achado:'); if(!title)return;
          const type=prompt('Tipo (fragilidade/potencialidade/oportunidade/risco):')||'fragilidade';
          const f=await createCpaFinding({institution_id:institutionId,title,finding_type:type});
          setFindings(p=>[f,...p]);
        }}>+ Novo Achado</button>}
      </div>
      <p className="alumni-hint">Um achado recusado pela gestão não apaga o registro. Decisões são rastreadas.</p>
      {findings.length===0?<EmptyState msg="Nenhum achado registrado. Analise resultados e registre fragilidades e potencialidades." />:(
        <div className="alumni-findings-list">
          {findings.map(f=>{const t=TYPES[f.finding_type]||TYPES.neutro;return(
            <div key={f.id} className="alumni-finding-card">
              <div className="alumni-finding-header">
                <span className="alumni-finding-type" style={{background:t.c}}>{t.l}</span>
                <strong>{f.title}</strong>
                {f.dimension&&<code className="alumni-finding-ref">{f.dimension}</code>}
                <span className="alumni-finding-status">{f.decision_status}</span>
              </div>
              {f.description&&<p className="alumni-finding-desc">{f.description}</p>}
              {f.decision_notes&&<p className="alumni-hint">Decisão: {f.decision_notes}</p>}
            </div>
          );})}
        </div>
      )}
    </section>
  );
}

function PlanosCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [actions, setActions] = useState<CpaAction[]>([]);
  const [loading, setLoading] = useState(true);
  const FLOW = ['planejada','em_execucao','executada','avaliada','cancelada'];
  useEffect(() => { fetchCpaActions(institutionId).then(setActions).finally(() => setLoading(false)); }, [institutionId]);
  if (loading) return <p className="alumni-loading">Carregando planos…</p>;
  return (
    <section>
      <h3>Planos de Ação e Evidências</h3>
      <p className="alumni-hint">Trilha: Referencial → descritor → resultado → achado → decisão → ação → evidência → avaliação de eficácia → devolutiva.</p>
      {actions.length===0?<EmptyState msg="Nenhuma ação criada. Registre achados primeiro, depois vincule ações de melhoria." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Ação<ContextHelp title="Ação" /></th><th>Responsável<ContextHelp title="Responsável" /></th><th>Prazo</th><th>Status</th><th>Evidência</th><th>Eficácia</th><th></th></tr></thead>
          <tbody>{actions.map(a=><tr key={a.id}><td><strong>{a.title}</strong></td><td>{a.responsible||'—'}</td>
            <td>{a.due_date?new Date(a.due_date).toLocaleDateString('pt-BR'):'—'}</td>
            <td><span className={`alumni-action-status ${a.status}`}>{a.status.replace('_',' ')}</span></td>
            <td>{a.evidence_url?'📎':'—'}</td><td>{a.efficacy_assessment?.substring(0,40)||'—'}</td>
            <td>{(role==='master'||role==='gestor')&&<select value={a.status} onChange={async e=>{await updateCpaActionStatus(a.id,e.target.value);setActions(p=>p.map(x=>x.id===a.id?{...x,status:e.target.value}:x));}} className="alumni-action-select">
              {FLOW.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>}</td></tr>)}</tbody></table>
        </div>
      )}
    </section>
  );
}

function DevolutivasCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [feedbacks, setFeedbacks] = useState<CpaFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchCpaFeedbacks(institutionId).then(setFeedbacks).finally(() => setLoading(false)); }, [institutionId]);
  if (loading) return <p className="alumni-loading">Carregando devolutivas…</p>;
  return (
    <section>
      <div className="alumni-section-header"><h3>Devolutivas à Comunidade</h3>
        {(role==='master'||role==='gestor')&&<button className="alumni-btn-primary" onClick={async()=>{
          const title=prompt('Título da devolutiva:'); if(!title)return;
          const audience=prompt('Público (estudantes/docentes/comunidade/gestão):')||'comunidade';
          const f=await createFeedback({institution_id:institutionId,title,audience,delivered_at:new Date().toISOString()});
          setFeedbacks(p=>[f,...p]);
        }}>+ Registrar Devolutiva</button>}
      </div>
      {feedbacks.length===0?<EmptyState msg="Nenhuma devolutiva registrada. Após executar melhorias, comunique os resultados." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Devolutiva</th><th>Público</th><th>Canal</th><th>Data</th></tr></thead>
          <tbody>{feedbacks.map(f=><tr key={f.id}><td><strong>{f.title}</strong></td><td>{f.audience||'—'}</td><td>{f.channel||'—'}</td>
            <td>{f.delivered_at?new Date(f.delivered_at).toLocaleDateString('pt-BR'):'—'}</td></tr>)}</tbody></table>
        </div>
      )}
    </section>
  );
}

function MetaCPA({ institutionId }: { institutionId: string }) {
  return (
    <section>
      <h3>Meta-avaliação</h3>
      <p className="alumni-hint">Avalie o próprio processo: participação, conclusão, abandono, representatividade, qualidade, reclamações e custo — não apenas volume de mensagens.</p>
      <div className="alumni-info-box">
        <strong>Critérios de meta-avaliação:</strong> Participação efetiva (não apenas convites), taxa de conclusão vs abandono, representatividade por segmento, qualidade das respostas abertas, reclamações recebidas, custo por respondente, tempo médio de preenchimento, melhorias implementadas a partir do ciclo anterior.
      </div>
      <EmptyState msg="Após encerrar um ciclo, registre aqui a avaliação do processo para melhorar o próximo." />
    </section>
  );
}

/* Auxiliares */
function KPI({ label, value, pct, color }: { label: string; value: number; pct?: number; color: string }) {
  return (
    <div className="alumni-kpi" style={{ borderLeftColor: color }}>
      <span className="alumni-kpi-value">{value}</span>
      {pct !== undefined && <span className="alumni-kpi-pct">{pct}%</span>}
      <span className="alumni-kpi-label">{label}</span>
    </div>
  );
}
function EmptyState({ msg }: { msg: string }) {
  return <div className="alumni-empty"><p>{msg}</p></div>;
}

function MesaDigitalCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ report_id: '', protocol_number: '', notes: '', posted_to: 'e-MEC' });

  useEffect(() => {
    Promise.all([
      supabase.from('vertice_cpa_mesa_digital').select('*, report:vertice_cpa_reports(title,report_type,year_base)').eq('institution_id', institutionId).order('posted_at', { ascending: false }),
      supabase.from('vertice_cpa_reports').select('id,title,report_type,year_base,status').eq('institution_id', institutionId).in('status', ['finalizado','postagem_registrada']).order('created_at', { ascending: false })
    ]).then(([{ data: p }, { data: r }]) => {
      setPosts(p || []);
      setReports(r || []);
    }).finally(() => setLoading(false));
  }, [institutionId]);

  const submit = async () => {
    if (!form.report_id) { alert('Selecione um relatório'); return; }
    const { data, error } = await supabase.from('vertice_cpa_mesa_digital').insert({
      institution_id: institutionId, report_id: form.report_id, protocol_number: form.protocol_number || null,
      notes: form.notes || null, posted_to: form.posted_to
    }).select('*, report:vertice_cpa_reports(title,report_type,year_base)').single();
    if (error) { alert('Erro: ' + error.message); return; }
    // Update report status
    await supabase.from('vertice_cpa_reports').update({ status: 'postagem_registrada', updated_at: new Date().toISOString() }).eq('id', form.report_id);
    setPosts(prev => [data, ...prev]);
    setShowForm(false);
    setForm({ report_id: '', protocol_number: '', notes: '', posted_to: 'e-MEC' });
  };

  const updatePostStatus = async (postId: string, status: string) => {
    await supabase.from('vertice_cpa_mesa_digital').update({ status, confirmed_at: status === 'confirmado' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status, confirmed_at: status === 'confirmado' ? new Date().toISOString() : null } : p));
  };

  const ST: Record<string,{l:string;bg:string}> = { postado:{l:'Postado',bg:'#2563eb'}, confirmado:{l:'Confirmado',bg:'#16a34a'}, rejeitado:{l:'Rejeitado',bg:'#dc2626'}, repostado:{l:'Repostado',bg:'#f59e0b'} };

  if (loading) return <p className="alumni-loading">Carregando mesa digital…</p>;

  return (
    <section>
      <div className="alumni-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>🖥 Mesa Digital — Postagem e-MEC/SINAES</h3>
        {(role === 'master' || role === 'gestor') && (
          <button className="alumni-btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancelar' : '📤 Registrar postagem'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, margin: '12px 0' }}>
        <KPI label="Total postagens" value={posts.length} color="#2563eb" />
        <KPI label="Confirmadas" value={posts.filter(p => p.status === 'confirmado').length} color="#16a34a" />
        <KPI label="Pendentes" value={posts.filter(p => p.status === 'postado' || p.status === 'repostado').length} color="#f59e0b" />
        <KPI label="Rejeitadas" value={posts.filter(p => p.status === 'rejeitado').length} color="#dc2626" />
      </div>

      {showForm && (
        <div style={{ border: '2px solid #7c3aed', borderRadius: 12, padding: 16, background: '#faf5ff', marginBottom: 16 }}>
          <strong style={{ fontSize: '.95rem', color: '#7c3aed' }}>📤 Registrar postagem de relatório</strong>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: '.8rem', fontWeight: 600 }}>Relatório finalizado *</label>
              <select value={form.report_id} onChange={e => setForm(f => ({ ...f, report_id: e.target.value }))}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: '.85rem' }}>
                <option value="">Selecione…</option>
                {reports.map(r => <option key={r.id} value={r.id}>{r.title} ({r.report_type} — {r.year_base})</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600 }}>Destino</label>
                <select value={form.posted_to} onChange={e => setForm(f => ({ ...f, posted_to: e.target.value }))}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: '.85rem' }}>
                  <option value="e-MEC">e-MEC</option>
                  <option value="SINAES">SINAES</option>
                  <option value="INEP">INEP</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600 }}>Nº Protocolo</label>
                <input value={form.protocol_number} onChange={e => setForm(f => ({ ...f, protocol_number: e.target.value }))}
                  placeholder="Opcional" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: '.85rem' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '.8rem', fontWeight: 600 }}>Observações</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                placeholder="Detalhes da postagem…" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: '.85rem', resize: 'vertical' }} />
            </div>
            <button onClick={submit} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>
              ✅ Confirmar registro de postagem
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 ? <EmptyState msg="Nenhuma postagem registrada. Finalize um relatório e registre a postagem ao e-MEC." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map(p => (
            <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <strong style={{ fontSize: '.9rem' }}>{p.report?.title || 'Relatório'}</strong>
                  <div style={{ fontSize: '.75rem', color: '#64748b' }}>
                    {p.report?.report_type} — Ano-base {p.report?.year_base} · {p.posted_to}
                    {p.protocol_number && <> · Protocolo: <strong>{p.protocol_number}</strong></>}
                  </div>
                  <div style={{ fontSize: '.7rem', color: '#94a3b8' }}>Postado em {new Date(p.posted_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 99, color: '#fff', background: (ST[p.status] || ST.postado).bg }}>{(ST[p.status] || ST.postado).l}</span>
                  {(role === 'master' || role === 'gestor') && p.status === 'postado' && (
                    <>
                      <button style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}
                        onClick={() => updatePostStatus(p.id, 'confirmado')}>✅ Confirmar</button>
                      <button style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                        onClick={() => updatePostStatus(p.id, 'rejeitado')}>❌ Rejeitar</button>
                    </>
                  )}
                  {(role === 'master' || role === 'gestor') && p.status === 'rejeitado' && (
                    <button style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', cursor: 'pointer' }}
                      onClick={() => updatePostStatus(p.id, 'repostado')}>🔄 Repostar</button>
                  )}
                </div>
              </div>
              {p.notes && <div style={{ marginTop: 6, fontSize: '.8rem', color: '#475569', background: '#f8fafc', padding: 8, borderRadius: 6 }}>{p.notes}</div>}
              {p.confirmed_at && <div style={{ fontSize: '.7rem', color: '#16a34a', marginTop: 4 }}>✅ Confirmado em {new Date(p.confirmed_at).toLocaleDateString('pt-BR')}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, background: '#f5f3ff', borderRadius: 10, fontSize: '.8rem', color: '#475569' }}>
        🖥 <strong>Mesa Digital</strong> — Registre aqui as postagens dos relatórios CPA ao e-MEC/SINAES. Após postagem, aguarde a confirmação do protocolo.
      </div>
    </section>
  );
}
