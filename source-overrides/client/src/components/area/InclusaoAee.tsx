import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildSupportPayload, checkedWrite, assessmentStatuses, referralStatuses } from "@/lib/student-support-contracts";

interface CaseRef { id: string; institution_id: string; student_name: string; student_matricula?: string; course_id?: string }
interface Assessment { id: string; case_id: string; strengths?: string; educational_needs?: string; participation_barriers?: string; strategies_used?: string; previous_results?: string; recommended_support?: string; assessor_name?: string; assessment_date: string; status: string }
interface Referral { id: string; case_id: string; from_sector: string; to_sector: string; reason: string; notes?: string; status: string; created_at: string; response_note?: string }
const emptyA = { case_id: '', assessor_name: '', assessment_date: '', status: 'rascunho', strengths: '', educational_needs: '', participation_barriers: '', strategies_used: '', previous_results: '', recommended_support: '' };
const emptyR = { case_id: '', from_sector: '', to_sector: 'AEE', reason: '', notes: '' };
const aLabels: [keyof typeof emptyA, string][] = [['strengths', 'Potencialidades'], ['educational_needs', 'Necessidades educacionais'], ['participation_barriers', 'Barreiras'], ['strategies_used', 'Estratégias já utilizadas'], ['previous_results', 'Resultados anteriores'], ['recommended_support', 'Apoios recomendados']];

export default function InclusaoAee({ institutionId, cases }: { institutionId: string; cases: CaseRef[] }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [formA, setFormA] = useState(emptyA);
  const [formR, setFormR] = useState(emptyR);
  const [open, setOpen] = useState<'a' | 'r' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const name = (id: string) => cases.find(c => c.id === id)?.student_name || '—';

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      supabase.from('student_support_assessments').select('*').eq('institution_id', institutionId).order('assessment_date', { ascending: false }),
      supabase.from('student_support_referrals').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
    ]);
    if (!mounted.current) return;
    if (a.error || r.error) { setError('Não foi possível carregar avaliações e encaminhamentos.'); return; }
    setError(''); setAssessments((a.data ?? []) as Assessment[]); setReferrals((r.data ?? []) as Referral[]);
  }, [institutionId]);
  useEffect(() => { load(); }, [load]);

  const save = async (kind: 'assessment' | 'referral') => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try {
      const form = kind === 'assessment' ? formA : formR;
      const payload = buildSupportPayload(kind, form, { institutionId, cases });
      await checkedWrite(supabase.from(kind === 'assessment' ? 'student_support_assessments' : 'student_support_referrals').insert(payload));
      if (!mounted.current) return;
      setOpen(null); setFormA(emptyA); setFormR(emptyR);
      await load();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  const setReferralStatus = async (id: string, status: string) => {
    if (lock.current) return;
    lock.current = true; setError('');
    try {
      if (!referralStatuses.includes(status)) throw new Error('Situação inválida.');
      const patch = status === 'pendente' ? { status } : { status, responded_at: new Date().toISOString() };
      await checkedWrite(supabase.from('student_support_referrals').update(patch).eq('id', id).eq('institution_id', institutionId));
      await load();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Não foi possível atualizar.'); }
    finally { lock.current = false; }
  };
  const caseSelect = (value: string, onChange: (v: string) => void) => (
    <select aria-label="Caso" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Vincular a caso (obrigatório)</option>
      {cases.map(c => <option key={c.id} value={c.id}>{c.student_name}</option>)}
    </select>
  );

  return (
    <div className="inc-section">
      {error && <div className="inc-error" role="alert">{error}</div>}
      <div className="inc-header"><h3>Avaliações pedagógicas (AEE)</h3><button className="inc-btn-primary" onClick={() => setOpen('a')}>+ Nova avaliação</button></div>
      {open === 'a' && (
        <div className="inc-form">
          <div className="inc-form-row">
            {caseSelect(formA.case_id, v => setFormA({ ...formA, case_id: v }))}
            <input aria-label="Avaliador" placeholder="Avaliador(a)" value={formA.assessor_name} onChange={e => setFormA({ ...formA, assessor_name: e.target.value })} />
            <input aria-label="Data" type="date" value={formA.assessment_date} onChange={e => setFormA({ ...formA, assessment_date: e.target.value })} />
            <select aria-label="Situação" value={formA.status} onChange={e => setFormA({ ...formA, status: e.target.value })}>{assessmentStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          {aLabels.map(([k, l]) => <textarea key={k} aria-label={l} placeholder={l} rows={2} value={formA[k]} onChange={e => setFormA({ ...formA, [k]: e.target.value })} />)}
          <div className="inc-form-actions">
            <button className="inc-btn-primary" disabled={saving || !formA.case_id} onClick={() => save('assessment')}>Salvar avaliação</button>
            <button className="inc-btn-secondary" onClick={() => setOpen(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {assessments.map(a => (
        <div key={a.id} className="inc-plan-card">
          <div className="inc-plan-header"><span className="inc-plan-type">Avaliação</span><span className={`inc-badge inc-badge-${a.status}`}>{a.status}</span></div>
          <div className="inc-plan-student">{name(a.case_id)}</div>
          {aLabels.map(([k, l]) => (a as unknown as Record<string, string | undefined>)[k] ? <div key={k} className="inc-plan-obj"><strong>{l}:</strong> {(a as unknown as Record<string, string | undefined>)[k]}</div> : null)}
          <div className="inc-plan-meta"><span>{new Date(a.assessment_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>{a.assessor_name && <span>{a.assessor_name}</span>}</div>
        </div>
      ))}
      {assessments.length === 0 && <div className="inc-empty">Nenhuma avaliação registrada.</div>}

      <div className="inc-header"><h3>Encaminhamentos</h3><button className="inc-btn-primary" onClick={() => setOpen('r')}>+ Novo encaminhamento</button></div>
      {open === 'r' && (
        <div className="inc-form">
          <div className="inc-form-row">
            {caseSelect(formR.case_id, v => setFormR({ ...formR, case_id: v }))}
            <input aria-label="Setor de origem" placeholder="Setor de origem" value={formR.from_sector} onChange={e => setFormR({ ...formR, from_sector: e.target.value })} />
            <input aria-label="Setor de destino" placeholder="Setor de destino" value={formR.to_sector} onChange={e => setFormR({ ...formR, to_sector: e.target.value })} />
          </div>
          <textarea aria-label="Motivo" placeholder="Motivo" rows={2} value={formR.reason} onChange={e => setFormR({ ...formR, reason: e.target.value })} />
          <textarea aria-label="Observações" placeholder="Observações" rows={2} value={formR.notes} onChange={e => setFormR({ ...formR, notes: e.target.value })} />
          <div className="inc-form-actions">
            <button className="inc-btn-primary" disabled={saving || !formR.case_id} onClick={() => save('referral')}>Encaminhar</button>
            <button className="inc-btn-secondary" onClick={() => setOpen(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {referrals.map(r => (
        <div key={r.id} className="inc-plan-card">
          <div className="inc-plan-header"><span className="inc-plan-type">{r.from_sector} → {r.to_sector}</span><span className={`inc-badge inc-badge-${r.status}`}>{r.status}</span></div>
          <div className="inc-plan-student">{name(r.case_id)}</div>
          <div className="inc-plan-obj">{r.reason}</div>
          {r.notes && <div className="inc-plan-obj">{r.notes}</div>}
          <div className="inc-plan-meta"><span>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
            <select aria-label="Situação do encaminhamento" value={r.status} onChange={e => setReferralStatus(r.id, e.target.value)}>{referralStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
      ))}
      {referrals.length === 0 && <div className="inc-empty">Nenhum encaminhamento registrado.</div>}
    </div>
  );
}
