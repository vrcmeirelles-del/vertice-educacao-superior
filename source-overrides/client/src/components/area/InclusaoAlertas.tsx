import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { checkedWrite } from "@/lib/student-support-contracts";
import { RULES_VERSION, ruleLabels, severityLabels, sortAlerts, describeEvidence, type PeiAlert } from "@/lib/pei-alerts";

interface QueueRow { case_id: string; student_name: string; priority: string; alertas_abertos: number; pontuacao: number; updated_at: string }

export default function InclusaoAlertas({ institutionId }: { institutionId: string }) {
  const [alerts, setAlerts] = useState<PeiAlert[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async (refresh: boolean) => {
    setBusy(true); setError('');
    try {
      if (refresh) {
        const r = await supabase.rpc('vertice_pei_alerts_refresh', { p_institution: institutionId });
        if (r.error) throw new Error('Não foi possível recalcular os alertas.');
      }
      const [a, q] = await Promise.all([
        supabase.from('pei_alerts').select('id,case_id,rule_id,severity,status,evidence,created_at').eq('institution_id', institutionId).is('resolved_at', null).in('status', ['aberto', 'reconhecido']),
        supabase.from('v_pei_case_queue').select('case_id,student_name,priority,alertas_abertos,pontuacao,updated_at').eq('institution_id', institutionId).gt('alertas_abertos', 0).order('pontuacao', { ascending: false }).order('updated_at', { ascending: true }),
      ]);
      if (a.error || q.error) throw new Error('Não foi possível carregar os alertas.');
      if (!mounted.current) return;
      setAlerts(sortAlerts((a.data ?? []) as PeiAlert[])); setQueue((q.data ?? []) as QueueRow[]);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Falha ao carregar.'); }
    finally { if (mounted.current) setBusy(false); }
  }, [institutionId]);
  useEffect(() => { load(true); }, [load]);

  const act = async (id: string, status: 'reconhecido' | 'dispensado') => {
    setError('');
    try {
      if (status === 'dispensado' && reason.trim().length < 5) throw new Error('Informe o motivo (ao menos 5 caracteres).');
      await checkedWrite(supabase.from('pei_alerts').update(status === 'dispensado' ? { status, dismissed_reason: reason.trim() } : { status }).eq('id', id).eq('institution_id', institutionId));
      setDismissing(null); setReason('');
      await load(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar.'); }
  };
  const nameOf = (caseId: string) => queue.find(q => q.case_id === caseId)?.student_name ?? '—';

  return (
    <div className="inc-section">
      {error && <div className="inc-error" role="alert">{error}</div>}
      <div className="inc-header"><h3>Alertas do PEI</h3><button className="inc-btn-secondary" disabled={busy} onClick={() => load(true)}>{busy ? 'Calculando…' : 'Recalcular'}</button></div>
      <div className="inc-ev-note">Regras fixas ({RULES_VERSION}) sobre prazos, status e preenchimento. Os alertas sugerem ação, não decidem nada e não leem laudo. Limiares provisórios, a definir pela equipe especialista.</div>

      <h4>Fila de trabalho</h4>
      {queue.map(q => (
        <div key={q.case_id} className="inc-plan-card">
          <div className="inc-plan-header"><span className="inc-plan-student">{q.student_name}</span><span className="inc-badge">{q.alertas_abertos} alerta(s)</span></div>
          <div className="inc-plan-meta"><span>Prioridade do caso: {q.priority}</span><span>Ordem na fila: {q.pontuacao}</span></div>
        </div>
      ))}
      {queue.length === 0 && !busy && <div className="inc-empty">Nenhum caso com alerta aberto.</div>}

      <h4>Alertas abertos</h4>
      {alerts.map(a => (
        <div key={a.id} className="inc-plan-card">
          <div className="inc-plan-header"><span className="inc-plan-type">{a.rule_id} · {ruleLabels[a.rule_id] ?? a.rule_id}</span><span className={`inc-badge inc-badge-${a.severity}`}>{severityLabels[a.severity] ?? a.severity}</span></div>
          <div className="inc-plan-student">{nameOf(a.case_id)}</div>
          <div className="inc-plan-obj">{describeEvidence(a.evidence)}</div>
          <div className="inc-plan-meta">
            {a.status === 'aberto' && <button className="inc-btn-small" onClick={() => act(a.id, 'reconhecido')}>Reconhecer</button>}
            {a.status === 'reconhecido' && <span>Reconhecido</span>}
            <button className="inc-btn-small" onClick={() => { setDismissing(a.id); setReason(''); }}>Dispensar</button>
          </div>
          {dismissing === a.id && (
            <div className="inc-form">
              <input aria-label="Motivo da dispensa" placeholder="Motivo (obrigatório)" value={reason} onChange={e => setReason(e.target.value)} />
              <div className="inc-form-actions"><button className="inc-btn-primary" onClick={() => act(a.id, 'dispensado')}>Confirmar dispensa</button><button className="inc-btn-secondary" onClick={() => setDismissing(null)}>Cancelar</button></div>
            </div>
          )}
        </div>
      ))}
      {alerts.length === 0 && !busy && <div className="inc-empty">Sem alertas abertos.</div>}
    </div>
  );
}
