/**
 * ExtensaoProjectWorkflow — Workflow de aprovação de projetos (11 estados)
 * Mostra pipeline visual + histórico de alterações + transições controladas
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ProjectHistory {
  id: string; field_changed: string; old_value: string; new_value: string;
  changed_by: string; changed_at: string; reason: string;
}

type ReviewStatus = 'rascunho' | 'submetido' | 'em_analise' | 'pendente_ajustes' | 'aprovado' | 'em_execucao' | 'aguardando_evidencias' | 'em_avaliacao' | 'concluido' | 'reprovado' | 'arquivado';

const STATUS_META: Record<ReviewStatus, { label: string; color: string; icon: string }> = {
  rascunho: { label: 'Rascunho', color: '#9ca3af', icon: '📝' },
  submetido: { label: 'Submetido', color: '#6366f1', icon: '📤' },
  em_analise: { label: 'Em Análise', color: '#3b82f6', icon: '🔍' },
  pendente_ajustes: { label: 'Pendente Ajustes', color: '#f59e0b', icon: '⚠️' },
  aprovado: { label: 'Aprovado', color: '#22c55e', icon: '✅' },
  em_execucao: { label: 'Em Execução', color: '#8b5cf6', icon: '▶️' },
  aguardando_evidencias: { label: 'Aguardando Evidências', color: '#f97316', icon: '📁' },
  em_avaliacao: { label: 'Em Avaliação', color: '#0ea5e9', icon: '📊' },
  concluido: { label: 'Concluído', color: '#059669', icon: '🏆' },
  reprovado: { label: 'Reprovado', color: '#dc2626', icon: '❌' },
  arquivado: { label: 'Arquivado', color: '#6b7280', icon: '📦' },
};

const TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  rascunho: ['submetido'],
  submetido: ['em_analise', 'pendente_ajustes'],
  em_analise: ['aprovado', 'pendente_ajustes', 'reprovado'],
  pendente_ajustes: ['submetido'],
  aprovado: ['em_execucao'],
  em_execucao: ['aguardando_evidencias'],
  aguardando_evidencias: ['em_avaliacao'],
  em_avaliacao: ['concluido', 'pendente_ajustes'],
  concluido: ['arquivado'],
  reprovado: ['rascunho', 'arquivado'],
  arquivado: [],
};

const PIPELINE_ORDER: ReviewStatus[] = [
  'rascunho', 'submetido', 'em_analise', 'aprovado', 'em_execucao',
  'aguardando_evidencias', 'em_avaliacao', 'concluido',
];

export default function ExtensaoProjectWorkflow({
  institutionId, projectId, projectTitle, currentStatus, canEdit, onStatusChange, onClose,
}: {
  institutionId: string;
  projectId: string;
  projectTitle: string;
  currentStatus: string;
  canEdit: boolean;
  onStatusChange: () => void;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ProjectHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_extension_project_history')
      .select('*').eq('project_id', projectId)
      .order('changed_at', { ascending: false });
    setHistory(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const advanceStatus = async (newStatus: ReviewStatus) => {
    setChanging(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChanging(false); return; }

    let reason = '';
    if (['pendente_ajustes', 'reprovado'].includes(newStatus)) {
      reason = prompt(newStatus === 'reprovado' ? 'Motivo da reprovação:' : 'Ajustes necessários:') || '';
      if (!reason) { setChanging(false); return; }
    }

    // Registrar histórico
    await supabase.from('vertice_extension_project_history').insert({
      institution_id: institutionId,
      project_id: projectId,
      field_changed: 'review_status',
      old_value: currentStatus,
      new_value: newStatus,
      changed_by: user.id,
      reason: reason || null,
    });

    // Atualizar projeto
    const { error } = await supabase.from('vertice_extension_projects')
      .update({ review_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    setChanging(false);
    if (error) return alert('Erro: ' + error.message);
    onStatusChange();
    load();
  };

  const status = currentStatus as ReviewStatus;
  const meta = STATUS_META[status] || STATUS_META.rascunho;
  const nextStates = TRANSITIONS[status] || [];
  const pipelineIdx = PIPELINE_ORDER.indexOf(status);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📋 Workflow — {projectTitle}</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* Status atual */}
      <div style={{ textAlign: 'center', padding: '1.5rem', background: meta.color + '10', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '2rem' }}>{meta.icon}</span>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: meta.color, marginTop: '.25rem' }}>{meta.label}</div>
      </div>

      {/* Pipeline visual */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {PIPELINE_ORDER.map((s, i) => {
          const m = STATUS_META[s];
          const isCurrent = s === status;
          const isPast = pipelineIdx >= 0 && i < pipelineIdx;
          const isSpecial = status === 'reprovado' || status === 'pendente_ajustes';
          return (
            <div key={s} style={{
              flex: '1 1 auto', minWidth: '70px', padding: '.4rem .3rem', textAlign: 'center',
              background: isCurrent ? m.color + '25' : isPast ? '#22c55e10' : 'var(--bg-secondary, #f9fafb)',
              borderBottom: `3px solid ${isCurrent ? m.color : isPast ? '#22c55e' : '#e5e7eb'}`,
              borderRadius: '4px 4px 0 0', fontSize: '.65rem',
            }}>
              <div>{m.icon}</div>
              <div style={{ fontWeight: isCurrent ? 700 : 400, color: isCurrent ? m.color : '#6b7280' }}>
                {m.label.split(' ').slice(0, 2).join(' ')}
              </div>
            </div>
          );
        })}
        {(status === 'reprovado' || status === 'arquivado') && (
          <div style={{
            flex: '1 1 auto', minWidth: '70px', padding: '.4rem .3rem', textAlign: 'center',
            background: meta.color + '25', borderBottom: `3px solid ${meta.color}`,
            borderRadius: '4px 4px 0 0', fontSize: '.65rem',
          }}>
            <div>{meta.icon}</div>
            <div style={{ fontWeight: 700, color: meta.color }}>{meta.label}</div>
          </div>
        )}
      </div>

      {/* Ações */}
      {canEdit && nextStates.length > 0 && (
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {nextStates.map(ns => {
            const nm = STATUS_META[ns];
            return (
              <button key={ns} className="ext-btn-primary" disabled={changing}
                style={{ background: nm.color }}
                onClick={() => advanceStatus(ns)}>
                {nm.icon} {nm.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Histórico */}
      <h4 style={{ margin: '0 0 .75rem' }}>📜 Histórico de alterações</h4>
      {loading ? <p>Carregando...</p> : history.length === 0 ? (
        <p className="ext-empty">Nenhuma alteração registrada.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {history.map(h => (
            <div key={h.id} style={{
              padding: '.75rem', borderLeft: `3px solid ${STATUS_META[h.new_value as ReviewStatus]?.color || '#6b7280'}`,
              background: 'var(--bg-secondary, #f9fafb)', borderRadius: '0 6px 6px 0', fontSize: '.85rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {STATUS_META[h.old_value as ReviewStatus]?.icon} {STATUS_META[h.old_value as ReviewStatus]?.label || h.old_value}
                  {' → '}
                  <strong style={{ color: STATUS_META[h.new_value as ReviewStatus]?.color }}>
                    {STATUS_META[h.new_value as ReviewStatus]?.icon} {STATUS_META[h.new_value as ReviewStatus]?.label || h.new_value}
                  </strong>
                </span>
                <span style={{ color: '#9ca3af', fontSize: '.75rem' }}>{fmtDate(h.changed_at)}</span>
              </div>
              {h.reason && <p style={{ margin: '.25rem 0 0', color: '#4b5563' }}>💬 {h.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
