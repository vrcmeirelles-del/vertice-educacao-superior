/**
 * ExtensaoHourLedger — Livro-razão de horas de extensão (v2 — 8 estados)
 * Interface para lançamentos append-only com workflow completo:
 * prevista → programada → executada → declarada → aguardando_validacao → validada → integralizada
 *                                                                      → indeferida
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type HourState = 'prevista' | 'programada' | 'executada' | 'declarada' | 'aguardando_validacao' | 'validada' | 'integralizada' | 'indeferida';

interface HourEntry {
  id: string;
  project_id: string;
  student_id: string;
  entry_type: 'credit' | 'correction' | 'reversal';
  minutes: number;
  description: string;
  activity_date: string;
  reference_entry_id: string | null;
  hour_state: HourState;
  rejection_reason: string | null;
  recorded_by: string;
  recorded_at: string;
  approved_by: string | null;
  approved_at: string | null;
  integrated_at: string | null;
}

const STATE_LABELS: Record<HourState, string> = {
  prevista: '📋 Prevista',
  programada: '📅 Programada',
  executada: '▶️ Executada',
  declarada: '✋ Declarada',
  aguardando_validacao: '⏳ Aguardando validação',
  validada: '✅ Validada',
  integralizada: '🏆 Integralizada',
  indeferida: '❌ Indeferida',
};

const STATE_COLORS: Record<HourState, string> = {
  prevista: '#9ca3af', programada: '#6366f1', executada: '#8b5cf6',
  declarada: '#f59e0b', aguardando_validacao: '#f97316',
  validada: '#22c55e', integralizada: '#2563eb', indeferida: '#ef4444',
};

// Transições permitidas
const TRANSITIONS: Record<HourState, HourState[]> = {
  prevista: ['programada'],
  programada: ['executada'],
  executada: ['declarada'],
  declarada: ['aguardando_validacao'],
  aguardando_validacao: ['validada', 'indeferida'],
  validada: ['integralizada'],
  integralizada: [],
  indeferida: [],
};

const TYPE_LABELS: Record<string, string> = {
  credit: '➕ Crédito', correction: '🔄 Correção', reversal: '↩️ Estorno',
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterState, setFilterState] = useState<string>('todos');
  const [formData, setFormData] = useState({
    entry_type: 'credit' as 'credit' | 'correction' | 'reversal',
    minutes: 60,
    description: '',
    activity_date: new Date().toISOString().slice(0, 10),
    hour_state: 'executada' as HourState,
    reference_entry_id: null as string | null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vertice_extension_hour_entries')
      .select('*')
      .eq('student_id', participantId)
      .eq('project_id', projectId)
      .order('activity_date', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }, [projectId, participantId]);

  useEffect(() => { load(); }, [load]);

  const saveEntry = async () => {
    if (!formData.description.trim()) return alert('Descrição obrigatória.');
    if (formData.minutes === 0) return alert('Minutos não pode ser zero.');
    if (formData.entry_type !== 'credit' && !formData.reference_entry_id) {
      return alert('Correções e estornos precisam referenciar um lançamento original.');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const minutes = formData.entry_type === 'reversal' ? -Math.abs(formData.minutes) : Math.abs(formData.minutes);

    const { error } = await supabase.from('vertice_extension_hour_entries').insert({
      institution_id: institutionId, project_id: projectId,
      student_id: participantId, entry_type: formData.entry_type,
      minutes, description: formData.description.trim(),
      activity_date: formData.activity_date,
      hour_state: formData.hour_state,
      reference_entry_id: formData.reference_entry_id,
      recorded_by: user.id,
    });
    if (error) return alert('Erro ao salvar: ' + error.message);
    setShowForm(false);
    setFormData({ entry_type: 'credit', minutes: 60, description: '', activity_date: new Date().toISOString().slice(0, 10), hour_state: 'executada', reference_entry_id: null });
    load();
  };

  const advanceState = async (entryId: string, newState: HourState, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const update: any = { hour_state: newState };
    if (newState === 'validada') { update.approved_by = user.id; update.approved_at = new Date().toISOString(); }
    if (newState === 'integralizada') { update.integrated_at = new Date().toISOString(); update.integrated_by = user.id; }
    if (newState === 'indeferida') { update.rejection_reason = reason || 'Sem justificativa'; }

    const { error } = await supabase.from('vertice_extension_hour_entries')
      .update(update).eq('id', entryId);
    if (error) alert('Erro: ' + error.message);
    else load();
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtMinutes = (m: number) => {
    const h = Math.floor(Math.abs(m) / 60);
    const min = Math.abs(m) % 60;
    const sign = m < 0 ? '-' : '+';
    return `${sign}${h}h${min > 0 ? min + 'min' : ''}`;
  };

  const filtered = filterState === 'todos' ? entries : entries.filter(e => e.hour_state === filterState);

  // KPIs por estado
  const byState = (s: HourState) => entries.filter(e => e.hour_state === s);
  const minutesByState = (s: HourState) => byState(s).reduce((sum, e) => sum + Math.abs(e.minutes), 0);
  const hoursStr = (mins: number) => `${Math.floor(mins / 60)}h${mins % 60 > 0 ? mins % 60 + 'min' : ''}`;

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📒 Livro-razão — {participantName}</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* Pipeline visual */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['prevista','programada','executada','declarada','aguardando_validacao','validada','integralizada','indeferida'] as HourState[]).map(s => {
          const count = byState(s).length;
          const mins = minutesByState(s);
          return (
            <div key={s} onClick={() => setFilterState(filterState === s ? 'todos' : s)}
              style={{
                flex: '1 1 auto', minWidth: '80px', padding: '.5rem .4rem', textAlign: 'center',
                background: (filterState === s ? STATE_COLORS[s] + '30' : 'var(--bg-secondary, #f9fafb)'),
                borderBottom: `3px solid ${STATE_COLORS[s]}`, borderRadius: '4px 4px 0 0',
                cursor: 'pointer', fontSize: '.75rem',
              }}>
              <div style={{ fontWeight: 600, color: STATE_COLORS[s] }}>{count}</div>
              <div>{STATE_LABELS[s].split(' ').slice(1).join(' ')}</div>
              {mins > 0 && <div style={{ color: '#6b7280', fontSize: '.7rem' }}>{hoursStr(mins)}</div>}
            </div>
          );
        })}
      </div>

      {/* Resumo consolidado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.5rem', marginBottom: '1rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#22c55e' }}>{hoursStr(minutesByState('validada') + minutesByState('integralizada'))}</span>
          <span className="ext-stat-label">Validadas + Integralizadas</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#f59e0b' }}>{hoursStr(minutesByState('executada') + minutesByState('declarada') + minutesByState('aguardando_validacao'))}</span>
          <span className="ext-stat-label">Em trâmite</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{entries.length}</span>
          <span className="ext-stat-label">Lançamentos</span>
        </div>
      </div>

      {canEdit && (
        <button className="ext-btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowForm(true)}>
          + Novo lançamento
        </button>
      )}

      {showForm && (
        <div className="ext-form">
          <h3>Novo lançamento</h3>
          <div className="ext-form-grid">
            <label>Tipo
              <select value={formData.entry_type} onChange={e => setFormData({ ...formData, entry_type: e.target.value as any })}>
                <option value="credit">Crédito</option>
                <option value="correction">Correção</option>
                <option value="reversal">Estorno</option>
              </select>
            </label>
            <label>Estado inicial
              <select value={formData.hour_state} onChange={e => setFormData({ ...formData, hour_state: e.target.value as HourState })}>
                <option value="prevista">Prevista</option>
                <option value="programada">Programada</option>
                <option value="executada">Executada</option>
                <option value="declarada">Declarada</option>
              </select>
            </label>
            <label>Minutos
              <input type="number" min={1} value={formData.minutes} onChange={e => setFormData({ ...formData, minutes: +e.target.value })} />
            </label>
            <label>Data
              <input type="date" value={formData.activity_date} onChange={e => setFormData({ ...formData, activity_date: e.target.value })} />
            </label>
            {formData.entry_type !== 'credit' && (
              <label>Referência
                <select value={formData.reference_entry_id || ''} onChange={e => setFormData({ ...formData, reference_entry_id: e.target.value || null })}>
                  <option value="">— Selecionar —</option>
                  {entries.filter(e => e.entry_type === 'credit').map(e => (
                    <option key={e.id} value={e.id}>{fmtDate(e.activity_date)} — {fmtMinutes(e.minutes)} — {e.description.slice(0, 30)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="ext-form-full">Descrição *
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Descreva a atividade..." />
          </label>
          <div className="ext-form-actions">
            <button className="ext-btn-save" onClick={saveEntry}>Lançar</button>
            <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {loading ? <p>Carregando...</p> : filtered.length === 0 ? (
        <p className="ext-empty">{filterState !== 'todos' ? `Nenhum lançamento com estado "${STATE_LABELS[filterState as HourState]?.split(' ').slice(1).join(' ')}".` : 'Nenhum lançamento registrado.'}</p>
      ) : (
        <table className="ext-table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Min</th><th>Descrição</th><th>Estado</th>{canEdit && <th>Ações</th>}</tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const nextStates = TRANSITIONS[e.hour_state] || [];
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.activity_date)}</td>
                  <td>{TYPE_LABELS[e.entry_type]}</td>
                  <td className="num" style={{ color: e.minutes > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{fmtMinutes(e.minutes)}</td>
                  <td>
                    {e.description}
                    {e.rejection_reason && <><br /><small style={{ color: '#ef4444' }}>Motivo: {e.rejection_reason}</small></>}
                  </td>
                  <td><span style={{ color: STATE_COLORS[e.hour_state], fontWeight: 500 }}>{STATE_LABELS[e.hour_state]}</span></td>
                  {canEdit && (
                    <td>
                      {nextStates.map(ns => (
                        <button key={ns} className="ext-btn-small" style={{ marginRight: '.25rem', marginBottom: '.25rem' }}
                          onClick={() => {
                            if (ns === 'indeferida') {
                              const reason = prompt('Motivo do indeferimento:');
                              if (reason) advanceState(e.id, ns, reason);
                            } else {
                              advanceState(e.id, ns);
                            }
                          }}>
                          {STATE_LABELS[ns].split(' ').slice(1).join(' ')}
                        </button>
                      ))}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
