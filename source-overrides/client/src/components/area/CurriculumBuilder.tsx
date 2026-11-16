import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isFullAccess, type Role } from '@/lib/area';
import './planning/planning.css';

type Course = { id: string; name: string; code?: string | null };
type Discipline = { id?: string; discipline_name: string; category: 'profissional' | 'instrumental' | 'basica'; sort_order: number };
type Competency = { id?: string; code: string; title: string; description: string; sort_order: number; disciplines: Discipline[] };
type Build = { id?: string; version: number; status: 'draft' | 'published' | 'archived'; graduate_profile: string; dcn_reference: string; competencies: Competency[] };

const EMPTY_BUILD: Build = {
  version: 1, status: 'draft', graduate_profile: '', dcn_reference: '',
  competencies: Array.from({ length: 6 }, (_, i) => ({
    code: `C${i + 1}`, title: '', description: '', sort_order: i, disciplines: [],
  })),
};

const CAT_LABELS: Record<string, string> = { profissional: 'Profissionais', instrumental: 'Instrumentais', basica: 'Básicas' };
const CAT_HELP: Record<string, string> = {
  profissional: 'Disciplinas diretamente ligadas à atuação profissional da área',
  instrumental: 'Disciplinas que desenvolvem habilidades técnicas de apoio',
  basica: 'Disciplinas de fundamentação científica, técnica e humanística',
};
const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' };

export default function CurriculumBuilder({ institutionId, courses, role }: { institutionId: string; courses: Course[]; role: Role | null }) {
  const [courseId, setCourseId] = useState('');
  const [unsaved, setUnsaved] = useState(false);
  const canWrite = isFullAccess(role) || role === 'coordenador' || role === 'nde';

  return (
    <section className="course-planning" aria-label="Construção Curricular">
      <header>
        <h2>🧬 Construção Curricular por Competências</h2>
        <p>Monte a matriz do curso articulando o perfil do egresso, as competências previstas pelas DCNs e os componentes curriculares que desenvolvem cada competência.</p>
      </header>
      <HelpBanner />
      <label className="planning-field">
        <span>Curso</span>
        <select value={courseId} onChange={e => { if (!unsaved || window.confirm('Há alterações não salvas. Trocar de curso?')) { setCourseId(e.target.value); setUnsaved(false); } }}>
          <option value="">Selecione um curso</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ''}{c.name}</option>)}
        </select>
      </label>
      {!courseId
        ? <p role="status" style={{ color: 'var(--ink-soft)', padding: '20px 0' }}>Selecione o curso para construir ou editar a matriz curricular.</p>
        : <BuildEditor key={`${institutionId}:${courseId}`} institutionId={institutionId} courseId={courseId} canWrite={canWrite} onDirty={setUnsaved} />}
    </section>
  );
}

function HelpBanner() {
  const [open, setOpen] = useState(false);
  return <>
    <div style={{ background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', margin: '12px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-soft)' }}>
      <span style={{ fontSize: 20 }}>💡</span>
      <span>Esta ferramenta substitui a planilha Excel de construção curricular. Defina o perfil do egresso, as competências centrais (C1 a C6 ou mais) e vincule as disciplinas em três categorias.</span>
      <button type="button" onClick={() => setOpen(true)} style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>?</button>
    </div>
    {open && <div className="planning-help-popup" role="dialog" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="planning-help-inner">
        <button className="planning-help-close" onClick={() => setOpen(false)}>✕</button>
        <h4>🧬 O que é a Construção Curricular por Competências?</h4>
        <p style={{ marginBottom: 14 }}>É a organização do currículo do curso a partir das competências que o aluno deve desenvolver ao longo da formação, conforme as Diretrizes Curriculares Nacionais (DCNs).</p>
        <p style={{ marginBottom: 14 }}><strong>Perfil do Egresso:</strong> Descreve quem é o profissional que o curso forma — onde pode atuar, o que sabe fazer, que valores carrega.</p>
        <p style={{ marginBottom: 14 }}><strong>Competências (C1 a C6):</strong> São as grandes áreas de capacidade que o aluno precisa desenvolver. Cada competência reúne conhecimentos, habilidades e atitudes.</p>
        <p style={{ marginBottom: 14 }}><strong>Disciplinas Profissionais:</strong> Diretamente ligadas à prática da profissão.</p>
        <p style={{ marginBottom: 14 }}><strong>Disciplinas Instrumentais:</strong> Habilidades técnicas de apoio.</p>
        <p><strong>Disciplinas Básicas:</strong> Fundamentação científica e humanística.</p>
      </div>
    </div>}
  </>;
}

function BuildEditor({ institutionId, courseId, canWrite, onDirty }: { institutionId: string; courseId: string; canWrite: boolean; onDirty: (v: boolean) => void }) {
  const [build, setBuild] = useState<Build>({ ...EMPTY_BUILD });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const update = useCallback((patch: Partial<Build>) => {
    setBuild(prev => ({ ...prev, ...patch }));
    onDirty(true);
    setNotice('');
  }, [onDirty]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: builds } = await supabase.from('curriculum_builds').select('*').eq('institution_id', institutionId).eq('course_id', courseId).order('version', { ascending: false }).limit(1);
        if (!active) return;
        if (builds && builds.length > 0) {
          const b = builds[0];
          const { data: comps } = await supabase.from('curriculum_competencies').select('*').eq('build_id', b.id).order('sort_order');
          const competencies: Competency[] = [];
          for (const c of (comps || [])) {
            const { data: links } = await supabase.from('curriculum_discipline_links').select('*').eq('competency_id', c.id).order('sort_order');
            competencies.push({ id: c.id, code: c.code, title: c.title, description: c.description || '', sort_order: c.sort_order, disciplines: (links || []).map((l: Record<string, unknown>) => ({ id: String(l.id), discipline_name: String(l.discipline_name), category: String(l.category) as Discipline['category'], sort_order: Number(l.sort_order) })) });
          }
          if (active) setBuild({ id: b.id, version: b.version, status: b.status, graduate_profile: b.graduate_profile || '', dcn_reference: b.dcn_reference || '', competencies: competencies.length > 0 ? competencies : EMPTY_BUILD.competencies });
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [institutionId, courseId]);

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      let buildId = build.id;
      if (!buildId) {
        const { data, error: err } = await supabase.from('curriculum_builds').insert({ institution_id: institutionId, course_id: courseId, graduate_profile: build.graduate_profile, dcn_reference: build.dcn_reference, created_by: (await supabase.auth.getUser()).data.user?.id }).select('id').single();
        if (err) throw new Error(err.message);
        buildId = data.id;
      } else {
        const { error: err } = await supabase.from('curriculum_builds').update({ graduate_profile: build.graduate_profile, dcn_reference: build.dcn_reference, updated_at: new Date().toISOString() }).eq('id', buildId);
        if (err) throw new Error(err.message);
      }
      await supabase.from('curriculum_competencies').delete().eq('build_id', buildId);
      for (const comp of build.competencies) {
        const { data: compData, error: compErr } = await supabase.from('curriculum_competencies').insert({ build_id: buildId, code: comp.code, title: comp.title || comp.code, description: comp.description, sort_order: comp.sort_order }).select('id').single();
        if (compErr) throw new Error(compErr.message);
        const discRows = comp.disciplines.filter(d => d.discipline_name.trim()).map((d, i) => ({ competency_id: compData.id, discipline_name: d.discipline_name.trim(), category: d.category, sort_order: i }));
        if (discRows.length > 0) { const { error: discErr } = await supabase.from('curriculum_discipline_links').insert(discRows); if (discErr) throw new Error(discErr.message); }
      }
      setBuild(prev => ({ ...prev, id: buildId }));
      onDirty(false);
      setNotice('Matriz curricular salva com sucesso.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  if (loading) return <p role="status">Carregando matriz curricular…</p>;

  return <>
    {error && <p role="alert" className="planning-error">{error}</p>}
    {notice && <p role="status" className="planning-success">{notice}</p>}
    <div className="planning-toolbar"><p>{STATUS_LABELS[build.status]} · versão {build.version}</p></div>
    <fieldset disabled={!canWrite || saving}>
      <legend className="planning-sr">Construção curricular</legend>
      <div className="card">
        <h3>📋 Perfil Profissional do Egresso</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px' }}>Descreva quem é o profissional que o curso forma: onde pode atuar, que habilidades possui e que valores carrega. Use como referência o artigo 3º das DCNs do curso.</p>
        <textarea rows={6} placeholder="O egresso do curso de [nome] é um profissional capacitado para..." value={build.graduate_profile} onChange={e => update({ graduate_profile: e.target.value })} />
      </div>
      <div className="card">
        <h3>📜 Referência Normativa (DCNs)</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px' }}>Indique a Resolução CNE/CES que estabelece as Diretrizes Curriculares Nacionais do curso.</p>
        <input placeholder="Ex: Resolução CNE/CES nº 5/2018 (Direito)" value={build.dcn_reference} onChange={e => update({ dcn_reference: e.target.value })} />
      </div>
      <h3 style={{ marginTop: 28 }}>🎯 Competências Centrais</h3>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px' }}>Cada competência representa uma grande área de capacidade profissional. Para cada uma, vincule as disciplinas que contribuem para seu desenvolvimento.</p>
      {build.competencies.map((comp, ci) => (
        <CompetencyCard key={ci} comp={comp} index={ci} onChange={updated => { const next = [...build.competencies]; next[ci] = updated; update({ competencies: next }); }} onRemove={() => update({ competencies: build.competencies.filter((_, i) => i !== ci) })} canWrite={canWrite} />
      ))}
      <button type="button" className="btn-ghost" onClick={() => update({ competencies: [...build.competencies, { code: `C${build.competencies.length + 1}`, title: '', description: '', sort_order: build.competencies.length, disciplines: [] }] })}>+ Adicionar Competência</button>
    </fieldset>
    {canWrite && <div className="planning-toolbar" style={{ marginTop: 24 }}><button type="button" className="planning-primary" disabled={saving} onClick={save}>{saving ? 'Salvando…' : '💾 Salvar Matriz Curricular'}</button></div>}
  </>;
}

function CompetencyCard({ comp, index, onChange, onRemove, canWrite }: { comp: Competency; index: number; onChange: (c: Competency) => void; onRemove: () => void; canWrite: boolean }) {
  const addDisc = (cat: Discipline['category']) => onChange({ ...comp, disciplines: [...comp.disciplines, { discipline_name: '', category: cat, sort_order: comp.disciplines.length }] });
  const rmDisc = (di: number) => onChange({ ...comp, disciplines: comp.disciplines.filter((_, i) => i !== di) });
  const updDisc = (di: number, name: string) => { const n = [...comp.disciplines]; n[di] = { ...n[di], discipline_name: name }; onChange({ ...comp, disciplines: n }); };
  const catDiscs = (cat: string) => comp.disciplines.map((d, i) => ({ ...d, _idx: i })).filter(d => d.category === cat);

  return (
    <details className="course-planning-entry" open>
      <summary>
        <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 700 }}>{comp.code}</span>
        <span>{comp.title || 'Nova competência'}</span>
        {canWrite && index > 0 && <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); if (window.confirm(`Remover ${comp.code}?`)) onRemove(); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>}
      </summary>
      <div style={{ padding: 20 }}>
        <div className="row">
          <label className="planning-field"><span>Código</span><input value={comp.code} onChange={e => onChange({ ...comp, code: e.target.value })} placeholder="C1" style={{ maxWidth: 100 }} /></label>
          <label className="planning-field" style={{ flex: 3 }}><span>Título da Competência</span><input value={comp.title} onChange={e => onChange({ ...comp, title: e.target.value })} placeholder="Ex: Interpretação e Aplicação do Direito" /></label>
        </div>
        <label className="planning-field"><span>Descrição</span><textarea rows={3} value={comp.description} onChange={e => onChange({ ...comp, description: e.target.value })} placeholder="Descreva o que o aluno deve ser capaz de fazer ao desenvolver esta competência…" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 16 }}>
          {(['profissional', 'instrumental', 'basica'] as const).map(cat => (
            <div key={cat} className="card" style={{ margin: 0, borderTop: `3px solid ${cat === 'profissional' ? '#145b8c' : cat === 'instrumental' ? '#d97706' : '#059669'}` }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: cat === 'profissional' ? '#145b8c' : cat === 'instrumental' ? '#d97706' : '#059669' }}>{cat === 'profissional' ? '🎓' : cat === 'instrumental' ? '🔧' : '📚'} {CAT_LABELS[cat]}</h4>
              <p style={{ fontSize: 11, color: 'var(--ink-muted)', margin: '0 0 10px' }}>{CAT_HELP[cat]}</p>
              <div className="stack" style={{ gap: 6 }}>
                {catDiscs(cat).map(d => (
                  <div key={d._idx} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input style={{ flex: 1, padding: '10px 12px', fontSize: 13 }} value={d.discipline_name} placeholder="Nome da disciplina" onChange={e => updDisc(d._idx, e.target.value)} />
                    {canWrite && <button type="button" onClick={() => rmDisc(d._idx)} style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: 14, padding: '4px 6px', flexShrink: 0 }}>✕</button>}
                  </div>
                ))}
                {canWrite && <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => addDisc(cat)}>+ Disciplina</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
