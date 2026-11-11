// ContractView.tsx — Visualização e assinatura digital do contrato
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./contract-view.css";

interface ContractData {
  id: string; contract_number: string; package_code: string; status: string;
  price_per_student: number; min_monthly: number; max_monthly: number;
  student_count: number; monthly_value: number; implementation_fee: number;
  discount_percent: number; custom_monthly: number; is_courtesy: boolean; courtesy_reason: string;
  starts_at: string; trial_ends_at: string; min_commitment_ends_at: string;
  cooling_off_expires_at: string; signed_at: string;
}

interface Terms {
  id: string; version: string; billing_entity_name: string; billing_entity_cnpj: string;
  billing_entity_address: string; preamble: string;
  clause_object: string; clause_packages: string; clause_pricing: string;
  clause_trial: string; clause_cancellation: string; clause_downgrade: string;
  clause_lgpd: string; clause_data_students: string; clause_data_faculty: string;
  clause_image_rights: string; clause_consumer_rights: string; clause_sla: string;
  clause_ip: string; clause_confidentiality: string; clause_liability: string;
  clause_termination: string; clause_jurisdiction: string;
}

interface Signature {
  id: string; signer_name: string; signer_email: string; signer_role: string;
  accepted_at: string; ip_address: string; document_hash: string;
  email_confirmed_at: string;
}

const PKG: Record<string,string> = { essencial:'Essencial', regulacao:'Regulação', gestao360:'Gestão 360°', completo:'Completo' };
function fmtBRL(v: number|null) { return v==null?'—':'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function fmtDate(d: string|null) { return d?new Date(d).toLocaleDateString('pt-BR'):'—'; }

const CLAUSE_ORDER: { key: string; title: string; num: number }[] = [
  { key:'clause_object', title:'Do Objeto', num:1 },
  { key:'clause_packages', title:'Dos Pacotes e Módulos', num:2 },
  { key:'clause_pricing', title:'Dos Preços e Faturamento', num:3 },
  { key:'clause_trial', title:'Do Período de Avaliação (Trial)', num:4 },
  { key:'clause_cancellation', title:'Do Cancelamento e Direito de Arrependimento', num:5 },
  { key:'clause_downgrade', title:'Da Migração de Pacote (Downgrade)', num:6 },
  { key:'clause_lgpd', title:'Da Proteção de Dados Pessoais (LGPD)', num:7 },
  { key:'clause_data_students', title:'Dos Dados Pessoais de Alunos', num:8 },
  { key:'clause_data_faculty', title:'Dos Dados de Docentes e Colaboradores', num:9 },
  { key:'clause_image_rights', title:'Dos Direitos de Imagem', num:10 },
  { key:'clause_consumer_rights', title:'Dos Direitos do Consumidor (CDC)', num:11 },
  { key:'clause_sla', title:'Do Nível de Serviço (SLA)', num:12 },
  { key:'clause_ip', title:'Da Propriedade Intelectual', num:13 },
  { key:'clause_confidentiality', title:'Do Sigilo e Confidencialidade', num:14 },
  { key:'clause_liability', title:'Da Responsabilidade', num:15 },
  { key:'clause_termination', title:'Da Rescisão', num:16 },
  { key:'clause_jurisdiction', title:'Do Foro', num:17 },
];

export default function ContractView({ contractId, institutionId, institutionName, role }: {
  contractId?: string; institutionId: string; institutionName: string; role: string;
}) {
  const [contract, setContract] = useState<ContractData|null>(null);
  const [terms, setTerms] = useState<Terms|null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);

  // Sign form
  const [showSign, setShowSign] = useState(false);
  const [signForm, setSignForm] = useState({ name:'', email:'', cpf:'', role:'diretor' });
  const [signing, setSigning] = useState(false);
  const [signResult, setSignResult] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Buscar contrato da IES
    let q = supabase.from('vertice_contracts').select('*').eq('institution_id', institutionId);
    if (contractId) q = q.eq('id', contractId);
    const { data: contracts } = await q.order('created_at', { ascending: false }).limit(1);
    if (contracts?.length) setContract(contracts[0] as ContractData);

    // Buscar termos ativos
    const { data: termsData } = await supabase.from('vertice_contract_terms').select('*').eq('is_active', true).order('published_at', { ascending: false }).limit(1);
    if (termsData?.length) setTerms(termsData[0] as Terms);

    // Buscar assinaturas
    if (contracts?.length) {
      const { data: sigs } = await supabase.from('vertice_contract_signatures').select('*').eq('contract_id', contracts[0].id).order('accepted_at', { ascending: false });
      setSignatures((sigs||[]) as Signature[]);
    }
    setLoading(false);
  }, [contractId, institutionId]);

  useEffect(() => { load(); }, [load]);

  async function signContract() {
    if (!contract || !signForm.name || !signForm.email) return;
    setSigning(true);
    try {
      const { data, error } = await supabase.rpc('sign_contract_digitally', {
        p_contract_id: contract.id,
        p_signer_name: signForm.name,
        p_signer_email: signForm.email,
        p_signer_cpf: signForm.cpf || null,
        p_signer_role: signForm.role,
        p_ip_address: '0.0.0.0',  // será substituído pela Edge Function
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      setSignResult(data);
      load();
    } catch (e: any) {
      setSignResult({ error: e.message });
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <p className="cv-loading">Carregando contrato...</p>;
  if (!contract) return <p className="cv-empty">Nenhum contrato encontrado para esta instituição. O contrato será criado pelo administrador da plataforma.</p>;
  if (!terms) return <p className="cv-empty">Termos contratuais não disponíveis.</p>;

  const isSigned = signatures.length > 0;

  return (
    <div className="cv-container">
      {/* HEADER */}
      <div className="cv-header">
        <div className="cv-header-logo">VÉRTICE</div>
        <div>
          <h2>Contrato de Prestação de Serviços</h2>
          <p>Plataforma Vértice Educação Superior</p>
        </div>
        <div className="cv-header-meta">
          <span>Contrato nº <strong>{contract.contract_number || '—'}</strong></span>
          <span>Versão dos termos: <strong>{terms.version}</strong></span>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className={`cv-status-bar ${contract.status}`}>
        <span className="cv-status-dot"></span>
        <span>
          {contract.status === 'draft' && 'Rascunho — aguardando assinatura'}
          {contract.status === 'trial' && `Trial ativo — grátis até ${fmtDate(contract.trial_ends_at)}`}
          {contract.status === 'active' && 'Contrato ativo'}
          {contract.status === 'suspended' && 'Contrato suspenso por inadimplência'}
          {contract.status === 'cancellation_pending' && 'Cancelamento solicitado'}
          {contract.status === 'cancelled' && 'Contrato cancelado'}
        </span>
        {isSigned && <span className="cv-signed-badge">✅ Assinado digitalmente</span>}
      </div>

      {/* RESUMO COMERCIAL */}
      <div className="cv-summary">
        <h3>Resumo do Contrato</h3>
        <div className="cv-summary-grid">
          <div><label>Contratante (IES)</label><strong>{institutionName}</strong></div>
          <div><label>Contratada</label><strong>{terms.billing_entity_name}</strong></div>
          <div><label>Pacote</label><strong>{PKG[contract.package_code]}</strong></div>
          <div><label>Valor por aluno</label><strong>{fmtBRL(contract.price_per_student)}</strong></div>
          <div><label>Nº de alunos</label><strong>{contract.student_count}</strong></div>
          <div><label>Mensalidade</label><strong className="cv-highlight">
            {contract.is_courtesy ? '🤝 Cortesia' : fmtBRL(contract.monthly_value)}
            {!contract.is_courtesy && contract.discount_percent > 0 && <small style={{color:'#16a34a',marginLeft:4}}>(-{contract.discount_percent}%)</small>}
          </strong></div>
          {contract.is_courtesy && <div><label>Condição especial</label><strong style={{color:'#1d4ed8'}}>{contract.courtesy_reason || 'Parceria institucional'}</strong></div>}
          {!contract.is_courtesy && contract.custom_monthly > 0 && <div><label>Valor negociado</label><strong style={{color:'#7c3aed'}}>{fmtBRL(contract.custom_monthly)}</strong></div>}
          <div><label>Piso mensal</label><strong>{fmtBRL(contract.min_monthly)}</strong></div>
          <div><label>Teto mensal</label><strong>{contract.max_monthly ? fmtBRL(contract.max_monthly) : 'Sem teto'}</strong></div>
          <div><label>Implementação</label><strong>{fmtBRL(contract.implementation_fee)}</strong></div>
          <div><label>Início</label><strong>{fmtDate(contract.starts_at)}</strong></div>
          <div><label>Trial até</label><strong>{contract.trial_ends_at ? fmtDate(contract.trial_ends_at) : 'Sem trial'}</strong></div>
          <div><label>Carência mínima até</label><strong>{fmtDate(contract.min_commitment_ends_at)}</strong></div>
          <div><label>Arrependimento até</label><strong>{fmtDate(contract.cooling_off_expires_at)}</strong></div>
        </div>
      </div>

      {/* CORPO DO CONTRATO */}
      <div className="cv-body">
        <div className="cv-preamble">{terms.preamble}</div>

        {CLAUSE_ORDER.map(({ key, title, num }) => (
          <div className="cv-clause" key={key}>
            <h4>Cláusula {num}ª — {title}</h4>
            <div className="cv-clause-text">{(terms as any)[key]}</div>
          </div>
        ))}

        <div className="cv-clause">
          <h4>Cláusula 18ª — Das Disposições Finais</h4>
          <div className="cv-clause-text">
            As partes declaram ter lido e compreendido integralmente este contrato, concordando com todos os seus termos.
            A assinatura eletrônica deste contrato tem validade jurídica nos termos da Lei 14.063/2020 (Marco Legal da Assinatura Eletrônica),
            sendo o aceite digital registrado com captura de IP, timestamp, hash SHA-256 do documento e identificação do signatário.
          </div>
        </div>

        <p className="cv-location-date">
          Palmas/TO, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* ASSINATURAS EXISTENTES */}
      {signatures.length > 0 && (
        <div className="cv-signatures">
          <h3>Assinaturas digitais</h3>
          {signatures.map(sig => (
            <div className="cv-sig-card" key={sig.id}>
              <div className="cv-sig-icon">✍️</div>
              <div>
                <strong>{sig.signer_name}</strong>
                <span className="cv-sig-role">{sig.signer_role === 'diretor' ? 'Diretor(a)' : sig.signer_role === 'reitor' ? 'Reitor(a)' : sig.signer_role}</span>
                <small>{sig.signer_email}</small>
              </div>
              <div className="cv-sig-meta">
                <span>{new Date(sig.accepted_at).toLocaleString('pt-BR')}</span>
                <span className="cv-sig-hash" title={sig.document_hash}>SHA-256: {sig.document_hash?.slice(0, 16)}...</span>
                {sig.email_confirmed_at
                  ? <span className="cv-sig-confirmed">✅ E-mail confirmado</span>
                  : <span className="cv-sig-pending">⏳ Confirmação pendente</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BOTÃO ASSINAR */}
      {!isSigned && contract.status !== 'cancelled' && (
        <div className="cv-sign-section">
          {!showSign ? (
            <button className="cv-sign-btn" onClick={() => setShowSign(true)}>
              ✍️ Assinar contrato digitalmente
            </button>
          ) : signResult?.success ? (
            <div className="cv-sign-success">
              <h3>✅ Contrato assinado com sucesso!</h3>
              <p>Hash: <code>{signResult.document_hash}</code></p>
              <p>Versão dos termos: {signResult.terms_version}</p>
              <p>{signResult.legal_notice}</p>
              <p>Um e-mail de confirmação será enviado para <strong>{signForm.email}</strong>.</p>
            </div>
          ) : (
            <div className="cv-sign-form">
              <h3>Assinatura Digital — Lei 14.063/2020</h3>
              <p className="cv-sign-notice">
                Ao assinar, você declara ter lido e compreendido integralmente este contrato.
                Seu aceite será registrado com captura de IP, timestamp e hash SHA-256 do documento.
              </p>
              <div className="cv-sign-fields">
                <label>Nome completo do signatário *
                  <input value={signForm.name} onChange={e => setSignForm({...signForm, name: e.target.value})} placeholder="Nome como consta no documento" />
                </label>
                <label>E-mail institucional *
                  <input type="email" value={signForm.email} onChange={e => setSignForm({...signForm, email: e.target.value})} placeholder="email@ies.edu.br" />
                </label>
                <label>CPF (opcional)
                  <input value={signForm.cpf} onChange={e => setSignForm({...signForm, cpf: e.target.value})} placeholder="000.000.000-00" />
                </label>
                <label>Cargo/Função
                  <select value={signForm.role} onChange={e => setSignForm({...signForm, role: e.target.value})}>
                    <option value="diretor">Diretor(a)</option>
                    <option value="reitor">Reitor(a)</option>
                    <option value="procurador">Procurador(a)</option>
                    <option value="representante_legal">Representante Legal</option>
                  </select>
                </label>
              </div>
              <label className="cv-sign-check">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
                <span>Li e aceito integralmente os termos deste contrato, incluindo as cláusulas de proteção de dados (LGPD), direitos de imagem, SLA, propriedade intelectual e foro de Palmas/TO.</span>
              </label>
              {signResult?.error && <p className="cv-sign-error">⚠ {signResult.error}</p>}
              <div className="cv-sign-actions">
                <button className="cv-sign-confirm" onClick={signContract} disabled={!accepted || !signForm.name || !signForm.email || signing}>
                  {signing ? 'Assinando...' : '✍️ Confirmar assinatura'}
                </button>
                <button className="cv-sign-cancel" onClick={() => { setShowSign(false); setSignResult(null); }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
