// Avalia360AcademicEntry — Modo Professor (simplificado)
// 3 telas: Minhas Provas → Montar Questões → Imprimir
// O Studio completo continua acessível via "Modo avançado"
import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const Avalia360Studio = lazy(() => import("@/lib/avalia360/Avalia360Studio"));

interface Assessment {
  id: string; course_id: string; title: string; discipline: string; semester: string;
  purpose: string; professor_name: string; instructions: string; status: string;
  total_points: number; question_count: number; created_at: string; updated_at: string;
}
interface Question {
  id: string; assessment_id: string; question_number: number; question_type: string;
  statement: string; points: number; bloom_level: string | null; explanation: string | null;
}
interface Option { id: string; question_id: string; option_letter: string; option_text: string; is_correct: boolean; }

type Screen = 'list' | 'edit' | 'print' | 'studio';

export default function Avalia360AcademicEntry({ institutionId, courses, institutionName }: {
  institutionId: string; courses: Array<{ id: string; name: string }>; institutionName?: string;
}) {
  const [screen, setScreen] = useState<Screen>('list');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [current, setCurrent] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New assessment form
  const [newForm, setNewForm] = useState({ course_id: '', discipline: '', title: '', professor_name: '', instructions: '' });
  const [showNew, setShowNew] = useState(false);

  // Question form
  const [qEdit, setQEdit] = useState<string | null>(null);
  const [qForm, setQForm] = useState<any>({});
  const [optForms, setOptForms] = useState<{ letter: string; text: string; correct: boolean }[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_avalia_assessments').select('*')
      .eq('institution_id', institutionId).order('updated_at', { ascending: false });
    setAssessments((data || []) as Assessment[]);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadQuestions = async (aid: string) => {
    const { data: qs } = await supabase.from('vertice_avalia_questions').select('*').eq('assessment_id', aid).order('question_number');
    const qList = (qs || []) as Question[];
    setQuestions(qList);
    if (qList.length > 0) {
      const { data: opts } = await supabase.from('vertice_avalia_options').select('*').in('question_id', qList.map(q => q.id));
      const m: Record<string, Option[]> = {};
      (opts || []).forEach((o: any) => { m[o.question_id] = [...(m[o.question_id] || []), o]; });
      Object.values(m).forEach(arr => arr.sort((a, b) => a.option_letter.localeCompare(b.option_letter)));
      setOptions(m);
    } else { setOptions({}); }
  };

  // ===== CREATE =====
  const createAssessment = async () => {
    if (!newForm.course_id || !newForm.discipline || !newForm.title) return;
    setSaving(true);
    const { data } = await supabase.from('vertice_avalia_assessments').insert({
      institution_id: institutionId, course_id: newForm.course_id, title: newForm.title,
      discipline: newForm.discipline, semester: '2026/02', purpose: 'formativa',
      professor_name: newForm.professor_name, instructions: newForm.instructions, status: 'rascunho',
    }).select().single();
    if (data) { setCurrent(data as Assessment); await loadQuestions(data.id); setScreen('edit'); }
    setShowNew(false); setNewForm({ course_id: '', discipline: '', title: '', professor_name: '', instructions: '' });
    await fetchAll(); setSaving(false);
  };

  // ===== DELETE ASSESSMENT =====
  const deleteAssessment = async (id: string) => {
    if (!confirm('Excluir esta avaliação e todas as questões? Não pode ser desfeito.')) return;
    await supabase.from('vertice_avalia_assessments').delete().eq('id', id);
    await fetchAll();
    if (current?.id === id) { setCurrent(null); setScreen('list'); }
  };

  // ===== SAVE QUESTION =====
  const saveQuestion = async () => {
    if (!current || !qForm.statement?.trim()) return;
    setSaving(true);
    const payload = {
      assessment_id: current.id, question_number: qForm.question_number || (questions.length + 1),
      question_type: qForm.question_type || 'objetiva', statement: qForm.statement,
      points: qForm.points || 1, bloom_level: qForm.bloom_level || null, explanation: qForm.explanation || null,
    };
    let qId = qForm.id;
    if (qId) {
      await supabase.from('vertice_avalia_questions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', qId);
    } else {
      const { data } = await supabase.from('vertice_avalia_questions').insert(payload).select().single();
      qId = data?.id;
    }
    if (qId && (qForm.question_type === 'objetiva' || !qForm.question_type)) {
      await supabase.from('vertice_avalia_options').delete().eq('question_id', qId);
      const validOpts = optForms.filter(o => o.text.trim());
      if (validOpts.length) {
        await supabase.from('vertice_avalia_options').insert(validOpts.map(o => ({
          question_id: qId, option_letter: o.letter, option_text: o.text, is_correct: o.correct,
        })));
      }
    }
    // Update counts
    const { count } = await supabase.from('vertice_avalia_questions').select('id', { count: 'exact', head: true }).eq('assessment_id', current.id);
    const { data: pts } = await supabase.from('vertice_avalia_questions').select('points').eq('assessment_id', current.id);
    const totalPts = (pts || []).reduce((s: number, p: any) => s + (p.points || 0), 0);
    await supabase.from('vertice_avalia_assessments').update({ question_count: count || 0, total_points: totalPts, updated_at: new Date().toISOString() }).eq('id', current.id);
    await loadQuestions(current.id); await fetchAll();
    setQEdit(null); setSaving(false);
  };

  const deleteQuestion = async (qId: string) => {
    if (!confirm('Excluir esta questão?')) return;
    await supabase.from('vertice_avalia_questions').delete().eq('id', qId);
    if (current) { await loadQuestions(current.id); await fetchAll(); }
  };

  const startNewQuestion = () => {
    const n = questions.length > 0 ? Math.max(...questions.map(q => q.question_number)) + 1 : 1;
    setQForm({ question_number: n, question_type: 'objetiva', points: 1, statement: '' });
    setOptForms(['A', 'B', 'C', 'D', 'E'].map(l => ({ letter: l, text: '', correct: l === 'A' })));
    setQEdit('new');
  };

  const startEditQuestion = (q: Question) => {
    setQForm(q);
    const qOpts = options[q.id] || [];
    setOptForms(qOpts.length > 0
      ? qOpts.map(o => ({ letter: o.option_letter, text: o.option_text, correct: o.is_correct }))
      : ['A', 'B', 'C', 'D', 'E'].map(l => ({ letter: l, text: '', correct: l === 'A' })));
    setQEdit(q.id);
  };

  // ===== PRINT PDF =====
  const printPDF = () => {
    if (!current) return;
    const courseName = courses.find(c => c.id === current.course_id)?.name || '';
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para imprimir'); return; }
    let html = '';
    questions.forEach(q => {
      html += `<div class="q"><p class="qn"><strong>Questão ${q.question_number}</strong> (${q.points} pt${q.points > 1 ? 's' : ''})</p>`;
      html += `<p>${q.statement.replace(/\n/g, '<br/>')}</p>`;
      if (q.question_type === 'objetiva') {
        (options[q.id] || []).forEach(o => { html += `<p class="opt">(${o.option_letter}) ${o.option_text}</p>`; });
      } else {
        html += '<div class="lines">' + Array(8).fill('<div class="line"></div>').join('') + '</div>';
      }
      html += '</div>';
    });
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${current.title}</title>
<style>@media print{@page{margin:18mm;size:A4}}body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;margin:30px;color:#1e293b}
h1{font-size:14pt;text-align:center;margin:0 0 2px}h2{font-size:11pt;text-align:center;color:#475569;margin:0 0 12px}
.header{text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px}
.meta{font-size:9pt;color:#64748b;text-align:center;margin:4px 0}
.q{margin-bottom:14px;page-break-inside:avoid}.qn{margin:0 0 4px}.opt{margin:2px 0 2px 16px}
.lines{margin-top:8px}.line{border-bottom:1px solid #d1d5db;height:22px}
.aluno{margin:16px 0;padding:8px;border:1px solid #94a3b8;border-radius:4px;font-size:10pt}
.aluno span{display:inline-block;width:48%;border-bottom:1px solid #333;padding-bottom:2px}
.footer{text-align:center;font-size:8pt;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:6px}
</style></head><body>
<div class="header">
  <div style="font-size:9pt;color:#64748b">${institutionName || 'Centro Universitário ITOP – UNITOP'}</div>
  <h1>${current.title}</h1>
  <h2>${courseName} · ${current.discipline} · ${current.semester}</h2>
  ${current.professor_name ? `<div class="meta">Prof. ${current.professor_name}</div>` : ''}
  <div class="meta">${questions.length} questões · ${current.total_points} pontos</div>
</div>
<div class="aluno"><span>Nome: _________________________________</span> <span>Matrícula: ______________</span></div>
${current.instructions ? `<p style="font-size:9pt;color:#475569;font-style:italic;margin-bottom:12px">${current.instructions}</p>` : ''}
${html}
<p class="footer">Avaliação gerada pela Plataforma Vértice Educação Superior</p>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // ===== PRINT GABARITO =====
  const printGabarito = () => {
    if (!current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const objs = questions.filter(q => q.question_type === 'objetiva');
    let rows = objs.map(q => {
      const correct = (options[q.id] || []).find(o => o.is_correct);
      return `<tr><td style="font-weight:700">${q.question_number}</td><td>${correct?.option_letter || '—'}</td><td style="font-size:9pt;color:#64748b">${q.statement.slice(0, 60)}${q.statement.length > 60 ? '…' : ''}</td></tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gabarito — ${current.title}</title>
<style>@media print{@page{margin:18mm}}body{font-family:Calibri,sans-serif;font-size:11pt;margin:30px}
h1{font-size:14pt;text-align:center}table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #cbd5e1;padding:6px 10px}th{background:#f1f5f9;text-align:left}
</style></head><body>
<h1>Gabarito — ${current.title}</h1>
<p style="text-align:center;font-size:10pt;color:#64748b">${current.discipline} · ${current.semester}</p>
<table><thead><tr><th>Nº</th><th>Gabarito</th><th>Enunciado</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // ===== STUDIO MODE =====
  if (screen === 'studio') return (
    <div>
      <button onClick={() => setScreen('list')} style={{ marginBottom: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '.8rem' }}>← Voltar ao modo simplificado</button>
      <Suspense fallback={<p role="status">Carregando modo avançado…</p>}>
        <Avalia360Studio institutionId={institutionId} courses={courses} institutionName={institutionName} institutionalPersistence />
      </Suspense>
    </div>
  );

  const css = { card: { border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', marginBottom: 8 } as const,
    btn: { padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 700 as const, fontSize: '.85rem', cursor: 'pointer' },
    input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '.9rem', width: '100%' } as const };

  // ===== LIST SCREEN =====
  if (screen === 'list') return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📝 Minhas Avaliações</h3>
          <p style={{ margin: '2px 0 0', fontSize: '.8rem', color: '#64748b' }}>{assessments.length} avaliação(ões) · Clique para editar</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowNew(true)} style={{ ...css.btn, background: '#2563eb', color: '#fff' }}>+ Nova prova</button>
          <button onClick={() => setScreen('studio')} style={{ ...css.btn, background: '#f8fafc', color: '#64748b', border: '1px solid #d1d5db' }}>⚙ Modo avançado</button>
        </div>
      </div>

      {/* Quick create */}
      {showNew && (
        <div style={{ ...css.card, border: '2px solid #2563eb', background: '#f0f9ff', marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '.95rem', color: '#1e40af' }}>Nova avaliação</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={newForm.course_id} onChange={e => setNewForm(f => ({ ...f, course_id: e.target.value }))} style={css.input}>
              <option value="">Curso *</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={newForm.discipline} onChange={e => setNewForm(f => ({ ...f, discipline: e.target.value }))} placeholder="Disciplina *" style={css.input} />
            <input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} placeholder="Título da prova *" style={{ ...css.input, gridColumn: '1 / -1' }} />
            <input value={newForm.professor_name} onChange={e => setNewForm(f => ({ ...f, professor_name: e.target.value }))} placeholder="Professor (opcional)" style={css.input} />
            <input value={newForm.instructions} onChange={e => setNewForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Instruções (opcional)" style={css.input} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => setShowNew(false)} style={{ ...css.btn, background: '#fff', color: '#64748b', border: '1px solid #d1d5db' }}>Cancelar</button>
            <button disabled={saving || !newForm.course_id || !newForm.discipline || !newForm.title} onClick={createAssessment}
              style={{ ...css.btn, background: '#2563eb', color: '#fff', opacity: (!newForm.course_id || !newForm.discipline || !newForm.title) ? 0.5 : 1 }}>
              {saving ? 'Criando…' : 'Criar e montar questões →'}
            </button>
          </div>
        </div>
      )}

      {loading ? <p style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Carregando…</p> :
        assessments.length === 0 && !showNew ? (
          <div style={{ textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12 }}>
            <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>📝</p>
            <p style={{ color: '#64748b' }}>Nenhuma avaliação criada. Clique em <strong>+ Nova prova</strong> para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assessments.map(a => {
              const course = courses.find(c => c.id === a.course_id);
              return (
                <div key={a.id} style={{ ...css.card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
                  onClick={async () => { setCurrent(a); await loadQuestions(a.id); setScreen('edit'); }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <strong style={{ fontSize: '.9rem' }}>{a.title || 'Sem título'}</strong>
                    <div style={{ fontSize: '.75rem', color: '#64748b' }}>{course?.name} · {a.discipline} · {a.semester}</div>
                    <div style={{ fontSize: '.7rem', color: '#94a3b8' }}>{a.question_count || 0} questões · {a.total_points || 0} pts{a.professor_name ? ` · ${a.professor_name}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 99, color: '#fff', background: a.status === 'rascunho' ? '#6b7280' : a.status === 'aplicada' ? '#16a34a' : '#2563eb' }}>
                      {a.status === 'rascunho' ? 'Rascunho' : a.status === 'pronta' ? 'Pronta' : a.status === 'aplicada' ? 'Aplicada' : a.status}
                    </span>
                    <button onClick={() => deleteAssessment(a.id)} title="Excluir avaliação"
                      style={{ fontSize: '.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );

  // ===== EDIT SCREEN =====
  if (screen === 'edit' && current) return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <button onClick={() => setScreen('list')} style={{ fontSize: '.8rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← Minhas Avaliações</button>
          <h3 style={{ margin: '4px 0 0', fontSize: '1rem' }}>{current.title}</h3>
          <p style={{ margin: 0, fontSize: '.75rem', color: '#64748b' }}>{current.discipline} · {current.semester} · {questions.length} questões · {questions.reduce((s, q) => s + (q.points || 0), 0)} pts</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={printPDF} disabled={questions.length === 0}
            style={{ ...css.btn, background: '#7c3aed', color: '#fff', opacity: questions.length === 0 ? 0.4 : 1 }}>🖨 Imprimir prova</button>
          <button onClick={printGabarito} disabled={questions.filter(q => q.question_type === 'objetiva').length === 0}
            style={{ ...css.btn, background: '#059669', color: '#fff', opacity: questions.filter(q => q.question_type === 'objetiva').length === 0 ? 0.4 : 1 }}>📋 Gabarito</button>
        </div>
      </div>

      {/* Questions list */}
      {questions.map(q => (
        <div key={q.id} style={{ ...css.card, background: qEdit === q.id ? '#f0f9ff' : '#fff' }}>
          {qEdit === q.id ? renderQForm() : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ fontSize: '.85rem' }}>Q{q.question_number}</strong>
                  <span style={{ fontSize: '.7rem', padding: '1px 6px', borderRadius: 4, background: q.question_type === 'objetiva' ? '#dbeafe' : '#fef3c7', color: q.question_type === 'objetiva' ? '#1e40af' : '#92400e' }}>
                    {q.question_type === 'objetiva' ? 'Objetiva' : 'Discursiva'}
                  </span>
                  <span style={{ fontSize: '.7rem', color: '#64748b' }}>{q.points}pt</span>
                </div>
                <p style={{ fontSize: '.85rem', margin: '0 0 4px', color: '#334155' }}>{q.statement.length > 150 ? q.statement.slice(0, 150) + '…' : q.statement}</p>
                {q.question_type === 'objetiva' && (
                  <div style={{ fontSize: '.75rem', color: '#64748b' }}>
                    Gabarito: <strong style={{ color: '#16a34a' }}>{(options[q.id] || []).find(o => o.is_correct)?.option_letter || '—'}</strong>
                    {' · '}{(options[q.id] || []).length} alternativas
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => startEditQuestion(q)} style={{ fontSize: '.7rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', cursor: 'pointer' }}>✏️ Editar</button>
                <button onClick={() => deleteQuestion(q.id)} style={{ fontSize: '.7rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* New question form */}
      {qEdit === 'new' && <div style={{ ...css.card, border: '2px solid #2563eb', background: '#f0f9ff' }}>{renderQForm()}</div>}

      {!qEdit && (
        <button onClick={startNewQuestion} style={{ width: '100%', padding: 14, borderRadius: 8, border: '2px dashed #2563eb', background: '#f0f9ff', color: '#2563eb', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', marginTop: 4 }}>
          + Adicionar questão
        </button>
      )}
    </div>
  );

  // ===== FALLBACK =====
  return <p>Carregando…</p>;

  // ===== QUESTION FORM RENDERER =====
  function renderQForm() {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', gap: 8 }}>
          <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Nº
            <input type="number" min={1} value={qForm.question_number || ''} onChange={e => setQForm({ ...qForm, question_number: +e.target.value })} style={css.input} />
          </label>
          <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Tipo
            <select value={qForm.question_type || 'objetiva'} onChange={e => setQForm({ ...qForm, question_type: e.target.value })} style={css.input}>
              <option value="objetiva">Objetiva</option>
              <option value="discursiva">Discursiva</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Pontos
            <input type="number" min={0.5} step={0.5} value={qForm.points || ''} onChange={e => setQForm({ ...qForm, points: +e.target.value })} style={css.input} />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Enunciado *
          <textarea value={qForm.statement || ''} onChange={e => setQForm({ ...qForm, statement: e.target.value })} rows={4}
            placeholder="Cole ou digite o enunciado da questão…" style={{ ...css.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
        </label>

        {(qForm.question_type === 'objetiva' || !qForm.question_type) && (
          <div>
            <span style={{ fontSize: '.8rem', fontWeight: 600 }}>Alternativas (🔘 = gabarito)</span>
            {optForms.map((o, i) => (
              <div key={o.letter} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <input type="radio" name={`correct-${qEdit}`} checked={o.correct} onChange={() => setOptForms(optForms.map((x, j) => ({ ...x, correct: j === i })))} />
                <span style={{ fontWeight: 700, width: 20 }}>({o.letter})</span>
                <input value={o.text} onChange={e => setOptForms(optForms.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                  placeholder={`Alternativa ${o.letter}`} style={{ ...css.input, flex: 1 }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={() => setQEdit(null)} style={{ ...css.btn, background: '#fff', color: '#64748b', border: '1px solid #d1d5db' }}>Cancelar</button>
          <button disabled={saving || !qForm.statement?.trim()} onClick={saveQuestion}
            style={{ ...css.btn, background: '#2563eb', color: '#fff', opacity: !qForm.statement?.trim() ? 0.5 : 1 }}>
            {saving ? 'Salvando…' : '💾 Salvar'}
          </button>
        </div>
      </div>
    );
  }
}
