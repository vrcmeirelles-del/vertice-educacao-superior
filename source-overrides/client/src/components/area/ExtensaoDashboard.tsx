/**
 * ExtensaoDashboard — Painel consolidado do Impacto para a home
 * Mostra indicadores-chave sem precisar entrar no Extensao360
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface DashData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalStudents: number;
  activeStudents: number;
  totalHoursValidated: number;
  totalHoursPending: number;
  totalActivities: number;
  completedActivities: number;
  totalEvidence: number;
  approvedEvidence: number;
  pendingEvidence: number;
  totalFindings: number;
  openFindings: number;
  criticalFindings: number;
  totalPartners: number;
  sdgLinksCount: number;
  courseCoverage: number;
  totalCourses: number;
}

export default function ExtensaoDashboard({
  institutionId,
  onNavigate,
}: {
  institutionId: string;
  onNavigate?: (view: string) => void;
}) {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [projects, students, hours, activities, evidence, findings, partners, sdgLinks] = await Promise.all([
      supabase.from('vertice_extension_projects').select('id, status').eq('institution_id', institutionId),
      supabase.from('vertice_extension_students').select('id, status').eq('institution_id', institutionId),
      supabase.from('vertice_extension_hour_entries').select('minutes, hour_state').eq('institution_id', institutionId),
      supabase.from('vertice_extension_activities').select('id, status').eq('institution_id', institutionId),
      supabase.from('vertice_extension_evidence_registry').select('id, validation_status').eq('institution_id', institutionId).eq('is_current', true),
      supabase.from('vertice_extension_findings').select('id, status, severity').eq('institution_id', institutionId),
      supabase.from('vertice_extension_partners').select('id').eq('institution_id', institutionId).eq('active', true),
      supabase.from('vertice_extension_sdg_links').select('id').eq('institution_id', institutionId),
    ]);

    const p = projects.data || [];
    const s = students.data || [];
    const h = hours.data || [];
    const a = activities.data || [];
    const e = evidence.data || [];
    const f = findings.data || [];

    const coursesWithProjects = new Set(p.flatMap((proj: any) => proj.course_ids || [])).size;

    setData({
      totalProjects: p.length,
      activeProjects: p.filter((x: any) => x.status === 'em_execucao').length,
      completedProjects: p.filter((x: any) => x.status === 'concluido').length,
      totalStudents: s.length,
      activeStudents: s.filter((x: any) => x.status === 'ativo').length,
      totalHoursValidated: Math.floor(h.filter((x: any) => ['validada', 'integralizada'].includes(x.hour_state)).reduce((sum: number, x: any) => sum + Math.abs(x.minutes), 0) / 60),
      totalHoursPending: Math.floor(h.filter((x: any) => ['executada', 'declarada', 'aguardando_validacao'].includes(x.hour_state)).reduce((sum: number, x: any) => sum + Math.abs(x.minutes), 0) / 60),
      totalActivities: a.length,
      completedActivities: a.filter((x: any) => x.status === 'concluida').length,
      totalEvidence: e.length,
      approvedEvidence: e.filter((x: any) => x.validation_status === 'aprovada').length,
      pendingEvidence: e.filter((x: any) => x.validation_status === 'pendente').length,
      totalFindings: f.length,
      openFindings: f.filter((x: any) => x.status === 'aberto').length,
      criticalFindings: f.filter((x: any) => x.severity === 'critico' && x.status !== 'resolvido').length,
      totalPartners: (partners.data || []).length,
      sdgLinksCount: (sdgLinks.data || []).length,
      courseCoverage: coursesWithProjects,
      totalCourses: 0, // preenchido pelo pai se disponível
    });
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: '1rem', color: '#6b7280' }}>Carregando indicadores Impacto...</div>;
  if (!data) return null;

  const Card = ({ value, label, color, onClick }: { value: string | number; label: string; color?: string; onClick?: () => void }) => (
    <div onClick={onClick} style={{
      background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #e5e7eb)',
      borderRadius: '10px', padding: '.75rem 1rem', cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .15s',
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--text-primary, #1f2937)' }}>{value}</div>
      <div style={{ fontSize: '.78rem', color: 'var(--text-secondary, #6b7280)' }}>{label}</div>
    </div>
  );

  const nav = (view: string) => onNavigate ? () => onNavigate(view) : undefined;

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--accent, #0b9185)' }}>
        🌍 Impacto — Extensão Universitária
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '.75rem' }}>
        <Card value={data.activeProjects} label="Projetos ativos" color="#8b5cf6" onClick={nav('projetos')} />
        <Card value={data.completedProjects} label="Concluídos" color="#22c55e" onClick={nav('projetos')} />
        <Card value={data.activeStudents} label="Estudantes ativos" color="#3b82f6" onClick={nav('alunos')} />
        <Card value={`${data.totalHoursValidated}h`} label="Horas validadas" color="#22c55e" onClick={nav('alunos')} />
        <Card value={`${data.totalHoursPending}h`} label="Horas em trâmite" color="#f59e0b" onClick={nav('alunos')} />
        <Card value={data.completedActivities} label={`Atividades (${data.totalActivities})`} onClick={nav('atividades')} />
        <Card value={data.approvedEvidence} label={`Evidências aprovadas (${data.totalEvidence})`} color="#22c55e" onClick={nav('evidencias')} />
        {data.pendingEvidence > 0 && <Card value={data.pendingEvidence} label="Evidências pendentes" color="#f59e0b" onClick={nav('evidencias')} />}
        {data.criticalFindings > 0 && <Card value={data.criticalFindings} label="Achados críticos" color="#dc2626" onClick={nav('achados')} />}
        {data.openFindings > 0 && <Card value={data.openFindings} label="Achados abertos" color="#ea580c" onClick={nav('achados')} />}
        <Card value={data.totalPartners} label="Parceiros ativos" onClick={nav('parceiros')} />
        <Card value={data.sdgLinksCount} label="Vínculos ODS" color="#2563eb" onClick={nav('ods')} />
      </div>
    </div>
  );
}
