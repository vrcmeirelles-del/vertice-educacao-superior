// AcademicModulesBI.tsx — BI consolidado para TCC, AC e Estágio na Reitoria
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Props { institutionId: string; module: 'tcc' | 'ac' | 'estagio'; }

export default function AcademicModulesBI({ institutionId, module }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const view = module === 'tcc' ? 'v_tcc_course_summary' : module === 'ac' ? 'v_ac_course_summary' : 'v_internship_course_summary';
    Promise.resolve(supabase.from(view).select('*').eq('institution_id', institutionId))
      .then(r => setData(r.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [institutionId, module]);

  if (loading) return <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Carregando…</p>;
  if (data.length === 0) return <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Nenhum dado disponível. Execute a migração SQL e cadastre dados para este módulo.</p>;

  if (module === 'tcc') return <TccBI data={data} />;
  if (module === 'ac') return <AcBI data={data} />;
  return <EstagioBI data={data} />;
}

function KPI({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return <div style={{ background: 'var(--vx-surface,#fff)', border: '1px solid var(--vx-border,#e2e8f0)', borderRadius: 8, padding: '12px 16px', borderLeft: `3px solid ${color || '#2563eb'}` }}>
    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: '.75rem', color: '#64748b' }}>{label}</div>
  </div>;
}

function TccBI({ data }: { data: any[] }) {
  const t = { works: 0, authors: 0, deposited: 0, overdue: 0, hours: 0, advisors: 0, evidence: 0 };
  data.forEach(d => { t.works += d.works_active || 0; t.authors += d.authors_distinct || 0; t.deposited += d.works_deposited || 0; t.overdue += d.works_overdue || 0; t.hours += d.hours_validated_minutes || 0; t.advisors += d.advisors_active || 0; t.evidence += d.alignments_validated || 0; });
  return (<div>
    <h3 style={{ margin: '0 0 12px' }}>TCC e Pesquisa — Consolidado Institucional</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
      <KPI label="Trabalhos Ativos" value={t.works} /><KPI label="Autores" value={t.authors} /><KPI label="Depositados" value={t.deposited} color="#059669" /><KPI label="Atrasados" value={t.overdue} color={t.overdue > 0 ? '#ef4444' : undefined} /><KPI label="Orientadores" value={t.advisors} /><KPI label="Horas Validadas" value={`${Math.floor(t.hours / 60)}h`} color="#7c3aed" /><KPI label="Evidências PPC" value={t.evidence} color="#2563eb" />
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
      <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}><th style={{ textAlign: 'left', padding: '6px 8px' }}>Curso</th><th>Ativos</th><th>Autores</th><th>Depositados</th><th>Atrasados</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.course_id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '6px 8px' }}>{d.course_name}</td><td style={{ textAlign: 'center' }}>{d.works_active}</td><td style={{ textAlign: 'center' }}>{d.authors_distinct}</td><td style={{ textAlign: 'center' }}>{d.works_deposited}</td><td style={{ textAlign: 'center', color: d.works_overdue > 0 ? '#ef4444' : undefined }}>{d.works_overdue}</td></tr>)}</tbody>
    </table>
  </div>);
}

function AcBI({ data }: { data: any[] }) {
  const t = { students: 0, subs: 0, pending: 0, approved: 0, hours: 0 };
  data.forEach(d => { t.students += d.students_with_rule || 0; t.subs += d.submissions_total || 0; t.pending += d.submissions_pending || 0; t.approved += d.submissions_approved || 0; t.hours += d.total_credited_minutes || 0; });
  return (<div>
    <h3 style={{ margin: '0 0 12px' }}>Atividades Complementares — Consolidado Institucional</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
      <KPI label="Alunos com Regra" value={t.students} /><KPI label="Solicitações" value={t.subs} /><KPI label="Pendentes" value={t.pending} color={t.pending > 0 ? '#f59e0b' : undefined} /><KPI label="Aprovadas" value={t.approved} color="#059669" /><KPI label="Horas Creditadas" value={`${Math.floor(t.hours / 60)}h`} color="#2563eb" />
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
      <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}><th style={{ textAlign: 'left', padding: '6px 8px' }}>Curso</th><th>Alunos</th><th>Solicitações</th><th>Pendentes</th><th>Aprovadas</th><th>Horas</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.course_id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '6px 8px' }}>{d.course_name}</td><td style={{ textAlign: 'center' }}>{d.students_with_rule}</td><td style={{ textAlign: 'center' }}>{d.submissions_total}</td><td style={{ textAlign: 'center', color: d.submissions_pending > 0 ? '#f59e0b' : undefined }}>{d.submissions_pending}</td><td style={{ textAlign: 'center' }}>{d.submissions_approved}</td><td style={{ textAlign: 'center' }}>{Math.floor((d.total_credited_minutes || 0) / 60)}h</td></tr>)}</tbody>
    </table>
  </div>);
}

function EstagioBI({ data }: { data: any[] }) {
  const t = { placements: 0, active: 0, internal: 0, external: 0, students: 0, completed: 0, hours: 0, orgs: 0 };
  data.forEach(d => { t.placements += d.placements_total || 0; t.active += d.placements_active || 0; t.internal += d.internal_count || 0; t.external += d.external_count || 0; t.students += d.students_distinct || 0; t.completed += d.completed || 0; t.hours += d.hours_validated_minutes || 0; t.orgs += d.organizations_count || 0; });
  return (<div>
    <h3 style={{ margin: '0 0 12px' }}>Estágio Obrigatório — Consolidado Institucional</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
      <KPI label="Total Estágios" value={t.placements} /><KPI label="Ativos" value={t.active} color="#0891b2" /><KPI label="Internos" value={t.internal} /><KPI label="Externos" value={t.external} /><KPI label="Alunos" value={t.students} /><KPI label="Concluídos" value={t.completed} color="#059669" /><KPI label="Horas" value={`${Math.floor(t.hours / 60)}h`} color="#7c3aed" /><KPI label="Concedentes" value={t.orgs} />
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
      <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}><th style={{ textAlign: 'left', padding: '6px 8px' }}>Curso</th><th>Estágios</th><th>Ativos</th><th>Int.</th><th>Ext.</th><th>Concluídos</th><th>Horas</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.course_id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '6px 8px' }}>{d.course_name}</td><td style={{ textAlign: 'center' }}>{d.placements_total}</td><td style={{ textAlign: 'center' }}>{d.placements_active}</td><td style={{ textAlign: 'center' }}>{d.internal_count}</td><td style={{ textAlign: 'center' }}>{d.external_count}</td><td style={{ textAlign: 'center' }}>{d.completed}</td><td style={{ textAlign: 'center' }}>{Math.floor((d.hours_validated_minutes || 0) / 60)}h</td></tr>)}</tbody>
    </table>
  </div>);
}
