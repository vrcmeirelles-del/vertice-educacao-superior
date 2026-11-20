import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildSupportPayload, checkedWrite, teacherLogTypes, courseActionStatuses } from "@/lib/student-support-contracts";

interface PlanRef { id: string; institution_id: string; case_id: string; course_id?: string; student_name: string; version_number?: number }
interface Action { id: string; institution_id: string; plan_id: string; case_id: string; discipline_name: string; professor_name: string; instructions: string; adaptations_planned?: string; resources_needed?: string; status: string; due_date?: string }
interface Log { id: string; action_id: string; log_type: string; description: string; evidence_note?: string; action_date: string }
const emptyAction = { plan_id: '', discipline_name: '', professor_name: '', instructions: '', adaptations_planned: '', resources_needed: '', semester_label: '', start_date: '', due_date: '' };
const emptyLog = { action_id: '', log_type: 'registro_geral', description: '', evidence_note: '', action_date: '' };
const label = (v: string) => v.replaceAll('_', ' ');

export default function InclusaoProfessor({ institutionId, plans }: { institutionId: string; plans: PlanRef[] }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [formA, setFormA] = useState(emptyAction);
  const [formL, setFormL] = useState(emptyLog);
  const [open, setOpen] = useState<'a' | 'l' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const planName = (id: string) => { const p = plans.find(x => x.id === id); return p ? `${p.student_name} · PEI v${p.version_number || 1}` : '—'; };

  const load = useCallback(async () => {
    const [a, l] = await Promise.all([
      supabase.from('student_course_support_actions').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('student_teacher_support_logs').select('*').eq('institution_id', institutionId).order('action_date', { ascending: false }),
    ]);
    if (!mounted.current) return;
    if (a.error || l.error) { setError('Não foi possível carregar as ações e registros.'); return; }
    setError(''); setActions((a.data ?? []) as Action[]); setLogs((l.data ?? []) as Log[]);
  }, [institutionId]);
  useEffect(() => { load(); }, [load]);

  const save = async (kind: 'courseAction' | 'teacherLog') => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try {
      const form = kind === 'courseAction' ? formA : formL;
      const payload = buildSupportPayload(kind, form, { institutionId, cases: [], plans, actions });
      await checkedWrite(supabase.from(kind === 'courseAction' ? 'student_course_support_actions' : 'student_teacher_support_logs').insert(payload));
      if (!mounted.current) return;
      setOpen(null); setFormA(emptyAction); setFormL(emptyLog);
      await load();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  const setStatus = async (id: string, status: string) => {
    if (lock.current) return;
    lock.current = true; setError('');
    try {
      if (!courseActionStatuses.includes(status)) throw new Error('Situação inválida.');
      const patch: Record<string, unknown> = { status };
      if (status === 'ciencia_registrada') patch.acknowledged_at = new Date().toISOString();
      if (status === 'validada') patch.validated_at = new Date().toISOString();
      await checkedWrite(supabase.from('student_course_support_actions').update(patch).eq('id', id).eq('institution_id', institutionId));
      await load();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Não foi possível atualizar.'); }
    finally { lock.current = false; }
  };
  const field = (k: keyof typeof emptyAction, ph: string, rows = 0) => rows
    ? <textarea aria-label={ph} placeholder={ph} rows={rows} value={formA[k]} onChange={e => setFormA({ ...formA, [k]: e.target.value })} />
    : <input aria-label={ph} placeholder={ph} value={formA[k]} onChange={e => setFormA({ ...formA, [k]: e.target.value })} />;

  return (
    <div className="inc-section">
      {error && <div className="inc-error" role="alert">{error}</div>}
      <div className="inc-header"><h3>Ações por disciplina (professor)</h3><button className="inc-btn-primary" onClick={() => setOpen('a')}>+ Nova ação</button></div>
      {open === 'a' && (
        <div className="inc-form">
          <select aria-label="Plano" value={formA.plan_id} onChange={e => setFormA({ ...formA, plan_id: e.target.value })}>
            <option value="">Vincular a plano (obrigatório)</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.student_name} · PEI v{p.version_number || 1}</option>)}
          </select>
          <div className="inc-form-row">{field('discipline_name', 'Disciplina')}{field('professor_name', 'Professor(a)')}{field('semester_label', 'Período (ex.: 2026.2)')}</div>
          {field('instructions', 'Orientações ao professor', 2)}
          {field('adaptations_planned', 'Adaptações previstas', 2)}
          {field('resources_needed', 'Recursos necessários', 2)}
          <div className="inc-form-row">
            <label>Início<input type="date" value={formA.start_date} onChange={e => setFormA({ ...formA, start_date: e.target.value })} /></label>
            <label>Prazo<input type="date" value={formA.due_date} onChange={e => setFormA({ ...formA, due_date: e.target.value })} /></label>
          </div>
          <div className="inc-form-actions">
            <button className="inc-btn-primary" disabled={saving || !formA.plan_id} onClick={() => save('courseAction')}>Criar ação</button>
            <button className="inc-btn-secondary" onClick={() => setOpen(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {actions.map(a => {
        const al = logs.filter(l => l.action_id === a.id);
        return (
          <div key={a.id} className="inc-plan-card">
            <div className="inc-plan-header"><span className="inc-plan-type">{a.discipline_name}</span>
              <select aria-label="Situação da ação" value={a.status} onChange={e => setStatus(a.id, e.target.value)}>{courseActionStatuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></div>
            <div className="inc-plan-student">{planName(a.plan_id)} · {a.professor_name}</div>
            <div className="inc-plan-obj">{a.instructions}</div>
            {a.adaptations_planned && <div className="inc-plan-obj"><strong>Adaptações:</strong> {a.adaptations_planned}</div>}
            {a.resources_needed && <div className="inc-plan-obj"><strong>Recursos:</strong> {a.resources_needed}</div>}
            {a.due_date && <div className="inc-plan-meta"><span>Prazo: {new Date(a.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>}
            <div className="inc-plan-accoms">
              <strong>Registros ({al.length})</strong>
              {al.map(l => <div key={l.id} className="inc-accom"><span className="inc-accom-type">{label(l.log_type)}</span><span className="inc-accom-desc">{l.description}{l.evidence_note ? ` — Evidência: ${l.evidence_note}` : ''}</span><span className="inc-accom-teacher">{new Date(l.action_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>)}
              <button className="inc-btn-small" onClick={() => { setFormL({ ...emptyLog, action_id: a.id }); setOpen('l'); }}>+ Registro</button>
            </div>
          </div>
        );
      })}
      {actions.length === 0 && <div className="inc-empty">Nenhuma ação atribuída. Crie uma a partir de um PEI.</div>}
      {open === 'l' && (
        <div className="inc-form">
          <select aria-label="Tipo de registro" value={formL.log_type} onChange={e => setFormL({ ...formL, log_type: e.target.value })}>{teacherLogTypes.map(t => <option key={t} value={t}>{label(t)}</option>)}</select>
          <textarea aria-label="Descrição" placeholder="Descrição do que foi feito" rows={2} value={formL.description} onChange={e => setFormL({ ...formL, description: e.target.value })} />
          <textarea aria-label="Evidência" placeholder="Evidência (nota ou referência)" rows={2} value={formL.evidence_note} onChange={e => setFormL({ ...formL, evidence_note: e.target.value })} />
          <input aria-label="Data" type="date" value={formL.action_date} onChange={e => setFormL({ ...formL, action_date: e.target.value })} />
          <div className="inc-form-actions">
            <button className="inc-btn-primary" disabled={saving} onClick={() => save('teacherLog')}>Salvar registro</button>
            <button className="inc-btn-secondary" onClick={() => setOpen(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
