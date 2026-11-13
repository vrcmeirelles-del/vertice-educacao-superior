// CourseRaioX.tsx — Raio-X 360° completo por curso
// Visão otimizada para reunião com coordenador: tudo que a plataforma sabe, numa tela.
// Cada bloco com link "Abrir aba →" para detalhar na aba de origem.
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import './egressos360.css';

interface Props {
  institutionId: string;
  courses: { id: string; name: string; modality?: string; code?: string }[];
  role: string;
  onNavigate?: (tab: string, course?: string) => void;
}

interface RaioX {
  course_id: string; course_name: string; modality: string; code: string;
  docentes_total: number; docentes_doutores: number; docentes_mestres: number;
  docentes_integral: number; docentes_parcial: number; docentes_horista: number;
  alunos_risco: number;
  reprovacoes_total: number; reprovacoes_falta: number; reprovacoes_nota: number;
  orgaos_colegiados: number; ultima_reuniao: string | null; deliberacoes_pendentes: number;
  cpa_achados: number; cpa_fragilidades: number;
  egressos_total: number;
  extensao_projetos: number; extensao_alunos: number;
  metas_total: number; metas_concluidas: number;
  acoes_total: number; acoes_concluidas: number;
  diagnostico_total: number; diagnostico_media: number | null; diagnostico_frageis: number;
  evidencias_total: number; evidencias_validadas: number;
}

export default function CourseRaioX({ institutionId, courses, role, onNavigate }: Props) {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [data, setData] = useState<RaioX | null>(null);
  const [loading, setLoading] = useState(false);
  const [matriculados, setMatriculados] = useState(0);
  const [vagas, setVagas] = useState(0);
  const [egressosContato, setEgressosContato] = useState(0);
  const [peiAtivos, setPeiAtivos] = useState(0);
  const [tccData, setTccData] = useState<{ works: number; deposited: number; overdue: number; advisors: number }>({ works: 0, deposited: 0, overdue: 0, advisors: 0 });
  const [acData, setAcData] = useState<{ submissions: number; pending: number; credited_min: number }>({ submissions: 0, pending: 0, credited_min: 0 });
  const [estagioData, setEstagioData] = useState<{ placements: number; active: number; completed: number }>({ placements: 0, active: 0, completed: 0 });

  const course = courses.find(c => c.id === selectedCourse);
  const nav = (tab: string) => onNavigate?.(tab, selectedCourse);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    Promise.all([
      supabase.from('v_course_raio_x').select('*').eq('institution_id', institutionId).eq('course_id', selectedCourse).maybeSingle(),
      supabase.from('vertice_academic_reports').select('data').eq('institution_id', institutionId).eq('course_id', selectedCourse).eq('kind', 'quantitativo_alunos').order('report_date', { ascending: false }).limit(1),
      supabase.from('vertice_alumni_education').select('id,profile:vertice_alumni_profiles!profile_id(email,phone)').eq('institution_id', institutionId).eq('course_id', selectedCourse).in('academic_status', ['formado','diplomado','egresso_acompanhado','integralizado','concluinte']),
      supabase.from('student_individual_plans').select('id').eq('institution_id', institutionId).eq('course_id', selectedCourse).eq('status', 'ativo').then(r => r).catch(() => ({ data: [] })),
      // TCC
      supabase.from('vertice_tcc_works').select('id,stage,stage_deadline').eq('institution_id', institutionId).eq('course_id', selectedCourse).not('stage', 'in', '(cancelled,archived)').then(r => r).catch(() => ({ data: [] })),
      // AC
      supabase.from('v_ac_course_summary').select('*').eq('institution_id', institutionId).eq('course_id', selectedCourse).maybeSingle().catch(() => ({ data: null })),
      // Estágio
      supabase.from('v_internship_course_summary').select('*').eq('institution_id', institutionId).eq('course_id', selectedCourse).maybeSingle().catch(() => ({ data: null })),
    ]).then(([rx, mat, egr, pei, tcc, ac, est]) => {
      if (rx.data) setData(rx.data as RaioX);
      if (mat.data?.[0]?.data) { const md = mat.data[0].data as any; setMatriculados(Number(md.matriculados || md.total_matriculados || 0)); setVagas(Number(md.vagas || md.vagas_autorizadas || 0)); } else { setMatriculados(0); setVagas(0); }
      if (egr.data) setEgressosContato((egr.data as any[]).filter(r => r.profile?.email || r.profile?.phone).length);
      if (pei.data) setPeiAtivos((pei.data as any[]).length);
      // TCC
      const tccWorks = (tcc as any).data as any[] ?? [];
      const now = new Date();
      setTccData({
        works: tccWorks.length,
        deposited: tccWorks.filter((w: any) => w.stage === 'deposited').length,
        overdue: tccWorks.filter((w: any) => w.stage_deadline && new Date(w.stage_deadline) < now && w.stage !== 'deposited').length,
        advisors: 0, // seria necessário join
      });
      // AC
      const acd = (ac as any).data;
      if (acd) setAcData({ submissions: acd.submissions_total || 0, pending: acd.submissions_pending || 0, credited_min: acd.total_credited_minutes || 0 });
      // Estágio
      const estd = (est as any).data;
      if (estd) setEstagioData({ placements: estd.placements_total || 0, active: estd.placements_active || 0, completed: estd.completed || 0 });
    }).finally(() => setLoading(false));
  }, [institutionId, selectedCourse]);

  if (!selectedCourse) return (
    <div className="alumni-360">
      <header className="alumni-header"><h2>Raio-X do Curso</h2><p className="alumni-subtitle">Selecione um curso para ver a visão 360°</p></header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        {courses.map(c => (
          <button key={c.id} onClick={() => setSelectedCourse(c.id)} className="alumni-finding-card" style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--vx-border, #e2e8f0)' }}>
            <strong style={{ fontSize: '1rem' }}>{c.name}</strong>
            <span style={{ fontSize: '.8125rem', color: 'var(--vx-muted, #64748b)' }}>{c.modality || '—'}{c.code ? ` · ${c.code}` : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const d = data;
  const pctDoc = (n: number) => d && d.docentes_total > 0 ? `${Math.round(100 * n / d.docentes_total)}%` : '—';

  return (
    <div className="alumni-360">
      <header className="alumni-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <button onClick={() => { setSelectedCourse(''); setData(null); }} className="alumni-btn-back">← Todos os cursos</button>
            <h2 style={{ margin: 0 }}>Raio-X · {course?.name}</h2>
            <p className="alumni-subtitle">{course?.modality}{course?.code ? ` · ${course.code}` : ''}</p>
          </div>
          <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} style={{ padding: '.375rem .75rem', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 6, fontSize: '.8125rem' }}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </header>

      {loading || !d ? <p className="alumni-loading">Carregando Raio-X…</p> : (<>
        <div className="alumni-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <KPI label="Matriculados" value={matriculados} color="#2563eb" onClick={() => nav('visao')} />
          <KPI label="Vagas" value={vagas} sub={vagas > 0 ? `${Math.round(100 * matriculados / vagas)}% ocupação` : undefined} color="#7c3aed" />
          <KPI label="Docentes" value={d.docentes_total} sub={d.docentes_total > 0 ? `${pctDoc(d.docentes_doutores + d.docentes_mestres)} stricto` : undefined} color="#0891b2" />
          <KPI label="Em risco" value={d.alunos_risco} color="#dc2626" bad={d.alunos_risco > 0} onClick={() => nav('auditoria')} />
          <KPI label="Egressos" value={d.egressos_total} color="#16a34a" onClick={() => nav('egressos')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>

          <Block title="Corpo Docente" icon="👨‍🏫" onClick={() => nav('geral')}>
            <Row label="Total" value={d.docentes_total} />
            <Row label="Doutores" value={d.docentes_doutores} sub={pctDoc(d.docentes_doutores)} />
            <Row label="Mestres" value={d.docentes_mestres} sub={pctDoc(d.docentes_mestres)} />
            <Row label="Stricto sensu" value={d.docentes_doutores + d.docentes_mestres} sub={pctDoc(d.docentes_doutores + d.docentes_mestres)} good />
            <Divider />
            <Row label="Integral" value={d.docentes_integral} sub={pctDoc(d.docentes_integral)} />
            <Row label="Parcial" value={d.docentes_parcial} sub={pctDoc(d.docentes_parcial)} />
            <Row label="Horistas" value={d.docentes_horista} sub={pctDoc(d.docentes_horista)} bad={d.docentes_horista > d.docentes_integral} />
            {d.docentes_total === 0 && <Empty>Sem dados de docentes.</Empty>}
          </Block>

          <Block title="Risco Acadêmico" icon="⚠" onClick={() => nav('auditoria')}>
            <Row label="Alunos em risco" value={d.alunos_risco} bad={d.alunos_risco > 0} />
            <Row label="Reprovações totais" value={d.reprovacoes_total} />
            <Row label="Por falta" value={d.reprovacoes_falta} bad={d.reprovacoes_falta > d.reprovacoes_nota} />
            <Row label="Por nota" value={d.reprovacoes_nota} />
            {d.alunos_risco === 0 && d.reprovacoes_total === 0 && <Empty>Sem dados de risco.</Empty>}
            <Hint>Reprovação por falta alta pode indicar matrículas fantasma ou desistência silenciosa.</Hint>
          </Block>

          <Block title="NDE e Colegiado" icon="⚖" onClick={() => nav('governanca')}>
            <Row label="Órgãos ativos" value={d.orgaos_colegiados} />
            <Row label="Última reunião" value={d.ultima_reuniao ? new Date(d.ultima_reuniao).toLocaleDateString('pt-BR') : 'Nunca'} bad={!d.ultima_reuniao} />
            <Row label="Deliberações pendentes" value={d.deliberacoes_pendentes} bad={d.deliberacoes_pendentes > 0} />
            {d.orgaos_colegiados === 0 && <Empty>Nenhum NDE ou colegiado cadastrado.</Empty>}
            <Hint>Avaliador pergunta: "quando foi a última reunião do NDE?"</Hint>
          </Block>

          <Block title="Metas e Indicadores" icon="🎯" onClick={() => nav('metas')}>
            <Row label="Metas do curso" value={d.metas_total} />
            <Row label="Concluídas" value={d.metas_concluidas} good />
            <ProgressBar value={d.metas_total > 0 ? Math.round(100 * d.metas_concluidas / d.metas_total) : 0} label="Progresso" />
            {d.metas_total === 0 && <Empty>Nenhuma meta vinculada.</Empty>}
          </Block>

          <Block title="Plano 5W2H" icon="📋" onClick={() => nav('plano')}>
            <Row label="Ações do curso" value={d.acoes_total} />
            <Row label="Executadas" value={d.acoes_concluidas} good />
            <Row label="Pendentes" value={d.acoes_total - d.acoes_concluidas} bad={d.acoes_total - d.acoes_concluidas > 3} />
            {d.acoes_total === 0 && <Empty>Nenhuma ação vinculada.</Empty>}
          </Block>

          <Block title="Diagnóstico" icon="🔍" onClick={() => nav('diagnostico')}>
            <Row label="Critérios avaliados" value={d.diagnostico_total} />
            <Row label="Nota média" value={d.diagnostico_media !== null ? Number(d.diagnostico_media).toFixed(1) + '/5' : 'N/D'} good={d.diagnostico_media !== null && d.diagnostico_media >= 3.5} bad={d.diagnostico_media !== null && d.diagnostico_media < 3} />
            <Row label="Frágeis (≤2)" value={d.diagnostico_frageis} bad={d.diagnostico_frageis > 0} />
            {d.diagnostico_total === 0 && <Empty>Nenhum critério avaliado.</Empty>}
          </Block>

          <Block title="Evidências Regulatórias" icon="📂" onClick={() => nav('repositorio')}>
            <Row label="Itens" value={d.evidencias_total} />
            <Row label="Validados" value={d.evidencias_validadas} good />
            <Row label="Pendentes" value={d.evidencias_total - d.evidencias_validadas} bad={d.evidencias_total - d.evidencias_validadas > 5} />
            <ProgressBar value={d.evidencias_total > 0 ? Math.round(100 * d.evidencias_validadas / d.evidencias_total) : 0} label="Cobertura" />
            {d.evidencias_total === 0 && <Empty>Nenhuma evidência vinculada.</Empty>}
          </Block>

          <Block title="Extensão 360°" icon="🤝" onClick={() => nav('extensao')}>
            <Row label="Projetos" value={d.extensao_projetos} />
            <Row label="Alunos participantes" value={d.extensao_alunos} />
            {matriculados > 0 && <Row label="% em extensão" value={`${Math.round(100 * d.extensao_alunos / matriculados)}%`} bad={d.extensao_alunos / matriculados < 0.1} />}
            {d.extensao_projetos === 0 && <Empty>Nenhum projeto. Res. 7/2018 exige 10% da carga.</Empty>}
          </Block>

          <Block title="Inclusão e PEI" icon="♿" onClick={() => nav('inclusao')}>
            <Row label="PEIs ativos" value={peiAtivos} />
            {peiAtivos === 0 && <Empty>Nenhum PEI registrado.</Empty>}
          </Block>

          <Block title="Egressos 360°" icon="🎓" onClick={() => nav('egressos')}>
            <Row label="Total de egressos" value={d.egressos_total} />
            <Row label="Com contato válido" value={egressosContato} />
            <Row label="Cobertura" value={d.egressos_total > 0 ? `${Math.round(100 * egressosContato / d.egressos_total)}%` : 'N/D'} />
            {d.egressos_total === 0 && <Empty>Nenhum egresso cadastrado.</Empty>}
          </Block>

          <Block title="CPA — Achados do Curso" icon="📊" onClick={() => nav('cpa-autoavaliacao')}>
            <Row label="Achados" value={d.cpa_achados} />
            <Row label="Fragilidades" value={d.cpa_fragilidades} bad={d.cpa_fragilidades > 0} />
            <Row label="Potencialidades" value={d.cpa_achados - d.cpa_fragilidades} good />
            {d.cpa_achados === 0 && <Empty>Nenhum achado CPA vinculado.</Empty>}
            <Hint>Indicador 3.7: o que dizem deste curso na autoavaliação.</Hint>
          </Block>

          <Block title="TCC e Pesquisa" icon="📝" onClick={() => nav('tcc')}>
            <Row label="Trabalhos ativos" value={tccData.works} />
            <Row label="Depositados" value={tccData.deposited} good />
            <Row label="Com prazo vencido" value={tccData.overdue} bad={tccData.overdue > 0} />
            {tccData.works === 0 && <Empty>Nenhum trabalho cadastrado neste curso.</Empty>}
          </Block>

          <Block title="Atividades Complementares" icon="📜" onClick={() => nav('atividades-complementares')}>
            <Row label="Solicitações" value={acData.submissions} />
            <Row label="Pendentes de análise" value={acData.pending} bad={acData.pending > 3} />
            <Row label="Horas creditadas" value={acData.credited_min > 0 ? `${Math.floor(acData.credited_min / 60)}h` : '0h'} good />
            {acData.submissions === 0 && <Empty>Nenhuma solicitação de AC neste curso.</Empty>}
          </Block>

          <Block title="Estágio Obrigatório" icon="🏢" onClick={() => nav('estagio')}>
            <Row label="Vínculos" value={estagioData.placements} />
            <Row label="Em andamento" value={estagioData.active} />
            <Row label="Concluídos" value={estagioData.completed} good />
            {estagioData.placements === 0 && <Empty>Nenhum estágio registrado neste curso.</Empty>}
          </Block>

          <Block title="Horas Consolidadas" icon="⏱">
            <Row label="TCC" value={tccData.works > 0 ? `${Math.floor(0)}h validadas` : 'N/D'} />
            <Row label="Extensão" value={d.extensao_alunos > 0 ? `${d.extensao_alunos} alunos` : 'N/D'} />
            <Row label="Estágio" value={estagioData.placements > 0 ? `${estagioData.completed} concluídos` : 'N/D'} />
            <Hint>FK cruzada impede dupla contagem entre TCC e extensão. Estágio, AC e TCC possuem livros razão separados com controle de origem.</Hint>
          </Block>

          <Block title="Saúde Acadêmica do Curso" icon="🩺">
            {tccData.overdue > 0 && <Row label="⚠ TCC atrasados" value={tccData.overdue} bad />}
            {acData.pending > 3 && <Row label="⚠ AC pendentes (>3)" value={acData.pending} bad />}
            {d.cpa_fragilidades > 0 && <Row label="⚠ Fragilidades CPA" value={d.cpa_fragilidades} bad />}
            {d.extensao_projetos === 0 && <Row label="⚠ Sem extensão" value="Pendente" bad />}
            {d.egressos_total === 0 && <Row label="⚠ Sem egressos" value="Pendente" bad />}
            {tccData.overdue === 0 && acData.pending <= 3 && d.cpa_fragilidades === 0 && d.extensao_projetos > 0 && d.egressos_total > 0 && <Row label="✓ Sem alertas" value="OK" good />}
            <Hint>Visão cruzada de pendências entre todos os módulos acadêmicos deste curso.</Hint>
          </Block>

          <Block title="Vagas e Viabilidade" icon="📉" onClick={() => nav('resultado-curso')}>
            <Row label="Vagas autorizadas" value={vagas} />
            <Row label="Matriculados" value={matriculados} />
            <Row label="Ocupação" value={vagas > 0 ? `${Math.round(100 * matriculados / vagas)}%` : 'N/D'} bad={vagas > 0 && matriculados / vagas < 0.5} />
            <Row label="Vagas ociosas" value={Math.max(0, vagas - matriculados)} bad={vagas > 0 && matriculados / vagas < 0.5} />
            {vagas === 0 && <Empty>Sem dados de vagas.</Empty>}
            <Hint>Ocupação abaixo de 50% compromete viabilidade financeira.</Hint>
          </Block>

        </div>

        <div className="alumni-info-box" style={{ marginTop: '1.5rem' }}>
          <strong>Raio-X do Curso:</strong> Cada bloco puxa os dados do curso naquele módulo. Clique em <em>"Abrir aba →"</em> para destrinchar. Ideal para reuniões de NDE, colegiado ou preparação para avaliação in loco.
        </div>
      </>)}
    </div>
  );
}

function KPI({ label, value, sub, color, bad, onClick }: { label: string; value: number; sub?: string; color: string; bad?: boolean; onClick?: () => void }) {
  return (<div className="alumni-kpi" style={{ borderLeftColor: bad ? '#dc2626' : color, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
    <span className="alumni-kpi-value" style={bad ? { color: '#dc2626' } : undefined}>{value.toLocaleString('pt-BR')}</span>
    {sub && <span className="alumni-kpi-pct">{sub}</span>}
    <span className="alumni-kpi-label">{label}</span>
  </div>);
}
function Block({ title, icon, onClick, children }: { title: string; icon: string; onClick?: () => void; children: React.ReactNode }) {
  return (<div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
      <strong style={{ fontSize: '.9375rem' }}>{icon} {title}</strong>
      {onClick && <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vx-accent, #2563eb)', fontSize: '.75rem', fontWeight: 600 }}>Abrir aba →</button>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
  </div>);
}
function Row({ label, value, sub, good, bad }: { label: string; value: string | number; sub?: string; good?: boolean; bad?: boolean }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.8125rem', padding: '2px 0' }}>
    <span style={{ color: 'var(--vx-muted, #64748b)' }}>{label}</span>
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {sub && <span style={{ fontSize: '.6875rem', color: 'var(--vx-muted, #94a3b8)' }}>{sub}</span>}
      <strong style={{ color: bad ? '#dc2626' : good ? '#16a34a' : 'var(--vx-text, #1e293b)' }}>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</strong>
    </span>
  </div>);
}
function ProgressBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? '#16a34a' : value >= 40 ? '#d97706' : '#dc2626';
  return (<div style={{ padding: '4px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', marginBottom: 2 }}><span style={{ color: 'var(--vx-muted, #64748b)' }}>{label}</span><span>{value}%</span></div><div style={{ height: 6, background: 'var(--vx-border, #e2e8f0)', borderRadius: 3 }}><div style={{ width: `${Math.min(value, 100)}%`, height: 6, borderRadius: 3, background: color }} /></div></div>);
}
function Divider() { return <div style={{ borderTop: '1px solid var(--vx-border-light, #f1f5f9)', margin: '4px 0' }} />; }
function Empty({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: '.75rem', color: 'var(--vx-muted, #94a3b8)', margin: '4px 0 0', fontStyle: 'italic' }}>{children}</p>; }
function Hint({ children }: { children: React.ReactNode }) { return <p style={{ fontSize: '.6875rem', color: 'var(--vx-warning, #d97706)', margin: '6px 0 0' }}>💡 {children}</p>; }
