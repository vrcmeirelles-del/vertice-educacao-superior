import { HelpLabel } from '@/components/ContextHelp';
/**
 * ExtensaoAchados — Achados e Plano de Ação 5W2H
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Finding {
  id: string; title: string; description: string; severity: string;
  category: string; source_type: string; status: string;
  project_id: string | null; potential_impact: string;
  confidence_level: string; action_id: string | null;
  resolution_notes: string; found_at: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  critico: '🔴 Crítico', alto: '🟠 Alto', medio: '🟡 Médio',
  baixo: '🟢 Baixo', informativo: '⚪ Informativo',
};
const SEVERITY_COLORS: Record<string, string> = {
  critico: '#dc2626', alto: '#ea580c', medio: '#eab308',
  baixo: '#22c55e', informativo: '#6b7280',
};
const CATEGORY_LABELS: Record<string, string> = {
  curricularizacao: '📚 Curricularização', documentacao: '📄 Documentação',
  regulatorio: '⚖️ Regulatório', pedagogico: '🎓 Pedagógico',
  ods: '🌍 ODS', evidencia: '📁 Evidência', geral: '📋 Geral',
};
const STATUS_LABELS: Record<string, string> = {
  aberto: '🔓 Aberto', em_analise: '🔍 Em Análise', acao_criada: '📋 Ação Criada',
  resolvido: '✅ Resolvido', ignorado: '⏭️ Ignorado', falso_positivo: '❌ Falso Positivo',
};
const SOURCE_LABELS: Record<string, string> = {
  manual: '👤 Manual', ai_documental: '🤖 IA Documental', ai_estrutural: '🤖 IA Estrutural',
  ai_projeto: '🤖 IA Projeto', revisao: '📝 Revisão', auditoria: '🔎 Auditoria',
};

export default function ExtensaoAchados({
  institutionId, canEdit, onClose,
}: {
  institutionId: string; canEdit: boolean; onClose: () => void;
}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', severity: 'medio', category: 'geral',
    source_type: 'manual', potential_impact: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_extension_findings')
      .select('*').eq('institution_id', institutionId)
      .order('found_at', { ascending: false });
    setFindings(data || []);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const saveFinding = async () => {
    if (!formData.title.trim()) return alert('Título obrigatório.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('vertice_extension_findings').insert({
      institution_id: institutionId, ...formData, found_by: user.id,
    });
    if (error) return alert('Erro: ' + error.message);
    setShowForm(false);
    setFormData({ title: '', description: '', severity: 'medio', category: 'geral', source_type: 'manual', potential_impact: '' });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const update: any = { status };
    if (status === 'resolvido') { update.resolved_by = user.id; update.resolved_at = new Date().toISOString(); }
    const { error } = await supabase.from('vertice_extension_findings').update(update).eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else load();
  };

  const filtered = findings.filter(f =>
    (filterSeverity === 'todos' || f.severity === filterSeverity) &&
    (filterStatus === 'todos' || f.status === filterStatus)
  );

  const abertos = findings.filter(f => f.status === 'aberto').length;
  const criticos = findings.filter(f => f.severity === 'critico' && f.status !== 'resolvido').length;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🔍 Achados e Plano de Ação</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{findings.length}</span>
          <span className="ext-stat-label">Total</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#ea580c' }}>{abertos}</span>
          <span className="ext-stat-label">Abertos</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#dc2626' }}>{criticos}</span>
          <span className="ext-stat-label">Críticos</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="todos">Todas as severidades</option>
          {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {canEdit && <button className="ext-btn-primary" onClick={() => setShowForm(true)}>+ Novo achado</button>}
      </div>

      {showForm && (
        <div className="ext-form">
          <h3>Registrar achado</h3>
          <div className="ext-form-grid">
            <HelpLabel>Título *<input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></HelpLabel>
            <HelpLabel>Severidade
              <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}>
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </HelpLabel>
            <HelpLabel>Categoria
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </HelpLabel>
            <HelpLabel>Origem
              <select value={formData.source_type} onChange={e => setFormData({ ...formData, source_type: e.target.value })}>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </HelpLabel>
          </div>
          <HelpLabel className="ext-form-full">Descrição *<textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></HelpLabel>
          <HelpLabel className="ext-form-full">Impacto potencial<textarea value={formData.potential_impact} onChange={e => setFormData({ ...formData, potential_impact: e.target.value })} rows={2} /></HelpLabel>
          <div className="ext-form-actions">
            <button className="ext-btn-save" onClick={saveFinding}>Salvar</button>
            <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p>Carregando...</p> : filtered.length === 0 ? (
        <p className="ext-empty">Nenhum achado encontrado.</p>
      ) : (
        <div style={{ display: 'grid', gap: '.75rem' }}>
          {filtered.map(f => (
            <div key={f.id} style={{ padding: '1rem', border: `2px solid ${SEVERITY_COLORS[f.severity] || '#e5e7eb'}`, borderRadius: '8px', borderLeftWidth: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{f.title}</strong>
                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem', fontSize: '.8rem', flexWrap: 'wrap' }}>
                    <span style={{ color: SEVERITY_COLORS[f.severity] }}>{SEVERITY_LABELS[f.severity]}</span>
                    <span>{CATEGORY_LABELS[f.category] || f.category}</span>
                    <span style={{ color: '#6b7280' }}>{SOURCE_LABELS[f.source_type]}</span>
                    <span style={{ color: '#9ca3af' }}>{fmtDate(f.found_at)}</span>
                  </div>
                </div>
                <span style={{ fontSize: '.85rem' }}>{STATUS_LABELS[f.status]}</span>
              </div>
              <p style={{ margin: '.5rem 0', fontSize: '.9rem', color: '#374151' }}>{f.description}</p>
              {f.potential_impact && <p style={{ margin: '.25rem 0', fontSize: '.85rem', color: '#6b7280' }}>💥 {f.potential_impact}</p>}
              {f.resolution_notes && <p style={{ margin: '.25rem 0', fontSize: '.85rem', color: '#22c55e' }}>✅ {f.resolution_notes}</p>}
              {canEdit && f.status === 'aberto' && (
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                  <button className="ext-btn-small" onClick={() => updateStatus(f.id, 'em_analise')}>Analisar</button>
                  <button className="ext-btn-small" onClick={() => updateStatus(f.id, 'resolvido')}>Resolver</button>
                  <button className="ext-btn-small" onClick={() => updateStatus(f.id, 'falso_positivo')}>Falso +</button>
                </div>
              )}
              {canEdit && f.status === 'em_analise' && (
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                  <button className="ext-btn-small" onClick={() => updateStatus(f.id, 'resolvido')}>Resolver</button>
                  <button className="ext-btn-small" onClick={() => updateStatus(f.id, 'ignorado')}>Ignorar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
