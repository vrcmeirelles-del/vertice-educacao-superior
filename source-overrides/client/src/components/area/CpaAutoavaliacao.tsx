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
  CpaReference, CpaReferenceObject, CpaMember, CpaMeeting,
  CpaCycle, CpaInstrument, CpaCampaign,
  CpaFinding, CpaAction, CpaFeedback,
  CpaCampaignIndicator, CpaCycleSummary,
} from '../../lib/cpa';
import './egressos360.css'; // reutiliza estilos alumni-*

interface Props {
  institutionId: string;
  role: 'master' | 'gestor' | 'equipe';
}

type View = 'overview' | 'governanca' | 'referenciais' | 'ciclos' | 'instrumentos' | 'campanhas' | 'resultados' | 'achados' | 'planos' | 'devolutivas' | 'meta';

const NAV: { v: View; label: string; icon: string }[] = [
  { v: 'overview', label: 'Visão Geral', icon: '📊' },
  { v: 'governanca', label: 'Governança', icon: '⚖' },
  { v: 'referenciais', label: 'Referenciais', icon: '📚' },
  { v: 'ciclos', label: 'Ciclos', icon: '🔄' },
  { v: 'instrumentos', label: 'Instrumentos', icon: '📋' },
  { v: 'campanhas', label: 'Campanhas', icon: '📨' },
  { v: 'resultados', label: 'Resultados', icon: '📈' },
  { v: 'achados', label: 'Achados', icon: '🔍' },
  { v: 'planos', label: 'Planos', icon: '🎯' },
  { v: 'devolutivas', label: 'Devolutivas', icon: '📢' },
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
      {view === 'resultados' && <ResultadosCPA campIndicators={campIndicators} />}
      {view === 'achados' && <AchadosCPA institutionId={institutionId} role={role} />}
      {view === 'planos' && <PlanosCPA institutionId={institutionId} role={role} />}
      {view === 'devolutivas' && <DevolutivasCPA institutionId={institutionId} role={role} />}
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
          <table className="alumni-table"><thead><tr><th>Instrumento</th><th>Público</th><th>Versão</th><th>Status</th><th>Origem</th></tr></thead>
          <tbody>{instruments.map(i=><tr key={i.id}><td><strong>{i.title}</strong></td><td>{AUDIENCES[i.target_audience]||i.target_audience}</td><td>v{i.version}</td>
            <td><span className="alumni-status-pill" style={{background:i.status==='publicado'?'#16a34a':i.status==='piloto'?'#d97706':'#94a3b8'}}>{i.status}</span></td>
            <td style={{ fontSize: '.7rem' }}>{(i as any).template_source_id ? '📚 Biblioteca' : '✏️ Próprio'}</td></tr>)}</tbody></table>
        </div>
      )}
    </section>
  );
}

function CampanhasCPA({ institutionId, role }: { institutionId: string; role: string }) {
  const [campaigns, setCampaigns] = useState<CpaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchCampaigns(institutionId).then(setCampaigns).finally(() => setLoading(false)); }, [institutionId]);
  if (loading) return <p className="alumni-loading">Carregando campanhas…</p>;
  return (
    <section>
      <div className="alumni-section-header"><h3>Campanhas de Coleta</h3></div>
      <p className="alumni-hint">Cada campanha vincula ciclo, instrumento, público e período. Não envia campanhas reais sem autorização.</p>
      {campaigns.length===0?<EmptyState msg="Nenhuma campanha criada. Vincule um instrumento a um ciclo para começar." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Campanha</th><th>Público</th><th>Canais</th><th>Período<ContextHelp title="Período" /></th><th>Status</th><th>Horas</th></tr></thead>
          <tbody>{campaigns.map(c=><tr key={c.id}><td><strong>{c.title}</strong></td><td>{c.target_audience}</td><td>{c.channels.join(', ')}</td>
            <td>{new Date(c.opens_at).toLocaleDateString('pt-BR')} → {new Date(c.closes_at).toLocaleDateString('pt-BR')}</td>
            <td><span className="alumni-status-pill" style={{background:c.status==='ativa'?'#16a34a':c.status==='encerrada'?'#6b7280':'#d97706'}}>{c.status}</span></td>
            <td>{c.complementary_hours_enabled?'✓':'—'}</td></tr>)}</tbody></table>
        </div>
      )}
      <div className="alumni-info-box alumni-info-box-warn">
        <strong>Horas complementares:</strong> desativadas por padrão. Cada IES configura após aprovar suas regras. A recompensa não pode depender do conteúdo da resposta.
      </div>
    </section>
  );
}

function ResultadosCPA({ campIndicators }: { campIndicators: CpaCampaignIndicator[] }) {
  return (
    <section>
      <h3>Participação e Resultados</h3>
      {campIndicators.length===0?<EmptyState msg="Sem dados de participação. Ative campanhas para gerar indicadores." />:(
        <div className="alumni-table-wrapper">
          <table className="alumni-table"><thead><tr><th>Campanha</th><th>Público</th><th style={{textAlign:'right'}}>Elegíveis</th><th style={{textAlign:'right'}}>Convidados</th><th style={{textAlign:'right'}}>Entregues</th><th style={{textAlign:'right'}}>Concluídos</th><th style={{textAlign:'right'}}>Em andamento</th><th style={{textAlign:'right'}}>% Conclusão</th></tr></thead>
          <tbody>{campIndicators.map(c=><tr key={c.campaign_id}><td>{c.campaign_title}</td><td>{c.target_audience}</td>
            <td style={{textAlign:'right'}}>{c.total_eligible}</td><td style={{textAlign:'right'}}>{c.total_invited}</td>
            <td style={{textAlign:'right'}}>{c.total_delivered}</td><td style={{textAlign:'right'}}><strong>{c.total_completed}</strong></td>
            <td style={{textAlign:'right'}}>{c.total_in_progress}</td>
            <td style={{textAlign:'right'}}>{c.pct_completion!=null?c.pct_completion+'%':'N/D'}</td></tr>)}</tbody></table>
        </div>
      )}
      <div className="alumni-info-box alumni-info-box-warn">
        Envio ≠ entrega ≠ leitura ≠ resposta. Denominador zero = "não disponível". Não calcular margem de erro para participação voluntária sem base metodológica.
      </div>
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
