import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { COURSE_FUNCTION_LABEL, grantCourseFunction, listCourseStaff, revokeCourseFunction, type CourseFunction, type CourseStaffRow } from '@/lib/course-staff-api';

type Course = { id: string; name: string };

/** Atribuição de coordenação e NDE por curso (gestão da IES). */
export default function CourseStaffFunctions({ institutionId, courses }: { institutionId: string; courses: Course[] }) {
  const [rows, setRows] = useState<CourseStaffRow[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [fn, setFn] = useState<CourseFunction>('coordenador');
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, team] = await Promise.all([listCourseStaff(institutionId), supabase.rpc('vertice_team', { target: institutionId })]);
      setRows(list);
      if (!team.error) setEmails(((team.data ?? []) as { email: string }[]).map(m => m.email).filter(Boolean).sort());
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [institutionId]);
  useEffect(() => { void load(); }, [load]);

  const grant = async () => {
    if (!email.trim() || !courseId) { setError('Informe o e-mail e o curso.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      setRows(await grantCourseFunction(institutionId, email, courseId, fn));
      setNotice(`${COURSE_FUNCTION_LABEL[fn]} atribuída a ${email.trim()}.`); setEmail('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao atribuir'); }
    finally { setBusy(false); }
  };
  const revoke = async (r: CourseStaffRow) => {
    if (!window.confirm(`Encerrar ${COURSE_FUNCTION_LABEL[r.function]} de ${r.email} em ${r.course_name}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { setRows(await revokeCourseFunction(institutionId, r.user_id, r.course_id, r.function)); setNotice('Função encerrada. O histórico foi mantido.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao encerrar'); }
    finally { setBusy(false); }
  };

  const visible = rows.filter(r => showHistory || r.active);
  return (
    <div className="area-panel">
      <div className="area-panel-head"><h3>Coordenação e NDE por curso</h3></div>
      <p className="area-muted small">A função vale só para o curso indicado e se soma ao perfil da pessoa na instituição, que não muda.
        Coordenação: Avalia 360° completo (inclusive validação colegiada) e edição da Construção Curricular. NDE: consulta ao Avalia 360° e edição da Construção Curricular.
        A pessoa precisa já ter aceitado o convite da Equipe.</p>
      {error && <p role="alert" className="planning-error">{error}</p>}
      {notice && <p role="status" className="planning-success">{notice}</p>}
      <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="planning-field"><span>E-mail</span>
          <input list="course-staff-emails" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@instituicao.edu.br" disabled={busy} />
          <datalist id="course-staff-emails">{emails.map(m => <option key={m} value={m} />)}</datalist></label>
        <label className="planning-field"><span>Curso</span>
          <select value={courseId} onChange={e => setCourseId(e.target.value)} disabled={busy}>
            <option value="">Selecione</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="planning-field"><span>Função</span>
          <select value={fn} onChange={e => setFn(e.target.value as CourseFunction)} disabled={busy}>
            <option value="coordenador">{COURSE_FUNCTION_LABEL.coordenador}</option><option value="nde">{COURSE_FUNCTION_LABEL.nde}</option>
          </select></label>
        <button type="button" className="planning-primary" disabled={busy} onClick={() => void grant()}>Atribuir</button>
      </div>
      <label style={{ fontSize: 13, display: 'block', margin: '10px 0' }}><input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} /> Mostrar funções encerradas</label>
      <div className="table-scroll">
        <table className="area-table">
          <thead><tr><th>Curso</th><th>Pessoa</th><th>Função</th><th>Desde</th><th /></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={5} className="area-muted">Nenhuma função atribuída.</td></tr>}
            {visible.map(r => <tr key={`${r.course_id}:${r.user_id}:${r.function}`} className={r.active ? undefined : 'pending'}>
              <td>{r.course_name}</td><td>{r.email}</td><td>{COURSE_FUNCTION_LABEL[r.function]}</td>
              <td>{new Date(r.granted_at).toLocaleDateString('pt-BR')}{!r.active && r.revoked_at ? ` — encerrada em ${new Date(r.revoked_at).toLocaleDateString('pt-BR')}` : ''}</td>
              <td>{r.active && <button type="button" className="corp-login-text-button area-danger" disabled={busy} onClick={() => void revoke(r)}>Encerrar</button>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
