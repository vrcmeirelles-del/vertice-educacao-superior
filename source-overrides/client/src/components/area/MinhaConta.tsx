// MinhaConta.tsx — Painel financeiro da IES (visão do cliente)
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getModuleCatalog, type CatalogModule } from "@/lib/modules";
import "./minha-conta.css";

interface ContractData {
  id: string; contract_number: string; package_code: string; status: string;
  price_per_student: number; min_monthly: number; max_monthly: number;
  student_count: number; monthly_value: number; implementation_fee: number;
  discount_percent: number; custom_monthly: number; is_courtesy: boolean; courtesy_reason: string;
  starts_at: string; trial_ends_at: string; min_commitment_ends_at: string;
  cooling_off_expires_at: string; signed_at: string;
}

interface Invoice {
  id: string; invoice_number: string; invoice_type: string;
  subtotal: number; discount: number; total: number;
  issued_at: string; due_date: string; paid_at: string;
  status: string; payment_method: string; line_items: any[];
}

const PKG: Record<string,string> = { essencial:'Essencial', regulacao:'Regulação', gestao360:'Gestão 360°', completo:'Completo' };
const STATUS_COLOR: Record<string,string> = {
  draft:'#9ca3af', trial:'#8b5cf6', active:'#22c55e', suspended:'#ef4444',
  cancellation_pending:'#f59e0b', cancelled:'#6b7280',
  pending:'#f59e0b', paid:'#22c55e', overdue:'#ef4444', waived:'#8b5cf6',
  mensalidade:'#3b82f6', implementacao:'#8b5cf6', addon_ativacao:'#f59e0b',
};
const STATUS_LABEL: Record<string,string> = {
  draft:'Rascunho', trial:'Trial', active:'Ativo', suspended:'Suspenso',
  cancellation_pending:'Cancelamento pendente', cancelled:'Cancelado',
  pending:'Pendente', paid:'Pago', overdue:'Vencida', waived:'Isenta (trial)',
  mensalidade:'Mensalidade', implementacao:'Implementação', addon_ativacao:'Ativação',
};

function Badge({ s }: { s: string }) {
  return <span className="mc-badge" style={{ background:(STATUS_COLOR[s]||'#888')+'18', color:STATUS_COLOR[s]||'#888' }}>{STATUS_LABEL[s]||s}</span>;
}
function fmtBRL(v: number|null) { return v==null?'—':'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function fmtDate(d: string|null) { return d?new Date(d).toLocaleDateString('pt-BR'):'—'; }

export default function MinhaConta({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const [contract, setContract] = useState<ContractData|null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, i] = await Promise.all([
      supabase.from('vertice_contracts').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(1),
      supabase.from('vertice_invoices').select('*').eq('institution_id', institutionId).order('issued_at', { ascending: false }).limit(50),
    ]);
    if (c.data?.length) setContract(c.data[0] as ContractData);
    setInvoices((i.data||[]) as Invoice[]);
    const mods = await getModuleCatalog(institutionId);
    setModules(mods);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="mc-loading">Carregando dados da sua conta...</p>;

  const activeModules = modules.filter(m => m.display_status === 'active');
  const tastingModules = modules.filter(m => m.display_status === 'tasting');
  const lockedModules = modules.filter(m => m.display_status === 'locked');
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);

  // Trial countdown
  const trialDays = contract?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(contract.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="mc-container">
      <div className="mc-header">
        <h2>Minha Conta</h2>
        <p>{institutionName}</p>
      </div>

      {!contract ? (
        <div className="mc-no-contract">
          <span className="mc-no-icon">📋</span>
          <h3>Nenhum contrato ativo</h3>
          <p>Sua instituição ainda não possui um contrato com a Vértice. Entre em contato para iniciar o trial de 90 dias.</p>
          <a className="mc-btn primary" href="/contato.html?frente=plataforma">Solicitar trial gratuito</a>
        </div>
      ) : (
        <>
          {/* STATUS DO CONTRATO */}
          <div className={`mc-status-card ${contract.status}`}>
            <div className="mc-status-main">
              <div className="mc-status-dot"></div>
              <div>
                <strong>
                  {contract.status === 'trial' && `Trial ativo — ${trialDays} dia${trialDays !== 1 ? 's' : ''} restante${trialDays !== 1 ? 's' : ''}`}
                  {contract.status === 'active' && 'Contrato ativo'}
                  {contract.status === 'suspended' && 'Contrato suspenso — regularize o pagamento'}
                  {contract.status === 'cancellation_pending' && 'Cancelamento solicitado'}
                  {contract.status === 'cancelled' && 'Contrato cancelado'}
                  {contract.status === 'draft' && 'Contrato em elaboração'}
                </strong>
                <small>Contrato nº {contract.contract_number} · Pacote {PKG[contract.package_code]}</small>
              </div>
            </div>
            {contract.status === 'trial' && contract.trial_ends_at && (
              <div className="mc-trial-bar">
                <div className="mc-trial-progress" style={{ width: `${Math.max(5, 100 - (trialDays / 90) * 100)}%` }}></div>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="mc-kpis">
            <div className="mc-kpi">
              <span className="mc-kpi-label">Pacote</span>
              <strong className="mc-kpi-pkg">{PKG[contract.package_code]}</strong>
            </div>
            <div className="mc-kpi">
              <span className="mc-kpi-label">Mensalidade</span>
              <strong>{contract.is_courtesy ? '🤝 Cortesia' : fmtBRL(contract.monthly_value)}</strong>
              {!contract.is_courtesy && contract.discount_percent > 0 && <small className="mc-discount">-{contract.discount_percent}% desconto</small>}
            </div>
            <div className="mc-kpi">
              <span className="mc-kpi-label">Alunos</span>
              <strong>{contract.student_count.toLocaleString('pt-BR')}</strong>
            </div>
            <div className="mc-kpi">
              <span className="mc-kpi-label">Módulos ativos</span>
              <strong>{activeModules.length + tastingModules.length}</strong>
              {tastingModules.length > 0 && <small className="mc-tasting-note">{tastingModules.length} em degustação</small>}
            </div>
            <div className="mc-kpi">
              <span className="mc-kpi-label">Total pago</span>
              <strong className="mc-green">{fmtBRL(totalPaid)}</strong>
            </div>
            <div className="mc-kpi">
              <span className="mc-kpi-label">Em aberto</span>
              <strong className={totalPending > 0 ? 'mc-warn' : ''}>{fmtBRL(totalPending)}</strong>
            </div>
          </div>

          {/* MÓDULOS */}
          <div className="mc-section">
            <h3>Módulos contratados</h3>
            <div className="mc-modules-grid">
              {activeModules.map(m => (
                <div className="mc-mod active" key={m.code}>
                  <span className="mc-mod-icon">✅</span>
                  <div><strong>{m.name}</strong><small>{m.description}</small></div>
                </div>
              ))}
              {tastingModules.map(m => {
                const daysLeft = m.tasting_ends ? Math.max(0, Math.ceil((new Date(m.tasting_ends).getTime() - Date.now()) / 86400000)) : 0;
                return (
                  <div className="mc-mod tasting" key={m.code}>
                    <span className="mc-mod-icon">🎯</span>
                    <div>
                      <strong>{m.name}</strong>
                      <small>Degustação · {daysLeft} dia{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}</small>
                      <small className="mc-mod-fee">Após: R$ {(m.addon_monthly_fee || m.estimated_monthly_fee).toLocaleString('pt-BR')}/mês</small>
                    </div>
                  </div>
                );
              })}
            </div>

            {lockedModules.length > 0 && (
              <>
                <h4 className="mc-available-title">Módulos disponíveis para ativação</h4>
                <div className="mc-modules-grid">
                  {lockedModules.slice(0, 8).map(m => (
                    <div className="mc-mod locked" key={m.code}>
                      <span className="mc-mod-icon">🔒</span>
                      <div>
                        <strong>{m.name}</strong>
                        <small>{m.description}</small>
                        <small className="mc-mod-fee">R$ {m.estimated_monthly_fee.toLocaleString('pt-BR')}/mês · 15 dias grátis</small>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mc-muted">Clique em qualquer módulo 🔒 no painel para experimentar 15 dias grátis.</p>
              </>
            )}
          </div>

          {/* UPGRADE */}
          {contract.package_code !== 'completo' && (
            <div className="mc-upgrade">
              <div>
                <strong>💡 Faça upgrade do seu pacote</strong>
                <p>
                  {contract.package_code === 'essencial' && 'Com o Regulação, você ganha COMPLY, ENADE 360° e Biblioteca Regulatória INEP.'}
                  {contract.package_code === 'regulacao' && 'Com o Gestão 360°, você ganha Governança, Egressos, Inclusão, Aquisições e 5W2H.'}
                  {contract.package_code === 'gestao360' && 'Com o Completo, você ganha Fato & Ordem, Captação BI, Modo TV e todos os módulos futuros.'}
                  {' '}Módulos incluídos no novo pacote ativam sem custo adicional.
                </p>
              </div>
              <a className="mc-btn primary" href="/contato.html?frente=upgrade">Solicitar upgrade</a>
            </div>
          )}

          {/* FATURAS */}
          <div className="mc-section">
            <h3>Faturas</h3>
            {invoices.length === 0 ? (
              <p className="mc-empty">Nenhuma fatura gerada ainda.{contract.status === 'trial' && ' Durante o trial, a mensalidade é isenta.'}</p>
            ) : (
              <table className="mc-table">
                <thead><tr>
                  <th>Nº da fatura</th><th>Tipo</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Pagamento</th>
                </tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="mono">{inv.invoice_number}</td>
                      <td><Badge s={inv.invoice_type} /></td>
                      <td className="num">{fmtBRL(inv.total)}</td>
                      <td>{fmtDate(inv.due_date)}</td>
                      <td><Badge s={inv.status} /></td>
                      <td>{inv.paid_at ? fmtDate(inv.paid_at) + (inv.payment_method ? ' · ' + inv.payment_method.toUpperCase() : '') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* DADOS DO CONTRATO */}
          <div className="mc-section mc-contract-summary">
            <h3>Dados do contrato</h3>
            <div className="mc-contract-grid">
              <div><span>Contrato</span><strong>{contract.contract_number}</strong></div>
              <div><span>Pacote</span><strong>{PKG[contract.package_code]}</strong></div>
              <div><span>Início</span><strong>{fmtDate(contract.starts_at)}</strong></div>
              <div><span>Assinado em</span><strong>{contract.signed_at ? fmtDate(contract.signed_at) : 'Pendente'}</strong></div>
              <div><span>Valor/aluno</span><strong>{fmtBRL(contract.price_per_student)}</strong></div>
              <div><span>Piso mensal</span><strong>{fmtBRL(contract.min_monthly)}</strong></div>
              {contract.max_monthly && <div><span>Teto mensal</span><strong>{fmtBRL(contract.max_monthly)}</strong></div>}
              <div><span>Implementação</span><strong>{fmtBRL(contract.implementation_fee)}</strong></div>
              {contract.trial_ends_at && <div><span>Trial até</span><strong>{fmtDate(contract.trial_ends_at)}</strong></div>}
              <div><span>Carência até</span><strong>{fmtDate(contract.min_commitment_ends_at)}</strong></div>
              {contract.is_courtesy && <div><span>Condição especial</span><strong className="mc-courtesy">🤝 {contract.courtesy_reason || 'Cortesia'}</strong></div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
