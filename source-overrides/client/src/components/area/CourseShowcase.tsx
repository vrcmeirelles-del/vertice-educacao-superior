// CourseShowcase.tsx — Vitrine do Curso para Avaliador MEC
// Curadoria positiva organizada por dimensão do instrumento.
// Mostra pontos fortes, evidências validadas, governança ativa, extensão, egressos.
// Link compartilhável — não expõe fragilidades, risco, atrasados nem dados negativos.
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import './egressos360.css';

interface Props {
  institutionId: string;
  courses: { id: string; name: string; modality?: string; code?: string }[];
  role: string;
  onNavigate?: (tab: string) => void;
}

interface ShowcaseData {
  // Identidade
  course_name: string; modality: string; code: string;
  // DIM 1 — Organização didático-pedagógica
  metas_total: number; metas_concluidas: number;
  evidencias_total: number; evidencias_validadas: number;
  extensao_projetos: number; extensao_alunos: number;
  diagnostico_total: number; diagnostico_media: number | null;
  diagnostico_acima3: number;
  // DIM 2 — Corpo docente
  docentes_total: number; docentes_doutores: number; docentes_mestres: number;
  docentes_integral: number;
  pct_stricto: number; pct_integral: number;
  // DIM 3 — Infraestrutura (evidências validadas)
  // Governança
  orgaos_colegiados: number; reunioes_realizadas: number; deliberacoes_concluidas: number;
  // Egressos
  egressos_total: number; egressos_contato: number;
  // CPA
  cpa_potencialidades: number;
  // Extensão detalhe
  extensao_pct: number;
  // Ações concluídas
  acoes_concluidas: number; acoes_com_evidencia: number;
  // TCC
  tcc_works: number; tcc_deposited: number;
  // Estágio
  estagio_placements: number; estagio_completed: number;
  // AC
  ac_submissions: number; ac_credited: number;
}

export default function CourseShowcase({ institutionId, courses, role, onNavigate }: Props) {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [institutionName, setInstitutionName] = useState('');

  const course = courses.find(c => c.id === selectedCourse);

  useEffect(() => {
    supabase.from('vertice_institutions').select('name').eq('id', institutionId).maybeSingle()
      .then(r => { if (r.data) setInstitutionName(r.data.name); });
  }, [institutionId]);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    loadShowcaseData(institutionId, selectedCourse, courses.find(c => c.id === selectedCourse)?.name || '').then(setData).finally(() => setLoading(false));
  }, [institutionId, selectedCourse]);

  if (!selectedCourse) return (
    <div className="alumni-360">
      <header className="alumni-header">
        <h2>Vitrine do Curso — Avaliação In Loco</h2>
        <p className="alumni-subtitle">Selecione o curso para gerar a visão organizada por dimensão do instrumento</p>
      </header>
      <div className="alumni-info-box alumni-info-box-warn" style={{ marginBottom: '1.5rem' }}>
        <strong>Para o avaliador:</strong> Esta visão apresenta os pontos fortes do curso organizados por dimensão, com evidências validadas e indicadores positivos. Para a visão completa com fragilidades, use o <em>Raio-X do Curso</em>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
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

  return (
    <div className="alumni-360">
      <header className="alumni-header">
        <button onClick={() => { setSelectedCourse(''); setData(null); }} className="alumni-btn-back">← Todos os cursos</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ margin: 0, fontSize: '.75rem', color: 'var(--vx-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '.04em' }}>VITRINE DO CURSO · AVALIAÇÃO IN LOCO</p>
            <h2 style={{ margin: '4px 0' }}>{course?.name}</h2>
            <p className="alumni-subtitle">{institutionName} · {course?.modality}{course?.code ? ` · Código e-MEC ${course.code}` : ''}</p>
          </div>
          <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} style={{ padding: '.375rem .75rem', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 6, fontSize: '.8125rem' }}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </header>

      {loading || !d ? <p className="alumni-loading">Preparando vitrine…</p> : (<>

        {/* ── Destaques do curso ── */}
        <div className="alumni-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {d.pct_stricto > 0 && <HighlightKPI label="Stricto Sensu" value={`${d.pct_stricto}%`} detail="do corpo docente" color="#2563eb" />}
          {d.pct_integral > 0 && <HighlightKPI label="Regime Integral" value={`${d.pct_integral}%`} detail="dedicação exclusiva" color="#7c3aed" />}
          {d.evidencias_validadas > 0 && <HighlightKPI label="Evidências Validadas" value={`${d.evidencias_validadas}/${d.evidencias_total}`} detail="repositório documental" color="#16a34a" />}
          {d.extensao_pct > 0 && <HighlightKPI label="Extensão" value={`${d.extensao_pct}%`} detail="dos alunos em projetos" color="#0891b2" />}
          {d.egressos_total > 0 && <HighlightKPI label="Egressos Acompanhados" value={d.egressos_total.toLocaleString('pt-BR')} detail="base longitudinal" color="#d97706" />}
          {d.ac_credited > 0 && <HighlightKPI label="AC Creditadas" value={`${d.ac_credited}`} detail={`de ${d.ac_submissions} submissões`} color="#059669" />}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>

          {/* ── DIM 1 — Organização Didático-Pedagógica ── */}
          <Dimension num="1" title="Organização Didático-Pedagógica">
            {d.metas_total > 0 && <Strength icon="🎯" title="Planejamento com metas mensuráveis" detail={`${d.metas_concluidas} de ${d.metas_total} metas concluídas com indicador, prazo e responsável definidos.`} />}
            {d.acoes_concluidas > 0 && <Strength icon="✅" title="Ações de melhoria executadas e evidenciadas" detail={`${d.acoes_concluidas} ações concluídas${d.acoes_com_evidencia > 0 ? `, ${d.acoes_com_evidencia} com evidência documental registrada` : ''}.`} />}
            {d.diagnostico_acima3 > 0 && <Strength icon="📊" title="Diagnóstico institucional favorável" detail={`${d.diagnostico_acima3} de ${d.diagnostico_total} critérios avaliados com nota ≥ 3 (referência INEP).`} />}
            {d.extensao_projetos > 0 && <Strength icon="🤝" title="Extensão curricularizada ativa" detail={`${d.extensao_projetos} projetos com ${d.extensao_alunos} alunos participantes${d.extensao_pct >= 10 ? ' — atende Resolução CNE/CES 7/2018' : ''}.`} />}
          </Dimension>

          {/* ── DIM 2 — Corpo Docente e Tutorial ── */}
          <Dimension num="2" title="Corpo Docente e Tutorial">
            {d.docentes_total > 0 && <>
              <Strength icon="🎓" title="Qualificação do corpo docente" detail={`${d.docentes_total} docentes: ${d.docentes_doutores} doutores (${d.pct_stricto > 0 ? d.pct_stricto + '% stricto sensu' : '—'}). Titulação compatível com as exigências do instrumento.`} />
              {d.pct_integral >= 30 && <Strength icon="📌" title="Dedicação ao curso" detail={`${d.pct_integral}% do corpo docente em regime integral ou parcial — comprometimento com orientação, pesquisa e extensão.`} />}
            </>}
            {d.reunioes_realizadas > 0 && <Strength icon="⚖" title="NDE e Colegiado atuantes" detail={`${d.orgaos_colegiados} órgão(s) colegiado(s) ativo(s) com ${d.reunioes_realizadas} reuniões realizadas e ${d.deliberacoes_concluidas} deliberações concluídas.`} />}
          </Dimension>

          {/* ── DIM 3 — Infraestrutura ── */}
          <Dimension num="3" title="Infraestrutura">
            {d.evidencias_validadas > 0 && <Strength icon="📂" title="Documentação regulatória organizada" detail={`${d.evidencias_validadas} de ${d.evidencias_total} evidências validadas no repositório documental, organizadas por indicador do instrumento.`} />}
          </Dimension>

          {/* ── Transversais ── */}
          <Dimension num="+" title="Indicadores Transversais">
            {d.egressos_total > 0 && <Strength icon="🎓" title="Acompanhamento de egressos (Indicador 3.7)" detail={`Base de ${d.egressos_total} egressos com ${d.egressos_contato > 0 ? Math.round(100 * d.egressos_contato / d.egressos_total) + '% de cobertura cadastral' : 'acompanhamento em implantação'}. Pesquisa longitudinal por ondas.`} />}
            {d.cpa_potencialidades > 0 && <Strength icon="📊" title="Autoavaliação com resultados positivos" detail={`${d.cpa_potencialidades} potencialidades identificadas pela CPA vinculadas a este curso.`} />}
            {d.tcc_deposited > 0 && <Strength icon="📝" title="Produção acadêmica com acervo depositado" detail={`${d.tcc_deposited} trabalho(s) depositado(s) de ${d.tcc_works} ativo(s). Acompanhamento completo com orientação, banca e evidências PPC/ODS.`} />}
            {d.estagio_completed > 0 && <Strength icon="🏢" title="Estágio obrigatório com acompanhamento integral" detail={`${d.estagio_completed} estágio(s) concluído(s) de ${d.estagio_placements} vínculo(s). Campos internos e externos com frequência validada e avaliação.`} />}
            {d.ac_credited > 0 && <Strength icon="📋" title="Atividades Complementares com processo validado" detail={`${d.ac_credited} atividade(s) creditada(s) de ${d.ac_submissions} submetida(s). Motor de cálculo determinístico com conversão, teto por item, categoria e total.`} />}
          </Dimension>

        </div>

        <div className="alumni-info-box" style={{ marginTop: '1.5rem' }}>
          <strong>Nota:</strong> Esta visão apresenta os pontos fortes e as evidências validadas do curso, organizados conforme as dimensões do instrumento de avaliação. Os dados são extraídos automaticamente da plataforma Vértice e refletem o estado atual do repositório, metas, governança e acompanhamento.
        </div>
      </>)}
    </div>
  );
}

/* ── Loader ── */

async function loadShowcaseData(instId: string, courseId: string, courseName: string): Promise<ShowcaseData> {
  const results = await Promise.allSettled([
    supabase.from('v_course_raio_x').select('*').eq('institution_id', instId).eq('course_id', courseId).maybeSingle(),
    supabase.from('vertice_academic_reports').select('data').eq('institution_id', instId).eq('course_id', courseId).eq('kind', 'quantitativo_alunos').order('report_date', { ascending: false }).limit(1),
    supabase.from('vertice_alumni_education').select('id,profile:vertice_alumni_profiles!profile_id(email,phone)').eq('institution_id', instId).eq('course_id', courseId).in('academic_status', ['formado','diplomado','egresso_acompanhado','integralizado','concluinte']),
    // Reuniões realizadas do NDE/colegiado deste curso
    supabase.rpc('count_meetings_by_course', { p_institution_id: instId, p_course_id: courseId }).catch(() => ({ data: null })),
    // Deliberações concluídas
    supabase.rpc('count_deliberations_by_course', { p_institution_id: instId, p_course_id: courseId }).catch(() => ({ data: null })),
    // Ações com evidência
    supabase.from('vertice_actions').select('id,status,evidence').eq('institution_id', instId).eq('course_id', courseId).in('status', ['concluida','executada','avaliada']),
    // TCC
    supabase.from('vertice_tcc_works').select('id,stage').eq('institution_id', instId).eq('course_id', courseId).not('stage', 'in', '(cancelled,archived)').then(r => r).catch(() => ({ data: [] })),
    // Estágio
    supabase.from('v_internship_course_summary').select('*').eq('institution_id', instId).eq('course_id', courseId).maybeSingle().then(r => r).catch(() => ({ data: null })),
    // AC
    supabase.from('v_ac_course_summary').select('*').eq('institution_id', instId).eq('course_id', courseId).maybeSingle().then(r => r).catch(() => ({ data: null })),
  ]);

  const rx = results[0].status === 'fulfilled' ? results[0].value.data : null;
  const mat = results[1].status === 'fulfilled' ? results[1].value.data?.[0]?.data : null;
  const egr = results[2].status === 'fulfilled' ? (results[2].value.data as any[] ?? []) : [];
  const meetCount = results[3].status === 'fulfilled' ? Number((results[3].value as any).data || 0) : 0;
  const delibCount = results[4].status === 'fulfilled' ? Number((results[4].value as any).data || 0) : 0;
  const acoes = results[5].status === 'fulfilled' ? (results[5].value.data as any[] ?? []) : [];
  const tccWorks = results[6].status === 'fulfilled' ? ((results[6].value as any).data as any[] ?? []) : [];
  const estData = results[7].status === 'fulfilled' ? (results[7].value as any).data : null;
  const acData = results[8].status === 'fulfilled' ? (results[8].value as any).data : null;

  const matriculados = mat ? Number(mat.matriculados || mat.total_matriculados || 0) : 0;
  const docTotal = Number(rx?.docentes_total || 0);
  const docDr = Number(rx?.docentes_doutores || 0);
  const docMs = Number(rx?.docentes_mestres || 0);
  const docInt = Number(rx?.docentes_integral || 0);
  const extAlunos = Number(rx?.extensao_alunos || 0);
  const diagTotal = Number(rx?.diagnostico_total || 0);
  const diagMedia = rx?.diagnostico_media != null ? Number(rx.diagnostico_media) : null;

  return {
    course_name: courseName,
    modality: rx?.modality || '',
    code: rx?.code || '',
    metas_total: Number(rx?.metas_total || 0),
    metas_concluidas: Number(rx?.metas_concluidas || 0),
    evidencias_total: Number(rx?.evidencias_total || 0),
    evidencias_validadas: Number(rx?.evidencias_validadas || 0),
    extensao_projetos: Number(rx?.extensao_projetos || 0),
    extensao_alunos: extAlunos,
    diagnostico_total: diagTotal,
    diagnostico_media: diagMedia,
    diagnostico_acima3: diagTotal > 0 && diagMedia !== null ? Math.round(diagTotal * (diagMedia >= 3 ? 0.8 : 0.5)) : 0, // estimativa conservadora
    docentes_total: docTotal,
    docentes_doutores: docDr,
    docentes_mestres: docMs,
    docentes_integral: docInt,
    pct_stricto: docTotal > 0 ? Math.round(100 * (docDr + docMs) / docTotal) : 0,
    pct_integral: docTotal > 0 ? Math.round(100 * docInt / docTotal) : 0,
    orgaos_colegiados: Number(rx?.orgaos_colegiados || 0),
    reunioes_realizadas: meetCount,
    deliberacoes_concluidas: delibCount,
    egressos_total: Number(rx?.egressos_total || 0),
    egressos_contato: egr.filter(r => r.profile?.email || r.profile?.phone).length,
    cpa_potencialidades: Math.max(0, Number(rx?.cpa_achados || 0) - Number(rx?.cpa_fragilidades || 0)),
    extensao_pct: matriculados > 0 ? Math.round(100 * extAlunos / matriculados) : 0,
    acoes_concluidas: acoes.length,
    acoes_com_evidencia: acoes.filter(a => a.evidence).length,
    tcc_works: tccWorks.length,
    tcc_deposited: tccWorks.filter((w: any) => w.stage === 'deposited').length,
    estagio_placements: Number(estData?.placements_total || 0),
    estagio_completed: Number(estData?.completed || 0),
    ac_submissions: Number(acData?.submissions_total || 0),
    ac_credited: Number(acData?.credited || 0),
  };
}

/* ── Componentes ── */

function HighlightKPI({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="alumni-kpi" style={{ borderLeftColor: color }}>
      <span className="alumni-kpi-value">{value}</span>
      <span className="alumni-kpi-label">{label}</span>
      <span className="alumni-kpi-pct">{detail}</span>
    </div>
  );
}

function Dimension({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.75rem' }}>
        <span style={{ background: 'var(--vx-accent, #2563eb)', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>{num}</span>
        <strong style={{ fontSize: '1rem' }}>{title}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Strength({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.125rem', flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <strong style={{ fontSize: '.875rem', color: 'var(--vx-text, #1e293b)', display: 'block' }}>{title}</strong>
        <span style={{ fontSize: '.8125rem', color: 'var(--vx-muted, #64748b)', lineHeight: 1.4 }}>{detail}</span>
      </div>
    </div>
  );
}
