import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchSemestres, fetchCursos, fetchQuantitativo, fetchReports,
  aggregateAcademico, compararSemestres, simularRetencao,
  parseProfReprova, parseDiscReprova, parseFluxo, parseReprovaSemestre,
  type Semestre, type CursoInfo, type CursoQuantitativo,
  type KPIsAcademico, type CursoResumo, type ModalidadeDistribuicao, type EvolucaoSemestral,
  type CursoDelta, type ProfReprova, type DiscReprova, type FluxoSemestre, type ReprovaSemestre,
} from '@/lib/academico';
import './academico-bi.css';

const fmt = new Intl.NumberFormat('pt-BR');
const fmtPct = (v: number) => v.toFixed(1) + '%';
const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const sign = (v: number) => (v > 0 ? '+' : '') + fmt.format(v);

// Asana-inspired categorical palette (CVD-validated) — same as CaptacaoBI
const COLORS = ['#2678a8', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];
const GREEN = '#1baf7a', RED = '#e2574c';

/* ============================================================ KPI Tiles */
function KPITiles({ kpis }: { kpis: KPIsAcademico }) {
  const tiles = [
    { label: 'Total de Vínculos', value: fmt.format(kpis.totalVinculos), color: COLORS[0] },
    { label: 'Total Matriculados', value: fmt.format(kpis.totalMatriculados), color: COLORS[2] },
    { label: 'Cursos Ativos', value: String(kpis.cursosAtivos), color: COLORS[1] },
    { label: 'Taxa de Matrícula', value: fmtPct(kpis.taxaMatricula), color: COLORS[3] },
  ];
  return <div className="abi-kpis">{tiles.map(t => (
    <article className="abi-kpi" key={t.label}>
      <span className="abi-kpi-label">{t.label}</span>
      <strong className="abi-kpi-value" style={{ color: t.color }}>{t.value}</strong>
    </article>
  ))}</div>;
}

/* ============================================================ Visão Geral */
function TopCursosChart({ data }: { data: CursoResumo[] }) {
  const top = data.filter(d => d.vinculos > 0).slice(0, 10);
  const max = Math.max(...top.map(d => d.vinculos), 1);
  return <article className="abi-card">
    <h3>Top 10 Cursos por Vínculos</h3>
    <div className="abi-legend-row">
      <span className="abi-legend-item"><i style={{ background: COLORS[0] }} />Vínculos</span>
      <span className="abi-legend-item"><i style={{ background: COLORS[2] }} />Matriculados</span>
    </div>
    <div className="abi-hbars">{top.map(d => (
      <div className="abi-hbar-row" key={d.cursoId}>
        <span className="abi-hbar-label" title={d.nome}>{d.nome}</span>
        <div className="abi-hbar-track">
          <div className="abi-hbar-fill" style={{ width: (d.vinculos / max * 100) + '%', background: COLORS[0] }} />
          <div className="abi-hbar-fill-secondary" style={{ width: (d.matriculados / max * 100) + '%', background: COLORS[2] }} />
        </div>
        <span className="abi-hbar-value">{fmt.format(d.vinculos)}</span>
      </div>
    ))}</div>
  </article>;
}

function ModalidadeDonut({ data }: { data: ModalidadeDistribuicao[] }) {
  const total = data.reduce((s, d) => s + d.vinculos, 0);
  let offset = 0;
  return <article className="abi-card">
    <h3>Distribuição por Modalidade</h3>
    <svg viewBox="0 0 180 180" className="abi-donut" aria-label="Modalidades">
      <circle cx="90" cy="90" r="63" fill="none" stroke="#edf0f7" strokeWidth="24" />
      {data.map((d, i) => {
        const pct = total ? d.vinculos / total * 100 : 0;
        const start = offset;
        offset += pct;
        return <circle key={d.modalidade} cx="90" cy="90" r="63" pathLength="100" fill="none"
          stroke={COLORS[i % COLORS.length]} strokeWidth="24"
          strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-start}
          transform="rotate(-90 90 90)">
          <title>{d.modalidade} · {fmt.format(d.vinculos)} vínculos · {fmt.format(d.matriculados)} matriculados</title>
        </circle>;
      })}
      <text x="90" y="90" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="#243653">
        {fmt.format(total)}
      </text>
    </svg>
    <div className="abi-legend">{data.map((d, i) => (
      <span className="abi-legend-item" key={d.modalidade}>
        <i style={{ background: COLORS[i % COLORS.length] }} />{d.modalidade}
        <b>{fmt.format(d.vinculos)}</b> ({fmtPct(total ? d.vinculos / total * 100 : 0)})
      </span>
    ))}</div>
  </article>;
}

function EvolucaoChart({ data }: { data: EvolucaoSemestral[] }) {
  if (data.length < 2) return null;
  const w = 600, h = 220, px = 50, py = 24;
  const maxY = Math.max(...data.map(d => Math.max(d.vinculos, d.matriculados)), 1);
  const xStep = (w - px * 2) / (data.length - 1);
  const toY = (v: number) => py + (h - py * 2) * (1 - v / maxY);
  const toX = (i: number) => px + i * xStep;
  const lineV = data.map((d, i) => `${toX(i)},${toY(d.vinculos)}`).join(' ');
  const lineM = data.map((d, i) => `${toX(i)},${toY(d.matriculados)}`).join(' ');
  const [hover, setHover] = useState<number | null>(null);
  const labelStep = Math.max(1, Math.ceil(data.length / 12));

  return <article className="abi-card abi-card-wide">
    <h3>Evolução Histórica</h3>
    <div className="abi-legend-row">
      <span className="abi-legend-item"><i style={{ background: COLORS[0] }} />Vínculos</span>
      <span className="abi-legend-item"><i style={{ background: COLORS[2] }} />Matriculados</span>
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} className="abi-line-chart" onMouseLeave={() => setHover(null)}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={px} y1={toY(maxY * f)} x2={w - px} y2={toY(maxY * f)} stroke="#e1e4e8" strokeWidth="1" />
          <text x={px - 6} y={toY(maxY * f) + 4} textAnchor="end" fontSize="10" fill="#757a80">{fmt.format(Math.round(maxY * f))}</text>
        </g>
      ))}
      {data.map((d, i) => i % labelStep === 0 ? (
        <text key={d.semestre} x={toX(i)} y={h - 2} textAnchor="middle" fontSize="9" fill="#757a80">
          {d.semestre.replace('/', '·')}
        </text>
      ) : null)}
      <polyline points={lineV} fill="none" stroke={COLORS[0]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={lineM} fill="none" stroke={COLORS[2]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.semestre} onMouseEnter={() => setHover(i)}>
          <circle cx={toX(i)} cy={toY(d.vinculos)} r="3" fill={COLORS[0]} stroke="white" strokeWidth="1.5" />
          <circle cx={toX(i)} cy={toY(d.matriculados)} r="3" fill={COLORS[2]} stroke="white" strokeWidth="1.5" />
          <rect x={toX(i) - 14} y={0} width={28} height={h} fill="transparent" />
        </g>
      ))}
      {hover !== null && (
        <g>
          <line x1={toX(hover)} y1={py} x2={toX(hover)} y2={h - py} stroke="#243653" strokeWidth="1" strokeDasharray="3 3" />
          <rect x={toX(hover) - 60} y={toY(data[hover].vinculos) - 32} width={120} height={26} rx={4} fill="#243653" />
          <text x={toX(hover)} y={toY(data[hover].vinculos) - 15} textAnchor="middle" fontSize="11" fill="white">
            {data[hover].semestre} · V:{fmt.format(data[hover].vinculos)} M:{fmt.format(data[hover].matriculados)}
          </text>
        </g>
      )}
    </svg>
  </article>;
}

function CursosTable({ data, modalidadeFilter }: { data: CursoResumo[]; modalidadeFilter: string }) {
  const [sortKey, setSortKey] = useState<keyof CursoResumo>('vinculos');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = modalidadeFilter === 'Todas'
    ? data.filter(d => d.vinculos > 0)
    : data.filter(d => d.vinculos > 0 && d.modalidade.toLowerCase() === modalidadeFilter.toLowerCase());

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const toggleSort = (key: keyof CursoResumo) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const arrow = (key: keyof CursoResumo) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  return <div className="abi-table-wrap">
    <table className="abi-table">
      <thead><tr>
        <th onClick={() => toggleSort('nome')}>Curso{arrow('nome')}</th>
        <th>Modalidade</th>
        <th onClick={() => toggleSort('vinculos')}>Vínculos{arrow('vinculos')}</th>
        <th onClick={() => toggleSort('matriculados')}>Matriculados{arrow('matriculados')}</th>
        <th onClick={() => toggleSort('turmas')}>Turmas{arrow('turmas')}</th>
        <th onClick={() => toggleSort('taxaMatricula')}>% Matric.{arrow('taxaMatricula')}</th>
      </tr></thead>
      <tbody>{sorted.map(d => (
        <tr key={d.cursoId}>
          <td>{d.nome}</td>
          <td><span className="abi-modalidade-badge" data-mod={d.modalidade}>{d.modalidade}</span></td>
          <td className="abi-num">{fmt.format(d.vinculos)}</td>
          <td className="abi-num">{fmt.format(d.matriculados)}</td>
          <td className="abi-num">{d.turmas}</td>
          <td className="abi-pct">{fmtPct(d.taxaMatricula)}</td>
        </tr>
      ))}</tbody>
    </table>
  </div>;
}

function VisaoGeral({ bi, semestreLabel, modalidadeFilter, setModalidadeFilter, modalities }: {
  bi: ReturnType<typeof aggregateAcademico>;
  semestreLabel: string;
  modalidadeFilter: string;
  setModalidadeFilter: (m: string) => void;
  modalities: string[];
}) {
  return <>
    <KPITiles kpis={bi.kpis} />
    <div className="abi-grid">
      <TopCursosChart data={bi.cursosResumo} />
      <ModalidadeDonut data={bi.modalidades} />
      <EvolucaoChart data={bi.evolucao} />
      <article className="abi-card abi-card-wide">
        <h3>Cursos com Alunos</h3>
        <small className="abi-subtitle">Semestre: {semestreLabel} · Ordenável por qualquer coluna</small>
        <div className="abi-filters">
          {modalities.map(m => (
            <button key={m} className={modalidadeFilter === m ? 'active' : ''} onClick={() => setModalidadeFilter(m)}>{m}</button>
          ))}
        </div>
        <CursosTable data={bi.cursosResumo} modalidadeFilter={modalidadeFilter} />
      </article>
      {bi.inativos.length > 0 && (
        <article className="abi-card abi-card-wide">
          <details className="abi-inativos">
            <summary>{bi.inativos.length} cursos sem alunos no semestre {semestreLabel}</summary>
            <ul>
              {bi.inativos.map(c => (
                <li key={c.id}>{c.nome} <span className="abi-modalidade-badge" data-mod={c.modalidade}>{c.modalidade}</span></li>
              ))}
            </ul>
          </details>
        </article>
      )}
    </div>
  </>;
}

/* ============================================================ Comparador de Semestres */
function DeltaBar({ c, max }: { c: CursoDelta; max: number }) {
  const up = c.deltaVinculos >= 0;
  const w = Math.min(100, Math.abs(c.deltaVinculos) / max * 100);
  return <div className="abi-delta-row">
    <span className="abi-delta-label" title={c.nome}>{c.nome}</span>
    <div className="abi-delta-track">
      <div className="abi-delta-fill" style={{ width: w + '%', background: up ? GREEN : RED }} />
    </div>
    <span className="abi-delta-val" style={{ color: up ? GREEN : RED }}>
      {sign(c.deltaVinculos)}{c.variacaoPct !== 0 && <small> ({c.variacaoPct > 0 ? '+' : ''}{c.variacaoPct.toFixed(0)}%)</small>}
    </span>
  </div>;
}

function Comparador({ quantitativo, cursos, semestres }: {
  quantitativo: CursoQuantitativo[]; cursos: CursoInfo[]; semestres: Semestre[];
}) {
  const ordered = useMemo(() => [...semestres].sort((a, b) => a.semestre.localeCompare(b.semestre)), [semestres]);
  const withData = useMemo(() => {
    const ids = new Set(quantitativo.map(q => q.semestre_id));
    return ordered.filter(s => ids.has(s.id));
  }, [ordered, quantitativo]);
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);

  useEffect(() => {
    if (withData.length >= 2 && aId == null) {
      setAId(withData[withData.length - 2].id);
      setBId(withData[withData.length - 1].id);
    }
  }, [withData, aId]);

  if (withData.length < 2) return <p className="abi-empty">Dados insuficientes para comparação (mínimo dois semestres).</p>;
  if (aId == null || bId == null) return null;

  const cmp = compararSemestres(quantitativo, cursos, semestres, aId, bId);
  const maxDelta = Math.max(1, ...cmp.cursos.map(c => Math.abs(c.deltaVinculos)));

  return <div className="abi-sim">
    <div className="abi-sim-controls">
      <label>Semestre base (A)
        <select value={aId} onChange={e => setAId(Number(e.target.value))}>
          {withData.map(s => <option key={s.id} value={s.id}>{s.semestre}</option>)}
        </select>
      </label>
      <span className="abi-arrow">→</span>
      <label>Semestre comparado (B)
        <select value={bId} onChange={e => setBId(Number(e.target.value))}>
          {withData.map(s => <option key={s.id} value={s.id}>{s.semestre}</option>)}
        </select>
      </label>
    </div>

    <div className="abi-cmp-summary">
      <article className="abi-cmp-tile">
        <span className="abi-kpi-label">Variação de Vínculos</span>
        <strong style={{ color: cmp.deltaVinculos >= 0 ? GREEN : RED }}>{sign(cmp.deltaVinculos)}</strong>
        <small>{fmt.format(cmp.totalVinculosA)} → {fmt.format(cmp.totalVinculosB)} ({cmp.variacaoVinculosPct > 0 ? '+' : ''}{cmp.variacaoVinculosPct.toFixed(1)}%)</small>
      </article>
      <article className="abi-cmp-tile">
        <span className="abi-kpi-label">Variação de Matriculados</span>
        <strong style={{ color: cmp.deltaMatriculados >= 0 ? GREEN : RED }}>{sign(cmp.deltaMatriculados)}</strong>
        <small>{fmt.format(cmp.totalMatriculadosA)} → {fmt.format(cmp.totalMatriculadosB)}</small>
      </article>
      <article className="abi-cmp-tile">
        <span className="abi-kpi-label">Cursos que cresceram</span>
        <strong style={{ color: GREEN }}>{cmp.cursos.filter(c => c.deltaVinculos > 0).length}</strong>
        <small>de {cmp.cursos.length} com movimento</small>
      </article>
      <article className="abi-cmp-tile">
        <span className="abi-kpi-label">Cursos que recuaram</span>
        <strong style={{ color: RED }}>{cmp.cursos.filter(c => c.deltaVinculos < 0).length}</strong>
        <small>de {cmp.cursos.length} com movimento</small>
      </article>
    </div>

    <div className="abi-grid">
      <article className="abi-card">
        <h3>🚀 Maiores ganhos de alunos</h3>
        <small className="abi-subtitle">{cmp.semestreA} → {cmp.semestreB}</small>
        <div className="abi-deltas">{cmp.ganhos.length ? cmp.ganhos.map(c => <DeltaBar key={c.cursoId} c={c} max={maxDelta} />) : <p className="abi-empty">Nenhum curso cresceu neste recorte.</p>}</div>
      </article>
      <article className="abi-card">
        <h3>📉 Maiores perdas de alunos</h3>
        <small className="abi-subtitle">{cmp.semestreA} → {cmp.semestreB}</small>
        <div className="abi-deltas">{cmp.perdas.length ? cmp.perdas.map(c => <DeltaBar key={c.cursoId} c={c} max={maxDelta} />) : <p className="abi-empty">Nenhum curso recuou neste recorte.</p>}</div>
      </article>
    </div>
  </div>;
}

/* ============================================================ Raio-X de Reprovações */
function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
}

function RaioX({ profs, discs, dossieDireito }: { profs: ProfReprova[]; discs: DiscReprova[]; dossieDireito: ReprovaSemestre[] }) {
  const [modo, setModo] = useState<'professores' | 'disciplinas'>('professores');
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const profsFiltrados = useMemo(() =>
    profs.filter(p => p.total > 0 && p.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 60),
    [profs, busca]);
  const discsFiltradas = useMemo(() =>
    discs.filter(d => d.total > 0 && d.disciplina.toLowerCase().includes(busca.toLowerCase())).slice(0, 60),
    [discs, busca]);

  const maxProf = Math.max(1, ...profs.filter(p => p.total > 0).map(p => p.total));
  const maxDisc = Math.max(1, ...discs.filter(d => d.total > 0).map(d => d.total));

  return <div className="abi-sim">
    <div className="abi-sim-controls">
      <div className="abi-toggle">
        <button className={modo === 'professores' ? 'active' : ''} onClick={() => { setModo('professores'); setOpen(null); }}>👨‍🏫 Professores</button>
        <button className={modo === 'disciplinas' ? 'active' : ''} onClick={() => { setModo('disciplinas'); setOpen(null); }}>📚 Disciplinas</button>
      </div>
      <label className="abi-search">🔍
        <input type="search" placeholder={modo === 'professores' ? 'Buscar professor…' : 'Buscar disciplina…'} value={busca} onChange={e => setBusca(e.target.value)} />
      </label>
    </div>

    {modo === 'professores' ? (
      <article className="abi-card abi-card-wide">
        <h3>Professores que mais reprovam</h3>
        <small className="abi-subtitle">Clique num professor para ver a composição (faltas · notas · pós-recuperação)</small>
        <div className="abi-rank">{profsFiltrados.map(p => (
          <div key={p.ranking} className="abi-rank-group">
            <button className="abi-rank-row" onClick={() => setOpen(open === p.ranking ? null : p.ranking)}>
              <span className="abi-rank-pos">{medal(p.ranking) || p.ranking}</span>
              <span className="abi-rank-name" title={p.nome}>{p.nome}</span>
              <div className="abi-rank-track"><div className="abi-rank-fill" style={{ width: (p.total / maxProf * 100) + '%', background: COLORS[1] }} /></div>
              <span className="abi-rank-val">{fmt.format(p.total)}</span>
              {p.taxa != null && <span className="abi-rank-tax" title="Taxa de reprovação (reprovações / vínculos)">{p.taxa.toFixed(1)}%</span>}
            </button>
            {open === p.ranking && (p.rfFaltas != null || p.vinculos != null) && (
              <div className="abi-rank-detail">
                {p.rfFaltas != null && <span>Por falta: <b>{fmt.format(p.rfFaltas)}</b></span>}
                {p.rnNotas != null && <span>Por nota: <b>{fmt.format(p.rnNotas)}</b></span>}
                {p.raApos != null && <span>Após recuperação: <b>{fmt.format(p.raApos)}</b></span>}
                {p.vinculos != null && <span>Vínculos lecionados: <b>{fmt.format(p.vinculos)}</b></span>}
                {p.disciplinas != null && <span>Disciplinas: <b>{p.disciplinas}</b></span>}
                {p.ofertas != null && <span>Ofertas: <b>{p.ofertas}</b></span>}
              </div>
            )}
          </div>
        ))}</div>
      </article>
    ) : (
      <article className="abi-card abi-card-wide">
        <h3>Disciplinas que mais reprovam</h3>
        <small className="abi-subtitle">Gargalos da jornada acadêmica — candidatas a monitoria e nivelamento</small>
        <div className="abi-rank">{discsFiltradas.map(d => (
          <div key={d.ranking} className="abi-rank-row-static">
            <span className="abi-rank-pos">{medal(d.ranking) || d.ranking}</span>
            <span className="abi-rank-name" title={d.disciplina}>{d.disciplina}</span>
            <div className="abi-rank-track"><div className="abi-rank-fill" style={{ width: (d.total / maxDisc * 100) + '%', background: COLORS[4] }} /></div>
            <span className="abi-rank-val">{fmt.format(d.total)}</span>
          </div>
        ))}</div>
      </article>
    )}

    {dossieDireito.length > 0 && (
      <article className="abi-card abi-card-wide">
        <h3>⚖️ Dossiê Direito — evolução da reprovação</h3>
        <small className="abi-subtitle">Curso estratégico acompanhado semestre a semestre</small>
        <div className="abi-dossie">{dossieDireito.map(d => (
          <div key={d.semestre} className="abi-dossie-col">
            <span className="abi-dossie-pct">{d.pct.toFixed(1)}%</span>
            <div className="abi-dossie-bar"><div style={{ height: Math.max(4, d.pct / 20 * 100) + '%', background: d.pct > 13 ? RED : d.pct > 10 ? COLORS[3] : GREEN }} /></div>
            <span className="abi-dossie-sem">{d.semestre.replace('/', '·')}</span>
            <span className="abi-dossie-n">{fmt.format(d.reprovacoes)}</span>
          </div>
        ))}</div>
      </article>
    )}
  </div>;
}

/* ============================================================ Simulador de Retenção */
function Simulador({ reprovaSemestre }: { reprovaSemestre: ReprovaSemestre[] }) {
  const semestresComDados = reprovaSemestre.filter(r => r.reprovacoes > 0);
  const base = semestresComDados.length ? semestresComDados[semestresComDados.length - 1] : null;
  const [reducao, setReducao] = useState(20);
  const [mensalidade, setMensalidade] = useState(800);
  const [baseSem, setBaseSem] = useState<string>('');

  const semAtual = semestresComDados.find(r => r.semestre === baseSem) ?? base;
  if (!semAtual) return <p className="abi-empty">Sem dados de reprovação para simular.</p>;

  const sim = simularRetencao(semAtual.reprovacoes, reducao, mensalidade);
  const anguloMeter = -90 + (reducao / 50) * 180;

  return <div className="abi-sim">
    <div className="abi-sim-intro">
      <h3>🎯 Simulador de Retenção</h3>
      <p>Cada reprovação é um gatilho de evasão. Simule o impacto de reduzir as reprovações do semestre de <b>{semAtual.semestre}</b> ({fmt.format(semAtual.reprovacoes)} reprovações · {semAtual.pct.toFixed(1)}% das matrículas).</p>
    </div>

    <div className="abi-sim-controls abi-sim-sliders">
      <label>Semestre base
        <select value={semAtual.semestre} onChange={e => setBaseSem(e.target.value)}>
          {semestresComDados.map(r => <option key={r.semestre} value={r.semestre}>{r.semestre} · {fmt.format(r.reprovacoes)} reprov.</option>)}
        </select>
      </label>
      <label className="abi-slider-label">Redução de reprovações: <b>{reducao}%</b>
        <input type="range" min={0} max={50} step={1} value={reducao} onChange={e => setReducao(Number(e.target.value))} />
      </label>
      <label>Mensalidade média (R$)
        <input type="number" min={0} step={50} value={mensalidade} onChange={e => setMensalidade(Number(e.target.value))} />
      </label>
    </div>

    <div className="abi-meter-wrap">
      <svg viewBox="0 0 200 120" className="abi-meter">
        <path d="M20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#edf0f7" strokeWidth="16" strokeLinecap="round" />
        <path d="M20 110 A 80 80 0 0 1 180 110" fill="none" stroke={GREEN} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${(reducao / 50) * 251} 251`} />
        <line x1="100" y1="110" x2={100 + 70 * Math.cos(anguloMeter * Math.PI / 180)} y2={110 + 70 * Math.sin(anguloMeter * Math.PI / 180)} stroke="#243653" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="110" r="6" fill="#243653" />
        <text x="100" y="80" textAnchor="middle" fontSize="26" fontWeight="700" fill={GREEN}>{fmt.format(sim.alunosRetidos)}</text>
        <text x="100" y="98" textAnchor="middle" fontSize="10" fill="#757a80">alunos retidos</text>
      </svg>
    </div>

    <div className="abi-sim-results">
      <article className="abi-sim-result"><span className="abi-kpi-label">Alunos retidos</span><strong style={{ color: GREEN }}>{fmt.format(sim.alunosRetidos)}</strong></article>
      <article className="abi-sim-result"><span className="abi-kpi-label">Receita / semestre</span><strong>{fmtMoney.format(sim.receitaSemestral)}</strong></article>
      <article className="abi-sim-result"><span className="abi-kpi-label">Receita / ano</span><strong>{fmtMoney.format(sim.receitaAnual)}</strong></article>
      <article className="abi-sim-result abi-sim-highlight"><span className="abi-kpi-label">Impacto no ciclo (≈2 anos)</span><strong>{fmtMoney.format(sim.receitaCiclo)}</strong></article>
    </div>
    <p className="abi-sim-note">Estimativa gerencial: 1 reprovação evitada ≈ 1 vínculo retido. Mensalidade e ciclo são parâmetros ajustáveis — não representam contabilidade oficial.</p>
  </div>;
}

/* ============================================================ Funil Acadêmico */
function Funil({ fluxo }: { fluxo: FluxoSemestre[] }) {
  const comDados = fluxo.filter(f => f.total > 0);
  const [sem, setSem] = useState<string>('');
  const atual = comDados.find(f => f.semestre === sem) ?? comDados[comDados.length - 1];
  if (!atual) return <p className="abi-empty">Sem dados de fluxo acadêmico.</p>;

  const etapas = [
    { label: 'Matriculados', value: atual.matriculados, color: COLORS[0] },
    { label: 'Pré-matriculados', value: atual.pre, color: COLORS[5] },
    { label: 'Trancados', value: atual.trancados, color: COLORS[3] },
    { label: 'Transferidos', value: atual.transferidos, color: COLORS[4] },
    { label: 'Abandono', value: atual.abandono, color: RED },
    { label: 'Cancelados', value: atual.cancelados, color: '#9aa0b5' },
    { label: 'Concluídos', value: atual.concluidos, color: GREEN },
  ];
  const max = Math.max(1, ...etapas.map(e => e.value));

  // retenção = matriculados / (matriculados + evadidos)
  const evadidos = atual.abandono + atual.cancelados + atual.transferidos;
  const taxaEvasao = atual.total > 0 ? (evadidos / atual.total) * 100 : 0;

  return <div className="abi-sim">
    <div className="abi-sim-controls">
      <label>Semestre
        <select value={atual.semestre} onChange={e => setSem(e.target.value)}>
          {comDados.map(f => <option key={f.semestre} value={f.semestre}>{f.semestre}</option>)}
        </select>
      </label>
    </div>

    <div className="abi-cmp-summary">
      <article className="abi-cmp-tile"><span className="abi-kpi-label">Movimentações no semestre</span><strong>{fmt.format(atual.total)}</strong><small>registros de status</small></article>
      <article className="abi-cmp-tile"><span className="abi-kpi-label">Matriculados</span><strong style={{ color: COLORS[0] }}>{fmt.format(atual.matriculados)}</strong></article>
      <article className="abi-cmp-tile"><span className="abi-kpi-label">Concluídos</span><strong style={{ color: GREEN }}>{fmt.format(atual.concluidos)}</strong></article>
      <article className="abi-cmp-tile"><span className="abi-kpi-label">Sinais de evasão</span><strong style={{ color: RED }}>{fmtPct(taxaEvasao)}</strong><small>abandono + cancelamento + transferência</small></article>
    </div>

    <article className="abi-card abi-card-wide">
      <h3>Composição do fluxo — {atual.semestre}</h3>
      <div className="abi-hbars">{etapas.map(e => (
        <div className="abi-hbar-row" key={e.label}>
          <span className="abi-hbar-label">{e.label}</span>
          <div className="abi-hbar-track"><div className="abi-hbar-fill" style={{ width: (e.value / max * 100) + '%', background: e.color }} /></div>
          <span className="abi-hbar-value">{fmt.format(e.value)}</span>
        </div>
      ))}</div>
    </article>
  </div>;
}

/* ============================================================ Main */
type Aba = 'geral' | 'comparador' | 'raiox' | 'simulador' | 'funil';
const ABAS: { id: Aba; label: string }[] = [
  { id: 'geral', label: '📊 Visão Geral' },
  { id: 'comparador', label: '🔀 Comparador' },
  { id: 'raiox', label: '🔬 Raio-X Reprovações' },
  { id: 'simulador', label: '🎯 Simulador' },
  { id: 'funil', label: '🧭 Funil Acadêmico' },
];

export default function AcademicoBI({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [semestres, setSemestres] = useState<Semestre[]>([]);
  const [cursos, setCursos] = useState<CursoInfo[]>([]);
  const [quantitativo, setQuantitativo] = useState<CursoQuantitativo[]>([]);
  const [profs, setProfs] = useState<ProfReprova[]>([]);
  const [discs, setDiscs] = useState<DiscReprova[]>([]);
  const [fluxo, setFluxo] = useState<FluxoSemestre[]>([]);
  const [reprovaSem, setReprovaSem] = useState<ReprovaSemestre[]>([]);
  const [dossie, setDossie] = useState<ReprovaSemestre[]>([]);
  const [selectedSemestre, setSelectedSemestre] = useState<number | null>(null);
  const [modalidadeFilter, setModalidadeFilter] = useState('Todas');
  const [aba, setAba] = useState<Aba>('geral');
  const [tv, setTv] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [s, c, q] = await Promise.all([fetchSemestres(), fetchCursos(), fetchQuantitativo()]);
      setSemestres(s);
      setCursos(c);
      setQuantitativo(q);
      if (s.length && !selectedSemestre) {
        const latest = [...s].sort((a, b) => b.semestre.localeCompare(a.semestre))[0];
        setSelectedSemestre(latest.id);
      }
      // Relatórios de reprovação/fluxo (vertice_academic_reports). Falha aqui não derruba a visão geral.
      if (institutionId) {
        try {
          const [rp, rd, rf, rs, dd] = await Promise.all([
            fetchReports(institutionId, ['reprovacoes_professor']),
            fetchReports(institutionId, ['reprovacoes_disciplina']),
            fetchReports(institutionId, ['fluxo_academico']),
            fetchReports(institutionId, ['reprovacoes_semestre']),
            fetchReports(institutionId, ['dossie_direito']),
          ]);
          setProfs(parseProfReprova(rp));
          setDiscs(parseDiscReprova(rd));
          setFluxo(parseFluxo(rf));
          setReprovaSem(parseReprovaSemestre(rs));
          setDossie(parseReprovaSemestre(dd));
        } catch { /* simulações ficam vazias, visão geral segue */ }
      }
    } catch (e: any) {
      setError('Não foi possível carregar os dados acadêmicos: ' + (e.message ?? ''));
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [institutionId]);
  useEffect(() => {
    if (!tv) return;
    const timer = setInterval(() => loadData(), 600000);
    return () => clearInterval(timer);
  }, [tv, institutionId]);

  const toggleTv = () => {
    if (tv) {
      setTv(false);
      if (document.fullscreenElement === panelRef.current) void document.exitFullscreen().catch(() => {});
    } else {
      setTv(true);
      void panelRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  const bi = aggregateAcademico(quantitativo, cursos, semestres, selectedSemestre);
  const semestreLabel = semestres.find(s => s.id === selectedSemestre)?.semestre ?? 'Todos';
  const sortedSemestres = [...semestres].sort((a, b) => b.semestre.localeCompare(a.semestre));
  const modalities = ['Todas', ...new Set(bi.cursosResumo.filter(c => c.vinculos > 0).map(c => c.modalidade.charAt(0).toUpperCase() + c.modalidade.slice(1)))];
  const temSimulacoes = profs.length > 0 || fluxo.length > 0;

  if (loading) return <section className="abi-root"><p role="status">Carregando BI acadêmico…</p></section>;

  return <section ref={panelRef} className={`abi-root ${tv ? 'abi-tv' : ''}`}>
    <div className="abi-header">
      <div>
        <h2>BI Acadêmico</h2>
        <p>{institutionName} · Semestre: {semestreLabel} · Fonte: e-ORBIT</p>
      </div>
      <div className="abi-actions">
        {aba === 'geral' && (
          <select value={selectedSemestre ?? ''} onChange={e => setSelectedSemestre(Number(e.target.value))}>
            {sortedSemestres.map(s => <option key={s.id} value={s.id}>{s.semestre}</option>)}
          </select>
        )}
        <button type="button" onClick={toggleTv}>{tv ? 'Sair modo TV' : 'Modo TV'}</button>
        <button type="button" onClick={loadData}>Atualizar</button>
      </div>
    </div>

    <nav className="abi-tabs">
      {ABAS.map(t => {
        const disabled = (t.id === 'comparador' && quantitativo.length === 0) ||
          ((t.id === 'raiox' || t.id === 'simulador' || t.id === 'funil') && !temSimulacoes);
        return <button key={t.id} className={`abi-tab ${aba === t.id ? 'active' : ''}`} disabled={disabled} onClick={() => setAba(t.id)} title={disabled ? 'Sem dados para esta instituição' : ''}>{t.label}</button>;
      })}
    </nav>

    {error && <p role="alert" className="abi-error">{error}</p>}

    {aba === 'geral' && <VisaoGeral bi={bi} semestreLabel={semestreLabel} modalidadeFilter={modalidadeFilter} setModalidadeFilter={setModalidadeFilter} modalities={modalities} />}
    {aba === 'comparador' && <Comparador quantitativo={quantitativo} cursos={cursos} semestres={semestres} />}
    {aba === 'raiox' && <RaioX profs={profs} discs={discs} dossieDireito={dossie} />}
    {aba === 'simulador' && <Simulador reprovaSemestre={reprovaSem} />}
    {aba === 'funil' && <Funil fluxo={fluxo} />}
  </section>;
}
