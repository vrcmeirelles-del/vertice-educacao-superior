// Avalia360AcademicEntry — Interface ÚNICA para professores
// Duas telas: lista de provas ↔ editar questões. Sem wizard, sem etapas, sem modo avançado.
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Assessment {
  id: string; course_id: string; title: string; discipline: string; semester: string;
  purpose: string; professor_name: string; instructions: string; status: string;
  total_points: number; question_count: number; created_at: string;
}
interface Question {
  id: string; assessment_id: string; question_number: number; question_type: string;
  statement: string; points: number; bloom_level: string | null; explanation: string | null;
}
interface Option { id: string; question_id: string; option_letter: string; option_text: string; is_correct: boolean; }

export default function Avalia360AcademicEntry({ institutionId, courses, institutionName }: {
  institutionId: string; courses: Array<{ id: string; name: string }>; institutionName?: string;
}) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newF, setNewF] = useState({ course_id: '', discipline: '', title: '', professor_name: '' });
  const [editQ, setEditQ] = useState<string | null>(null);
  const [qF, setQF] = useState<any>({});
  const [oF, setOF] = useState<{ letter: string; text: string; correct: boolean }[]>([]);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_avalia_assessments').select('*')
      .eq('institution_id', institutionId).order('updated_at', { ascending: false });
    setAssessments((data || []) as Assessment[]);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const loadQ = async (aid: string) => {
    const { data: qs } = await supabase.from('vertice_avalia_questions').select('*').eq('assessment_id', aid).order('question_number');
    const list = (qs || []) as Question[];
    setQuestions(list);
    if (list.length) {
      const { data: o } = await supabase.from('vertice_avalia_options').select('*').in('question_id', list.map(q => q.id));
      const m: Record<string, Option[]> = {};
      (o || []).forEach((x: any) => { m[x.question_id] = [...(m[x.question_id] || []), x]; });
      Object.values(m).forEach(a => a.sort((a, b) => a.option_letter.localeCompare(b.option_letter)));
      setOptions(m);
    } else setOptions({});
  };

  const create = async () => {
    if (!newF.course_id || !newF.discipline || !newF.title) return;
    setSaving(true);
    const { data } = await supabase.from('vertice_avalia_assessments').insert({
      institution_id: institutionId, course_id: newF.course_id, title: newF.title,
      discipline: newF.discipline, semester: '2026/02', purpose: 'formativa',
      professor_name: newF.professor_name, status: 'rascunho',
    }).select().single();
    if (data) { setSelected(data as Assessment); await loadQ(data.id); }
    setCreating(false); setNewF({ course_id: '', discipline: '', title: '', professor_name: '' });
    await load(); setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('Excluir esta prova e todas as questões?')) return;
    await supabase.from('vertice_avalia_assessments').delete().eq('id', id);
    if (selected?.id === id) { setSelected(null); setQuestions([]); }
    await load();
  };

  const saveQ = async () => {
    if (!selected || !qF.statement?.trim()) return;
    setSaving(true);
    const p = { assessment_id: selected.id, question_number: qF.question_number || (questions.length + 1),
      question_type: qF.question_type || 'objetiva', statement: qF.statement, points: qF.points || 1 };
    let id = qF.id;
    if (id) { await supabase.from('vertice_avalia_questions').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id); }
    else { const { data } = await supabase.from('vertice_avalia_questions').insert(p).select().single(); id = data?.id; }
    if (id && qF.question_type !== 'discursiva') {
      await supabase.from('vertice_avalia_options').delete().eq('question_id', id);
      const v = oF.filter(o => o.text.trim());
      if (v.length) await supabase.from('vertice_avalia_options').insert(v.map(o => ({ question_id: id, option_letter: o.letter, option_text: o.text, is_correct: o.correct })));
    }
    const { count } = await supabase.from('vertice_avalia_questions').select('id', { count: 'exact', head: true }).eq('assessment_id', selected.id);
    const { data: pts } = await supabase.from('vertice_avalia_questions').select('points').eq('assessment_id', selected.id);
    await supabase.from('vertice_avalia_assessments').update({ question_count: count || 0, total_points: (pts || []).reduce((s: number, x: any) => s + (x.points || 0), 0), updated_at: new Date().toISOString() }).eq('id', selected.id);
    await loadQ(selected.id); await load(); setEditQ(null); setSaving(false);
  };

  const delQ = async (id: string) => {
    if (!confirm('Excluir questão?')) return;
    await supabase.from('vertice_avalia_questions').delete().eq('id', id);
    if (selected) { await loadQ(selected.id); await load(); }
  };

  const newQuestion = () => {
    const n = questions.length ? Math.max(...questions.map(q => q.question_number)) + 1 : 1;
    setQF({ question_number: n, question_type: 'objetiva', points: 1, statement: '' });
    setOF(['A', 'B', 'C', 'D', 'E'].map(l => ({ letter: l, text: '', correct: l === 'A' })));
    setEditQ('new');
  };

  const editQuestion = (q: Question) => {
    setQF(q);
    const qo = options[q.id] || [];
    setOF(qo.length ? qo.map(o => ({ letter: o.option_letter, text: o.option_text, correct: o.is_correct }))
      : ['A', 'B', 'C', 'D', 'E'].map(l => ({ letter: l, text: '', correct: l === 'A' })));
    setEditQ(q.id);
  };

  // ===== IMPORT FROM SPREADSHEET (CSV/TSV/XLSX) =====
  const importFromFile = async (file: File) => {
    if (!selected) return;
    setImporting(true);
    try {
      let rows: any[][] = [];

      if (/\.xlsx?$/i.test(file.name)) {
        // XLSX: use read-excel-file (already in project dependencies)
        const { readSheetNames, default: readXlsxFile } = await import('read-excel-file');
        const names = await readSheetNames(file);
        const sheetName = names.find(n => /quest/i.test(n)) || names[names.length > 1 ? names.length - 1 : 0];
        const sheetIdx = names.indexOf(sheetName) + 1;
        const data = await readXlsxFile(file, { sheet: sheetIdx });
        rows = data.map(r => r.map(c => c == null ? '' : String(c)));
      } else {
        const text = await file.text();
        const sep = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
        rows = text.split('\n').map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
      }

      // Find header row
      const headerIdx = rows.findIndex(r => r.some(c => /enunciado|questão|pergunta|statement|^tipo$/i.test(String(c || ''))));
      const header = headerIdx >= 0 ? rows[headerIdx].map(h => String(h || '').toLowerCase()) : [];
      const dataRows = rows.slice((headerIdx >= 0 ? headerIdx : 0) + 1);

      // Map columns flexibly
      const find = (pats: RegExp[]) => header.findIndex(h => pats.some(p => p.test(h)));
      const colType = find([/^tipo$/i]);
      const colEnum = find([/enunciado|questão|pergunta|statement/i]);
      const colPts = find([/pont|valor|score/i]);
      const colA = find([/alternativa.*a|^a$/i]);
      const colB = find([/alternativa.*b|^b$/i]);
      const colC = find([/alternativa.*c|^c$/i]);
      const colD = find([/alternativa.*d|^d$/i]);
      const colE = find([/alternativa.*e|^e$/i]);
      const colGab = find([/gabarito|resposta|correct/i]);

      let startNum = questions.length ? Math.max(...questions.map(q => q.question_number)) + 1 : 1;
      let imported = 0;

      for (const row of dataRows) {
        const statement = String(row[colEnum >= 0 ? colEnum : 1] || '').trim();
        if (!statement || statement.length < 5) continue;

        const typeRaw = colType >= 0 ? String(row[colType] || '').toLowerCase() : '';
        const altA = colA >= 0 ? String(row[colA] || '').trim() : '';
        const isDiscursiva = /discursiva/i.test(typeRaw) || (!altA && colA >= 0) || (colA < 0);
        const pts = colPts >= 0 && row[colPts] ? parseFloat(String(row[colPts])) || 1 : 1;
        const gab = colGab >= 0 ? String(row[colGab] || 'A').trim().toUpperCase() : 'A';

        const { data: q } = await supabase.from('vertice_avalia_questions').insert({
          assessment_id: selected.id, question_number: startNum,
          question_type: isDiscursiva ? 'discursiva' : 'objetiva', statement, points: pts,
        }).select().single();

        if (q && !isDiscursiva) {
          const letters = ['A', 'B', 'C', 'D', 'E'];
          const cols = [colA, colB, colC, colD, colE];
          const optRows = letters.map((letter, i) => {
            const txt = cols[i] >= 0 ? String(row[cols[i]] || '').trim() : '';
            return txt ? { question_id: q.id, option_letter: letter, option_text: txt, is_correct: letter === gab } : null;
          }).filter(Boolean);
          if (optRows.length) await supabase.from('vertice_avalia_options').insert(optRows);
        }
        startNum++; imported++;
      }

      // Update counts
      const { count } = await supabase.from('vertice_avalia_questions').select('id', { count: 'exact', head: true }).eq('assessment_id', selected.id);
      const { data: pts2 } = await supabase.from('vertice_avalia_questions').select('points').eq('assessment_id', selected.id);
      await supabase.from('vertice_avalia_assessments').update({ question_count: count || 0, total_points: (pts2 || []).reduce((s: number, x: any) => s + (x.points || 0), 0), updated_at: new Date().toISOString() }).eq('id', selected.id);
      await loadQ(selected.id); await load();
      alert(`✅ ${imported} questão(ões) importada(s)!`);
    } catch (err) { alert('Erro na importação: ' + (err as Error).message); }
    setImporting(false);
  };

  const printPDF = () => {
    if (!selected) return;
    const c = courses.find(x => x.id === selected.course_id)?.name || '';
    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }
    let h = '';
    questions.forEach(q => {
      h += `<div class="q"><p class="qn"><b>Questão ${q.question_number}</b> (${q.points}pt)</p><p>${q.statement.replace(/\n/g, '<br/>')}</p>`;
      if (q.question_type !== 'discursiva') (options[q.id] || []).forEach(o => { h += `<p class="o">(${o.option_letter}) ${o.option_text}</p>`; });
      else h += '<div class="ln">' + Array(8).fill('<div class="l"></div>').join('') + '</div>';
      h += '</div>';
    });
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selected.title}</title>
<style>@media print{@page{margin:18mm}}body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;margin:30px;color:#1e293b}
.hd{text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:10px;margin-bottom:14px}
h1{font-size:14pt;margin:0}h2{font-size:11pt;color:#475569;margin:2px 0}
.m{font-size:9pt;color:#64748b}.al{margin:14px 0;padding:8px;border:1px solid #94a3b8;border-radius:4px;font-size:10pt}
.al span{display:inline-block;width:48%;border-bottom:1px solid #333;padding-bottom:2px}
.q{margin-bottom:14px;page-break-inside:avoid}.qn{margin:0 0 4px}.o{margin:2px 0 2px 16px}
.ln{margin-top:6px}.l{border-bottom:1px solid #d1d5db;height:22px}
.ft{text-align:center;font-size:8pt;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:6px}
</style></head><body>
<div class="hd"><div class="m">${institutionName || 'Centro Universitário ITOP – UNITOP'}</div>
<h1>${selected.title}</h1><h2>${c} · ${selected.discipline} · ${selected.semester}</h2>
${selected.professor_name ? `<div class="m">Prof. ${selected.professor_name}</div>` : ''}
<div class="m">${questions.length} questões · ${selected.total_points} pontos</div></div>
<div class="al"><span>Nome: _________________________________</span> <span>Matrícula: ______________</span></div>
${selected.instructions ? `<p style="font-size:9pt;color:#475569;font-style:italic;margin-bottom:12px">${selected.instructions}</p>` : ''}
${h}<p class="ft">Vértice Educação Superior</p></body></html>`);
    w.document.close(); setTimeout(() => w.print(), 500);
  };

  const printGab = () => {
    if (!selected) return;
    const w = window.open('', '_blank'); if (!w) return;
    const rows = questions.filter(q => q.question_type !== 'discursiva').map(q => {
      const c = (options[q.id] || []).find(o => o.is_correct);
      return `<tr><td><b>${q.question_number}</b></td><td style="font-size:14pt;font-weight:700;color:#16a34a">${c?.option_letter || '—'}</td><td style="font-size:9pt;color:#64748b">${q.statement.slice(0, 80)}…</td></tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gabarito</title>
<style>@media print{@page{margin:18mm}}body{font-family:Calibri,sans-serif;margin:30px}
h1{font-size:14pt;text-align:center}table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #cbd5e1;padding:6px 10px}th{background:#f1f5f9;text-align:left}</style></head><body>
<h1>🔑 Gabarito — ${selected.title}</h1>
<p style="text-align:center;font-size:10pt;color:#64748b">${selected.discipline} · ${selected.semester}</p>
<table><thead><tr><th style="width:40px">Nº</th><th style="width:60px">Resp.</th><th>Enunciado</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 500);
  };

  // STYLES
  const badge = (bg: string) => ({ fontSize: '.7rem', padding: '3px 8px', borderRadius: 99, color: '#fff', background: bg, fontWeight: 600 as const });
  const statusC: Record<string, string> = { rascunho: '#94a3b8', pronta: '#2563eb', aplicada: '#16a34a', encerrada: '#7c3aed' };
  const statusL: Record<string, string> = { rascunho: '📝 Rascunho', pronta: '✅ Pronta', aplicada: '📋 Aplicada', encerrada: '🔒 Encerrada' };
  const inp: React.CSSProperties = { padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: '.9rem', width: '100%', boxSizing: 'border-box' };
  const btn = (bg: string, c: string): React.CSSProperties => ({ padding: '10px 18px', borderRadius: 10, border: 'none', background: bg, color: c, fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' });
  const btnSm = (bg: string, c: string): React.CSSProperties => ({ padding: '5px 10px', borderRadius: 6, border: `1px solid ${c}`, background: bg, color: c, fontWeight: 600, fontSize: '.75rem', cursor: 'pointer' });

  // ============ DETAIL ============
  if (selected) return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => { setSelected(null); setEditQ(null); }} style={{ fontSize: '.85rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>← Voltar</button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={printPDF} disabled={!questions.length} style={{ ...btn('#7c3aed', '#fff'), opacity: questions.length ? 1 : 0.4 }}>🖨️ Imprimir</button>
          <button onClick={printGab} disabled={!questions.filter(q => q.question_type !== 'discursiva').length}
            style={{ ...btn('#059669', '#fff'), opacity: questions.filter(q => q.question_type !== 'discursiva').length ? 1 : 0.4 }}>🔑 Gabarito</button>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 14, padding: 18, marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#1e3a5f' }}>{selected.title}</h3>
        <div style={{ fontSize: '.8rem', color: '#475569' }}>
          {courses.find(c => c.id === selected.course_id)?.name} · {selected.discipline} · {selected.semester}
          {selected.professor_name && ` · Prof. ${selected.professor_name}`}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
          <span style={badge(statusC[selected.status] || '#94a3b8')}>{statusL[selected.status] || selected.status}</span>
          <span style={{ fontSize: '.8rem', color: '#64748b' }}>{questions.length} questões · {questions.reduce((s, q) => s + (q.points || 0), 0)} pts</span>
        </div>
      </div>

      {questions.map(q => (
        <div key={q.id} style={{ border: editQ === q.id ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: editQ === q.id ? '#f0f9ff' : '#fff', marginBottom: 10 }}>
          {editQ === q.id ? renderQForm() : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a5f' }}>Q{q.question_number}</span>
                  <span style={badge(q.question_type === 'discursiva' ? '#d97706' : '#2563eb')}>{q.question_type === 'discursiva' ? '✍ Discursiva' : '◉ Objetiva'}</span>
                  <span style={{ fontSize: '.75rem', color: '#64748b' }}>{q.points}pt</span>
                </div>
                <p style={{ fontSize: '.85rem', margin: '0 0 6px', color: '#334155', lineHeight: 1.5 }}>
                  {q.statement.length > 200 ? q.statement.slice(0, 200) + '…' : q.statement}
                </p>
                {q.question_type !== 'discursiva' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(options[q.id] || []).map(o => (
                      <span key={o.id} style={{ fontSize: '.75rem', padding: '2px 8px', borderRadius: 6, background: o.is_correct ? '#dcfce7' : '#f1f5f9', color: o.is_correct ? '#16a34a' : '#64748b', fontWeight: o.is_correct ? 700 : 400 }}>
                        {o.option_letter}{o.is_correct ? ' ✓' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => editQuestion(q)} style={btnSm('#eff6ff', '#2563eb')}>✏️</button>
                <button onClick={() => delQ(q.id)} style={btnSm('#fef2f2', '#dc2626')}>🗑️</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editQ === 'new' && <div style={{ border: '2px solid #2563eb', borderRadius: 12, padding: 16, background: '#f0f9ff', marginBottom: 10 }}>{renderQForm()}</div>}
      {!editQ && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
          <button onClick={newQuestion} style={{ padding: 16, borderRadius: 12, border: '2px dashed #2563eb', background: '#f0f9ff', color: '#2563eb', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>
            ➕ Digitar questão
          </button>
          <label style={{ padding: 16, borderRadius: 12, border: '2px dashed #059669', background: '#f0fdf4', color: '#059669', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            📥 Importar planilha
            <input type="file" accept=".csv,.tsv,.txt,.xlsx" style={{ display: 'none' }} disabled={importing}
              onChange={e => { const f = e.target.files?.[0]; if (f) importFromFile(f); e.target.value = ''; }} />
          </label>
        </div>
      )}
      {!editQ && (
        <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: '.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
          💡 <b>Formato da planilha:</b> colunas <code>Enunciado | A | B | C | D | E | Gabarito</code> (CSV, TSV ou TXT separado por ; ou tab). Questões discursivas: só a coluna Enunciado preenchida.
        </div>
      )}
    </div>
  );

  // ============ LIST ============
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', borderRadius: 16, padding: '20px 24px', color: '#fff', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: '.75rem', letterSpacing: '.08em', color: '#93c5fd', fontWeight: 600 }}>VÉRTICE · AVALIA 360°</div>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 800 }}>📝 Minhas Provas</h2>
          </div>
          <button onClick={() => setCreating(true)} style={{ ...btn('#fff', '#1e3a5f'), fontSize: '1rem' }}>+ Nova prova</button>
        </div>
        {assessments.length > 0 && (
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            {[{ l: 'Provas', v: assessments.length }, { l: 'Questões', v: assessments.reduce((s, a) => s + (a.question_count || 0), 0) }].map(k => (
              <div key={k.l}><strong style={{ fontSize: '1.3rem' }}>{k.v}</strong><span style={{ display: 'block', fontSize: '.7rem', color: '#93c5fd' }}>{k.l}</span></div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <div style={{ border: '2px solid #2563eb', borderRadius: 14, padding: 20, background: '#f0f9ff', marginBottom: 14 }}>
          <h4 style={{ margin: '0 0 14px', color: '#1e40af' }}>📋 Criar prova</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={newF.course_id} onChange={e => setNewF(f => ({ ...f, course_id: e.target.value }))} style={inp}>
              <option value="">Curso *</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={newF.discipline} onChange={e => setNewF(f => ({ ...f, discipline: e.target.value }))} placeholder="Disciplina *" style={inp} />
            <input value={newF.title} onChange={e => setNewF(f => ({ ...f, title: e.target.value }))} placeholder="Título da prova *" style={{ ...inp, gridColumn: '1 / -1' }} />
            <input value={newF.professor_name} onChange={e => setNewF(f => ({ ...f, professor_name: e.target.value }))} placeholder="Nome do professor" style={{ ...inp, gridColumn: '1 / -1' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={() => setCreating(false)} style={btn('#e2e8f0', '#475569')}>Cancelar</button>
            <button disabled={saving || !newF.course_id || !newF.discipline || !newF.title} onClick={create}
              style={{ ...btn('#2563eb', '#fff'), opacity: (!newF.course_id || !newF.discipline || !newF.title) ? 0.4 : 1 }}>
              {saving ? 'Criando…' : 'Criar prova →'}
            </button>
          </div>
        </div>
      )}

      {loading ? <p style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Carregando…</p> :
        assessments.length === 0 && !creating ? (
          <div style={{ textAlign: 'center', padding: 48, background: '#f8fafc', borderRadius: 16 }}>
            <p style={{ fontSize: '3rem', margin: '0 0 12px' }}>📝</p>
            <p style={{ fontSize: '1.1rem', color: '#475569', fontWeight: 600 }}>Nenhuma prova criada ainda</p>
            <p style={{ fontSize: '.85rem', color: '#94a3b8' }}>Clique em <b>"+ Nova prova"</b> para começar</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assessments.map(a => (
              <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#fff', cursor: 'pointer', transition: 'box-shadow .15s' }}
                onClick={async () => { setSelected(a); setEditQ(null); await loadQ(a.id); }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <strong style={{ fontSize: '.95rem', color: '#1e3a5f' }}>{a.title}</strong>
                      <span style={badge(statusC[a.status] || '#94a3b8')}>{statusL[a.status] || a.status}</span>
                    </div>
                    <div style={{ fontSize: '.8rem', color: '#64748b' }}>{courses.find(c => c.id === a.course_id)?.name} · {a.discipline}</div>
                    <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>{a.question_count || 0} questões · {a.total_points || 0} pts{a.professor_name ? ` · ${a.professor_name}` : ''}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); del(a.id); }} style={btnSm('#fef2f2', '#dc2626')}>🗑️ Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );

  // ===== Q FORM =====
  function renderQForm() {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a5f' }}>Q{qF.question_number}</span>
          <select value={qF.question_type || 'objetiva'} onChange={e => setQF({ ...qF, question_type: e.target.value })}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '.85rem' }}>
            <option value="objetiva">◉ Objetiva</option>
            <option value="discursiva">✍ Discursiva</option>
          </select>
          <input type="number" min={0.5} step={0.5} value={qF.points || ''} onChange={e => setQF({ ...qF, points: +e.target.value })}
            placeholder="Pts" style={{ width: 70, padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db' }} />
        </div>
        <textarea value={qF.statement || ''} onChange={e => setQF({ ...qF, statement: e.target.value })} rows={4}
          placeholder="Cole ou digite o enunciado da questão aqui…"
          style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
        {qF.question_type !== 'discursiva' && (
          <div>
            <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: 6, color: '#475569' }}>Alternativas · 🔘 = gabarito correto</div>
            {oF.map((o, i) => (
              <div key={o.letter} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <input type="radio" name={`gab-${editQ}`} checked={o.correct}
                  onChange={() => setOF(oF.map((x, j) => ({ ...x, correct: j === i })))}
                  style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
                <span style={{ fontWeight: 700, width: 24, color: o.correct ? '#16a34a' : '#475569' }}>({o.letter})</span>
                <input value={o.text} onChange={e => setOF(oF.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                  placeholder={`Alternativa ${o.letter}`}
                  style={{ ...inp, flex: 1, background: o.correct ? '#f0fdf4' : '#fff', borderColor: o.correct ? '#86efac' : '#d1d5db' }} />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditQ(null)} style={btn('#f1f5f9', '#475569')}>Cancelar</button>
          <button disabled={saving || !qF.statement?.trim()} onClick={saveQ}
            style={{ ...btn('#2563eb', '#fff'), opacity: !qF.statement?.trim() ? 0.4 : 1 }}>
            {saving ? 'Salvando…' : '💾 Salvar'}
          </button>
        </div>
      </div>
    );
  }
}
