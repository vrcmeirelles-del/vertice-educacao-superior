// EvasionRiskPanel.tsx — Painel de risco de evasão cruzando todos os módulos acadêmicos
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RiskStudent {
  student_id: string;
  institution_id: string;
  course_id: string;
  full_name: string;
  enrollment_code: string;
  academic_status: string;
  ac_credited_minutes: number;
  ac_remaining_minutes: number;
  ac_submissions: number;
  tcc_active: number;
  tcc_overdue: number;
  estagio_active: number;
  estagio_completed: number;
  risk_score: number;
  risk_level: string;
}

const RISK_COLORS: Record<string, string> = { critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const RISK_LABELS: Record<string, string> = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' };

export default function EvasionRiskPanel({ institutionId, courses }: { institutionId: string; courses: { id: string; name: string }[] }) {
  const [students, setStudents] = useState<RiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    supabase.from('v_student_evasion_risk')
      .select('*')
      .eq('institution_id', institutionId)
      .order('risk_score', { ascending: false })
      .limit(200)
      .then(r => { setStudents((r.data ?? []) as RiskStudent[]); })
      .finally(() => setLoading(false));
  }, [institutionId]);

  const courseName = (id: string) => courses.find(c => c.id === id)?.name || '—';
  const minutesToH = (m: number) => { const h = Math.floor(m / 60); return h > 0 ? `${h}h` : '0h'; };

  const filtered = students.filter(s =>
    (!courseFilter || s.course_id === courseFilter) &&
    (!riskFilter || s.risk_level === riskFilter)
  );

  const counts = { critical: students.filter(s => s.risk_level === 'critical').length, high: students.filter(s => s.risk_level === 'high').length, medium: students.filter(s => s.risk_level === 'medium').length, low: students.filter(s => s.risk_level === 'low').length };

  if (loading) return <p style={{ padding: 16, color: '#64748b' }}>Carregando análise de risco…</p>;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
        {(['critical', 'high', 'medium', 'low'] as const).map(level => (
          <div key={level} onClick={() => setRiskFilter(riskFilter === level ? '' : level)}
            style={{ padding: '12px 16px', borderRadius: 8, border: `2px solid ${riskFilter === level ? RISK_COLORS[level] : 'transparent'}`, background: RISK_COLORS[level] + '11', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: RISK_COLORS[level] }}>{counts[level]}</div>
            <div style={{ fontSize: '.75rem', color: '#64748b' }}>{RISK_LABELS[level]}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '.8125rem' }}>
          <option value="">Todos os cursos</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ fontSize: '.75rem', color: '#64748b', alignSelf: 'center' }}>{filtered.length} alunos</span>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: '.875rem' }}>Nenhum aluno no filtro selecionado.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Aluno</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Curso</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Risco</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>AC</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>TCC</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Estágio</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(s => (
                <tr key={s.student_id} style={{ borderBottom: '1px solid #f1f5f9', background: s.risk_level === 'critical' ? '#fef2f2' : undefined }}>
                  <td style={{ padding: '6px 8px' }}>
                    <strong>{s.full_name}</strong>
                    <div style={{ fontSize: '.6875rem', color: '#94a3b8' }}>{s.enrollment_code} · {s.academic_status}</div>
                  </td>
                  <td style={{ padding: '6px 8px' }}>{courseName(s.course_id)}</td>
                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '.6875rem', fontWeight: 600, background: RISK_COLORS[s.risk_level] + '22', color: RISK_COLORS[s.risk_level] }}>
                      {s.risk_score}% · {RISK_LABELS[s.risk_level]}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                    {s.ac_remaining_minutes > 0 ? (
                      <span style={{ color: s.ac_submissions === 0 ? '#ef4444' : '#f59e0b' }}>{minutesToH(s.ac_remaining_minutes)} restantes</span>
                    ) : <span style={{ color: '#22c55e' }}>✓</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                    {s.tcc_overdue > 0 ? <span style={{ color: '#ef4444' }}>{s.tcc_overdue} atrasado</span> :
                     s.tcc_active > 0 ? <span style={{ color: '#0891b2' }}>{s.tcc_active} ativo</span> :
                     <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                    {s.estagio_completed > 0 ? <span style={{ color: '#22c55e' }}>✓ {s.estagio_completed}</span> :
                     s.estagio_active > 0 ? <span style={{ color: '#0891b2' }}>{s.estagio_active} ativo</span> :
                     <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {s.ac_remaining_minutes > 0 && s.ac_submissions === 0 && <span style={{ fontSize: '.625rem', padding: '1px 4px', borderRadius: 3, background: '#fef2f2', color: '#ef4444' }}>AC zerada</span>}
                      {s.tcc_overdue > 0 && <span style={{ fontSize: '.625rem', padding: '1px 4px', borderRadius: 3, background: '#fef2f2', color: '#ef4444' }}>TCC atrasado</span>}
                      {s.estagio_active === 0 && s.estagio_completed === 0 && <span style={{ fontSize: '.625rem', padding: '1px 4px', borderRadius: 3, background: '#fff7ed', color: '#f59e0b' }}>Sem estágio</span>}
                      {s.academic_status === 'trancado' && <span style={{ fontSize: '.625rem', padding: '1px 4px', borderRadius: 3, background: '#f1f5f9', color: '#64748b' }}>Trancado</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
