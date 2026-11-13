// CourseRaioX.tsx — Raio-X 360° por curso
// Visão otimizada para reunião com coordenador: puxa todos os dados
// da plataforma sobre o curso, cada bloco com link para a aba de origem.
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import './egressos360.css';

interface Props {
  institutionId: string;
  courses: { id: string; name: string; modality?: string; code?: string }[];
  role: string;
  onNavigate?: (tab: string, course?: string) => void;
}

interface CourseData {
  // Matrículas
  matriculados: number; vagas: number; evasao: number;
  // Metas
  metas_total: number; metas_concluidas: number; metas_atrasadas: number;
  // Ações
  acoes_total: number; acoes_concluidas: number; acoes_atrasadas: number;
  // Diagnóstico
  diagnostico_total: number; diagnostico_media: number | null;
  diagnostico_frageis: number;
  // Evidências
  evidencias_total: number; evidencias_validadas: number; evidencias_pendentes: number;
  // Extensão
  extensao_projetos: number; extensao_alunos: number;
  // Inclusão/PEI
  pei_ativos: number; regimes_especiais: number;
  // Egressos
  egressos_total: number; egressos_contato: number;
  // CPA
  cpa_achados: number; cpa_fragilidades: number;
  // Docentes
  docentes: number;
}

const EMPTY: CourseData = {
  matriculados:0,vagas:0,evasao:0,
  metas_total:0,metas_concluidas:0,metas_atrasadas:0,
  acoes_total:0,acoes_concluidas:0,acoes_atrasadas:0,
  diagnostico_total:0,diagnostico_media:null,diagnostico_frageis:0,
  evidencias_total:0,evidencias_validadas:0,evidencias_pendentes:0,
  extensao_projetos:0,extensao_alunos:0,
  pei_ativos:0,regimes_especiais:0,
  egressos_total:0,egressos_contato:0,
  cpa_achados:0,cpa_fragilidades:0,
  docentes:0,
};

export default function CourseRaioX({ institutionId, courses, role, onNavigate }: Props) {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [data, setData] = useState<CourseData>(EMPTY);
  const [loading, setLoading] = useState(false);

  const course = courses.find(c => c.id === selectedCourse);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    loadCourseData(institutionId, selectedCourse).then(setData).finally(() => setLoading(false));
  }, [institutionId, selectedCourse]);

  const nav = (tab: string) => {
    if (onNavigate) onNavigate(tab, selectedCourse);
  };

  if (!selectedCourse) {
    return (
      <div className="alumni-360">
        <header className="alumni-header">
          <h2>Raio-X do Curso</h2>
          <p className="alumni-subtitle">Selecione um curso para ver a visão 360° otimizada para reunião com a coordenação</p>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          {courses.map(c => (
            <button key={c.id} onClick={() => setSelectedCourse(c.id)}
              style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 12, padding: '1.25rem', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, transition: 'all .15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--vx-accent, #2563eb)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--vx-border, #e2e8f0)')}>
              <strong style={{ fontSize: '1rem', color: 'var(--vx-text, #1e293b)' }}>{c.name}</strong>
              <span style={{ fontSize: '.8125rem', color: 'var(--vx-muted, #64748b)' }}>{c.modality || '—'}{c.code ? ` · ${c.code}` : ''}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="alumni-360">
      <header className="alumni-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <button onClick={() => setSelectedCourse('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vx-accent, #2563eb)', fontSize: '.8125rem', padding: 0, marginBottom: 4 }}>← Todos os cursos</button>
            <h2 style={{ margin: 0 }}>Raio-X · {course?.name}</h2>
            <p className="alumni-subtitle">{course?.modality}{course?.code ? ` · Código ${course.code}` : ''}</p>
          </div>
          <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}
            style={{ padding: '.375rem .75rem', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 6, fontSize: '.8125rem' }}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </header>

      {loading ? <p className="alumni-loading">Carregando Raio-X…</p> : (
        <>
          {/* KPIs principais */}
          <div className="alumni-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <KPI label="Matriculados" value={data.matriculados} color="#2563eb" onClick={() => nav('visao')} />
            <KPI label="Vagas" value={data.vagas} sub={data.vagas > 0 ? `${Math.round(100 * data.matriculados / data.vagas)}% ocupação` : undefined} color="#7c3aed" onClick={() => nav('visao')} />
            <KPI label="Evasão" value={data.evasao} sub="vínculos" color="#dc2626" onClick={() => nav('auditoria')} />
            <KPI label="Docentes" value={data.docentes} color="#0891b2" onClick={() => nav('geral')} />
          </div>

          {/* Blocos detalhados */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>

            {/* Metas */}
            <Block title="Metas e Indicadores" icon="🎯" onClick={() => nav('metas')}>
              <Row label="Total de metas" value={data.metas_total} />
              <Row label="Concluídas" value={data.metas_concluidas} good />
              <Row label="Atrasadas" value={data.metas_atrasadas} bad={data.metas_atrasadas > 0} />
              {data.metas_total === 0 && <Empty>Nenhuma meta cadastrada para este curso.</Empty>}
            </Block>

            {/* Plano de ação */}
            <Block title="Plano de Ação 5W2H" icon="📋" onClick={() => nav('plano')}>
              <Row label="Ações totais" value={data.acoes_total} />
              <Row label="Concluídas" value={data.acoes_concluidas} good />
              <Row label="Atrasadas" value={data.acoes_atrasadas} bad={data.acoes_atrasadas > 0} />
              {data.acoes_total === 0 && <Empty>Nenhuma ação vinculada a este curso.</Empty>}
            </Block>

            {/* Diagnóstico */}
            <Block title="Diagnóstico" icon="🔍" onClick={() => nav('diagnostico')}>
              <Row label="Critérios avaliados" value={data.diagnostico_total} />
              <Row label="Nota média" value={data.diagnostico_media !== null ? data.diagnostico_media.toFixed(1) : 'N/D'} />
              <Row label="Critérios frágeis (≤2)" value={data.diagnostico_frageis} bad={data.diagnostico_frageis > 0} />
              {data.diagnostico_total === 0 && <Empty>Nenhum critério avaliado para este curso.</Empty>}
            </Block>

            {/* Evidências regulatórias */}
            <Block title="Evidências Regulatórias" icon="📂" onClick={() => nav('repositorio')}>
              <Row label="Itens no repositório" value={data.evidencias_total} />
              <Row label="Validadas" value={data.evidencias_validadas} good />
              <Row label="Pendentes" value={data.evidencias_pendentes} bad={data.evidencias_pendentes > 0} />
              {data.evidencias_total === 0 && <Empty>Nenhuma evidência vinculada a este curso.</Empty>}
            </Block>

            {/* Extensão */}
            <Block title="Extensão 360°" icon="🤝" onClick={() => nav('extensao')}>
              <Row label="Projetos vinculados" value={data.extensao_projetos} />
              <Row label="Alunos participantes" value={data.extensao_alunos} />
              {data.extensao_projetos === 0 && <Empty>Nenhum projeto de extensão vinculado.</Empty>}
            </Block>

            {/* Inclusão / PEI */}
            <Block title="Inclusão e PEI" icon="♿" onClick={() => nav('inclusao')}>
              <Row label="PEIs ativos" value={data.pei_ativos} />
              <Row label="Regimes especiais" value={data.regimes_especiais} />
              {data.pei_ativos === 0 && data.regimes_especiais === 0 && <Empty>Nenhum acompanhamento registrado.</Empty>}
            </Block>

            {/* Egressos */}
            <Block title="Egressos 360°" icon="🎓" onClick={() => nav('egressos')}>
              <Row label="Total de egressos" value={data.egressos_total} />
              <Row label="Com contato válido" value={data.egressos_contato} />
              <Row label="Cobertura" value={data.egressos_total > 0 ? `${Math.round(100 * data.egressos_contato / data.egressos_total)}%` : 'N/D'} />
              {data.egressos_total === 0 && <Empty>Nenhum egresso cadastrado para este curso.</Empty>}
            </Block>

            {/* CPA */}
            <Block title="CPA — Achados" icon="📊" onClick={() => nav('cpa-autoavaliacao')}>
              <Row label="Achados do curso" value={data.cpa_achados} />
              <Row label="Fragilidades" value={data.cpa_fragilidades} bad={data.cpa_fragilidades > 0} />
              {data.cpa_achados === 0 && <Empty>Nenhum achado CPA vinculado a este curso.</Empty>}
            </Block>

          </div>

          <div className="alumni-info-box" style={{ marginTop: '1.5rem' }}>
            <strong>Como usar o Raio-X:</strong> Cada bloco mostra os dados do curso naquele módulo. Clique no título para abrir a aba de origem com todos os detalhes. Use em reuniões com coordenadores — tudo que a plataforma sabe sobre o curso, numa tela.
          </div>
        </>
      )}
    </div>
  );
}

/* ── Loader de dados ── */

async function loadCourseData(instId: string, courseId: string): Promise<CourseData> {
  const d = { ...EMPTY };

  const results = await Promise.allSettled([
    // Matrículas (academic_reports)
    supabase.from('vertice_academic_reports').select('data').eq('institution_id', instId).eq('course_id', courseId).eq('kind', 'quantitativo_alunos').order('report_date', { ascending: false }).limit(1),
    // Metas
    supabase.from('vertice_goals').select('id,status,due_date').eq('institution_id', instId).eq('course_id', courseId),
    // Ações
    supabase.from('vertice_actions').select('id,status,due_date').eq('institution_id', instId).eq('course_id', courseId),
    // Diagnóstico
    supabase.from('vertice_diagnosis_items').select('id,score,status').eq('institution_id', instId).eq('course_id', courseId),
    // Evidências (checklist)
    supabase.from('vertice_instrumento_checklist').select('id,status').eq('institution_id', instId).eq('course_id', courseId),
    // Extensão (projetos com alunos deste curso)
    supabase.from('vertice_extension_students').select('id,project_id').eq('course_id', courseId),
    // Inclusão — student_individual_plans por curso
    supabase.rpc('count_pei_by_course', { p_institution_id: instId, p_course_id: courseId }).then(r => r).catch(() => ({ data: null })),
    // Egressos
    supabase.from('vertice_alumni_education').select('id,profile:vertice_alumni_profiles!profile_id(email,phone)').eq('institution_id', instId).eq('course_id', courseId).in('academic_status', ['formado','diplomado','egresso_acompanhado','integralizado','concluinte']),
    // CPA findings
    supabase.from('vertice_cpa_findings').select('id,finding_type').eq('institution_id', instId).eq('course_id', courseId),
    // Docentes (se existir tabela)
    supabase.from('vertice_eorbit_cursos').select('id').eq('instituicao_id', instId).limit(1).then(() =>
      supabase.rpc('count_docentes_by_course', { p_institution_id: instId, p_course_id: courseId })
    ).catch(() => ({ data: null })),
  ]);

  // Matrículas
  const matR = results[0];
  if (matR.status === 'fulfilled' && matR.value.data?.[0]?.data) {
    const md = matR.value.data[0].data as any;
    d.matriculados = Number(md.matriculados || md.total_matriculados || 0);
    d.vagas = Number(md.vagas || md.vagas_autorizadas || 0);
    d.evasao = Number(md.evasao || md.evadidos || md.cancelados || 0);
  }

  // Metas
  const metR = results[1];
  if (metR.status === 'fulfilled' && metR.value.data) {
    const rows = metR.value.data as any[];
    d.metas_total = rows.length;
    d.metas_concluidas = rows.filter(r => r.status === 'concluida').length;
    const now = new Date().toISOString().slice(0, 10);
    d.metas_atrasadas = rows.filter(r => r.due_date && r.due_date < now && r.status !== 'concluida' && r.status !== 'cancelada').length;
  }

  // Ações
  const actR = results[2];
  if (actR.status === 'fulfilled' && actR.value.data) {
    const rows = actR.value.data as any[];
    d.acoes_total = rows.length;
    d.acoes_concluidas = rows.filter(r => r.status === 'concluida' || r.status === 'executada' || r.status === 'avaliada').length;
    const now = new Date().toISOString().slice(0, 10);
    d.acoes_atrasadas = rows.filter(r => r.due_date && r.due_date < now && !['concluida','executada','avaliada','cancelada'].includes(r.status)).length;
  }

  // Diagnóstico
  const diagR = results[3];
  if (diagR.status === 'fulfilled' && diagR.value.data) {
    const rows = diagR.value.data as any[];
    d.diagnostico_total = rows.length;
    const scores = rows.filter(r => r.score != null).map(r => Number(r.score));
    d.diagnostico_media = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    d.diagnostico_frageis = scores.filter(s => s <= 2).length;
  }

  // Evidências
  const evR = results[4];
  if (evR.status === 'fulfilled' && evR.value.data) {
    const rows = evR.value.data as any[];
    d.evidencias_total = rows.length;
    d.evidencias_validadas = rows.filter(r => r.status === 'validado' || r.status === 'atende').length;
    d.evidencias_pendentes = rows.filter(r => r.status === 'pendente' || r.status === 'nao_atende').length;
  }

  // Extensão
  const extR = results[5];
  if (extR.status === 'fulfilled' && extR.value.data) {
    const rows = extR.value.data as any[];
    d.extensao_alunos = rows.length;
    d.extensao_projetos = new Set(rows.map(r => r.project_id)).size;
  }

  // PEI (fallback se RPC não existe)
  const peiR = results[6];
  if (peiR.status === 'fulfilled' && (peiR.value as any).data != null) {
    const val = (peiR.value as any).data;
    d.pei_ativos = Number(val?.pei_count || val || 0);
    d.regimes_especiais = Number(val?.special_count || 0);
  }

  // Egressos
  const egrR = results[7];
  if (egrR.status === 'fulfilled' && egrR.value.data) {
    const rows = egrR.value.data as any[];
    d.egressos_total = rows.length;
    d.egressos_contato = rows.filter(r => r.profile?.email || r.profile?.phone).length;
  }

  // CPA
  const cpaR = results[8];
  if (cpaR.status === 'fulfilled' && cpaR.value.data) {
    const rows = cpaR.value.data as any[];
    d.cpa_achados = rows.length;
    d.cpa_fragilidades = rows.filter(r => r.finding_type === 'fragilidade').length;
  }

  // Docentes
  const docR = results[9];
  if (docR.status === 'fulfilled' && (docR.value as any).data != null) {
    d.docentes = Number((docR.value as any).data || 0);
  }

  return d;
}

/* ── Componentes auxiliares ── */

function KPI({ label, value, sub, color, onClick }: { label: string; value: number; sub?: string; color: string; onClick?: () => void }) {
  return (
    <div className="alumni-kpi" style={{ borderLeftColor: color, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <span className="alumni-kpi-value">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</span>
      {sub && <span className="alumni-kpi-pct">{sub}</span>}
      <span className="alumni-kpi-label">{label}</span>
    </div>
  );
}

function Block({ title, icon, onClick, children }: { title: string; icon: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
        <strong style={{ fontSize: '.9375rem' }}>{icon} {title}</strong>
        {onClick && <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vx-accent, #2563eb)', fontSize: '.75rem', fontWeight: 600 }}>Abrir aba →</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, good, bad }: { label: string; value: string | number; good?: boolean; bad?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.8125rem', padding: '3px 0' }}>
      <span style={{ color: 'var(--vx-muted, #64748b)' }}>{label}</span>
      <strong style={{ color: bad ? '#dc2626' : good ? '#16a34a' : 'var(--vx-text, #1e293b)' }}>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</strong>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '.75rem', color: 'var(--vx-muted, #94a3b8)', margin: '4px 0 0', fontStyle: 'italic' }}>{children}</p>;
}
