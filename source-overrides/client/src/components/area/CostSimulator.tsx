import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import "./cost-simulator.css";

type Params = {
  hora_aula_graduado: number; hora_aula_especialista: number;
  hora_aula_mestre: number; hora_aula_doutor: number;
  encargos_pct: number; ensalamento_ideal_presencial: number;
  ensalamento_ideal_semipresencial: number; ensalamento_ideal_ead: number;
  overhead_pct: number; ticket_presencial: number;
  ticket_semipresencial: number; ticket_ead: number;
  meses_letivos: number; fator_dsr: number; ch_semanal_media: number;
  fonte_cct: string;
};

type Quant = {
  curso: string; semestre: string; total_matriculados: number;
  total_vinculos: number; trancado: number; abandono: number; cancelado: number;
};

const DEFAULT_PARAMS: Params = {
  hora_aula_graduado: 47.55, hora_aula_especialista: 52.54,
  hora_aula_mestre: 65.11, hora_aula_doutor: 77.63,
  encargos_pct: 0.68, ensalamento_ideal_presencial: 50,
  ensalamento_ideal_semipresencial: 80, ensalamento_ideal_ead: 120,
  overhead_pct: 0.35, ticket_presencial: 1200,
  ticket_semipresencial: 800, ticket_ead: 400,
  meses_letivos: 6, fator_dsr: 5.25, ch_semanal_media: 16,
  fonte_cct: 'CCT 2026/2028 SINTEPP-TO',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('pt-BR');

function detectModality(name: string): 'ead' | 'semipresencial' | 'presencial' {
  const n = name.toUpperCase();
  if (n.includes('EAD') || n.includes('A DISTÂNCIA') || n.includes('A DISTANCIA')) return 'ead';
  if (n.includes('SEMIPRESENCIAL') || n.includes('SEMI')) return 'semipresencial';
  return 'presencial';
}

type CourseResult = {
  curso: string; modalidade: 'ead' | 'semipresencial' | 'presencial';
  matriculados: number; vinculos: number; evasao: number;
  ensalamento_ideal: number; ocupacao: number;
  receita: number; custo_docente: number; overhead: number; custo_total: number;
  resultado: number; margem: number;
  turmas_estimadas: number; professores_estimados: number;
};

export default function CostSimulator({ institutionId }: { institutionId: string }) {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Params>(DEFAULT_PARAMS);
  const [quants, setQuants] = useState<Quant[]>([]);
  const [semester, setSemester] = useState('');
  const [semesters, setSemesters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Load params
      const { data: p } = await supabase.from('vertice_cost_parameters')
        .select('*').eq('institution_id', institutionId).maybeSingle();
      if (active && p) { setParams(p as unknown as Params); setDraft(p as unknown as Params); }

      // Load semesters
      const { data: sems } = await supabase.from('vertice_eorbit_semestres')
        .select('semestre').order('semestre', { ascending: false });
      if (active && sems) {
        const list = sems.map((s: { semestre: string }) => s.semestre);
        setSemesters(list);
        if (list.length) setSemester(list[0]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [institutionId]);

  useEffect(() => {
    if (!semester) return;
    let active = true;
    (async () => {
      const { data } = await supabase.rpc('vertice_cost_quantitativo', {
        p_instituicao_id: 'cda828bd-4f55-432a-a824-387716c3cb2b',
        p_semestre: semester,
      }).catch(() => ({ data: null }));
      // Fallback: direct query
      if (!data) {
        const { data: q } = await supabase
          .from('vertice_eorbit_quantitativo')
          .select('*, semestre:vertice_eorbit_semestres!inner(semestre), curso:vertice_eorbit_cursos!inner(nome)')
          .eq('vertice_eorbit_semestres.semestre', semester);
        if (active && q) {
          setQuants(q.map((r: any) => ({
            curso: r.curso?.nome ?? 'Curso',
            semestre: r.semestre?.semestre ?? semester,
            total_matriculados: r.total_matriculados ?? 0,
            total_vinculos: r.total_vinculos ?? 0,
            trancado: r.trancado ?? 0,
            abandono: r.abandono ?? 0,
            cancelado: r.cancelado ?? 0,
          })));
        }
        return;
      }
      if (active) setQuants(data);
    })();
    return () => { active = false; };
  }, [semester, institutionId]);

  const results = useMemo<CourseResult[]>(() => {
    return quants.map(q => {
      const mod = detectModality(q.curso);
      const ticket = mod === 'ead' ? params.ticket_ead
        : mod === 'semipresencial' ? params.ticket_semipresencial
        : params.ticket_presencial;
      const ideal = mod === 'ead' ? params.ensalamento_ideal_ead
        : mod === 'semipresencial' ? params.ensalamento_ideal_semipresencial
        : params.ensalamento_ideal_presencial;

      const matriculados = q.total_matriculados;
      const evasao = q.trancado + q.abandono + q.cancelado;
      const ocupacao = ideal > 0 ? matriculados / ideal : 0;
      const turmas_estimadas = Math.max(1, Math.ceil(matriculados / ideal));

      // Receita estimada
      const receita = matriculados * ticket * params.meses_letivos;

      // Custo docente estimado
      // Média ponderada: assume mix 10% grad, 40% esp, 40% mestre, 10% doutor
      const hora_media = params.hora_aula_graduado * 0.1
        + params.hora_aula_especialista * 0.4
        + params.hora_aula_mestre * 0.4
        + params.hora_aula_doutor * 0.1;
      const professores_estimados = Math.max(1, Math.ceil(turmas_estimadas * 1.5));
      const salario_mensal = params.ch_semanal_media * hora_media * params.fator_dsr;
      const custo_docente = professores_estimados * salario_mensal * (1 + params.encargos_pct) * params.meses_letivos;

      // Overhead
      const overhead = receita * params.overhead_pct;

      const custo_total = custo_docente + overhead;
      const resultado = receita - custo_total;
      const margem = receita > 0 ? resultado / receita : 0;

      return {
        curso: q.curso, modalidade: mod, matriculados, vinculos: q.total_vinculos,
        evasao, ensalamento_ideal: ideal, ocupacao, receita, custo_docente,
        overhead, custo_total, resultado, margem, turmas_estimadas, professores_estimados,
      };
    }).sort((a, b) => b.resultado - a.resultado);
  }, [quants, params]);

  const totals = useMemo(() => {
    const r = results.reduce((acc, c) => ({
      matriculados: acc.matriculados + c.matriculados,
      receita: acc.receita + c.receita,
      custo: acc.custo + c.custo_total,
      resultado: acc.resultado + c.resultado,
      lucro: acc.lucro + (c.resultado > 0 ? 1 : 0),
      prejuizo: acc.prejuizo + (c.resultado < 0 ? 1 : 0),
      empate: acc.empate + (c.resultado === 0 ? 1 : 0),
    }), { matriculados: 0, receita: 0, custo: 0, resultado: 0, lucro: 0, prejuizo: 0, empate: 0 });
    return { ...r, margem: r.receita > 0 ? r.resultado / r.receita : 0 };
  }, [results]);

  async function saveParams() {
    setSaving(true);
    const { error } = await supabase.from('vertice_cost_parameters')
      .update({ ...draft, updated_at: new Date().toISOString() })
      .eq('institution_id', institutionId);
    if (!error) { setParams(draft); setEditing(false); }
    setSaving(false);
  }

  if (loading) return <p role="status">Carregando simulador…</p>;

  return (
    <section className="cost-sim">
      <header className="cost-sim-header">
        <div>
          <p className="cost-sim-eyebrow">SIMULADOR DE RESULTADO · CUSTO ESTIMADO</p>
          <h3>Cada curso está se pagando?</h3>
          <p className="cost-sim-sub">Estimativa baseada em matrículas reais × parâmetros da CCT e do reitor. Não substitui análise contábil.</p>
        </div>
        <div className="cost-sim-header-actions">
          <select value={semester} onChange={e => setSemester(e.target.value)}>
            {semesters.map(s => <option key={s}>{s}</option>)}
          </select>
          <button type="button" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancelar' : '⚙ Parâmetros'}
          </button>
        </div>
      </header>

      {editing && (
        <div className="cost-sim-params">
          <h4>Parâmetros do simulador</h4>
          <p className="cost-sim-sub">Fonte: {params.fonte_cct}</p>
          <div className="cost-sim-params-grid">
            <label>Hora-aula Graduado<input type="number" step="0.01" value={draft.hora_aula_graduado} onChange={e => setDraft({ ...draft, hora_aula_graduado: +e.target.value })} /></label>
            <label>Hora-aula Especialista<input type="number" step="0.01" value={draft.hora_aula_especialista} onChange={e => setDraft({ ...draft, hora_aula_especialista: +e.target.value })} /></label>
            <label>Hora-aula Mestre<input type="number" step="0.01" value={draft.hora_aula_mestre} onChange={e => setDraft({ ...draft, hora_aula_mestre: +e.target.value })} /></label>
            <label>Hora-aula Doutor<input type="number" step="0.01" value={draft.hora_aula_doutor} onChange={e => setDraft({ ...draft, hora_aula_doutor: +e.target.value })} /></label>
            <label>Encargos sobre folha (%)<input type="number" step="0.01" value={Math.round(draft.encargos_pct * 100)} onChange={e => setDraft({ ...draft, encargos_pct: +e.target.value / 100 })} /></label>
            <label>Overhead operacional (%)<input type="number" step="1" value={Math.round(draft.overhead_pct * 100)} onChange={e => setDraft({ ...draft, overhead_pct: +e.target.value / 100 })} /></label>
            <label>Ticket presencial (R$/mês)<input type="number" step="10" value={draft.ticket_presencial} onChange={e => setDraft({ ...draft, ticket_presencial: +e.target.value })} /></label>
            <label>Ticket semipresencial (R$/mês)<input type="number" step="10" value={draft.ticket_semipresencial} onChange={e => setDraft({ ...draft, ticket_semipresencial: +e.target.value })} /></label>
            <label>Ticket EAD (R$/mês)<input type="number" step="10" value={draft.ticket_ead} onChange={e => setDraft({ ...draft, ticket_ead: +e.target.value })} /></label>
            <label>Ensalamento ideal presencial<input type="number" value={draft.ensalamento_ideal_presencial} onChange={e => setDraft({ ...draft, ensalamento_ideal_presencial: +e.target.value })} /></label>
            <label>Ensalamento ideal semipresencial<input type="number" value={draft.ensalamento_ideal_semipresencial} onChange={e => setDraft({ ...draft, ensalamento_ideal_semipresencial: +e.target.value })} /></label>
            <label>Ensalamento ideal EAD<input type="number" value={draft.ensalamento_ideal_ead} onChange={e => setDraft({ ...draft, ensalamento_ideal_ead: +e.target.value })} /></label>
            <label>CH semanal média/prof<input type="number" value={draft.ch_semanal_media} onChange={e => setDraft({ ...draft, ch_semanal_media: +e.target.value })} /></label>
            <label>Meses letivos/semestre<input type="number" value={draft.meses_letivos} onChange={e => setDraft({ ...draft, meses_letivos: +e.target.value })} /></label>
          </div>
          <button type="button" className="corp-button" disabled={saving} onClick={saveParams}>
            {saving ? 'Salvando…' : 'Salvar parâmetros'}
          </button>
        </div>
      )}

      {/* KPIs resumo */}
      <div className="cost-sim-kpis">
        <div className="cost-sim-kpi" style={{ borderLeftColor: 'var(--primary)' }}>
          <small>Cursos analisados</small>
          <strong>{results.length}</strong>
          <span>{NUM.format(totals.matriculados)} matriculados</span>
        </div>
        <div className="cost-sim-kpi" style={{ borderLeftColor: 'var(--success)' }}>
          <small>Superávit estimado</small>
          <strong style={{ color: 'var(--success)' }}>{totals.lucro}</strong>
          <span>cursos com resultado positivo</span>
        </div>
        <div className="cost-sim-kpi" style={{ borderLeftColor: 'var(--danger)' }}>
          <small>Déficit estimado</small>
          <strong style={{ color: 'var(--danger)' }}>{totals.prejuizo}</strong>
          <span>cursos com resultado negativo</span>
        </div>
        <div className="cost-sim-kpi" style={{ borderLeftColor: totals.resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          <small>Resultado líquido estimado</small>
          <strong style={{ color: totals.resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>{BRL.format(totals.resultado)}</strong>
          <span>Margem: {PCT.format(totals.margem)}</span>
        </div>
      </div>

      {/* Tabela de cursos */}
      <div className="cost-sim-table-wrap">
        <table className="cost-sim-table">
          <thead>
            <tr>
              <th></th>
              <th>Curso</th>
              <th>Mod.</th>
              <th>Matr.</th>
              <th>Ocupação</th>
              <th>Receita est.</th>
              <th>Custo docente</th>
              <th>Overhead</th>
              <th>Resultado</th>
              <th>Margem</th>
            </tr>
          </thead>
          <tbody>
            {results.map((c, i) => (
              <tr key={c.curso + i} className={c.resultado > 0 ? 'cost-row-ok' : c.resultado < 0 ? 'cost-row-bad' : ''}>
                <td><span className={`cost-dot ${c.resultado > 0 ? 'green' : c.resultado < 0 ? 'red' : 'gray'}`} /></td>
                <td className="cost-curso">{c.curso}</td>
                <td><span className={`cost-mod cost-mod-${c.modalidade}`}>{c.modalidade === 'presencial' ? 'Pres' : c.modalidade === 'semipresencial' ? 'Semi' : 'EAD'}</span></td>
                <td>{NUM.format(c.matriculados)}</td>
                <td><div className="cost-bar-wrap"><div className="cost-bar" style={{ width: Math.min(100, c.ocupacao * 100) + '%', background: c.ocupacao >= 0.8 ? 'var(--success)' : c.ocupacao >= 0.5 ? 'var(--warning)' : 'var(--danger)' }} /><span>{Math.round(c.ocupacao * 100)}%</span></div></td>
                <td>{BRL.format(c.receita)}</td>
                <td>{BRL.format(c.custo_docente)}</td>
                <td>{BRL.format(c.overhead)}</td>
                <td style={{ color: c.resultado >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{BRL.format(c.resultado)}</td>
                <td style={{ color: c.margem >= 0 ? 'var(--success)' : 'var(--danger)' }}>{PCT.format(c.margem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="cost-sim-footer">
        Estimativa com base em parâmetros declarados. Custo docente usa mix médio de titulação (10% grad, 40% esp, 40% mestre, 10% doutor).
        Pisos conforme {params.fonte_cct}. Não inclui coordenação, infraestrutura específica ou inadimplência.
      </p>
    </section>
  );
}
