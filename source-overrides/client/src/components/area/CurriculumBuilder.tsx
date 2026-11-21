import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isFullAccess, type Role } from '@/lib/area';
import { loadCurriculum, publishCurriculum, saveCurriculum, type CurriculumState } from '@/lib/curriculum-api';
import { buildCurriculumModel, CURRICULUM_MODEL_RULES } from '@/lib/curriculum-model';
import './planning/planning.css';

type Course = { id: string; name: string; code?: string | null };
type Discipline = { id?: string; discipline_name: string; category: 'profissional' | 'instrumental' | 'basica'; sort_order: number };
type Competency = { id?: string; code: string; title: string; description: string; sort_order: number; origin_period?: number | null; period_status?: 'proposed' | 'validated' | null; disciplines: Discipline[] };
type Build = { id?: string; version: number; status: 'draft' | 'published' | 'archived'; graduate_profile: string; graduate_profile_source: string; dcn_reference: string; dcn_document_url: string; competencies: Competency[] };

const EMPTY_BUILD: Build = {
  version: 1, status: 'draft', graduate_profile: '', graduate_profile_source: '', dcn_reference: '', dcn_document_url: '',
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
        : <BuildEditor key={`${institutionId}:${courseId}`} institutionId={institutionId} courseId={courseId} courseName={courses.find(c => c.id === courseId)?.name || ''} canWrite={canWrite} onDirty={setUnsaved} />}
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
        <p style={{ marginBottom: 14 }}><strong>Perfil do Egresso:</strong> Deve ser extraído do PPC do curso. Se já houver documentos no Repositório, o sistema puxa automaticamente.</p>
        <p style={{ marginBottom: 14 }}><strong>DCNs:</strong> As Diretrizes Curriculares Nacionais de cada curso. O sistema pode buscar a resolução vigente online.</p>
        <p style={{ marginBottom: 14 }}><strong>Competências (C1 a C6):</strong> São as grandes áreas de capacidade que o aluno precisa desenvolver. Cada competência reúne conhecimentos, habilidades e atitudes.</p>
        <p style={{ marginBottom: 14 }}><strong>Disciplinas Profissionais:</strong> Diretamente ligadas à prática da profissão.</p>
        <p style={{ marginBottom: 14 }}><strong>Disciplinas Instrumentais:</strong> Habilidades técnicas de apoio.</p>
        <p style={{ marginBottom: 14 }}><strong>Disciplinas Básicas:</strong> Fundamentação científica e humanística.</p>
        <p><strong>Modelo replicável:</strong> o portal gera, por regras e sem IA, a estrutura desta construção (competências, categorias e períodos), os critérios de classificação e uma lista de verificação, para servir de referência a outros cursos.</p>
      </div>
    </div>}
  </>;
}

function BuildEditor({ institutionId, courseId, courseName, canWrite, onDirty }: { institutionId: string; courseId: string; courseName: string; canWrite: boolean; onDirty: (v: boolean) => void }) {
  const [build, setBuild] = useState<Build>({ ...EMPTY_BUILD });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sapiensLoading = false; // cálculo local e síncrono
  const [sapiensResult, setSapiensResult] = useState<string | null>(null);
  const [ppcLoading, setPpcLoading] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  // O servidor decide: papel na IES ou função no curso (coordenação/NDE) atribuída pela gestão.
  const [serverCanWrite, setServerCanWrite] = useState(false);
  const writable = serverCanWrite;

  const update = useCallback((patch: Partial<Build>) => {
    setBuild(prev => ({ ...prev, ...patch }));
    onDirty(true);
    setNotice('');
  }, [onDirty]);

  const apply = useCallback((state: CurriculumState) => {
    setPublishedVersion(state.publishedVersion);
    setServerCanWrite(state.canWrite);
    if (!state.build) { setBuild({ ...EMPTY_BUILD }); return; }
    const b = state.build;
    setBuild({ id: b.id, version: b.version, status: b.status, graduate_profile: b.graduate_profile, graduate_profile_source: b.graduate_profile_source,
      dcn_reference: b.dcn_reference, dcn_document_url: b.dcn_document_url,
      competencies: state.competencies.length > 0 ? state.competencies.map(c => ({ ...c, disciplines: c.disciplines.map(d => ({ ...d })) })) : EMPTY_BUILD.competencies });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const state = await loadCurriculum(institutionId, courseId);
        if (active) apply(state);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [institutionId, courseId, apply]);

  /* ── Buscar perfil do egresso no PPC (repositório) ── */
  async function fetchProfileFromPPC() {
    setPpcLoading(true);
    try {
      // Look for PPC-related documents in repository
      const { data: files } = await supabase.from('vertice_repository_files')
        .select('id, file_name, file_url, created_at')
        .eq('institution_id', institutionId)
        .or('file_name.ilike.%ppc%,file_name.ilike.%perfil%egresso%,file_name.ilike.%projeto%pedagogico%')
        .order('created_at', { ascending: false }).limit(5);

      if (files?.length) {
        update({ graduate_profile_source: `PPC encontrado no Repositório: ${files[0].file_name} (${new Date(files[0].created_at).toLocaleDateString('pt-BR')})` });
        setNotice(`📄 Documento PPC encontrado: "${files[0].file_name}". Extraia o perfil do egresso do documento e cole acima.`);
      } else {
        setNotice('Nenhum PPC encontrado no Repositório. Você pode digitar o perfil manualmente ou anexar o documento.');
      }
    } catch { setNotice('Erro ao buscar no Repositório.'); }
    setPpcLoading(false);
  }

  /* ── Modelo replicável por regras (sem IA): lib/curriculum-model.ts ── */
  function generateSapiensModel() {
    if (!build.competencies.some(c => c.code.trim() || c.title.trim())) {
      setNotice('Preencha pelo menos as competências antes de gerar o modelo.');
      return;
    }
    const model = buildCurriculumModel({ course: courseName, graduate_profile: build.graduate_profile, dcn_reference: build.dcn_reference,
      dcn_document_url: build.dcn_document_url, competencies: build.competencies });
    setSapiensResult(model.text);
    setNotice(`Modelo gerado por regras: ${model.checks.filter(c => c.ok).length} de ${model.checks.length} itens da lista de verificação atendidos.`);
  }

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const wasPublished = build.status !== 'draft' && Boolean(build.id);
      const state = await saveCurriculum(institutionId, courseId, {
        ...(build.id && build.status === 'draft' ? { buildId: build.id } : {}),
        graduate_profile: build.graduate_profile, graduate_profile_source: build.graduate_profile_source,
        dcn_reference: build.dcn_reference, dcn_document_url: build.dcn_document_url, competencies: build.competencies,
      });
      apply(state);
      onDirty(false);
      setNotice(wasPublished
        ? `Alterações salvas como nova versão (${state.build?.version}) em rascunho. A versão publicada continua valendo até você publicar a nova.`
        : 'Matriz curricular salva em rascunho.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    if (!build.id || build.status !== 'draft') return;
    if (!window.confirm(`Publicar a versão ${build.version} da matriz? Ela passa a ser a referência oficial para o Avalia 360° e a versão publicada anterior é arquivada.`)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const state = await publishCurriculum(institutionId, courseId, build.id);
      apply(state); onDirty(false);
      setNotice(`Versão ${state.build?.version} publicada.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao publicar'); }
    finally { setSaving(false); }
  };

  if (loading) return <p role="status">Carregando matriz curricular…</p>;

  return <>
    {error && <p role="alert" className="planning-error">{error}</p>}
    {notice && <p role="status" className="planning-success">{notice}</p>}
    <div className="planning-toolbar"><p>{build.id ? `${STATUS_LABELS[build.status]} · versão ${build.version}` : 'Nenhuma matriz salva ainda'}
      {publishedVersion !== null && build.status === 'draft' ? ` · versão publicada em vigor: ${publishedVersion}` : ''}</p></div>
    {!serverCanWrite && <p role="note" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Leitura apenas: a matriz é editada pela gestão, pela coordenação ou pelo NDE.</p>}
    <fieldset disabled={!writable || saving}>
      <legend className="planning-sr">Construção curricular</legend>

      {/* ── Perfil do Egresso ── */}
      <div className="card" style={{ borderLeft: '4px solid #145b8c' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>📋 Perfil Profissional do Egresso</h3>
          <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '8px 16px', fontSize: 12 }} onClick={fetchProfileFromPPC} disabled={ppcLoading}>
            {ppcLoading ? '🔄 Buscando…' : '📄 Buscar no PPC (Repositório)'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 12px' }}>Extraído do PPC do curso. Se já estiver no Repositório, clique em "Buscar no PPC". Senão, cole ou digite abaixo.</p>
        {build.graduate_profile_source && <p style={{ fontSize: 12, color: '#145b8c', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>📎 {build.graduate_profile_source}</p>}
        <textarea rows={6} placeholder="O egresso do curso de [nome] é um profissional capacitado para..." value={build.graduate_profile} onChange={e => update({ graduate_profile: e.target.value })} />
      </div>

      {/* ── DCNs ── */}
      <div className="card" style={{ borderLeft: '4px solid #059669' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>📜 Diretrizes Curriculares Nacionais (DCNs)</h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 12px' }}>Indique a Resolução CNE/CES vigente. Se tiver o documento digital, cole o link abaixo.</p>
        <div className="row">
          <label className="planning-field" style={{ flex: 2 }}><span>Resolução</span>
            <input placeholder="Ex: Resolução CNE/CES nº 5/2018 (Direito)" value={build.dcn_reference} onChange={e => update({ dcn_reference: e.target.value })} />
          </label>
          <label className="planning-field" style={{ flex: 1 }}><span>Link do documento (opcional)</span>
            <input placeholder="https://..." value={build.dcn_document_url} onChange={e => update({ dcn_document_url: e.target.value })} />
          </label>
        </div>
      </div>

      {/* ── Competências ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>🎯 Competências Centrais</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0' }}>Cada competência representa uma grande área de capacidade profissional. Para cada uma, vincule as disciplinas em três categorias.</p>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        {build.competencies.map((comp, ci) => (
          <CompetencyCard key={comp.id || ci} comp={comp} index={ci} onChange={updated => { const next = [...build.competencies]; next[ci] = updated; update({ competencies: next }); }} onRemove={() => update({ competencies: build.competencies.filter((_, i) => i !== ci) })} canWrite={writable} />
        ))}
      </div>
      <button type="button" className="btn-ghost" onClick={() => update({ competencies: [...build.competencies, { code: `C${build.competencies.length + 1}`, title: '', description: '', sort_order: build.competencies.length, disciplines: [] }] })}>+ Adicionar Competência</button>
    </fieldset>

    {/* ── Toolbar: Save + Sapiens ── */}
    {writable && <div className="planning-toolbar" style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <button type="button" className="planning-primary" disabled={saving} onClick={save}>{saving ? 'Salvando…' : '💾 Salvar Matriz Curricular'}</button>
      {build.id && build.status === 'draft' && <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '12px 20px' }} disabled={saving} onClick={() => void publish()}>📢 Publicar versão {build.version}</button>}
      <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }} disabled={sapiensLoading} onClick={generateSapiensModel}>
        {sapiensLoading ? 'Gerando…' : '📐 Gerar modelo replicável'}
      </button>
    </div>}

    {/* ── Sapiens result ── */}
    {sapiensResult && <div className="card" style={{ marginTop: 20, padding: 24, borderLeft: '5px solid #6366f1', background: '#faf5ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>📐</span>
        <strong style={{ fontSize: 15, color: '#4338ca' }}>Modelo replicável — por regras</strong>
        <small style={{ color: '#64748b' }}> versão {CURRICULUM_MODEL_RULES.version} · sem IA</small>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Este modelo pode ser usado como template para construção curricular de outros cursos. Adapte as competências e disciplinas conforme as DCNs de cada área.</p>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: '#1e293b' }}>{sapiensResult}</div>
    </div>}
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
        <div className="row">
          <label className="planning-field"><span>Período de origem</span>
            <select value={comp.origin_period ?? ''} onChange={e => onChange({ ...comp, origin_period: e.target.value ? Number(e.target.value) : null, period_status: e.target.value ? (comp.period_status ?? 'proposed') : null })} style={{ maxWidth: 160 }}>
              <option value="">Não informado</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}º período</option>)}
            </select></label>
          <label className="planning-field"><span>Situação do período</span>
            <select value={comp.period_status ?? 'proposed'} disabled={!comp.origin_period} onChange={e => onChange({ ...comp, period_status: e.target.value as 'proposed' | 'validated' })} style={{ maxWidth: 220 }}>
              <option value="proposed">Proposto</option><option value="validated">Homologado no PPC</option>
            </select></label>
        </div>
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
