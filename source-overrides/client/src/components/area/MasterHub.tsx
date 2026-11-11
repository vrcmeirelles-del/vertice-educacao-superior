/**
 * MasterHub.tsx — Painel master de primeiro nível
 * Hub que separa Universidades, Escolas, Financeiro e BI Vértice
 */
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { experienceApi, type ExperienceInvite, type ExperienceRole } from '@/lib/experience-access';
import type { DemoInstitutionMode } from '@/lib/demo-showroom';

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

  // Convites demonstrativos
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invTier, setInvTier] = useState<'faculdade' | 'escola'>('faculdade');
  const [invDays, setInvDays] = useState(15);
  const [invRole, setInvRole] = useState<ExperienceRole>('reitor');
  const [invLink, setInvLink] = useState('');
  const [invBusy, setInvBusy] = useState(false);
  const [invError, setInvError] = useState('');
  const [invNotice, setInvNotice] = useState('');
  const [invites, setInvites] = useState<ExperienceInvite[]>([]);

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

  useEffect(() => { loadData(); loadInvites(); }, [loadData]);

  const apiCall = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) throw new Error('Sessão não disponível');
    return experienceApi(action, data, session.session.access_token);
  }, []);

  async function loadInvites() {
    try {
      const data = await apiCall('admin:list');
      setInvites((data.invitations ?? []) as ExperienceInvite[]);
    } catch { /* silently fail if not master MFA */ }
  }

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    setInvBusy(true); setInvError(''); setInvLink(''); setInvNotice('');
    try {
      const hours = invDays * 24;
      const mode: DemoInstitutionMode = invTier === 'escola' ? 'escola' : 'faculdade';
      const role = invTier === 'escola' ? 'diretor_escola' as ExperienceRole : invRole;
      const result = await apiCall('admin:create', {
        email: invEmail.trim().toLowerCase(),
        name: invName.trim(),
        mode, role, hours,
      });
      setInvLink(result.link);
      setInvNotice(`Convite criado para ${invName.trim()} (${invDays} dias). Copie o link e envie por e-mail.`);
      setInvEmail(''); setInvName('');
      await loadInvites();
    } catch (err: any) {
      setInvError(err.message);
    } finally {
      setInvBusy(false);
    }
  }

  async function revokeInvite(id: string, email: string) {
    if (!window.confirm(`Revogar convite de ${email}?`)) return;
    try {
      await apiCall('admin:revoke', { id });
      await loadInvites();
    } catch (err: any) {
      setInvError(err.message);
    }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(invLink); setInvNotice('Link copiado!'); } catch { }
  }

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

      {/* ── Convites Demonstrativos ── */}
      <div style={{ marginBottom: 28, background: 'var(--bg-card, #fff)', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', borderLeft: '5px solid #d97706' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showInvite ? 16 : 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>🎟️ Convites Demonstrativos</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
              Envie um link para a IES ou escola explorar a plataforma completa por tempo limitado.
              {invites.filter(i => !i.revoked_at && new Date(i.expires_at) > new Date()).length > 0 &&
                <span style={{ marginLeft: 8, padding: '2px 8px', background: '#fef3c7', color: '#b45309', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  {invites.filter(i => !i.revoked_at && new Date(i.expires_at) > new Date()).length} ativo(s)
                </span>
              }
            </p>
          </div>
          <button onClick={() => setShowInvite(!showInvite)} style={{
            padding: '8px 18px', background: showInvite ? '#f1f5f9' : '#d97706', color: showInvite ? '#475569' : '#fff',
            border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            {showInvite ? 'Fechar' : '+ Novo convite'}
          </button>
        </div>

        {showInvite && (
          <div>
            <form onSubmit={createInvite} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Nome do destinatário
                <input type="text" required value={invName} onChange={e => setInvName(e.target.value)}
                  placeholder="Ex: Prof. João Silva"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                E-mail
                <input type="email" required value={invEmail} onChange={e => setInvEmail(e.target.value)}
                  placeholder="joao@instituicao.edu.br"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Tipo de instituição
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => { setInvTier('faculdade'); setInvRole('reitor'); }}
                    style={{ flex: 1, padding: '8px 12px', border: `2px solid ${invTier === 'faculdade' ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, background: invTier === 'faculdade' ? '#eff6ff' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: invTier === 'faculdade' ? '#2563eb' : '#64748b' }}>
                    🏛️ Faculdade
                  </button>
                  <button type="button" onClick={() => { setInvTier('escola'); setInvRole('diretor_escola'); }}
                    style={{ flex: 1, padding: '8px 12px', border: `2px solid ${invTier === 'escola' ? '#7c3aed' : '#e2e8f0'}`, borderRadius: 8, background: invTier === 'escola' ? '#f5f3ff' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: invTier === 'escola' ? '#7c3aed' : '#64748b' }}>
                    🏫 Escola
                  </button>
                </div>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Prazo de acesso
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {[7, 15, 30].map(d => (
                    <button key={d} type="button" onClick={() => setInvDays(d)}
                      style={{ flex: 1, padding: '8px 10px', border: `2px solid ${invDays === d ? '#d97706' : '#e2e8f0'}`, borderRadius: 8, background: invDays === d ? '#fffbeb' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: invDays === d ? '#d97706' : '#64748b' }}>
                      {d} dias
                    </button>
                  ))}
                </div>
              </label>
              {invTier === 'faculdade' && (
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', gridColumn: '1 / -1' }}>
                  Perfil de acesso
                  <select value={invRole} onChange={e => setInvRole(e.target.value as ExperienceRole)}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    <option value="reitor">Direção / Mantenedor (acesso total)</option>
                    <option value="coordenador">Coordenador de Curso</option>
                  </select>
                </label>
              )}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="submit" disabled={invBusy}
                  style={{ padding: '10px 24px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: invBusy ? .6 : 1 }}>
                  {invBusy ? 'Gerando...' : 'Gerar link de acesso'}
                </button>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  O destinatário terá acesso completo à plataforma demo por {invDays} dias. Cada clique em módulo add-on mostra aviso de contratação separada.
                </span>
              </div>
            </form>

            {invError && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13, marginBottom: 12 }}>⚠ {invError}</div>}
            {invNotice && <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#166534', fontSize: 13, marginBottom: 12 }}>✅ {invNotice}</div>}

            {invLink && (
              <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>🔗 Link gerado (envie por e-mail)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={invLink} style={{ flex: 1, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }} />
                  <button onClick={copyLink} style={{ padding: '6px 14px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Copiar</button>
                </div>
              </div>
            )}

            {/* Convites ativos */}
            {invites.length > 0 && (
              <div>
                <h4 style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 700, color: '#475569' }}>Convites recentes</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {invites.slice(0, 10).map(inv => {
                    const expired = new Date(inv.expires_at) < new Date();
                    const revoked = !!inv.revoked_at;
                    const active = !expired && !revoked;
                    return (
                      <div key={inv.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        background: active ? '#f0fdf4' : '#f9fafb', border: `1px solid ${active ? '#86efac' : '#e5e7eb'}`,
                        borderRadius: 8, fontSize: 13,
                      }}>
                        <span>{inv.institution_type === 'escola' ? '🏫' : '🏛️'}</span>
                        <div style={{ flex: 1 }}>
                          <strong>{inv.recipient_name}</strong>
                          <span style={{ color: '#94a3b8', marginLeft: 6 }}>{inv.target_email}</span>
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{inv.opens} abertura(s)</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: active ? '#dcfce7' : revoked ? '#fef2f2' : '#f1f5f9',
                          color: active ? '#15803d' : revoked ? '#991b1b' : '#64748b',
                        }}>
                          {active ? `Ativo (${Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / 86400000)}d)` : revoked ? 'Revogado' : 'Expirado'}
                        </span>
                        {active && (
                          <button onClick={() => revokeInvite(inv.id, inv.target_email)}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Revogar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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
