import { HelpLabel } from '@/components/ContextHelp';
import MasterOverview, { type MasterDestination } from './MasterOverview';
/**
 * MasterHub.tsx — Painel master de primeiro nível
 * Hub que separa Universidades, Escolas, Financeiro e BI Vértice
 */
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { experienceApi, type ExperienceInvite, type ExperienceRole } from '@/lib/experience-access';
import type { DemoInstitutionMode } from '@/lib/demo-showroom';

interface Props {
  onNavigate: (destination: MasterDestination, institutionId?: string) => void;
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

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#999', fontFamily: 'Inter, system-ui, sans-serif' }}>Carregando painel master...</div>;
  }

  return (
    <MasterOverview ies={recentIes} schools={recentEscolas} revenue={kpis.mrr_ies + kpis.mrr_escolas} contracts={kpis.contratos_ativos} trials={kpis.trials_ativos} onNavigate={onNavigate}>
      {/* ── Convites Demonstrativos ── */}
      <section className="master-invites" aria-labelledby="master-invites-title">
        <div className="master-invites-head">
          <div>
            <h3 id="master-invites-title">Convites demonstrativos</h3>
            <p>Crie acessos temporários para conhecer a plataforma.
              {invites.filter(i => !i.revoked_at && new Date(i.expires_at) > new Date()).length > 0 &&
                <span> · {invites.filter(i => !i.revoked_at && new Date(i.expires_at) > new Date()).length} ativo(s)</span>}
            </p>
          </div>
          <button type="button" aria-expanded={showInvite} aria-controls="master-invites-content" onClick={() => setShowInvite(!showInvite)}>
            {showInvite ? 'Fechar formulário' : '+ Novo convite'}
          </button>
        </div>

        {showInvite && (
          <div id="master-invites-content" className="master-invites-content">
            <form onSubmit={createInvite} className="master-invite-form">
              <HelpLabel style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Nome do destinatário
                <input type="text" required value={invName} onChange={e => setInvName(e.target.value)}
                  placeholder="Ex: Prof. João Silva"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </HelpLabel>
              <HelpLabel style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                E-mail
                <input type="email" required value={invEmail} onChange={e => setInvEmail(e.target.value)}
                  placeholder="joao@instituicao.edu.br"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </HelpLabel>
              <HelpLabel style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Tipo de instituição
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => { setInvTier('faculdade'); setInvRole('reitor'); }}
                    style={{ flex: 1, padding: '8px 12px', border: `2px solid ${invTier === 'faculdade' ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, background: invTier === 'faculdade' ? '#eff6ff' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: invTier === 'faculdade' ? '#2563eb' : '#64748b' }}>
                    🏛️ Faculdade
                  </button>
                  <button type="button" onClick={() => { setInvTier('escola'); setInvRole('diretor_escola'); }}
                    style={{ flex: 1, padding: '8px 12px', border: `2px solid ${invTier === 'escola' ? '#1a56db' : '#e2e8f0'}`, borderRadius: 8, background: invTier === 'escola' ? '#eff6ff' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: invTier === 'escola' ? '#1a56db' : '#64748b' }}>
                    🏫 Escola
                  </button>
                </div>
              </HelpLabel>
              <HelpLabel style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Prazo de acesso
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {[7, 15, 30].map(d => (
                    <button key={d} type="button" onClick={() => setInvDays(d)}
                      style={{ flex: 1, padding: '8px 10px', border: `2px solid ${invDays === d ? '#1a56db' : '#e2e8f0'}`, borderRadius: 8, background: invDays === d ? '#eff6ff' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: invDays === d ? '#1a56db' : '#64748b' }}>
                      {d} dias
                    </button>
                  ))}
                </div>
              </HelpLabel>
              {invTier === 'faculdade' && (
                <HelpLabel style={{ fontSize: 13, fontWeight: 600, color: '#374151', gridColumn: '1 / -1' }}>
                  Perfil de acesso
                  <select value={invRole} onChange={e => setInvRole(e.target.value as ExperienceRole)}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                    <option value="reitor">Direção / Mantenedor (acesso total)</option>
                    <option value="coordenador">Coordenador de Curso</option>
                  </select>
                </HelpLabel>
              )}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="submit" disabled={invBusy}
                  style={{ padding: '10px 24px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: invBusy ? .6 : 1 }}>
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
              <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>🔗 Link gerado (envie por e-mail)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={invLink} style={{ flex: 1, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }} />
                  <button onClick={copyLink} style={{ padding: '6px 14px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Copiar</button>
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
      </section>
    </MasterOverview>
  );
}
