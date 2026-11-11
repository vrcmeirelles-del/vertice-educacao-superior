// BillingPanel.tsx — Painel master de faturamento, contratos e MRR
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./billing-panel.css";

type View = 'dashboard' | 'contratos' | 'faturas' | 'modulos';

interface Contract {
  contract_id: string; contract_number: string; ies_name: string; package_code: string;
  contract_status: string; student_count: number; monthly_value: number;
  starts_at: string; trial_ends_at: string; min_commitment_ends_at: string;
  cancellation_effective_at: string;
  total_paid: number; total_pending: number; total_overdue: number;
  last_invoice: string; last_invoice_status: string; last_invoice_due: string;
}

interface Invoice {
  id: string; invoice_number: string; invoice_type: string; institution_id: string;
  subtotal: number; discount: number; total: number;
  issued_at: string; due_date: string; paid_at: string;
  status: string; payment_method: string; line_items: any[];
  contract_id: string;
}

interface MrrSummary {
  total_contracts: number; trials: number; active: number; cancelling: number;
  mrr_active: number; mrr_total: number; total_students: number; total_overdue: number;
}

const PKG = { essencial: 'Essencial', regulacao: 'Regulação', gestao360: 'Gestão 360°', completo: 'Completo' } as Record<string,string>;
const STATUS_COLOR: Record<string,string> = {
  draft:'#9ca3af', trial:'#8b5cf6', active:'#22c55e', suspended:'#ef4444',
  cancellation_pending:'#f59e0b', cancelled:'#6b7280', expired:'#374151',
  pending:'#f59e0b', paid:'#22c55e', overdue:'#ef4444', waived:'#8b5cf6', invoiced:'#3b82f6',
  refunded:'#06b6d4',
};
const STATUS_LABEL: Record<string,string> = {
  draft:'Rascunho', trial:'Trial', active:'Ativo', suspended:'Suspenso',
  cancellation_pending:'Cancelamento pendente', cancelled:'Cancelado', expired:'Expirado',
  pending:'Pendente', paid:'Pago', overdue:'Vencido', waived:'Isento (trial)', invoiced:'Faturado',
  refunded:'Reembolsado', mensalidade:'Mensalidade', implementacao:'Implementação',
  addon_ativacao:'Ativação add-on', upgrade:'Upgrade', avulso:'Avulso',
};

function Badge({ s }: { s: string }) {
  return <span className="bp-badge" style={{ background:(STATUS_COLOR[s]||'#888')+'18', color:STATUS_COLOR[s]||'#888' }}>{STATUS_LABEL[s]||s}</span>;
}
function fmtBRL(v: number|null) { return v==null?'—':'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function fmtDate(d: string|null) { return d?new Date(d).toLocaleDateString('pt-BR'):'—'; }

export default function BillingPanel() {
  const [view, setView] = useState<View>('dashboard');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [mrr, setMrr] = useState<MrrSummary|null>(null);
  const [loading, setLoading] = useState(true);

  // Novo contrato form
  const [showNewContract, setShowNewContract] = useState(false);
  const [institutions, setInstitutions] = useState<{id:string;name:string}[]>([]);
  const [newContract, setNewContract] = useState<any>({ package_code:'essencial', price_per_student:1.50, min_monthly:1500, max_monthly:null, student_count:0, implementation_fee:3000, with_trial:true });

  const load = useCallback(async () => {
    setLoading(true);
    const [c, i, m] = await Promise.all([
      supabase.from('v_billing_dashboard').select('*'),
      supabase.from('vertice_invoices').select('*').order('issued_at', { ascending: false }).limit(100),
      supabase.from('v_mrr_summary').select('*').single(),
    ]);
    setContracts((c.data||[]) as Contract[]);
    setInvoices((i.data||[]) as Invoice[]);
    setMrr(m.data as MrrSummary);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadInstitutions() {
    const { data } = await supabase.from('vertice_institutions').select('id,name').order('name');
    setInstitutions((data||[]) as {id:string;name:string}[]);
  }

  async function createContract() {
    const { data, error } = await supabase.rpc('create_contract', {
      p_institution_id: newContract.institution_id,
      p_package_code: newContract.package_code,
      p_price_per_student: newContract.price_per_student,
      p_min_monthly: newContract.min_monthly,
      p_max_monthly: newContract.max_monthly || null,
      p_student_count: newContract.student_count,
      p_implementation_fee: newContract.implementation_fee,
      p_with_trial: newContract.with_trial,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    setShowNewContract(false);
    load();
  }

  async function markPaid(invoiceId: string) {
    await supabase.rpc('register_payment', { p_invoice_id: invoiceId, p_payment_method: 'pix' });
    load();
  }

  if (loading) return <p className="bp-loading">Carregando dados financeiros...</p>;

  const totalPaid = contracts.reduce((s,c) => s + (c.total_paid||0), 0);
  const totalPending = contracts.reduce((s,c) => s + (c.total_pending||0), 0);
  const totalOverdue = contracts.reduce((s,c) => s + (c.total_overdue||0), 0);

  return (
    <div className="bp-container">
      <div className="bp-header">
        <h2>💰 Painel Financeiro</h2>
        <p>Contratos, faturamento e receita recorrente</p>
      </div>

      {/* MRR CARDS */}
      <div className="bp-mrr-grid">
        <div className="bp-mrr-card accent">
          <span className="bp-mrr-label">MRR Ativo</span>
          <strong>{fmtBRL(mrr?.mrr_active||0)}</strong>
          <small>{mrr?.active||0} contratos ativos</small>
        </div>
        <div className="bp-mrr-card">
          <span className="bp-mrr-label">MRR Total</span>
          <strong>{fmtBRL(mrr?.mrr_total||0)}</strong>
          <small>inclui {mrr?.cancelling||0} em cancelamento</small>
        </div>
        <div className="bp-mrr-card purple">
          <span className="bp-mrr-label">Trials</span>
          <strong>{mrr?.trials||0}</strong>
          <small>conversão pendente</small>
        </div>
        <div className="bp-mrr-card">
          <span className="bp-mrr-label">Total Alunos</span>
          <strong>{(mrr?.total_students||0).toLocaleString('pt-BR')}</strong>
          <small>base ativa</small>
        </div>
        <div className="bp-mrr-card green">
          <span className="bp-mrr-label">Recebido</span>
          <strong>{fmtBRL(totalPaid)}</strong>
        </div>
        <div className="bp-mrr-card warn">
          <span className="bp-mrr-label">A Receber</span>
          <strong>{fmtBRL(totalPending)}</strong>
        </div>
        <div className="bp-mrr-card danger">
          <span className="bp-mrr-label">Inadimplência</span>
          <strong>{fmtBRL(totalOverdue)}</strong>
        </div>
      </div>

      {/* TABS */}
      <div className="bp-tabs">
        {(['dashboard','contratos','faturas','modulos'] as View[]).map(v => (
          <button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>
            {v==='dashboard'?'Visão Geral':v==='contratos'?`Contratos (${contracts.length})`:v==='faturas'?`Faturas (${invoices.length})`:'Módulos & Pacotes'}
          </button>
        ))}
      </div>

      {/* CONTRATOS */}
      {(view==='dashboard'||view==='contratos') && (
        <div className="bp-section">
          <div className="bp-section-head">
            <h3>Contratos</h3>
            <button className="bp-add-btn" onClick={()=>{ setShowNewContract(true); loadInstitutions(); }}>+ Novo contrato</button>
          </div>

          {showNewContract && (
            <div className="bp-form">
              <h4>Novo Contrato</h4>
              <div className="bp-form-grid">
                <label>IES
                  <select value={newContract.institution_id||''} onChange={e=>setNewContract({...newContract,institution_id:e.target.value})}>
                    <option value="">Selecione...</option>
                    {institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </label>
                <label>Pacote
                  <select value={newContract.package_code} onChange={e=>setNewContract({...newContract,package_code:e.target.value})}>
                    <option value="essencial">Essencial</option>
                    <option value="regulacao">Regulação</option>
                    <option value="gestao360">Gestão 360°</option>
                    <option value="completo">Completo</option>
                  </select>
                </label>
                <label>R$/aluno<input type="number" step="0.01" value={newContract.price_per_student} onChange={e=>setNewContract({...newContract,price_per_student:+e.target.value})} /></label>
                <label>Piso mensal<input type="number" step="0.01" value={newContract.min_monthly} onChange={e=>setNewContract({...newContract,min_monthly:+e.target.value})} /></label>
                <label>Teto mensal<input type="number" step="0.01" value={newContract.max_monthly||''} onChange={e=>setNewContract({...newContract,max_monthly:e.target.value?+e.target.value:null})} placeholder="Sem teto" /></label>
                <label>Nº alunos<input type="number" value={newContract.student_count} onChange={e=>setNewContract({...newContract,student_count:+e.target.value})} /></label>
                <label>Implementação<input type="number" step="0.01" value={newContract.implementation_fee} onChange={e=>setNewContract({...newContract,implementation_fee:+e.target.value})} /></label>
                <label className="bp-checkbox"><input type="checkbox" checked={newContract.with_trial} onChange={e=>setNewContract({...newContract,with_trial:e.target.checked})} /> Trial 90 dias</label>
              </div>
              <div className="bp-form-preview">
                <strong>Previsão mensal:</strong> {fmtBRL(Math.max(newContract.min_monthly, newContract.price_per_student * newContract.student_count))}
                {newContract.with_trial && <span> · Mensalidade isenta por 90 dias</span>}
                {newContract.implementation_fee > 0 && <span> · Implementação: {fmtBRL(newContract.implementation_fee)}</span>}
              </div>
              <div className="bp-form-actions">
                <button className="bp-btn-save" onClick={createContract}>Criar contrato</button>
                <button className="bp-btn-cancel" onClick={()=>setShowNewContract(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {contracts.length===0 ? <p className="bp-empty">Nenhum contrato cadastrado.</p> : (
            <table className="bp-table">
              <thead><tr>
                <th>Contrato</th><th>IES</th><th>Pacote</th><th>Status</th>
                <th>Alunos</th><th>Mensalidade</th><th>Pago</th><th>Pendente</th><th>Vencido</th>
                <th>Início</th><th>Trial até</th>
              </tr></thead>
              <tbody>
                {contracts.map(c=>(
                  <tr key={c.contract_id}>
                    <td className="mono">{c.contract_number||'—'}</td>
                    <td><strong>{c.ies_name}</strong></td>
                    <td><span className="bp-pkg-badge">{PKG[c.package_code]||c.package_code}</span></td>
                    <td><Badge s={c.contract_status} /></td>
                    <td className="num">{c.student_count}</td>
                    <td className="num">{fmtBRL(c.monthly_value)}</td>
                    <td className="num green">{fmtBRL(c.total_paid)}</td>
                    <td className="num warn">{fmtBRL(c.total_pending)}</td>
                    <td className="num danger">{fmtBRL(c.total_overdue)}</td>
                    <td>{fmtDate(c.starts_at)}</td>
                    <td>{c.trial_ends_at ? fmtDate(c.trial_ends_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* FATURAS */}
      {(view==='dashboard'||view==='faturas') && (
        <div className="bp-section">
          <div className="bp-section-head">
            <h3>Faturas recentes</h3>
          </div>
          {invoices.length===0 ? <p className="bp-empty">Nenhuma fatura gerada.</p> : (
            <table className="bp-table">
              <thead><tr>
                <th>Nº</th><th>Tipo</th><th>Valor</th><th>Vencimento</th>
                <th>Status</th><th>Pagamento</th><th>Emissão</th><th></th>
              </tr></thead>
              <tbody>
                {(view==='dashboard'?invoices.slice(0,10):invoices).map(inv=>(
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoice_number}</td>
                    <td><Badge s={inv.invoice_type} /></td>
                    <td className="num">{fmtBRL(inv.total)}</td>
                    <td>{fmtDate(inv.due_date)}</td>
                    <td><Badge s={inv.status} /></td>
                    <td>{inv.paid_at ? fmtDate(inv.paid_at) + (inv.payment_method ? ' · '+inv.payment_method : '') : '—'}</td>
                    <td>{fmtDate(inv.issued_at)}</td>
                    <td>
                      {(inv.status==='pending'||inv.status==='overdue') && (
                        <button className="bp-pay-btn" onClick={()=>markPaid(inv.id)} title="Registrar pagamento">💰 Baixar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MÓDULOS & PACOTES */}
      {view==='modulos' && (
        <div className="bp-section">
          <h3>Pacotes comerciais</h3>
          <div className="bp-packages">
            {[
              { code:'essencial', name:'Essencial', price:'R$ 1,50/aluno', min:'R$ 1.500', impl:'R$ 3.000', modules:['Core','BI Institucional','BI por Curso'] },
              { code:'regulacao', name:'Regulação', price:'R$ 2,00/aluno', min:'R$ 1.800', impl:'R$ 5.000', modules:['+ Compliance','+ Biblioteca Regulatória','+ ENADE 360°','+ Novo Instrumento'] },
              { code:'gestao360', name:'Gestão 360°', price:'R$ 2,50/aluno', min:'R$ 2.000', impl:'R$ 8.000', modules:['+ Governança 360°','+ Inclusão/PEI','+ Egressos 360°','+ Acompanhamento Especial','+ Aquisições'] },
              { code:'completo', name:'Completo', price:'R$ 3,00/aluno', min:'R$ 2.500 (teto R$ 15.000)', impl:'R$ 12.000', modules:['+ Fato & Ordem','+ Sincronização','+ Todos os módulos'] },
            ].map(pkg=>(
              <div className="bp-package-card" key={pkg.code}>
                <h4>{pkg.name}</h4>
                <div className="bp-package-price">{pkg.price}</div>
                <div className="bp-package-detail">Piso: {pkg.min} · Impl.: {pkg.impl}</div>
                <ul>{pkg.modules.map((m,i)=><li key={i}>{m}</li>)}</ul>
                <div className="bp-package-count">
                  {contracts.filter(c=>c.package_code===pkg.code && c.contract_status!=='cancelled').length} contrato(s)
                </div>
              </div>
            ))}
          </div>

          <h3 style={{marginTop:'2rem'}}>Add-ons avulsos</h3>
          <p className="bp-muted">Módulos ativados individualmente via degustação (15 dias) com faturamento automático.</p>
          <div className="bp-addon-grid">
            {[
              { code:'GEST_GOVERNANCA', name:'Governança 360°', fee:'R$ 1.000/mês' },
              { code:'GEST_INCLUSAO', name:'Inclusão 360° · PEI', fee:'R$ 1.000/mês' },
              { code:'GEST_EGRESSOS', name:'Egressos 360°', fee:'R$ 1.000/mês' },
              { code:'GEST_ACOMPANHAMENTO', name:'Acompanhamento Especial', fee:'R$ 1.000/mês' },
              { code:'GEST_AQUISICOES', name:'Aquisições 360°', fee:'R$ 1.000/mês' },
              { code:'ADDON_FATO_ORDEM', name:'Fato & Ordem', fee:'R$ 2.000/mês' },
              { code:'AVANCADO_SYNC', name:'Central de Sincronização', fee:'R$ 1.500/mês' },
            ].map(a=>(
              <div className="bp-addon-item" key={a.code}>
                <strong>{a.name}</strong>
                <span>{a.fee}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
