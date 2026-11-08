/**
 * BI do Reitor — Painel expandido com visão 360° da IES
 *
 * Seções: Visão Geral · Acadêmico · Captação · Compliance · Financeiro · Infraestrutura
 * Puxa dados de: enrollment_snapshots, eorbit (quantitativo, compliance, professores,
 * biblioteca, enade, vestibular), captacao (leads, custos, snapshots), academic_reports
 * (reprovações, fluxo, cohorts, course_indicators), goals, actions, diagnosis,
 * ebitda_calculations, repository.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Row } from '@/lib/area';
import { listByInstitution } from '@/lib/area';
import { TABLES } from '@/lib/area';
import { getKPIs, getSerieTemporal, getFunil, getComposicaoPorCurso, getCursosRisco, getAlertas, getSaudePeriodo, getHeatmap } from '@/lib/bi/queries';
import type { KpiResumo, SerieTemporal as STipo, EtapaFunil, FatiaCategoria, CursoRisco, Alerta, CelulaHeatmap, SaudeIndicador } from '@/lib/bi/types';
import { fmtInt, fmtPct, fmtBRL } from '@/lib/bi/format';
import { getResumoQuantitativo, getResumoCompliance, getProfessores, getEnade, getBibliotecaResumo, getVestibularEditais, getVestibularCursos } from '@/lib/eorbit/queries';
import type { ResumoQuantitativo, ResumoCompliance, Professor, Enade, BibliotecaResumo, VestibularEdital, VestibularCurso } from '@/lib/eorbit/types';
import { fetchReports, parseCohorts, resumirEvasao, parseProfReprova, parseDiscReprova, parseFluxo, parseCourseIndicators, agregarReprovaTipo, fetchCourseNames } from '@/lib/academico';
import type { EvasaoResumo, ProfReprova, DiscReprova, FluxoSemestre, ReprovaTipoSem } from '@/lib/academico';
import type { Institution, Course, Enrollment } from '@/components/InstitutionArea';
import { courseTotals, latestEnrollmentSnapshots } from '@/components/InstitutionArea';
import { listRepository } from '@/lib/repository-data';
import { isInstrumentRequest, latestInstrumentDocuments } from '@/lib/repository';
import './reitor-bi.css';

// ─── types ───
type Tab = 'geral' | 'academico' | 'captacao' | 'compliance' | 'financeiro' | 'infra';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'geral', label: 'Visão Geral', icon: '📊' },
  { key: 'academico', label: 'Acadêmico', icon: '🎓' },
  { key: 'captacao', label: 'Captação', icon: '📈' },
  { key: 'compliance', label: 'Compliance', icon: '✅' },
  { key: 'financeiro', label: 'Financeiro', icon: '💰' },
  { key: 'infra', label: 'Infraestrutura', icon: '📚' },
];

type DocStatus = { validado: number; analise: number; devolvido: number; pendente: number; na: number };

const fmt = new Intl.NumberFormat('pt-BR');
const fmtM = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function sparkSvg(data: number[], color = '#6554cf', w = 80, h = 28) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /></svg>;
}

function KPICard({ label, value, unit, delta, spark, direction, small }: {
  label: string; value: number | null; unit: 'qtd' | 'pct' | 'brl'; delta?: number | null;
  spark?: number[]; direction?: 'cima' | 'baixo'; small?: boolean;
}) {
  const display = value === null ? '—' : unit === 'pct' ? fmtPct(value) : unit === 'brl' ? fmtBRL(value) : fmtInt(value);
  const good = delta !== null && delta !== undefined ? (direction === 'baixo' ? delta < 0 : delta > 0) : null;
  return (
    <div className={`rbi-kpi ${small ? 'rbi-kpi-sm' : ''}`}>
      <span className="rbi-kpi-label">{label}</span>
      <span className="rbi-kpi-value">{display}</span>
      {delta !== null && delta !== undefined && (
        <span className={`rbi-kpi-delta ${good ? 'rbi-up' : 'rbi-down'}`}>
          {good ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </span>
      )}
      {spark && spark.length > 1 && <div className="rbi-kpi-spark">{sparkSvg(spark, good === null ? '#6554cf' : good ? '#168878' : '#d76d34')}</div>}
    </div>
  );
}

function Donut({ data, colors, size = 160 }: { data: { label: string; value: number }[]; colors: string[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="rbi-empty">Sem dados</p>;
  const r = size * 0.35;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="rbi-donut">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#edf0f7" strokeWidth={size * 0.15} />
      {data.map((d, i) => {
        const pct = (d.value / total) * 100;
        const start = offset;
        offset += pct;
        return (
          <circle key={d.label} cx={size / 2} cy={size / 2} r={r} pathLength="100" fill="none"
            stroke={colors[i % colors.length]} strokeWidth={size * 0.15}
            strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-start}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <title>{d.label}: {fmt.format(d.value)} ({(pct).toFixed(1)}%)</title>
          </circle>
        );
      })}
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.15} fontWeight="700" fill="currentColor">{fmt.format(total)}</text>
    </svg>
  );
}

function BarH({ data, colors, max: maxProp }: { data: { label: string; value: number }[]; colors: string[]; max?: number }) {
  const max = maxProp ?? Math.max(...data.map(d => d.value), 1);
  return (
    <div className="rbi-barh">
      {data.map((d, i) => (
        <div key={d.label} className="rbi-barh-row">
          <span className="rbi-barh-label">{d.label}</span>
          <div className="rbi-barh-track">
            <div className="rbi-barh-fill" style={{ width: `${(d.value / max) * 100}%`, background: colors[i % colors.length] }} />
          </div>
          <span className="rbi-barh-val">{fmt.format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="rbi-table-wrap">
      <table className="rbi-table">
        <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{typeof cell === 'number' ? fmt.format(cell) : cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function SectionCard({ title, children, span }: { title: string; children: React.ReactNode; span?: boolean }) {
  return <article className={`rbi-card ${span ? 'rbi-span' : ''}`}><h3>{title}</h3>{children}</article>;
}

const PALETTE = ['#6554cf', '#168878', '#d76d34', '#377acf', '#c0447f', '#82720b', '#39714b', '#a84f32', '#2d7d9a', '#8b5a2b'];

// ─── main component ───
export default function ReitorBI({ institutions, courses, enrollments, session, reports: initialReports }: {
  institutions: Institution[]; courses: Course[]; enrollments: Enrollment[];
  session: Session; reports: Row[];
}) {
  const [instId, setInstId] = useState(institutions[0]?.id ?? '');
  const [tab, setTab] = useState<Tab>('geral');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const panel = useRef<HTMLElement>(null);

  // ─── data state ───
  const [kpis, setKpis] = useState<KpiResumo[]>([]);
  const [serie, setSerie] = useState<STipo | null>(null);
  const [funil, setFunil] = useState<EtapaFunil[]>([]);
  const [composicao, setComposicao] = useState<FatiaCategoria[]>([]);
  const [risco, setRisco] = useState<CursoRisco[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [saude, setSaude] = useState<SaudeIndicador[]>([]);
  const [heatmap, setHeatmap] = useState<CelulaHeatmap[]>([]);

  // academic
  const [quantitativo, setQuantitativo] = useState<ResumoQuantitativo | null>(null);
  const [evasao, setEvasao] = useState<EvasaoResumo | null>(null);
  const [topProfs, setTopProfs] = useState<ProfReprova[]>([]);
  const [topDiscs, setTopDiscs] = useState<DiscReprova[]>([]);
  const [fluxo, setFluxo] = useState<FluxoSemestre[]>([]);
  const [reprovaTipo, setReprovaTipo] = useState<{ porSemestre: ReprovaTipoSem[]; totalRf: number; totalRn: number; totalRa: number } | null>(null);

  // compliance
  const [compliance, setCompliance] = useState<ResumoCompliance | null>(null);

  // infra
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [enade, setEnade] = useState<Enade[]>([]);
  const [biblioteca, setBiblioteca] = useState<BibliotecaResumo | null>(null);
  const [vestibular, setVestibular] = useState<VestibularEdital[]>([]);
  const [vestCursos, setVestCursos] = useState<VestibularCurso[]>([]);

  // management
  const [goals, setGoals] = useState<Row[]>([]);
  const [actions, setActions] = useState<Row[]>([]);
  const [diagnosis, setDiagnosis] = useState<Row[]>([]);
  const [docStatus, setDocStatus] = useState<DocStatus>({ validado: 0, analise: 0, devolvido: 0, pendente: 0, na: 0 });

  // ebitda
  const [ebitdaCalcs, setEbitdaCalcs] = useState<Row[]>([]);

  const filtro = { instituicaoId: instId };

  const loadData = useCallback(async () => {
    if (!instId) return;
    setLoading(true);
    try {
      const [k, s, f, comp, risk, al, sau, hm] = await Promise.all([
        getKPIs(filtro), getSerieTemporal(filtro), getFunil(filtro),
        getComposicaoPorCurso(filtro), getCursosRisco(filtro),
        getAlertas(filtro), getSaudePeriodo(filtro), getHeatmap(filtro),
      ]);
      setKpis(k); setSerie(s); setFunil(f); setComposicao(comp);
      setRisco(risk); setAlertas(al); setSaude(sau); setHeatmap(hm);

      // academic reports
      const courseNames = await fetchCourseNames(instId);
      const [cohortRep, profRep, discRep, fluxoRep, indRep] = await Promise.all([
        fetchReports(instId, ['cohorts']),
        fetchReports(instId, ['reprovacoes_professor']),
        fetchReports(instId, ['reprovacoes_disciplina']),
        fetchReports(instId, ['fluxo_academico']),
        fetchReports(instId, ['course_indicators']),
      ]);
      const cohortData = parseCohorts(cohortRep);
      if (cohortData) setEvasao(resumirEvasao(cohortData.coortes));
      setTopProfs(parseProfReprova(profRep).slice(0, 10));
      setTopDiscs(parseDiscReprova(discRep).slice(0, 10));
      setFluxo(parseFluxo(fluxoRep));
      const indicators = parseCourseIndicators(indRep, courseNames);
      setReprovaTipo(agregarReprovaTipo(indicators));

      // eorbit
      const [quant, compl, profs, en, bib, vest, vc] = await Promise.all([
        getResumoQuantitativo(instId, null).catch(() => null),
        getResumoCompliance(instId, null).catch(() => null),
        getProfessores(instId).catch(() => []),
        getEnade(instId).catch(() => []),
        getBibliotecaResumo(instId).catch(() => null),
        getVestibularEditais(instId).catch(() => []),
        getVestibularCursos(instId).catch(() => []),
      ]);
      setQuantitativo(quant); setCompliance(compl); setProfessores(profs);
      setEnade(en); setBiblioteca(bib); setVestibular(vest); setVestCursos(vc);

      // management
      const [g, a, d] = await Promise.all([
        listByInstitution(TABLES.goals, instId),
        listByInstitution(TABLES.actions, instId),
        listByInstitution(TABLES.diagnosis, instId),
      ]);
      setGoals(g); setActions(a); setDiagnosis(d);

      // docs
      const [reqs, files] = await Promise.all([
        listRepository('vertice_repository_requests', instId),
        listRepository('vertice_repository_files', instId),
      ]);
      const latest = latestInstrumentDocuments(files);
      const instrumentReqs = reqs.filter(r => r.active !== false && isInstrumentRequest(r));
      const ds: DocStatus = { validado: 0, analise: 0, devolvido: 0, pendente: 0, na: 0 };
      for (const r of instrumentReqs) {
        const status = r.not_applicable === true ? 'na' : (latest.get(r.id)?.status as string) ?? 'pendente';
        if (status === 'validado') ds.validado++;
        else if (status === 'enviado') ds.analise++;
        else if (status === 'devolvido') ds.devolvido++;
        else if (status === 'na' || r.not_applicable) ds.na++;
        else ds.pendente++;
      }
      setDocStatus(ds);

      // ebitda
      const { data: ebitda } = await supabase.from('vertice_ebitda_calculations')
        .select('id,name,created_at,result').eq('institution_id', instId).order('created_at', { ascending: false }).limit(5);
      setEbitdaCalcs((ebitda ?? []) as Row[]);
    } catch (err) {
      console.error('ReitorBI load error', err);
    } finally {
      setLoading(false);
    }
  }, [instId]);

  useEffect(() => { loadData(); }, [loadData, tick]);

  const own = courses.filter(c => c.institution_id === instId);
  const kpi = (key: string) => kpis.find(k => k.chave === key);

  // professor titulação
  const titulacao = (() => {
    const m = new Map<string, number>();
    for (const p of professores) {
      const t = p.titulacao || 'Não informada';
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();

  // goal status
  const goalStatus = (() => {
    const m = new Map<string, number>();
    const labels: Record<string, string> = { ativa: 'Ativa', planejada: 'Planejada', concluida: 'Concluída', cancelada: 'Cancelada' };
    for (const g of goals) { const s = labels[String(g.status)] ?? String(g.status); m.set(s, (m.get(s) ?? 0) + 1); }
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  })();

  // action status
  const lateActions = actions.filter(a => {
    if (a.status === 'concluida' || a.status === 'cancelada') return false;
    return a.due_date && new Date(String(a.due_date)) < new Date();
  });

  // diagnosis priority
  const diagOpen = diagnosis.filter(d => d.status !== 'resolvido');
  const diagByPriority = (() => {
    const m = new Map<string, number>();
    const labels: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
    for (const d of diagOpen) { const p = labels[String(d.priority)] ?? 'Sem prioridade'; m.set(p, (m.get(p) ?? 0) + 1); }
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  })();

  // ─── render sections ───
  function renderGeral() {
    return <>
      {/* KPI strip */}
      <div className="rbi-kpi-strip">
        <KPICard label="Matriculados" value={kpi('matriculados')?.valor ?? null} unit="qtd" delta={kpi('matriculados')?.variacaoPct} spark={kpi('matriculados')?.tendencia} direction="cima" />
        <KPICard label="Ocupação" value={kpi('ocupacao')?.valor ?? null} unit="pct" direction="cima" />
        <KPICard label="Evasão" value={kpi('evasao')?.valor ?? null} unit="pct" direction="baixo" />
        <KPICard label="Retenção" value={kpi('retencao')?.valor ?? null} unit="pct" direction="cima" />
        <KPICard label="Conversão" value={kpi('conversao')?.valor ?? null} unit="pct" spark={kpi('conversao')?.tendencia} direction="cima" />
        <KPICard label="CAC" value={kpi('cac')?.valor ?? null} unit="brl" direction="baixo" />
        <KPICard label="Metas" value={kpi('metas')?.valor ?? null} unit="pct" direction="cima" />
      </div>

      <div className="rbi-grid">
        {/* Série temporal */}
        <SectionCard title="Matrículas por Semestre">
          {serie && serie.pontos.length > 1 ? (
            <svg viewBox="0 0 400 160" className="rbi-line-chart">
              {(() => {
                const pts = serie.pontos;
                const max = Math.max(...pts.map(p => p.valor), 1);
                const min = Math.min(...pts.map(p => p.valor), 0);
                const range = max - min || 1;
                const px = (i: number) => 40 + (i / (pts.length - 1 || 1)) * 340;
                const py = (v: number) => 10 + (1 - (v - min) / range) * 130;
                const line = pts.map((p, i) => `${px(i)},${py(p.valor)}`).join(' ');
                return <>
                  <polyline points={line} fill="none" stroke="#6554cf" strokeWidth="2.5" strokeLinejoin="round" />
                  {pts.map((p, i) => <g key={i}>
                    <circle cx={px(i)} cy={py(p.valor)} r="4" fill="#6554cf" />
                    <text x={px(i)} y={py(p.valor) - 10} textAnchor="middle" fontSize="10" fill="currentColor">{fmt.format(p.valor)}</text>
                    <text x={px(i)} y="155" textAnchor="middle" fontSize="9" fill="#757a80">{p.data}</text>
                  </g>)}
                </>;
              })()}
            </svg>
          ) : <p className="rbi-empty">Dados insuficientes</p>}
        </SectionCard>

        {/* Composição por curso */}
        <SectionCard title="Matrículas por Curso">
          <Donut data={composicao.map(c => ({ label: c.rotulo, value: c.valor }))} colors={PALETTE} />
          <div className="rbi-legend">
            {composicao.slice(0, 8).map((c, i) => <span key={c.chave}><i style={{ background: PALETTE[i % PALETTE.length] }} />{c.rotulo} · {fmt.format(c.valor)}</span>)}
          </div>
        </SectionCard>

        {/* Metas */}
        <SectionCard title="Metas Institucionais">
          <Donut data={goalStatus} colors={['#168878', '#6554cf', '#377acf', '#999']} />
          <div className="rbi-legend">
            {goalStatus.map((s, i) => <span key={s.label}><i style={{ background: ['#168878', '#6554cf', '#377acf', '#999'][i] }} />{s.label} · {s.value}</span>)}
          </div>
        </SectionCard>

        {/* Documentação */}
        <SectionCard title="Documentação Regulatória">
          <Donut data={[
            { label: 'Validado', value: docStatus.validado },
            { label: 'Em análise', value: docStatus.analise },
            { label: 'Devolvido', value: docStatus.devolvido },
            { label: 'Pendente', value: docStatus.pendente },
            { label: 'N/A', value: docStatus.na },
          ].filter(d => d.value > 0)} colors={['#168878', '#377acf', '#d76d34', '#c0447f', '#999']} />
        </SectionCard>

        {/* Alertas */}
        <SectionCard title="Alertas">
          {alertas.length ? (
            <ul className="rbi-alerts">
              {alertas.slice(0, 8).map((a, i) => (
                <li key={i} className={`rbi-alert rbi-alert-${a.severidade}`}>
                  <strong>{a.titulo}</strong>
                  <span>{a.descricao}</span>
                </li>
              ))}
            </ul>
          ) : <p className="rbi-empty">Nenhum alerta no momento</p>}
        </SectionCard>

        {/* Ações atrasadas */}
        <SectionCard title="Ações Atrasadas">
          {lateActions.length ? (
            <MiniTable headers={['Ação', 'Prazo', 'Status']} rows={lateActions.slice(0, 8).map(a => [
              String(a.title ?? a.name ?? '—'),
              a.due_date ? new Date(String(a.due_date)).toLocaleDateString('pt-BR') : '—',
              String(a.status ?? '—'),
            ])} />
          ) : <p className="rbi-good">✓ Nenhuma ação atrasada</p>}
        </SectionCard>

        {/* Achados abertos */}
        <SectionCard title="Achados por Prioridade">
          {diagByPriority.length ? (
            <BarH data={diagByPriority} colors={['#c0447f', '#d76d34', '#377acf']} />
          ) : <p className="rbi-good">✓ Sem achados em aberto</p>}
        </SectionCard>

        {/* Cursos em risco */}
        <SectionCard title="Cursos em Risco">
          {risco.length ? (
            <MiniTable headers={['Curso', 'Ocupação', 'Matriculados', 'Vagas']} rows={risco.slice(0, 8).map(r => [
              r.nome, fmtPct(r.ocupacaoPct), r.matriculados, r.vagas,
            ])} />
          ) : <p className="rbi-good">✓ Todos os cursos acima do limiar</p>}
        </SectionCard>
      </div>
    </>;
  }

  function renderAcademico() {
    return <div className="rbi-grid">
      {/* Quantitativo */}
      <SectionCard title="Quantitativo Geral">
        {quantitativo ? <>
          <div className="rbi-kpi-strip rbi-kpi-strip-sm">
            <KPICard label="Vínculos" value={quantitativo.total_vinculos} unit="qtd" small />
            <KPICard label="Matriculados" value={quantitativo.total_matriculados} unit="qtd" small />
            <KPICard label="Turmas" value={quantitativo.total_turmas} unit="qtd" small />
            <KPICard label="Cursos" value={quantitativo.total_cursos} unit="qtd" small />
          </div>
        </> : <p className="rbi-empty">Sem dados do e-Orbit</p>}
      </SectionCard>

      {/* Fluxo acadêmico */}
      <SectionCard title="Fluxo Acadêmico" span>
        {fluxo.length ? (
          <MiniTable headers={['Semestre', 'Matr.', 'Tranc.', 'Aband.', 'Concl.', 'Transf.', 'Cancel.']}
            rows={fluxo.slice(0, 8).map(f => [f.semestre, f.matriculados, f.trancados, f.abandono, f.concluidos, f.transferidos, f.cancelados])} />
        ) : <p className="rbi-empty">Sem relatórios de fluxo</p>}
      </SectionCard>

      {/* Evasão */}
      <SectionCard title="Evasão por Coorte">
        {evasao ? <>
          <div className="rbi-kpi-strip rbi-kpi-strip-sm">
            <KPICard label="Evasão Média" value={evasao.evasaoMedia} unit="pct" direction="baixo" small />
            <KPICard label="Retenção Média" value={evasao.retencaoMedia} unit="pct" direction="cima" small />
            <KPICard label="Coortes" value={evasao.totalCoortes} unit="qtd" small />
          </div>
        </> : <p className="rbi-empty">Sem dados de coortes</p>}
      </SectionCard>

      {/* Reprovações por tipo */}
      <SectionCard title="Reprovações por Tipo">
        {reprovaTipo && reprovaTipo.porSemestre.length ? <>
          <div className="rbi-kpi-strip rbi-kpi-strip-sm">
            <KPICard label="RF (Falta)" value={reprovaTipo.totalRf} unit="qtd" small />
            <KPICard label="RN (Nota)" value={reprovaTipo.totalRn} unit="qtd" small />
            <KPICard label="RA (Abando)" value={reprovaTipo.totalRa} unit="qtd" small />
          </div>
          <MiniTable headers={['Semestre', 'RF', 'RN', 'RA', 'Total']}
            rows={reprovaTipo.porSemestre.slice(0, 6).map(r => [r.semestre, r.rf, r.rn, r.ra, r.total])} />
        </> : <p className="rbi-empty">Sem dados de reprovação</p>}
      </SectionCard>

      {/* Top professores com reprovação */}
      <SectionCard title="Top 10 Professores — Reprovação">
        {topProfs.length ? (
          <BarH data={topProfs.map(p => ({ label: p.professor, value: p.total }))} colors={PALETTE} />
        ) : <p className="rbi-empty">Sem dados</p>}
      </SectionCard>

      {/* Top disciplinas com reprovação */}
      <SectionCard title="Top 10 Disciplinas — Reprovação">
        {topDiscs.length ? (
          <BarH data={topDiscs.map(d => ({ label: d.disciplina, value: d.total }))} colors={PALETTE} />
        ) : <p className="rbi-empty">Sem dados</p>}
      </SectionCard>

      {/* Saúde do período */}
      <SectionCard title="Saúde do Período" span>
        {saude.length ? (
          <div className="rbi-health-grid">
            {saude.map(s => (
              <div key={s.indicador} className={`rbi-health-item rbi-health-${s.status}`}>
                <span className="rbi-health-icon">{s.status === 'ok' ? '🟢' : s.status === 'atencao' ? '🟡' : '🔴'}</span>
                <span className="rbi-health-label">{s.indicador}</span>
                <span className="rbi-health-val">{typeof s.valor === 'number' ? fmt.format(s.valor) : s.valor}</span>
              </div>
            ))}
          </div>
        ) : <p className="rbi-empty">Sem indicadores de saúde</p>}
      </SectionCard>
    </div>;
  }

  function renderCaptacao() {
    return <div className="rbi-grid">
      {/* Funil */}
      <SectionCard title="Funil de Captação">
        {funil.length ? (
          <div className="rbi-funnel">
            {funil.map((e, i) => {
              const maxVol = Math.max(...funil.map(f => f.volume), 1);
              return (
                <div key={e.etapa} className="rbi-funnel-step">
                  <div className="rbi-funnel-bar" style={{ width: `${(e.volume / maxVol) * 100}%`, background: PALETTE[i] }}>
                    <span>{e.etapa}</span>
                  </div>
                  <span className="rbi-funnel-val">{fmt.format(e.volume)}{e.conversaoPct !== null ? ` · ${e.conversaoPct.toFixed(1)}%` : ''}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="rbi-empty">Sem dados de captação</p>}
      </SectionCard>

      {/* KPIs captação */}
      <SectionCard title="Indicadores de Captação">
        <div className="rbi-kpi-strip rbi-kpi-strip-sm">
          <KPICard label="Conversão" value={kpi('conversao')?.valor ?? null} unit="pct" direction="cima" small />
          <KPICard label="CAC" value={kpi('cac')?.valor ?? null} unit="brl" direction="baixo" small />
        </div>
      </SectionCard>

      {/* Vestibular */}
      <SectionCard title="Editais de Vestibular">
        {vestibular.length ? (
          <MiniTable headers={['Edital', 'Ano', 'Status']}
            rows={vestibular.slice(0, 8).map(v => [String(v.descricao ?? v.codigo ?? '—'), String(v.ano ?? '—'), String(v.status ?? '—')])} />
        ) : <p className="rbi-empty">Sem editais</p>}
      </SectionCard>

      {/* Vagas por curso */}
      <SectionCard title="Vagas por Curso (Vestibular)">
        {vestCursos.length ? (
          <BarH data={vestCursos.slice(0, 10).map(v => ({ label: String(v.nome_curso ?? v.curso_id ?? '—'), value: Number(v.vagas ?? 0) }))} colors={PALETTE} />
        ) : <p className="rbi-empty">Sem dados</p>}
      </SectionCard>
    </div>;
  }

  function renderCompliance() {
    return <div className="rbi-grid">
      <SectionCard title="Resumo de Compliance">
        {compliance ? <>
          <div className="rbi-kpi-strip rbi-kpi-strip-sm">
            <KPICard label="Plano de Ensino" value={compliance.pctPlano} unit="pct" direction="cima" small />
            <KPICard label="Notas Lançadas" value={compliance.pctNotas} unit="pct" direction="cima" small />
          </div>
        </> : <p className="rbi-empty">Sem dados de compliance</p>}
      </SectionCard>

      <SectionCard title="ENADE — Habilitados">
        {enade.length ? (
          <MiniTable headers={['Curso', 'Habilitados', 'Ano']}
            rows={enade.slice(0, 10).map(e => [String(e.nome_curso ?? e.curso_id ?? '—'), Number(e.habilitados ?? 0), String(e.ano ?? '—')])} />
        ) : <p className="rbi-empty">Sem dados ENADE</p>}
      </SectionCard>

      {/* Documentação */}
      <SectionCard title="Documentação Regulatória">
        <Donut data={[
          { label: 'Validado', value: docStatus.validado },
          { label: 'Em análise', value: docStatus.analise },
          { label: 'Devolvido', value: docStatus.devolvido },
          { label: 'Pendente', value: docStatus.pendente },
        ].filter(d => d.value > 0)} colors={['#168878', '#377acf', '#d76d34', '#c0447f']} />
      </SectionCard>
    </div>;
  }

  function renderFinanceiro() {
    return <div className="rbi-grid">
      <SectionCard title="Cálculos EBITDA Salvos">
        {ebitdaCalcs.length ? (
          <MiniTable headers={['Nome', 'Data', 'EBITDA']}
            rows={ebitdaCalcs.map(e => [
              String(e.name ?? '—'),
              e.created_at ? new Date(String(e.created_at)).toLocaleDateString('pt-BR') : '—',
              e.result && typeof e.result === 'object' && 'ebitda' in (e.result as Record<string, unknown>)
                ? fmtM.format(Number((e.result as Record<string, unknown>).ebitda))
                : '—',
            ])} />
        ) : <p className="rbi-empty">Nenhum cálculo EBITDA salvo</p>}
      </SectionCard>

      {/* Heatmap */}
      <SectionCard title="Heatmap — Matrículas por Curso × Semestre" span>
        {heatmap.length ? (() => {
          const sems = [...new Set(heatmap.map(h => h.semestre))].sort();
          const cursos = [...new Set(heatmap.map(h => h.curso))];
          const max = Math.max(...heatmap.map(h => h.valor), 1);
          return (
            <div className="rbi-table-wrap">
              <table className="rbi-table rbi-heatmap">
                <thead><tr><th></th>{sems.map(s => <th key={s}>{s}</th>)}</tr></thead>
                <tbody>{cursos.map(c => <tr key={c}>
                  <td>{c}</td>
                  {sems.map(s => {
                    const cell = heatmap.find(h => h.semestre === s && h.curso === c);
                    const v = cell?.valor ?? 0;
                    const intensity = v / max;
                    return <td key={s} style={{ background: `rgba(101,84,207,${intensity * 0.8 + 0.05})`, color: intensity > 0.5 ? 'white' : 'inherit' }}>{v || ''}</td>;
                  })}
                </tr>)}</tbody>
              </table>
            </div>
          );
        })() : <p className="rbi-empty">Sem dados para heatmap</p>}
      </SectionCard>
    </div>;
  }

  function renderInfra() {
    return <div className="rbi-grid">
      <SectionCard title="Titulação Docente">
        {titulacao.length ? <>
          <Donut data={titulacao} colors={PALETTE} size={150} />
          <div className="rbi-legend">
            {titulacao.map((t, i) => <span key={t.label}><i style={{ background: PALETTE[i % PALETTE.length] }} />{t.label} · {t.value}</span>)}
          </div>
        </> : <p className="rbi-empty">Sem dados de professores</p>}
      </SectionCard>

      <SectionCard title="Professores">
        <div className="rbi-kpi-strip rbi-kpi-strip-sm">
          <KPICard label="Total" value={professores.length} unit="qtd" small />
          <KPICard label="Doutores" value={professores.filter(p => (p.titulacao ?? '').toLowerCase().includes('doutor')).length} unit="qtd" small />
          <KPICard label="Mestres" value={professores.filter(p => (p.titulacao ?? '').toLowerCase().includes('mestr')).length} unit="qtd" small />
        </div>
      </SectionCard>

      <SectionCard title="Biblioteca">
        {biblioteca ? <>
          <div className="rbi-kpi-strip rbi-kpi-strip-sm">
            <KPICard label="Títulos" value={biblioteca.titulos} unit="qtd" small />
            <KPICard label="Exemplares" value={biblioteca.exemplares} unit="qtd" small />
          </div>
        </> : <p className="rbi-empty">Sem dados de biblioteca</p>}
      </SectionCard>
    </div>;
  }

  const RENDERERS: Record<Tab, () => JSX.Element> = {
    geral: renderGeral, academico: renderAcademico, captacao: renderCaptacao,
    compliance: renderCompliance, financeiro: renderFinanceiro, infra: renderInfra,
  };

  return (
    <section ref={panel} className="reitor-bi" aria-label="BI do Reitor">
      <header className="rbi-header">
        <div className="rbi-title-row">
          <h2>BI do Reitor</h2>
          <div className="rbi-actions">
            <label className="rbi-inst-select">
              <select value={instId} onChange={e => { setInstId(e.target.value); setTick(t => t + 1); }}>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <button type="button" className="rbi-btn" onClick={() => setTick(t => t + 1)}>🔄 Atualizar</button>
          </div>
        </div>
        <nav className="rbi-tabs">
          {TABS.map(t => (
            <button key={t.key} type="button" className={`rbi-tab ${tab === t.key ? 'rbi-tab-active' : ''}`}
              onClick={() => setTab(t.key)}>
              <span className="rbi-tab-icon">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
      </header>

      {loading ? <div className="rbi-loading"><div className="rbi-spinner" />Carregando dados…</div> : RENDERERS[tab]()}
    </section>
  );
}
