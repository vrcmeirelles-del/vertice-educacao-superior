/**
 * VerticeBI.tsx — BI unificado da plataforma Vértice
 * Visão cross-tier: Universidades + Escolas
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  onBack: () => void;
}

interface TierSummary {
  tier: string;
  institutions: number;
  contracts: number;
  mrr: number;
  avg_ticket: number;
  trials: number;
  modules_active: number;
}

interface Institution {
  id: string;
  name: string;
  tier: string;
  acronym: string | null;
  city: string | null;
  state: string | null;
}

export default function VerticeBI({ onBack }: Props) {
  const [tiers, setTiers] = useState<TierSummary[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [docHealth, setDocHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const [instRes, contractRes, modulesRes, docRes] = await Promise.all([
      supabase.from('vertice_institutions').select('id, name, tier, acronym, city, state').eq('status', 'ativa'),
      supabase.from('vertice_contracts').select('institution_id, status, package'),
      supabase.from('vertice_module_activations').select('institution_id, module_code, status'),
      supabase.from('v_doc_health').select('*'),
    ]);

    const insts = instRes.data || [];
    setInstitutions(insts);

    const contracts = contractRes.data || [];
    const modules = modulesRes.data || [];
    if (docRes.data) setDocHealth(docRes.data);

    // Agrupar por tier
    const tierMap: Record<string, TierSummary> = {};
    for (const tier of ['superior', 'escolas']) {
      const tierInsts = insts.filter(i => i.tier === tier);
      const tierContracts = contracts.filter(c =>
        tierInsts.some(i => i.id === c.institution_id) && (c.status === 'active' || c.status === 'ativo')
      );
      const tierTrials = contracts.filter(c =>
        tierInsts.some(i => i.id === c.institution_id) && c.status === 'trial'
      );
      const tierModules = modules.filter(m =>
        tierInsts.some(i => i.id === m.institution_id) && (m.status === 'ativo' || m.status === 'active')
      );

      tierMap[tier] = {
        tier,
        institutions: tierInsts.length,
        contracts: tierContracts.length,
        mrr: 0, // virá da view quando tiver dados de billing
        avg_ticket: 0,
        trials: tierTrials.length,
        modules_active: tierModules.length,
      };
    }
    setTiers(Object.values(tierMap));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalInst = tiers.reduce((s, t) => s + t.institutions, 0);
  const totalContracts = tiers.reduce((s, t) => s + t.contracts, 0);
  const totalModules = tiers.reduce((s, t) => s + t.modules_active, 0);
  const totalMRR = tiers.reduce((s, t) => s + t.mrr, 0);

  const totalDocs = docHealth.reduce((s, d) => s + (d.total_docs || 0), 0);
  const totalExpired = docHealth.reduce((s, d) => s + (d.expired_docs || 0), 0);
  const totalFindings = docHealth.reduce((s, d) => s + (d.open_findings || 0), 0);
  const avgCompliance = docHealth.filter(d => d.avg_compliance_score).length > 0
    ? docHealth.reduce((s, d) => s + (d.avg_compliance_score || 0), 0) / docHealth.filter(d => d.avg_compliance_score).length
    : null;

  const KPI = ({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) => (
    <div style={{
      background: 'var(--bg-card, #fff)', borderRadius: 10, padding: '16px 14px',
      borderLeft: `4px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const TierCard = ({ t }: { t: TierSummary }) => (
    <div style={{
      background: 'var(--bg-card, #fff)', borderRadius: 10, padding: 20,
      borderTop: `4px solid ${t.tier === 'superior' ? '#2563eb' : '#7c3aed'}`,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{t.tier === 'superior' ? '🏛️' : '🏫'}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {t.tier === 'superior' ? 'Educação Superior' : 'Escolas'}
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Instituições</div><div style={{ fontSize: 20, fontWeight: 700 }}>{t.institutions}</div></div>
        <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Contratos</div><div style={{ fontSize: 20, fontWeight: 700 }}>{t.contracts}</div></div>
        <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Trials</div><div style={{ fontSize: 20, fontWeight: 700, color: '#0891b2' }}>{t.trials}</div></div>
        <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Módulos ativos</div><div style={{ fontSize: 20, fontWeight: 700 }}>{t.modules_active}</div></div>
        <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>MRR</div><div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>R$ {t.mrr.toLocaleString('pt-BR')}</div></div>
        <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>Ticket médio</div><div style={{ fontSize: 20, fontWeight: 700 }}>R$ {t.avg_ticket.toLocaleString('pt-BR')}</div></div>
      </div>
    </div>
  );

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>Carregando BI Vértice...</div>;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#2563eb' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a2e' }}>BI Vértice</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Visão unificada da plataforma</p>
        </div>
      </div>

      {/* KPIs globais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
        <KPI label="Instituições" value={totalInst} color="#333" sub={`${tiers.find(t=>t.tier==='superior')?.institutions||0} IES · ${tiers.find(t=>t.tier==='escolas')?.institutions||0} escolas`} />
        <KPI label="MRR Total" value={`R$ ${totalMRR.toLocaleString('pt-BR')}`} color="#16a34a" />
        <KPI label="Contratos" value={totalContracts} color="#ea580c" />
        <KPI label="Módulos ativos" value={totalModules} color="#2563eb" />
        <KPI label="Documentos" value={totalDocs} color="#7c3aed" sub={totalExpired > 0 ? `${totalExpired} vencidos` : 'Todos em dia'} />
        <KPI label="Score IA médio" value={avgCompliance ? avgCompliance.toFixed(0) : '—'} color={avgCompliance && avgCompliance >= 70 ? '#16a34a' : '#ca8a04'} />
        <KPI label="Achados abertos" value={totalFindings} color={totalFindings > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      {/* Cards por tier */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {tiers.map(t => <TierCard key={t.tier} t={t} />)}
      </div>

      {/* Todas as instituições */}
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#666' }}>
        Todas as instituições ({institutions.length})
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>INSTITUIÇÃO</th>
            <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>TIPO</th>
            <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>CIDADE/UF</th>
            <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>DOCS</th>
            <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>SCORE IA</th>
          </tr>
        </thead>
        <tbody>
          {institutions.map(i => {
            const dh = docHealth.find(d => d.institution_id === i.id);
            return (
              <tr key={i.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                  {i.tier === 'escolas' ? '🏫' : '🏛️'} {i.acronym || i.name}
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: i.tier === 'superior' ? '#dbeafe' : '#ede9fe',
                    color: i.tier === 'superior' ? '#2563eb' : '#7c3aed',
                  }}>{i.tier === 'superior' ? 'IES' : 'Escola'}</span>
                </td>
                <td style={{ padding: '8px 6px', color: '#666' }}>{i.city}/{i.state}</td>
                <td style={{ padding: '8px 6px' }}>{dh?.total_docs ?? 0}</td>
                <td style={{ padding: '8px 6px', fontWeight: 700, color: dh?.avg_compliance_score >= 70 ? '#16a34a' : dh?.avg_compliance_score ? '#ca8a04' : '#999' }}>
                  {dh?.avg_compliance_score?.toFixed(0) ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
