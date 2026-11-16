import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isFullAccess, type Role } from '@/lib/area';
import './planning/planning.css';

type Course = { id: string; name: string; code?: string | null };
type Discipline = { id?: string; discipline_name: string; category: 'profissional' | 'instrumental' | 'basica'; sort_order: number };
type Competency = { id?: string; code: string; title: string; description: string; sort_order: number; disciplines: Discipline[] };
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
        <p><strong>Sapiens:</strong> A IA pode gerar um modelo replicável desta construção para outros cursos, adaptando competências e disciplinas às DCNs de cada área.</p>
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
  const [sapiensLoading, setSapiensLoading] = useState(false);
  const [sapiensResult, setSapiensResult] = useState<string | null>(null);
  const [ppcLoading, setPpcLoading] = useState(false);

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
          if (active) setBuild({ id: b.id, version: b.version, status: b.status, graduate_profile: b.graduate_profile || '', graduate_profile_source: b.graduate_profile_source || '', dcn_reference: b.dcn_reference || '', dcn_document_url: b.dcn_document_url || '', competencies: competencies.length > 0 ? competencies : EMPTY_BUILD.competencies });
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [institutionId, courseId]);

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

  /* ── Sapiens: gerar modelo replicável ── */
  async function generateSapiensModel() {
    if (!build.competencies.some(c => c.title)) {
      setNotice('Preencha pelo menos as competências antes de gerar o modelo Sapiens.');
      return;
    }
    setSapiensLoading(true);
    setSapiensResult(null);
    try {
      const payload = {
        institutionId, courseId,
        context: 'curriculum_model_generation',
        curriculum: {
          course: courseName,
          graduate_profile: build.graduate_profile,
          dcn_reference: build.dcn_reference,
          competencies: build.competencies.map(c => ({
            code: c.code, title: c.title, description: c.description,
            disciplines: {
              profissional: c.disciplines.filter(d => d.category === 'profissional').map(d => d.discipline_name),
              instrumental: c.disciplines.filter(d => d.category === 'instrumental').map(d => d.discipline_name),
              basica: c.disciplines.filter(d => d.category === 'basica').map(d => d.discipline_name),
            }
          }))
        },
        prompt: `A partir desta construção curricular do curso de ${courseName}, gere um MODELO REPLICÁVEL que possa ser usado como template para outros cursos. O modelo deve:

1. ESTRUTURA GENÉRICA: Transforme cada competência em um padrão abstrato (ex: C1 "Interpretação e Aplicação do Direito" vira "[COMPETÊNCIA TÉCNICA CENTRAL]") com instruções sobre como adaptar para qualquer área.

2. CRITÉRIOS DE CLASSIFICAÇÃO: Defina regras claras para classificar disciplinas como profissional, instrumental ou básica em qualquer curso.

3. GUIA POR ÁREA: Para as áreas mais comuns (Administração, Pedagogia, Enfermagem, Engenharia Civil, Contabilidade), sugira as competências-tipo e exemplos de disciplinas baseados nas DCNs de cada área.

4. CHECKLIST DE VALIDAÇÃO: O que verificar para saber se a construção está coerente com as DCNs.

Formato: texto estruturado, direto, prático. Sem floreio.`
      };
      const { data, error: err } = await supabase.functions.invoke('vertice-sapiens-analyze', { body: payload });
      if (err) throw err;
      setSapiensResult(data?.report || data?.analysis || data?.text || JSON.stringify(data));
      setNotice('Modelo Sapiens gerado. Pode ser usado como referência para construção curricular de outros cursos.');
    } catch (e: any) {
      setSapiensResult(`⚠️ Sapiens indisponível no momento: ${e.message}`);
    }
    setSapiensLoading(false);
  }

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      let buildId = build.id;
      if (!buildId) {
        const { data, error: err } = await supabase.from('curriculum_builds').insert({
          institution_id: institutionId, course_id: courseId,
          graduate_profile: build.graduate_profile,
          graduate_profile_source: build.graduate_profile_source || null,
          dcn_reference: build.dcn_reference,
          dcn_document_url: build.dcn_document_url || null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        }).select('id').single();
        if (err) throw new Error(err.message);
        buildId = data.id;
      } else {
        const { error: err } = await supabase.from('curriculum_builds').update({
          graduate_profile: build.graduate_profile,
          graduate_profile_source: build.graduate_profile_source || null,
          dcn_reference: build.dcn_reference,
          dcn_document_url: build.dcn_document_url || null,
          updated_at: new Date().toISOString(),
        }).eq('id', buildId);
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
          <CompetencyCard key={ci} comp={comp} index={ci} onChange={updated => { const next = [...build.competencies]; next[ci] = updated; update({ competencies: next }); }} onRemove={() => update({ competencies: build.competencies.filter((_, i) => i !== ci) })} canWrite={canWrite} />
        ))}
      </div>
      <button type="button" className="btn-ghost" onClick={() => update({ competencies: [...build.competencies, { code: `C${build.competencies.length + 1}`, title: '', description: '', sort_order: build.competencies.length, disciplines: [] }] })}>+ Adicionar Competência</button>
    </fieldset>

    {/* ── Toolbar: Save + Sapiens ── */}
    {canWrite && <div className="planning-toolbar" style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <button type="button" className="planning-primary" disabled={saving} onClick={save}>{saving ? 'Salvando…' : '💾 Salvar Matriz Curricular'}</button>
      <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }} disabled={sapiensLoading} onClick={generateSapiensModel}>
        {sapiensLoading ? '🔄 Sapiens gerando…' : '🤖 Gerar Modelo Replicável (Sapiens)'}
      </button>
    </div>}

    {/* ── Sapiens result ── */}
    {sapiensResult && <div className="card" style={{ marginTop: 20, padding: 24, borderLeft: '5px solid #6366f1', background: '#faf5ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <strong style={{ fontSize: 15, color: '#4338ca' }}>Modelo Replicável — Sapiens</strong>
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
