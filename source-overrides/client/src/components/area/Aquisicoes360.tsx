import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
// Aquisicoes360.tsx — Módulo de Gestão de Aquisições
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./aquisicoes360.css";

type View = 'fornecedores' | 'requisicoes' | 'cotacoes' | 'ordens';

interface Supplier { id: string; name: string; cnpj: string; contact_name: string; contact_email: string; category: string; status: string; rating: number; }
interface PurchaseRequest { id: string; request_number: string; requester_name: string; department: string; description: string; category: string; quantity: number; unit: string; estimated_total: number; justification: string; urgency: string; status: string; approved_by: string; created_at: string; }
interface Quotation { id: string; request_id: string; supplier_name: string; unit_price: number; total_price: number; delivery_days: number; payment_conditions: string; is_winner: boolean; quoted_at: string; }
interface PurchaseOrder { id: string; order_number: string; description: string; quantity: number; unit_price: number; total_price: number; status: string; expected_delivery: string; received_at: string; payment_status: string; issued_at: string; }

const STATUS_COLORS: Record<string, string> = {
  pendente: '#f59e0b', em_cotacao: '#3b82f6', aprovada: '#22c55e', reprovada: '#ef4444',
  em_compra: '#8b5cf6', entregue: '#10b981', cancelada: '#6b7280',
  emitida: '#3b82f6', enviada: '#f59e0b', confirmada: '#8b5cf6', em_transito: '#06b6d4',
  recebida: '#22c55e', paga: '#10b981',
  ativo: '#22c55e', inativo: '#6b7280', bloqueado: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente', em_cotacao: 'Em Cotação', aprovada: 'Aprovada', reprovada: 'Reprovada',
  em_compra: 'Em Compra', entregue: 'Entregue', cancelada: 'Cancelada',
  emitida: 'Emitida', enviada: 'Enviada', confirmada: 'Confirmada', em_transito: 'Em Trânsito',
  recebida: 'Recebida', paga: 'Paga',
  ativo: 'Ativo', inativo: 'Inativo', bloqueado: 'Bloqueado',
};

function Badge({ status }: { status: string }) {
  return <span className="aq-badge" style={{ background: (STATUS_COLORS[status] || '#888') + '18', color: STATUS_COLORS[status] || '#888' }}>
    {STATUS_LABELS[status] || status}
  </span>;
}

function fmtBRL(v: number | null) {
  if (v == null) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function Aquisicoes360({ institutionId, role }: { institutionId: string; role: string }) {
  const [view, setView] = useState<View>('requisicoes');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [s, r, q, o] = await Promise.all([
      supabase.from('vertice_suppliers').select('*').eq('institution_id', institutionId).order('name'),
      supabase.from('vertice_purchase_requests').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('vertice_quotations').select('*').eq('institution_id', institutionId).order('quoted_at', { ascending: false }),
      supabase.from('vertice_purchase_orders').select('*').eq('institution_id', institutionId).order('issued_at', { ascending: false }),
    ]);
    setSuppliers((s.data || []) as Supplier[]);
    setRequests((r.data || []) as PurchaseRequest[]);
    setQuotations((q.data || []) as Quotation[]);
    setOrders((o.data || []) as PurchaseOrder[]);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const canEdit = role === 'master' || role === 'gestor';

  // KPIs
  const pendentes = requests.filter(r => r.status === 'pendente').length;
  const emAndamento = requests.filter(r => ['em_cotacao', 'aprovada', 'em_compra'].includes(r.status)).length;
  const totalOrdens = orders.reduce((s, o) => s + (o.total_price || 0), 0);
  const entregues = orders.filter(o => o.status === 'recebida' || o.status === 'paga').length;

  async function saveSupplier() {
    const payload = { ...formData, institution_id: institutionId };
    if (payload.id) {
      await supabase.from('vertice_suppliers').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      await supabase.from('vertice_suppliers').insert(payload);
    }
    setShowForm(false); setFormData({}); load();
  }

  async function saveRequest() {
    const payload = {
      ...formData,
      institution_id: institutionId,
      request_number: formData.request_number || ('REQ-' + Date.now().toString(36).toUpperCase()),
      estimated_total: (formData.quantity || 0) * (formData.estimated_unit_price || 0),
    };
    if (payload.id) {
      await supabase.from('vertice_purchase_requests').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      await supabase.from('vertice_purchase_requests').insert(payload);
    }
    setShowForm(false); setFormData({}); load();
  }

  return (
    <div className="aq-container">
      <div className="aq-header">
        <div>
          <h2>Aquisições 360°<ContextHelp title="Aquisições 360°" /></h2>
          <p>Gestão de compras, fornecedores, cotações e ordens de compra</p>
        </div>
      </div>

      <div className="aq-kpis">
        <div className="aq-kpi"><strong>{suppliers.length}</strong><span>Fornecedores</span></div>
        <div className="aq-kpi warn"><strong>{pendentes}</strong><span>Requisições pendentes</span></div>
        <div className="aq-kpi info"><strong>{emAndamento}</strong><span>Em andamento</span></div>
        <div className="aq-kpi"><strong>{orders.length}</strong><span>Ordens emitidas</span></div>
        <div className="aq-kpi success"><strong>{entregues}</strong><span>Entregues</span></div>
        <div className="aq-kpi"><strong>{fmtBRL(totalOrdens)}</strong><span>Total em ordens</span></div>
      </div>

      <div className="aq-tabs">
        {(['requisicoes', 'fornecedores', 'cotacoes', 'ordens'] as View[]).map(v => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => { setView(v); setShowForm(false); }}>
            {v === 'requisicoes' ? `Requisições (${requests.length})` :
             v === 'fornecedores' ? `Fornecedores (${suppliers.length})` :
             v === 'cotacoes' ? `Cotações (${quotations.length})` :
             `Ordens de Compra (${orders.length})`}
          </button>
        ))}
      </div>

      {loading ? <p className="aq-loading">Carregando dados...</p> : (
        <>
          {/* REQUISIÇÕES */}
          {view === 'requisicoes' && (
            <div className="aq-section">
              {canEdit && <button className="aq-add-btn" onClick={() => { setFormData({ urgency: 'normal', status: 'pendente', unit: 'un' }); setShowForm(true); }}>+ Nova requisição</button>}
              {showForm && (
                <div className="aq-form">
                  <h3>{formData.id ? 'Editar' : 'Nova'} Requisição</h3>
                  <div className="aq-form-grid">
                    <HelpLabel>Solicitante<input value={formData.requester_name || ''} onChange={e => setFormData({ ...formData, requester_name: e.target.value })} /></HelpLabel>
                    <HelpLabel>Setor<input value={formData.department || ''} onChange={e => setFormData({ ...formData, department: e.target.value })} /></HelpLabel>
                    <HelpLabel>Descrição<input value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></HelpLabel>
                    <HelpLabel>Categoria<input value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Ex: material_didatico, TI" /></HelpLabel>
                    <HelpLabel>Qtd<input type="number" value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Unidade<input value={formData.unit || 'un'} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></HelpLabel>
                    <HelpLabel>Preço unitário estimado<input type="number" step="0.01" value={formData.estimated_unit_price || ''} onChange={e => setFormData({ ...formData, estimated_unit_price: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Urgência
                      <select value={formData.urgency || 'normal'} onChange={e => setFormData({ ...formData, urgency: e.target.value })}>
                        <option value="baixa">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                        <option value="emergencial">Emergencial</option>
                      </select>
                    </HelpLabel>
                  </div>
                  <HelpLabel className="aq-form-full">Justificativa<textarea value={formData.justification || ''} onChange={e => setFormData({ ...formData, justification: e.target.value })} rows={3} /></HelpLabel>
                  <div className="aq-form-actions">
                    <button className="aq-btn-save" onClick={saveRequest}>Salvar</button>
                    <button className="aq-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {requests.length === 0 ? <p className="aq-empty">Nenhuma requisição registrada.</p> : (
                <table className="aq-table">
                  <thead><tr><th>Nº</th><th>Descrição</th><th>Solicitante</th><th>Setor</th><th>Urgência</th><th>Estimativa</th><th>Status</th><th>Data</th></tr></thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id} className={canEdit ? 'clickable' : ''} onClick={() => { if (canEdit) { setFormData(r); setShowForm(true); } }}>
                        <td className="mono">{r.request_number}</td>
                        <td>{r.description}</td>
                        <td>{r.requester_name}</td>
                        <td>{r.department}</td>
                        <td><Badge status={r.urgency} /></td>
                        <td className="num">{fmtBRL(r.estimated_total)}</td>
                        <td><Badge status={r.status} /></td>
                        <td>{fmtDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* FORNECEDORES */}
          {view === 'fornecedores' && (
            <div className="aq-section">
              {canEdit && <button className="aq-add-btn" onClick={() => { setFormData({ status: 'ativo' }); setShowForm(true); }}>+ Novo fornecedor</button>}
              {showForm && (
                <div className="aq-form">
                  <h3>{formData.id ? 'Editar' : 'Novo'} Fornecedor</h3>
                  <div className="aq-form-grid">
                    <HelpLabel>Nome/Razão Social<input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></HelpLabel>
                    <HelpLabel>CNPJ<input value={formData.cnpj || ''} onChange={e => setFormData({ ...formData, cnpj: e.target.value })} /></HelpLabel>
                    <HelpLabel>Contato<input value={formData.contact_name || ''} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} /></HelpLabel>
                    <HelpLabel>E-mail<input value={formData.contact_email || ''} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} /></HelpLabel>
                    <HelpLabel>Telefone<input value={formData.contact_phone || ''} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} /></HelpLabel>
                    <HelpLabel>Categoria<input value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="material_didatico, servicos, TI" /></HelpLabel>
                  </div>
                  <div className="aq-form-actions">
                    <button className="aq-btn-save" onClick={saveSupplier}>Salvar</button>
                    <button className="aq-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {suppliers.length === 0 ? <p className="aq-empty">Nenhum fornecedor cadastrado.</p> : (
                <table className="aq-table">
                  <thead><tr><th>Nome</th><th>CNPJ<ContextHelp title="CNPJ" /></th><th>Contato</th><th>E-mail<ContextHelp title="E-mail" /></th><th>Categoria</th><th>Status</th></tr></thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id} className={canEdit ? 'clickable' : ''} onClick={() => { if (canEdit) { setFormData(s); setShowForm(true); } }}>
                        <td><strong>{s.name}</strong></td>
                        <td className="mono">{s.cnpj || '—'}</td>
                        <td>{s.contact_name || '—'}</td>
                        <td>{s.contact_email || '—'}</td>
                        <td>{s.category || '—'}</td>
                        <td><Badge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* COTAÇÕES */}
          {view === 'cotacoes' && (
            <div className="aq-section">
              {quotations.length === 0 ? <p className="aq-empty">Nenhuma cotação registrada. Cotações são vinculadas a requisições aprovadas.</p> : (
                <table className="aq-table">
                  <thead><tr><th>Fornecedor</th><th>Preço Unit.</th><th>Total</th><th>Prazo Entrega</th><th>Condições</th><th>Vencedora</th><th>Data</th></tr></thead>
                  <tbody>
                    {quotations.map(q => (
                      <tr key={q.id} className={q.is_winner ? 'winner' : ''}>
                        <td><strong>{q.supplier_name}</strong></td>
                        <td className="num">{fmtBRL(q.unit_price)}</td>
                        <td className="num">{fmtBRL(q.total_price)}</td>
                        <td>{q.delivery_days ? `${q.delivery_days} dias` : '—'}</td>
                        <td>{q.payment_conditions || '—'}</td>
                        <td>{q.is_winner ? '✅ Sim' : '—'}</td>
                        <td>{fmtDate(q.quoted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ORDENS DE COMPRA */}
          {view === 'ordens' && (
            <div className="aq-section">
              {orders.length === 0 ? <p className="aq-empty">Nenhuma ordem de compra emitida. Ordens são geradas a partir de cotações vencedoras.</p> : (
                <table className="aq-table">
                  <thead><tr><th>Nº</th><th>Descrição</th><th>Qtd</th><th>Total</th><th>Status</th><th>Entrega Prevista</th><th>Recebido</th><th>Pagamento</th></tr></thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td className="mono">{o.order_number}</td>
                        <td>{o.description}</td>
                        <td className="num">{o.quantity}</td>
                        <td className="num">{fmtBRL(o.total_price)}</td>
                        <td><Badge status={o.status} /></td>
                        <td>{fmtDate(o.expected_delivery)}</td>
                        <td>{fmtDate(o.received_at)}</td>
                        <td><Badge status={o.payment_status} /></td>
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
