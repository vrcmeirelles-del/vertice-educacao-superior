// EgressosBI.tsx — Painel de indicadores de egressos para BI da Direção
import { useState, useEffect, useMemo } from 'react';
import {
  fetchSurveyIndicators, fetchTrajectoryIndicators,
  safePercent, safeRatio,
  SurveyIndicators, TrajectoryIndicators,
} from '../../lib/alumni';

interface Props {
  institutionId: string;
}

export default function EgressosBI({ institutionId }: Props) {
  const [surveyInd, setSurveyInd] = useState<SurveyIndicators[]>([]);
  const [trajInd, setTrajInd] = useState<TrajectoryIndicators[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSurveyIndicators(institutionId),
      fetchTrajectoryIndicators(institutionId),
    ]).then(([si, ti]) => {
      setSurveyInd(si);
      setTrajInd(ti);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [institutionId]);

  const trajTotal = useMemo(() => {
    const t = {
      total_egressos: 0, respostas_trabalho: 0, em_atividade: 0,
      desempregados: 0, desempregados_buscando: 0,
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
  }, [trajInd]);

  if (loading) return <p>Carregando indicadores de egressos…</p>;
  if (error) return <p style={{ color: '#dc2626' }}>Erro: {error}</p>;

  const noData = surveyInd.length === 0 && trajInd.length === 0;

  return (
    <section aria-label="BI de Egressos" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <p role="note" style={{ fontSize: '0.8125rem', color: '#535b78' }}>
        Fonte: pesquisas de egressos e dados autodeclarados. Pesquisa voluntária — não probabilística.
        Denominador zero = "não disponível". Faixas de renda não permitem mediana exata.
      </p>

      {noData ? (
        <article className="pbi-card">
          <h3>Egressos</h3>
          <p>Nenhum dado de pesquisa disponível. Aplique pesquisas no módulo Egressos 360° para gerar indicadores aqui.</p>
        </article>
      ) : (
        <>
          {/* KPIs de participação */}
          {surveyInd.length > 0 && (
            <article className="pbi-card">
              <h3>Participação nas Pesquisas</h3>
              <div className="pbi-grid">
                {surveyInd.map(si => (
                  <div key={si.survey_id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px' }}>
                    <strong style={{ fontSize: '0.875rem' }}>{si.survey_title}</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                      <Metric label="% Elegíveis" value={si.pct_eligible != null ? si.pct_eligible + '%' : 'N/D'} sub={`${si.total_respondents}/${si.total_eligible}`} />
                      <Metric label="% Convidados" value={si.pct_invited != null ? si.pct_invited + '%' : 'N/D'} sub={`${si.total_respondents}/${si.total_invited}`} />
                      <Metric label="% Entregas" value={si.pct_delivered != null ? si.pct_delivered + '%' : 'N/D'} sub={`${si.total_respondents}/${si.total_delivered}`} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          {/* Indicadores de trajetória */}
          {trajInd.length > 0 && (
            <article className="pbi-card">
              <h3>Trajetória Profissional e Acadêmica</h3>
              <div className="pbi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <BigMetric
                  label="Atividade Remunerada"
                  value={safePercent(trajTotal.em_atividade, trajTotal.respostas_trabalho) ?? 'N/D'}
                  sub={safeRatio(trajTotal.em_atividade, trajTotal.respostas_trabalho)}
                  color="#16a34a"
                />
                <BigMetric
                  label="Aderência à Área"
                  value={safePercent(trajTotal.area_ou_correlata, trajTotal.responderam_aderencia) ?? 'N/D'}
                  sub={safeRatio(trajTotal.area_ou_correlata, trajTotal.responderam_aderencia)}
                  color="#2563eb"
                />
                <BigMetric
                  label="Formação Continuada"
                  value={safePercent(trajTotal.respostas_estudos_validas, trajTotal.total_egressos) ?? 'N/D'}
                  sub={safeRatio(trajTotal.respostas_estudos_validas, trajTotal.total_egressos)}
                  color="#7c3aed"
                />
                <BigMetric
                  label="Trabalho ou Estudo"
                  value={safePercent(trajTotal.trabalha_ou_estuda, trajTotal.respostas_ambas) ?? 'N/D'}
                  sub={safeRatio(trajTotal.trabalha_ou_estuda, trajTotal.respostas_ambas)}
                  color="#d97706"
                />
              </div>

              {/* Por curso */}
              {trajInd.length > 1 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginTop: '18px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Curso</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Egressos</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Atividade</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Aderência</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Estudos</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Trab./Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trajInd.map((ti, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px' }}>{ti.course_id ?? 'Todos'}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{ti.total_egressos}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{safePercent(ti.em_atividade, ti.respostas_trabalho) ?? 'N/D'}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{safePercent(ti.area_ou_correlata, ti.responderam_aderencia) ?? 'N/D'}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{safePercent(ti.respostas_estudos_validas, ti.total_egressos) ?? 'N/D'}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{safePercent(ti.trabalha_ou_estuda, ti.respostas_ambas) ?? 'N/D'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sub}</div>
    </div>
  );
}

function BigMetric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>
    </div>
  );
}
