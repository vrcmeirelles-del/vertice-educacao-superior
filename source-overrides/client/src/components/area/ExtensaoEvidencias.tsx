/**
 * ExtensaoEvidencias — Repositório de evidências com versionamento
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Evidence {
  id: string; title: string; document_type: string; project_id: string;
  file_name: string; mime_type: string; file_size_bytes: number;
  version: number; is_current: boolean; validation_status: string;
  validated_by: string | null; validated_at: string | null; rejection_reason: string | null;
  period: string; tags: string[]; notes: string;
  uploaded_by: string; uploaded_at: string;
}

const DOC_LABELS: Record<string, string> = {
  relatorio_execucao: '📄 Relatório de Execução', relatorio_parcial: '📄 Relatório Parcial',
  relatorio_final: '📄 Relatório Final', lista_presenca: '📋 Lista de Presença',
  registro_fotografico: '📸 Registro Fotográfico', artigo: '📝 Artigo',
  publicacao: '📚 Publicação', certificado: '🏆 Certificado',
  termo_parceria: '🤝 Termo de Parceria', avaliacao_comunidade: '👥 Avaliação da Comunidade',
  plano_ensino: '📖 Plano de Ensino', ata: '📜 Ata',
  formulario: '📋 Formulário', questionario: '❓ Questionário', outro: '📎 Outro',
};

const VALIDATION_LABELS: Record<string, string> = {
  pendente: '⏳ Pendente', em_analise: '🔍 Em Análise',
  aprovada: '✅ Aprovada', rejeitada: '❌ Rejeitada', revisao_solicitada: '🔄 Revisão Solicitada',
};
const VALIDATION_COLORS: Record<string, string> = {
  pendente: '#f59e0b', em_analise: '#3b82f6',
  aprovada: '#22c55e', rejeitada: '#ef4444', revisao_solicitada: '#8b5cf6',
};

export default function ExtensaoEvidencias({
  institutionId, projectId, projectTitle, canEdit, onClose,
}: {
  institutionId: string;
  projectId?: string;
  projectTitle?: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('vertice_extension_evidence_registry')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('is_current', true)
      .order('uploaded_at', { ascending: false });
    if (projectId) q = q.eq('project_id', projectId);
    const { data } = await q;
    setEvidences(data || []);
    setLoading(false);
  }, [institutionId, projectId]);

  useEffect(() => { load(); }, [load]);

  const updateValidation = async (id: string, status: string, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const update: any = { validation_status: status, validated_by: user.id, validated_at: new Date().toISOString() };
    if (reason) update.rejection_reason = reason;
    const { error } = await supabase.from('vertice_extension_evidence_registry').update(update).eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else load();
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtSize = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  const filtered = evidences.filter(e =>
    (filterType === 'todos' || e.document_type === filterType) &&
    (filterStatus === 'todos' || e.validation_status === filterStatus)
  );

  // KPIs
  const total = evidences.length;
  const aprovadas = evidences.filter(e => e.validation_status === 'aprovada').length;
  const pendentes = evidences.filter(e => e.validation_status === 'pendente').length;

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📁 Evidências{projectTitle ? ` — ${projectTitle}` : ''}</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{total}</span>
          <span className="ext-stat-label">Documentos</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#22c55e' }}>{aprovadas}</span>
          <span className="ext-stat-label">Aprovados</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#f59e0b' }}>{pendentes}</span>
          <span className="ext-stat-label">Pendentes</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(VALIDATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <p>Carregando...</p> : filtered.length === 0 ? (
        <p className="ext-empty">Nenhuma evidência encontrada.</p>
      ) : (
        <table className="ext-table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Título</th><th>Arquivo</th><th>Versão</th><th>Status</th>{canEdit && <th>Ações</th>}</tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id}>
                <td>{fmtDate(e.uploaded_at)}</td>
                <td>{DOC_LABELS[e.document_type] || e.document_type}</td>
                <td><strong>{e.title}</strong>{e.notes && <><br /><small style={{ color: '#6b7280' }}>{e.notes}</small></>}</td>
                <td><small>{e.file_name}<br />{fmtSize(e.file_size_bytes)}</small></td>
                <td className="num">v{e.version}</td>
                <td>
                  <span style={{ color: VALIDATION_COLORS[e.validation_status] }}>
                    {VALIDATION_LABELS[e.validation_status] || e.validation_status}
                  </span>
                  {e.rejection_reason && <><br /><small style={{ color: '#ef4444' }}>{e.rejection_reason}</small></>}
                </td>
                {canEdit && (
                  <td>
                    {e.validation_status === 'pendente' && <>
                      <button className="ext-btn-small" onClick={() => updateValidation(e.id, 'em_analise')}>Analisar</button>
                    </>}
                    {e.validation_status === 'em_analise' && <>
                      <button className="ext-btn-small" style={{ marginRight: '.25rem' }} onClick={() => updateValidation(e.id, 'aprovada')}>✅</button>
                      <button className="ext-btn-small" onClick={() => {
                        const reason = prompt('Motivo da rejeição:');
                        if (reason) updateValidation(e.id, 'rejeitada', reason);
                      }}>❌</button>
                    </>}
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
