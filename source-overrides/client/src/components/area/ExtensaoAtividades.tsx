/**
 * ExtensaoAtividades — Gestão de atividades de extensão
 * CRUD de atividades vinculadas a projetos, com participação e presença
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Activity {
  id: string; project_id: string; title: string; description: string;
  activity_type: string; scheduled_date: string; duration_minutes: number;
  location: string; responsible_id: string; max_participants: number;
  status: string; learning_goals: string[]; competencies: string[];
  created_at: string;
}

interface Participation {
  id: string; activity_id: string; student_id: string;
  present: boolean; hours_credited: number; performance_notes: string;
  self_reflection: string; grade: number | null; feedback: string;
}

const TYPE_LABELS: Record<string, string> = {
  pratica: '🔧 Prática', teorica: '📖 Teórica', campo: '🌍 Campo',
  oficina: '🎨 Oficina', evento: '📅 Evento', orientacao: '🎯 Orientação',
  avaliacao: '📝 Avaliação', reflexao: '💭 Reflexão',
};

const STATUS_LABELS: Record<string, string> = {
  planejada: '📋 Planejada', confirmada: '✅ Confirmada',
  em_andamento: '▶️ Em Andamento', concluida: '🏁 Concluída', cancelada: '❌ Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  planejada: '#6b7280', confirmada: '#3b82f6',
  em_andamento: '#8b5cf6', concluida: '#22c55e', cancelada: '#ef4444',
};

export default function ExtensaoAtividades({
  institutionId, projectId, projectTitle, canEdit, onClose,
}: {
  institutionId: string;
  projectId: string;
  projectTitle: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [participation, setParticipation] = useState<Record<string, Participation[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '', description: '', activity_type: 'pratica',
    scheduled_date: new Date().toISOString().slice(0, 10),
    duration_minutes: 120, location: '', status: 'planejada',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vertice_extension_activities')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('project_id', projectId)
      .order('scheduled_date', { ascending: false });
    setActivities(data || []);
    setLoading(false);
  }, [institutionId, projectId]);

  useEffect(() => { load(); }, [load]);

  const loadParticipation = async (activityId: string) => {
    const { data } = await supabase
      .from('vertice_extension_activity_participation')
      .select('*')
      .eq('activity_id', activityId);
    setParticipation(prev => ({ ...prev, [activityId]: data || [] }));
    setSelectedActivity(activityId);
  };

  const saveActivity = async () => {
    if (!formData.title.trim()) return alert('Título obrigatório.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('vertice_extension_activities').insert({
      institution_id: institutionId,
      project_id: projectId,
      ...formData,
      responsible_id: user.id,
    });
    if (error) return alert('Erro: ' + error.message);
    setShowForm(false);
    setFormData({ title: '', description: '', activity_type: 'pratica', scheduled_date: new Date().toISOString().slice(0, 10), duration_minutes: 120, location: '', status: 'planejada' });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('vertice_extension_activities')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else load();
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtDuration = (m: number) => `${Math.floor(m / 60)}h${m % 60 > 0 ? m % 60 + 'min' : ''}`;

  // KPIs
  const total = activities.length;
  const concluidas = activities.filter(a => a.status === 'concluida').length;
  const horasTotal = activities.reduce((s, a) => s + (a.duration_minutes || 0), 0);

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📅 Atividades — {projectTitle}</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{total}</span>
          <span className="ext-stat-label">Total</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#22c55e' }}>{concluidas}</span>
          <span className="ext-stat-label">Concluídas</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{fmtDuration(horasTotal)}</span>
          <span className="ext-stat-label">Horas planejadas</span>
        </div>
      </div>

      {canEdit && (
        <button className="ext-btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowForm(true)}>
          + Nova atividade
        </button>
      )}

      {/* Form */}
      {showForm && (
        <div className="ext-form">
          <h3>Nova atividade</h3>
          <div className="ext-form-grid">
            <label>Título
              <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </label>
            <label>Tipo
              <select value={formData.activity_type} onChange={e => setFormData({ ...formData, activity_type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Data
              <input type="date" value={formData.scheduled_date} onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })} />
            </label>
            <label>Duração (min)
              <input type="number" min={15} step={15} value={formData.duration_minutes} onChange={e => setFormData({ ...formData, duration_minutes: +e.target.value })} />
            </label>
            <label>Local
              <input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Sala, endereço ou online" />
            </label>
          </div>
          <label className="ext-form-full">Descrição
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
          </label>
          <div className="ext-form-actions">
            <button className="ext-btn-save" onClick={saveActivity}>Salvar</button>
            <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <p>Carregando...</p> : activities.length === 0 ? (
        <p className="ext-empty">Nenhuma atividade registrada.</p>
      ) : (
        <table className="ext-table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Título</th><th>Duração</th><th>Local</th><th>Status</th>{canEdit && <th>Ações</th>}</tr>
          </thead>
          <tbody>
            {activities.map(a => (
              <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => loadParticipation(a.id)}>
                <td>{fmtDate(a.scheduled_date)}</td>
                <td>{TYPE_LABELS[a.activity_type] || a.activity_type}</td>
                <td><strong>{a.title}</strong></td>
                <td className="num">{fmtDuration(a.duration_minutes)}</td>
                <td>{a.location || '—'}</td>
                <td><span style={{ color: STATUS_COLORS[a.status] }}>{STATUS_LABELS[a.status] || a.status}</span></td>
                {canEdit && (
                  <td onClick={e => e.stopPropagation()}>
                    {a.status === 'planejada' && <button className="ext-btn-small" onClick={() => updateStatus(a.id, 'confirmada')}>Confirmar</button>}
                    {a.status === 'confirmada' && <button className="ext-btn-small" onClick={() => updateStatus(a.id, 'em_andamento')}>Iniciar</button>}
                    {a.status === 'em_andamento' && <button className="ext-btn-small" onClick={() => updateStatus(a.id, 'concluida')}>Concluir</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Participation detail */}
      {selectedActivity && participation[selectedActivity] && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary, #f9fafb)', borderRadius: '8px' }}>
          <h4>Participantes — {activities.find(a => a.id === selectedActivity)?.title}</h4>
          {participation[selectedActivity].length === 0 ? (
            <p className="ext-empty">Nenhum participante registrado.</p>
          ) : (
            <table className="ext-table">
              <thead><tr><th>Estudante</th><th>Presente</th><th>Horas</th><th>Nota</th><th>Feedback</th></tr></thead>
              <tbody>
                {participation[selectedActivity].map(p => (
                  <tr key={p.id}>
                    <td>{p.student_id.slice(0, 8)}…</td>
                    <td>{p.present ? '✅' : '❌'}</td>
                    <td className="num">{p.hours_credited}min</td>
                    <td className="num">{p.grade ?? '—'}</td>
                    <td>{p.feedback || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="ext-btn-cancel" style={{ marginTop: '.5rem' }} onClick={() => setSelectedActivity(null)}>Fechar participantes</button>
        </div>
      )}
    </div>
  );
}
