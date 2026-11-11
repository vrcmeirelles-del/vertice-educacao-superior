// BillingPanel.tsx — Painel master de faturamento, contratos e MRR
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./billing-panel.css";

type View = 'dashboard' | 'contratos' | 'faturas' | 'modulos';

interface Contract {
  contract_id: string; contract_number: string; ies_name: string; package_code: string;
  contract_status: string; student_count: number; monthly_value: number;
  discount_percent: number; is_courtesy: boolean; courtesy_reason: string; custom_monthly: number;
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

const PKG = { essencial: 'Essencial', regulacao: 'Regulação', gestao360: 'Gestão 360°', completo: 'Completo', core: 'Essencial (Escolas)', pedagogico: 'Pedagógico', captacao: 'Captação', acompanhamento: 'Acompanhamento', governanca: 'Governança 360' } as Record<string,string>;

interface PkgPricing {
  tier: string; package: string; package_label: string;
  monthly_floor: string; setup_fee: string; addon_activation: string; addon_monthly: string;
  sort_order: number; per_student?: number;
}

const PKG_PER_STUDENT: Record<string, number> = {
  essencial: 1.50, regulacao: 2.00, gestao360: 2.50, completo: 3.00,
  core: 1.50, pedagogico: 1.20, captacao: 1.00, acompanhamento: 1.00, governanca: 0.80,
};

const PKG_MODULES: Record<string, string[]> = {
  essencial: ['Core', 'BI Institucional', 'BI por Curso', 'Gestão Documental', 'Central de Sincronização'],
  regulacao: ['+ Compliance', '+ Biblioteca Regulatória', '+ ENADE 360°', '+ Novo Instrumento', '+ Repositório'],
  gestao360: ['+ Governança 360°', '+ Metas 5W2H', '+ Resultado por Curso', '+ Simulador de Custo', '+ Aquisições'],
  completo: ['+ Inclusão/PEI', '+ Egressos 360°', '+ Acomp. Especial', '+ Captação BI', '+ Fato & Ordem', '+ Todos os módulos'],
  core: ['Cadastro', 'Integrações', 'Usuários', 'Gestão Documental', 'Central de Sincronização', 'Painel Financeiro'],
  pedagogico: ['+ BI Direção', '+ Indicadores IDEB/SAEB', '+ BI Coordenação', '+ ENEM & Vestibular'],
  captacao: ['+ Captação de Matrículas', '+ Rematrícula', '+ Comunicação com Famílias'],
  acompanhamento: ['+ Inclusão & PEI', '+ Orientação Educacional', '+ Egressos'],
  governanca: ['+ Governança Escolar (PPP, Regimento)', '+ Censo Escolar & MEC'],
};

const PKG_TETO: Record<string, string|null> = { completo: 'R$ 15.000' };
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

export default function BillingPanel({ tierFilter }: { tierFilter?: string }) {
  const [view, setView] = useState<View>('dashboard');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [mrr, setMrr] = useState<MrrSummary|null>(null);
  const [loading, setLoading] = useState(true);

  // Novo contrato form
  const [showNewContract, setShowNewContract] = useState(false);
  const [institutions, setInstitutions] = useState<{id:string;name:string;tier?:string}[]>([]);
  const [pkgPricing, setPkgPricing] = useState<PkgPricing[]>([]);
  const [newContract, setNewContract] = useState<any>({ package_code:'essencial', price_per_student:1.50, min_monthly:1500, max_monthly:null, student_count:0, implementation_fee:3000, with_trial:true });

  // Negociação
  const [editingContract, setEditingContract] = useState<string|null>(null);
  const [nego, setNego] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [c, i, m] = await Promise.all([
      tierFilter
        ? supabase.from('v_billing_dashboard').select('*').eq('tier', tierFilter)
        : supabase.from('v_billing_dashboard').select('*'),
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
    let q = supabase.from('vertice_institutions').select('id,name,tier').order('name');
    if (tierFilter) q = q.eq('tier', tierFilter);
    const [inst, pr] = await Promise.all([
      q,
      supabase.from('vertice_package_pricing').select('*').order('sort_order'),
    ]);
    setInstitutions((inst.data||[]) as {id:string;name:string;tier?:string}[]);
    setPkgPricing((pr.data||[]) as PkgPricing[]);
  }

  function applyPackageDefaults(pkgCode: string) {
    const pr = pkgPricing.find(p => p.package === pkgCode);
    const perStudent = PKG_PER_STUDENT[pkgCode] ?? 1.50;
    const floor = pr ? Number(pr.monthly_floor) : 1500;
    const impl = pr ? Number(pr.setup_fee) : 3000;
    setNewContract((prev: any) => ({ ...prev, package_code: pkgCode, price_per_student: perStudent, min_monthly: floor, implementation_fee: impl, max_monthly: PKG_TETO[pkgCode] ? 15000 : null }));
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

  function startNegotiation(c: Contract) {
    setEditingContract(c.contract_id);
    setNego({
      discount_percent: c.discount_percent || 0,
      discount_reason: '',
      custom_monthly: c.custom_monthly || '',
      is_courtesy: c.is_courtesy || false,
      courtesy_reason: c.courtesy_reason || '',
      courtesy_expires_at: '',
      negotiation_notes: '',
    });
  }

  async function saveNegotiation() {
    if (!editingContract) return;
    const updates: any = {
      discount_percent: nego.discount_percent || 0,
      is_courtesy: nego.is_courtesy || false,
      updated_at: new Date().toISOString(),
    };
    if (nego.discount_reason) updates.discount_reason = nego.discount_reason;
    if (nego.custom_monthly) updates.custom_monthly = +nego.custom_monthly;
    else updates.custom_monthly = null;
    if (nego.courtesy_reason) updates.courtesy_reason = nego.courtesy_reason;
    if (nego.courtesy_expires_at) updates.courtesy_expires_at = nego.courtesy_expires_at;
    if (nego.negotiation_notes) updates.negotiation_notes = nego.negotiation_notes;

    await supabase.from('vertice_contracts').update(updates).eq('id', editingContract);
    setEditingContract(null);
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
                  <select value={newContract.package_code} onChange={e=>applyPackageDefaults(e.target.value)}>
                    <optgroup label="Educação Superior">
                      <option value="essencial">Essencial</option>
                      <option value="regulacao">Regulação</option>
                      <option value="gestao360">Gestão 360°</option>
                      <option value="completo">Completo</option>
                    </optgroup>
                    <optgroup label="Escolas">
                      <option value="core">Essencial (Escolas)</option>
                      <option value="pedagogico">Pedagógico</option>
                      <option value="captacao">Captação</option>
                      <option value="acompanhamento">Acompanhamento</option>
                      <option value="governanca">Governança 360</option>
                    </optgroup>
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
                <th>Alunos</th><th>Mensalidade</th><th>Negociação</th><th>Pago</th><th>Vencido</th>
                <th></th>
              </tr></thead>
              <tbody>
                {contracts.map(c=>(
                  <tr key={c.contract_id}>
                    <td className="mono">{c.contract_number||'—'}</td>
                    <td><strong>{c.ies_name}</strong></td>
                    <td><span className="bp-pkg-badge">{PKG[c.package_code]||c.package_code}</span></td>
                    <td><Badge s={c.contract_status} /></td>
                    <td className="num">{c.student_count}</td>
                    <td className="num">
                      {c.is_courtesy ? <span className="bp-courtesy-badge">🤝 Cortesia</span> : fmtBRL(c.monthly_value)}
                      {!c.is_courtesy && c.discount_percent > 0 && <small className="bp-discount"> -{c.discount_percent}%</small>}
                      {!c.is_courtesy && c.custom_monthly && <small className="bp-custom"> (negociado)</small>}
                    </td>
                    <td>
                      {c.is_courtesy && <span className="bp-nego-tag cortesia" title={c.courtesy_reason||''}>🤝 {c.courtesy_reason||'Cortesia'}</span>}
                      {!c.is_courtesy && c.discount_percent > 0 && <span className="bp-nego-tag desconto">-{c.discount_percent}%</span>}
                      {!c.is_courtesy && !c.discount_percent && !c.custom_monthly && <span className="bp-nego-tag padrao">Tabela</span>}
                      {!c.is_courtesy && c.custom_monthly && <span className="bp-nego-tag custom">{fmtBRL(c.custom_monthly)}</span>}
                    </td>
                    <td className="num green">{fmtBRL(c.total_paid)}</td>
                    <td className="num danger">{fmtBRL(c.total_overdue)}</td>
                    <td><button className="bp-nego-btn" onClick={()=>startNegotiation(c)} title="Negociar valores">⚙️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* PAINEL DE NEGOCIAÇÃO */}
          {editingContract && (
            <div className="bp-nego-panel">
              <h4>⚙️ Negociação — {contracts.find(c=>c.contract_id===editingContract)?.ies_name}</h4>
              <div className="bp-form-grid">
                <label className="bp-checkbox">
                  <input type="checkbox" checked={nego.is_courtesy} onChange={e=>setNego({...nego, is_courtesy:e.target.checked, discount_percent: e.target.checked ? 0 : nego.discount_percent})} />
                  <strong>🤝 Cortesia total (R$ 0)</strong>
                </label>
                {nego.is_courtesy && (
                  <>
                    <label>Motivo da cortesia *
                      <input value={nego.courtesy_reason} onChange={e=>setNego({...nego,courtesy_reason:e.target.value})} placeholder="Ex: Pró-reitoria de extensão, parceria institucional" />
                    </label>
                    <label>Cortesia válida até (opcional)
                      <input type="date" value={nego.courtesy_expires_at} onChange={e=>setNego({...nego,courtesy_expires_at:e.target.value})} />
                    </label>
                  </>
                )}
                {!nego.is_courtesy && (
                  <>
                    <label>Desconto (%)
                      <input type="number" step="0.5" min="0" max="100" value={nego.discount_percent} onChange={e=>setNego({...nego,discount_percent:+e.target.value})} />
                    </label>
                    <label>Motivo do desconto
                      <input value={nego.discount_reason||''} onChange={e=>setNego({...nego,discount_reason:e.target.value})} placeholder="Ex: Negociação direta, fidelização" />
                    </label>
                    <label>Valor mensal fixo negociado (opcional)
                      <input type="number" step="0.01" value={nego.custom_monthly||''} onChange={e=>setNego({...nego,custom_monthly:e.target.value})} placeholder="Deixe vazio para usar o cálculo padrão" />
                    </label>
                  </>
                )}
                <label className="bp-form-full-w">Anotações da negociação
                  <textarea value={nego.negotiation_notes||''} onChange={e=>setNego({...nego,negotiation_notes:e.target.value})} rows={2} placeholder="Registro interno — não aparece no contrato" />
                </label>
              </div>
              <div className="bp-form-actions">
                <button className="bp-btn-save" onClick={saveNegotiation}>Salvar negociação</button>
                <button className="bp-btn-cancel" onClick={()=>setEditingContract(null)}>Cancelar</button>
              </div>
            </div>
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
          {(['superior','escolas'] as const).map(tier => {
            const tierLabel = tier === 'superior' ? '🏛️ Educação Superior' : '🏫 Escolas';
            const tierPkgs = tier === 'superior'
              ? ['essencial','regulacao','gestao360','completo']
              : ['core','pedagogico','captacao','acompanhamento','governanca'];
            const tierContracts = contracts.filter(c => tierPkgs.includes(c.package_code));
            const tierColors: Record<string,string> = tier === 'superior'
              ? { essencial:'#2563eb', regulacao:'#059669', gestao360:'#7c3aed', completo:'#d97706' }
              : { core:'#2563eb', pedagogico:'#16a34a', captacao:'#ca8a04', acompanhamento:'#db2777', governanca:'#6d28d9' };
            return (
              <div key={tier} style={{marginBottom:'2rem'}}>
                <h3>{tierLabel}</h3>
                <div className="bp-packages">
                  {tierPkgs.map(code => {
                    const pr = pkgPricing.find(p => p.package === code && p.tier === tier);
                    const perStudent = PKG_PER_STUDENT[code] ?? 1.50;
                    const floor = pr ? Number(pr.monthly_floor) : 0;
                    const impl = pr ? Number(pr.setup_fee) : 0;
                    const teto = PKG_TETO[code];
                    const mods = PKG_MODULES[code] ?? [];
                    const color = tierColors[code] ?? '#6b7280';
                    const count = tierContracts.filter(c => c.package_code === code && c.contract_status !== 'cancelled').length;
                    return (
                      <div className="bp-package-card" key={code} style={{borderTopColor: color}}>
                        <h4 style={{color}}>{PKG[code] ?? code}</h4>
                        <div className="bp-package-price" style={{color}}>R$ {perStudent.toFixed(2).replace('.',',')}/aluno</div>
                        <div className="bp-package-detail">
                          Piso: R$ {floor.toLocaleString('pt-BR')}{teto ? ` (teto ${teto})` : ''} · Impl.: R$ {impl.toLocaleString('pt-BR')}
                        </div>
                        <ul>{mods.map((m,i) => <li key={i}>{m}</li>)}</ul>
                        <div className="bp-package-count">{count} contrato(s)</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

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
