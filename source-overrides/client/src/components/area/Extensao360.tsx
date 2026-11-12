// Extensao360.tsx — Repositório de Projetos de Extensão
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./extensao360.css";

type View = 'projetos' | 'participantes' | 'entregas' | 'cobertura';

interface ExtProject {
  id: string; title: string; code: string; project_type: string; description: string;
  target_community: string; target_audience_count: number; coordinator_name: string;
  status: string; start_date: string; end_date: string; total_hours: number;
  semester: string; course_ids: string[]; partner_institutions: string[];
  ods_goals: string[]; budget_estimated: number; budget_executed: number;
  axis_id: string; created_at: string;
}
interface Participant {
  id: string; project_id: string; participant_type: string; name: string;
  registration_number: string; hours_assigned: number; hours_completed: number;
  role_in_project: string; is_scholarship: boolean; status: string;
}
interface Deliverable {
  id: string; project_id: string; title: string; deliverable_type: string;
  description: string; delivered_at: string; url: string;
}
interface Axis { id: string; name: string; description: string; ods_alignment: string[]; }
interface Coverage { course_id: string; semester: string; total_projects: number; total_students: number; total_student_hours: number; }

const STATUS_COLORS: Record<string, string> = {
  planejamento: '#6b7280', em_aprovacao: '#f59e0b', aprovado: '#3b82f6',
  em_execucao: '#8b5cf6', concluido: '#22c55e', cancelado: '#ef4444', suspenso: '#9ca3af',
  ativo: '#22c55e', desligado: '#ef4444', trancado: '#6b7280',
};
const STATUS_LABELS: Record<string, string> = {
  planejamento: 'Planejamento', em_aprovacao: 'Em Aprovação', aprovado: 'Aprovado',
  em_execucao: 'Em Execução', concluido: 'Concluído', cancelado: 'Cancelado', suspenso: 'Suspenso',
  ativo: 'Ativo', desligado: 'Desligado', trancado: 'Trancado',
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

function Badge({ status }: { status: string }) {
  return <span className="ext-badge" style={{ background: (STATUS_COLORS[status] || '#888') + '18', color: STATUS_COLORS[status] || '#888' }}>
    {STATUS_LABELS[status] || status}
  </span>;
}
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }
function fmtBRL(v: number | null) { return v == null ? '—' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }

export default function Extensao360({ institutionId, role, courses, onBack }: {
  institutionId: string; role: string;
  courses?: { id: string; name: string }[];
  onBack?: () => void;
}) {
  const [view, setView] = useState<View>('projetos');
  const [projects, setProjects] = useState<ExtProject[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [axes, setAxes] = useState<Axis[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [formType, setFormType] = useState<'project' | 'participant' | 'deliverable' | 'axis'>('project');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  const load = useCallback(async () => {
    setLoading(true);
    const [p, par, del, ax, cov] = await Promise.all([
      supabase.from('vertice_extension_projects').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('vertice_extension_participants').select('*').eq('institution_id', institutionId).order('name'),
      supabase.from('vertice_extension_deliverables').select('*').eq('institution_id', institutionId).order('delivered_at', { ascending: false }),
      supabase.from('vertice_extension_axes').select('*').eq('institution_id', institutionId).order('name'),
      supabase.from('v_extension_coverage').select('*').eq('institution_id', institutionId),
    ]);
    setProjects((p.data || []) as ExtProject[]);
    setParticipants((par.data || []) as Participant[]);
    setDeliverables((del.data || []) as Deliverable[]);
    setAxes((ax.data || []) as Axis[]);
    setCoverage((cov.data || []) as Coverage[]);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const canEdit = role === 'master' || role === 'gestor';

  // KPIs
  const emExecucao = projects.filter(p => p.status === 'em_execucao').length;
  const concluidos = projects.filter(p => p.status === 'concluido').length;
  const totalDiscentes = participants.filter(p => p.participant_type === 'discente').length;
  const totalDocentes = participants.filter(p => p.participant_type === 'docente').length;
  const totalComunidade = participants.filter(p => p.participant_type === 'comunidade').length;
  const horasDiscentes = participants.filter(p => p.participant_type === 'discente').reduce((s, p) => s + (p.hours_completed || 0), 0);
  const cursosComExtensao = new Set(projects.flatMap(p => p.course_ids || [])).size;
  const totalCursos = courses?.length || 0;
  const pctCobertura = totalCursos > 0 ? Math.round((cursosComExtensao / totalCursos) * 100) : 0;

  const filteredProjects = filterStatus === 'todos' ? projects : projects.filter(p => p.status === filterStatus);

  function courseName(id: string) {
    return courses?.find(c => c.id === id)?.name || id.slice(0, 8);
  }

  async function saveProject() {
    const payload = {
      ...formData,
      institution_id: institutionId,
      code: formData.code || ('EXT-' + new Date().getFullYear() + '-' + String(projects.length + 1).padStart(3, '0')),
      course_ids: formData.course_ids || [],
      partner_institutions: formData.partner_institutions_text ? formData.partner_institutions_text.split(',').map((s: string) => s.trim()) : (formData.partner_institutions || []),
      ods_goals: formData.ods_goals_text ? formData.ods_goals_text.split(',').map((s: string) => s.trim()) : (formData.ods_goals || []),
    };
    delete payload.partner_institutions_text;
    delete payload.ods_goals_text;
    if (payload.id) {
      payload.updated_at = new Date().toISOString();
      await supabase.from('vertice_extension_projects').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      await supabase.from('vertice_extension_projects').insert(payload);
    }
    setShowForm(false); setFormData({}); load();
  }

  async function saveParticipant() {
    const payload = { ...formData, institution_id: institutionId, project_id: selectedProject };
    if (payload.id) {
      await supabase.from('vertice_extension_participants').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      await supabase.from('vertice_extension_participants').insert(payload);
    }
    setShowForm(false); setFormData({}); load();
  }

  async function saveDeliverable() {
    const payload = { ...formData, institution_id: institutionId, project_id: selectedProject };
    if (payload.id) {
      await supabase.from('vertice_extension_deliverables').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      await supabase.from('vertice_extension_deliverables').insert(payload);
    }
    setShowForm(false); setFormData({}); load();
  }

  async function saveAxis() {
    const payload = {
      ...formData,
      institution_id: institutionId,
      ods_alignment: formData.ods_text ? formData.ods_text.split(',').map((s: string) => s.trim()) : (formData.ods_alignment || []),
    };
    delete payload.ods_text;
    if (payload.id) {
      await supabase.from('vertice_extension_axes').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      await supabase.from('vertice_extension_axes').insert(payload);
    }
    setShowForm(false); setFormData({}); load();
  }

  const projectParticipants = selectedProject ? participants.filter(p => p.project_id === selectedProject) : [];
  const projectDeliverables = selectedProject ? deliverables.filter(d => d.project_id === selectedProject) : [];

  return (
    <div className="ext-container">
      {onBack && <button type="button" className="ext-back" onClick={onBack}>← Voltar aos módulos</button>}
      <div className="ext-header">
        <div>
          <h2>Extensão 360°</h2>
          <p>Repositório de projetos de extensão · DCNs: mínimo 10% da carga horária</p>
        </div>
        {canEdit && view === 'projetos' && (
          <div className="ext-header-actions">
            <button className="ext-btn-secondary" onClick={() => { setFormType('axis'); setFormData({}); setShowForm(true); }}>+ Eixo temático</button>
            <button className="ext-btn-primary" onClick={() => { setFormType('project'); setFormData({ status: 'planejamento', project_type: 'projeto', course_ids: [] }); setShowForm(true); }}>+ Novo projeto</button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="ext-kpis">
        <div className="ext-kpi"><strong>{projects.length}</strong><span>Projetos registrados</span></div>
        <div className="ext-kpi info"><strong>{emExecucao}</strong><span>Em execução</span></div>
        <div className="ext-kpi success"><strong>{concluidos}</strong><span>Concluídos</span></div>
        <div className="ext-kpi"><strong>{totalDiscentes}</strong><span>Discentes envolvidos</span></div>
        <div className="ext-kpi"><strong>{totalDocentes}</strong><span>Docentes</span></div>
        <div className="ext-kpi"><strong>{totalComunidade}</strong><span>Comunidade</span></div>
        <div className="ext-kpi"><strong>{horasDiscentes}h</strong><span>Horas discentes cumpridas</span></div>
        <div className="ext-kpi" style={{ borderLeft: `3px solid ${pctCobertura >= 80 ? '#22c55e' : pctCobertura >= 50 ? '#f59e0b' : '#ef4444'}` }}>
          <strong>{cursosComExtensao}/{totalCursos}</strong>
          <span>Cursos com extensão ({pctCobertura}%)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="ext-tabs">
        {(['projetos', 'participantes', 'entregas', 'cobertura'] as View[]).map(v => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => { setView(v); setShowForm(false); setSelectedProject(null); }}>
            {v === 'projetos' ? `Projetos (${projects.length})` :
             v === 'participantes' ? `Participantes (${participants.length})` :
             v === 'entregas' ? `Entregas (${deliverables.length})` :
             'Cobertura por Curso'}
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
                  {Object.entries(STATUS_LABELS).filter(([k]) => !['ativo','desligado','trancado'].includes(k)).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {axes.length > 0 && <span className="ext-axes-count">{axes.length} eixo(s) temático(s) cadastrado(s)</span>}
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
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveAxis}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Form: Projeto */}
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
                        <option value="">— Sem eixo —</option>
                        {axes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                    <label>Coordenador<input value={formData.coordinator_name || ''} onChange={e => setFormData({ ...formData, coordinator_name: e.target.value })} /></label>
                    <label>E-mail coordenador<input value={formData.coordinator_email || ''} onChange={e => setFormData({ ...formData, coordinator_email: e.target.value })} /></label>
                    <label>Comunidade atendida<input value={formData.target_community || ''} onChange={e => setFormData({ ...formData, target_community: e.target.value })} placeholder="Ex: moradores do Jardim Aureny" /></label>
                    <label>Público estimado<input type="number" value={formData.target_audience_count || ''} onChange={e => setFormData({ ...formData, target_audience_count: +e.target.value })} /></label>
                    <label>Semestre<input value={formData.semester || ''} onChange={e => setFormData({ ...formData, semester: e.target.value })} placeholder="2026/01" /></label>
                    <label>Carga horária total<input type="number" value={formData.total_hours || ''} onChange={e => setFormData({ ...formData, total_hours: +e.target.value })} /></label>
                    <label>Início<input type="date" value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></label>
                    <label>Término<input type="date" value={formData.end_date || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} /></label>
                    <label>Status
                      <select value={formData.status || 'planejamento'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                        {Object.entries(STATUS_LABELS).filter(([k]) => !['ativo','desligado','trancado'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label>Orçamento estimado<input type="number" step="0.01" value={formData.budget_estimated || ''} onChange={e => setFormData({ ...formData, budget_estimated: +e.target.value })} /></label>
                    <label>Parceiros<input value={formData.partner_institutions_text ?? (formData.partner_institutions || []).join(', ')} onChange={e => setFormData({ ...formData, partner_institutions_text: e.target.value })} placeholder="OAB, Defensoria, CRAS" /></label>
                    <label>ODS<input value={formData.ods_goals_text ?? (formData.ods_goals || []).join(', ')} onChange={e => setFormData({ ...formData, ods_goals_text: e.target.value })} placeholder="ODS4, ODS16" /></label>
                  </div>
                  <label className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></label>

                  {/* Seletor de cursos */}
                  {courses && courses.length > 0 && (
                    <div className="ext-course-picker">
                      <strong>Cursos vinculados:</strong>
                      <div className="ext-course-chips">
                        {courses.map(c => {
                          const selected = (formData.course_ids || []).includes(c.id);
                          return <button key={c.id} type="button" className={`ext-chip ${selected ? 'selected' : ''}`}
                            onClick={() => {
                              const ids = formData.course_ids || [];
                              setFormData({ ...formData, course_ids: selected ? ids.filter((i: string) => i !== c.id) : [...ids, c.id] });
                            }}>{c.name}</button>;
                        })}
                      </div>
                    </div>
                  )}

                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveProject}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {filteredProjects.length === 0 ? <p className="ext-empty">Nenhum projeto de extensão registrado.</p> : (
                <div className="ext-project-grid">
                  {filteredProjects.map(p => {
                    const pParts = participants.filter(pp => pp.project_id === p.id);
                    const pDel = deliverables.filter(d => d.project_id === p.id);
                    return (
                      <div key={p.id} className="ext-project-card" onClick={() => { if (canEdit) { setFormType('project'); setFormData({ ...p, partner_institutions_text: (p.partner_institutions || []).join(', '), ods_goals_text: (p.ods_goals || []).join(', ') }); setShowForm(true); } }}>
                        <div className="ext-card-top">
                          <span className="ext-card-type">{TYPE_LABELS[p.project_type] || p.project_type}</span>
                          <Badge status={p.status} />
                        </div>
                        <h4>{p.title}</h4>
                        {p.code && <span className="ext-card-code">{p.code}</span>}
                        {p.coordinator_name && <p className="ext-card-coord">👤 {p.coordinator_name}</p>}
                        {p.target_community && <p className="ext-card-community">🏘 {p.target_community}</p>}
                        <div className="ext-card-meta">
                          <span>⏱ {p.total_hours || 0}h</span>
                          <span>👥 {pParts.length} participantes</span>
                          <span>📄 {pDel.length} entregas</span>
                          {p.semester && <span>📅 {p.semester}</span>}
                        </div>
                        {(p.course_ids || []).length > 0 && (
                          <div className="ext-card-courses">
                            {(p.course_ids || []).slice(0, 3).map(cid => <span key={cid} className="ext-course-tag">{courseName(cid)}</span>)}
                            {(p.course_ids || []).length > 3 && <span className="ext-course-tag">+{p.course_ids.length - 3}</span>}
                          </div>
                        )}
                        {canEdit && (
                          <div className="ext-card-actions" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setSelectedProject(p.id); setView('participantes'); }}>Participantes</button>
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

          {/* ===== PARTICIPANTES ===== */}
          {view === 'participantes' && (
            <div className="ext-section">
              {selectedProject && <p className="ext-filter-label">Filtrando por projeto: <strong>{projects.find(p => p.id === selectedProject)?.title}</strong> <button className="ext-clear" onClick={() => setSelectedProject(null)}>✕ Limpar filtro</button></p>}
              {canEdit && selectedProject && <button className="ext-btn-primary" onClick={() => { setFormType('participant'); setFormData({ participant_type: 'discente', status: 'ativo' }); setShowForm(true); }}>+ Novo participante</button>}

              {showForm && formType === 'participant' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Novo'} Participante</h3>
                  <div className="ext-form-grid">
                    <label>Nome<input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></label>
                    <label>Tipo
                      <select value={formData.participant_type || 'discente'} onChange={e => setFormData({ ...formData, participant_type: e.target.value })}>
                        <option value="discente">Discente</option>
                        <option value="docente">Docente</option>
                        <option value="tecnico">Técnico</option>
                        <option value="comunidade">Comunidade</option>
                        <option value="externo">Externo</option>
                      </select>
                    </label>
                    <label>Matrícula/SIAPE<input value={formData.registration_number || ''} onChange={e => setFormData({ ...formData, registration_number: e.target.value })} /></label>
                    <label>Função no projeto<input value={formData.role_in_project || ''} onChange={e => setFormData({ ...formData, role_in_project: e.target.value })} placeholder="Coordenador, bolsista, voluntário" /></label>
                    <label>Horas atribuídas<input type="number" value={formData.hours_assigned || ''} onChange={e => setFormData({ ...formData, hours_assigned: +e.target.value })} /></label>
                    <label>Horas cumpridas<input type="number" value={formData.hours_completed || ''} onChange={e => setFormData({ ...formData, hours_completed: +e.target.value })} /></label>
                    <label>Bolsista? <select value={formData.is_scholarship ? 'sim' : 'nao'} onChange={e => setFormData({ ...formData, is_scholarship: e.target.value === 'sim' })}>
                      <option value="nao">Não</option><option value="sim">Sim</option>
                    </select></label>
                  </div>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveParticipant}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {(selectedProject ? projectParticipants : participants).length === 0 ? (
                <p className="ext-empty">{selectedProject ? 'Nenhum participante neste projeto.' : 'Selecione um projeto para ver participantes.'}</p>
              ) : (
                <table className="ext-table">
                  <thead><tr><th>Nome</th><th>Tipo</th><th>Matrícula</th><th>Função</th><th>Horas</th><th>Bolsista</th><th>Status</th></tr></thead>
                  <tbody>
                    {(selectedProject ? projectParticipants : participants).map(p => (
                      <tr key={p.id} className={canEdit ? 'clickable' : ''} onClick={() => { if (canEdit) { setFormType('participant'); setFormData(p); setSelectedProject(p.project_id); setShowForm(true); } }}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.participant_type}</td>
                        <td className="mono">{p.registration_number || '—'}</td>
                        <td>{p.role_in_project || '—'}</td>
                        <td className="num">{p.hours_completed || 0}/{p.hours_assigned || 0}h</td>
                        <td>{p.is_scholarship ? '✅' : '—'}</td>
                        <td><Badge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ===== ENTREGAS ===== */}
          {view === 'entregas' && (
            <div className="ext-section">
              {selectedProject && <p className="ext-filter-label">Filtrando por projeto: <strong>{projects.find(p => p.id === selectedProject)?.title}</strong> <button className="ext-clear" onClick={() => setSelectedProject(null)}>✕ Limpar filtro</button></p>}
              {canEdit && selectedProject && <button className="ext-btn-primary" onClick={() => { setFormType('deliverable'); setFormData({ deliverable_type: 'relatorio_final' }); setShowForm(true); }}>+ Nova entrega</button>}

              {showForm && formType === 'deliverable' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Nova'} Entrega</h3>
                  <div className="ext-form-grid">
                    <label>Título<input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></label>
                    <label>Tipo
                      <select value={formData.deliverable_type || 'relatorio_final'} onChange={e => setFormData({ ...formData, deliverable_type: e.target.value })}>
                        {Object.entries(DELIV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label>Data de entrega<input type="date" value={formData.delivered_at || ''} onChange={e => setFormData({ ...formData, delivered_at: e.target.value })} /></label>
                    <label>URL externa<input value={formData.url || ''} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="DOI, repositório, etc." /></label>
                  </div>
                  <label className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></label>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveDeliverable}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {(selectedProject ? projectDeliverables : deliverables).length === 0 ? (
                <p className="ext-empty">{selectedProject ? 'Nenhuma entrega neste projeto.' : 'Selecione um projeto para ver entregas.'}</p>
              ) : (
                <table className="ext-table">
                  <thead><tr><th>Título</th><th>Tipo</th><th>Descrição</th><th>Data</th><th>Link</th></tr></thead>
                  <tbody>
                    {(selectedProject ? projectDeliverables : deliverables).map(d => (
                      <tr key={d.id} className={canEdit ? 'clickable' : ''} onClick={() => { if (canEdit) { setFormType('deliverable'); setFormData(d); setSelectedProject(d.project_id); setShowForm(true); } }}>
                        <td><strong>{d.title}</strong></td>
                        <td>{DELIV_LABELS[d.deliverable_type] || d.deliverable_type}</td>
                        <td>{d.description || '—'}</td>
                        <td>{fmtDate(d.delivered_at)}</td>
                        <td>{d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer">↗</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ===== COBERTURA POR CURSO ===== */}
          {view === 'cobertura' && (
            <div className="ext-section">
              <p className="ext-info">Percentual extensionista exigido pelas DCNs: <strong>mínimo 10% da carga horária total do curso</strong></p>
              {coverage.length === 0 ? <p className="ext-empty">Nenhum dado de cobertura disponível. Vincule projetos a cursos para calcular.</p> : (
                <table className="ext-table">
                  <thead><tr><th>Curso</th><th>Semestre</th><th>Projetos</th><th>Discentes</th><th>Horas discente</th></tr></thead>
                  <tbody>
                    {coverage.map((c, i) => (
                      <tr key={i}>
                        <td><strong>{courseName(c.course_id)}</strong></td>
                        <td>{c.semester || '—'}</td>
                        <td className="num">{c.total_projects}</td>
                        <td className="num">{c.total_students}</td>
                        <td className="num">{c.total_student_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
