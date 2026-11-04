/**
 * Painel Executivo de BI — Vértice Superior
 *
 * Estética: livro de registro institucional.
 * Cor é informação, não decoração.
 * Réguas em vez de cards. Número herói. Assimetria deliberada.
 *
 * Dados reais via Supabase (RLS ativo).
 * Fuso de referência: America/Sao_Paulo.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Institution, Course, Enrollment } from '@/components/InstitutionArea';
import type {
  FiltroBI, KpiResumo, EtapaFunil, FatiaCategoria,
  SerieTemporal, Alerta, CursoRisco, CelulaHeatmap,
  SaudeIndicador,
} from '@/lib/bi/types';
import {
  getSemestres, getKPIs, getSerieTemporal, getFunil,
  getComposicaoPorCurso, getCursosRisco, getAlertas,
  getSaudePeriodo, getHeatmap, exportCSV,
} from '@/lib/bi/queries';
import { fmtInt, fmtPct, fmtBRL, fmtKPI, fmtVariacao } from '@/lib/bi/format';
import './painel-bi.css';

// ================================================================
// Sub-componentes
// ================================================================

/* ---------- Sparkline ---------- */
function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = 24;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`
  ).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="bi-spark" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Info button ---------- */
function InfoBtn({ text }: { text: string }) {
  return (
    <button type="button" className="bi-kpi-info" title={text} aria-label={text}>
      i
    </button>
  );
}

/* ---------- Variação com cor direcional ---------- */
function Variacao({ valor, direcao }: { valor: number | null; direcao: 'cima' | 'baixo' }) {
  const { texto, sinal } = fmtVariacao(valor, direcao);
  const arrow = valor === null ? '' : valor >= 0 ? '↑' : '↓';
  return (
    <span className={`bi-var-${sinal}`}>
      {arrow} {texto}
    </span>
  );
}

/* ---------- Estado: carregando ---------- */
function Skeleton({ height = 40 }: { height?: number }) {
  return <div className="bi-skeleton" style={{ height }} />;
}

/* ---------- Estado: erro ---------- */
function Erro({ mensagem, onRetry }: { mensagem: string; onRetry: () => void }) {
  return (
    <div className="bi-erro">
      {mensagem}
      <br />
      <button type="button" onClick={onRetry}>Tentar novamente</button>
    </div>
  );
}

/* ---------- Estado: vazio ---------- */
function Vazio({ mensagem }: { mensagem: string }) {
  return <p className="bi-vazio">{mensagem}</p>;
}

/* ---------- Bloco Herói ---------- */
function BlocoHeroi({ kpis }: { kpis: KpiResumo[] }) {
  const principal = kpis.find(k => k.chave === 'matriculados');
  const secundario = kpis.find(k => k.chave === 'ocupacao');

  if (!principal) return <Vazio mensagem="Nenhum dado de matrícula disponível para este recorte." />;

  return (
    <div className="bi-heroi">
      <div className="bi-heroi-principal">
        <p className="bi-heroi-rotulo">{principal.rotulo}</p>
        <div className="bi-heroi-numero">{fmtKPI(principal.valor, principal.unidade)}</div>
        <div className="bi-heroi-variacao">
          <Variacao valor={principal.variacaoPct} direcao={principal.direcaoDesejada} />
          <span className="bi-meta">vs. semestre anterior</span>
        </div>
        <Spark data={principal.tendencia} color="#14432F" />
      </div>
      {secundario && secundario.valor !== null && (
        <div className="bi-heroi-secundario">
          <p className="bi-heroi-rotulo">{secundario.rotulo}</p>
          <div className="bi-heroi-numero">{fmtKPI(secundario.valor, secundario.unidade)}</div>
          <p className="bi-meta">{secundario.definicao}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Faixa de KPIs ---------- */
function FaixaKPIs({ kpis }: { kpis: KpiResumo[] }) {
  const strip = kpis.filter(k => k.chave !== 'matriculados' && k.chave !== 'ocupacao');
  if (!strip.length) return null;

  return (
    <div className="bi-kpi-strip">
      {strip.map(k => (
        <div className="bi-kpi-item" key={k.chave}>
          <p className="bi-kpi-label">
            {k.rotulo} <InfoBtn text={k.definicao} />
          </p>
          <p className="bi-kpi-valor">{fmtKPI(k.valor, k.unidade)}</p>
          {k.variacaoPct !== null && (
            <div className="bi-kpi-var">
              <Variacao valor={k.variacaoPct} direcao={k.direcaoDesejada} />
            </div>
          )}
          {k.tendencia.length > 1 && (
            <Spark data={k.tendencia} color="#14432F" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Série Temporal (SVG) ---------- */
function SerieTemporal_({ serie }: { serie: SerieTemporal }) {
  if (!serie.pontos.length) return <Vazio mensagem="Sem dados de série temporal no período." />;
  const w = 600, h = 200, px = 50, py = 30;
  const maxY = Math.max(...serie.pontos.map(p => p.valor), 1);
  const n = serie.pontos.length;
  const xStep = n > 1 ? (w - px * 2) / (n - 1) : 0;
  const toX = (i: number) => px + i * xStep;
  const toY = (v: number) => py + (h - py * 2) * (1 - v / maxY);

  const line = serie.pontos.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(p.valor)}`
  ).join(' ');

  // Grid horizontal (4 linhas)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => maxY * f);

  return (
    <div className="bi-serie-container">
      <svg viewBox={`0 0 ${w} ${h}`} className="bi-serie-svg" role="img"
        aria-label={`Gráfico: ${serie.rotulo}`}>
        {/* Grid */}
        {gridLines.map(v => (
          <g key={v}>
            <line x1={px} y1={toY(v)} x2={w - px} y2={toY(v)}
              stroke="#D9DED7" strokeWidth="0.5" />
            <text x={px - 6} y={toY(v) + 3} textAnchor="end" fontSize="10">
              {fmtInt(v)}
            </text>
          </g>
        ))}
        {/* Linha principal */}
        <path d={line} fill="none" stroke="#14432F" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Pontos */}
        {serie.pontos.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.valor)} r="4" fill="#14432F" />
            <title>{`${p.data}: ${fmtInt(p.valor)}`}</title>
          </g>
        ))}
        {/* Rótulos do eixo X */}
        {serie.pontos.map((p, i) => (
          <text key={i} x={toX(i)} y={h - 6} textAnchor="middle" fontSize="10">
            {p.data}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ---------- Funil de captação ---------- */
function FunilCaptacao({ etapas }: { etapas: EtapaFunil[] }) {
  if (!etapas.length) return <Vazio mensagem="Sem dados de captação para montar o funil." />;
  const max = Math.max(...etapas.map(e => e.volume), 1);

  return (
    <div className="bi-funil">
      {etapas.map(e => (
        <div className="bi-funil-row" key={e.etapa}>
          <span className="bi-funil-label">{e.etapa}</span>
          <div className="bi-funil-track">
            <div className="bi-funil-bar"
              style={{ width: `${Math.max(8, (e.volume / max) * 100)}%` }}>
              {fmtInt(e.volume)}
            </div>
          </div>
          <span className="bi-funil-conv">
            {e.conversaoPct !== null ? fmtPct(e.conversaoPct) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Composição por curso ---------- */
function ComposicaoCurso({ fatias }: { fatias: FatiaCategoria[] }) {
  if (!fatias.length) return <Vazio mensagem="Sem dados de composição no período." />;
  const max = Math.max(...fatias.map(f => f.valor), 1);

  return (
    <div className="bi-hbars">
      {fatias.slice(0, 8).map((f, i) => (
        <div className="bi-hbar-row" key={f.chave}>
          <span className="bi-hbar-label" title={f.rotulo}>{f.rotulo}</span>
          <div className="bi-hbar-track">
            <div className={`bi-hbar-fill${i === 0 ? ' top' : ''}`}
              style={{ width: `${(f.valor / max) * 100}%`, opacity: i === 0 ? 1 : 0.6 }} />
          </div>
          <span className="bi-hbar-value">{fmtPct(f.participacaoPct)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Tabela de cursos em risco ---------- */
function TabelaRisco({ cursos }: { cursos: CursoRisco[] }) {
  if (!cursos.length) return <p className="bi-alerta-vazio">Nenhum curso fora da faixa de ocupação no período.</p>;

  const tendenciaIcon = (t: string) => t === 'subindo' ? '↑' : t === 'caindo' ? '↓' : '→';

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="bi-tabela">
        <thead>
          <tr>
            <th></th>
            <th>Curso</th>
            <th>Grau</th>
            <th>Ocupação</th>
            <th>Tendência</th>
          </tr>
        </thead>
        <tbody>
          {cursos.slice(0, 8).map(c => (
            <tr key={c.id}>
              <td className={`bi-tabela-sinal bi-tabela-sinal-${c.sinal}`}></td>
              <td>{c.nome}</td>
              <td style={{ fontSize: '12px', color: 'var(--bi-tinta-fraca)' }}>{c.grau}</td>
              <td>{c.ocupacaoPct !== null ? fmtPct(c.ocupacaoPct) : '—'}</td>
              <td>
                <span className="bi-tabela-tendencia">
                  {tendenciaIcon(c.tendencia)} {c.tendencia}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Alertas laterais ---------- */
function PainelAlertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) {
    return <p className="bi-alerta-vazio">Nenhum indicador fora da faixa no período.</p>;
  }

  return (
    <ul className="bi-alertas">
      {alertas.map((a, i) => (
        <li className="bi-alerta-item" key={i}>
          <span className={`bi-alerta-dot bi-alerta-dot-${a.severidade}`} />
          <div>
            {a.descricao}
            {a.href && (
              <a className="bi-alerta-link" href={a.href}> Abrir →</a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Saúde do período ---------- */
function SaudePeriodo({ indicadores }: { indicadores: SaudeIndicador[] }) {
  if (!indicadores.length) return null;

  const dotColor = (sinal: string) =>
    sinal === 'ok' ? 'var(--bi-sinal-bom)'
    : sinal === 'atencao' ? 'var(--bi-sinal-atencao)'
    : 'var(--bi-sinal-critico)';

  const labelSinal = (sinal: string) =>
    sinal === 'ok' ? 'meta' : sinal === 'atencao' ? 'atenção' : 'abaixo';

  return (
    <ul className="bi-saude">
      {indicadores.map(ind => (
        <li className="bi-saude-item" key={ind.rotulo}>
          <span className="bi-saude-rotulo">{ind.rotulo}</span>
          <span className="bi-saude-badge">
            <svg width="8" height="8" aria-hidden="true">
              <circle cx="4" cy="4" r="4" fill={dotColor(ind.sinal)} />
            </svg>
            {labelSinal(ind.sinal)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Heatmap ---------- */
function Heatmap({ cells }: { cells: CelulaHeatmap[] }) {
  if (!cells.length) return <Vazio mensagem="Sem dados suficientes para o mapa de calor." />;

  const linhas = [...new Set(cells.map(c => c.linha))];
  const colunas = [...new Set(cells.map(c => c.coluna))].sort();
  const max = Math.max(...cells.map(c => c.valor), 1);

  const heat = (v: number) => {
    const ratio = v / max;
    if (ratio === 0) return 'bi-heat-0';
    if (ratio < 0.25) return 'bi-heat-1';
    if (ratio < 0.5) return 'bi-heat-2';
    if (ratio < 0.75) return 'bi-heat-3';
    return 'bi-heat-4';
  };

  return (
    <div className="bi-heatmap" style={{
      gridTemplateColumns: `140px repeat(${colunas.length}, 1fr)`,
    }}>
      <div className="bi-heatmap-header"></div>
      {colunas.map(col => <div key={col} className="bi-heatmap-header">{col}</div>)}
      {linhas.slice(0, 10).map(linha => (
        <React.Fragment key={linha}>
          <div className="bi-heatmap-header" style={{ textAlign: 'left' }}
            title={linha}>
            {linha.length > 18 ? linha.slice(0, 18) + '…' : linha}
          </div>
          {colunas.map(col => {
            const cell = cells.find(c => c.linha === linha && c.coluna === col);
            return (
              <div key={`${linha}-${col}`}
                className={`bi-heatmap-cell ${heat(cell?.valor ?? 0)}`}
                title={`${linha} · ${col}: ${fmtInt(cell?.valor ?? 0)}`}>
                {cell ? fmtInt(cell.valor) : '—'}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ================================================================
// Componente principal
// ================================================================

type Props = {
  institutions: Institution[];
  courses: Course[];
  enrollments: Enrollment[];
  session: Session;
};

export default function PainelBI({ institutions, courses, enrollments, session }: Props) {
  const [instId, setInstId] = useState(institutions[0]?.id ?? '');
  const [semestre, setSemestre] = useState('');
  const [semestres, setSemestres] = useState<string[]>([]);
  const [grau, setGrau] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Data states
  const [kpis, setKpis] = useState<KpiResumo[] | null>(null);
  const [serie, setSerie] = useState<SerieTemporal | null>(null);
  const [funil, setFunil] = useState<EtapaFunil[] | null>(null);
  const [composicao, setComposicao] = useState<FatiaCategoria[] | null>(null);
  const [risco, setRisco] = useState<CursoRisco[] | null>(null);
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [saude, setSaude] = useState<SaudeIndicador[] | null>(null);
  const [heatmap, setHeatmapData] = useState<CelulaHeatmap[] | null>(null);

  // Error states (per block)
  const [erros, setErros] = useState<Record<string, string>>({});

  const filtro: FiltroBI = {
    instituicaoId: instId,
    semestre: semestre || undefined,
    grau: grau || undefined,
  };

  const setErro = useCallback((bloco: string, msg: string) => {
    setErros(prev => ({ ...prev, [bloco]: msg }));
  }, []);

  const clearErro = useCallback((bloco: string) => {
    setErros(prev => {
      const next = { ...prev };
      delete next[bloco];
      return next;
    });
  }, []);

  // Load semestres
  useEffect(() => {
    if (!instId) return;
    getSemestres(instId).then(setSemestres).catch(() => setSemestres([]));
  }, [instId]);

  // Load all data
  const loadAll = useCallback(() => {
    if (!instId) return;
    const f = { ...filtro };
    setLastUpdate(new Date());

    // KPIs
    setKpis(null);
    clearErro('kpis');
    getKPIs(f).then(setKpis).catch(() => setErro('kpis', 'Não foi possível calcular os indicadores.'));

    // Série
    setSerie(null);
    clearErro('serie');
    getSerieTemporal(f).then(setSerie).catch(() => setErro('serie', 'Série temporal indisponível.'));

    // Funil
    setFunil(null);
    clearErro('funil');
    getFunil(f).then(setFunil).catch(() => setErro('funil', 'Funil de captação indisponível.'));

    // Composição
    setComposicao(null);
    clearErro('composicao');
    getComposicaoPorCurso(f).then(setComposicao).catch(() => setErro('composicao', 'Composição por curso indisponível.'));

    // Cursos em risco
    setRisco(null);
    clearErro('risco');
    getCursosRisco(f).then(setRisco).catch(() => setErro('risco', 'Cursos em risco indisponível.'));

    // Alertas
    setAlertas(null);
    clearErro('alertas');
    getAlertas(f).then(setAlertas).catch(() => setErro('alertas', 'Alertas indisponíveis.'));

    // Saúde
    setSaude(null);
    clearErro('saude');
    getSaudePeriodo(f).then(setSaude).catch(() => setErro('saude', 'Saúde do período indisponível.'));

    // Heatmap
    setHeatmapData(null);
    clearErro('heatmap');
    getHeatmap(f).then(setHeatmapData).catch(() => setErro('heatmap', 'Mapa de calor indisponível.'));
  }, [instId, semestre, grau]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Export
  const handleExport = useCallback(async () => {
    try {
      const csv = await exportCSV(filtro);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bi-vertice-${instId}-${semestre || 'todos'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Não foi possível exportar os dados.');
    }
  }, [filtro, instId, semestre]);

  const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Render block with state management
  function renderBloco(
    bloco: string,
    data: unknown | null,
    render: () => React.ReactNode,
    skeletonH = 60,
  ) {
    if (erros[bloco]) return <Erro mensagem={erros[bloco]} onRetry={loadAll} />;
    if (data === null) return <Skeleton height={skeletonH} />;
    return render();
  }

  return (
    <section className="painel-bi" aria-label="Painel Executivo de BI">
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <h1>Painel Executivo</h1>
      <p className="bi-meta">
        Visão institucional · última atualização {fmtTime(lastUpdate)}
      </p>

      {/* ---- Filtros ---- */}
      <div className="bi-filtros">
        <label>
          Instituição
          <select value={instId} onChange={e => { setInstId(e.target.value); setSemestre(''); }}>
            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label>
          Semestre
          <select value={semestre} onChange={e => setSemestre(e.target.value)}>
            <option value="">Todos</option>
            {semestres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Grau
          <select value={grau} onChange={e => setGrau(e.target.value)}>
            <option value="">Todos</option>
            <option value="bacharelado">Bacharelado</option>
            <option value="licenciatura">Licenciatura</option>
            <option value="tecnologo">Tecnólogo</option>
            <option value="especializacao">Especialização</option>
          </select>
        </label>
        <button type="button" className="bi-refresh" onClick={loadAll}>
          ⟳ Atualizar
        </button>
      </div>

      {/* ---- Layout principal ---- */}
      <div className="bi-layout">
        {/* Coluna principal */}
        <div>
          {/* Herói */}
          <div className="bi-secao">
            {renderBloco('kpis', kpis, () => <BlocoHeroi kpis={kpis!} />, 100)}
          </div>

          {/* KPIs secundários */}
          <div className="bi-secao">
            {renderBloco('kpis', kpis, () => <FaixaKPIs kpis={kpis!} />, 80)}
          </div>

          {/* Série temporal */}
          <div className="bi-secao">
            <h2>Evolução de Matrículas</h2>
            {renderBloco('serie', serie, () => <SerieTemporal_ serie={serie!} />, 200)}
          </div>

          {/* Composição + Funil */}
          <div className="bi-secao">
            <div className="bi-grid-2">
              <div>
                <h2>Composição por Curso</h2>
                {renderBloco('composicao', composicao, () => <ComposicaoCurso fatias={composicao!} />, 160)}
              </div>
              <div>
                <h2>Funil de Captação</h2>
                {renderBloco('funil', funil, () => <FunilCaptacao etapas={funil!} />, 160)}
              </div>
            </div>
          </div>

          {/* Cursos em risco */}
          <div className="bi-secao">
            <h2>Cursos em Risco</h2>
            {renderBloco('risco', risco, () => <TabelaRisco cursos={risco!} />, 120)}
          </div>

          {/* Heatmap */}
          <div className="bi-secao">
            <h2>Mapa de Calor · Matrículas por Curso e Semestre</h2>
            {renderBloco('heatmap', heatmap, () => <Heatmap cells={heatmap!} />, 120)}
          </div>

          {/* Exportação */}
          <div style={{ paddingTop: 20 }}>
            <button type="button" className="bi-exportar" onClick={handleExport}>
              ↓ Exportar CSV
            </button>
          </div>
        </div>

        {/* Coluna lateral */}
        <aside className="bi-lateral">
          <div>
            <h3>Alertas</h3>
            {renderBloco('alertas', alertas, () => <PainelAlertas alertas={alertas!} />, 80)}
          </div>
          <div>
            <h3>Saúde do Período</h3>
            {renderBloco('saude', saude, () => <SaudePeriodo indicadores={saude!} />, 80)}
          </div>
        </aside>
      </div>
    </section>
  );
}
