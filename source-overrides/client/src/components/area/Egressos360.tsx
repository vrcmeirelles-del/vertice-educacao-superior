// Egressos360.tsx — Módulo Egressos 360° (Fase 1)
// Visão geral, base de egressos, importação CSV/XLSX, perfil longitudinal
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchAlumniOverview, fetchAlumniEducation,
  importAlumniRows, AlumniOverview, AlumniEducation, AlumniImportRow,
  STATUS_LABELS, EGRESSO_STATUSES, AcademicStatus,
} from '../../lib/alumni';
import { supabase } from '../../lib/supabase';
import './egressos360.css';

interface Props {
  institutionId: string;
  courses: { id: string; name: string; modality?: string }[];
  role: 'master' | 'gestor' | 'equipe';
}

type View = 'overview' | 'base' | 'import' | 'perfil';

export default function Egressos360({ institutionId, courses, role }: Props) {
  const [view, setView] = useState<View>('overview');
  const [overview, setOverview] = useState<AlumniOverview[]>([]);
  const [education, setEducation] = useState<AlumniEducation[]>([]);
  const [eduCount, setEduCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // filters
  const [filterCourse, setFilterCourse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);
  // import
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  // detail
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const courseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of courses) m.set(c.name.toUpperCase(), c.id);
    return m;
  }, [courses]);

  // Load overview
  useEffect(() => {
    setLoading(true);
    fetchAlumniOverview(institutionId)
      .then(setOverview)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [institutionId]);

  // Load base
  const loadBase = useCallback(() => {
    setLoading(true);
    fetchAlumniEducation(institutionId, {
      courseId: filterCourse || undefined,
      status: filterStatus || undefined,
      page,
    })
      .then(r => { setEducation(r.rows); setEduCount(r.count); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [institutionId, filterCourse, filterStatus, page]);

  useEffect(() => {
    if (view === 'base') loadBase();
  }, [view, loadBase]);

  // Aggregates
  const totals = useMemo(() => {
    const t = { egressos: 0, contato: 0, atualizado: 0 };
    for (const r of overview) {
      t.egressos += r.total_egressos;
      t.contato += r.com_contato_valido;
      t.atualizado += r.contato_atualizado_12m;
    }
    return t;
  }, [overview]);

  const byCourse = useMemo(() => {
    const m = new Map<string, { name: string; total: number; contato: number }>();
    for (const r of overview) {
      const key = r.course_id ?? 'sem_curso';
      const prev = m.get(key) ?? { name: r.course_name ?? 'Sem curso', total: 0, contato: 0 };
      prev.total += r.total_egressos;
      prev.contato += r.com_contato_valido;
      m.set(key, prev);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [overview]);

  // CSV Import handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('Arquivo vazio ou sem cabeçalho');
      const headers = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const rows: AlumniImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const get = (h: string) => {
          const idx = headers.indexOf(h);
          return idx >= 0 ? cols[idx] : undefined;
        };
        const nome = get('nome') || get('nome_aluno') || get('aluno');
        if (!nome) continue;
        rows.push({
          nome,
          cpf: get('cpf'),
          email: get('email') || get('e-mail'),
          telefone: get('telefone') || get('celular') || get('phone'),
          curso: get('curso') || get('nome_curso'),
          matricula: get('matricula') || get('matrícula') || get('ra'),
          modalidade: get('modalidade'),
          grau: get('grau'),
          ano_ingresso: Number(get('ano_ingresso')) || undefined,
          semestre_ingresso: Number(get('semestre_ingresso')) || undefined,
          situacao: get('situacao') || get('situação') || get('status'),
          ano_conclusao: Number(get('ano_conclusao')) || undefined,
          semestre_conclusao: Number(get('semestre_conclusao')) || undefined,
          data_colacao: get('data_colacao') || get('data_colação'),
        });
      }
      const result = await importAlumniRows(rows, institutionId, courseMap);
      setImportResult(result);
      if (result.imported > 0) {
        // Refresh overview
        fetchAlumniOverview(institutionId).then(setOverview);
      }
    } catch (err: any) {
      setImportResult({ imported: 0, skipped: 0, errors: [err.message] });
    }
    setImporting(false);
  };

  // Nav
  const NavButton = ({ v, label, icon }: { v: View; label: string; icon: string }) => (
    <button
      className={`alumni-nav-btn${view === v ? ' active' : ''}`}
      onClick={() => { setView(v); setError(''); }}
    >{icon} {label}</button>
  );

  return (
    <div className="alumni-360">
      <header className="alumni-header">
        <h2>Egressos 360°</h2>
        <p className="alumni-subtitle">Acompanhamento longitudinal de egressos</p>
        <nav className="alumni-nav">
          <NavButton v="overview" label="Visão Geral" icon="📊" />
          <NavButton v="base" label="Base de Egressos" icon="👥" />
          <NavButton v="import" label="Importação" icon="📥" />
        </nav>
      </header>

      {error && <div className="alumni-error">⚠ {error}</div>}

      {/* ─── VISÃO GERAL ─── */}
      {view === 'overview' && (
        <section className="alumni-overview">
          <div className="alumni-kpis">
            <KpiCard label="Total de Egressos" value={totals.egressos} color="var(--vx-accent, #2563eb)" />
            <KpiCard label="Com Contato Válido" value={totals.contato}
              pct={totals.egressos ? Math.round(100 * totals.contato / totals.egressos) : 0}
              color="var(--vx-success, #16a34a)" />
            <KpiCard label="Contato Atualizado (12m)" value={totals.atualizado}
              pct={totals.egressos ? Math.round(100 * totals.atualizado / totals.egressos) : 0}
              color="var(--vx-warning, #d97706)" />
            <KpiCard label="Cursos com Egressos" value={byCourse.length} color="var(--vx-info, #7c3aed)" />
          </div>

          {!loading && byCourse.length === 0 && <DerivedEgressos institutionId={institutionId} />}

          {byCourse.length > 0 && (
            <div className="alumni-table-wrapper">
              <table className="alumni-table">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th style={{ textAlign: 'right' }}>Egressos</th>
                    <th style={{ textAlign: 'right' }}>Com Contato</th>
                    <th style={{ textAlign: 'right' }}>Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {byCourse.map(([cid, d]) => (
                    <tr key={cid}>
                      <td>{d.name}</td>
                      <td style={{ textAlign: 'right' }}>{d.total}</td>
                      <td style={{ textAlign: 'right' }}>{d.contato}</td>
                      <td style={{ textAlign: 'right' }}>
                        <CoverageBar pct={d.total ? Math.round(100 * d.contato / d.total) : 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && <p className="alumni-loading">Carregando dados…</p>}
        </section>
      )}

      {/* ─── BASE DE EGRESSOS ─── */}
      {view === 'base' && (
        <section className="alumni-base">
          <div className="alumni-filters">
            <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setPage(0); }}>
              <option value="">Todos os cursos</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}>
              <option value="">Todos os status</option>
              {(Object.entries(STATUS_LABELS) as [AcademicStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <span className="alumni-count">{eduCount} registro(s)</span>
          </div>

          <div className="alumni-table-wrapper">
            <table className="alumni-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Curso</th>
                  <th>Matrícula</th>
                  <th>Status</th>
                  <th>Conclusão</th>
                  <th>Contato</th>
                  <th>Verificado</th>
                </tr>
              </thead>
              <tbody>
                {education.map(ed => {
                  const p = ed.profile as any;
                  return (
                    <tr key={ed.id} className="alumni-row-clickable" onClick={() => { setSelectedProfile(ed.profile_id); setView('perfil'); }}>
                      <td>{p?.social_name || p?.full_name || '—'}</td>
                      <td>{courses.find(c => c.id === ed.course_id)?.name ?? '—'}</td>
                      <td>{ed.enrollment_id ?? '—'}</td>
                      <td><StatusBadge status={ed.academic_status as AcademicStatus} /></td>
                      <td>{ed.conclusion_year ? `${ed.conclusion_year}/${ed.conclusion_semester ?? '?'}` : '—'}</td>
                      <td>{p?.email ? '✉' : ''}{p?.phone ? '📱' : ''}{!p?.email && !p?.phone ? '—' : ''}</td>
                      <td>{ed.status_verified ? '✓' : '—'}</td>
                    </tr>
                  );
                })}
                {!loading && education.length === 0 && (
                  <tr><td colSpan={7} className="alumni-empty-cell">Nenhum registro encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {eduCount > 50 && (
            <div className="alumni-pagination">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Anterior</button>
              <span>Página {page + 1} de {Math.ceil(eduCount / 50)}</span>
              <button disabled={(page + 1) * 50 >= eduCount} onClick={() => setPage(p => p + 1)}>Próxima →</button>
            </div>
          )}
        </section>
      )}

      {/* ─── IMPORTAÇÃO ─── */}
      {view === 'import' && (
        <section className="alumni-import">
          <div className="alumni-import-card">
            <h3>Importar Base de Egressos</h3>
            <p>Carregue um arquivo CSV (separado por ponto-e-vírgula) com os dados dos egressos.</p>
            <p className="alumni-hint">
              Colunas reconhecidas: <code>nome</code>, <code>cpf</code>, <code>email</code>, <code>telefone</code>,
              <code>curso</code>, <code>matricula</code>, <code>modalidade</code>, <code>grau</code>,
              <code>ano_ingresso</code>, <code>semestre_ingresso</code>, <code>situacao</code>,
              <code>ano_conclusao</code>, <code>semestre_conclusao</code>, <code>data_colacao</code>
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              disabled={importing}
            />
            {importing && <p className="alumni-loading">Importando… Isso pode levar alguns minutos.</p>}
            {importResult && (
              <div className={`alumni-import-result ${importResult.errors.length ? 'has-errors' : 'success'}`}>
                <p>✅ <strong>{importResult.imported}</strong> importado(s) | ⏭ <strong>{importResult.skipped}</strong> ignorado(s)</p>
                {importResult.errors.length > 0 && (
                  <details>
                    <summary>{importResult.errors.length} erro(s)</summary>
                    <ul>{importResult.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul>
                    {importResult.errors.length > 20 && <p>…e mais {importResult.errors.length - 20} erros.</p>}
                  </details>
                )}
              </div>
            )}
          </div>
          <div className="alumni-import-card">
            <h3>Modelo de Importação</h3>
            <p>Baixe o modelo CSV para preparar seus dados.</p>
            <button className="alumni-btn-secondary" onClick={downloadTemplate}>📄 Baixar modelo CSV</button>
          </div>
        </section>
      )}

      {/* ─── PERFIL DO EGRESSO ─── */}
      {view === 'perfil' && selectedProfile && (
        <ProfileDetail profileId={selectedProfile} courses={courses} onBack={() => setView('base')} />
      )}
    </div>
  );
}

/* ── Componentes auxiliares ── */

// ─── Dados derivados quando não há perfis nominais cadastrados ───
function DerivedEgressos({ institutionId }: { institutionId: string }) {
  const [resumo, setResumo] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      supabase.from('v_egressos_resumo').select('*').eq('institution_id', institutionId).maybeSingle(),
      supabase.from('v_egressos_historico').select('*').eq('institution_id', institutionId).order('semestre', { ascending: false }).limit(100),
    ]).then(([r, h]) => {
      if (r.data) setResumo(r.data);
      if (h.data) setHistorico(h.data);
      setLoading(false);
    });
  }, [institutionId]);

  if (loading) return <p className="alumni-loading">Carregando indicadores de egressos…</p>;
  if (!resumo || resumo.total_concluidos === 0) return (
    <div className="alumni-empty">
      <p>Nenhum dado de egressos disponível para esta instituição.</p>
      <p>Use a aba <strong>Importação</strong> para carregar uma base CSV/XLSX, ou conecte o sistema acadêmico da IES.</p>
    </div>
  );

  // Agrupar por curso
  const byCourse = new Map<string, { name: string; total: number; semestres: number }>();
  for (const r of historico) {
    const key = r.course_name || 'Sem curso';
    const prev = byCourse.get(key) || { name: key, total: 0, semestres: 0 };
    prev.total += r.concluidos;
    prev.semestres += 1;
    byCourse.set(key, prev);
  }
  const sorted = [...byCourse.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="alumni-derived">
      <div className="alumni-derived-note">
        <strong>Concluintes por curso e semestre</strong> — dados do sistema acadêmico da IES.
        Para acompanhamento individual (contato, empregabilidade, pesquisas), importe a base nominal via CSV ou conecte a API.
      </div>
      <div className="alumni-kpis">
        <KpiCard label="Total de Concluintes" value={resumo.total_concluidos} color="var(--vx-accent, #2563eb)" />
        <KpiCard label="Cursos com Concluintes" value={resumo.cursos_com_concluintes} color="var(--vx-info, #7c3aed)" />
        <KpiCard label="Semestres com Dados" value={resumo.semestres_com_dados} color="var(--vx-success, #16a34a)" />
      </div>
      <p className="alumni-derived-period">Período: <strong>{resumo.primeiro_semestre}</strong> a <strong>{resumo.ultimo_semestre}</strong> · {resumo.semestres_com_dados} semestres</p>
      <div className="alumni-table-wrapper">
        <table className="alumni-table">
          <thead><tr><th>Curso</th><th style={{textAlign:'right'}}>Concluintes</th><th style={{textAlign:'right'}}>Semestres</th></tr></thead>
          <tbody>
            {sorted.map(([key, d]) => (
              <tr key={key}><td>{d.name}</td><td style={{textAlign:'right'}}>{d.total.toLocaleString('pt-BR')}</td><td style={{textAlign:'right'}}>{d.semestres}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, pct, color }: { label: string; value: number; pct?: number; color: string }) {
  return (
    <div className="alumni-kpi" style={{ borderLeftColor: color }}>
      <span className="alumni-kpi-value">{value.toLocaleString('pt-BR')}</span>
      {pct !== undefined && <span className="alumni-kpi-pct">{pct}%</span>}
      <span className="alumni-kpi-label">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: AcademicStatus }) {
  const isEgresso = EGRESSO_STATUSES.includes(status);
  return (
    <span className={`alumni-status-badge ${isEgresso ? 'egresso' : 'other'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'var(--vx-success, #16a34a)' : pct >= 40 ? 'var(--vx-warning, #d97706)' : 'var(--vx-danger, #dc2626)';
  return (
    <div className="alumni-coverage">
      <div className="alumni-coverage-bar" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      <span>{pct}%</span>
    </div>
  );
}

function ProfileDetail({ profileId, courses, onBack }: { profileId: string; courses: Props['courses']; onBack: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [educations, setEducations] = useState<any[]>([]);
  const [employments, setEmployments] = useState<any[]>([]);
  const [furtherEd, setFurtherEd] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('vertice_alumni_profiles').select('*').eq('id', profileId).single(),
      supabase.from('vertice_alumni_education').select('*').eq('profile_id', profileId),
      supabase.from('vertice_alumni_employment').select('*').eq('profile_id', profileId).order('started_at', { ascending: false }),
      supabase.from('vertice_alumni_further_ed').select('*').eq('profile_id', profileId),
    ]).then(([pRes, eRes, empRes, feRes]) => {
      setProfile(pRes.data);
      setEducations(eRes.data ?? []);
      setEmployments(empRes.data ?? []);
      setFurtherEd(feRes.data ?? []);
    }).finally(() => setLoading(false));
  }, [profileId]);

  if (loading) return <p className="alumni-loading">Carregando perfil…</p>;
  if (!profile) return <p>Perfil não encontrado.</p>;

  return (
    <section className="alumni-profile-detail">
      <button className="alumni-btn-back" onClick={onBack}>← Voltar para a base</button>
      <div className="alumni-profile-header">
        <h3>{profile.social_name || profile.full_name}</h3>
        <div className="alumni-profile-meta">
          {profile.email && <span>✉ {profile.email}</span>}
          {profile.phone && <span>📱 {profile.phone}</span>}
          <span>Canal: {profile.preferred_channel}</span>
          {profile.comm_opt_out && <span className="alumni-opt-out">Opt-out ativo</span>}
        </div>
      </div>

      <h4>Formações</h4>
      {educations.map(ed => (
        <div key={ed.id} className="alumni-education-card">
          <strong>{courses.find(c => c.id === ed.course_id)?.name ?? 'Curso não identificado'}</strong>
          <span className="alumni-education-details">
            {ed.modality} · {ed.degree} · Ingresso: {ed.admission_year}/{ed.admission_semester ?? '?'}
            {ed.conclusion_year && ` · Conclusão: ${ed.conclusion_year}/${ed.conclusion_semester ?? '?'}`}
          </span>
          <StatusBadge status={ed.academic_status} />
        </div>
      ))}

      {employments.length > 0 && (
        <>
          <h4>Trajetória Profissional</h4>
          {employments.map(emp => (
            <div key={emp.id} className="alumni-employment-card">
              <strong>{emp.occupation ?? 'Ocupação não informada'}</strong>
              <span>{emp.employer_name} · {emp.field_of_work} · {emp.employment_status}</span>
              {emp.related_to_degree !== null && (
                <span>Relação com formação: {emp.related_to_degree ? 'Sim' : 'Não'}</span>
              )}
            </div>
          ))}
        </>
      )}

      {furtherEd.length > 0 && (
        <>
          <h4>Formação Continuada</h4>
          {furtherEd.map(fe => (
            <div key={fe.id} className="alumni-further-ed-card">
              <strong>{fe.program_name ?? fe.ed_type}</strong>
              <span>{fe.institution_name} · {fe.field_of_study} · {fe.status}</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function downloadTemplate() {
  const header = 'nome;cpf;email;telefone;curso;matricula;modalidade;grau;ano_ingresso;semestre_ingresso;situacao;ano_conclusao;semestre_conclusao;data_colacao';
  const example = 'Maria da Silva;000.000.000-00;maria@email.com;63999999999;Direito;2020001;Presencial;Bacharelado;2020;1;Formado;2024;2;2025-03-15';
  const blob = new Blob([header + '\n' + example + '\n'], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_importacao_egressos.csv';
  a.click();
  URL.revokeObjectURL(url);
}
