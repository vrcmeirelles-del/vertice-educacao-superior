// Avalia360.tsx — Estúdio de Avaliações 360° (multi-IES, Supabase)
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Props { institutionId: string; courses: { id: string; name: string }[]; role: string; }

interface Assessment {
  id: string; course_id: string; title: string; discipline: string; semester: string;
  purpose: string; professor_name: string; instructions: string; status: string;
  total_points: number; question_count: number; created_at: string; updated_at: string;
}
interface Question {
  id: string; assessment_id: string; question_number: number; question_type: string;
  statement: string; points: number; bloom_level: string | null; competency_tag: string | null;
  explanation: string | null; image_url: string | null;
}
interface Option { id: string; question_id: string; option_letter: string; option_text: string; is_correct: boolean; }
interface Rubric { id: string; question_id: string; criterion: string; max_points: number; description: string | null; }

type Step = 'list' | 'prepare' | 'questions' | 'review';

const PURPOSE_L: Record<string, string> = { diagnostica: 'Diagnóstica', formativa: 'Formativa', somativa: 'Somativa' };
const STATUS_L: Record<string, { l: string; c: string }> = {
  rascunho: { l: 'Rascunho', c: '#6b7280' }, pronta: { l: 'Pronta', c: '#2563eb' },
  aplicada: { l: 'Aplicada', c: '#16a34a' }, encerrada: { l: 'Encerrada', c: '#7c3aed' }, arquivada: { l: 'Arquivada', c: '#94a3b8' },
};
const BLOOM: Record<string, string> = { conhecimento: 'Conhecimento', compreensao: 'Compreensão', aplicacao: 'Aplicação', analise: 'Análise', sintese: 'Síntese', avaliacao: 'Avaliação' };

export default function Avalia360({ institutionId, courses, role }: Props) {
  const [step, setStep] = useState<Step>('list');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [current, setCurrent] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [rubrics, setRubrics] = useState<Record<string, Rubric[]>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const canEdit = role === 'master' || role === 'gestor' || role === 'equipe';

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_avalia_assessments').select('*')
      .eq('institution_id', institutionId).order('updated_at', { ascending: false });
    setAssessments((data || []) as Assessment[]);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  const loadQuestions = async (assessmentId: string) => {
    const [{ data: qs }, { data: opts }, { data: rubs }] = await Promise.all([
      supabase.from('vertice_avalia_questions').select('*').eq('assessment_id', assessmentId).order('question_number'),
      supabase.from('vertice_avalia_options').select('*').in('question_id',
        (await supabase.from('vertice_avalia_questions').select('id').eq('assessment_id', assessmentId)).data?.map((q: any) => q.id) || []),
      supabase.from('vertice_avalia_rubrics').select('*').in('question_id',
        (await supabase.from('vertice_avalia_questions').select('id').eq('assessment_id', assessmentId)).data?.map((q: any) => q.id) || []),
    ]);
    setQuestions((qs || []) as Question[]);
    const optMap: Record<string, Option[]> = {};
    (opts || []).forEach((o: any) => { optMap[o.question_id] = [...(optMap[o.question_id] || []), o]; });
    Object.values(optMap).forEach(arr => arr.sort((a, b) => a.option_letter.localeCompare(b.option_letter)));
    setOptions(optMap);
    const rubMap: Record<string, Rubric[]> = {};
    (rubs || []).forEach((r: any) => { rubMap[r.question_id] = [...(rubMap[r.question_id] || []), r]; });
    setRubrics(rubMap);
  };

  // === SAVE ASSESSMENT ===
  const saveAssessment = async () => {
    setSaving(true);
    const payload = {
      institution_id: institutionId, course_id: form.course_id, title: form.title || '',
      discipline: form.discipline || '', semester: form.semester || '2026/02',
      purpose: form.purpose || 'formativa', professor_name: form.professor_name || '',
      instructions: form.instructions || '', status: form.status || 'rascunho',
    };
    if (current?.id) {
      await supabase.from('vertice_avalia_assessments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', current.id);
    } else {
      const { data } = await supabase.from('vertice_avalia_assessments').insert(payload).select().single();
      if (data) setCurrent(data as Assessment);
    }
    await fetchAssessments();
    setSaving(false);
  };

  // === SAVE QUESTION ===
  const saveQuestion = async (q: any, opts: { letter: string; text: string; correct: boolean }[], rubs: { criterion: string; max_points: number }[]) => {
    setSaving(true);
    const assessId = current!.id;
    let questionId = q.id;
    const payload = {
      assessment_id: assessId, question_number: q.question_number, question_type: q.question_type || 'objetiva',
      statement: q.statement || '', points: q.points || 1, bloom_level: q.bloom_level || null,
      competency_tag: q.competency_tag || null, explanation: q.explanation || null,
    };
    if (questionId) {
      await supabase.from('vertice_avalia_questions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', questionId);
    } else {
      const { data } = await supabase.from('vertice_avalia_questions').insert(payload).select().single();
      questionId = data?.id;
    }
    if (!questionId) { setSaving(false); return; }
    // Options (objetiva)
    if (q.question_type === 'objetiva' || !q.question_type) {
      await supabase.from('vertice_avalia_options').delete().eq('question_id', questionId);
      const optPayload = opts.filter(o => o.text.trim()).map(o => ({
        question_id: questionId, option_letter: o.letter, option_text: o.text, is_correct: o.correct,
      }));
      if (optPayload.length > 0) await supabase.from('vertice_avalia_options').insert(optPayload);
    }
    // Rubrics (discursiva)
    if (q.question_type === 'discursiva') {
      await supabase.from('vertice_avalia_rubrics').delete().eq('question_id', questionId);
      const rubPayload = rubs.filter(r => r.criterion.trim()).map(r => ({
        question_id: questionId, criterion: r.criterion, max_points: r.max_points,
      }));
      if (rubPayload.length > 0) await supabase.from('vertice_avalia_rubrics').insert(rubPayload);
    }
    // Update counts
    const { count } = await supabase.from('vertice_avalia_questions').select('id', { count: 'exact', head: true }).eq('assessment_id', assessId);
    const { data: pts } = await supabase.from('vertice_avalia_questions').select('points').eq('assessment_id', assessId);
    const totalPts = (pts || []).reduce((s: number, p: any) => s + (p.points || 0), 0);
    await supabase.from('vertice_avalia_assessments').update({ question_count: count || 0, total_points: totalPts, updated_at: new Date().toISOString() }).eq('id', assessId);
    await loadQuestions(assessId);
    await fetchAssessments();
    setSaving(false);
  };

  const deleteQuestion = async (qId: string) => {
    await supabase.from('vertice_avalia_questions').delete().eq('id', qId);
    await loadQuestions(current!.id);
    await fetchAssessments();
  };

  const updateStatus = async (assessId: string, status: string) => {
    await supabase.from('vertice_avalia_assessments').update({ status, updated_at: new Date().toISOString(), ...(status === 'aplicada' ? { applied_at: new Date().toISOString() } : {}) }).eq('id', assessId);
    await fetchAssessments();
    if (current?.id === assessId) setCurrent(prev => prev ? { ...prev, status } : prev);
  };

  // === GENERATE PDF ===
  const generatePDF = (assess: Assessment) => {
    const qs = questions;
    const courseName = courses.find(c => c.id === assess.course_id)?.name || '';
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups'); return; }
    let qHtml = '';
    qs.forEach((q, i) => {
      qHtml += `<div class="q"><p class="qn"><strong>Questão ${q.question_number}</strong> (${q.points} pt${q.points > 1 ? 's' : ''})</p><p>${q.statement}</p>`;
      if (q.question_type === 'objetiva') {
        const qOpts = options[q.id] || [];
        qOpts.forEach(o => { qHtml += `<p class="opt">(${o.option_letter}) ${o.option_text}</p>`; });
      } else {
        qHtml += `<div class="lines">${Array(8).fill('<div class="line"></div>').join('')}</div>`;
      }
      qHtml += '</div>';
    });
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${assess.title}</title>
<style>@media print{@page{margin:18mm;size:A4}}body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;margin:30px}
h1{font-size:14pt;text-align:center;margin:0}h2{font-size:11pt;text-align:center;color:#475569;margin:4px 0 16px}
.meta{text-align:center;font-size:9pt;color:#64748b;margin-bottom:12px}
.inst{font-size:9pt;text-align:center;border-bottom:1px solid #ccc;padding-bottom:12px;margin-bottom:16px}
.q{margin-bottom:16px;page-break-inside:avoid}.qn{margin:0 0 4px;font-size:11pt}.opt{margin:2px 0 2px 16px}
.lines{margin-top:8px}.line{border-bottom:1px solid #d1d5db;height:24px}
.footer{text-align:center;font-size:8pt;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:6px}
</style></head><body>
<div class="inst">${courseName} · ${assess.semester} · ${PURPOSE_L[assess.purpose] || assess.purpose}</div>
<h1>${assess.title}</h1>
<h2>${assess.professor_name || ''}</h2>
${assess.instructions ? `<p class="meta">${assess.instructions}</p>` : ''}
<p class="meta">${assess.question_count} questões · ${assess.total_points} pontos</p>
<hr style="border:none;border-top:2px solid #1e3a5f;margin:12px 0 20px"/>
${qHtml}
<p class="footer">Avaliação gerada pela Plataforma Vértice Educação Superior</p>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // ============ RENDER ============
  const s = (k: string, v: string) => ({ fontSize: k, color: v });

  // LIST VIEW
  if (step === 'list') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📝 Avalia 360° — Estúdio de Avaliações</h3>
        {canEdit && (
          <button onClick={() => { setCurrent(null); setForm({ semester: '2026/02', purpose: 'formativa', status: 'rascunho' }); setStep('prepare'); }}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
            + Nova avaliação
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Total', v: assessments.length, c: '#2563eb' },
          { l: 'Rascunhos', v: assessments.filter(a => a.status === 'rascunho').length, c: '#6b7280' },
          { l: 'Prontas', v: assessments.filter(a => a.status === 'pronta').length, c: '#2563eb' },
          { l: 'Aplicadas', v: assessments.filter(a => a.status === 'aplicada').length, c: '#16a34a' },
        ].map(k => (
          <div key={k.l} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `3px solid ${k.c}`, borderRadius: 8, padding: '10px 14px' }}>
            <strong style={{ fontSize: '1.4rem', color: k.c }}>{k.v}</strong>
            <span style={{ display: 'block', fontSize: '.75rem', color: '#64748b' }}>{k.l}</span>
          </div>
        ))}
      </div>

      {loading ? <p style={{ color: '#64748b', textAlign: 'center' }}>Carregando avaliações…</p> : assessments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', background: '#f8fafc', borderRadius: 12 }}>
          <p style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>📝</p>
          <p>Nenhuma avaliação criada ainda. Clique em "+ Nova avaliação" para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {assessments.map(a => {
            const course = courses.find(c => c.id === a.course_id);
            const st = STATUS_L[a.status] || STATUS_L.rascunho;
            return (
              <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', cursor: 'pointer' }}
                onClick={async () => { setCurrent(a); setForm(a); await loadQuestions(a.id); setStep('questions'); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <strong style={{ fontSize: '.9rem' }}>{a.title || 'Sem título'}</strong>
                    <div style={{ fontSize: '.75rem', color: '#64748b' }}>
                      {course?.name || '—'} · {a.discipline} · {a.semester} · {PURPOSE_L[a.purpose]}
                    </div>
                    <div style={{ fontSize: '.7rem', color: '#94a3b8' }}>
                      {a.question_count} questões · {a.total_points} pts · {a.professor_name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 99, color: '#fff', background: st.c }}>{st.l}</span>
                    {canEdit && a.status === 'rascunho' && (
                      <button onClick={e => { e.stopPropagation(); updateStatus(a.id, 'pronta'); }}
                        style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}>✅ Marcar pronta</button>
                    )}
                    {canEdit && a.status === 'pronta' && (
                      <button onClick={e => { e.stopPropagation(); updateStatus(a.id, 'aplicada'); }}
                        style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}>📋 Aplicar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // PREPARE VIEW
  if (step === 'prepare') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>📋 Preparar avaliação</h3>
        <button onClick={() => setStep('list')} style={{ fontSize: '.8rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>← Voltar</button>
      </div>
      <div style={{ display: 'grid', gap: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '.85rem', fontWeight: 600 }}>Curso *
          <select value={form.course_id || ''} onChange={e => setForm({ ...form, course_id: e.target.value })}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: '.9rem' }}>
            <option value="">Selecione o curso</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '.85rem', fontWeight: 600 }}>Disciplina *
          <input value={form.discipline || ''} onChange={e => setForm({ ...form, discipline: e.target.value })} placeholder="Ex.: Direito Civil" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '.85rem', fontWeight: 600 }}>Semestre
            <input value={form.semester || ''} onChange={e => setForm({ ...form, semester: e.target.value })} placeholder="2026/02" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '.85rem', fontWeight: 600 }}>Finalidade
            <select value={form.purpose || 'formativa'} onChange={e => setForm({ ...form, purpose: e.target.value })}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
              {Object.entries(PURPOSE_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'grid', gap: 4, fontSize: '.85rem', fontWeight: 600 }}>Título da avaliação *
          <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Avaliação de Direito Civil — AV1" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '.85rem', fontWeight: 600 }}>Nome do professor
          <input value={form.professor_name || ''} onChange={e => setForm({ ...form, professor_name: e.target.value })} placeholder="Nome que aparece na prova" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '.85rem', fontWeight: 600 }}>Instruções da avaliação
          <textarea value={form.instructions || ''} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={3}
            placeholder="Ex.: Preencha o cartão de respostas com caneta azul ou preta." style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setStep('list')} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
          <button disabled={saving || !form.course_id || !form.title || !form.discipline} onClick={async () => { await saveAssessment(); setStep('questions'); await loadQuestions(current?.id || ''); }}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!form.course_id || !form.title || !form.discipline) ? 0.5 : 1 }}>
            {saving ? 'Salvando…' : 'Começar a elaborar questões →'}
          </button>
        </div>
      </div>
    </div>
  );

  // QUESTIONS VIEW
  if (step === 'questions') return <QuestionEditor
    assessment={current!} questions={questions} options={options} rubrics={rubrics}
    canEdit={canEdit} saving={saving}
    onSave={saveQuestion} onDelete={deleteQuestion}
    onBack={() => setStep('list')} onReview={async () => { await loadQuestions(current!.id); setStep('review'); }}
    onPrepare={() => setStep('prepare')}
  />;

  // REVIEW VIEW
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>✅ Revisar e finalizar</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep('questions')} style={{ fontSize: '.8rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>← Questões</button>
          <button onClick={() => setStep('list')} style={{ fontSize: '.8rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>← Lista</button>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: '1rem' }}>{current?.title}</strong>
          <div style={{ fontSize: '.8rem', color: '#64748b' }}>{current?.discipline} · {current?.semester} · {PURPOSE_L[current?.purpose || '']}</div>
          <div style={{ fontSize: '.8rem', color: '#475569', marginTop: 4 }}>{current?.professor_name}</div>
          {current?.instructions && <div style={{ fontSize: '.8rem', color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>{current.instructions}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#f0f9ff', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <strong style={{ fontSize: '1.5rem', color: '#2563eb' }}>{questions.length}</strong>
            <span style={{ display: 'block', fontSize: '.75rem', color: '#64748b' }}>Questões</span>
          </div>
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <strong style={{ fontSize: '1.5rem', color: '#16a34a' }}>{questions.reduce((s, q) => s + (q.points || 0), 0)}</strong>
            <span style={{ display: 'block', fontSize: '.75rem', color: '#64748b' }}>Pontos</span>
          </div>
          <div style={{ background: '#faf5ff', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <strong style={{ fontSize: '1.5rem', color: '#7c3aed' }}>{questions.filter(q => q.question_type === 'objetiva').length}/{questions.filter(q => q.question_type === 'discursiva').length}</strong>
            <span style={{ display: 'block', fontSize: '.75rem', color: '#64748b' }}>Obj. / Disc.</span>
          </div>
        </div>

        {/* Bloom coverage */}
        <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
          <strong style={{ fontSize: '.8rem' }}>Cobertura Taxonômica (Bloom)</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {Object.entries(BLOOM).map(([k, v]) => {
              const count = questions.filter(q => q.bloom_level === k).length;
              return <span key={k} style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, background: count > 0 ? '#dcfce7' : '#f1f5f9', color: count > 0 ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{v}: {count}</span>;
            })}
          </div>
        </div>

        {/* Question preview */}
        {questions.map((q, i) => (
          <div key={q.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}>
              <strong>Q{q.question_number} · {q.question_type === 'objetiva' ? 'Objetiva' : 'Discursiva'} · {q.points}pt</strong>
              {q.bloom_level && <span style={{ fontSize: '.7rem', color: '#7c3aed' }}>{BLOOM[q.bloom_level]}</span>}
            </div>
            <p style={{ fontSize: '.85rem', margin: '6px 0' }}>{q.statement}</p>
            {q.question_type === 'objetiva' && (options[q.id] || []).map(o => (
              <div key={o.id} style={{ fontSize: '.8rem', marginLeft: 12, color: o.is_correct ? '#16a34a' : '#475569' }}>
                ({o.option_letter}) {o.option_text} {o.is_correct && '✓'}
              </div>
            ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          {canEdit && current?.status === 'rascunho' && (
            <button onClick={() => updateStatus(current.id, 'pronta')}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>✅ Marcar como pronta</button>
          )}
          <button onClick={() => { loadQuestions(current!.id); generatePDF(current!); }}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', fontWeight: 700, cursor: 'pointer' }}>📄 Gerar PDF da prova</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// QuestionEditor sub-component
// ============================================================
function QuestionEditor({ assessment, questions, options, rubrics, canEdit, saving, onSave, onDelete, onBack, onReview, onPrepare }: {
  assessment: Assessment; questions: Question[]; options: Record<string, Option[]>; rubrics: Record<string, Rubric[]>;
  canEdit: boolean; saving: boolean;
  onSave: (q: any, opts: any[], rubs: any[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void; onReview: () => void; onPrepare: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [qForm, setQForm] = useState<any>({});
  const [optForms, setOptForms] = useState<{ letter: string; text: string; correct: boolean }[]>([]);
  const [rubForms, setRubForms] = useState<{ criterion: string; max_points: number }[]>([]);

  const startNew = () => {
    const nextNum = questions.length > 0 ? Math.max(...questions.map(q => q.question_number)) + 1 : 1;
    setQForm({ question_number: nextNum, question_type: 'objetiva', points: 1 });
    setOptForms(['A', 'B', 'C', 'D', 'E'].map(l => ({ letter: l, text: '', correct: l === 'A' })));
    setRubForms([{ criterion: '', max_points: 1 }]);
    setEditing('new');
  };

  const startEdit = (q: Question) => {
    setQForm(q);
    setOptForms((options[q.id] || []).length > 0
      ? (options[q.id] || []).map(o => ({ letter: o.option_letter, text: o.option_text, correct: o.is_correct }))
      : ['A', 'B', 'C', 'D', 'E'].map(l => ({ letter: l, text: '', correct: l === 'A' })));
    setRubForms((rubrics[q.id] || []).length > 0
      ? (rubrics[q.id] || []).map(r => ({ criterion: r.criterion, max_points: r.max_points }))
      : [{ criterion: '', max_points: 1 }]);
    setEditing(q.id);
  };

  const handleSave = async () => {
    await onSave(qForm, optForms, rubForms);
    setEditing(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>✏️ Elaborar questões — {assessment.title}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onPrepare} style={{ fontSize: '.75rem', color: '#64748b', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>⚙ Configurar</button>
          <button onClick={onBack} style={{ fontSize: '.75rem', color: '#64748b', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>← Lista</button>
        </div>
      </div>
      <div style={{ fontSize: '.8rem', color: '#64748b', marginBottom: 12 }}>{questions.length} questões · {questions.reduce((s, q) => s + (q.points || 0), 0)} pontos</div>

      {/* Existing questions */}
      {questions.map(q => (
        <div key={q.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 8, background: editing === q.id ? '#eff6ff' : '#fff' }}>
          {editing === q.id ? renderForm() : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong style={{ fontSize: '.85rem' }}>Q{q.question_number} · {q.question_type === 'objetiva' ? 'Objetiva' : 'Discursiva'} · {q.points}pt</strong>
                {q.bloom_level && <span style={{ marginLeft: 8, fontSize: '.7rem', color: '#7c3aed', background: '#f5f3ff', padding: '1px 6px', borderRadius: 4 }}>{BLOOM[q.bloom_level] || q.bloom_level}</span>}
                <p style={{ fontSize: '.85rem', margin: '4px 0 0', color: '#334155' }}>{q.statement.length > 120 ? q.statement.slice(0, 120) + '…' : q.statement}</p>
                {q.question_type === 'objetiva' && <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>{(options[q.id] || []).length} alternativas · Gabarito: {(options[q.id] || []).find(o => o.is_correct)?.option_letter || '—'}</div>}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => startEdit(q)} style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => { if (confirm('Excluir questão?')) onDelete(q.id); }} style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>🗑</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* New question form */}
      {editing === 'new' && (
        <div style={{ border: '2px solid #2563eb', borderRadius: 10, padding: 14, marginBottom: 8, background: '#eff6ff' }}>
          {renderForm()}
        </div>
      )}

      {canEdit && !editing && (
        <button onClick={startNew} style={{ width: '100%', padding: 12, borderRadius: 8, border: '2px dashed #2563eb', background: '#f0f9ff', color: '#2563eb', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer', marginBottom: 12 }}>
          + Adicionar questão
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onReview} disabled={questions.length === 0}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: questions.length > 0 ? '#2563eb' : '#94a3b8', color: '#fff', fontWeight: 700, cursor: questions.length > 0 ? 'pointer' : 'default' }}>
          Revisar e finalizar →
        </button>
      </div>
    </div>
  );

  function renderForm() {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Nº
            <input type="number" min={1} value={qForm.question_number || ''} onChange={e => setQForm({ ...qForm, question_number: +e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '.85rem' }} />
          </label>
          <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Tipo
            <select value={qForm.question_type || 'objetiva'} onChange={e => setQForm({ ...qForm, question_type: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
              <option value="objetiva">Objetiva</option>
              <option value="discursiva">Discursiva</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Pontos
            <input type="number" min={0.5} step={0.5} value={qForm.points || ''} onChange={e => setQForm({ ...qForm, points: +e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          </label>
          <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Bloom
            <select value={qForm.bloom_level || ''} onChange={e => setQForm({ ...qForm, bloom_level: e.target.value || null })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
              <option value="">—</option>
              {Object.entries(BLOOM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Enunciado *
          <textarea value={qForm.statement || ''} onChange={e => setQForm({ ...qForm, statement: e.target.value })} rows={4}
            placeholder="Texto da questão…" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', fontSize: '.85rem' }} />
        </label>

        {(qForm.question_type === 'objetiva' || !qForm.question_type) && (
          <div>
            <strong style={{ fontSize: '.8rem' }}>Alternativas</strong>
            {optForms.map((o, i) => (
              <div key={o.letter} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <input type="radio" name="correct" checked={o.correct} onChange={() => setOptForms(optForms.map((x, j) => ({ ...x, correct: j === i })))} />
                <span style={{ fontWeight: 700, fontSize: '.85rem', width: 20 }}>({o.letter})</span>
                <input value={o.text} onChange={e => setOptForms(optForms.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                  placeholder={`Alternativa ${o.letter}`} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '.85rem' }} />
              </div>
            ))}
            <div style={{ fontSize: '.7rem', color: '#64748b', marginTop: 4 }}>🔘 = gabarito correto</div>
          </div>
        )}

        {qForm.question_type === 'discursiva' && (
          <div>
            <strong style={{ fontSize: '.8rem' }}>Critérios de correção</strong>
            {rubForms.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <input value={r.criterion} onChange={e => setRubForms(rubForms.map((x, j) => j === i ? { ...x, criterion: e.target.value } : x))}
                  placeholder="Critério" style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '.85rem' }} />
                <input type="number" min={0.5} step={0.5} value={r.max_points} onChange={e => setRubForms(rubForms.map((x, j) => j === i ? { ...x, max_points: +e.target.value } : x))}
                  style={{ width: 70, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '.85rem' }} />
                <button onClick={() => setRubForms(rubForms.filter((_, j) => j !== i))} style={{ fontSize: '.7rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <button onClick={() => setRubForms([...rubForms, { criterion: '', max_points: 1 }])}
              style={{ marginTop: 6, fontSize: '.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>+ Adicionar critério</button>
          </div>
        )}

        <label style={{ display: 'grid', gap: 2, fontSize: '.8rem', fontWeight: 600 }}>Explicação do gabarito (opcional)
          <textarea value={qForm.explanation || ''} onChange={e => setQForm({ ...qForm, explanation: e.target.value })} rows={2}
            placeholder="Por que esta é a resposta correta…" style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical', fontSize: '.85rem' }} />
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Cancelar</button>
          <button disabled={saving || !qForm.statement} onClick={handleSave}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '.85rem' }}>
            {saving ? 'Salvando…' : '💾 Salvar questão'}
          </button>
        </div>
      </div>
    );
  }
}
