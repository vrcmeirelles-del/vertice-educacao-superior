import { useEffect, useRef, useState } from 'react';
import {
  fetchSemestres, fetchCursos, fetchQuantitativo,
  aggregateAcademico,
  type Semestre, type CursoInfo, type CursoQuantitativo,
  type KPIsAcademico, type CursoResumo, type ModalidadeDistribuicao, type EvolucaoSemestral,
} from '@/lib/academico';
import './academico-bi.css';

const fmt = new Intl.NumberFormat('pt-BR');
const fmtPct = (v: number) => v.toFixed(1) + '%';
const COLORS = ['#2678a8', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];

function KPITiles({ kpis }: { kpis: KPIsAcademico }) {
  const tiles = [
    { label: 'Total de Vinculos', value: fmt.format(kpis.totalVinculos), color: COLORS[0] },
    { label: 'Total Matriculados', value: fmt.format(kpis.totalMatriculados), color: COLORS[2] },
    { label: 'Cursos Ativos', value: String(kpis.cursosAtivos), color: COLORS[1] },
    { label: 'Taxa de Matricula', value: fmtPct(kpis.taxaMatricula), color: COLORS[3] },
  ];
  return <div className="abi-kpis">{tiles.map(t => (
    <article className="abi-kpi" key={t.label}>
      <span className="abi-kpi-label">{t.label}</span>
      <strong className="abi-kpi-value" style={{ color: t.color }}>{t.value}</strong>
    </article>
  ))}</div>;
}

function TopCursosChart({ data }: { data: CursoResumo[] }) {
  const top = data.filter(d => d.vinculos > 0).slice(0, 10);
  const max = Math.max(...top.map(d => d.vinculos), 1);
  return <article className="abi-card">
    <h3>Top 10 Cursos por Vinculos</h3>
    <div className="abi-legend-row">
      <span className="abi-legend-item"><i style={{ background: COLORS[0] }} />Vinculos</span>
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
    <h3>Distribuicao por Modalidade</h3>
    <svg viewBox="0 0 180 180" className="abi-donut" aria-label="Modalidades">
      <circle cx="90" cy="90" r="63" fill="none" stroke="#edf0f7" strokeWidth="24" />
      {data.map((d, i) => {
        const pct = total ? d.vinculos / total * 100 : 0;
        const start = offset; offset += pct;
        return <circle key={d.modalidade} cx="90" cy="90" r="63" pathLength="100" fill="none"
          stroke={COLORS[i % COLORS.length]} strokeWidth="24"
          strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-start}
          transform="rotate(-90 90 90)">
          <title>{d.modalidade} - {fmt.format(d.vinculos)} vinculos</title>
        </circle>;
      })}
      <text x="90" y="90" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="#243653">{fmt.format(total)}</text>
    </svg>
    <div className="abi-legend">{data.map((d, i) => (
      <span className="abi-legend-item" key={d.modalidade}>
        <i style={{ background: COLORS[i % COLORS.length] }} />{d.modalidade} <b>{fmt.format(d.vinculos)}</b> ({fmtPct(total ? d.vinculos / total * 100 : 0)})
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
    <h3>Evolucao Historica</h3>
    <div className="abi-legend-row">
      <span className="abi-legend-item"><i style={{ background: COLORS[0] }} />Vinculos</span>
      <span className="abi-legend-item"><i style={{ background: COLORS[2] }} />Matriculados</span>
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} className="abi-line-chart" onMouseLeave={() => setHover(null)}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (<g key={f}><line x1={px} y1={toY(maxY * f)} x2={w - px} y2={toY(maxY * f)} stroke="#e1e4e8" strokeWidth="1" /><text x={px - 6} y={toY(maxY * f) + 4} textAnchor="end" fontSize="10" fill="#757a80">{fmt.format(Math.round(maxY * f))}</text></g>))}
      {data.map((d, i) => i % labelStep === 0 ? <text key={d.semestre} x={toX(i)} y={h - 2} textAnchor="middle" fontSize="9" fill="#757a80">{d.semestre.replace('/', '.')}</text> : null)}
      <polyline points={lineV} fill="none" stroke={COLORS[0]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={lineM} fill="none" stroke={COLORS[2]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (<g key={d.semestre} onMouseEnter={() => setHover(i)}><circle cx={toX(i)} cy={toY(d.vinculos)} r="3" fill={COLORS[0]} stroke="white" strokeWidth="1.5" /><circle cx={toX(i)} cy={toY(d.matriculados)} r="3" fill={COLORS[2]} stroke="white" strokeWidth="1.5" /><rect x={toX(i) - 14} y={0} width={28} height={h} fill="transparent" /></g>))}
      {hover !== null && (<g><line x1={toX(hover)} y1={py} x2={toX(hover)} y2={h - py} stroke="#243653" strokeWidth="1" strokeDasharray="3 3" /><rect x={toX(hover) - 60} y={toY(data[hover].vinculos) - 32} width={120} height={26} rx={4} fill="#243653" /><text x={toX(hover)} y={toY(data[hover].vinculos) - 15} textAnchor="middle" fontSize="11" fill="white">{data[hover].semestre} V:{fmt.format(data[hover].vinculos)} M:{fmt.format(data[hover].matriculados)}</text></g>)}
    </svg>
  </article>;
}

function CursosTable({ data, modalidadeFilter }: { data: CursoResumo[]; modalidadeFilter: string }) {
  const [sortKey, setSortKey] = useState<keyof CursoResumo>('vinculos');
  const [sortAsc, setSortAsc] = useState(false);
  const filtered = modalidadeFilter === 'Todas' ? data.filter(d => d.vinculos > 0) : data.filter(d => d.vinculos > 0 && d.modalidade.toLowerCase() === modalidadeFilter.toLowerCase());
  const sorted = [...filtered].sort((a, b) => { const va = a[sortKey], vb = b[sortKey]; if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va; return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va)); });
  const toggleSort = (key: keyof CursoResumo) => { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(false); } };
  const arrow = (key: keyof CursoResumo) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';
  return <div className="abi-table-wrap"><table className="abi-table"><thead><tr>
    <th onClick={() => toggleSort('nome')}>Curso{arrow('nome')}</th><th>Modalidade</th>
    <th onClick={() => toggleSort('vinculos')}>Vinculos{arrow('vinculos')}</th>
    <th onClick={() => toggleSort('matriculados')}>Matriculados{arrow('matriculados')}</th>
    <th onClick={() => toggleSort('turmas')}>Turmas{arrow('turmas')}</th>
    <th onClick={() => toggleSort('taxaMatricula')}>% Matric.{arrow('taxaMatricula')}</th>
  </tr></thead><tbody>{sorted.map(d => (<tr key={d.cursoId}><td>{d.nome}</td><td><span className="abi-modalidade-badge" data-mod={d.modalidade}>{d.modalidade}</span></td><td className="abi-num">{fmt.format(d.vinculos)}</td><td className="abi-num">{fmt.format(d.matriculados)}</td><td className="abi-num">{d.turmas}</td><td className="abi-pct">{fmtPct(d.taxaMatricula)}</td></tr>))}</tbody></table></div>;
    }

export default function AcademicoBI({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [semestres, setSemestres] = useState<Semestre[]>([]);
  const [cursos, setCursos] = useState<CursoInfo[]>([]);
  const [quantitativo, setQuantitativo] = useState<CursoQuantitativo[]>([]);
  const [selectedSemestre, setSelectedSemestre] = useState<number | null>(null);
  const [modalidadeFilter, setModalidadeFilter] = useState('Todas');
  const [tv, setTv] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  async function loadData() {
    setLoading(true); setError('');
    try {
      const [s, c, q] = await Promise.all([fetchSemestres(), fetchCursos(), fetchQuantitativo()]);
      setSemestres(s); setCursos(c); setQuantitativo(q);
      if (s.length && !selectedSemestre) {
        const latest = s.sort((a, b) => b.semestre.localeCompare(a.semestre))[0];
        setSelectedSemestre(latest.id);
      }
    } catch (e: any) { setError('Nao foi possivel carregar os dados academicos: ' + (e.message ?? '')); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [institutionId]);
  useEffect(() => { if (!tv) return; const timer = setInterval(() => loadData(), 600000); return () => clearInterval(timer); }, [tv, institutionId]);

  const toggleTv = () => {
    if (tv) { setTv(false); if (document.fullscreenElement === panelRef.current) void document.exitFullscreen().catch(() => {}); }
    else { setTv(true); void panelRef.current?.requestFullscreen?.().catch(() => {}); }
  };

  const bi = aggregateAcademico(quantitativo, cursos, semestres, selectedSemestre);
  const semestreLabel = semestres.find(s => s.id === selectedSemestre)?.semestre ?? 'Todos';
  const sortedSemestres = [...semestres].sort((a, b) => b.semestre.localeCompare(a.semestre));
  const modalities = ['Todas', ...new Set(bi.cursosResumo.filter(c => c.vinculos > 0).map(c => c.modalidade.charAt(0).toUpperCase() + c.modalidade.slice(1)))];

  if (loading) return <section className="abi-root"><p role="status">Carregando BI academico...</p></section>;

  return <section ref={panelRef} className={`abi-root ${tv ? 'abi-tv' : ''}`}>
    <div className="abi-header">
      <div><h2>BI Academico</h2><p>{institutionName} - Semestre: {semestreLabel} - Fonte: e-ORBIT</p></div>
      <div className="abi-actions">
        <select value={selectedSemestre ?? ''} onChange={e => setSelectedSemestre(Number(e.target.value))}>
          {sortedSemestres.map(s => <option key={s.id} value={s.id}>{s.semestre}</option>)}
        </select>
        <button type="button" onClick={toggleTv}>{tv ? 'Sair modo TV' : 'Modo TV'}</button>
        <button type="button" onClick={loadData}>Atualizar</button>
      </div>
    </div>
    {error && <p role="alert" className="abi-error">{error}</p>}
    <KPITiles kpis={bi.kpis} />
    <div className="abi-grid">
      <TopCursosChart data={bi.cursosResumo} />
      <ModalidadeDonut data={bi.modalidades} />
      <EvolucaoChart data={bi.evolucao} />
      <article className="abi-card abi-card-wide">
        <h3>Cursos com Alunos</h3>
        <small className="abi-subtitle">Semestre: {semestreLabel} - Ordenavel por qualquer coluna</small>
        <div className="abi-filters">{modalities.map(m => (<button key={m} className={modalidadeFilter === m ? 'active' : ''} onClick={() => setModalidadeFilter(m)}>{m}</button>))}</div>
        <CursosTable data={bi.cursosResumo} modalidadeFilter={modalidadeFilter} />
      </article>
      {bi.inativos.length > 0 && (<article className="abi-card abi-card-wide"><details className="abi-inativos"><summary>{bi.inativos.length} cursos sem alunos no semestre {semestreLabel}</summary><ul>{bi.inativos.map(c => (<li key={c.id}>{c.nome} <span className="abi-modalidade-badge" data-mod={c.modalidade}>{c.modalidade}</span></li>))}</ul></details></article>)}
    </div>
  </section>;
}
