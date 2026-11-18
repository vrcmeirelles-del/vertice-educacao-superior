import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MODULES = [
  ['oab', 'OAB'], ['cfc', 'CFC'], ['enade', 'ENADE'], ['enamed', 'ENAMED'],
  ['residencia', 'Residência Médica'], ['delegado', 'Delegado'], ['pf', 'Polícia Federal'],
  ['estadual', 'Magistratura Estadual'], ['federal', 'Magistratura Federal'],
  ['defensoria', 'Defensoria'], ['mp', 'Ministério Público'],
] as const;
const number = new Intl.NumberFormat('pt-BR');
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

type Metric = {
  semester: string;
  subject_code: string;
  module: string;
  competency: string;
  participants: number;
  attempts: number;
  graded: number;
  correct: number;
  updated_at: string;
};

type State = { scope: string; rows: Metric[]; error: boolean };

function date(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? '—' : timestamp.toLocaleDateString('pt-BR');
}

export default function TeachingFatoOrdem({ institutionId, courseId }: { institutionId: string; courseId: string }) {
  const [module, setModule] = useState('');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>();
  const scope = [institutionId, courseId, module, retry].join(':');
  const result = state?.scope === scope ? state : undefined;

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('vertice_teaching_fo_metrics', {
          p_institution: institutionId, p_course: courseId, ...(module ? { p_module: module } : {}),
        });
        if (error) throw error;
        if (current) setState({ scope, rows: (data ?? []) as Metric[], error: false });
      } catch {
        if (current) setState({ scope, rows: [], error: true });
      }
    })();
    return () => { current = false; };
  }, [institutionId, courseId, module, scope]);

  return <section className="card" aria-label="Fato & Ordem: aprendizagem integrada" aria-busy={!result}>
    <h3>Fato &amp; Ordem · Aprendizagem Conectada</h3>
    <p>Resultados agregados já recebidos e mapeados para este curso. O recorte de acesso continua valendo por instituição, curso e disciplina. Não são notas oficiais, nem confirmação de presença em uma atividade específica.</p>
    <label>Exame ou carreira{' '}
      <select value={module} onChange={e => setModule(e.target.value)}>
        <option value="">Todos os exames e carreiras</option>
        {MODULES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {!result ? <p role="status">Consultando os indicadores do curso…</p> :
      result.error ? <div role="alert">
        <p>Não foi possível consultar os indicadores do Fato &amp; Ordem.</p>
        <button type="button" className="btn-secondary" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button>
      </div> :
      !result.rows.length ? <p>Nenhum resultado agregado disponível para este recorte. O painel só exibe grupos mapeados com pelo menos cinco participantes e visíveis ao seu perfil.</p> :
      <>
        <p>Até 100 recortes, dos períodos mais recentes. Um participante ou tentativa pode aparecer em mais de uma competência: não some as linhas.</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="area-table">
            <caption>Dados da Aprendizagem Conectada por período, disciplina e competência</caption>
            <thead><tr><th scope="col">Período</th><th scope="col">Exame ou carreira</th><th scope="col">Disciplina (código)</th><th scope="col">Competência</th><th scope="col">Participantes</th><th scope="col">Tentativas</th><th scope="col">Acertos em respostas corrigidas</th><th scope="col">Atualizado</th></tr></thead>
            <tbody>{result.rows.map(row => <tr key={JSON.stringify([row.semester, row.module, row.subject_code, row.competency])}>
              <td>{row.semester}</td>
              <td>{MODULES.find(([value]) => value === row.module)?.[1] ?? row.module}</td>
              <td>{row.subject_code}</td><td>{row.competency === '*' ? 'Mapeamento geral' : row.competency || '—'}</td>
              <td>{number.format(row.participants)}</td>
              <td>{number.format(row.attempts)}</td>
              <td>{row.graded > 0 ? percent.format(row.correct / row.graded) : '—'}</td>
              <td>{date(row.updated_at)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
  </section>;
}
