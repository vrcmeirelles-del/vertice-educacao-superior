import { GOAL_SIGNALS, summarizeGoalSignals, type GoalSignal, type GoalSignalEntry } from '@/lib/goal-signals';
import './goals-dashboard.css';

export function GoalSignalBadge({ signal, label }: { signal: GoalSignal; label?: string }) {
  return <span className={`goals-signal ${signal}`}><i aria-hidden="true" />{label ?? GOAL_SIGNALS.find(s => s.key === signal)!.label}</span>;
}

export function GoalSignalBar({ entries }: { entries: GoalSignalEntry[] }) {
  const { counts, total } = summarizeGoalSignals(entries);
  return <div className="goals-stack" role="img" aria-label={total ? GOAL_SIGNALS.map(s => `${s.label}: ${counts[s.key]}`).join('; ') : 'Sem metas cadastradas'}>
    {GOAL_SIGNALS.map(s => counts[s.key] > 0 && <span key={s.key} style={{ width: `${counts[s.key] / total * 100}%`, background: s.color }} />)}
  </div>;
}

export default function GoalsDashboard({ entries, filter, onFilter, onOpen, referenceDate, courseLabel }: {
  entries: GoalSignalEntry[]; filter: GoalSignal | ''; onFilter: (signal: GoalSignal | '') => void;
  onOpen: (entry: GoalSignalEntry) => void; referenceDate: string; courseLabel: (id: unknown) => string;
}) {
  const stats = summarizeGoalSignals(entries);
  let angle = 0;
  const stops = GOAL_SIGNALS.filter(s => stats.counts[s.key]).map(s => {
    const start = angle;
    angle += stats.counts[s.key] / stats.total * 100;
    return `${s.color} ${start}% ${angle}%`;
  });
  const priorities = entries.filter(e => e.signal === 'red' || e.signal === 'amber')
    .sort((a, b) => (a.signal === 'red' ? 0 : 1) - (b.signal === 'red' ? 0 : 1) || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || String(a.goal.title).localeCompare(String(b.goal.title), 'pt-BR'));
  const meters = [
    { label: 'Com medição', value: stats.measured, color: '#266f9e' },
    { label: 'Com responsável', value: stats.owners, color: '#14785c' },
    { label: 'Com prazo definido', value: stats.deadlines, color: '#755ba7' },
  ];
  return <section className="goals-dashboard" aria-label="Resumo executivo das metas">
    <div className="goals-summary-heading"><div><p className="goals-eyebrow">VISÃO DA ALTA GESTÃO</p><h4>O que precisa de atenção agora?</h4></div><span>{stats.total} meta(s) no recorte · {stats.near} com prazo em até 14 dias</span></div>
    <div className="goals-kpis">
      {GOAL_SIGNALS.map(s => <button type="button" key={s.key} className={`goals-kpi ${s.key} ${filter === s.key ? 'selected' : ''}`} aria-pressed={filter === s.key} onClick={() => onFilter(filter === s.key ? '' : s.key)}>
        <GoalSignalBadge signal={s.key} /><strong>{stats.counts[s.key]}</strong><small>{s.hint}</small><span className="goals-kpi-link">{filter === s.key ? 'Remover filtro' : 'Ver metas'} →</span>
      </button>)}
    </div>
    <div className="goals-chart-grid">
      <section className="goals-chart" aria-labelledby="goals-distribution-title">
        <p className="goals-eyebrow">SEMÁFORO DAS METAS</p><h4 id="goals-distribution-title">Distribuição dos alertas</h4>
        <div className="goals-composition">
          <div className="goals-donut" role="img" aria-label={stats.total ? `${stats.total} metas. ${GOAL_SIGNALS.map(s => `${s.label}: ${stats.counts[s.key]}`).join('; ')}` : 'Sem metas neste recorte'} style={{ background: stops.length ? `conic-gradient(${stops.join(',')})` : '#e7edf0' }}><div><strong>{stats.total}</strong><span>metas</span></div></div>
          <ul className="goals-legend">{GOAL_SIGNALS.map(s => <li key={s.key}><i style={{ background: s.color }} aria-hidden="true" /><span>{s.label}</span><strong>{stats.total ? Math.round(stats.counts[s.key] / stats.total * 100) : 0}%</strong></li>)}</ul>
        </div>
        <p className="goals-caption">Cada meta recebe um único sinal. Clique nos cartões acima para filtrar a lista.</p>
      </section>
      <section className="goals-chart" aria-labelledby="goals-data-title">
        <p className="goals-eyebrow">BASE PARA DECIDIR</p><h4 id="goals-data-title">Qualidade do acompanhamento</h4>
        {stats.active ? <div className="goals-meters">{meters.map(m => <div key={m.label} className="goals-meter"><div><span>{m.label}</span><strong>{m.value} / {stats.active}</strong></div><div className="goals-meter-track" aria-hidden="true"><span style={{ width: `${m.value / stats.active * 100}%`, background: m.color }} /></div></div>)}</div> : <p className="goals-empty">Não há metas em aberto neste recorte.</p>}
        <p className="goals-caption">Considera metas planejadas e em acompanhamento. As barras mostram cobertura de dados, não resultado alcançado.</p>
      </section>
    </div>
    <section className="goals-priorities" aria-labelledby="goals-priorities-title">
      <div className="goals-summary-heading"><div><p className="goals-eyebrow">PAUTA DA GESTÃO</p><h4 id="goals-priorities-title">Prioridades para acompanhar</h4></div><span>{priorities.length ? `Exibindo ${Math.min(5, priorities.length)} de ${priorities.length} metas com alerta` : 'Sem alertas neste recorte'}</span></div>
      {priorities.length ? <ol>{priorities.slice(0, 5).map(e => <li key={e.goal.id}><GoalSignalBadge signal={e.signal} /><div><small className="goals-priority-course">{courseLabel(e.goal.course_id)}</small><strong>{String(e.goal.title)}</strong><p>{e.reasons.slice(0, 2).join(' ')}</p></div><button type="button" className="corp-login-text-button" onClick={() => onOpen(e)}>Abrir meta →</button></li>)}</ol> : <p className="goals-empty">{entries.length ? 'Continue atualizando medições, prazos e evidências.' : 'Cadastre metas para iniciar o acompanhamento visual.'}</p>}
    </section>
    <details className="goals-rules"><summary>Como funcionam os sinais e os gráficos?</summary><p><strong>Vermelho:</strong> prazo vencido em meta não concluída nem cancelada. <strong>Amarelo:</strong> prazo vence em até 14 dias, meta planejada, responsável ou medição ausente, medição desatualizada, prazo ou alvo inválido, ou indicador de manutenção fora da faixa. <strong>Verde:</strong> nenhum desses alertas ou conclusão registrada no cadastro. <strong>Cinza:</strong> meta cancelada.</p><p>Verde não certifica resultado ou validação documental. A conclusão é informada pela equipe. A atualidade da medição usa intervalos de 31, 62, 93, 186 e 366 dias para as periodicidades mensal, bimestral, trimestral, semestral e anual. Medições futuras não compõem os alertas. Referência: {referenceDate.split('-').reverse().join('/')} (horário de Brasília).</p><p>Os gráficos seguem o curso e os filtros de classificação e busca. O filtro de cor atua na lista abaixo; os totais do resumo continuam mostrando o recorte completo.</p></details>
  </section>;
}
