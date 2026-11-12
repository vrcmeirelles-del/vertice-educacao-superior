/**
 * ExtensaoParceiros — Gestão de parceiros externos
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Partner {
  id: string; name: string; partner_type: string; cnpj_cpf: string;
  contact_name: string; contact_email: string; contact_phone: string;
  address: string; territory: string; agreement_type: string;
  active: boolean; created_at: string;
}

interface ProjectPartner {
  id: string; project_id: string; partner_id: string;
  role_in_project: string; contribution: string;
}

const TYPE_LABELS: Record<string, string> = {
  organizacao: '🏢 Organização', empresa: '🏭 Empresa', governo: '🏛️ Governo',
  ong: '🤝 ONG', comunidade: '👥 Comunidade', pessoa_fisica: '👤 Pessoa Física',
};

export default function ExtensaoParceiros({
  institutionId, canEdit, onClose,
}: {
  institutionId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projectLinks, setProjectLinks] = useState<ProjectPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', partner_type: 'organizacao', contact_name: '',
    contact_email: '', contact_phone: '', territory: '', agreement_type: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [p, links] = await Promise.all([
      supabase.from('vertice_extension_partners').select('*').eq('institution_id', institutionId).order('name'),
      supabase.from('vertice_extension_project_partners').select('*'),
    ]);
    setPartners(p.data || []);
    setProjectLinks(links.data || []);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const savePartner = async () => {
    if (!formData.name.trim()) return alert('Nome obrigatório.');
    const { error } = await supabase.from('vertice_extension_partners').insert({
      institution_id: institutionId, ...formData,
    });
    if (error) return alert('Erro: ' + error.message);
    setShowForm(false);
    setFormData({ name: '', partner_type: 'organizacao', contact_name: '', contact_email: '', contact_phone: '', territory: '', agreement_type: '' });
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('vertice_extension_partners').update({ active: !active }).eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else load();
  };

  const projectCount = (partnerId: string) => projectLinks.filter(l => l.partner_id === partnerId).length;

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🤝 Parceiros Externos</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{partners.length}</span>
          <span className="ext-stat-label">Total</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#22c55e' }}>{partners.filter(p => p.active).length}</span>
          <span className="ext-stat-label">Ativos</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{new Set(partners.map(p => p.partner_type)).size}</span>
          <span className="ext-stat-label">Tipos</span>
        </div>
      </div>

      {canEdit && (
        <button className="ext-btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowForm(true)}>
          + Novo parceiro
        </button>
      )}

      {showForm && (
        <div className="ext-form">
          <h3>Novo parceiro</h3>
          <div className="ext-form-grid">
            <label>Nome *
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </label>
            <label>Tipo
              <select value={formData.partner_type} onChange={e => setFormData({ ...formData, partner_type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Contato
              <input value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} placeholder="Nome do responsável" />
            </label>
            <label>E-mail
              <input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} />
            </label>
            <label>Telefone
              <input value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} />
            </label>
            <label>Território
              <input value={formData.territory} onChange={e => setFormData({ ...formData, territory: e.target.value })} placeholder="Bairro, cidade ou região" />
            </label>
            <label>Tipo de acordo
              <input value={formData.agreement_type} onChange={e => setFormData({ ...formData, agreement_type: e.target.value })} placeholder="Convênio, termo, carta..." />
            </label>
          </div>
          <div className="ext-form-actions">
            <button className="ext-btn-save" onClick={savePartner}>Salvar</button>
            <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p>Carregando...</p> : partners.length === 0 ? (
        <p className="ext-empty">Nenhum parceiro cadastrado.</p>
      ) : (
        <table className="ext-table">
          <thead>
            <tr><th>Nome</th><th>Tipo</th><th>Contato</th><th>Território</th><th>Projetos</th><th>Status</th>{canEdit && <th>Ação</th>}</tr>
          </thead>
          <tbody>
            {partners.map(p => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                <td><strong>{p.name}</strong></td>
                <td>{TYPE_LABELS[p.partner_type] || p.partner_type}</td>
                <td>{p.contact_name || '—'}<br /><small>{p.contact_email || ''}</small></td>
                <td>{p.territory || '—'}</td>
                <td className="num">{projectCount(p.id)}</td>
                <td>{p.active ? <span style={{ color: '#22c55e' }}>Ativo</span> : <span style={{ color: '#6b7280' }}>Inativo</span>}</td>
                {canEdit && (
                  <td>
                    <button className="ext-btn-small" onClick={() => toggleActive(p.id, p.active)}>
                      {p.active ? 'Desativar' : 'Ativar'}
                    </button>
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
