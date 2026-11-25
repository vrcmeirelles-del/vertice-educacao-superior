// BI da Gestão — gráficos coloridos por módulo, BI geral e área de navegação entre BIs.
// Dados: somente registros reais da instituição (RLS do usuário). Ver lib/management-bi.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Legend, Pie, PieChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  MODULES, MODULE_BY_TAB, PALETTE, loadFacet, loadVolume,
  type FacetResult, type ModuleBI, type Slice,
} from '@/lib/management-bi';
import './management-bi.css';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const pct = (v: number, t: number) => (t > 0 ? `${Math.round((v / t) * 100)}%` : '0%');
const colorAt = (i: number, offset = 0) => PALETTE[(i + offset) % PALETTE.length];

function TooltipBox({ active, payload }: { active?: boolean; payload?: { name?: string; value?: number; payload?: { total?: number; value?: number; name?: string; payload?: { total?: number; value?: number; name?: string } } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const row = p.payload?.payload ?? p.payload;
  const value = row?.value;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return <div className="mbi-tip"><strong>{row?.name ?? p.name}</strong><span>{fmt(value)}{row?.total ? ` · ${pct(value, row.total)}` : ''}</span></div>;
}

/* ── Gráficos ──────────────────────────────────────────────── */

type PrismRow = { name: string; value: number; total: number; fill: string; shape: number };

function PrismShape({ data }: { data: PrismRow[] }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const chartData = data.map(d => ({ ...d, total }));
  return (
    <div className="mbi-prism">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40)}>
        <FunnelChart>
          <Tooltip content={<TooltipBox />} />
          <Funnel data={chartData} dataKey="shape" nameKey="name" isAnimationActive stroke="#fff" strokeWidth={2}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      <p className="mbi-source">Larguras ilustrativas; valores e percentuais reais na legenda.</p>
      <ol className="mbi-prism-legend">
        {data.map((d, i) => (
          <li key={i} style={{ ['--mbi-step' as string]: d.fill }}>
            <span className="mbi-prism-dot" aria-hidden="true" />
            <span className="mbi-prism-name">{d.name}</span>
            <strong>{fmt(d.value)}</strong>
            <em>{pct(d.value, total)}</em>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PieView({ slices, donut, offset }: { slices: Slice[]; donut?: boolean; offset: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const data = slices.map((s) => ({ ...s, total }));
  return (
    <div className="mbi-chart-box">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <defs>
            {data.map((_, i) => (
              <linearGradient key={i} id={`mbi-g-${offset}-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={colorAt(i, offset)} stopOpacity={0.82} />
                <stop offset="100%" stopColor={colorAt(i, offset)} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={donut ? '52%' : 0} outerRadius="80%"
            paddingAngle={data.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} isAnimationActive
            label={data.length <= 6 ? ({ percent }: { percent?: number }) => `${Math.round((percent ?? 0) * 100)}%` : false} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={`url(#mbi-g-${offset}-${i})`} />)}
          </Pie>
          <Tooltip content={<TooltipBox />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {donut && <div className="mbi-donut-center"><strong>{fmt(total)}</strong><span>total</span></div>}
    </div>
  );
}

function PrismView({ slices, offset }: { slices: Slice[]; offset: number }) {
  const total = slices.reduce((acc, x) => acc + x.value, 0);
  // Largura decrescente para ler como prisma; o valor real fica na legenda.
  const max = Math.max(...slices.map((x) => x.value), 1);
  const data = slices.map((x, i) => ({ name: x.name, value: x.value, total, fill: colorAt(i, offset), shape: max * (1 - (i / Math.max(slices.length, 1)) * 0.7) }));
  return <PrismShape data={data} />;
}

function BarsView({ slices, offset }: { slices: Slice[]; offset: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const data = slices.map((s) => ({ ...s, total }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive>
          {data.map((_, i) => <Cell key={i} fill={colorAt(i, offset)} />)}
          <LabelList dataKey="value" position="right" fontSize={11} formatter={(v: unknown) => fmt(Number(v))} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function FacetCard({ result, offset }: { result: FacetResult; offset: number }) {
  const { facet, slices, total, denied } = result;
  const kindLabel = { pie: 'Pizza', donut: 'Rosca', prism: 'Prisma', bars: 'Barras', radial: 'Radial' }[facet.chart];
  return (
    <article className="mbi-card" style={{ ['--mbi-accent' as string]: colorAt(0, offset) }}>
      <header><h4>{facet.title}</h4><span className="mbi-chip">{kindLabel}</span></header>
      {denied ? <p className="mbi-empty">Sem acesso a esta fonte para o seu perfil.</p>
        : total === null ? <p className="mbi-empty">Dados indisponíveis; não é possível confirmar o total.</p>
        : total === 0 ? <p className="mbi-empty">Sem registros desta instituição ainda.</p>
        : facet.chart === 'prism' ? <PrismView slices={slices} offset={offset} />
        : facet.chart === 'bars' ? <BarsView slices={slices} offset={offset} />
        : <PieView slices={slices} donut={facet.chart === 'donut'} offset={offset} />}
      <footer>{total === null ? '' : `${fmt(total)} registro(s) visível(is) ao perfil`}</footer>
    </article>
  );
}

/* ── BI de um módulo ───────────────────────────────────────── */

export function ModuleBIPanel({ module, institutionId }: { module: ModuleBI; institutionId: string }) {
  const [results, setResults] = useState<FacetResult[] | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  useEffect(() => {
    let alive = true;
    setResults(null);
    setVolume(null);
    setUpdated(null);
    Promise.all([Promise.all(module.facets.map((f) => loadFacet(institutionId, f))), loadVolume(institutionId, module.volume.table)])
      .then(([r, v]) => { if (alive) { setResults(r); setVolume(v); setUpdated(new Date()); } })
      .catch(() => { if (alive) setResults([]); });
    return () => { alive = false; };
  }, [module, institutionId]);
  const offset = MODULES.indexOf(module) * 3;
  return (
    <section className="mbi-module" aria-label={`BI de ${module.label}`}>
      <div className="mbi-module-head" style={{ background: `linear-gradient(120deg, ${module.color}, ${colorAt(4, offset)})` }}>
        <span className="mbi-module-icon" aria-hidden="true">{module.icon}</span>
        <div><h3>BI · {module.label}</h3><p>{volume === null ? 'Volume indisponível ou em consulta' : `${fmt(volume)} ${module.volume.label}`}</p></div>
        {updated && <small>Atualizado às {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>}
      </div>
      {!results ? <p role="status" className="mbi-loading">Montando os gráficos…</p> : (
        <div className="mbi-grid">{results.map((r, i) => <FacetCard key={r.facet.table + r.facet.column} result={r} offset={offset + i * 2} />)}</div>
      )}
      <p className="mbi-source">Fonte: registros desta instituição no sistema ({[...new Set(module.facets.map((f) => f.table))].join(', ')}). Sem dados estimados ou fictícios.</p>
    </section>
  );
}

/** Faixa recolhível exibida no topo de cada módulo do painel institucional. */
export function ModuleBIStrip({ tab, institutionId }: { tab: string; institutionId: string }) {
  const module = MODULE_BY_TAB[tab];
  const storageKey = 'vx-module-bi-open';
  const [open, setOpen] = useState<boolean>(() => { try { return localStorage.getItem(storageKey) !== '0'; } catch { return true; } });
  if (!module) return null;
  const toggle = () => { const next = !open; setOpen(next); try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* noop */ } };
  return (
    <div className="mbi-strip">
      <button type="button" className="mbi-strip-toggle" aria-expanded={open} onClick={toggle} style={{ ['--mbi-accent' as string]: module.color }}>
        <span aria-hidden="true">📊</span> {open ? 'Ocultar' : 'Mostrar'} BI deste módulo
      </button>
      {open && <ModuleBIPanel key={institutionId + ":" + module.key} module={module} institutionId={institutionId} />}
    </div>
  );
}

/* ── BI Geral ──────────────────────────────────────────────── */

interface VolumeRow { module: ModuleBI; value: number | null }

export function GeneralBI({ institutionId, modules }: { institutionId: string; modules: ModuleBI[] }) {
  const [volumes, setVolumes] = useState<VolumeRow[] | null>(null);
  const [highlights, setHighlights] = useState<FacetResult[]>([]);
  useEffect(() => {
    let alive = true;
    setVolumes(null);
    setHighlights([]);
    Promise.all(modules.map(async (m) => ({ module: m, value: await loadVolume(institutionId, m.volume.table) })))
      .then((v) => { if (alive) setVolumes(v); });
    const picks = ['metas', 'cadastro', 'geral', 'repositorio'].map((k) => modules.find((m) => m.key === k)?.facets[0]).filter(Boolean);
    Promise.all(picks.map((f) => loadFacet(institutionId, f!))).then((h) => { if (alive) setHighlights(h); });
    return () => { alive = false; };
  }, [institutionId, modules]);

  const used = useMemo(() => (volumes ?? []).filter((v) => (v.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), [volumes]);
  const total = used.reduce((s, v) => s + (v.value ?? 0), 0);
  const active = used.length;
  const empty = (volumes ?? []).filter(v => v.value === 0).length;
  const missing = (volumes ?? []).filter(v => v.value === null).length;
  const known = active + empty;
  const pieData = used.map((v) => ({ name: v.module.label, value: v.value ?? 0, total, color: v.module.color }));
  const prism = used.slice(0, 8).map((v, i) => ({ name: v.module.label, value: v.value ?? 0, total, fill: colorAt(i), shape: (used[0]?.value ?? 1) * (1 - i * 0.09) }));
  const maxLog = Math.log10((used[0]?.value ?? 1) + 1) || 1;
  const radar = (volumes ?? []).filter(v => v.value !== null).slice(0, 14).map((v) => ({ module: v.module.label.length > 16 ? v.module.label.slice(0, 15) + '…' : v.module.label, uso: Math.round((Math.log10((v.value ?? 0) + 1) / maxLog) * 100) }));

  return (
    <section className="mbi-general" aria-label="BI Geral da instituição">
      <div className="mbi-general-head">
        <h3>🌈 BI Geral</h3>
        <p>Visão consolidada de todos os módulos desta instituição. Clique num módulo abaixo para abrir o BI dele.</p>
      </div>
      {!volumes ? <p role="status" className="mbi-loading">Consolidando os módulos…</p> : (
        <>
          <div className="mbi-kpis">
            <div className="mbi-kpi" style={{ background: 'linear-gradient(135deg,#6366f1,#ec4899)' }}><span>{missing ? 'Registros confirmados (parcial)' : 'Registros nos módulos'}</span><strong>{known ? fmt(total) : '—'}</strong></div>
            <div className="mbi-kpi" style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}><span>Módulos com dados</span><strong>{active} de {modules.length}</strong></div>
            <div className="mbi-kpi" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}><span>Módulo com mais registros confirmados</span><strong>{used[0]?.module.label ?? '—'}</strong></div>
            <div className="mbi-kpi" style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)' }}><span>Módulos sem registros visíveis</span><strong>{empty}</strong></div>
          </div>
          <p className="mbi-source" role="status">Fontes disponíveis: {known} de {modules.length}. Indisponíveis: {missing}. Contagens limitadas aos registros visíveis ao perfil.</p>
          {total === 0 ? <p className="mbi-empty">{missing ? 'Nenhum registro confirmado nas fontes disponíveis; há fontes indisponíveis.' : 'Nenhum registro visível nos módulos consultados.'}</p> : (
            <div className="mbi-grid">
              <article className="mbi-card mbi-wide"><header><h4>Volume por módulo</h4><span className="mbi-chip">Pizza</span></header>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius="80%" innerRadius="38%" paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color ?? colorAt(i)} />)}
                    </Pie>
                    <Tooltip content={<TooltipBox />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </article>
              <article className="mbi-card"><header><h4>Prisma dos módulos mais usados</h4><span className="mbi-chip">Prisma</span></header>
                <PrismShape data={prism} />
              </article>
              <article className="mbi-card"><header><h4>Mapa de uso dos módulos</h4><span className="mbi-chip">Radar</span></header>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radar} outerRadius="72%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="module" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="uso" stroke="#ec4899" fill="url(#mbi-radar)" fillOpacity={0.7} isAnimationActive />
                    <defs><linearGradient id="mbi-radar" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs>
                  </RadarChart>
                </ResponsiveContainer>
                <footer>Escala logarítmica do volume de registros (0 a 100), para comparar módulos de tamanhos muito diferentes.</footer>
              </article>
              <article className="mbi-card mbi-wide"><header><h4>Registros por módulo</h4><span className="mbi-chip">Barras</span></header>
                <BarsView slices={used.map((v) => ({ name: v.module.label, value: v.value ?? 0, raw: v.module.key }))} offset={0} />
              </article>
              {highlights.filter((h) => h.total === null || h.total > 0).map((h, i) => <FacetCard key={h.facet.table + h.facet.column} result={h} offset={5 + i * 3} />)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ── Área "BI da Gestão" ───────────────────────────────────── */

export default function ManagementBIArea({ institutionId, availableTabs }: { institutionId: string; availableTabs: string[] }) {
  return <ManagementBIContent key={institutionId + ':' + [...availableTabs].sort().join(',')} institutionId={institutionId} availableTabs={availableTabs} />;
}

function ManagementBIContent({ institutionId, availableTabs }: { institutionId: string; availableTabs: string[] }) {
  const modules = useMemo(() => MODULES.filter((m) => availableTabs.includes(m.key)), [availableTabs]);
  const [selected, setSelected] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    setCounts({});
    Promise.all(modules.map(async (m) => [m.key, await loadVolume(institutionId, m.volume.table)] as const))
      .then((r) => { if (alive) setCounts(Object.fromEntries(r)); });
    return () => { alive = false; };
  }, [institutionId, modules]);
  const open = (key: string) => {
    setSelected((cur) => (cur === key ? null : key));
    window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const current = modules.find((m) => m.key === selected) ?? null;
  return (
    <div className="mbi-area">
      <GeneralBI key={institutionId + ":" + modules.map(m => m.key).join(",")} institutionId={institutionId} modules={modules} />
      <section aria-label="BIs por módulo">
        <h3 className="mbi-section-title">📊 BIs por módulo</h3>
        <div className="mbi-tiles">
          {modules.map((m, i) => {
            const n = counts[m.key];
            return (
              <button type="button" key={m.key} className={selected === m.key ? 'mbi-tile selected' : 'mbi-tile'} aria-pressed={selected === m.key} onClick={() => open(m.key)}
                style={{ background: `linear-gradient(135deg, ${m.color}, ${colorAt(i + 5)})` }}>
                <span className="mbi-tile-icon" aria-hidden="true">{m.icon}</span>
                <strong>{m.label}</strong>
                <small>{n === undefined ? '…' : n === null ? 'indisponível' : `${fmt(n)} ${m.volume.label}`}</small>
              </button>
            );
          })}
        </div>
      </section>
      <div ref={panelRef}>{current && <ModuleBIPanel key={institutionId + ":" + current.key} module={current} institutionId={institutionId} />}</div>
    </div>
  );
}
