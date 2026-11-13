// InstitutionalDashboard360.tsx — Painel 360° integrado para Reitoria
// Puxa v_course_academic_360 (cruza TCC + AC + Estágio + Extensão + Egressos + CPA)
// e v_institutional_alerts (alertas cruzados de todos os módulos)
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Props { institutionId: string; }

interface Course360 {
  course_id: string; course_name: string;
  tcc_works_active: number; tcc_deposited: number; tcc_overdue: number; tcc_authors: number; tcc_advisors: number; tcc_hours_min: number; tcc_evidence_validated: number;
  ac_submissions: number; ac_pending: number; ac_approved: number; ac_credited_min: number; ac_students_with_rule: number;
  estagio_total: number; estagio_active: number; estagio_internal: number; estagio_external: number; estagio_completed: number; estagio_hours_min: number; estagio_orgs: number;
  extensao_projetos: number; extensao_alunos: number;
  egressos_total: number;
  cpa_achados: number; cpa_potencialidades: number; cpa_fragilidades: number;
}
interface Alert { module: string; alert_type: string; message: string; course_id: string | null; detail: string | null; }

export default function InstitutionalDashboard360({ institutionId }: Props) {
  const [courses, setCourses] = useState<Course360[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('v_course_academic_360').select('*').eq('institution_id', institutionId),
      supabase.from('v_institutional_alerts').select('*').eq('institution_id', institutionId),
    ]).then(([c, a]) => {
      setCourses((c.data ?? []) as Course360[]);
      setAlerts((a.data ?? []) as Alert[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [institutionId]);

  if (loading) return <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Carregando painel integrado…</p>;

  const t = courses.reduce((acc, c) => ({
    tcc_active: acc.tcc_active + c.tcc_works_active,
    tcc_deposited: acc.tcc_deposited + c.tcc_deposited,
    tcc_overdue: acc.tcc_overdue + c.tcc_overdue,
    tcc_hours: acc.tcc_hours + c.tcc_hours_min,
    tcc_evidence: acc.tcc_evidence + c.tcc_evidence_validated,
    ac_submissions: acc.ac_submissions + c.ac_submissions,
    ac_pending: acc.ac_pending + c.ac_pending,
    ac_credited: acc.ac_credited + c.ac_credited_min,
    estagio_active: acc.estagio_active + c.estagio_active,
    estagio_completed: acc.estagio_completed + c.estagio_completed,
    estagio_hours: acc.estagio_hours + c.estagio_hours_min,
    extensao_projetos: acc.extensao_projetos + c.extensao_projetos,
    extensao_alunos: acc.extensao_alunos + c.extensao_alunos,
    egressos: acc.egressos + c.egressos_total,
    cpa_achados: acc.cpa_achados + c.cpa_achados,
    cpa_fragilidades: acc.cpa_fragilidades + c.cpa_fragilidades,
  }), { tcc_active:0, tcc_deposited:0, tcc_overdue:0, tcc_hours:0, tcc_evidence:0, ac_submissions:0, ac_pending:0, ac_credited:0, estagio_active:0, estagio_completed:0, estagio_hours:0, extensao_projetos:0, extensao_alunos:0, egressos:0, cpa_achados:0, cpa_fragilidades:0 });

  const h = (m: number) => { const hr = Math.floor(m / 60); return hr > 0 ? `${hr.toLocaleString('pt-BR')}h` : '0h'; };
  const moduleColors: Record<string, string> = { tcc: '#8b5cf6', ac: '#0891b2', estagio: '#d97706', complementary_activities: '#0891b2', mandatory_internship: '#d97706' };
  const moduleLabels: Record<string, string> = { tcc: 'TCC', ac: 'AC', estagio: 'Estágio', complementary_activities: 'AC', mandatory_internship: 'Estágio' };

  return (
    <div>
      <h3 style={{ margin: '0 0 12px' }}>Painel Acadêmico 360° — Visão Integrada</h3>

      {/* KPIs por módulo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        <ModuleCard title="📝 TCC e Pesquisa" color="#8b5cf6" items={[
          { label: 'Ativos', value: t.tcc_active }, { label: 'Depositados', value: t.tcc_deposited },
          { label: 'Atrasados', value: t.tcc_overdue, bad: t.tcc_overdue > 0 },
          { label: 'Horas validadas', value: h(t.tcc_hours) }, { label: 'Evidências PPC', value: t.tcc_evidence },
        ]} />
        <ModuleCard title="📜 Atividades Complementares" color="#0891b2" items={[
          { label: 'Solicitações', value: t.ac_submissions }, { label: 'Pendentes', value: t.ac_pending, bad: t.ac_pending > 5 },
          { label: 'Horas creditadas', value: h(t.ac_credited) },
        ]} />
        <ModuleCard title="🏢 Estágio Obrigatório" color="#d97706" items={[
          { label: 'Em andamento', value: t.estagio_active }, { label: 'Concluídos', value: t.estagio_completed },
          { label: 'Horas validadas', value: h(t.estagio_hours) },
        ]} />
        <ModuleCard title="🤝 Extensão" color="#16a34a" items={[
          { label: 'Projetos', value: t.extensao_projetos }, { label: 'Alunos', value: t.extensao_alunos },
        ]} />
        <ModuleCard title="🎓 Egressos" color="#7c3aed" items={[{ label: 'Acompanhados', value: t.egressos }]} />
        <ModuleCard title="📊 CPA" color="#ec4899" items={[
          { label: 'Achados', value: t.cpa_achados }, { label: 'Fragilidades', value: t.cpa_fragilidades, bad: t.cpa_fragilidades > 0 },
        ]} />
      </div>

      {/* Alertas cruzados */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 16, border: '1px solid #fecaca', borderRadius: 8, padding: 12, background: '#fef2f2' }}>
          <h4 style={{ margin: '0 0 8px', color: '#991b1b' }}>⚠ Alertas Cruzados ({alerts.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {alerts.slice(0, 20).map((a, i) => (
              <div key={i} style={{ fontSize: '.8125rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ background: (moduleColors[a.module] || '#64748b') + '22', color: moduleColors[a.module] || '#64748b', padding: '1px 6px', borderRadius: 4, fontSize: '.6875rem', fontWeight: 600 }}>{moduleLabels[a.module] || a.module}</span>
                <span>{a.message}</span>
                {a.detail && <span style={{ color: '#64748b', fontSize: '.75rem' }}>({a.detail})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela cruzada por curso */}
      {courses.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Curso</th>
                <th colSpan={3} style={{ textAlign: 'center', background: '#8b5cf622', padding: '4px' }}>TCC</th>
                <th colSpan={2} style={{ textAlign: 'center', background: '#0891b222', padding: '4px' }}>AC</th>
                <th colSpan={3} style={{ textAlign: 'center', background: '#d9770622', padding: '4px' }}>Estágio</th>
                <th style={{ textAlign: 'center' }}>Ext.</th>
                <th style={{ textAlign: 'center' }}>Egr.</th>
                <th style={{ textAlign: 'center' }}>CPA</th>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0', fontSize: '.6875rem', color: '#64748b' }}>
                <th></th>
                <th style={{ textAlign: 'center' }}>Ativos</th><th style={{ textAlign: 'center' }}>Dep.</th><th style={{ textAlign: 'center' }}>⚠</th>
                <th style={{ textAlign: 'center' }}>Pend.</th><th style={{ textAlign: 'center' }}>Cred.</th>
                <th style={{ textAlign: 'center' }}>Ativos</th><th style={{ textAlign: 'center' }}>Concl.</th><th style={{ textAlign: 'center' }}>Horas</th>
                <th style={{ textAlign: 'center' }}>Proj.</th>
                <th style={{ textAlign: 'center' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Ach.</th>
              </tr>
            </thead>
            <tbody>{courses.filter(c => c.tcc_works_active + c.ac_submissions + c.estagio_total + c.extensao_projetos + c.egressos_total + c.cpa_achados > 0).map(c => (
              <tr key={c.course_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.course_name}</td>
                <td style={{ textAlign: 'center' }}>{c.tcc_works_active || '—'}</td>
                <td style={{ textAlign: 'center', color: '#059669' }}>{c.tcc_deposited || '—'}</td>
                <td style={{ textAlign: 'center', color: c.tcc_overdue > 0 ? '#ef4444' : undefined }}>{c.tcc_overdue || '—'}</td>
                <td style={{ textAlign: 'center', color: c.ac_pending > 0 ? '#f59e0b' : undefined }}>{c.ac_pending || '—'}</td>
                <td style={{ textAlign: 'center' }}>{c.ac_credited_min > 0 ? h(c.ac_credited_min) : '—'}</td>
                <td style={{ textAlign: 'center' }}>{c.estagio_active || '—'}</td>
                <td style={{ textAlign: 'center', color: '#059669' }}>{c.estagio_completed || '—'}</td>
                <td style={{ textAlign: 'center' }}>{c.estagio_hours_min > 0 ? h(c.estagio_hours_min) : '—'}</td>
                <td style={{ textAlign: 'center' }}>{c.extensao_projetos || '—'}</td>
                <td style={{ textAlign: 'center' }}>{c.egressos_total || '—'}</td>
                <td style={{ textAlign: 'center' }}>{c.cpa_achados || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {courses.length === 0 && <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Nenhum dado acadêmico registrado. Os indicadores aparecerão conforme os módulos forem alimentados.</p>}
    </div>
  );
}

function ModuleCard({ title, color, items }: { title: string; color: string; items: { label: string; value: number | string; bad?: boolean }[] }) {
  return (
    <div style={{ background: 'var(--vx-surface,#fff)', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 700, color, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {items.map(it => (
          <div key={it.label}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: it.bad ? '#ef4444' : undefined }}>{it.value}</div>
            <div style={{ fontSize: '.6875rem', color: '#64748b' }}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
