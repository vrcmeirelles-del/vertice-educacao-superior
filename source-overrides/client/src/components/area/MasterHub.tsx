/**
 * MasterHub.tsx — Painel master de primeiro nível
 * Hub que separa Universidades, Escolas, Financeiro e BI Vértice
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  onNavigate: (destination: 'universidades' | 'escolas' | 'financeiro' | 'bi-vertice' | 'configuracoes' | 'institution', institutionId?: string) => void;
}

interface GlobalKPIs {
  total_ies: number;
  total_escolas: number;
  total_alunos_ies: number;
  total_alunos_escolas: number;
  mrr_ies: number;
  mrr_escolas: number;
  contratos_ativos: number;
  trials_ativos: number;
}

interface Institution {
  id: string;
  name: string;
  tier: string;
  city: string | null;
  state: string | null;
  acronym: string | null;
  admin_dependency: string | null;
}

export default function MasterHub({ onNavigate }: Props) {
  const [kpis, setKpis] = useState<GlobalKPIs>({
    total_ies: 0, total_escolas: 0, total_alunos_ies: 0, total_alunos_escolas: 0,
    mrr_ies: 0, mrr_escolas: 0, contratos_ativos: 0, trials_ativos: 0,
  });
  const [recentIes, setRecentIes] = useState<Institution[]>([]);
  const [recentEscolas, setRecentEscolas] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Instituições
    const { data: institutions } = await supabase
      .from('vertice_institutions')
      .select('id, name, tier, city, state, acronym, admin_dependency')
      .eq('status', 'ativa')
      .order('name');

    const ies = (institutions || []).filter(i => i.tier === 'superior');
    const escolas = (institutions || []).filter(i => i.tier === 'escolas');

    setRecentIes(ies);
    setRecentEscolas(escolas);

    // Contratos
    const { data: contracts } = await supabase
      .from('vertice_contracts')
      .select('institution_id, status, package');

    const activeContracts = (contracts || []).filter(c => c.status === 'active' || c.status === 'ativo');
    const trialContracts = (contracts || []).filter(c => c.status === 'trial');

    // MRR por tier
    const { data: mrrData } = await supabase.from('v_mrr_by_tier').select('*');
    const mrrIes = mrrData?.find(m => m.tier === 'superior')?.mrr || 0;
    const mrrEscolas = mrrData?.find(m => m.tier === 'escolas')?.mrr || 0;

    // Alunos IES (último semestre de cada IES)
    const { data: iesStudents } = await supabase.rpc('simulate_pricing', { p_tier: 'superior', p_package: 'core', p_student_count: 0 }).maybeSingle();
    // Fallback: somar contratos
    const alunosIes = activeContracts.reduce((s, c) => s + ((c as any).student_count || 0), 0);

    // Alunos escolas (segmentos)
    const { data: segData } = await supabase.from('vertice_school_segments').select('classes_count, max_students_per_class').eq('active', true);
    const alunosEscolas = (segData || []).reduce((s, seg) => s + (seg.classes_count || 0) * (seg.max_students_per_class || 30), 0);

    setKpis({
      total_ies: ies.length,
      total_escolas: escolas.length,
      total_alunos_ies: alunosIes,
      total_alunos_escolas: alunosEscolas,
      mrr_ies: Number(mrrIes),
      mrr_escolas: Number(mrrEscolas),
      contratos_ativos: activeContracts.length,
      trials_ativos: trialContracts.length,
    });

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const HubCard = ({ icon, title, subtitle, color, badge, onClick }: {
    icon: string; title: string; subtitle: string; color: string; badge?: string; onClick: () => void;
  }) => (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      background: 'var(--bg-card, #fff)', borderRadius: 12, padding: '24px 20px',
      border: 'none', cursor: 'pointer', textAlign: 'left',
      boxShadow: '0 2px 8px rgba(0,0,0,.06)', transition: 'transform .15s, box-shadow .15s',
      borderLeft: `5px solid ${color}`, width: '100%',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.12)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, width: '100%' }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>{title}</span>
        {badge && <span style={{
          padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
          background: `${color}15`, color,
        }}>{badge}</span>}
      </div>
      <span style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>{subtitle}</span>
    </button>
  );

  const KPIChip = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
    <div style={{
      background: 'var(--bg-card, #fff)', borderRadius: 8, padding: '12px 16px',
      borderBottom: `3px solid ${color}`, textAlign: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );

  const InstitutionChip = ({ inst, onClick }: { inst: Institution; onClick: () => void }) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      background: 'var(--bg-card, #fff)', borderRadius: 8, border: '1px solid #eee',
      cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background .1s',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-card, #fff)'}
    >
      <span style={{ fontSize: 16 }}>{inst.tier === 'escolas' ? '🏫' : '🏛️'}</span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {inst.acronym || inst.name}
        </div>
        <div style={{ fontSize: 11, color: '#999' }}>{inst.city}/{inst.state}</div>
      </div>
      <span style={{ fontSize: 14, color: '#ccc' }}>→</span>
    </button>
  );

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#999', fontFamily: 'Inter, system-ui, sans-serif' }}>Carregando painel master...</div>;
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>
          Vértice
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
          Painel master · Educação Superior e Escolas
        </p>
      </div>

      {/* KPIs globais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 28 }}>
        <KPIChip label="Universidades" value={kpis.total_ies} color="#2563eb" />
        <KPIChip label="Escolas" value={kpis.total_escolas} color="#7c3aed" />
        <KPIChip label="MRR Total" value={`R$ ${(kpis.mrr_ies + kpis.mrr_escolas).toLocaleString('pt-BR')}`} color="#16a34a" />
        <KPIChip label="Alunos IES" value={kpis.total_alunos_ies.toLocaleString('pt-BR')} color="#16a34a" />
        <KPIChip label="Alunos Escolas" value={kpis.total_alunos_escolas.toLocaleString('pt-BR')} color="#0891b2" />
        <KPIChip label="Contratos" value={kpis.contratos_ativos} color="#ea580c" />
        <KPIChip label="Trials" value={kpis.trials_ativos} color="#0891b2" />
      </div>

      {/* Cards de navegação */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <HubCard
          icon="📊" title="BI Vértice" color="#16a34a"
          subtitle="Visão unificada da plataforma: receita, crescimento, indicadores, saúde dos clientes."
          onClick={() => onNavigate('bi-vertice')}
        />
        <HubCard
          icon="💰" title="Financeiro" color="#ea580c"
          subtitle="Contratos, faturas, MRR por tier, inadimplência, previsão de receita."
          badge={kpis.contratos_ativos > 0 ? `${kpis.contratos_ativos} contratos` : undefined}
          onClick={() => onNavigate('financeiro')}
        />
        <HubCard
          icon="🏛️" title="Universidades" color="#2563eb"
          subtitle="Gestão, regulação, BI acadêmico, ENADE, governança e compliance de IES."
          badge={kpis.total_ies > 0 ? `${kpis.total_ies} IES` : undefined}
          onClick={() => onNavigate('universidades')}
        />
        <HubCard
          icon="🏫" title="Escolas" color="#7c3aed"
          subtitle="Gestão escolar, ENEM, egressos, rematrícula, documentos e indicadores."
          badge={kpis.total_escolas > 0 ? `${kpis.total_escolas} escolas` : undefined}
          onClick={() => onNavigate('escolas')}
        />
        <HubCard
          icon="⚙️" title="Configurações" color="#4b5563"
          subtitle="Módulos, usuários, integrações, termos contratuais e catálogo da plataforma."
          onClick={() => onNavigate('configuracoes')}
        />
      </div>

      {/* Acesso rápido a instituições */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Universidades */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2563eb' }}>🏛️ Universidades</h3>
            {recentIes.length > 0 && (
              <button onClick={() => onNavigate('universidades')} style={{
                background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12,
              }}>Ver todas →</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentIes.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 12 }}>Nenhuma IES cadastrada</div>
            ) : recentIes.slice(0, 5).map(i => (
              <InstitutionChip key={i.id} inst={i} onClick={() => onNavigate('institution', i.id)} />
            ))}
          </div>
        </div>

        {/* Escolas */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>🏫 Escolas</h3>
            {recentEscolas.length > 0 && (
              <button onClick={() => onNavigate('escolas')} style={{
                background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: 12,
              }}>Ver todas →</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentEscolas.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 12 }}>Nenhuma escola cadastrada</div>
            ) : recentEscolas.slice(0, 5).map(i => (
              <InstitutionChip key={i.id} inst={i} onClick={() => onNavigate('institution', i.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
