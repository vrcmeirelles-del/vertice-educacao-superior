import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isFullAccess, type Role } from '@/lib/area';
import './planning/planning.css';

type Course = { id: string; name: string; code?: string | null };
type Trail = { id: string; code: string; name: string; description: string | null; curriculum_competency_id: string | null; keywords: string[] };
type QuestionLink = { id: string; trail_id: string; enade_year: number | null; question_number: number | null; question_text: string | null; national_correct_pct: number | null; ies_correct_pct: number | null; discrepancy: number | null; source: string };
type Diagnostic = { trail_id: string; code: string; name: string; question_count: number; avg_national_pct: number | null; avg_ies_pct: number | null; total_discrepancy: number | null; avg_discrepancy: number | null; status: string };
type TrailAction = { id: string; snapshot_id: string | null; trail_id: string | null; action_type: string; description: string; responsible: string | null; deadline: string | null; status: string; goal_id: string | null };

const ACTION_LABELS: Record<string, string> = { oficina_retomada: 'Oficina de Retomada', revisao_ementa: 'Revisão de Ementa', capacitacao_docente: 'Capacitação Docente', material_complementar: 'Material Complementar', simulado_dirigido: 'Simulado Dirigido', outro: 'Outro' };
const STATUS_LABELS: Record<string, string> = { planned: 'Planejado', in_progress: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado' };
const BADGE: Record<string, { label: string; color: string; emoji: string }> = {
  critico: { label: 'Crítico', color: '#dc2626', emoji: '🔴' },
  atencao: { label: 'Atenção', color: '#d97706', emoji: '🟡' },
  estavel: { label: 'Estável', color: '#2563eb', emoji: '🔵' },
  forte: { label: 'Forte', color: '#16a34a', emoji: '🟢' },
};

const HELP_TEXT = `As Trilhas de Formação agrupam disciplinas de uma mesma área de competência do currículo. Cada trilha é avaliada pelo ENADE — o módulo cruza as questões do exame com as trilhas, calcula a discrepância entre o desempenho da IES e a média nacional, e identifica quais trilhas precisam de ação pedagógica urgente.

Fluxo completo:
1. Defina as trilhas (ou importe da Construção Curricular)
2. Mapeie questões ENADE para cada trilha
3. O diagnóstico é calculado automaticamente
4. Crie ações corretivas que viram 5W2H`;

function HelpPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <div className="planning-help-popup" onClick={onClose}><div className="planning-help-inner" onClick={e => e.stopPropagation()}>
    <button className="planning-help-close" onClick={onClose}>✕</button>
    <h4>🔬 Trilhas de Formação ENADE</h4>
    <p style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</p>
  </div></div>;
}

function discColor(d: number | null): string {
  if (d == null) return '#94a3b8';
  if (d < -5) return '#dc2626';
  if (d < 0) return '#d97706';
  if (d < 3) return '#2563eb';
  return '#16a34a';
}

export default function TrailAnalysis({ institutionId, courses, role }: { institutionId: string; courseId?: string; courses: Course[]; role: Role | null }) {
  const [courseId, setCourseId] = useState('');
  const [tab, setTab] = useState<'trails' | 'questions' | 'diagnostic' | 'actions'>('trails');
  const [helpOpen, setHelpOpen] = useState(false);
  const canWrite = isFullAccess(role) || role === 'coordenador' || role === 'nde';

  // Data
  const [trails, setTrails] = useState<Trail[]>([]);
  const [questions, setQuestions] = useState<QuestionLink[]>([]);
  const [diagnostic, setDiagnostic] = useState<Diagnostic[]>([]);
  const [actions, setActions] = useState<TrailAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  async function loadAll() {
    if (!courseId) return;
    setLoading(true);
    try {
      const [t, q, d, a] = await Promise.all([
        supabase.from('formation_trails').select('*').eq('institution_id', institutionId).eq('course_id', courseId).order('code'),
        supabase.from('trail_question_links').select('*').order('enade_year', { ascending: false }),
        supabase.from('v_trail_diagnostic').select('*').eq('institution_id', institutionId).eq('course_id', courseId).order('total_discrepancy'),
        supabase.from('trail_actions').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      setTrails(t.data || []);
      // Filter questions to only those belonging to this course's trails
      const trailIds = new Set((t.data || []).map((x: Trail) => x.id));
      setQuestions((q.data || []).filter((x: QuestionLink) => trailIds.has(x.trail_id)));
      setDiagnostic(d.data || []);
      // Filter actions to this course's trails
      setActions((a.data || []).filter((x: TrailAction) => !x.trail_id || trailIds.has(x.trail_id)));
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [courseId, institutionId]);

  // ── Trail CRUD ──
  async function addTrail() {
    if (!courseId) return;
    await supabase.from('formation_trails').insert({ institution_id: institutionId, course_id: courseId, code: `T${trails.length + 1}`, name: '', description: '', keywords: [] });
    loadAll();
  }

  async function updateTrail(id: string, patch: Partial<Trail>) {
    await supabase.from('formation_trails').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    setTrails(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  async function deleteTrail(id: string) {
    if (!confirm('Remover esta trilha e todas as questões vinculadas?')) return;
    await supabase.from('formation_trails').delete().eq('id', id);
    loadAll();
  }

  async function importFromCurriculum() {
    if (!courseId) return;
    const { data } = await supabase.from('curriculum_competencies').select('id, code, title, description').order('sort_order');
    if (!data?.length) { setNotice('Nenhuma competência encontrada na Construção Curricular. Cadastre as competências primeiro.'); return; }
    // Find the build_id for this course
    const { data: builds } = await supabase.from('curriculum_builds').select('id').eq('institution_id', institutionId).eq('course_id', courseId).order('version', { ascending: false }).limit(1);
    if (!builds?.length) { setNotice('Nenhuma versão da Construção Curricular encontrada para este curso.'); return; }
    const buildId = builds[0].id;
    const { data: comps } = await supabase.from('curriculum_competencies').select('id, code, title, description').eq('build_id', buildId).order('sort_order');
    if (!comps?.length) { setNotice('Nenhuma competência cadastrada nesta versão.'); return; }
    for (const c of comps) {
      const exists = trails.find(t => t.curriculum_competency_id === c.id);
      if (!exists) {
        await supabase.from('formation_trails').insert({
          institution_id: institutionId, course_id: courseId,
          code: c.code, name: c.title, description: c.description,
          curriculum_competency_id: c.id, keywords: [],
        });
      }
    }
    setNotice(`${comps.length} competências importadas como trilhas.`);
    loadAll();
  }

  // ── Question CRUD ──
  const [newQ, setNewQ] = useState({ trail_id: '', enade_year: '', question_number: '', question_text: '', national_correct_pct: '', ies_correct_pct: '' });

  async function addQuestion() {
    if (!newQ.trail_id) return;
    await supabase.from('trail_question_links').insert({
      trail_id: newQ.trail_id,
      enade_year: newQ.enade_year ? Number(newQ.enade_year) : null,
      question_number: newQ.question_number ? Number(newQ.question_number) : null,
      question_text: newQ.question_text || null,
      national_correct_pct: newQ.national_correct_pct ? Number(newQ.national_correct_pct) : null,
      ies_correct_pct: newQ.ies_correct_pct ? Number(newQ.ies_correct_pct) : null,
    });
    setNewQ({ trail_id: '', enade_year: '', question_number: '', question_text: '', national_correct_pct: '', ies_correct_pct: '' });
    loadAll();
  }

  async function deleteQuestion(id: string) {
    await supabase.from('trail_question_links').delete().eq('id', id);
    loadAll();
  }

  // ── Snapshot ──
  async function generateSnapshot() {
    if (!diagnostic.length) return;
    const rankings = diagnostic.map(d => ({ trail_id: d.trail_id, name: d.name, total_discrepancy: d.total_discrepancy, avg_discrepancy: d.avg_discrepancy, question_count: d.question_count, status: d.status }));
    const weakest = diagnostic.filter(d => d.status === 'critico' || d.status === 'atencao').map(d => ({ trail: d.name, discrepancy: d.avg_discrepancy, suggested_action: d.status === 'critico' ? 'Oficina de retomada urgente' : 'Revisão de ementa e materiais' }));
    const summary = `Diagnóstico ENADE — ${diagnostic.length} trilhas analisadas. ${diagnostic.filter(d => d.status === 'critico').length} em estado crítico, ${diagnostic.filter(d => d.status === 'atencao').length} em atenção.`;
    await supabase.from('trail_analysis_snapshots').insert({ institution_id: institutionId, course_id: courseId, trail_rankings: rankings, weakest_disciplines: weakest, summary });
    setNotice('Snapshot de diagnóstico salvo.');
  }

  // ── Action CRUD ──
  async function addAction(trailId?: string) {
    // Get latest snapshot
    const { data: snaps } = await supabase.from('trail_analysis_snapshots').select('id').eq('institution_id', institutionId).eq('course_id', courseId).order('created_at', { ascending: false }).limit(1);
    await supabase.from('trail_actions').insert({
      snapshot_id: snaps?.[0]?.id || null,
      trail_id: trailId || null,
      action_type: 'oficina_retomada',
      description: '',
      status: 'planned',
    });
    loadAll();
  }

  async function updateAction(id: string, patch: Partial<TrailAction>) {
    await supabase.from('trail_actions').update(patch).eq('id', id);
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }

  async function deleteAction(id: string) {
    await supabase.from('trail_actions').delete().eq('id', id);
    loadAll();
  }

  const tabs: { key: typeof tab; icon: string; label: string }[] = [
    { key: 'trails', icon: '🧬', label: 'Trilhas' },
    { key: 'questions', icon: '📝', label: 'Questões' },
    { key: 'diagnostic', icon: '📊', label: 'Diagnóstico' },
    { key: 'actions', icon: '✅', label: 'Plano de Ação' },
  ];

  return <section className="course-planning" aria-label="Trilhas de Formação ENADE">
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h2>🔬 Trilhas de Formação ENADE</h2>
        <p>Diagnóstico por competência — cruze currículo, questões e desempenho para identificar fragilidades.</p>
      </div>
      <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }} onClick={() => setHelpOpen(true)} title="Como funciona?">❓</button>
    </header>
    <HelpPopup open={helpOpen} onClose={() => setHelpOpen(false)} />

    {notice && <p role="status" className="planning-success">{notice} <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setNotice('')}>✕</button></p>}

    {/* Course selector */}
    <label className="planning-field"><span>Curso</span>
      <select value={courseId} onChange={e => setCourseId(e.target.value)}>
        <option value="">Selecione um curso</option>
        {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ''}{c.name}</option>)}
      </select>
    </label>

    {!courseId ? <p style={{ color: '#64748b', marginTop: 16 }}>Selecione o curso para começar.</p> : loading ? <p role="status">Carregando…</p> : <>
      {/* Internal tabs */}
      <nav style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
        {tabs.map(t => <button key={t.key} type="button" className={tab === t.key ? 'planning-primary' : ''} onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{t.icon}</span> {t.label}
          {t.key === 'diagnostic' && diagnostic.filter(d => d.status === 'critico').length > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{diagnostic.filter(d => d.status === 'critico').length}</span>}
        </button>)}
      </nav>

      {/* ── Tab 1: Trilhas ── */}
      {tab === 'trails' && <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {canWrite && <button className="btn-ghost" style={{ flex: 'none', width: 'auto', padding: '10px 18px' }} onClick={importFromCurriculum}>📥 Importar da Construção Curricular</button>}
          {canWrite && <button className="btn-ghost" style={{ flex: 'none', width: 'auto', padding: '10px 18px' }} onClick={addTrail}>+ Adicionar Trilha</button>}
        </div>
        {!trails.length ? <p style={{ color: '#64748b' }}>Nenhuma trilha cadastrada. Importe da Construção Curricular ou crie manualmente.</p> :
          <div className="stack" style={{ gap: 12 }}>
            {trails.map(t => <details key={t.id} className="course-planning-entry" open>
              <summary>{t.code} — {t.name || '(sem nome)'}</summary>
              <div style={{ padding: 20 }}>
                <fieldset disabled={!canWrite} style={{ border: 0, padding: 0, margin: 0 }}>
                  <div className="row">
                    <label className="planning-field"><span>Código</span><input value={t.code} onChange={e => updateTrail(t.id, { code: e.target.value })} /></label>
                    <label className="planning-field"><span>Nome da Trilha</span><input value={t.name} onChange={e => updateTrail(t.id, { name: e.target.value })} /></label>
                  </div>
                  <label className="planning-field"><span>Descrição</span><textarea rows={2} value={t.description || ''} onChange={e => updateTrail(t.id, { description: e.target.value })} /></label>
                  <label className="planning-field"><span>Palavras-chave (separadas por vírgula — usadas para vincular questões ENADE automaticamente)</span>
                    <input value={(t.keywords || []).join(', ')} onChange={e => updateTrail(t.id, { keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })} placeholder="direito civil, obrigações, contratos" />
                  </label>
                  {t.curriculum_competency_id && <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>🔗 Vinculada à competência da Construção Curricular</p>}
                </fieldset>
                {canWrite && <button style={{ marginTop: 12, color: '#dc2626', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => deleteTrail(t.id)}>🗑 Remover trilha</button>}
              </div>
            </details>)}
          </div>
        }
      </div>}

      {/* ── Tab 2: Mapeamento de Questões ── */}
      {tab === 'questions' && <div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>📝 {questions.length} questão(ões) mapeada(s) em {trails.length} trilha(s).</p>
        <div className="planning-scroll">
          <table>
            <thead><tr><th>Trilha</th><th>Ano</th><th>Questão</th><th>% Brasil</th><th>% IES</th><th>Discrepância</th><th></th></tr></thead>
            <tbody>
              {questions.map(q => {
                const trail = trails.find(t => t.id === q.trail_id);
                return <tr key={q.id}>
                  <td>{trail?.code || '—'}</td>
                  <td>{q.enade_year || '—'}</td>
                  <td>{q.question_number ? `Q${q.question_number}` : '—'}{q.question_text ? ` — ${q.question_text.slice(0, 40)}…` : ''}</td>
                  <td>{q.national_correct_pct != null ? `${q.national_correct_pct}%` : '—'}</td>
                  <td>{q.ies_correct_pct != null ? `${q.ies_correct_pct}%` : '—'}</td>
                  <td style={{ fontWeight: 700, color: discColor(q.discrepancy) }}>{q.discrepancy != null ? `${q.discrepancy > 0 ? '+' : ''}${q.discrepancy.toFixed(1)}pp` : '—'}</td>
                  <td>{canWrite && <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626' }} onClick={() => deleteQuestion(q.id)}>✕</button>}</td>
                </tr>;
              })}
              {/* New question row */}
              {canWrite && <tr style={{ background: '#f0f7ff' }}>
                <td><select value={newQ.trail_id} onChange={e => setNewQ({ ...newQ, trail_id: e.target.value })} style={{ minWidth: 80 }}>
                  <option value="">Trilha…</option>
                  {trails.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select></td>
                <td><input type="number" placeholder="Ano" value={newQ.enade_year} onChange={e => setNewQ({ ...newQ, enade_year: e.target.value })} style={{ width: 70 }} /></td>
                <td><input type="number" placeholder="Nº" value={newQ.question_number} onChange={e => setNewQ({ ...newQ, question_number: e.target.value })} style={{ width: 60 }} /></td>
                <td><input type="number" placeholder="% Brasil" value={newQ.national_correct_pct} onChange={e => setNewQ({ ...newQ, national_correct_pct: e.target.value })} style={{ width: 80 }} /></td>
                <td><input type="number" placeholder="% IES" value={newQ.ies_correct_pct} onChange={e => setNewQ({ ...newQ, ies_correct_pct: e.target.value })} style={{ width: 80 }} /></td>
                <td colSpan={2}><button onClick={addQuestion} disabled={!newQ.trail_id} className="planning-primary" style={{ padding: '6px 14px', fontSize: 13 }}>+ Adicionar</button></td>
              </tr>}
            </tbody>
          </table>
        </div>
      </div>}

      {/* ── Tab 3: Diagnóstico ── */}
      {tab === 'diagnostic' && <div>
        {!diagnostic.length || !questions.length ? <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>📊 Sem dados para diagnóstico</p>
          <p style={{ color: '#64748b' }}>Cadastre trilhas e mapeie questões ENADE para gerar o diagnóstico automático.</p>
        </div> : <>
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {Object.entries(BADGE).map(([key, b]) => {
              const count = diagnostic.filter(d => d.status === key).length;
              if (!count) return null;
              return <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: `2px solid ${b.color}`, borderRadius: 10, fontWeight: 600, fontSize: 14 }}>
                {b.emoji} {count} {b.label}
              </div>;
            })}
            <div style={{ marginLeft: 'auto' }}>
              {canWrite && <button className="planning-primary" style={{ padding: '10px 20px' }} onClick={generateSnapshot}>📸 Salvar Snapshot</button>}
            </div>
          </div>

          {/* Trail ranking cards */}
          <div className="stack" style={{ gap: 14 }}>
            {diagnostic.sort((a, b) => (a.total_discrepancy ?? 0) - (b.total_discrepancy ?? 0)).map(d => {
              const badge = BADGE[d.status] || BADGE.estavel;
              return <div key={d.trail_id} className="card" style={{ borderLeft: `5px solid ${badge.color}`, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Big discrepancy number */}
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: badge.color, lineHeight: 1 }}>
                    {d.total_discrepancy != null ? `${d.total_discrepancy > 0 ? '+' : ''}${d.total_discrepancy.toFixed(1)}` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>discrepância total</div>
                </div>

                {/* Trail info */}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 15 }}>{d.code} — {d.name}</strong>
                    <span style={{ background: badge.color, color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{badge.emoji} {badge.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>📝 {d.question_count} questões</span>
                    <span>🇧🇷 Média Brasil: {d.avg_national_pct ?? '—'}%</span>
                    <span>🏫 Média IES: {d.avg_ies_pct ?? '—'}%</span>
                    <span>Δ médio: <strong style={{ color: discColor(d.avg_discrepancy) }}>{d.avg_discrepancy != null ? `${d.avg_discrepancy > 0 ? '+' : ''}${d.avg_discrepancy.toFixed(1)}pp` : '—'}</strong></span>
                  </div>
                </div>

                {/* Quick action */}
                {canWrite && d.status !== 'forte' && d.status !== 'estavel' && <button onClick={() => { setTab('actions'); addAction(d.trail_id); }} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>⚡ Criar ação</button>}
              </div>;
            })}
          </div>
        </>}
      </div>}

      {/* ── Tab 4: Plano de Ação ── */}
      {tab === 'actions' && <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>✅ {actions.length} ação(ões) cadastrada(s)</p>
          {canWrite && <button className="btn-ghost" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => addAction()}>+ Criar Ação</button>}
        </div>
        {!actions.length ? <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Nenhuma ação cadastrada. Gere um diagnóstico e crie ações a partir dele.</div> :
          <div className="stack" style={{ gap: 12 }}>
            {actions.map(a => {
              const trail = trails.find(t => t.id === a.trail_id);
              return <div key={a.id} className="card" style={{ padding: 18 }}>
                <fieldset disabled={!canWrite} style={{ border: 0, padding: 0, margin: 0 }}>
                  <div className="row">
                    <label className="planning-field"><span>Tipo de Ação</span>
                      <select value={a.action_type} onChange={e => updateAction(a.id, { action_type: e.target.value })}>
                        {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label className="planning-field"><span>Trilha</span>
                      <select value={a.trail_id || ''} onChange={e => updateAction(a.id, { trail_id: e.target.value || null } as any)}>
                        <option value="">Geral</option>
                        {trails.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                      </select>
                    </label>
                    <label className="planning-field"><span>Status</span>
                      <select value={a.status} onChange={e => updateAction(a.id, { status: e.target.value })}>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="planning-field"><span>Descrição da ação</span>
                    <textarea rows={2} value={a.description} onChange={e => updateAction(a.id, { description: e.target.value })} placeholder="Descreva a ação corretiva..." />
                  </label>
                  <div className="row">
                    <label className="planning-field"><span>Responsável</span><input value={a.responsible || ''} onChange={e => updateAction(a.id, { responsible: e.target.value || null })} /></label>
                    <label className="planning-field"><span>Prazo</span><input type="date" value={a.deadline || ''} onChange={e => updateAction(a.id, { deadline: e.target.value || null })} /></label>
                  </div>
                </fieldset>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  {trail && <span style={{ fontSize: 12, color: '#64748b' }}>🔗 {trail.code} — {trail.name}</span>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ fontSize: 12, color: '#145b8c', background: 'none', border: 'none', cursor: 'pointer' }}>📋 Promover para 5W2H →</button>
                    {canWrite && <button style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => deleteAction(a.id)}>🗑 Remover</button>}
                  </div>
                </div>
              </div>;
            })}
          </div>
        }
      </div>}
    </>}
  </section>;
}
