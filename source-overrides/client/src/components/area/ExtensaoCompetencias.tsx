/**
 * ExtensaoCompetencias — Catálogo e avaliação de competências
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Competency {
  id: string; code: string; name: string; description: string;
  category: string; course_id: string | null; source_document: string;
  active: boolean;
}

interface CompEval {
  id: string; student_id: string; project_id: string; competency_id: string;
  level: string; evidence_description: string; evaluated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  extensao: '🌍 Extensão', transversal: '🔄 Transversal',
  especifica: '🎯 Específica', profissional: '💼 Profissional', cidada: '🏛️ Cidadã',
};

const LEVEL_LABELS: Record<string, string> = {
  nao_demonstrada: '⬜ Não demonstrada', em_desenvolvimento: '🟡 Em desenvolvimento',
  demonstrada: '🟢 Demonstrada', consolidada: '🏆 Consolidada',
};
const LEVEL_COLORS: Record<string, string> = {
  nao_demonstrada: '#9ca3af', em_desenvolvimento: '#f59e0b',
  demonstrada: '#22c55e', consolidada: '#2563eb',
};

export default function ExtensaoCompetencias({
  institutionId, courseId, canEdit, onClose,
}: {
  institutionId: string;
  courseId?: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [evaluations, setEvaluations] = useState<CompEval[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '', name: '', description: '', category: 'extensao', source_document: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('vertice_extension_competencies').select('*')
      .eq('institution_id', institutionId).eq('active', true).order('code');
    if (courseId) q = q.or(`course_id.eq.${courseId},course_id.is.null`);
    const [comp, evals] = await Promise.all([
      q,
      supabase.from('vertice_extension_competency_evaluations').select('*').eq('institution_id', institutionId),
    ]);
    setCompetencies(comp.data || []);
    setEvaluations(evals.data || []);
    setLoading(false);
  }, [institutionId, courseId]);

  useEffect(() => { load(); }, [load]);

  const saveCompetency = async () => {
    if (!formData.name.trim()) return alert('Nome obrigatório.');
    const { error } = await supabase.from('vertice_extension_competencies').insert({
      institution_id: institutionId,
      course_id: courseId || null,
      ...formData,
    });
    if (error) return alert('Erro: ' + error.message);
    setShowForm(false);
    setFormData({ code: '', name: '', description: '', category: 'extensao', source_document: '' });
    load();
  };

  const evalCount = (compId: string) => evaluations.filter(e => e.competency_id === compId);
  const levelDistribution = (compId: string) => {
    const evals = evalCount(compId);
    const total = evals.length || 1;
    return {
      consolidada: evals.filter(e => e.level === 'consolidada').length,
      demonstrada: evals.filter(e => e.level === 'demonstrada').length,
      em_desenvolvimento: evals.filter(e => e.level === 'em_desenvolvimento').length,
      nao_demonstrada: evals.filter(e => e.level === 'nao_demonstrada').length,
      total: evals.length,
    };
  };

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🎯 Competências de Extensão</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{competencies.length}</span>
          <span className="ext-stat-label">Competências</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{evaluations.length}</span>
          <span className="ext-stat-label">Avaliações</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#2563eb' }}>
            {evaluations.filter(e => e.level === 'consolidada').length}
          </span>
          <span className="ext-stat-label">Consolidadas</span>
        </div>
      </div>

      {canEdit && (
        <button className="ext-btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowForm(true)}>
          + Nova competência
        </button>
      )}

      {showForm && (
        <div className="ext-form">
          <h3>Nova competência</h3>
          <div className="ext-form-grid">
            <label>Código
              <input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="EXT-01" />
            </label>
            <label>Nome *
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </label>
            <label>Categoria
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Documento fonte
              <input value={formData.source_document} onChange={e => setFormData({ ...formData, source_document: e.target.value })} placeholder="PPC, DCN, resolução..." />
            </label>
          </div>
          <label className="ext-form-full">Descrição
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
          </label>
          <div className="ext-form-actions">
            <button className="ext-btn-save" onClick={saveCompetency}>Salvar</button>
            <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p>Carregando...</p> : competencies.length === 0 ? (
        <p className="ext-empty">Nenhuma competência cadastrada.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {competencies.map(c => {
            const dist = levelDistribution(c.id);
            return (
              <div key={c.id} style={{ padding: '1rem', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{c.code ? `[${c.code}] ` : ''}{c.name}</strong>
                    <span style={{ marginLeft: '.5rem', fontSize: '.8rem', color: '#6b7280' }}>
                      {CATEGORY_LABELS[c.category] || c.category}
                    </span>
                    {c.description && <p style={{ margin: '.25rem 0 0', fontSize: '.85rem', color: '#4b5563' }}>{c.description}</p>}
                    {c.source_document && <small style={{ color: '#9ca3af' }}>Fonte: {c.source_document}</small>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '.8rem' }}>
                    <strong>{dist.total}</strong> avaliações
                  </div>
                </div>
                {dist.total > 0 && (
                  <div style={{ display: 'flex', gap: '2px', marginTop: '.75rem', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    {dist.consolidada > 0 && <div style={{ flex: dist.consolidada, background: LEVEL_COLORS.consolidada }} title={`${dist.consolidada} consolidada(s)`} />}
                    {dist.demonstrada > 0 && <div style={{ flex: dist.demonstrada, background: LEVEL_COLORS.demonstrada }} title={`${dist.demonstrada} demonstrada(s)`} />}
                    {dist.em_desenvolvimento > 0 && <div style={{ flex: dist.em_desenvolvimento, background: LEVEL_COLORS.em_desenvolvimento }} title={`${dist.em_desenvolvimento} em desenvolvimento`} />}
                    {dist.nao_demonstrada > 0 && <div style={{ flex: dist.nao_demonstrada, background: LEVEL_COLORS.nao_demonstrada }} title={`${dist.nao_demonstrada} não demonstrada(s)`} />}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '.5rem', fontSize: '.75rem' }}>
                  {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                    <span key={k} style={{ color: LEVEL_COLORS[k] }}>{v}: {(dist as any)[k] || 0}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
