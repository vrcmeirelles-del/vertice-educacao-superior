// Extensao360.tsx — Repositório de Projetos de Extensão (v2 — fluxo completo)
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./extensao360.css";

type View = 'projetos' | 'equipe' | 'alunos' | 'entregas' | 'cobertura' | 'revisoes';

interface ExtProject {
  id: string; title: string; code: string; project_type: string; description: string;
  target_community: string; target_audience_count: number; coordinator_name: string; coordinator_email: string;
  status: string; review_status: string; start_date: string; end_date: string; total_hours: number;
  semester: string; course_ids: string[]; partner_institutions: string[];
  ods_goals: string[]; budget_estimated: number; budget_executed: number;
  axis_id: string; ai_suggested_axis_id: string; ai_axis_note: string; created_at: string;
}
interface TeamMember {
  id: string; project_id: string; role_type: string; full_name: string;
  email: string; cpf: string; lattes_url: string; hours_assigned: number; is_active: boolean;
}
interface Student {
  id: string; project_id: string; full_name: string; email: string; phone: string;
  registration_number: string; cpf: string; course_id: string;
  hours_assigned: number; hours_completed: number; is_scholarship: boolean; status: string;
}
interface Deliverable {
  id: string; project_id: string; title: string; deliverable_type: string;
  description: string; delivered_at: string; url: string;
}
interface Axis { id: string; name: string; description: string; ods_alignment: string[]; suggested_by_ai: boolean; }
interface Review {
  id: string; project_id: string; review_stage: string; reviewer_name: string;
  reviewer_email: string; reviewer_role: string; status: string;
  comment: string; adjustment_request: string; reviewed_at: string;
}
interface Coverage { course_id: string; semester: string; total_projects: number; total_students: number; total_student_hours: number; }

const STATUS_COLORS: Record<string, string> = {
  planejamento: '#6b7280', em_aprovacao: '#f59e0b', aprovado: '#3b82f6',
  em_execucao: '#8b5cf6', concluido: '#22c55e', cancelado: '#ef4444', suspenso: '#9ca3af',
  ativo: '#22c55e', desligado: '#ef4444', trancado: '#6b7280',
  pendente: '#f59e0b', em_analise: '#3b82f6', ajuste_solicitado: '#ef4444', rejeitado: '#991b1b',
};
const STATUS_LABELS: Record<string, string> = {
  planejamento: 'Planejamento', em_aprovacao: 'Em Aprovação', aprovado: 'Aprovado',
  em_execucao: 'Em Execução', concluido: 'Concluído', cancelado: 'Cancelado', suspenso: 'Suspenso',
  ativo: 'Ativo', desligado: 'Desligado', trancado: 'Trancado',
  pendente: 'Pendente', em_analise: 'Em Análise', ajuste_solicitado: 'Ajuste Solicitado', rejeitado: 'Rejeitado',
};
const TYPE_LABELS: Record<string, string> = {
  projeto: 'Projeto', programa: 'Programa', curso_extensao: 'Curso de Extensão',
  evento: 'Evento', prestacao_servico: 'Prestação de Serviço',
};
const DELIV_LABELS: Record<string, string> = {
  relatorio_parcial: 'Relatório Parcial', relatorio_final: 'Relatório Final',
  artigo: 'Artigo', publicacao: 'Publicação', evento_realizado: 'Evento Realizado',
  produto: 'Produto', certificado: 'Certificado', outro: 'Outro',
};
const REVIEW_LABELS: Record<string, string> = { acompanhamento: 'Acompanhamento da Extensão', regulacao: 'Regulação' };

function Badge({ status }: { status: string }) {
  return <span className="ext-badge" style={{ background: (STATUS_COLORS[status] || '#888') + '18', color: STATUS_COLORS[status] || '#888' }}>
    {STATUS_LABELS[status] || status}
  </span>;
}
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }

export default function Extensao360({ institutionId, role, courses, onBack }: {
  institutionId: string; role: string;
  courses?: { id: string; name: string }[];
  onBack?: () => void;
}) {
  const [view, setView] = useState<View>('projetos');
  const [projects, setProjects] = useState<ExtProject[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [axes, setAxes] = useState<Axis[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [formType, setFormType] = useState<'project' | 'team' | 'student' | 'deliverable' | 'axis' | 'review'>('project');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  const load = useCallback(async () => {
    setLoading(true);
    const [p, t, s, del, ax, rev, cov] = await Promise.all([
      supabase.from('vertice_extension_projects').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('vertice_extension_team').select('*').eq('institution_id', institutionId).order('full_name'),
      supabase.from('vertice_extension_students').select('*').eq('institution_id', institutionId).order('full_name'),
      supabase.from('vertice_extension_deliverables').select('*').eq('institution_id', institutionId).order('delivered_at', { ascending: false }),
      supabase.from('vertice_extension_axes').select('*').eq('institution_id', institutionId).order('name'),
      supabase.from('vertice_extension_reviews').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('v_extension_coverage').select('*').eq('institution_id', institutionId),
    ]);
    setProjects((p.data || []) as ExtProject[]);
    setTeam((t.data || []) as TeamMember[]);
    setStudents((s.data || []) as Student[]);
    setDeliverables((del.data || []) as Deliverable[]);
    setAxes((ax.data || []) as Axis[]);
    setReviews((rev.data || []) as Review[]);
    setCoverage((cov.data || []) as Coverage[]);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const canEdit = role === 'master' || role === 'gestor';

  // KPIs
  const emExecucao = projects.filter(p => p.status === 'em_execucao').length;
  const concluidos = projects.filter(p => p.status === 'concluido').length;
  const totalStudents = students.filter(s => s.status === 'ativo').length;
  const totalDocentes = team.filter(t => t.role_type === 'professor' || t.role_type === 'coordenador').length;
  const totalComunidade = projects.reduce((s, p) => s + (p.target_audience_count || 0), 0);
  const horasDiscentes = students.reduce((s, st) => s + (st.hours_completed || 0), 0);
  const cursosComExtensao = new Set(projects.flatMap(p => p.course_ids || [])).size;
  const totalCursos = courses?.length || 0;
  const pctCobertura = totalCursos > 0 ? Math.round((cursosComExtensao / totalCursos) * 100) : 0;
  const pendentesRevisao = projects.filter(p => p.review_status === 'pendente' || p.review_status === 'ajuste_solicitado').length;

  const filteredProjects = filterStatus === 'todos' ? projects : projects.filter(p => p.status === filterStatus);

  function courseName(id: string) { return courses?.find(c => c.id === id)?.name || id.slice(0, 8); }
  function axisName(id: string) { return axes.find(a => a.id === id)?.name || ''; }

  // === SAVES ===
  async function saveProject() {
    const payload: any = {
      ...formData, institution_id: institutionId,
      code: formData.code || ('EXT-' + new Date().getFullYear() + '-' + String(projects.length + 1).padStart(3, '0')),
      course_ids: formData.course_ids || [],
      partner_institutions: formData.partner_institutions_text ? formData.partner_institutions_text.split(',').map((s: string) => s.trim()) : (formData.partner_institutions || []),
      ods_goals: formData.ods_goals_text ? formData.ods_goals_text.split(',').map((s: string) => s.trim()) : (formData.ods_goals || []),
    };
    delete payload.partner_institutions_text; delete payload.ods_goals_text; delete payload.evidence_files;
    // Se está concluindo, marcar como pendente para revisão do Acompanhamento
    if (payload.status === 'concluido' && (!formData.id || projects.find(p => p.id === formData.id)?.status !== 'concluido')) {
      payload.review_status = 'pendente';
    }
    if (payload.id) {
      payload.updated_at = new Date().toISOString();
      await supabase.from('vertice_extension_projects').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      await supabase.from('vertice_extension_projects').insert(payload);
    }
    setShowForm(false); setFormData({}); load();
  }

  async function saveTeamMember() {
    const payload = { ...formData, institution_id: institutionId, project_id: selectedProject };
    if (payload.id) {
      await supabase.from('vertice_extension_team').update(payload).eq('id', payload.id);
    } else { delete payload.id; await supabase.from('vertice_extension_team').insert(payload); }
    setShowForm(false); setFormData({}); load();
  }

  async function saveStudent() {
    const payload = { ...formData, institution_id: institutionId, project_id: selectedProject };
    if (payload.id) {
      await supabase.from('vertice_extension_students').update(payload).eq('id', payload.id);
    } else { delete payload.id; await supabase.from('vertice_extension_students').insert(payload); }
    setShowForm(false); setFormData({}); load();
  }

  async function saveDeliverable() {
    const payload = { ...formData, institution_id: institutionId, project_id: selectedProject };
    if (payload.id) {
      await supabase.from('vertice_extension_deliverables').update(payload).eq('id', payload.id);
    } else { delete payload.id; await supabase.from('vertice_extension_deliverables').insert(payload); }
    setShowForm(false); setFormData({}); load();
  }

  async function saveAxis() {
    const payload = { ...formData, institution_id: institutionId,
      ods_alignment: formData.ods_text ? formData.ods_text.split(',').map((s: string) => s.trim()) : (formData.ods_alignment || []),
    };
    delete payload.ods_text;
    if (payload.id) { await supabase.from('vertice_extension_axes').update(payload).eq('id', payload.id); }
    else { delete payload.id; await supabase.from('vertice_extension_axes').insert(payload); }
    setShowForm(false); setFormData({}); load();
  }

  async function submitReview(projectId: string, stage: string, status: string, comment: string, adjustment?: string) {
    await supabase.from('vertice_extension_reviews').insert({
      institution_id: institutionId, project_id: projectId, review_stage: stage,
      reviewer_name: '', reviewer_role: stage, status, comment,
      adjustment_request: adjustment || null, reviewed_at: new Date().toISOString(),
    });
    // Atualizar review_status do projeto
    const newStatus = status === 'aprovado' && stage === 'acompanhamento' ? 'pendente' // vai pra Regulação
      : status === 'aprovado' && stage === 'regulacao' ? 'aprovado'
      : status;
    await supabase.from('vertice_extension_projects').update({ review_status: newStatus }).eq('id', projectId);
    load();
  }

  const projTeam = selectedProject ? team.filter(t => t.project_id === selectedProject) : [];
  const projStudents = selectedProject ? students.filter(s => s.project_id === selectedProject) : [];
  const projDeliverables = selectedProject ? deliverables.filter(d => d.project_id === selectedProject) : [];

  return (
    <div className="ext-container">
      {onBack && <button type="button" className="ext-back" onClick={onBack}>← Voltar aos módulos</button>}
      <div className="ext-header">
        <div>
          <h2>🤝 Extensão 360°</h2>
          <p>Pró-Reitoria de Extensão · DCNs: mínimo 10% da carga horária</p>
        </div>
        {canEdit && view === 'projetos' && (
          <div className="ext-header-actions">
            <button className="ext-btn-secondary" onClick={() => { setFormType('axis'); setFormData({}); setShowForm(true); }}>+ Eixo temático</button>
            <button className="ext-btn-primary" onClick={() => { setFormType('project'); setFormData({ status: 'planejamento', review_status: 'pendente', project_type: 'projeto', course_ids: [] }); setShowForm(true); }}>+ Novo projeto</button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="ext-kpis">
        <div className="ext-kpi"><strong>{projects.length}</strong><span>Projetos registrados</span></div>
        <div className="ext-kpi info"><strong>{emExecucao}</strong><span>Em execução</span></div>
        <div className="ext-kpi success"><strong>{concluidos}</strong><span>Concluídos</span></div>
        <div className="ext-kpi"><strong>{totalStudents}</strong><span>Discentes envolvidos</span></div>
        <div className="ext-kpi"><strong>{totalDocentes}</strong><span>Docentes</span></div>
        <div className="ext-kpi"><strong>{totalComunidade}</strong><span>Comunidade</span></div>
        <div className="ext-kpi"><strong>{horasDiscentes}h</strong><span>Horas discentes cumpridas</span></div>
        <div className="ext-kpi" style={pctCobertura < 50 ? {borderLeft:'3px solid #ef4444'} : {}}><strong style={pctCobertura < 50 ? {color:'#ef4444'} : {}}>{cursosComExtensao}/{totalCursos}</strong><span>Cursos com extensão ({pctCobertura}%)</span></div>
      </div>

      {/* Tabs de navegação */}
      <div className="ext-tabs">
        {(['projetos','equipe','alunos','entregas','cobertura','revisoes'] as View[]).map(v => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {v === 'projetos' ? `Projetos (${projects.length})` :
             v === 'equipe' ? `Equipe (${team.length})` :
             v === 'alunos' ? `Alunos (${students.length})` :
             v === 'entregas' ? `Entregas (${deliverables.length})` :
             v === 'cobertura' ? 'Cobertura por Curso' :
             `Revisões (${pendentesRevisao})`}
          </button>
        ))}
      </div>

      {loading ? <p className="ext-loading">Carregando dados de extensão...</p> : (
        <>
          {/* ===== PROJETOS ===== */}
          {view === 'projetos' && (
            <div className="ext-section">
              <div className="ext-filter-row">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="todos">Todos os status</option>
                  {Object.entries(STATUS_LABELS).filter(([k]) => !['ativo','desligado','trancado','pendente','em_analise','ajuste_solicitado','rejeitado'].includes(k)).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {axes.length > 0 && <span className="ext-axes-count">{axes.length} eixo(s) temático(s) · {axes.filter(a => a.suggested_by_ai).length} sugerido(s) por IA</span>}
              </div>

              {/* Form: Eixo temático */}
              {showForm && formType === 'axis' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Novo'} Eixo Temático</h3>
                  <div className="ext-form-grid">
                    <label>Nome do eixo<input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Direitos Humanos e Cidadania" /></label>
                    <label>ODS vinculados<input value={formData.ods_text ?? (formData.ods_alignment || []).join(', ')} onChange={e => setFormData({ ...formData, ods_text: e.target.value })} placeholder="ODS4, ODS10, ODS16" /></label>
                  </div>
                  <label className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></label>
                  {/* Eixos pré-cadastrados por ODS */}
                  {!formData.id && axes.length > 0 && (
                    <div style={{marginTop:'.75rem'}}>
                      <p style={{fontSize:'.82rem',color:'var(--text-secondary,#6b7280)',marginBottom:'.5rem'}}>💡 Eixos já cadastrados (clique para editar):</p>
                      <div className="ext-course-chips">
                        {axes.map(a => <button key={a.id} type="button" className="ext-chip" onClick={() => setFormData({...a, ods_text: a.ods_alignment.join(', ')})}>
                          {a.suggested_by_ai && '🤖 '}{a.name} · {a.ods_alignment.join(', ')}
                        </button>)}
                      </div>
                    </div>
                  )}
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveAxis}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Form: Projeto completo */}
              {showForm && formType === 'project' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Novo'} Projeto de Extensão</h3>
                  <div className="ext-form-grid">
                    <label>Título<input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></label>
                    <label>Código<input value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="EXT-2026-001" /></label>
                    <label>Tipo
                      <select value={formData.project_type || 'projeto'} onChange={e => setFormData({ ...formData, project_type: e.target.value })}>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label>Eixo temático
                      <select value={formData.axis_id || ''} onChange={e => setFormData({ ...formData, axis_id: e.target.value || null })}>
                        <option value="">— Selecionar eixo —</option>
                        {axes.map(a => <option key={a.id} value={a.id}>{a.suggested_by_ai ? '🤖 ' : ''}{a.name} ({a.ods_alignment.join(', ')})</option>)}
                      </select>
                    </label>
                    <label>Coordenador
                      <input value={formData.coordinator_name || ''} onChange={e => setFormData({ ...formData, coordinator_name: e.target.value })} list="coord-list" placeholder="Selecione ou digite" />
                      <datalist id="coord-list">
                        {team.filter(t => t.role_type === 'coordenador').map(t => <option key={t.id} value={t.full_name}>{t.full_name} — {t.email}</option>)}
                      </datalist>
                    </label>
                    <label>E-mail coordenador<input type="email" value={formData.coordinator_email || ''} onChange={e => setFormData({ ...formData, coordinator_email: e.target.value })} /></label>
                    <label>Comunidade atendida<input value={formData.target_community || ''} onChange={e => setFormData({ ...formData, target_community: e.target.value })} placeholder="Ex: moradores do Jardim Aureny" /></label>
                    <label>Público estimado<input type="number" value={formData.target_audience_count || ''} onChange={e => setFormData({ ...formData, target_audience_count: +e.target.value })} /></label>
                    <label>Semestre<input value={formData.semester || ''} onChange={e => setFormData({ ...formData, semester: e.target.value })} placeholder="2026/01" /></label>
                    <label>Carga horária total<input type="number" value={formData.total_hours || ''} onChange={e => setFormData({ ...formData, total_hours: +e.target.value })} /></label>
                    <label>Início<input type="date" value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></label>
                    <label>Término<input type="date" value={formData.end_date || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} /></label>
                    <label>Status
                      <select value={formData.status || 'planejamento'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                        {Object.entries(STATUS_LABELS).filter(([k]) => !['ativo','desligado','trancado','pendente','em_analise','ajuste_solicitado','rejeitado'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label>Orçamento estimado<input type="number" step="0.01" value={formData.budget_estimated || ''} onChange={e => setFormData({ ...formData, budget_estimated: +e.target.value })} /></label>
                    <label>Parceiros<input value={formData.partner_institutions_text ?? (formData.partner_institutions || []).join(', ')} onChange={e => setFormData({ ...formData, partner_institutions_text: e.target.value })} placeholder="OAB, Defensoria, CRAS" /></label>
                    <label>ODS<input value={formData.ods_goals_text ?? (formData.ods_goals || []).join(', ')} onChange={e => setFormData({ ...formData, ods_goals_text: e.target.value })} placeholder="ODS4, ODS16" /></label>
                  </div>
                  <label className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></label>

                  {/* Cursos vinculados */}
                  {courses && courses.length > 0 && (
                    <div className="ext-course-picker">
                      <strong>Cursos vinculados:</strong>
                      <div className="ext-course-chips">
                        {courses.map(c => {
                          const selected = (formData.course_ids || []).includes(c.id);
                          return <button key={c.id} type="button" className={`ext-chip ${selected ? 'selected' : ''}`}
                            onClick={() => { const ids = formData.course_ids || []; setFormData({ ...formData, course_ids: selected ? ids.filter((i: string) => i !== c.id) : [...ids, c.id] }); }}>{c.name}</button>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pré-análise da Pró-Reitoria de Extensão */}
                  <div className="ext-ai-panel" style={{marginTop:'1rem'}}>
                    <h5>🤝 Pré-análise da Pró-Reitoria de Extensão</h5>
                    <p style={{fontSize:'.82rem',color:'var(--text-secondary,#6b7280)',margin:'0 0 .75rem'}}>
                      Vinculação automática às dimensões e indicadores do Instrumento de Avaliação INEP/MEC.
                    </p>
                    {formData.axis_id && formData.ai_suggested_axis_id && formData.axis_id !== formData.ai_suggested_axis_id && (
                      <div className="ext-info" style={{marginBottom:'.75rem'}}>
                        ⚠️ <strong>Sugestão da IA:</strong> {formData.ai_axis_note || 'O eixo vinculado pode não ser o mais adequado ao escopo deste projeto.'} Eixo sugerido: <strong>{axisName(formData.ai_suggested_axis_id)}</strong>
                      </div>
                    )}
                    <div className="ext-ai-dim"><span className="dim-name">Dimensão 2 — Corpo Docente e Tutorial</span><span className={`dim-score ${team.filter(t=>t.project_id===formData.id).length>0?'high':'low'}`}>{team.filter(t=>t.project_id===formData.id).length>0?'Docentes vinculados':'Sem vínculo'}</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Dimensão 3 — Infraestrutura</span><span className="dim-score medium">Verificar</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Dimensão 5 — Políticas Acadêmicas (Extensão)</span><span className={`dim-score ${formData.course_ids?.length>0?'high':'low'}`}>{formData.course_ids?.length>0?'Cursos vinculados':'Sem cursos'}</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Indicador 5.3 — Atividades de extensão</span><span className={`dim-score ${formData.description?.length>50?'high':'medium'}`}>{formData.description?.length>50?'Descrito':'Insuficiente'}</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Indicador 5.4 — Integração com a comunidade</span><span className={`dim-score ${formData.target_community?'high':'low'}`}>{formData.target_community?'Comunidade identificada':'Sem identificação'}</span></div>
                    <p style={{fontSize:'.75rem',color:'var(--text-secondary,#999)',marginTop:'.5rem',fontStyle:'italic'}}>
                      A análise será refinada com base nas evidências e no relatório final. Itens sem comprovação ficam como "Sem vínculo".
                    </p>
                  </div>

                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveProject}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Cards de projetos */}
              {filteredProjects.length === 0 ? <p className="ext-empty">Nenhum projeto de extensão registrado.</p> : (
                <div className="ext-project-grid">
                  {filteredProjects.map(p => {
                    const pTeam = team.filter(t => t.project_id === p.id);
                    const pStudents = students.filter(s => s.project_id === p.id);
                    const pDel = deliverables.filter(d => d.project_id === p.id);
                    return (
                      <div key={p.id} className="ext-project-card" onClick={() => { if (canEdit) { setFormType('project'); setFormData({ ...p, partner_institutions_text: (p.partner_institutions || []).join(', '), ods_goals_text: (p.ods_goals || []).join(', ') }); setShowForm(true); } }}>
                        <div className="ext-card-top">
                          <span className="ext-card-type">{TYPE_LABELS[p.project_type] || p.project_type}</span>
                          <div style={{display:'flex',gap:'.35rem'}}><Badge status={p.status} /><Badge status={p.review_status} /></div>
                        </div>
                        <h4>{p.title}</h4>
                        {p.code && <span className="ext-card-code">{p.code}</span>}
                        {p.coordinator_name && <p className="ext-card-coord">👤 {p.coordinator_name}</p>}
                        {p.axis_id && <p className="ext-card-coord">📌 {axisName(p.axis_id)}</p>}
                        {p.target_community && <p className="ext-card-community">🏘 {p.target_community}</p>}
                        <div className="ext-card-meta">
                          <span>⏱ {p.total_hours || 0}h</span>
                          <span>👨‍🏫 {pTeam.length} equipe</span>
                          <span>🎓 {pStudents.length} alunos</span>
                          <span>📄 {pDel.length} entregas</span>
                          {p.semester && <span>📅 {p.semester}</span>}
                        </div>
                        {(p.course_ids || []).length > 0 && (
                          <div className="ext-card-courses">
                            {(p.course_ids || []).slice(0, 3).map(cid => <span key={cid} className="ext-course-tag">{courseName(cid)}</span>)}
                            {(p.course_ids || []).length > 3 && <span className="ext-course-tag">+{p.course_ids.length - 3}</span>}
                          </div>
                        )}
                        <div style={{display:'flex',gap:'.5rem',alignItems:'center',marginTop:'.5rem',flexWrap:'wrap'}}>
                          <span className="ext-ai-badge">🤝 Pré-análise Extensão</span>
                          {pDel.length > 0 && <span className="ext-ai-badge">📎 {pDel.length} evidência{pDel.length>1?'s':''}</span>}
                          {p.review_status === 'ajuste_solicitado' && <span className="ext-ai-badge" style={{color:'#ef4444',background:'rgba(239,68,68,.1)'}}>⚠ Ajuste solicitado</span>}
                        </div>
                        {canEdit && (
                          <div className="ext-card-actions" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setSelectedProject(p.id); setView('equipe'); }}>Equipe</button>
                            <button onClick={() => { setSelectedProject(p.id); setView('alunos'); }}>Alunos</button>
                            <button onClick={() => { setSelectedProject(p.id); setView('entregas'); }}>Entregas</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== EQUIPE (Professores/Coordenadores) ===== */}
          {view === 'equipe' && (
            <div className="ext-section">
              {selectedProject && <p className="ext-filter-label">Projeto: <strong>{projects.find(p => p.id === selectedProject)?.title}</strong> <button className="ext-clear" onClick={() => setSelectedProject(null)}>✕</button></p>}
              {canEdit && selectedProject && <button className="ext-btn-primary" style={{marginBottom:'1rem'}} onClick={() => { setFormType('team'); setFormData({ role_type: 'professor', is_active: true }); setShowForm(true); }}>+ Vincular professor/coordenador</button>}
              {showForm && formType === 'team' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Vincular'} Professor / Coordenador</h3>
                  <div className="ext-form-grid">
                    <label>Nome completo<input value={formData.full_name || ''} onChange={e => setFormData({ ...formData, full_name: e.target.value })} /></label>
                    <label>Função <select value={formData.role_type || 'professor'} onChange={e => setFormData({ ...formData, role_type: e.target.value })}>
                      <option value="coordenador">Coordenador</option><option value="professor">Professor</option><option value="tutor">Tutor</option><option value="supervisor">Supervisor</option>
                    </select></label>
                    <label>E-mail<input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></label>
                    <label>CPF<input value={formData.cpf || ''} onChange={e => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" /></label>
                    <label>Horas atribuídas<input type="number" value={formData.hours_assigned || ''} onChange={e => setFormData({ ...formData, hours_assigned: +e.target.value })} /></label>
                    <label>Lattes<input value={formData.lattes_url || ''} onChange={e => setFormData({ ...formData, lattes_url: e.target.value })} placeholder="http://lattes.cnpq.br/..." /></label>
                  </div>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveTeamMember}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {(selectedProject ? projTeam : team).length === 0 ? <p className="ext-empty">{selectedProject ? 'Nenhum membro vinculado.' : 'Selecione um projeto.'}</p> : (
                <table className="ext-table"><thead><tr><th>Nome</th><th>Função</th><th>E-mail</th><th>CPF</th><th>Horas</th><th>Ativo</th></tr></thead>
                <tbody>{(selectedProject ? projTeam : team).map(t => (
                  <tr key={t.id} className={canEdit?'clickable':''} onClick={() => { if(canEdit){setFormType('team');setFormData(t);setSelectedProject(t.project_id);setShowForm(true);} }}>
                    <td><strong>{t.full_name}</strong></td><td>{t.role_type}</td><td>{t.email||'—'}</td><td className="mono">{t.cpf||'—'}</td><td className="num">{t.hours_assigned||0}h</td><td>{t.is_active?'✅':'❌'}</td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
          )}

          {/* ===== ALUNOS ===== */}
          {view === 'alunos' && (
            <div className="ext-section">
              {selectedProject && <p className="ext-filter-label">Projeto: <strong>{projects.find(p => p.id === selectedProject)?.title}</strong> <button className="ext-clear" onClick={() => setSelectedProject(null)}>✕</button></p>}
              {canEdit && selectedProject && <button className="ext-btn-primary" style={{marginBottom:'1rem'}} onClick={() => { setFormType('student'); setFormData({ status: 'ativo' }); setShowForm(true); }}>+ Vincular aluno</button>}
              {showForm && formType === 'student' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Vincular'} Aluno</h3>
                  <div className="ext-form-grid">
                    <label>Nome completo<input value={formData.full_name || ''} onChange={e => setFormData({ ...formData, full_name: e.target.value })} /></label>
                    <label>E-mail<input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></label>
                    <label>Telefone / WhatsApp<input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(63) 99999-0000" /></label>
                    <label>Matrícula<input value={formData.registration_number || ''} onChange={e => setFormData({ ...formData, registration_number: e.target.value })} /></label>
                    <label>CPF<input value={formData.cpf || ''} onChange={e => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" /></label>
                    <label>Curso <select value={formData.course_id || ''} onChange={e => setFormData({ ...formData, course_id: e.target.value || null })}>
                      <option value="">— Selecionar —</option>
                      {courses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></label>
                    <label>Horas atribuídas<input type="number" value={formData.hours_assigned || ''} onChange={e => setFormData({ ...formData, hours_assigned: +e.target.value })} /></label>
                    <label>Horas cumpridas<input type="number" value={formData.hours_completed || ''} onChange={e => setFormData({ ...formData, hours_completed: +e.target.value })} /></label>
                    <label>Bolsista? <select value={formData.is_scholarship?'sim':'nao'} onChange={e => setFormData({ ...formData, is_scholarship: e.target.value==='sim' })}>
                      <option value="nao">Não</option><option value="sim">Sim</option>
                    </select></label>
                  </div>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveStudent}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {(selectedProject ? projStudents : students).length === 0 ? <p className="ext-empty">{selectedProject ? 'Nenhum aluno vinculado.' : 'Selecione um projeto.'}</p> : (
                <table className="ext-table"><thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Matrícula</th><th>CPF</th><th>Horas</th><th>Bolsista</th><th>Status</th></tr></thead>
                <tbody>{(selectedProject ? projStudents : students).map(s => (
                  <tr key={s.id} className={canEdit?'clickable':''} onClick={() => { if(canEdit){setFormType('student');setFormData(s);setSelectedProject(s.project_id);setShowForm(true);} }}>
                    <td><strong>{s.full_name}</strong></td><td>{s.email||'—'}</td><td>{s.phone||'—'}</td><td className="mono">{s.registration_number||'—'}</td><td className="mono">{s.cpf||'—'}</td><td className="num">{s.hours_completed||0}/{s.hours_assigned||0}h</td><td>{s.is_scholarship?'✅':'—'}</td><td><Badge status={s.status}/></td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
          )}

          {/* ===== ENTREGAS ===== */}
          {view === 'entregas' && (
            <div className="ext-section">
              {selectedProject && <p className="ext-filter-label">Projeto: <strong>{projects.find(p => p.id === selectedProject)?.title}</strong> <button className="ext-clear" onClick={() => setSelectedProject(null)}>✕</button></p>}
              {canEdit && selectedProject && <button className="ext-btn-primary" style={{marginBottom:'1rem'}} onClick={() => { setFormType('deliverable'); setFormData({ deliverable_type: 'relatorio_final' }); setShowForm(true); }}>+ Nova entrega</button>}
              {showForm && formType === 'deliverable' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Nova'} Entrega</h3>
                  <div className="ext-form-grid">
                    <label>Título<input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></label>
                    <label>Tipo <select value={formData.deliverable_type || 'relatorio_final'} onChange={e => setFormData({ ...formData, deliverable_type: e.target.value })}>
                      {Object.entries(DELIV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select></label>
                    <label>Data de entrega<input type="date" value={formData.delivered_at || ''} onChange={e => setFormData({ ...formData, delivered_at: e.target.value })} /></label>
                    <label>URL do documento<input value={formData.url || ''} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="Link do arquivo ou repositório" /></label>
                  </div>
                  <label className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></label>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveDeliverable}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {(selectedProject ? projDeliverables : deliverables).length === 0 ? <p className="ext-empty">{selectedProject ? 'Nenhuma entrega registrada.' : 'Selecione um projeto.'}</p> : (
                <table className="ext-table"><thead><tr><th>Título</th><th>Tipo</th><th>Data</th><th>Projeto</th></tr></thead>
                <tbody>{(selectedProject ? projDeliverables : deliverables).map(d => (
                  <tr key={d.id} className={canEdit?'clickable':''} onClick={() => { if(canEdit){setFormType('deliverable');setFormData(d);setSelectedProject(d.project_id);setShowForm(true);} }}>
                    <td><strong>{d.title}</strong></td><td>{DELIV_LABELS[d.deliverable_type]||d.deliverable_type}</td><td>{fmtDate(d.delivered_at)}</td><td>{projects.find(p=>p.id===d.project_id)?.title||'—'}</td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
          )}

          {/* ===== COBERTURA POR CURSO ===== */}
          {view === 'cobertura' && (
            <div className="ext-section">
              <div className="ext-info">📊 Cobertura extensionista por curso. DCNs exigem pelo menos 10% da carga horária total em atividades de extensão.</div>
              <table className="ext-table"><thead><tr><th>Curso</th><th>Projetos</th><th>Alunos</th><th>Horas discentes</th></tr></thead>
              <tbody>
                {courses?.map(c => {
                  const cov = coverage.filter(cv => cv.course_id === c.id);
                  const tp = cov.reduce((s, cv) => s + cv.total_projects, 0);
                  const ts = cov.reduce((s, cv) => s + cv.total_students, 0);
                  const th = cov.reduce((s, cv) => s + cv.total_student_hours, 0);
                  return <tr key={c.id}><td><strong>{c.name}</strong></td><td className="num">{tp}</td><td className="num">{ts}</td><td className="num">{th}h</td></tr>;
                })}
              </tbody></table>
            </div>
          )}

          {/* ===== REVISÕES / FLUXO DE APROVAÇÃO ===== */}
          {view === 'revisoes' && (
            <div className="ext-section">
              <div className="ext-info">
                🔄 <strong>Fluxo de governança:</strong> Projeto concluído → Acompanhamento da Extensão analisa → Aprovado → Regulação valida → BI institucional.
                O setor de Acompanhamento pode solicitar ajustes antes de encaminhar à Regulação.
              </div>

              {/* Projetos pendentes de revisão */}
              {projects.filter(p => p.review_status === 'pendente' || p.review_status === 'ajuste_solicitado').length === 0 ? (
                <p className="ext-empty">Nenhum projeto pendente de revisão.</p>
              ) : (
                projects.filter(p => p.review_status === 'pendente' || p.review_status === 'ajuste_solicitado').map(p => (
                  <div key={p.id} className="ext-project-card" style={{cursor:'default',marginBottom:'1rem'}}>
                    <div className="ext-card-top">
                      <span className="ext-card-type">{p.code}</span>
                      <div style={{display:'flex',gap:'.35rem'}}><Badge status={p.status} /><Badge status={p.review_status} /></div>
                    </div>
                    <h4>{p.title}</h4>
                    {p.coordinator_name && <p className="ext-card-coord">👤 {p.coordinator_name}</p>}
                    <div className="ext-card-meta">
                      <span>🎓 {students.filter(s=>s.project_id===p.id).length} alunos</span>
                      <span>👨‍🏫 {team.filter(t=>t.project_id===p.id).length} equipe</span>
                      <span>📄 {deliverables.filter(d=>d.project_id===p.id).length} entregas</span>
                    </div>

                    {/* Histórico de revisões deste projeto */}
                    {reviews.filter(r => r.project_id === p.id).length > 0 && (
                      <div style={{marginTop:'.75rem',fontSize:'.82rem'}}>
                        <strong>Histórico:</strong>
                        {reviews.filter(r => r.project_id === p.id).map(r => (
                          <div key={r.id} style={{padding:'.35rem 0',borderBottom:'1px solid var(--border,#e5e7eb)'}}>
                            <span>{REVIEW_LABELS[r.review_stage]||r.review_stage}</span> · <Badge status={r.status} /> · {fmtDate(r.reviewed_at)}
                            {r.comment && <p style={{margin:'.25rem 0 0',color:'var(--text-secondary,#6b7280)'}}>{r.comment}</p>}
                            {r.adjustment_request && <p style={{margin:'.25rem 0 0',color:'#ef4444'}}>⚠ Ajuste: {r.adjustment_request}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ações de revisão */}
                    {canEdit && (
                      <div style={{display:'flex',gap:'.5rem',marginTop:'1rem',flexWrap:'wrap'}}>
                        <button className="ext-btn-primary" onClick={() => {
                          const stage = p.review_status === 'pendente' ? 'acompanhamento' : 'regulacao';
                          submitReview(p.id, stage, 'aprovado', 'Projeto aprovado pelo ' + REVIEW_LABELS[stage]);
                        }}>✅ Aprovar</button>
                        <button className="ext-btn-secondary" onClick={() => {
                          const adj = prompt('Descreva o ajuste necessário:');
                          if (adj) {
                            const stage = p.review_status === 'pendente' ? 'acompanhamento' : 'regulacao';
                            submitReview(p.id, stage, 'ajuste_solicitado', 'Ajuste solicitado', adj);
                          }
                        }}>⚠ Solicitar ajuste</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
