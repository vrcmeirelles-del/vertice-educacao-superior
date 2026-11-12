/**
 * ExtensaoHourLedger — Livro-razão de horas de extensão
 * Interface para lançamentos append-only com aprovação
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface HourEntry {
  id: string;
  project_id: string;
  participant_id: string;
  entry_type: 'credit' | 'correction' | 'reversal';
  minutes: number;
  description: string;
  activity_date: string;
  reference_entry_id: string | null;
  recorded_by: string;
  recorded_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

interface ParticipantHours {
  participant_id: string;
  project_id: string;
  approved_minutes: number;
  approved_hours: number;
  pending_minutes: number;
  total_entries: number;
  last_activity_date: string;
}

const TYPE_LABELS: Record<string, string> = {
  credit: '➕ Crédito',
  correction: '🔄 Correção',
  reversal: '↩️ Estorno',
};

const TYPE_COLORS: Record<string, string> = {
  credit: '#22c55e',
  correction: '#f59e0b',
  reversal: '#ef4444',
};

export default function ExtensaoHourLedger({
  institutionId, projectId, participantId, participantName, canEdit, onClose,
}: {
  institutionId: string;
  projectId: string;
  participantId: string;
  participantName: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [summary, setSummary] = useState<ParticipantHours | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    entry_type: 'credit' as HourEntry['entry_type'],
    minutes: 60,
    description: '',
    activity_date: new Date().toISOString().slice(0, 10),
    reference_entry_id: null as string | null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [entriesRes, summaryRes] = await Promise.all([
      supabase
        .from('vertice_extension_hour_entries')
        .select('*')
        .eq('participant_id', participantId)
        .eq('project_id', projectId)
        .order('activity_date', { ascending: false }),
      supabase
        .from('v_extension_participant_hours')
        .select('*')
        .eq('participant_id', participantId)
        .eq('project_id', projectId)
        .single(),
    ]);
    setEntries(entriesRes.data || []);
    setSummary(summaryRes.data || null);
    setLoading(false);
  }, [institutionId, projectId, participantId]);

  useEffect(() => { load(); }, [load]);

  const saveEntry = async () => {
    if (!formData.description.trim()) return alert('Descrição obrigatória.');
    if (formData.minutes === 0) return alert('Minutos não pode ser zero.');
    if (formData.entry_type !== 'credit' && !formData.reference_entry_id) {
      return alert('Correções e estornos precisam referenciar um lançamento original.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const minutes = formData.entry_type === 'reversal'
      ? -Math.abs(formData.minutes)
      : Math.abs(formData.minutes);

    const { error } = await supabase.from('vertice_extension_hour_entries').insert({
      institution_id: institutionId,
      project_id: projectId,
      participant_id: participantId,
      entry_type: formData.entry_type,
      minutes,
      description: formData.description.trim(),
      activity_date: formData.activity_date,
      reference_entry_id: formData.reference_entry_id,
      recorded_by: user.id,
    });

    if (error) return alert('Erro ao salvar: ' + error.message);
    setShowForm(false);
    setFormData({ entry_type: 'credit', minutes: 60, description: '', activity_date: new Date().toISOString().slice(0, 10), reference_entry_id: null });
    load();
  };

  const approveEntry = async (entryId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Aprovação é o único UPDATE permitido (campo approved_by/approved_at)
    // O trigger bloqueia mudanças nos outros campos
    const { error } = await supabase
      .from('vertice_extension_hour_entries')
      .update({ approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', entryId);

    if (error) alert('Erro ao aprovar: ' + error.message);
    else load();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
  const fmtMinutes = (m: number) => {
    const h = Math.floor(Math.abs(m) / 60);
    const min = Math.abs(m) % 60;
    const sign = m < 0 ? '-' : '+';
    return `${sign}${h}h${min > 0 ? min + 'min' : ''}`;
  };

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📒 Livro-razão — {participantName}</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* Resumo */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
          <div className="ext-stat-card">
            <span className="ext-stat-value" style={{ color: '#22c55e' }}>{summary.approved_hours}h</span>
            <span className="ext-stat-label">Aprovadas</span>
          </div>
          <div className="ext-stat-card">
            <span className="ext-stat-value" style={{ color: '#f59e0b' }}>{Math.floor(summary.pending_minutes / 60)}h{summary.pending_minutes % 60 > 0 ? `${summary.pending_minutes % 60}min` : ''}</span>
            <span className="ext-stat-label">Pendentes</span>
          </div>
          <div className="ext-stat-card">
            <span className="ext-stat-value">{summary.total_entries}</span>
            <span className="ext-stat-label">Lançamentos</span>
          </div>
          <div className="ext-stat-card">
            <span className="ext-stat-value">{summary.last_activity_date ? fmtDate(summary.last_activity_date) : '—'}</span>
            <span className="ext-stat-label">Última atividade</span>
          </div>
        </div>
      )}

      {/* Botão novo lançamento */}
      {canEdit && (
        <button className="ext-btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowForm(true)}>
          + Novo lançamento
        </button>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="ext-form">
          <h3>Novo lançamento</h3>
          <div className="ext-form-grid">
            <label>Tipo
              <select value={formData.entry_type} onChange={e => setFormData({ ...formData, entry_type: e.target.value as any })}>
                <option value="credit">Crédito</option>
                <option value="correction">Correção compensatória</option>
                <option value="reversal">Estorno</option>
              </select>
            </label>
            <label>Minutos
              <input type="number" min={1} value={formData.minutes} onChange={e => setFormData({ ...formData, minutes: +e.target.value })} />
            </label>
            <label>Data da atividade
              <input type="date" value={formData.activity_date} onChange={e => setFormData({ ...formData, activity_date: e.target.value })} />
            </label>
            {formData.entry_type !== 'credit' && (
              <label>Lançamento de referência
                <select value={formData.reference_entry_id || ''} onChange={e => setFormData({ ...formData, reference_entry_id: e.target.value || null })}>
                  <option value="">— Selecionar —</option>
                  {entries.filter(e => e.entry_type === 'credit').map(e => (
                    <option key={e.id} value={e.id}>{fmtDate(e.activity_date)} — {fmtMinutes(e.minutes)} — {e.description.slice(0, 40)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="ext-form-full">Descrição (obrigatória)
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Descreva a atividade realizada..." />
          </label>
          <div className="ext-form-actions">
            <button className="ext-btn-save" onClick={saveEntry}>Lançar</button>
            <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela de lançamentos */}
      {loading ? <p>Carregando...</p> : entries.length === 0 ? (
        <p className="ext-empty">Nenhum lançamento de horas registrado.</p>
      ) : (
        <table className="ext-table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Minutos</th><th>Descrição</th><th>Status</th>{canEdit && <th>Ação</th>}</tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td>{fmtDate(e.activity_date)}</td>
                <td><span style={{ color: TYPE_COLORS[e.entry_type] }}>{TYPE_LABELS[e.entry_type]}</span></td>
                <td className="num" style={{ color: e.minutes > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{fmtMinutes(e.minutes)}</td>
                <td>{e.description}</td>
                <td>{e.approved_at
                  ? <span style={{ color: '#22c55e' }}>✅ Aprovado {fmtDate(e.approved_at)}</span>
                  : <span style={{ color: '#f59e0b' }}>⏳ Pendente</span>}
                </td>
                {canEdit && (
                  <td>
                    {!e.approved_at && (
                      <button className="ext-btn-small" onClick={() => approveEntry(e.id)}>Aprovar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
