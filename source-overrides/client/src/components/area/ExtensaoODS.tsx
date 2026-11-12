/**
 * ExtensaoODS — Vinculação de projetos aos ODS com fundamentação
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SDGGoal { id: number; code: string; title_pt: string; icon_color: string; }
interface SDGTarget { id: number; goal_id: number; code: string; title_en: string; is_means_of_implementation: boolean; }
interface SDGLink {
  id: string; project_id: string; target_id: number;
  justification: string; contribution_type: string;
  validated_by: string | null; validated_at: string | null;
}

const CONTRIBUTION_LABELS: Record<string, string> = {
  produto: '📦 Produto',
  resultado: '📊 Resultado',
  impacto_demonstrado: '🎯 Impacto demonstrado',
};

export default function ExtensaoODS({
  institutionId, projectId, projectTitle, canEdit, onClose,
}: {
  institutionId: string;
  projectId: string;
  projectTitle: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [goals, setGoals] = useState<SDGGoal[]>([]);
  const [targets, setTargets] = useState<SDGTarget[]>([]);
  const [links, setLinks] = useState<SDGLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    target_id: 0,
    justification: '',
    contribution_type: 'produto',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [goalsRes, targetsRes, linksRes] = await Promise.all([
      supabase.from('vertice_sdg_goals').select('*').order('id'),
      supabase.from('vertice_sdg_targets').select('*').order('code'),
      supabase.from('vertice_extension_sdg_links').select('*').eq('project_id', projectId),
    ]);
    setGoals(goalsRes.data || []);
    setTargets(targetsRes.data || []);
    setLinks(linksRes.data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const saveLink = async () => {
    if (!formData.target_id) return alert('Selecione uma meta ODS.');
    if (!formData.justification.trim()) return alert('Fundamentação obrigatória.');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('vertice_extension_sdg_links').insert({
      institution_id: institutionId,
      project_id: projectId,
      target_id: formData.target_id,
      justification: formData.justification.trim(),
      contribution_type: formData.contribution_type,
      linked_by: user.id,
    });

    if (error) {
      if (error.code === '23505') return alert('Esta meta já está vinculada a este projeto.');
      return alert('Erro: ' + error.message);
    }
    setShowForm(false);
    setFormData({ target_id: 0, justification: '', contribution_type: 'produto' });
    load();
  };

  const removeLink = async (linkId: string) => {
    if (!confirm('Remover vinculação ODS?')) return;
    await supabase.from('vertice_extension_sdg_links').delete().eq('id', linkId);
    load();
  };

  const linkedTargetIds = new Set(links.map(l => l.target_id));
  const filteredTargets = selectedGoal
    ? targets.filter(t => t.goal_id === selectedGoal && !linkedTargetIds.has(t.id))
    : [];

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🌍 ODS — {projectTitle}</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* Grid de ODS vinculados */}
      {links.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4>Metas vinculadas ({links.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {links.map(link => {
              const target = targets.find(t => t.id === link.target_id);
              const goal = target ? goals.find(g => g.id === target.goal_id) : null;
              return (
                <div key={link.id} style={{
                  padding: '.75rem 1rem', borderRadius: '.5rem',
                  border: `2px solid ${goal?.icon_color || '#ddd'}`,
                  background: (goal?.icon_color || '#ddd') + '10',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ color: goal?.icon_color }}>{target?.code}</strong>
                      <span style={{ marginLeft: '.5rem', fontSize: '.85rem' }}>{target?.title_en}</span>
                      <div style={{ fontSize: '.82rem', color: 'var(--text-secondary, #6b7280)', marginTop: '.25rem' }}>
                        {CONTRIBUTION_LABELS[link.contribution_type]} · {goal?.title_pt}
                      </div>
                      <p style={{ margin: '.4rem 0 0', fontSize: '.85rem', fontStyle: 'italic' }}>
                        "{link.justification}"
                      </p>
                      {link.validated_at && (
                        <span style={{ fontSize: '.75rem', color: '#22c55e' }}>✅ Validado em {fmtDate(link.validated_at)}</span>
                      )}
                    </div>
                    {canEdit && (
                      <button className="ext-btn-small" style={{ color: '#ef4444' }} onClick={() => removeLink(link.id)}>✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Botão para vincular */}
      {canEdit && !showForm && (
        <button className="ext-btn-primary" onClick={() => setShowForm(true)}>
          + Vincular meta ODS
        </button>
      )}

      {/* Formulário de vinculação */}
      {showForm && (
        <div className="ext-form">
          <h3>Vincular meta ODS</h3>

          {/* Seletor visual de ODS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: '.4rem', marginBottom: '1rem' }}>
            {goals.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGoal(g.id)}
                style={{
                  width: '100%', aspectRatio: '1', border: 'none', borderRadius: '.4rem', cursor: 'pointer',
                  background: selectedGoal === g.id ? g.icon_color : g.icon_color + '30',
                  color: selectedGoal === g.id ? '#fff' : g.icon_color,
                  fontWeight: 700, fontSize: '1.1rem',
                  transition: 'all .15s',
                }}
              >
                {g.id}
              </button>
            ))}
          </div>

          {selectedGoal && (
            <>
              <p style={{ fontWeight: 600, color: goals.find(g => g.id === selectedGoal)?.icon_color }}>
                ODS {selectedGoal}: {goals.find(g => g.id === selectedGoal)?.title_pt}
              </p>

              <label>Meta
                <select value={formData.target_id || ''} onChange={e => setFormData({ ...formData, target_id: +e.target.value })}>
                  <option value="">— Selecionar meta —</option>
                  {filteredTargets.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.title_en.slice(0, 80)}{t.title_en.length > 80 ? '...' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>Tipo de contribuição
                <select value={formData.contribution_type} onChange={e => setFormData({ ...formData, contribution_type: e.target.value })}>
                  <option value="produto">Produto (entrega direta)</option>
                  <option value="resultado">Resultado (mudança observada)</option>
                  <option value="impacto_demonstrado">Impacto demonstrado (evidência mensurável)</option>
                </select>
              </label>

              <label className="ext-form-full">Fundamentação (obrigatória)
                <textarea
                  value={formData.justification}
                  onChange={e => setFormData({ ...formData, justification: e.target.value })}
                  rows={3}
                  placeholder="Por que este projeto contribui para esta meta ODS? Qual a evidência ou entrega que sustenta a vinculação?"
                />
              </label>

              <div className="ext-form-actions">
                <button className="ext-btn-save" onClick={saveLink}>Vincular</button>
                <button className="ext-btn-cancel" onClick={() => { setShowForm(false); setSelectedGoal(null); }}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && <p>Carregando catálogo ODS...</p>}
    </div>
  );
}
