// Egressos360.tsx — Módulo Egressos 360° (Fases 1-6)
// Visão geral, base, importação, pesquisas, indicadores, CPA
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchAlumniOverview, fetchAlumniEducation,
  importAlumniRows, AlumniOverview, AlumniEducation, AlumniImportRow,
  STATUS_LABELS, EGRESSO_STATUSES, AcademicStatus,
  fetchSurveys, fetchSurveyIndicators, fetchTrajectoryIndicators,
  fetchFindings, fetchActions, fetchIndicatorCatalog,
  createSurvey, createFinding, createAction, updateActionStatus,
  safePercent, safeRatio,
  AlumniSurvey, SurveyIndicators, TrajectoryIndicators,
  AlumniFinding, AlumniAction, IndicatorCatalog,
} from '../../lib/alumni';
import { supabase } from '../../lib/supabase';
import './egressos360.css';

interface Props {
  institutionId: string;
  courses: { id: string; name: string; modality?: string }[];
  role: 'master' | 'gestor' | 'equipe';
}

type View = 'overview' | 'base' | 'import' | 'perfil' | 'pesquisas' | 'indicadores' | 'cpa';

export default function Egressos360({ institutionId, courses, role }: Props) {
  const [view, setView] = useState<View>('overview');
  const [overview, setOverview] = useState<AlumniOverview[]>([]);
  const [education, setEducation] = useState<AlumniEducation[]>([]);
  const [eduCount, setEduCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const courseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of courses) m.set(c.name.toUpperCase(), c.id);
    return m;
  }, [courses]);

  useEffect(() => {
    setLoading(true);
    fetchAlumniOverview(institutionId)
      .then(setOverview)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [institutionId]);

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
      if (result.imported > 0) fetchAlumniOverview(institutionId).then(setOverview);
    } catch (err: any) {
      setImportResult({ imported: 0, skipped: 0, errors: [err.message] });
    }
    setImporting(false);
  };

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
        <p className="alumni-subtitle">Acompanhamento integrado de egressos</p>
        <nav className="alumni-nav">
          <NavButton v="overview" label="Visão Geral" icon="📊" />
          <NavButton v="base" label="Base" icon="👥" />
          <NavButton v="import" label="Importação" icon="📥" />
          <NavButton v="pesquisas" label="Pesquisas" icon="📋" />
          <NavButton v="indicadores" label="Indicadores" icon="📈" />
          <NavButton v="cpa" label="CPA" icon="🎯" />
        </nav>
      </header>

      {error && <div className="alumni-error">⚠ {error}</div>}

      {view === 'overview' && (
        <OverviewSection
          totals={totals} byCourse={byCourse} loading={loading}
          institutionId={institutionId}
        />
      )}

      {view === 'base' && (
        <BaseSection
          education={education} eduCount={eduCount} loading={loading}
          courses={courses} filterCourse={filterCourse} filterStatus={filterStatus}
          page={page}
          onFilterCourse={v => { setFilterCourse(v); setPage(0); }}
          onFilterStatus={v => { setFilterStatus(v); setPage(0); }}
          onPage={setPage}
          onSelectProfile={id => { setSelectedProfile(id); setView('perfil'); }}
        />
      )}

      {view === 'import' && (
        <ImportSection
          importing={importing} importResult={importResult}
          onFileUpload={handleFileUpload}
        />
      )}

      {view === 'perfil' && selectedProfile && (
        <ProfileDetail profileId={selectedProfile} courses={courses} onBack={() => setView('base')} />
      )}

      {view === 'pesquisas' && (
        <SurveysSection institutionId={institutionId} courses={courses} role={role} />
      )}

      {view === 'indicadores' && (
        <IndicadoresSection institutionId={institutionId} courses={courses} />
      )}

      {view === 'cpa' && (
        <CpaSection institutionId={institutionId} role={role} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* VISÃO GERAL                                                   */
/* ══════════════════════════════════════════════════════════════ */

function OverviewSection({ totals, byCourse, loading, institutionId }: {
  totals: { egressos: number; contato: number; atualizado: number };
  byCourse: [string, { name: string; total: number; contato: number }][];
  loading: boolean;
  institutionId: string;
}) {
  return (
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
              <tr><th>Curso</th><th style={{ textAlign: 'right' }}>Egressos</th><th style={{ textAlign: 'right' }}>Com Contato</th><th style={{ textAlign: 'right' }}>Cobertura</th></tr>
            </thead>
            <tbody>
              {byCourse.map(([cid, d]) => (
                <tr key={cid}>
                  <td>{d.name}</td>
                  <td style={{ textAlign: 'right' }}>{d.total}</td>
                  <td style={{ textAlign: 'right' }}>{d.contato}</td>
                  <td style={{ textAlign: 'right' }}><CoverageBar pct={d.total ? Math.round(100 * d.contato / d.total) : 0} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading && <p className="alumni-loading">Carregando dados…</p>}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* BASE DE EGRESSOS                                              */
/* ══════════════════════════════════════════════════════════════ */

function BaseSection({ education, eduCount, loading, courses, filterCourse, filterStatus, page, onFilterCourse, onFilterStatus, onPage, onSelectProfile }: {
  education: AlumniEducation[]; eduCount: number; loading: boolean;
  courses: Props['courses']; filterCourse: string; filterStatus: string; page: number;
  onFilterCourse: (v: string) => void; onFilterStatus: (v: string) => void;
  onPage: (p: number | ((p: number) => number)) => void;
  onSelectProfile: (id: string) => void;
}) {
  return (
    <section className="alumni-base">
      <div className="alumni-filters">
        <select value={filterCourse} onChange={e => onFilterCourse(e.target.value)}>
          <option value="">Todos os cursos</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => onFilterStatus(e.target.value)}>
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
            <tr><th>Nome</th><th>Curso</th><th>Matrícula</th><th>Status</th><th>Conclusão</th><th>Contato</th><th>Verificado</th></tr>
          </thead>
          <tbody>
            {education.map(ed => {
              const p = ed.profile as any;
              return (
                <tr key={ed.id} className="alumni-row-clickable" onClick={() => onSelectProfile(ed.profile_id)}>
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
          <button disabled={page === 0} onClick={() => onPage(p => p - 1)}>← Anterior</button>
          <span>Página {page + 1} de {Math.ceil(eduCount / 50)}</span>
          <button disabled={(page + 1) * 50 >= eduCount} onClick={() => onPage(p => p + 1)}>Próxima →</button>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* IMPORTAÇÃO                                                     */
/* ══════════════════════════════════════════════════════════════ */

function ImportSection({ importing, importResult, onFileUpload }: {
  importing: boolean;
  importResult: { imported: number; skipped: number; errors: string[] } | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
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
        <input type="file" accept=".csv,.txt" onChange={onFileUpload} disabled={importing} />
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
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* §4.2 — PESQUISAS                                              */
/* ══════════════════════════════════════════════════════════════ */

function SurveysSection({ institutionId, courses, role }: {
  institutionId: string; courses: Props['courses']; role: string;
}) {
  const [surveys, setSurveys] = useState<AlumniSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newWave, setNewWave] = useState('conclusao');
  const [newCourse, setNewCourse] = useState('');

  useEffect(() => {
    fetchSurveys(institutionId).then(setSurveys).finally(() => setLoading(false));
  }, [institutionId]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const s = await createSurvey({
        institution_id: institutionId,
        title: newTitle.trim(),
        wave_type: newWave,
        course_id: newCourse || undefined,
        status: 'rascunho',
      });
      setSurveys(prev => [s, ...prev]);
      setShowCreate(false);
      setNewTitle('');
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const WAVE_LABELS: Record<string, string> = {
    conclusao: 'Na conclusão', '6m': '6 meses', '12m': '12 meses',
    '24m': '24 meses', '36m': '36 meses', '60m': '60 meses', custom: 'Personalizado',
  };
  const STATUS_COLORS: Record<string, string> = {
    rascunho: '#94a3b8', teste: '#d97706', ativa: '#16a34a', encerrada: '#6b7280', arquivada: '#374151',
  };

  if (loading) return <p className="alumni-loading">Carregando pesquisas…</p>;

  return (
    <section className="alumni-surveys">
      <div className="alumni-section-header">
        <h3>Pesquisas de Egressos</h3>
        {(role === 'master' || role === 'gestor') && (
          <button className="alumni-btn-primary" onClick={() => setShowCreate(!showCreate)}>
            + Nova Pesquisa
          </button>
        )}
      </div>

      {showCreate && (
        <div className="alumni-create-form">
          <input type="text" placeholder="Título da pesquisa" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <select value={newWave} onChange={e => setNewWave(e.target.value)}>
            {Object.entries(WAVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={newCourse} onChange={e => setNewCourse(e.target.value)}>
            <option value="">Institucional (todos os cursos)</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="alumni-form-actions">
            <button className="alumni-btn-primary" onClick={handleCreate}>Criar</button>
            <button className="alumni-btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {surveys.length === 0 ? (
        <div className="alumni-empty">
          <p>Nenhuma pesquisa criada ainda.</p>
          <p>Crie uma pesquisa para iniciar o acompanhamento de egressos. Ondas sugeridas: na conclusão, 6, 12 e 24 meses.</p>
        </div>
      ) : (
        <div className="alumni-table-wrapper">
          <table className="alumni-table">
            <thead>
              <tr><th>Pesquisa</th><th>Onda</th><th>Versão</th><th>Curso</th><th>Status</th><th>Período</th></tr>
            </thead>
            <tbody>
              {surveys.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.title}</strong></td>
                  <td>{WAVE_LABELS[s.wave_type] ?? s.wave_type}</td>
                  <td>v{s.version}</td>
                  <td>{s.course_id ? courses.find(c => c.id === s.course_id)?.name ?? '—' : 'Institucional'}</td>
                  <td>
                    <span className="alumni-status-pill" style={{ background: STATUS_COLORS[s.status] ?? '#6b7280' }}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.opens_at ? new Date(s.opens_at).toLocaleDateString('pt-BR') : '—'}
                    {' → '}
                    {s.closes_at ? new Date(s.closes_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="alumni-info-box">
        <strong>Ondas de acompanhamento sugeridas:</strong> Na conclusão, 6 meses, 12 meses e 24 meses.
        A periodicidade é configurável por IES. Pesquisas com status "teste" permitem validação sem envio real.
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* §6 — INDICADORES                                              */
/* ══════════════════════════════════════════════════════════════ */

function IndicadoresSection({ institutionId, courses }: {
  institutionId: string; courses: Props['courses'];
}) {
  const [surveyInd, setSurveyInd] = useState<SurveyIndicators[]>([]);
  const [trajInd, setTrajInd] = useState<TrajectoryIndicators[]>([]);
  const [catalog, setCatalog] = useState<IndicatorCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchSurveyIndicators(institutionId),
      fetchTrajectoryIndicators(institutionId),
      fetchIndicatorCatalog(),
    ]).then(([si, ti, cat]) => {
      setSurveyInd(si);
      setTrajInd(ti);
      setCatalog(cat);
    }).finally(() => setLoading(false));
  }, [institutionId]);

  // Totalizar trajetória por IES
  const trajTotal = useMemo(() => {
    const t: TrajectoryIndicators = {
      institution_id: institutionId, total_egressos: 0, respostas_trabalho: 0,
      em_atividade: 0, desempregados: 0, desempregados_buscando: 0,
      responderam_aderencia: 0, area_ou_correlata: 0,
      respostas_estudos_validas: 0, respostas_ambas: 0, trabalha_ou_estuda: 0,
    };
    for (const r of trajInd) {
      t.total_egressos += r.total_egressos;
      t.respostas_trabalho += r.respostas_trabalho;
      t.em_atividade += r.em_atividade;
      t.desempregados += r.desempregados;
      t.desempregados_buscando += r.desempregados_buscando;
      t.responderam_aderencia += r.responderam_aderencia;
      t.area_ou_correlata += r.area_ou_correlata;
      t.respostas_estudos_validas += r.respostas_estudos_validas;
      t.respostas_ambas += r.respostas_ambas;
      t.trabalha_ou_estuda += r.trabalha_ou_estuda;
    }
    return t;
  }, [trajInd, institutionId]);

  if (loading) return <p className="alumni-loading">Calculando indicadores…</p>;

  return (
    <section className="alumni-indicadores">
      <div className="alumni-section-header">
        <h3>Indicadores de Egressos</h3>
        <button className="alumni-btn-secondary" onClick={() => setShowCatalog(!showCatalog)}>
          {showCatalog ? 'Ocultar catálogo' : '📖 Catálogo de indicadores'}
        </button>
      </div>

      {/* Indicadores de participação por pesquisa */}
      {surveyInd.length > 0 && (
        <>
          <h4 className="alumni-ind-subtitle">Participação nas Pesquisas</h4>
          <div className="alumni-table-wrapper">
            <table className="alumni-table">
              <thead>
                <tr>
                  <th>Pesquisa</th><th>Onda</th>
                  <th style={{textAlign:'right'}}>Elegíveis</th>
                  <th style={{textAlign:'right'}}>Convidados</th>
                  <th style={{textAlign:'right'}}>Entregas</th>
                  <th style={{textAlign:'right'}}>Respondentes</th>
                  <th style={{textAlign:'right'}}>% Elegíveis</th>
                  <th style={{textAlign:'right'}}>% Convidados</th>
                  <th style={{textAlign:'right'}}>% Entregas</th>
                </tr>
              </thead>
              <tbody>
                {surveyInd.map(si => (
                  <tr key={si.survey_id}>
                    <td>{si.survey_title}</td>
                    <td>{si.wave_type}</td>
                    <td style={{textAlign:'right'}}>{si.total_eligible}</td>
                    <td style={{textAlign:'right'}}>{si.total_invited}</td>
                    <td style={{textAlign:'right'}}>{si.total_delivered}</td>
                    <td style={{textAlign:'right'}}><strong>{si.total_respondents}</strong></td>
                    <td style={{textAlign:'right'}}>{si.pct_eligible != null ? si.pct_eligible + '%' : 'N/D'}</td>
                    <td style={{textAlign:'right'}}>{si.pct_invited != null ? si.pct_invited + '%' : 'N/D'}</td>
                    <td style={{textAlign:'right'}}>{si.pct_delivered != null ? si.pct_delivered + '%' : 'N/D'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Indicadores de trajetória */}
      <h4 className="alumni-ind-subtitle">Trajetória Profissional e Acadêmica</h4>
      {trajInd.length === 0 ? (
        <div className="alumni-empty">
          <p>Sem dados de trajetória. Importe a base ou aplique a pesquisa para gerar indicadores.</p>
        </div>
      ) : (
        <>
          <div className="alumni-kpis">
            <IndicatorCard
              label="Em Atividade Remunerada"
              ratio={safeRatio(trajTotal.em_atividade, trajTotal.respostas_trabalho)}
              pct={safePercent(trajTotal.em_atividade, trajTotal.respostas_trabalho)}
              color="var(--vx-success, #16a34a)"
              note={`${trajTotal.respostas_trabalho} respostas válidas`}
            />
            <IndicatorCard
              label="Aderência à Área"
              ratio={safeRatio(trajTotal.area_ou_correlata, trajTotal.responderam_aderencia)}
              pct={safePercent(trajTotal.area_ou_correlata, trajTotal.responderam_aderencia)}
              color="var(--vx-accent, #2563eb)"
              note={`${trajTotal.responderam_aderencia} responderam`}
            />
            <IndicatorCard
              label="Formação Continuada"
              ratio={safeRatio(trajTotal.respostas_estudos_validas, trajTotal.total_egressos)}
              pct={safePercent(trajTotal.respostas_estudos_validas, trajTotal.total_egressos)}
              color="var(--vx-info, #7c3aed)"
              note={`sobre ${trajTotal.total_egressos} egressos`}
            />
            <IndicatorCard
              label="Trabalho ou Estudo"
              ratio={safeRatio(trajTotal.trabalha_ou_estuda, trajTotal.respostas_ambas)}
              pct={safePercent(trajTotal.trabalha_ou_estuda, trajTotal.respostas_ambas)}
              color="var(--vx-warning, #d97706)"
              note={`${trajTotal.respostas_ambas} com ambas as info`}
            />
          </div>

          {/* Desagregado por curso */}
          {trajInd.length > 1 && (
            <div className="alumni-table-wrapper">
              <table className="alumni-table alumni-table-compact">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th style={{textAlign:'right'}}>Egressos</th>
                    <th style={{textAlign:'right'}}>Atividade</th>
                    <th style={{textAlign:'right'}}>Aderência</th>
                    <th style={{textAlign:'right'}}>Estudos</th>
                    <th style={{textAlign:'right'}}>Trab. ou Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {trajInd.map(ti => (
                    <tr key={ti.course_id ?? 'all'}>
                      <td>{courses.find(c => c.id === ti.course_id)?.name ?? 'Todos'}</td>
                      <td style={{textAlign:'right'}}>{ti.total_egressos}</td>
                      <td style={{textAlign:'right'}}>{safePercent(ti.em_atividade, ti.respostas_trabalho) ?? 'N/D'}</td>
                      <td style={{textAlign:'right'}}>{safePercent(ti.area_ou_correlata, ti.responderam_aderencia) ?? 'N/D'}</td>
                      <td style={{textAlign:'right'}}>{safePercent(ti.respostas_estudos_validas, ti.total_egressos) ?? 'N/D'}</td>
                      <td style={{textAlign:'right'}}>{safePercent(ti.trabalha_ou_estuda, ti.respostas_ambas) ?? 'N/D'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Catálogo de indicadores */}
      {showCatalog && (
        <div className="alumni-catalog">
          <h4>Catálogo de Indicadores</h4>
          <p className="alumni-hint">Cada indicador possui nome, fórmula, numerador, denominador, fonte e limitações (§6).</p>
          {catalog.map(ind => (
            <div key={ind.id} className="alumni-catalog-card">
              <div className="alumni-catalog-header">
                <strong>{ind.name}</strong>
                <code>{ind.code}</code>
              </div>
              <p>{ind.description}</p>
              <div className="alumni-catalog-formula">
                <span><strong>Fórmula:</strong> {ind.formula}</span>
                <span><strong>Numerador:</strong> {ind.numerator_desc}</span>
                <span><strong>Denominador:</strong> {ind.denominator_desc}</span>
                {ind.limitations && <span className="alumni-catalog-limit">⚠ {ind.limitations}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="alumni-info-box alumni-info-box-warn">
        <strong>Notas metodológicas:</strong> Pesquisa voluntária — não probabilística.
        Percentuais com bases diferentes não são somáveis.
        Denominador zero = "não disponível", não 0%.
        Faixas de renda não permitem cálculo de mediana exata.
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* §4.7 — CPA / GOVERNANÇA                                      */
/* ══════════════════════════════════════════════════════════════ */

function CpaSection({ institutionId, role }: { institutionId: string; role: string }) {
  const [findings, setFindings] = useState<AlumniFinding[]>([]);
  const [actions, setActions] = useState<AlumniAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFinding, setShowNewFinding] = useState(false);
  const [newFinding, setNewFinding] = useState({ title: '', description: '', finding_type: 'atencao', indicator_key: '', instrument_ref: '' });

  useEffect(() => {
    Promise.all([
      fetchFindings(institutionId),
      fetchActions(institutionId),
    ]).then(([f, a]) => { setFindings(f); setActions(a); }).finally(() => setLoading(false));
  }, [institutionId]);

  const handleCreateFinding = async () => {
    if (!newFinding.title.trim()) return;
    try {
      const f = await createFinding({
        institution_id: institutionId,
        ...newFinding,
      });
      setFindings(prev => [f, ...prev]);
      setShowNewFinding(false);
      setNewFinding({ title: '', description: '', finding_type: 'atencao', indicator_key: '', instrument_ref: '' });
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleCreateAction = async (findingId: string) => {
    const title = prompt('Título da ação de melhoria:');
    if (!title) return;
    const responsible = prompt('Responsável:') ?? '';
    try {
      const a = await createAction({
        finding_id: findingId,
        institution_id: institutionId,
        title,
        responsible,
        status: 'planejada',
      });
      setActions(prev => [a, ...prev]);
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleUpdateAction = async (actionId: string, newStatus: string) => {
    try {
      await updateActionStatus(actionId, newStatus);
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a));
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const FINDING_TYPES: Record<string, { label: string; color: string }> = {
    positivo: { label: 'Positivo', color: '#16a34a' },
    atencao: { label: 'Atenção', color: '#d97706' },
    critico: { label: 'Crítico', color: '#dc2626' },
    oportunidade: { label: 'Oportunidade', color: '#2563eb' },
    neutro: { label: 'Neutro', color: '#6b7280' },
  };

  const ACTION_FLOW = ['planejada', 'em_execucao', 'executada', 'avaliada'];

  if (loading) return <p className="alumni-loading">Carregando governança…</p>;

  // KPIs
  const totalFindings = findings.length;
  const totalActions = actions.length;
  const actionsWithEvidence = actions.filter(a => a.status === 'executada' || a.status === 'avaliada').length;
  const actionsApproved = actions.filter(a => a.status !== 'planejada' && a.status !== 'cancelada').length;

  return (
    <section className="alumni-cpa">
      <div className="alumni-section-header">
        <h3>Governança CPA — Egressos</h3>
        {(role === 'master' || role === 'gestor') && (
          <button className="alumni-btn-primary" onClick={() => setShowNewFinding(!showNewFinding)}>
            + Novo Achado
          </button>
        )}
      </div>

      <p className="alumni-hint">
        Fluxo: Política → Pesquisa → Resultado → Achado → Deliberação → Ação → Evidência → Avaliação (§4.7)
      </p>

      <div className="alumni-kpis">
        <KpiCard label="Achados" value={totalFindings} color="var(--vx-accent, #2563eb)" />
        <KpiCard label="Ações de Melhoria" value={totalActions} color="var(--vx-warning, #d97706)" />
        <KpiCard label="Com Evidência" value={actionsWithEvidence}
          pct={actionsApproved > 0 ? Math.round(100 * actionsWithEvidence / actionsApproved) : 0}
          color="var(--vx-success, #16a34a)" />
      </div>

      {showNewFinding && (
        <div className="alumni-create-form">
          <input type="text" placeholder="Título do achado" value={newFinding.title} onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))} />
          <textarea placeholder="Descrição" value={newFinding.description} onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))} rows={3} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={newFinding.finding_type} onChange={e => setNewFinding(p => ({ ...p, finding_type: e.target.value }))}>
              {Object.entries(FINDING_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="text" placeholder="Indicador (ex: IND_ATIV_REMUNERADA)" value={newFinding.indicator_key} onChange={e => setNewFinding(p => ({ ...p, indicator_key: e.target.value }))} />
            <input type="text" placeholder="Ref. instrumento (ex: 3.7)" value={newFinding.instrument_ref} onChange={e => setNewFinding(p => ({ ...p, instrument_ref: e.target.value }))} />
          </div>
          <div className="alumni-form-actions">
            <button className="alumni-btn-primary" onClick={handleCreateFinding}>Registrar achado</button>
            <button className="alumni-btn-secondary" onClick={() => setShowNewFinding(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Achados e ações */}
      {findings.length === 0 ? (
        <div className="alumni-empty">
          <p>Nenhum achado registrado.</p>
          <p>Aplique pesquisas, analise os indicadores e registre achados para iniciar o ciclo de melhoria.</p>
        </div>
      ) : (
        <div className="alumni-findings-list">
          {findings.map(f => {
            const ft = FINDING_TYPES[f.finding_type] ?? FINDING_TYPES.neutro;
            const relatedActions = actions.filter(a => a.finding_id === f.id);
            return (
              <div key={f.id} className="alumni-finding-card">
                <div className="alumni-finding-header">
                  <span className="alumni-finding-type" style={{ background: ft.color }}>{ft.label}</span>
                  <strong>{f.title}</strong>
                  {f.instrument_ref && <code className="alumni-finding-ref">INEP {f.instrument_ref}</code>}
                  <span className="alumni-finding-status">{f.status}</span>
                </div>
                {f.description && <p className="alumni-finding-desc">{f.description}</p>}
                {f.indicator_key && (
                  <span className="alumni-finding-indicator">
                    📊 {f.indicator_key}{f.indicator_value != null ? `: ${f.indicator_value}` : ''}
                    {f.indicator_target != null ? ` (meta: ${f.indicator_target})` : ''}
                  </span>
                )}

                {/* Ações vinculadas */}
                {relatedActions.length > 0 && (
                  <div className="alumni-actions-list">
                    {relatedActions.map(a => (
                      <div key={a.id} className="alumni-action-row">
                        <span className={`alumni-action-status ${a.status}`}>{a.status.replace('_', ' ')}</span>
                        <span className="alumni-action-title">{a.title}</span>
                        {a.responsible && <span className="alumni-action-resp">→ {a.responsible}</span>}
                        {a.due_date && <span className="alumni-action-date">até {new Date(a.due_date).toLocaleDateString('pt-BR')}</span>}
                        {a.evidence_url && <span className="alumni-action-evidence">📎</span>}
                        {(role === 'master' || role === 'gestor') && (
                          <select
                            value={a.status}
                            onChange={e => handleUpdateAction(a.id, e.target.value)}
                            className="alumni-action-select"
                          >
                            {ACTION_FLOW.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            <option value="cancelada">cancelada</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(role === 'master' || role === 'gestor') && (
                  <button className="alumni-btn-small" onClick={() => handleCreateAction(f.id)}>
                    + Ação de melhoria
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* COMPONENTES AUXILIARES                                         */
/* ══════════════════════════════════════════════════════════════ */

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

function IndicatorCard({ label, ratio, pct, color, note }: {
  label: string; ratio: string; pct: string | null; color: string; note?: string;
}) {
  return (
    <div className="alumni-kpi alumni-kpi-indicator" style={{ borderLeftColor: color }}>
      <span className="alumni-kpi-value">{pct ?? 'N/D'}</span>
      <span className="alumni-kpi-ratio">{ratio}</span>
      <span className="alumni-kpi-label">{label}</span>
      {note && <span className="alumni-kpi-note">{note}</span>}
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
              {emp.field_relation && (
                <span>Relação: {emp.field_relation === 'area_formacao' ? 'Área de formação' :
                  emp.field_relation === 'area_correlata' ? 'Área correlata' : 'Outra área'}</span>
              )}
              {emp.out_of_field_reason && <span className="alumni-hint">Motivo: {emp.out_of_field_reason}</span>}
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
