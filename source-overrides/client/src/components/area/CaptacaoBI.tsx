import { useEffect, useRef, useState } from 'react';
import {
  fetchLeads, fetchCustos, fetchSnapshots,
  aggregateBI,
  type Lead, type CustoCaptacao, type CaptacaoSnapshot,
  type FunnelStage, type OrigemData, type EvolucaoMensal,
  type CustoCanal, type CursoMatricula, type ConversaoOrigem,
} from '@/lib/captacao';
import './captacao-bi.css';

const fmt = new Intl.NumberFormat('pt-BR');
const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => v.toFixed(1) + '%';

// Asana-inspired categorical palette (CVD-validated)
const COLORS = ['#2678a8', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];
// Sequential blue ramp for funnel
const FUNNEL_RAMP = ['#c4def5', '#87bfe5', '#4da0d3', '#2678a8', '#174f73'];

type KPIs = { totalLeads: number; totalMat: number; totalInvest: number; cac: number };

/* ---------- Sparkline (inline SVG) ---------- */
function Spark({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = 28;
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (v / max) * h}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} className="cbi-spark" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ---------- KPI Tiles ---------- */
function KPITiles({ kpis, snapshots }: { kpis: KPIs; snapshots: CaptacaoSnapshot[] }) {
  const sparkLeads = snapshots.map(s => s.total_leads);
  const sparkMat = snapshots.map(s => s.total_matriculas);
  const sparkInvest = snapshots.map(s => Number(s.investimento_total));
  const sparkCac = snapshots.map(s => s.total_matriculas > 0 ? Number(s.investimento_total) / s.total_matriculas : 0);
  const tiles = [
    { label: 'Total de Leads', value: fmt.format(kpis.totalLeads), spark: sparkLeads, color: COLORS[0] },
    { label: 'Matrículas Captadas', value: fmt.format(kpis.totalMat), spark: sparkMat, color: COLORS[2] },
    { label: 'Investimento Total', value: fmtMoney.format(kpis.totalInvest), spark: sparkInvest, color: COLORS[1] },
    { label: 'CAC Médio', value: kpis.cac > 0 ? fmtMoney.format(kpis.cac) : '—', spark: sparkCac, color: COLORS[3] },
  ];
  return <div className="cbi-kpis">{tiles.map(t => (
    <article className="cbi-kpi" key={t.label}>
      <span className="cbi-kpi-label">{t.label}</span>
      <strong className="cbi-kpi-value">{t.value}</strong>
      <Spark data={t.spark} color={t.color} />
    </article>
  ))}</div>;
}

/* ---------- Funnel ---------- */
function FunnelChart({ data }: { data: FunnelStage[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return <article className="cbi-card">
    <h3>Funil de Captação</h3>
    <div className="cbi-funnel">{data.map((d, i) => (
      <div className="cbi-funnel-row" key={d.stage}>
        <span className="cbi-funnel-label">{d.stage}</span>
        <div className="cbi-funnel-track">
          <div className="cbi-funnel-bar" style={{ width: (d.count / max * 100) + '%', background: FUNNEL_RAMP[i % FUNNEL_RAMP.length] }}>
            <span>{fmt.format(d.count)}</span>
          </div>
        </div>
      </div>
    ))}</div>
  </article>;
}

/* ---------- Horizontal Bars ---------- */
function HBarChart({ title, data, valueKey, labelKey, formatValue, subtitle }: {
  title: string; data: { [k: string]: any }[]; valueKey: string; labelKey: string;
  formatValue?: (v: number) => string; subtitle?: string;
}) {
  const max = Math.max(...data.map(d => Number(d[valueKey])), 1);
  const fv = formatValue ?? ((v: number) => fmt.format(v));
  return <article className="cbi-card">
    <h3>{title}</h3>
    {subtitle && <small className="cbi-subtitle">{subtitle}</small>}
    <div className="cbi-hbars">{data.slice(0, 8).map((d, i) => (
      <div className="cbi-hbar-row" key={d[labelKey]}>
        <span className="cbi-hbar-label">{d[labelKey]}</span>
        <div className="cbi-hbar-track">
          <div className="cbi-hbar-fill" style={{ width: (Number(d[valueKey]) / max * 100) + '%', background: COLORS[i % COLORS.length] }} />
        </div>
        <span className="cbi-hbar-value">{fv(Number(d[valueKey]))}</span>
      </div>
    ))}</div>
  </article>;
}

/* ---------- Evolução Mensal (dual line SVG) ---------- */
function EvolucaoChart({ data }: { data: EvolucaoMensal[] }) {
  if (!data.length) return null;
  const w = 560, h = 200, px = 40, py = 20;
  const maxL = Math.max(...data.map(d => d.leads), 1);
  const maxM = Math.max(...data.map(d => d.mat), 1);
  const maxY = Math.max(maxL, maxM);
  const xStep = data.length > 1 ? (w - px * 2) / (data.length - 1) : 0;
  const toY = (v: number) => py + (h - py * 2) * (1 - v / maxY);
  const toX = (i: number) => px + i * xStep;
  const lineLeads = data.map((d, i) => `${toX(i)},${toY(d.leads)}`).join(' ');
  const lineMat = data.map((d, i) => `${toX(i)},${toY(d.mat)}`).join(' ');
  const [hover, setHover] = useState<number | null>(null);

  return <article className="cbi-card cbi-card-wide">
    <h3>Evolução Mensal</h3>
    <div className="cbi-legend-row">
      <span className="cbi-legend-item"><i style={{ background: COLORS[0] }} />Leads</span>
      <span className="cbi-legend-item"><i style={{ background: COLORS[2] }} />Matrículas</span>
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} className="cbi-line-chart" onMouseLeave={() => setHover(null)}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={px} y1={toY(maxY * f)} x2={w - px} y2={toY(maxY * f)} stroke="#e1e4e8" strokeWidth="1" />
      ))}
      {/* Axis labels */}
      {data.map((d, i) => (
        <text key={d.mes} x={toX(i)} y={h - 2} textAnchor="middle" fontSize="10" fill="#757a80">{d.mes.slice(5)}</text>
      ))}
      {/* Lines */}
      <polyline points={lineLeads} fill="none" stroke={COLORS[0]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={lineMat} fill="none" stroke={COLORS[2]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {data.map((d, i) => (
        <g key={d.mes} onMouseEnter={() => setHover(i)}>
          <circle cx={toX(i)} cy={toY(d.leads)} r="4" fill={COLORS[0]} stroke="white" strokeWidth="2" />
          <circle cx={toX(i)} cy={toY(d.mat)} r="4" fill={COLORS[2]} stroke="white" strokeWidth="2" />
          <rect x={toX(i) - 18} y={0} width={36} height={h} fill="transparent" />
        </g>
      ))}
      {/* Tooltip */}
      {hover !== null && (
        <g>
          <line x1={toX(hover)} y1={py} x2={toX(hover)} y2={h - py} stroke="#243653" strokeWidth="1" strokeDasharray="3 3" />
          <rect x={toX(hover) - 48} y={toY(data[hover].leads) - 28} width={96} height={22} rx={4} fill="#243653" />
          <text x={toX(hover)} y={toY(data[hover].leads) - 13} textAnchor="middle" fontSize="11" fill="white">
            L: {fmt.format(data[hover].leads)} · M: {fmt.format(data[hover].mat)}
          </text>
        </g>
      )}
    </svg>
  </article>;
}

/* ---------- Donut Chart ---------- */
function DonutChart({ title, data, valueKey, labelKey }: {
  title: string; data: { [k: string]: any }[]; valueKey: string; labelKey: string;
}) {
  const total = data.reduce((s, d) => s + Number(d[valueKey]), 0);
  let offset = 0;
  return <article className="cbi-card">
    <h3>{title}</h3>
    <svg viewBox="0 0 180 180" className="cbi-donut" aria-label={title}>
      <circle cx="90" cy="90" r="63" fill="none" stroke="#edf0f7" strokeWidth="24" />
      {data.map((d, i) => {
        const pct = total ? Number(d[valueKey]) / total * 100 : 0;
        const start = offset;
        offset += pct;
        return <circle key={d[labelKey]} cx="90" cy="90" r="63" pathLength="100" fill="none"
          stroke={COLORS[i % COLORS.length]} strokeWidth="24"
          strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-start}
          transform="rotate(-90 90 90)">
          <title>{d[labelKey]} · {fmt.format(Number(d[valueKey]))}</title>
        </circle>;
      })}
      <text x="90" y="90" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="#243653">
        {fmt.format(total)}
      </text>
    </svg>
    <div className="cbi-legend">{data.map((d, i) => (
      <span className="cbi-legend-item" key={d[labelKey]}>
        <i style={{ background: COLORS[i % COLORS.length] }} />{d[labelKey]} <b>{fmt.format(Number(d[valueKey]))}</b>
      </span>
    ))}</div>
  </article>;
}

/* ---------- Conversion Bars ---------- */
function ConversaoChart({ data }: { data: ConversaoOrigem[] }) {
  const max = Math.max(...data.map(d => d.rate), 1);
  return <article className="cbi-card">
    <h3>Taxa de Conversão por Origem</h3>
    <div className="cbi-hbars">{data.map((d, i) => (
      <div className="cbi-hbar-row" key={d.canal}>
        <span className="cbi-hbar-label">{d.canal}</span>
        <div className="cbi-hbar-track">
          <div className="cbi-hbar-fill" style={{ width: (d.rate / max * 100) + '%', background: COLORS[i % COLORS.length] }} />
        </div>
        <span className="cbi-hbar-value">{fmtPct(d.rate)}</span>
      </div>
    ))}</div>
  </article>;
}

/* ---------- Import CSV Dialog ---------- */
function ImportDialog({ institutionId, onImported, dialogRef }: {
  institutionId: string;
  onImported: () => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const [csv, setCsv] = useState('');
  const [status, setStatus] = useState('');

  async function handleImport() {
    if (!csv.trim()) return;
    setStatus('Importando…');
    try {
      const lines = csv.trim().split('\n');
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const idxOrigem = header.indexOf('origem');
      const idxCurso = header.indexOf('curso');
      const idxEtapa = header.indexOf('etapa');
      if (idxOrigem < 0) throw new Error('Coluna "origem" obrigatória');

      const { supabase: sb } = await import('@/lib/supabase');
      const batch = lines.slice(1).filter(l => l.trim()).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          institution_id: institutionId,
          origem: cols[idxOrigem] || 'Não informado',
          curso: idxCurso >= 0 ? cols[idxCurso] || null : null,
          etapa_funil: idxEtapa >= 0 ? cols[idxEtapa] || 'lead' : 'lead',
          periodo: null,
        };
      });
      const PAGE = 500;
      for (let i = 0; i < batch.length; i += PAGE) {
        const { error } = await sb.from('vertice_captacao_leads').insert(batch.slice(i, i + PAGE));
        if (error) throw error;
      }
      setStatus(`${batch.length} leads importados.`);
      setCsv('');
      onImported();
    } catch (e: any) {
      setStatus('Erro: ' + (e.message ?? 'falha na importação'));
    }
  }

  return <dialog ref={dialogRef} className="cbi-dialog" onClose={() => setStatus('')}>
    <h3>Importar Leads (CSV)</h3>
    <p>Colunas: <code>origem</code> (obrigatória), <code>curso</code>, <code>etapa</code> (lead/contato/visita/inscricao/matricula)</p>
    <textarea rows={8} value={csv} onChange={e => setCsv(e.target.value)} placeholder="origem,curso,etapa&#10;Google Ads,Direito,lead&#10;Instagram,Administração,contato" />
    <div className="cbi-dialog-actions">
      <button type="button" onClick={handleImport}>Importar</button>
      <form method="dialog"><button>Fechar</button></form>
    </div>
    {status && <p className="cbi-status">{status}</p>}
  </dialog>;
}

/* ---------- Main Component ---------- */
export default function CaptacaoBI({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [custos, setCustos] = useState<CustoCaptacao[]>([]);
  const [snapshots, setSnapshots] = useState<CaptacaoSnapshot[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const [tv, setTv] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLDialogElement>(null);

  async function loadData() {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError('');
    try {
      const [l, c, s] = await Promise.all([
        fetchLeads(institutionId),
        fetchCustos(institutionId),
        fetchSnapshots(institutionId),
      ]);
      if (requestId !== loadRequestId.current) return;
      // Nunca substituir dados ausentes ou consultas com falha por indicadores fictícios.
      setLeads(l);
      setCustos(c);
      setSnapshots(s);
      setUpdatedAt(new Date().toISOString());
    } catch {
      if (requestId !== loadRequestId.current) return;
      setLeads([]);
      setCustos([]);
      setSnapshots([]);
      setUpdatedAt(null);
      setError('Não foi possível consultar os dados reais de captação. Tente atualizar.');
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    return () => { loadRequestId.current += 1; };
  }, [institutionId]);

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

  const bi = aggregateBI(leads, custos, snapshots);
  const noData = leads.length === 0 && custos.length === 0 && snapshots.length === 0;

  if (loading) return <section className="cbi-root"><p role="status">Carregando BI de captação…</p></section>;

  return <section ref={panelRef} className={`cbi-root ${tv ? 'cbi-tv' : ''}`}>
    <div className="cbi-header">
      <div>
        <h2>BI de Captação</h2>
        <p>{institutionName}</p>
      </div>
      <div className="cbi-actions">
        <button type="button" onClick={() => importRef.current?.showModal()}>Importar CSV</button>
        <button type="button" onClick={toggleTv}>{tv ? 'Sair modo TV' : 'Modo TV'}</button>
        <button type="button" onClick={loadData}>Atualizar</button>
      </div>
    </div>

    {error && <p role="alert" className="cbi-error">{error}</p>}
    {updatedAt && <p className="cbi-status">Última consulta ao Supabase: {new Date(updatedAt).toLocaleString('pt-BR')}</p>}

    {noData ? (
      <section className="cbi-card" aria-live="polite">
        <h3>{error ? 'Indicadores indisponíveis' : 'Nenhum dado real de captação'}</h3>
        <p>{error
          ? 'Os indicadores não foram exibidos porque a consulta falhou. Atualize para tentar novamente.'
          : 'Ainda não existem leads, custos ou registros mensais para esta instituição. Importe um CSV ou integre uma fonte de dados para visualizar os indicadores.'}</p>
      </section>
    ) : (
      <>
        <KPITiles kpis={bi.kpis} snapshots={snapshots} />
        <div className="cbi-grid">
          <FunnelChart data={bi.funnel} />
          <HBarChart title="Leads por Origem" data={bi.origens} valueKey="leads" labelKey="canal" />
          <EvolucaoChart data={bi.evolucao} />
          <HBarChart title="Custo por Canal" data={bi.custosCanal} valueKey="investimento" labelKey="canal"
            formatValue={v => fmtMoney.format(v)} subtitle="Investimento total por canal" />
          <DonutChart title="Matrículas por Curso" data={bi.cursos} valueKey="mat" labelKey="curso" />
          <ConversaoChart data={bi.conversao} />
        </div>
      </>
    )}

    <ImportDialog institutionId={institutionId} onImported={loadData} dialogRef={importRef} />
  </section>;
}
