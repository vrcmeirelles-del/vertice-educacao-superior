import { useEffect, useState } from 'react';
import { diagnoseCourse, TRAIL_DIAGNOSIS_RULES } from '@/lib/trail-diagnosis';
import { addTrailQuestion, deleteTrail as rpcDeleteTrail, deleteTrailQuestion, importTrailsFromCurriculum, loadTrails, saveTrail, saveTrailSnapshot, type TrailState } from '@/lib/trails-api';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { type Role } from '@/lib/area';
import { storeActionDraft } from '@/lib/portal-integration';
import './planning/planning.css';

type Course = { id: string; name: string; code?: string | null };
type Trail = { id: string; code: string; name: string; description: string | null; curriculum_competency_id: string | null; keywords: string[] };
type QuestionLink = { id: string; trail_id: string; enade_year: number | null; question_number: number | null; question_text: string | null; national_correct_pct: number | null; ies_correct_pct: number | null; discrepancy: number | null; source: string; fo_question_id?: string | null };
type Diagnostic = { trail_id: string; code: string; name: string; question_count: number; avg_national_pct: number | null; avg_ies_pct: number | null; total_discrepancy: number | null; avg_discrepancy: number | null; status: string };

/* ── Fato & Ordem connection (read-only) ── */
const FO_URL = 'https://nckgdluyfubnvarxuiaf.supabase.co';
const FO_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ja2dkbHV5ZnVibnZhcnh1aWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjMyNTQsImV4cCI6MjEwODc5OTI1NH0.K6rLZv-GDWxr86m7KoPv7LAI_NcnOlDnJ_p9Y_XirWE';
const foClient = createClient(FO_URL, FO_ANON);

type FoQuestion = { id: string; exam_year: number; question_number: number; discipline: string; theme: string; subtheme: string; competency: string; difficulty: string; statement_preview: string; correct_answer: string; tags: string[]; legal_basis_preview: string };

const BADGE: Record<string, { label: string; color: string; emoji: string }> = {
  critico: { label: 'Crítico', color: '#dc2626', emoji: '🔴' },
  atencao: { label: 'Atenção', color: '#d97706', emoji: '🟡' },
  estavel: { label: 'Estável', color: '#2563eb', emoji: '🔵' },
  forte: { label: 'Forte', color: '#16a34a', emoji: '🟢' },
};

const HELP_TEXT = `As Trilhas de Formação agrupam disciplinas de uma mesma área de competência do currículo. Cada trilha é avaliada pelo ENADE — o módulo cruza as questões do exame com as trilhas, calcula a discrepância entre o desempenho da IES e a média nacional, e identifica quais trilhas precisam de ação pedagógica urgente.

Fluxo completo:
1. Defina as trilhas (ou importe da Construção Curricular)
2. Importe questões ENADE do Fato & Ordem por disciplina/tema
3. O diagnóstico por regras aponta prioridades, padrão, tendência e ações (sem IA)
4. Ações corretivas viram 5W2H no Plano de Ação do portal`;

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

export default function TrailAnalysis({ institutionId, courses }: { institutionId: string; courseId?: string; courses: Course[]; role: Role | null }) {
  const [courseId, setCourseId] = useState('');
  const [tab, setTab] = useState<'trails' | 'questions' | 'diagnostic' | 'actions'>('trails');
  const [helpOpen, setHelpOpen] = useState(false);
  // O servidor decide quem grava: gestão da IES ou coordenação/NDE do curso.
  const [serverCanWrite, setServerCanWrite] = useState(false);
  const canWrite = serverCanWrite;

  const [trails, setTrails] = useState<Trail[]>([]);
  const [questions, setQuestions] = useState<QuestionLink[]>([]);
  const [diagnostic, setDiagnostic] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  /* ── Fato & Ordem auto-sync state ── */
  const [foQuestions, setFoQuestions] = useState<FoQuestion[]>([]);
  const [foSyncing, setFoSyncing] = useState(false);

  /* ── Diagnóstico por regras ── */
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagReport, setDiagReport] = useState<string | null>(null);

  async function loadAll() {
    if (!courseId) return;
    setLoading(true);
    try {
      const loadedTrails = applyState(await loadTrails(institutionId, courseId));

      // ── Auto-sync: buscar questões do Fato & Ordem pelas keywords das trilhas ──
      if (loadedTrails.length > 0) {
        syncFatoEOrdem(loadedTrails);
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível carregar as trilhas.'); }
    setLoading(false);
  }

  function applyState(state: TrailState): Trail[] {
    setTrails(state.trails); setQuestions(state.questions); setDiagnostic(state.diagnostic); setServerCanWrite(state.canWrite);
    return state.trails;
  }
  async function run(op: () => Promise<TrailState>, ok?: (s: TrailState) => string) {
    try { const s = await op(); applyState(s); if (ok) setNotice(ok(s)); return true; }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Operação recusada.'); return false; }
  }

  /** Busca automática no Fato & Ordem por keywords de todas as trilhas */
  async function syncFatoEOrdem(currentTrails: Trail[]) {
    const allKeywords = currentTrails.flatMap(t => t.keywords || []).filter(Boolean);
    if (!allKeywords.length) { setFoQuestions([]); return; }
    setFoSyncing(true);
    try {
      // Build OR filter: discipline or theme matches any keyword
      const orClauses = allKeywords.map(k => `discipline.ilike.%${k}%,theme.ilike.%${k}%,subtheme.ilike.%${k}%`).join(',');
      const { data } = await foClient.from('v_enade_questions').select('*').or(orClauses).order('exam_year', { ascending: false }).limit(200);
      setFoQuestions(data || []);
    } catch { setFoQuestions([]); }
    setFoSyncing(false);
  }

  /** Mapeia questão F&O para a trilha mais relevante pelas keywords */
  function matchTrail(q: FoQuestion, currentTrails: Trail[]): Trail | undefined {
    for (const t of currentTrails) {
      if (!t.keywords?.length) continue;
      const match = t.keywords.some(kw => {
        const lk = kw.toLowerCase();
        return q.discipline.toLowerCase().includes(lk) || q.theme.toLowerCase().includes(lk) || q.subtheme.toLowerCase().includes(lk) || (q.tags || []).some(tag => tag.toLowerCase().includes(lk));
      });
      if (match) return t;
    }
    return undefined;
  }

  /** Questões do F&O agrupadas por trilha (auto-matching) */
  const foByTrail = trails.reduce<Record<string, FoQuestion[]>>((acc, t) => {
    acc[t.id] = foQuestions.filter(q => matchTrail(q, [t]));
    return acc;
  }, {});
  const foMatched = foQuestions.filter(q => matchTrail(q, trails));
  const foUnmatched = foQuestions.filter(q => !matchTrail(q, trails));

  useEffect(() => { loadAll(); setDiagReport(null); }, [courseId, institutionId]);

  // ── Trail CRUD (pela RPC; edição local e gravação ao sair do campo) ──
  async function addTrail() {
    if (!courseId) return;
    let n = trails.length + 1; while (trails.some(t => t.code.toLowerCase() === `t${n}`)) n++;
    await run(() => saveTrail(institutionId, courseId, { code: `T${n}`, name: 'Nova trilha', keywords: [] }));
  }

  function editTrail(id: string, patch: Partial<Trail>) {
    setTrails(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }
  async function persistTrail(id: string) {
    const t = trails.find(x => x.id === id); if (!t) return;
    await run(() => saveTrail(institutionId, courseId, { id: t.id, code: t.code, name: t.name, description: t.description, keywords: t.keywords || [] }));
  }

  async function deleteTrail(id: string) {
    if (!confirm('Remover esta trilha e todas as questões vinculadas?')) return;
    await run(() => rpcDeleteTrail(institutionId, courseId, id));
  }

  async function importFromCurriculum() {
    if (!courseId) return;
    await run(() => importTrailsFromCurriculum(institutionId, courseId),
      s => s.imported ? `${s.imported} competência(s) importada(s) como trilhas.` : 'Todas as competências da matriz já têm trilha.');
  }

  // ── Diagnóstico por regras (sem IA): lib/trail-diagnosis.ts, limiares versionados ──
  async function runRulesDiagnostic() {
    if (!diagnostic.length) return;
    setDiagLoading(true);
    const result = diagnoseCourse(trails, questions);
    setDiagReport(result.text);
    try { if (canWrite) await saveTrailSnapshot(institutionId, courseId, result.text); }
    catch (e) { setNotice(e instanceof Error ? `Diagnóstico gerado, mas não foi salvo: ${e.message}` : 'Diagnóstico gerado, mas não foi salvo.'); }
    setDiagLoading(false);
  }

  // ── Promote to 5W2H (linked to ENADE goal + enters BI pipeline) ──
  async function promoteToAction(trailDiag: Diagnostic) {
    const badge = BADGE[trailDiag.status] || BADGE.estavel;

    // Find existing ENADE-related goal for this course
    let goalId: string | undefined;
    try {
      const { data: goals } = await supabase.from('vertice_goals').select('id, title')
        .eq('institution_id', institutionId).eq('course_id', courseId)
        .or('title.ilike.%enade%,title.ilike.%trilha%,title.ilike.%desempenho%,dimension.eq.ensino')
        .limit(1);
      if (goals?.length) goalId = goals[0].id;
    } catch { /* ok */ }

    storeActionDraft(institutionId, {
      what: `Ação corretiva — Trilha ${trailDiag.code}: ${trailDiag.name}`,
      why: `Discrepância ENADE de ${trailDiag.avg_discrepancy?.toFixed(1) || '?'}pp (${badge.label}). ${trailDiag.question_count} questões analisadas, média IES ${trailDiag.avg_ies_pct ?? '?'}% vs nacional ${trailDiag.avg_national_pct ?? '?'}%.`,
      how: `Revisar ementa, metodologia e avaliação da trilha "${trailDiag.name}". Comparar cobertura curricular com itens cobrados no ENADE (${trailDiag.question_count} questões mapeadas via Fato & Ordem). Planejar oficinas, materiais e simulados dirigidos.`,
      scope: 'course',
      course_id: courseId,
      goal_id: goalId || '',
      dimension: 'ensino',
      priority: trailDiag.status === 'critico' ? 'alta' : 'media',
      status: 'planned',
    });

    const link = document.querySelector<HTMLButtonElement>('[data-tab="plano"]');
    if (link) { link.click(); return; }
    setNotice(`Ação pré-preenchida para "${trailDiag.name}"${goalId ? ' vinculada à meta ENADE' : ''}. Vá para Plano de Ação 5W2H para concluir.`);
  }

  // ── Question manual CRUD ──
  const [newQ, setNewQ] = useState({ trail_id: '', enade_year: '', question_number: '', question_text: '', national_correct_pct: '', ies_correct_pct: '' });

  async function addQuestion() {
    if (!newQ.trail_id) return;
    if (await run(() => addTrailQuestion(institutionId, courseId, newQ)))
      setNewQ({ trail_id: '', enade_year: '', question_number: '', question_text: '', national_correct_pct: '', ies_correct_pct: '' });
  }

  async function deleteQuestion(id: string) {
    await run(() => deleteTrailQuestion(institutionId, courseId, id));
  }

  const tabs_list: { key: typeof tab; icon: string; label: string }[] = [
    { key: 'trails', icon: '🧬', label: 'Trilhas' },
    { key: 'questions', icon: '📝', label: 'Questões' },
    { key: 'diagnostic', icon: '📊', label: 'Diagnóstico' },
    { key: 'actions', icon: '⚡', label: 'Ações → 5W2H' },
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

    <label className="planning-field"><span>Curso</span>
      <select value={courseId} onChange={e => setCourseId(e.target.value)}>
        <option value="">Selecione um curso</option>
        {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ''}{c.name}</option>)}
      </select>
    </label>

    {!courseId ? <p style={{ color: '#64748b', marginTop: 16 }}>Selecione o curso para começar.</p> : loading ? <p role="status">Carregando…</p> : <>
      <nav style={{ display: 'flex', gap: 8, margin: '20px 0', flexWrap: 'wrap' }}>
        {tabs_list.map(t => <button key={t.key} type="button" className={tab === t.key ? 'planning-primary' : ''} onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{t.icon}</span> {t.label}
          {t.key === 'diagnostic' && diagnostic.filter(d => d.status === 'critico').length > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{diagnostic.filter(d => d.status === 'critico').length}</span>}
        </button>)}
      </nav>

      {/* ═══ Tab 1: Trilhas ═══ */}
      {tab === 'trails' && <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
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
                    <label className="planning-field"><span>Código</span><input value={t.code} onChange={e => editTrail(t.id, { code: e.target.value })} onBlur={() => void persistTrail(t.id)} /></label>
                    <label className="planning-field"><span>Nome da Trilha</span><input value={t.name} onChange={e => editTrail(t.id, { name: e.target.value })} onBlur={() => void persistTrail(t.id)} /></label>
                  </div>
                  <label className="planning-field"><span>Descrição</span><textarea rows={2} value={t.description || ''} onChange={e => editTrail(t.id, { description: e.target.value })} onBlur={() => void persistTrail(t.id)} /></label>
                  <label className="planning-field"><span>Palavras-chave (separadas por vírgula — usadas para vincular questões ENADE)</span>
                    <input value={(t.keywords || []).join(', ')} onChange={e => editTrail(t.id, { keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })} onBlur={() => void persistTrail(t.id)} placeholder="direito civil, obrigações, contratos" />
                  </label>
                  {t.curriculum_competency_id && <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>🔗 Vinculada à competência da Construção Curricular</p>}
                </fieldset>
                {canWrite && <button style={{ marginTop: 12, color: '#dc2626', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => deleteTrail(t.id)}>🗑 Remover trilha</button>}
              </div>
            </details>)}
          </div>
        }
      </div>}

      {/* ═══ Tab 2: Questões (auto-sync Fato & Ordem) ═══ */}
      {tab === 'questions' && <div>
        {/* Summary bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>📝 {questions.length} questão(ões) vinculada(s) manualmente</span>
            <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}>📡 {foMatched.length} questão(ões) do Fato & Ordem (automático)</span>
            {foSyncing && <span style={{ fontSize: 12, color: '#6366f1' }}>🔄 Sincronizando…</span>}
          </div>
        </div>

        {/* F&O auto-matched by trail */}
        {foMatched.length > 0 && <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 14, color: '#1e40af', marginBottom: 12 }}>📡 Questões do Fato & Ordem (vinculação automática por palavras-chave)</h4>
          {trails.filter(t => (foByTrail[t.id] || []).length > 0).map(t => <details key={t.id} open style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: '8px 0' }}>
              {t.code} — {t.name} <span style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}>({(foByTrail[t.id] || []).length} questões)</span>
            </summary>
            <div className="planning-scroll" style={{ marginLeft: 16 }}>
              <table style={{ fontSize: 13 }}>
                <thead><tr><th>Ano</th><th>Nº</th><th>Disciplina</th><th>Tema</th><th>Dificuldade</th><th>Competência</th><th>Enunciado</th></tr></thead>
                <tbody>
                  {(foByTrail[t.id] || []).map(q => <tr key={q.id}>
                    <td>{q.exam_year}</td>
                    <td>Q{q.question_number}</td>
                    <td style={{ fontWeight: 600 }}>{q.discipline}</td>
                    <td>{q.theme}<br /><span style={{ fontSize: 11, color: '#64748b' }}>{q.subtheme}</span></td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: q.difficulty === 'Fácil' ? '#dcfce7' : q.difficulty === 'Difícil' ? '#fef2f2' : '#fef9c3', color: q.difficulty === 'Fácil' ? '#166534' : q.difficulty === 'Difícil' ? '#991b1b' : '#854d0e' }}>{q.difficulty}</span></td>
                    <td style={{ fontSize: 12 }}>{q.competency}</td>
                    <td style={{ fontSize: 12, color: '#475569', maxWidth: 220 }}>{q.statement_preview}…</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </details>)}
          {foUnmatched.length > 0 && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>+ {foUnmatched.length} questão(ões) encontrada(s) sem correspondência de trilha (ajuste as palavras-chave).</p>}
        </div>}

        {!foMatched.length && !foSyncing && trails.length > 0 && <div className="card" style={{ padding: 20, textAlign: 'center', background: '#faf5ff', borderLeft: '4px solid #6366f1', marginBottom: 20 }}>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>📡 Nenhuma questão do Fato & Ordem encontrada</p>
          <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>Adicione palavras-chave nas trilhas (aba Trilhas) para vincular automaticamente. Ex: "direito civil", "obrigações", "contratos".</p>
        </div>}

        {/* Manual question links */}
        <h4 style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>Questões vinculadas manualmente (com % de acerto)</h4>
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
              {canWrite && <tr style={{ background: '#f0f7ff' }}>
                <td><select value={newQ.trail_id} onChange={e => setNewQ({ ...newQ, trail_id: e.target.value })} style={{ minWidth: 80 }}>
                  <option value="">Trilha…</option>
                  {trails.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select></td>
                <td><input type="number" placeholder="Ano" value={newQ.enade_year} onChange={e => setNewQ({ ...newQ, enade_year: e.target.value })} style={{ width: 70 }} /></td>
                <td><input placeholder="Nº ou texto" value={newQ.question_number} onChange={e => setNewQ({ ...newQ, question_number: e.target.value })} style={{ width: 100 }} /></td>
                <td><input type="number" placeholder="%" value={newQ.national_correct_pct} onChange={e => setNewQ({ ...newQ, national_correct_pct: e.target.value })} style={{ width: 60 }} /></td>
                <td><input type="number" placeholder="%" value={newQ.ies_correct_pct} onChange={e => setNewQ({ ...newQ, ies_correct_pct: e.target.value })} style={{ width: 60 }} /></td>
                <td colSpan={2}><button onClick={addQuestion} disabled={!newQ.trail_id} className="planning-primary" style={{ padding: '6px 14px', fontSize: 13 }}>+ Adicionar</button></td>
              </tr>}
            </tbody>
          </table>
        </div>
      </div>}

      {/* ═══ Tab 3: Diagnóstico por regras ═══ */}
      {tab === 'diagnostic' && <div>
        {!diagnostic.length || !questions.length ? <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>📊 Sem dados para diagnóstico</p>
          <p style={{ color: '#64748b' }}>Cadastre trilhas e mapeie questões ENADE com as taxas de acerto da IES e nacional.</p>
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
              <button className="planning-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }} onClick={runRulesDiagnostic} disabled={diagLoading}>
                {diagLoading ? 'Calculando…' : '📊 Gerar diagnóstico'}
              </button>
            </div>
          </div>

          {/* Relatório do diagnóstico por regras */}
          {diagReport && <div className="card" style={{ marginBottom: 20, padding: 24, borderLeft: '5px solid #6366f1', background: '#faf5ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>📊</span>
              <strong style={{ fontSize: 15, color: '#4338ca' }}>Diagnóstico por regras</strong>
              <small style={{ color: '#64748b' }}>versão {TRAIL_DIAGNOSIS_RULES.version} · sem IA · mesma entrada, mesmo resultado</small>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: '#1e293b' }}>{diagReport}</div>
          </div>}

          {/* Trail ranking cards */}
          <div className="stack" style={{ gap: 14 }}>
            {diagnostic.sort((a, b) => (a.total_discrepancy ?? 0) - (b.total_discrepancy ?? 0)).map(d => {
              const badge = BADGE[d.status] || BADGE.estavel;
              return <div key={d.trail_id} className="card" style={{ borderLeft: `5px solid ${badge.color}`, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: badge.color, lineHeight: 1 }}>
                    {d.total_discrepancy != null ? `${d.total_discrepancy > 0 ? '+' : ''}${d.total_discrepancy.toFixed(1)}` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>discrepância total</div>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 15 }}>{d.code} — {d.name}</strong>
                    <span style={{ background: badge.color, color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{badge.emoji} {badge.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>📝 {d.question_count} questões</span>
                    <span>🇧🇷 Brasil: {d.avg_national_pct ?? '—'}%</span>
                    <span>🏫 IES: {d.avg_ies_pct ?? '—'}%</span>
                    <span>Δ médio: <strong style={{ color: discColor(d.avg_discrepancy) }}>{d.avg_discrepancy != null ? `${d.avg_discrepancy > 0 ? '+' : ''}${d.avg_discrepancy.toFixed(1)}pp` : '—'}</strong></span>
                  </div>
                </div>
                {canWrite && (d.status === 'critico' || d.status === 'atencao') && <button onClick={() => promoteToAction(d)} style={{ fontSize: 12, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>⚡ Criar ação 5W2H</button>}
              </div>;
            })}
          </div>
        </>}
      </div>}

      {/* ═══ Tab 4: Ações → 5W2H ═══ */}
      {tab === 'actions' && <div>
        <div className="card" style={{ padding: 24, textAlign: 'center', background: '#f0f9ff', borderLeft: '5px solid #0ea5e9' }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>⚡ Plano de Ação integrado ao 5W2H</p>
          <p style={{ color: '#475569', margin: '0 0 16px', fontSize: 14 }}>As ações corretivas das Trilhas ENADE são criadas diretamente no <strong>Plano de Ação 5W2H</strong> do portal, garantindo rastreabilidade, prazos e responsáveis em um único lugar.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="planning-primary" style={{ padding: '12px 24px' }} onClick={() => {
              const link = document.querySelector<HTMLButtonElement>('[data-tab="plano"]');
              if (link) link.click();
              else setNotice('Acesse o módulo "Plano de Ação 5W2H" na seção Gestão e Acessos.');
            }}>📋 Ir para Plano de Ação 5W2H</button>
            <button className="btn-ghost" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => setTab('diagnostic')}>📊 Voltar ao Diagnóstico</button>
          </div>
        </div>

        {/* Show trails needing action */}
        {diagnostic.filter(d => d.status === 'critico' || d.status === 'atencao').length > 0 && <>
          <h4 style={{ marginTop: 24, fontSize: 14, color: '#475569' }}>Trilhas que precisam de ação:</h4>
          <div className="stack" style={{ gap: 10 }}>
            {diagnostic.filter(d => d.status === 'critico' || d.status === 'atencao').map(d => {
              const badge = BADGE[d.status];
              return <div key={d.trail_id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${badge.color}` }}>
                <div>
                  <strong>{badge.emoji} {d.code} — {d.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>Δ {d.avg_discrepancy?.toFixed(1)}pp · {d.question_count} questões</span>
                </div>
                {canWrite && <button className="planning-primary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => promoteToAction(d)}>⚡ Criar ação 5W2H</button>}
              </div>;
            })}
          </div>
        </>}
      </div>}
    </>}
  </section>;
}
