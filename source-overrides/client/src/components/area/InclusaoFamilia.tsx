import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildSupportPayload, checkedWrite } from "@/lib/student-support-contracts";
import { familyLink, generateFamilyToken, sha256Hex, shareState } from "@/lib/family-share";

interface PlanRef { id: string; institution_id: string; case_id: string; student_name: string; version_number?: number }
interface Share { id: string; plan_id: string; summary: string; expires_at: string; revoked_at?: string | null; view_count: number; last_viewed_at?: string | null; created_at: string }
const empty = { plan_id: '', summary: '', validity_days: '30', show_accommodations: true };

export default function InclusaoFamilia({ institutionId, plans }: { institutionId: string; plans: PlanRef[] }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const planName = (id: string) => { const p = plans.find(x => x.id === id); return p ? `${p.student_name} · PEI v${p.version_number || 1}` : '—'; };

  const load = useCallback(async () => {
    const r = await supabase.from('student_family_shares').select('id,plan_id,summary,expires_at,revoked_at,view_count,last_viewed_at,created_at').eq('institution_id', institutionId).order('created_at', { ascending: false });
    if (!mounted.current) return;
    if (r.error) { setError('Não foi possível carregar os links da família.'); return; }
    setError(''); setShares((r.data ?? []) as Share[]);
  }, [institutionId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(''); setCopied(false);
    try {
      const token = generateFamilyToken();
      const payload = buildSupportPayload('familyShare', { ...form, token_hash: await sha256Hex(token) }, { institutionId, cases: [], plans });
      await checkedWrite(supabase.from('student_family_shares').insert(payload));
      if (!mounted.current) return;
      setLink(familyLink(window.location.origin, token));
      setOpen(false); setForm(empty);
      await load();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Não foi possível gerar o link.'); }
    finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  const revoke = async (id: string) => {
    if (lock.current) return;
    lock.current = true; setError('');
    try {
      await checkedWrite(supabase.from('student_family_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('institution_id', institutionId));
      await load();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Não foi possível revogar.'); }
    finally { lock.current = false; }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('Copie o link manualmente.'); } };

  return (
    <div className="inc-section">
      {error && <div className="inc-error" role="alert">{error}</div>}
      <div className="inc-header"><h3>Acesso da família</h3><button className="inc-btn-primary" onClick={() => { setOpen(true); setLink(''); }}>+ Novo link</button></div>
      <div className="inc-ev-note">A família vê somente o resumo que você escrever aqui, o período do plano e, se marcado, as adaptações. Laudos, avaliações e notas internas nunca são exibidos. O link aparece uma única vez e pode ser revogado a qualquer momento.</div>
      {link && (
        <div className="inc-form" role="status">
          <strong>Link gerado (guarde agora, não será exibido de novo):</strong>
          <input aria-label="Link da família" readOnly value={link} onFocus={e => e.currentTarget.select()} />
          <div className="inc-form-actions"><button className="inc-btn-primary" onClick={copy}>{copied ? 'Copiado' : 'Copiar link'}</button></div>
        </div>
      )}
      {open && (
        <div className="inc-form">
          <select aria-label="Plano" value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>
            <option value="">Plano (obrigatório)</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.student_name} · PEI v{p.version_number || 1}</option>)}
          </select>
          <textarea aria-label="Resumo para a família" placeholder="Resumo para a família (linguagem simples, mínimo 20 caracteres)" rows={4} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
          <div className="inc-form-row">
            <label>Validade<select value={form.validity_days} onChange={e => setForm({ ...form, validity_days: e.target.value })}><option value="7">7 dias</option><option value="30">30 dias</option><option value="60">60 dias</option></select></label>
            <label><input type="checkbox" checked={form.show_accommodations} onChange={e => setForm({ ...form, show_accommodations: e.target.checked })} /> Mostrar adaptações</label>
          </div>
          <div className="inc-form-actions">
            <button className="inc-btn-primary" disabled={saving || !form.plan_id} onClick={create}>Gerar link</button>
            <button className="inc-btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {shares.map(s => {
        const st = shareState(s);
        return (
          <div key={s.id} className="inc-plan-card">
            <div className="inc-plan-header"><span className="inc-plan-type">{planName(s.plan_id)}</span><span className={`inc-badge inc-badge-${st}`}>{st}</span></div>
            <div className="inc-plan-obj">{s.summary}</div>
            <div className="inc-plan-meta">
              <span>Válido até {new Date(s.expires_at).toLocaleDateString('pt-BR')}</span>
              <span>{s.view_count} acesso(s){s.last_viewed_at ? `, último em ${new Date(s.last_viewed_at).toLocaleDateString('pt-BR')}` : ''}</span>
            </div>
            {st === 'ativo' && <button className="inc-btn-small" onClick={() => revoke(s.id)}>Revogar</button>}
          </div>
        );
      })}
      {shares.length === 0 && <div className="inc-empty">Nenhum link gerado.</div>}
    </div>
  );
}
